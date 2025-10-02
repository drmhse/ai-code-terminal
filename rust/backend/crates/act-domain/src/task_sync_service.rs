use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use thiserror::Error;
use tokio::sync::RwLock;
use tokio::time::{sleep, Instant};
use tracing::{debug, error, info, warn};

use crate::microsoft_auth_types::{
    MicrosoftTask, TaskImportance, TaskStatus, TaskSyncMetadata, TaskSyncStats, TaskSyncStatus,
};
use crate::workspace_service::WorkspaceService;
use crate::{
    GraphApiError, GraphClient, MicrosoftAuthError, MicrosoftAuthRepository,
    MicrosoftAuthRepositoryError, MicrosoftAuthService,
};

#[derive(Debug, Error)]
pub enum TaskSyncError {
    #[error("Microsoft auth error: {0}")]
    MicrosoftAuth(#[from] MicrosoftAuthError),

    #[error("Graph API error: {0}")]
    GraphApi(#[from] GraphApiError),

    #[error("Repository error: {0}")]
    Repository(#[from] MicrosoftAuthRepositoryError),

    #[error("Validation error: {0}")]
    Validation(String),

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

/// Background task data synchronization service
///
/// # Responsibility
/// This service handles **bidirectional synchronization** of task data between
/// local database and Microsoft To Do. It does NOT manage workspace-list mappings -
/// that's TodoSyncService's responsibility.
///
/// # Key Functions
/// - Periodic background sync on configurable intervals (default: 5min)
/// - Conflict resolution using last-modified timestamps
/// - Rate limiting (100 req/min respecting Microsoft Graph API limits)
/// - Exponential backoff on errors with configurable retry logic
/// - Sync state tracking per workspace
///
/// # Architecture Note
/// This service is intentionally separate from TodoSyncService:
/// - **TodoSyncService**: Manages "which list belongs to which workspace"
/// - **TaskSyncService**: Manages "keeping task data synchronized"
///
/// Dependencies flow correctly: TaskSyncService depends on TodoSyncService
/// to resolve workspace_id → microsoft_list_id before syncing task data.
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

    async fn check_rate_limit(
        &mut self,
        limit: u32,
        window: Duration,
    ) -> Result<(), TaskSyncError> {
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
    /// Validates a task title according to Microsoft To-Do requirements
    fn validate_task_title(title: &str) -> Result<String, TaskSyncError> {
        // Trim whitespace
        let trimmed = title.trim();

        // Check for empty or whitespace-only title
        if trimmed.is_empty() {
            return Err(TaskSyncError::Validation(
                "Task title cannot be empty".to_string(),
            ));
        }

        // Check maximum length (Microsoft To-Do limit is 255 characters)
        if trimmed.len() > 255 {
            return Err(TaskSyncError::Validation(format!(
                "Task title too long: {} characters (max: 255)",
                trimmed.len()
            )));
        }

        Ok(trimmed.to_string())
    }

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
                tokio::spawn(async move { service.sync_workspace(&metadata.workspace_id).await })
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
    pub async fn sync_workspace(
        &self,
        workspace_id: &str,
    ) -> Result<TaskSyncResult, TaskSyncError> {
        let _start_time = Instant::now();

        // Check if already syncing
        {
            let state = self.sync_state.read().await;
            if let Some(sync_state) = state.get(workspace_id) {
                if sync_state.is_syncing {
                    return Err(TaskSyncError::Conflict(format!(
                        "Workspace {} is already being synced",
                        workspace_id
                    )));
                }
            }
        }

        // Mark as syncing
        {
            let mut state = self.sync_state.write().await;
            state.insert(
                workspace_id.to_string(),
                SyncState {
                    is_syncing: true,
                    last_sync_at: None,
                    next_sync_at: None,
                    retry_count: 0,
                    last_error: None,
                },
            );
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

    async fn do_sync_workspace(
        &self,
        workspace_id: &str,
        start_time: Instant,
    ) -> Result<TaskSyncResult, TaskSyncError> {
        debug!("Starting sync for workspace: {}", workspace_id);

        // Get Microsoft list mapping
        let list_id = self
            .repository
            .get_workspace_list_id(workspace_id)
            .await?
            .ok_or_else(|| {
                TaskSyncError::Workspace(format!(
                    "No Microsoft list mapping for workspace: {}",
                    workspace_id
                ))
            })?;

        // Get sync metadata (now includes user_id from JOIN with workspaces table)
        let metadata = self.repository.get_task_sync_metadata(workspace_id).await?;

        // Get user_id from metadata, or fetch from workspace if metadata doesn't exist
        let user_id = if let Some(ref meta) = metadata {
            meta.user_id.clone().ok_or_else(|| {
                TaskSyncError::Workspace(format!(
                    "No user_id found for workspace: {}",
                    workspace_id
                ))
            })?
        } else {
            // Metadata doesn't exist, get user_id from workspace using system access
            let workspace = self
                .workspace_service
                .get_workspace_system(&workspace_id.to_string())
                .await
                .map_err(|e| TaskSyncError::Workspace(e.to_string()))?
                .ok_or_else(|| {
                    TaskSyncError::Workspace(format!("Workspace not found: {}", workspace_id))
                })?;
            workspace.user_id.clone()
        };

        // Create default metadata if it doesn't exist
        let mut metadata = metadata.unwrap_or_else(|| TaskSyncMetadata {
            workspace_id: workspace_id.to_string(),
            microsoft_list_id: list_id.to_string(),
            user_id: Some(user_id.clone()),
            last_sync_timestamp: 0,
            last_successful_sync: None,
            sync_version: "1.0".to_string(),
            sync_errors: 0,
            max_sync_errors: 10,
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
            rate_limiter
                .check_rate_limit(self.config.rate_limit_rpm, Duration::from_secs(60))
                .await?;
        }

        // Get Microsoft access token using the user_id
        let access_token = self.microsoft_auth.get_access_token(&user_id).await?;

        // Fetch tasks from Microsoft
        let (microsoft_tasks, _) = self
            .graph_client
            .get_tasks(&access_token, &list_id, None)
            .await?;

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
            match self
                .sync_microsoft_task_to_local(workspace_id, &list_id, microsoft_task, &local_tasks)
                .await
            {
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
                    result
                        .errors
                        .push(format!("Task {}: {}", microsoft_task.id, e));
                }
            }
        }

        // Handle local deletions (tasks that exist locally but not in Microsoft)
        for local_task in &local_tasks {
            if !microsoft_tasks.iter().any(|mt| mt.id == local_task.id)
                && local_task.sync_status != TaskSyncStatus::PendingCreate
            {
                // Task was deleted in Microsoft, delete locally
                if let Err(e) = self.repository.delete_task(&local_task.id).await {
                    result
                        .errors
                        .push(format!("Delete task {}: {}", local_task.id, e));
                } else {
                    result.tasks_deleted += 1;
                }
            }
        }

        // Update sync metadata
        let now = chrono::Utc::now().timestamp();
        metadata.last_sync_timestamp = now;

        if result.errors.is_empty() {
            // Successful sync - reset error counter and update last successful sync
            metadata.sync_errors = 0;
            metadata.last_sync_error = None;
            metadata.last_successful_sync = Some(now);

            // Reset sync interval if it was backed off due to previous errors
            if metadata.sync_interval_seconds != self.config.default_sync_interval as i32 {
                metadata.sync_interval_seconds = self.config.default_sync_interval as i32;
                info!(
                    "Reset sync interval to default for workspace {} after successful sync",
                    workspace_id
                );
            }
        } else {
            // Sync had errors - increment counter
            metadata.sync_errors += 1;
            metadata.last_sync_error = Some(result.errors.first().unwrap().clone());

            // Check if we've hit max errors threshold
            if metadata.sync_errors >= metadata.max_sync_errors {
                metadata.is_sync_enabled = false;
                error!(
                    "Disabled sync for workspace {} after {} consecutive errors. Last error: {}",
                    workspace_id,
                    metadata.sync_errors,
                    metadata.last_sync_error.as_ref().unwrap()
                );
            } else if result.errors.len() > 3 {
                // Too many errors in this sync, back off
                metadata.sync_interval_seconds =
                    (metadata.sync_interval_seconds as f64 * 1.5) as i32;
                warn!(
                    "Backing off sync for workspace {} (error {}/{}) - new interval: {}s",
                    workspace_id,
                    metadata.sync_errors,
                    metadata.max_sync_errors,
                    metadata.sync_interval_seconds
                );
            }
        }

        metadata.next_sync_attempt = Some(now + metadata.sync_interval_seconds as i64);
        result.next_sync_at = metadata.next_sync_attempt.unwrap();

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
            if self.parse_datetime(&microsoft_task.last_modified_date_time)
                > local_task.last_modified_date_time
            {
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
                    due_date_time: microsoft_task
                        .due_date_time
                        .as_ref()
                        .map(|dt| self.parse_datetime(&dt.date_time)),
                    completed_date_time: None, // Microsoft Graph API doesn't have this field
                    last_modified_date_time: self
                        .parse_datetime(&microsoft_task.last_modified_date_time),
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
                due_date_time: microsoft_task
                    .due_date_time
                    .as_ref()
                    .map(|dt| self.parse_datetime(&dt.date_time)),
                completed_date_time: None, // Microsoft Graph API doesn't have this field
                last_modified_date_time: self
                    .parse_datetime(&microsoft_task.last_modified_date_time),
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
            crate::microsoft_graph_client::TaskStatus::WaitingOnOthers => {
                TaskStatus::WaitingOnOthers
            }
            crate::microsoft_graph_client::TaskStatus::Deferred => TaskStatus::Deferred,
        }
    }

    fn map_task_importance(
        &self,
        importance: crate::microsoft_graph_client::TaskImportance,
    ) -> TaskImportance {
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
            synced_tasks: tasks
                .iter()
                .filter(|t| t.sync_status == TaskSyncStatus::Synced)
                .count(),
            pending_changes: tasks
                .iter()
                .filter(|t| t.sync_status != TaskSyncStatus::Synced)
                .count(),
            conflicts: tasks
                .iter()
                .filter(|t| t.sync_status == TaskSyncStatus::Conflict)
                .count(),
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
    pub async fn set_sync_enabled(
        &self,
        workspace_id: &str,
        enabled: bool,
    ) -> Result<(), TaskSyncError> {
        let mut metadata = self
            .repository
            .get_task_sync_metadata(workspace_id)
            .await?
            .unwrap_or_else(|| TaskSyncMetadata {
                workspace_id: workspace_id.to_string(),
                microsoft_list_id: String::new(), // Will be filled when first synced
                user_id: None,                    // Will be populated from JOIN query when fetched
                last_sync_timestamp: 0,
                last_successful_sync: None,
                sync_version: "1.0".to_string(),
                sync_errors: 0,
                max_sync_errors: 10,
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

        info!(
            "Sync {} for workspace: {}",
            if enabled { "enabled" } else { "disabled" },
            workspace_id
        );
        Ok(())
    }

    /// Append content to a task's description
    /// Takes workspace_id to lookup the list_id mapping
    pub async fn append_to_task_description(
        &self,
        user_id: &str,
        workspace_id: &str,
        task_id: &str,
        content: &str,
    ) -> Result<(), TaskSyncError> {
        info!(
            "Appending content to task: {} in workspace: {}",
            task_id, workspace_id
        );

        // Get all workspace mappings and find the one for this workspace
        let mappings = self.repository.get_all_workspace_mappings().await?;
        let mapping = mappings
            .iter()
            .find(|m| m.workspace_id == workspace_id)
            .ok_or_else(|| {
                TaskSyncError::Workspace(format!(
                    "No Microsoft To-Do list mapped for workspace: {}",
                    workspace_id
                ))
            })?;

        // Get access token for the authenticated user
        let token = self
            .microsoft_auth
            .get_access_token(user_id)
            .await
            .map_err(|e| TaskSyncError::MicrosoftAuth(e))?;

        let current_task = self
            .graph_client
            .get_task(&token, &mapping.microsoft_list_id, task_id)
            .await?;

        // Append new content to existing body content
        let updated_content = if let Some(body) = &current_task.body {
            format!("{}\n{}", body.content, content)
        } else {
            content.to_string()
        };

        // Update task via Microsoft Graph API
        let update_body = serde_json::json!({
            "body": {
                "contentType": "text",
                "content": updated_content
            }
        });

        self.graph_client
            .patch_task(&token, &mapping.microsoft_list_id, task_id, update_body)
            .await?;

        info!("Successfully appended content to task: {}", task_id);
        Ok(())
    }

    /// Get a specific task by ID
    pub async fn get_task(
        &self,
        user_id: &str,
        workspace_id: &str,
        task_id: &str,
    ) -> Result<Option<crate::microsoft_graph_client::Task>, TaskSyncError> {
        // Get all workspace mappings and find the one for this workspace
        let mappings = self.repository.get_all_workspace_mappings().await?;
        let mapping = mappings
            .iter()
            .find(|m| m.workspace_id == workspace_id)
            .ok_or_else(|| {
                TaskSyncError::Workspace(format!(
                    "No Microsoft To-Do list mapped for workspace: {}",
                    workspace_id
                ))
            })?;

        // Get access token for the authenticated user
        let token = self
            .microsoft_auth
            .get_access_token(user_id)
            .await
            .map_err(|e| TaskSyncError::MicrosoftAuth(e))?;

        match self
            .graph_client
            .get_task(&token, &mapping.microsoft_list_id, task_id)
            .await
        {
            Ok(task) => Ok(Some(task)),
            Err(GraphApiError::NotFound { .. }) => Ok(None),
            Err(e) => Err(TaskSyncError::GraphApi(e)),
        }
    }
    /// Update the status of a Microsoft To-Do task with optional content appending
    /// This unified method handles both simple status updates and status updates with content
    pub async fn update_task_with_optional_content(
        &self,
        user_id: &str,
        workspace_id: &str,
        task_id: &str,
        status: crate::microsoft_graph_client::TaskStatus,
        content: Option<&str>,
    ) -> Result<(), TaskSyncError> {
        let action = if content.is_some() {
            "status and appending content"
        } else {
            "status"
        };
        info!(
            "Updating task {} {} in workspace: {}",
            task_id, action, workspace_id
        );

        // Get all workspace mappings and find the one for this workspace
        let mappings = self.repository.get_all_workspace_mappings().await?;
        let mapping = mappings
            .iter()
            .find(|m| m.workspace_id == workspace_id)
            .ok_or_else(|| {
                TaskSyncError::Workspace(format!(
                    "No Microsoft To-Do list mapped for workspace: {}",
                    workspace_id
                ))
            })?;

        // Get access token for the authenticated user
        let token = self
            .microsoft_auth
            .get_access_token(user_id)
            .await
            .map_err(|e| TaskSyncError::MicrosoftAuth(e))?;

        // Get current task to preserve other fields
        let current_task = self
            .graph_client
            .get_task(&token, &mapping.microsoft_list_id, task_id)
            .await?;

        // Handle optional content appending
        let body = if let Some(new_content) = content {
            let updated_content = if let Some(body) = &current_task.body {
                format!("{}\n{}", body.content, new_content)
            } else {
                new_content.to_string()
            };
            Some(crate::microsoft_graph_client::TaskBody {
                content: updated_content,
                content_type: "text".to_string(),
            })
        } else {
            current_task.body.clone()
        };

        // Validate and use the current task title
        let validated_title = Self::validate_task_title(&current_task.title)?;

        // Create update request with new status and optional content
        let update_request = crate::microsoft_graph_client::CreateTaskRequest {
            title: validated_title,
            body,
            importance: Some(current_task.importance.clone()),
            due_date_time: current_task.due_date_time.clone(),
            status: Some(status.clone()),
        };

        // Update task via Microsoft Graph API
        self.graph_client
            .update_task(&token, &mapping.microsoft_list_id, task_id, update_request)
            .await?;

        info!("Successfully updated task {} {}", task_id, action);
        Ok(())
    }

    /// Update the status of a Microsoft To-Do task
    /// This is a convenience wrapper around update_task_with_optional_content
    pub async fn update_task_status(
        &self,
        user_id: &str,
        workspace_id: &str,
        task_id: &str,
        status: crate::microsoft_graph_client::TaskStatus,
    ) -> Result<(), TaskSyncError> {
        self.update_task_with_optional_content(user_id, workspace_id, task_id, status, None)
            .await
    }

    /// Update task status and append execution results in one operation
    /// This is a convenience wrapper around update_task_with_optional_content
    pub async fn update_task_status_and_append_results(
        &self,
        user_id: &str,
        workspace_id: &str,
        task_id: &str,
        status: crate::microsoft_graph_client::TaskStatus,
        content: &str,
    ) -> Result<(), TaskSyncError> {
        self.update_task_with_optional_content(
            user_id,
            workspace_id,
            task_id,
            status,
            Some(content),
        )
        .await
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
    async fn set_sync_enabled(
        &self,
        workspace_id: &str,
        enabled: bool,
    ) -> Result<(), TaskSyncError>;
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

    async fn set_sync_enabled(
        &self,
        workspace_id: &str,
        enabled: bool,
    ) -> Result<(), TaskSyncError> {
        self.set_sync_enabled(workspace_id, enabled).await
    }

    async fn start_background_sync(&self) -> Result<(), TaskSyncError> {
        self.start_background_sync().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::mock;
    use mockall::predicate::*;

    mock! {
        TestMicrosoftAuthRepository {}

        #[async_trait]
        impl MicrosoftAuthRepository for TestMicrosoftAuthRepository {
            async fn store_tokens(&self, user_id: &str, access_token: &str, refresh_token: &str, expires_at: i64) -> Result<(), MicrosoftAuthRepositoryError>;
            async fn get_tokens(&self, user_id: &str) -> Result<Option<(String, String, i64)>, MicrosoftAuthRepositoryError>;
            async fn delete_tokens(&self, user_id: &str) -> Result<(), MicrosoftAuthRepositoryError>;
            async fn get_workspace_list_id(&self, workspace_id: &str) -> Result<Option<String>, MicrosoftAuthRepositoryError>;
            async fn set_workspace_list_id(&self, workspace_id: &str, list_id: &str, user_id: &str) -> Result<(), MicrosoftAuthRepositoryError>;
            async fn get_task_sync_metadata(&self, workspace_id: &str) -> Result<Option<TaskSyncMetadata>, MicrosoftAuthRepositoryError>;
            async fn upsert_task_sync_metadata(&self, workspace_id: &str, user_id: &str, microsoft_list_id: &str, last_sync_at: i64, sync_status: TaskSyncStatus, sync_enabled: bool) -> Result<(), MicrosoftAuthRepositoryError>;
        }
    }

    mock! {
        TestGraphClient {}

        #[async_trait]
        impl GraphClient for TestGraphClient {
            async fn get_user_profile(&self, access_token: &str) -> Result<crate::microsoft_graph_client::UserProfile, GraphApiError>;
            async fn list_todo_lists(&self, access_token: &str) -> Result<Vec<crate::microsoft_graph_client::TodoList>, GraphApiError>;
            async fn create_todo_list(&self, access_token: &str, display_name: &str) -> Result<crate::microsoft_graph_client::TodoList, GraphApiError>;
            async fn list_tasks(&self, access_token: &str, list_id: &str) -> Result<Vec<MicrosoftTask>, GraphApiError>;
            async fn create_task(&self, access_token: &str, list_id: &str, request: crate::microsoft_graph_client::CreateTaskRequest) -> Result<MicrosoftTask, GraphApiError>;
            async fn update_task(&self, access_token: &str, list_id: &str, task_id: &str, request: crate::microsoft_graph_client::CreateTaskRequest) -> Result<MicrosoftTask, GraphApiError>;
            async fn get_task(&self, access_token: &str, list_id: &str, task_id: &str) -> Result<MicrosoftTask, GraphApiError>;
        }
    }

    mock! {
        TestMicrosoftAuthService {}

        #[async_trait]
        impl MicrosoftAuthService for TestMicrosoftAuthService {
            async fn ensure_valid_token(&self, user_id: &str) -> Result<String, MicrosoftAuthError>;
            async fn disconnect(&self, user_id: &str) -> Result<(), MicrosoftAuthError>;
        }
    }

    mock! {
        TestWorkspaceService {}

        #[async_trait]
        impl WorkspaceService for TestWorkspaceService {
            async fn get_workspace_system(&self, workspace_id: &str) -> Result<Option<act_core::repository::Workspace>, act_core::CoreError>;
        }
    }

    #[tokio::test]
    async fn test_background_sync_uses_real_user_credentials() {
        let mut mock_repo = MockTestMicrosoftAuthRepository::new();
        let mut mock_graph = MockTestGraphClient::new();
        let mut mock_auth = MockTestMicrosoftAuthService::new();
        let mut mock_workspace = MockTestWorkspaceService::new();

        let test_user_id = "real_user_123";
        let test_workspace_id = "workspace_456";
        let test_list_id = "list_789";

        // Mock get_workspace_list_id to return a list ID
        mock_repo
            .expect_get_workspace_list_id()
            .with(eq(test_workspace_id))
            .returning(move |_| Ok(Some(test_list_id.to_string())));

        // Mock get_task_sync_metadata to return metadata with the real user_id
        let metadata = TaskSyncMetadata {
            workspace_id: test_workspace_id.to_string(),
            user_id: Some(test_user_id.to_string()),
            microsoft_list_id: test_list_id.to_string(),
            last_sync_at: 0,
            sync_status: TaskSyncStatus::Idle,
            last_sync_error: None,
            sync_enabled: true,
        };
        mock_repo
            .expect_get_task_sync_metadata()
            .with(eq(test_workspace_id))
            .returning(move |_| Ok(Some(metadata.clone())));

        // Mock ensure_valid_token - CRITICAL: verify it's called with the REAL user_id
        mock_auth
            .expect_ensure_valid_token()
            .with(eq(test_user_id))
            .times(1)
            .returning(|_| Ok("valid_token_123".to_string()));

        // Mock graph API calls
        mock_graph.expect_list_tasks().returning(|_, _| Ok(vec![]));

        mock_repo
            .expect_upsert_task_sync_metadata()
            .returning(|_, _, _, _, _, _| Ok(()));

        let service = TaskSyncService {
            repository: Arc::new(mock_repo),
            graph_client: Arc::new(mock_graph),
            auth_service: Arc::new(mock_auth),
            workspace_service: Arc::new(mock_workspace),
            active_syncs: Arc::new(RwLock::new(std::collections::HashMap::new())),
        };

        // Execute background sync
        let result = service.sync_workspace(test_workspace_id).await;

        // Verify sync succeeded - the expect_ensure_valid_token with eq(test_user_id)
        // will panic if called with wrong user_id (e.g., "system")
        assert!(
            result.is_ok(),
            "Background sync should succeed with real user credentials"
        );
    }

    #[tokio::test]
    async fn test_background_sync_fetches_user_from_workspace_when_no_metadata() {
        let mut mock_repo = MockTestMicrosoftAuthRepository::new();
        let mut mock_graph = MockTestGraphClient::new();
        let mut mock_auth = MockTestMicrosoftAuthService::new();
        let mut mock_workspace = MockTestWorkspaceService::new();

        let test_user_id = "workspace_user_999";
        let test_workspace_id = "workspace_888";
        let test_list_id = "list_777";

        // Mock get_workspace_list_id
        mock_repo
            .expect_get_workspace_list_id()
            .with(eq(test_workspace_id))
            .returning(move |_| Ok(Some(test_list_id.to_string())));

        // Mock get_task_sync_metadata to return None (no existing metadata)
        mock_repo
            .expect_get_task_sync_metadata()
            .with(eq(test_workspace_id))
            .returning(|_| Ok(None));

        // Mock workspace service to return workspace with user_id
        let workspace = act_core::repository::Workspace {
            id: test_workspace_id.to_string(),
            user_id: test_user_id.to_string(),
            name: "Test Workspace".to_string(),
            root: "/tmp/test".to_string(),
            active: true,
            github_repo: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        mock_workspace
            .expect_get_workspace_system()
            .with(eq(test_workspace_id))
            .returning(move |_| Ok(Some(workspace.clone())));

        // CRITICAL: Verify auth service is called with user_id from workspace
        mock_auth
            .expect_ensure_valid_token()
            .with(eq(test_user_id))
            .times(1)
            .returning(|_| Ok("workspace_token".to_string()));

        mock_graph.expect_list_tasks().returning(|_, _| Ok(vec![]));

        mock_repo
            .expect_upsert_task_sync_metadata()
            .returning(|_, _, _, _, _, _| Ok(()));

        let service = TaskSyncService {
            repository: Arc::new(mock_repo),
            graph_client: Arc::new(mock_graph),
            auth_service: Arc::new(mock_auth),
            workspace_service: Arc::new(mock_workspace),
            active_syncs: Arc::new(RwLock::new(std::collections::HashMap::new())),
        };

        // Execute sync
        let result = service.sync_workspace(test_workspace_id).await;

        assert!(
            result.is_ok(),
            "Sync should fetch user_id from workspace when metadata doesn't exist"
        );
    }

    #[test]
    fn test_task_title_validation_empty() {
        let result = TaskSyncService::validate_task_title("");
        assert!(result.is_err(), "Empty title should be rejected");
        assert_eq!(
            result.unwrap_err().to_string(),
            "Validation error: Task title cannot be empty"
        );
    }

    #[test]
    fn test_task_title_validation_whitespace_only() {
        let result = TaskSyncService::validate_task_title("   ");
        assert!(result.is_err(), "Whitespace-only title should be rejected");
        assert_eq!(
            result.unwrap_err().to_string(),
            "Validation error: Task title cannot be empty"
        );
    }

    #[test]
    fn test_task_title_validation_too_long() {
        let long_title = "a".repeat(256);
        let result = TaskSyncService::validate_task_title(&long_title);
        assert!(
            result.is_err(),
            "Title longer than 255 chars should be rejected"
        );
        assert!(result.unwrap_err().to_string().contains("too long"));
        assert!(result.unwrap_err().to_string().contains("256"));
    }

    #[test]
    fn test_task_title_validation_valid() {
        let result = TaskSyncService::validate_task_title("Valid Task Title");
        assert!(result.is_ok(), "Valid title should be accepted");
        assert_eq!(result.unwrap(), "Valid Task Title");
    }

    #[test]
    fn test_task_title_validation_trimming() {
        let result = TaskSyncService::validate_task_title("  Valid Title  ");
        assert!(
            result.is_ok(),
            "Title with surrounding whitespace should be trimmed"
        );
        assert_eq!(result.unwrap(), "Valid Title");
    }

    #[test]
    fn test_task_title_validation_max_length() {
        let max_title = "a".repeat(255);
        let result = TaskSyncService::validate_task_title(&max_title);
        assert!(
            result.is_ok(),
            "Title with exactly 255 chars should be accepted"
        );
        assert_eq!(result.unwrap().len(), 255);
    }
}
