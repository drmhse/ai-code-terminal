use std::sync::Arc;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use thiserror::Error;
use tracing::{debug, info, warn, error};

use crate::{
    MicrosoftAuthService, MicrosoftAuthError,
    GraphClient, GraphApiError, CreateListRequest,
    microsoft_auth_types::{MicrosoftAuthRepository, WorkspaceTodoMapping, MicrosoftAuthRepositoryError},
    WorkspaceService,
};
use act_core::Workspace;

#[derive(Debug, Error)]
pub enum TodoSyncError {
    #[error("Microsoft auth error: {0}")]
    MicrosoftAuth(#[from] MicrosoftAuthError),

    #[error("Graph API error: {0}")]
    GraphApi(#[from] GraphApiError),

    #[error("Repository error: {0}")]
    Repository(#[from] MicrosoftAuthRepositoryError),

    #[error("Workspace error: {0}")]
    Workspace(String),

    #[error("Sync timeout: operation took too long")]
    Timeout,

    #[error("Cache error: {0}")]
    Cache(String),
}

/// Configuration for todo sync operations
#[derive(Debug, Clone)]
pub struct TodoSyncConfig {
    /// Maximum time to cache list mappings (in seconds)
    pub cache_ttl_seconds: u64,
    /// Maximum number of concurrent sync operations
    pub max_concurrent_syncs: usize,
    /// Timeout for individual sync operations (in seconds)
    pub sync_timeout_seconds: u64,
}

impl Default for TodoSyncConfig {
    fn default() -> Self {
        Self {
            cache_ttl_seconds: 300, // 5 minutes
            max_concurrent_syncs: 5,
            sync_timeout_seconds: 30,
        }
    }
}

/// Cached workspace list mapping with timestamp
#[derive(Debug, Clone)]
struct CachedListMapping {
    microsoft_list_id: String,
    #[allow(dead_code)]
    list_name: String,
    cached_at: u64,
}

/// Service for managing Microsoft To Do list synchronization with workspaces
///
/// This service provides intelligent list management:
/// - Creates dedicated lists for each workspace/repository
/// - Maintains cache for fast list lookups
/// - Handles list sync status and conflicts
/// - Provides workspace-aware task operations
pub struct TodoSyncService {
    microsoft_auth_service: Arc<MicrosoftAuthService>,
    workspace_service: Arc<WorkspaceService>,
    repository: Arc<dyn MicrosoftAuthRepository>,
    graph_client: Arc<dyn GraphClient>,
    config: TodoSyncConfig,

    /// In-memory cache for list mappings
    /// Key: workspace_id, Value: CachedListMapping
    list_cache: tokio::sync::RwLock<HashMap<String, CachedListMapping>>,
}

impl TodoSyncService {
    pub fn new(
        microsoft_auth_service: Arc<MicrosoftAuthService>,
        workspace_service: Arc<WorkspaceService>,
        repository: Arc<dyn MicrosoftAuthRepository>,
        graph_client: Arc<dyn GraphClient>,
        config: Option<TodoSyncConfig>,
    ) -> Self {
        Self {
            microsoft_auth_service,
            workspace_service,
            repository,
            graph_client,
            config: config.unwrap_or_default(),
            list_cache: tokio::sync::RwLock::new(HashMap::new()),
        }
    }

    /// Ensure a To Do list exists for the given workspace
    ///
    /// This method implements smart caching and list management:
    /// 1. Check cache first for fast lookup
    /// 2. Check database if not in cache
    /// 3. Create new list if it doesn't exist
    /// 4. Update cache with result
    pub async fn ensure_project_list(&self, user_id: &str, workspace: &Workspace) -> Result<String, TodoSyncError> {
        let workspace_id = &workspace.id;
        debug!("Ensuring project list for workspace: {}", workspace_id);

        // 1. Check cache first
        if let Some(cached_list_id) = self.get_cached_list_id(workspace_id).await {
            debug!("Found cached list ID {} for workspace {}", cached_list_id, workspace_id);
            return Ok(cached_list_id);
        }

        // 2. Check database
        if let Some(list_id) = self.repository.get_workspace_list_id(workspace_id).await? {
            debug!("Found database list ID {} for workspace {}", list_id, workspace_id);

            // Update cache
            self.cache_list_mapping(workspace_id, &list_id, &workspace.name).await;

            return Ok(list_id);
        }

        // 3. Create new list
        info!("Creating new To Do list for workspace: {}", workspace_id);

        let list_name = self.generate_list_name(workspace);
        let list_id = self.create_workspace_list(user_id, workspace_id, &list_name).await?;

        // 4. Update cache
        self.cache_list_mapping(workspace_id, &list_id, &list_name).await;

        info!("Created and cached new list '{}' ({}) for workspace {}", list_name, list_id, workspace_id);
        Ok(list_id)
    }

    /// Get the Microsoft list ID for a workspace from cache or database
    pub async fn get_workspace_list_id(&self, workspace_id: &str) -> Result<Option<String>, TodoSyncError> {
        // Check cache first
        if let Some(cached_list_id) = self.get_cached_list_id(workspace_id).await {
            return Ok(Some(cached_list_id));
        }

        // Fall back to database
        let list_id = self.repository.get_workspace_list_id(workspace_id).await?;

        // Note: Cannot easily update cache here since we'd need user_id to get workspace info
        // The cache will be updated next time ensure_project_list is called

        Ok(list_id)
    }

    /// Sync all workspace lists for a user
    ///
    /// This method ensures all user workspaces have corresponding To Do lists
    /// and updates the cache with current mappings.
    pub async fn sync_all_workspace_lists(&self, user_id: &str) -> Result<Vec<WorkspaceTodoMapping>, TodoSyncError> {
        info!("Syncing all workspace lists for user: {}", user_id);

        // Get all user workspaces
        let workspaces = self.workspace_service.list_workspaces(user_id, false).await
            .map_err(|e| TodoSyncError::Workspace(e.to_string()))?;

        let mut mappings = Vec::new();

        for workspace in workspaces {
            match self.ensure_project_list(user_id, &workspace).await {
                Ok(list_id) => {
                    let mapping = WorkspaceTodoMapping {
                        workspace_id: workspace.id.clone(),
                        microsoft_list_id: list_id,
                        list_name: self.generate_list_name(&workspace),
                        created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
                        updated_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
                    };
                    mappings.push(mapping);
                }
                Err(e) => {
                    warn!("Failed to ensure list for workspace {}: {}", workspace.id, e);
                }
            }
        }

        info!("Synced {} workspace lists for user: {}", mappings.len(), user_id);
        Ok(mappings)
    }

    /// Get sync status for all workspaces
    ///
    /// Returns information about which workspaces have lists, cache status, etc.
    pub async fn get_sync_status(&self, user_id: &str) -> Result<TodoSyncStatus, TodoSyncError> {
        debug!("Getting sync status for user: {}", user_id);

        let workspaces = self.workspace_service.list_workspaces(user_id, false).await
            .map_err(|e| TodoSyncError::Workspace(e.to_string()))?;

        let mut workspace_statuses = Vec::new();

        for workspace in workspaces {
            let cached = self.is_workspace_cached(&workspace.id).await;
            let has_list = self.get_workspace_list_id(&workspace.id).await?.is_some();

            workspace_statuses.push(WorkspaceSyncStatus {
                workspace_id: workspace.id,
                workspace_name: workspace.name,
                has_list,
                cached,
                last_sync: None, // Could be enhanced to track last sync time
            });
        }

        let cache_stats = self.get_cache_stats().await;

        Ok(TodoSyncStatus {
            total_workspaces: workspace_statuses.len(),
            synced_workspaces: workspace_statuses.iter().filter(|s| s.has_list).count(),
            cached_workspaces: workspace_statuses.iter().filter(|s| s.cached).count(),
            workspace_statuses,
            cache_stats,
        })
    }

    /// Clear cache and force refresh from database
    pub async fn refresh_cache(&self) -> Result<(), TodoSyncError> {
        info!("Refreshing todo sync cache");

        // Clear existing cache
        self.list_cache.write().await.clear();

        // Reload from database
        let mappings = self.repository.get_all_workspace_mappings().await?;

        let mut cache = self.list_cache.write().await;
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

        for mapping in mappings {
            cache.insert(mapping.workspace_id.clone(), CachedListMapping {
                microsoft_list_id: mapping.microsoft_list_id,
                list_name: mapping.list_name,
                cached_at: now,
            });
        }

        info!("Refreshed cache with {} workspace mappings", cache.len());
        Ok(())
    }

    // Private helper methods

    async fn get_cached_list_id(&self, workspace_id: &str) -> Option<String> {
        let cache = self.list_cache.read().await;

        if let Some(cached) = cache.get(workspace_id) {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

            // Check if cache entry is still valid
            if now - cached.cached_at < self.config.cache_ttl_seconds {
                return Some(cached.microsoft_list_id.clone());
            } else {
                debug!("Cache entry for workspace {} has expired", workspace_id);
            }
        }

        None
    }

    async fn cache_list_mapping(&self, workspace_id: &str, list_id: &str, list_name: &str) {
        let mut cache = self.list_cache.write().await;
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

        cache.insert(workspace_id.to_string(), CachedListMapping {
            microsoft_list_id: list_id.to_string(),
            list_name: list_name.to_string(),
            cached_at: now,
        });

        debug!("Cached list mapping for workspace {}: {}", workspace_id, list_id);
    }

    async fn is_workspace_cached(&self, workspace_id: &str) -> bool {
        self.get_cached_list_id(workspace_id).await.is_some()
    }

    fn generate_list_name(&self, workspace: &Workspace) -> String {
        // Use workspace name, or fall back to directory name from path
        if !workspace.name.is_empty() {
            workspace.name.clone()
        } else {
            std::path::Path::new(&workspace.local_path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("Unknown Project")
                .to_string()
        }
    }

    async fn create_workspace_list(&self, user_id: &str, workspace_id: &str, list_name: &str) -> Result<String, TodoSyncError> {
        // Get access token
        let access_token = self.microsoft_auth_service.get_access_token(user_id).await?;

        // Create list via Graph API
        let create_request = CreateListRequest {
            display_name: list_name.to_string(),
        };

        let task_list = self.graph_client.create_task_list(&access_token, create_request).await?;

        // Store mapping in database
        self.repository.store_workspace_mapping(
            workspace_id,
            &task_list.id,
            &task_list.display_name,
        ).await?;

        Ok(task_list.id)
    }

    async fn get_cache_stats(&self) -> CacheStats {
        let cache = self.list_cache.read().await;
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

        let total_entries = cache.len();
        let valid_entries = cache.values()
            .filter(|cached| now - cached.cached_at < self.config.cache_ttl_seconds)
            .count();

        CacheStats {
            total_entries,
            valid_entries,
            expired_entries: total_entries - valid_entries,
            cache_hit_rate: if total_entries > 0 {
                (valid_entries as f64 / total_entries as f64) * 100.0
            } else {
                0.0
            },
        }
    }
}

/// Overall sync status for todo lists
#[derive(Debug)]
pub struct TodoSyncStatus {
    pub total_workspaces: usize,
    pub synced_workspaces: usize,
    pub cached_workspaces: usize,
    pub workspace_statuses: Vec<WorkspaceSyncStatus>,
    pub cache_stats: CacheStats,
}

/// Sync status for individual workspace
#[derive(Debug)]
pub struct WorkspaceSyncStatus {
    pub workspace_id: String,
    pub workspace_name: String,
    pub has_list: bool,
    pub cached: bool,
    pub last_sync: Option<u64>,
}

/// Cache performance statistics
#[derive(Debug)]
pub struct CacheStats {
    pub total_entries: usize,
    pub valid_entries: usize,
    pub expired_entries: usize,
    pub cache_hit_rate: f64,
}

/// Trait for dependency injection and testing
#[async_trait]
pub trait TodoSync: Send + Sync {
    async fn ensure_project_list(&self, user_id: &str, workspace: &Workspace) -> Result<String, TodoSyncError>;
    async fn get_workspace_list_id(&self, workspace_id: &str) -> Result<Option<String>, TodoSyncError>;
    async fn sync_all_workspace_lists(&self, user_id: &str) -> Result<Vec<WorkspaceTodoMapping>, TodoSyncError>;
    async fn get_sync_status(&self, user_id: &str) -> Result<TodoSyncStatus, TodoSyncError>;
    async fn refresh_cache(&self) -> Result<(), TodoSyncError>;
}

#[async_trait]
impl TodoSync for TodoSyncService {
    async fn ensure_project_list(&self, user_id: &str, workspace: &Workspace) -> Result<String, TodoSyncError> {
        self.ensure_project_list(user_id, workspace).await
    }

    async fn get_workspace_list_id(&self, workspace_id: &str) -> Result<Option<String>, TodoSyncError> {
        self.get_workspace_list_id(workspace_id).await
    }

    async fn sync_all_workspace_lists(&self, user_id: &str) -> Result<Vec<WorkspaceTodoMapping>, TodoSyncError> {
        self.sync_all_workspace_lists(user_id).await
    }

    async fn get_sync_status(&self, user_id: &str) -> Result<TodoSyncStatus, TodoSyncError> {
        self.get_sync_status(user_id).await
    }

    async fn refresh_cache(&self) -> Result<(), TodoSyncError> {
        self.refresh_cache().await
    }
}