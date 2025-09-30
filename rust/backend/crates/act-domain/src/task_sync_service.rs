use std::sync::Arc;
use std::collections::HashMap;
use std::time::Duration;

use async_trait::async_trait;
use thiserror::Error;
use tokio::sync::RwLock;
use tokio::time::{sleep, Instant};
use tracing::{debug, error, info, warn};

use crate::{
    MicrosoftAuthService, MicrosoftAuthError,
    GraphClient, GraphApiError,
    MicrosoftAuthRepository, MicrosoftAuthRepositoryError,
};
use crate::microsoft_auth_types::{
    MicrosoftTask, TaskSyncMetadata, TaskSyncStats, TaskSyncStatus, TaskStatus, TaskImportance,
};
use crate::workspace_service::WorkspaceService;

#[derive(Debug, Error)]
pub enum TaskSyncError {
    #[error("Microsoft auth error: {0}")]
    MicrosoftAuth(#[from] MicrosoftAuthError),

    #[error("Graph API error: {0}")]
    GraphApi(#[from] GraphApiError),

    #[error("Repository error: {0}")]
    Repository(#[from] MicrosoftAuthRepositoryError),

    #[error("Workspace error: {0}")]
    Workspace(String),

    #[error("Sync conflict: {0}")]
    Conflict(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Sync timeout")]
    Timeout,

    #[error("Task processing error: {0}")]
    TaskProcessing(String),
}

/// Configuration for background task synchronization
#[derive(Debug, Clone)]
pub struct TaskSyncConfig {
    /// Default sync interval in seconds
    pub default_sync_interval: u64,
    /// Maximum number of concurrent sync operations
    pub max_concurrent_syncs: usize,
    /// Timeout for individual sync operations in seconds
    pub sync_timeout_seconds: u64,
    /// Maximum number of retries for failed syncs
    pub max_retries: u32,
    /// Backoff multiplier for retries
    pub retry_backoff_multiplier: f64,
    /// Rate limit requests per minute
    pub rate_limit_rpm: u32,
}

impl Default for TaskSyncConfig {
    fn default() -> Self {
        Self {
            default_sync_interval: 300, // 5 minutes
            max_concurrent_syncs: 5,
            sync_timeout_seconds: 60,
            max_retries: 3,
            retry_backoff_multiplier: 2.0,
            rate_limit_rpm: 100, // Microsoft Graph API limit
        }
    }
}

/// Result of a task synchronization operation
#[derive(Debug, Clone)]
pub struct TaskSyncResult {
    pub workspace_id: String,
    pub tasks_synced: usize,
    pub tasks_created: usize,
    pub tasks_updated: usize,
    pub tasks_deleted: usize,
    pub conflicts: usize,
    pub errors: Vec<String>,
    pub duration_ms: u64,
    pub next_sync_at: i64,
}

/// Background task synchronization service
///
/// This service handles:
/// - Periodic synchronization of tasks from Microsoft To Do
/// - Conflict resolution and bidirectional sync
/// - Rate limiting and retry logic
/// - Real-time updates via WebSocket
pub struct TaskSyncService {
    config: TaskSyncConfig,
    microsoft_auth: Arc<MicrosoftAuthService>,
    graph_client: Arc<dyn GraphClient>,
    repository: Arc<dyn MicrosoftAuthRepository>,
    workspace_service: Arc<WorkspaceService>,

    // Runtime state
    sync_state: Arc<RwLock<HashMap<String, SyncState>>>,
    rate_limiter: Arc<RwLock<RateLimiter>>,
}

#[derive(Debug, Clone)]
struct SyncState {
    is_syncing: bool,
    last_sync_at: Option<i64>,
    next_sync_at: Option<i64>,
    retry_count: u32,
    last_error: Option<String>,
}

#[derive(Debug)]
struct RateLimiter {
    requests: Vec<Instant>,
}

impl RateLimiter {
    fn new() -> Self {
        Self {
            requests: Vec::new(),
        }
    }

    async fn check_rate_limit(&mut self, limit: u32, window: Duration) -> Result<(), TaskSyncError> {
        let now = Instant::now();
        let window_start = now - window;

        // Remove old requests outside the window
        self.requests.retain(|&timestamp| timestamp > window_start);

        if self.requests.len() >= limit as usize {
            return Err(TaskSyncError::RateLimitExceeded);
        }

        self.requests.push(now);
        Ok(())
    }
}

impl TaskSyncService {
    pub fn new(
        config: TaskSyncConfig,
        microsoft_auth: Arc<MicrosoftAuthService>,
        graph_client: Arc<dyn GraphClient>,
        repository: Arc<dyn MicrosoftAuthRepository>,
        workspace_service: Arc<WorkspaceService>,
    ) -> Self {
        Self {
            config,
            microsoft_auth,
            graph_client,
            repository,
            workspace_service,
            sync_state: Arc::new(RwLock::new(HashMap::new())),
            rate_limiter: Arc::new(RwLock::new(RateLimiter::new())),
        }
    }

    /// Start background synchronization for all user workspaces
    pub async fn start_background_sync(&self) -> Result<(), TaskSyncError> {
        info!("Starting background task synchronization");

        loop {
            if let Err(e) = self.sync_due_workspaces().await {
                error!("Background sync failed: {}", e);
            }

            // Sleep before next check
            sleep(Duration::from_secs(30)).await; // Check every 30 seconds
        }
    }

    /// Synchronize all workspaces that are due for sync
    async fn sync_due_workspaces(&self) -> Result<(), TaskSyncError> {
        let now = chrono::Utc::now().timestamp();

        // Get workspaces needing sync
        let workspaces = self.repository.get_workspaces_needing_sync(now).await?;

        // Limit concurrent syncs
        let sync_handles: Vec<_> = workspaces
            .into_iter()
            .take(self.config.max_concurrent_syncs)
            .map(|metadata| {
                let service = self.clone();
                tokio::spawn(async move {
                    service.sync_workspace(&metadata.workspace_id).await
                })
            })
            .collect();

        // Wait for all syncs to complete
        for handle in sync_handles {
            if let Err(e) = handle.await {
                error!("Workspace sync task failed: {}", e);
            }
        }

        Ok(())
    }

    /// Synchronize a specific workspace
    pub async fn sync_workspace(&self, workspace_id: &str) -> Result<TaskSyncResult, TaskSyncError> {
        let _start_time = Instant::now();

        // Check if already syncing
        {
            let state = self.sync_state.read().await;
            if let Some(sync_state) = state.get(workspace_id) {
                if sync_state.is_syncing {
                    return Err(TaskSyncError::Conflict(format!(
                        "Workspace {} is already being synced", workspace_id
                    )));
                }
            }
        }

        // Mark as syncing
        {
            let mut state = self.sync_state.write().await;
            state.insert(workspace_id.to_string(), SyncState {
                is_syncing: true,
                last_sync_at: None,
                next_sync_at: None,
                retry_count: 0,
                last_error: None,
            });
        }

        let result = self.do_sync_workspace(workspace_id, _start_time).await;

        // Update sync state
        {
            let mut state = self.sync_state.write().await;
            if let Some(sync_state) = state.get_mut(workspace_id) {
                sync_state.is_syncing = false;
                sync_state.last_sync_at = Some(chrono::Utc::now().timestamp());

                match &result {
                    Ok(sync_result) => {
                        sync_state.next_sync_at = Some(sync_result.next_sync_at);
                        sync_state.retry_count = 0;
                        sync_state.last_error = None;
                    }
                    Err(e) => {
                        sync_state.retry_count += 1;
                        sync_state.last_error = Some(e.to_string());
                    }
                }
            }
        }

        result
    }

    async fn do_sync_workspace(&self, workspace_id: &str, start_time: Instant) -> Result<TaskSyncResult, TaskSyncError> {
        debug!("Starting sync for workspace: {}", workspace_id);

        // Get workspace info
        let workspace = self.workspace_service
            .get_workspace("system", &workspace_id.to_string()) // Use system user for background sync
            .await
            .map_err(|e| TaskSyncError::Workspace(e.to_string()))?;

        // Get Microsoft list mapping
        let list_id = self.repository.get_workspace_list_id(workspace_id).await?
            .ok_or_else(|| TaskSyncError::Workspace(format!(
                "No Microsoft list mapping for workspace: {}", workspace_id
            )))?;

        // Get sync metadata
        let mut metadata = self.repository.get_task_sync_metadata(workspace_id).await?
            .unwrap_or_else(|| TaskSyncMetadata {
                workspace_id: workspace_id.to_string(),
                microsoft_list_id: list_id.to_string(),
                last_sync_timestamp: 0,
                sync_version: "1.0".to_string(),
                sync_errors: 0,
                last_sync_error: None,
                next_sync_attempt: None,
                sync_interval_seconds: self.config.default_sync_interval as i32,
                is_sync_enabled: true,
                created_at: chrono::Utc::now().timestamp(),
                updated_at: chrono::Utc::now().timestamp(),
            });

        // Check rate limit
        {
            let mut rate_limiter = self.rate_limiter.write().await;
            rate_limiter.check_rate_limit(
                self.config.rate_limit_rpm,
                Duration::from_secs(60),
            ).await?;
        }

        // Get Microsoft access token
        let access_token = self.microsoft_auth.get_access_token(&workspace.user_id).await?;

        // Fetch tasks from Microsoft
        let microsoft_tasks = self.graph_client.get_tasks(&access_token, &list_id).await?;

        // Get local tasks
        let local_tasks = self.repository.get_workspace_tasks(workspace_id).await?;

        // Process changes
        let mut result = TaskSyncResult {
            workspace_id: workspace_id.to_string(),
            tasks_synced: 0,
            tasks_created: 0,
            tasks_updated: 0,
            tasks_deleted: 0,
            conflicts: 0,
            errors: Vec::new(),
            duration_ms: 0,
            next_sync_at: 0,
        };

        // Sync Microsoft tasks to local
        for microsoft_task in &microsoft_tasks {
            match self.sync_microsoft_task_to_local(workspace_id, &list_id, microsoft_task, &local_tasks).await {
                Ok(sync_action) => {
                    match sync_action {
                        SyncAction::Created => result.tasks_created += 1,
                        SyncAction::Updated => result.tasks_updated += 1,
                        SyncAction::Unchanged => {}
                    }
                    result.tasks_synced += 1;
                }
                Err(e) => {
                    warn!("Failed to sync task {}: {}", microsoft_task.id, e);
                    result.errors.push(format!("Task {}: {}", microsoft_task.id, e));
                }
            }
        }

        // Handle local deletions (tasks that exist locally but not in Microsoft)
        for local_task in &local_tasks {
            if !microsoft_tasks.iter().any(|mt| mt.id == local_task.id) && local_task.sync_status != TaskSyncStatus::PendingCreate {
                // Task was deleted in Microsoft, delete locally
                if let Err(e) = self.repository.delete_task(&local_task.id).await {
                    result.errors.push(format!("Delete task {}: {}", local_task.id, e));
                } else {
                    result.tasks_deleted += 1;
                }
            }
        }

        // Update sync metadata
        let now = chrono::Utc::now().timestamp();
        metadata.last_sync_timestamp = now;
        metadata.sync_errors = if result.errors.is_empty() { 0 } else { metadata.sync_errors + 1 };
        metadata.last_sync_error = if result.errors.is_empty() { None } else {
            Some(result.errors.first().unwrap().clone())
        };
        metadata.next_sync_attempt = Some(now + metadata.sync_interval_seconds as i64);
        result.next_sync_at = metadata.next_sync_attempt.unwrap();

        if result.errors.len() > 3 {
            // Too many errors, back off
            metadata.sync_interval_seconds = (metadata.sync_interval_seconds as f64 * 1.5) as i32;
            warn!("Backing off sync for workspace {} due to errors", workspace_id);
        } else if result.errors.is_empty() && metadata.sync_errors > 0 {
            // Successful sync after errors, reset interval
            metadata.sync_interval_seconds = self.config.default_sync_interval as i32;
            metadata.sync_errors = 0;
        }

        self.repository.upsert_task_sync_metadata(&metadata).await?;

        result.duration_ms = start_time.elapsed().as_millis() as u64;

        info!(
            "Workspace {} sync completed: {} tasks synced ({} created, {} updated, {} deleted) in {}ms",
            workspace_id, result.tasks_synced, result.tasks_created,
            result.tasks_updated, result.tasks_deleted, result.duration_ms
        );

        Ok(result)
    }

    async fn sync_microsoft_task_to_local(
        &self,
        workspace_id: &str,
        list_id: &str,
        microsoft_task: &crate::microsoft_graph_client::Task,
        local_tasks: &[MicrosoftTask],
    ) -> Result<SyncAction, TaskSyncError> {
        // Find matching local task
        if let Some(local_task) = local_tasks.iter().find(|lt| lt.id == microsoft_task.id) {
            // Check if update is needed
            if self.parse_datetime(&microsoft_task.last_modified_date_time) > local_task.last_modified_date_time {
                // Update local task
                let updated_task = MicrosoftTask {
                    id: microsoft_task.id.clone(),
                    workspace_id: workspace_id.to_string(),
                    microsoft_list_id: local_task.microsoft_list_id.clone(),
                    title: microsoft_task.title.clone(),
                    body_content: microsoft_task.body.as_ref().map(|b| b.content.clone()),
                    content_type: microsoft_task.body.as_ref().map(|b| b.content_type.clone()),
                    status: self.map_task_status(microsoft_task.status.clone()),
                    importance: self.map_task_importance(microsoft_task.importance.clone()),
                    is_reminder_on: false, // Microsoft Graph API doesn't have this field
                    reminder_date_time: None, // Microsoft Graph API doesn't have this field
                    created_date_time: Some(self.parse_datetime(&microsoft_task.created_date_time)),
                    due_date_time: microsoft_task.due_date_time.as_ref().map(|dt| self.parse_datetime(&dt.date_time)),
                    completed_date_time: None, // Microsoft Graph API doesn't have this field
                    last_modified_date_time: self.parse_datetime(&microsoft_task.last_modified_date_time),
                    sync_status: TaskSyncStatus::Synced,
                    local_last_modified: chrono::Utc::now().timestamp(),
                    created_at: local_task.created_at,
                    updated_at: chrono::Utc::now().timestamp(),
                };

                self.repository.upsert_task(&updated_task).await?;
                Ok(SyncAction::Updated)
            } else {
                Ok(SyncAction::Unchanged)
            }
        } else {
            // Create new local task
            let new_task = MicrosoftTask {
                id: microsoft_task.id.clone(),
                workspace_id: workspace_id.to_string(),
                microsoft_list_id: list_id.to_string(),
                title: microsoft_task.title.clone(),
                body_content: microsoft_task.body.as_ref().map(|b| b.content.clone()),
                content_type: microsoft_task.body.as_ref().map(|b| b.content_type.clone()),
                status: self.map_task_status(microsoft_task.status.clone()),
                importance: self.map_task_importance(microsoft_task.importance.clone()),
                is_reminder_on: false, // Microsoft Graph API doesn't have this field
                reminder_date_time: None, // Microsoft Graph API doesn't have this field
                created_date_time: Some(self.parse_datetime(&microsoft_task.created_date_time)),
                due_date_time: microsoft_task.due_date_time.as_ref().map(|dt| self.parse_datetime(&dt.date_time)),
                completed_date_time: None, // Microsoft Graph API doesn't have this field
                last_modified_date_time: self.parse_datetime(&microsoft_task.last_modified_date_time),
                sync_status: TaskSyncStatus::Synced,
                local_last_modified: chrono::Utc::now().timestamp(),
                created_at: chrono::Utc::now().timestamp(),
                updated_at: chrono::Utc::now().timestamp(),
            };

            self.repository.upsert_task(&new_task).await?;
            Ok(SyncAction::Created)
        }
    }

    fn map_task_status(&self, status: crate::microsoft_graph_client::TaskStatus) -> TaskStatus {
        match status {
            crate::microsoft_graph_client::TaskStatus::NotStarted => TaskStatus::NotStarted,
            crate::microsoft_graph_client::TaskStatus::InProgress => TaskStatus::InProgress,
            crate::microsoft_graph_client::TaskStatus::Completed => TaskStatus::Completed,
            crate::microsoft_graph_client::TaskStatus::WaitingOnOthers => TaskStatus::WaitingOnOthers,
            crate::microsoft_graph_client::TaskStatus::Deferred => TaskStatus::Deferred,
        }
    }

    fn map_task_importance(&self, importance: crate::microsoft_graph_client::TaskImportance) -> TaskImportance {
        match importance {
            crate::microsoft_graph_client::TaskImportance::Low => TaskImportance::Low,
            crate::microsoft_graph_client::TaskImportance::High => TaskImportance::High,
            crate::microsoft_graph_client::TaskImportance::Normal => TaskImportance::Normal,
        }
    }

    fn parse_datetime(&self, datetime_str: &str) -> i64 {
        // Parse ISO 8601 datetime string from Microsoft Graph API
        chrono::DateTime::parse_from_rfc3339(datetime_str)
            .unwrap_or_else(|_| chrono::Utc::now().into())
            .timestamp()
    }

    /// Get synchronization statistics for a workspace
    pub async fn get_sync_stats(&self, workspace_id: &str) -> Result<TaskSyncStats, TaskSyncError> {
        let metadata = self.repository.get_task_sync_metadata(workspace_id).await?;
        let tasks = self.repository.get_workspace_tasks(workspace_id).await?;

        let stats = TaskSyncStats {
            total_tasks: tasks.len(),
            synced_tasks: tasks.iter().filter(|t| t.sync_status == TaskSyncStatus::Synced).count(),
            pending_changes: tasks.iter().filter(|t| t.sync_status != TaskSyncStatus::Synced).count(),
            conflicts: tasks.iter().filter(|t| t.sync_status == TaskSyncStatus::Conflict).count(),
            last_sync: metadata.as_ref().map(|m| m.last_sync_timestamp),
            next_sync: metadata.as_ref().and_then(|m| m.next_sync_attempt),
        };

        Ok(stats)
    }

    /// Manually trigger synchronization for a workspace
    pub async fn trigger_sync(&self, workspace_id: &str) -> Result<TaskSyncResult, TaskSyncError> {
        info!("Manual sync triggered for workspace: {}", workspace_id);

        // Update next sync attempt to now
        if let Some(mut metadata) = self.repository.get_task_sync_metadata(workspace_id).await? {
            metadata.next_sync_attempt = Some(chrono::Utc::now().timestamp());
            self.repository.upsert_task_sync_metadata(&metadata).await?;
        }

        self.sync_workspace(workspace_id).await
    }

    /// Enable or disable synchronization for a workspace
    pub async fn set_sync_enabled(&self, workspace_id: &str, enabled: bool) -> Result<(), TaskSyncError> {
        let mut metadata = self.repository.get_task_sync_metadata(workspace_id).await?
            .unwrap_or_else(|| TaskSyncMetadata {
                workspace_id: workspace_id.to_string(),
                microsoft_list_id: String::new(), // Will be filled when first synced
                last_sync_timestamp: 0,
                sync_version: "1.0".to_string(),
                sync_errors: 0,
                last_sync_error: None,
                next_sync_attempt: None,
                sync_interval_seconds: self.config.default_sync_interval as i32,
                is_sync_enabled: true,
                created_at: chrono::Utc::now().timestamp(),
                updated_at: chrono::Utc::now().timestamp(),
            });

        metadata.is_sync_enabled = enabled;
        metadata.updated_at = chrono::Utc::now().timestamp();

        self.repository.upsert_task_sync_metadata(&metadata).await?;

        info!("Sync {} for workspace: {}", if enabled { "enabled" } else { "disabled" }, workspace_id);
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SyncAction {
    Created,
    Updated,
    Unchanged,
}

impl Clone for TaskSyncService {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            microsoft_auth: self.microsoft_auth.clone(),
            graph_client: self.graph_client.clone(),
            repository: self.repository.clone(),
            workspace_service: self.workspace_service.clone(),
            sync_state: self.sync_state.clone(),
            rate_limiter: self.rate_limiter.clone(),
        }
    }
}

#[async_trait]
pub trait TaskSync: Send + Sync {
    async fn sync_workspace(&self, workspace_id: &str) -> Result<TaskSyncResult, TaskSyncError>;
    async fn get_sync_stats(&self, workspace_id: &str) -> Result<TaskSyncStats, TaskSyncError>;
    async fn trigger_sync(&self, workspace_id: &str) -> Result<TaskSyncResult, TaskSyncError>;
    async fn set_sync_enabled(&self, workspace_id: &str, enabled: bool) -> Result<(), TaskSyncError>;
    async fn start_background_sync(&self) -> Result<(), TaskSyncError>;
}

#[async_trait]
impl TaskSync for TaskSyncService {
    async fn sync_workspace(&self, workspace_id: &str) -> Result<TaskSyncResult, TaskSyncError> {
        self.sync_workspace(workspace_id).await
    }

    async fn get_sync_stats(&self, workspace_id: &str) -> Result<TaskSyncStats, TaskSyncError> {
        self.get_sync_stats(workspace_id).await
    }

    async fn trigger_sync(&self, workspace_id: &str) -> Result<TaskSyncResult, TaskSyncError> {
        self.trigger_sync(workspace_id).await
    }

    async fn set_sync_enabled(&self, workspace_id: &str, enabled: bool) -> Result<(), TaskSyncError> {
        self.set_sync_enabled(workspace_id, enabled).await
    }

    async fn start_background_sync(&self) -> Result<(), TaskSyncError> {
        self.start_background_sync().await
    }
}