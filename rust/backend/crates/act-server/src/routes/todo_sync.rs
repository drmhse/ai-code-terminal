use axum::{
    extract::{Path, State},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Serialize;
use tracing::{debug, error, info};

use crate::{
    middleware::auth::AuthenticatedUser,
    models::ApiResponse,
    error::ServerError,
    AppState,
};
use act_domain::{TodoSyncStatus, WorkspaceSyncStatus, CacheStats};
use act_core::CoreError;

#[derive(Debug, Serialize)]
pub struct TodoSyncStatusResponse {
    pub total_workspaces: usize,
    pub synced_workspaces: usize,
    pub cached_workspaces: usize,
    pub workspace_statuses: Vec<WorkspaceSyncStatusResponse>,
    pub cache_stats: CacheStatsResponse,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceSyncStatusResponse {
    pub workspace_id: String,
    pub workspace_name: String,
    pub has_list: bool,
    pub cached: bool,
    pub last_sync: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct CacheStatsResponse {
    pub total_entries: usize,
    pub valid_entries: usize,
    pub expired_entries: usize,
    pub cache_hit_rate: f64,
}

impl From<TodoSyncStatus> for TodoSyncStatusResponse {
    fn from(status: TodoSyncStatus) -> Self {
        Self {
            total_workspaces: status.total_workspaces,
            synced_workspaces: status.synced_workspaces,
            cached_workspaces: status.cached_workspaces,
            workspace_statuses: status.workspace_statuses
                .into_iter()
                .map(WorkspaceSyncStatusResponse::from)
                .collect(),
            cache_stats: CacheStatsResponse::from(status.cache_stats),
        }
    }
}

impl From<WorkspaceSyncStatus> for WorkspaceSyncStatusResponse {
    fn from(status: WorkspaceSyncStatus) -> Self {
        Self {
            workspace_id: status.workspace_id,
            workspace_name: status.workspace_name,
            has_list: status.has_list,
            cached: status.cached,
            last_sync: status.last_sync,
        }
    }
}

impl From<CacheStats> for CacheStatsResponse {
    fn from(stats: CacheStats) -> Self {
        Self {
            total_entries: stats.total_entries,
            valid_entries: stats.valid_entries,
            expired_entries: stats.expired_entries,
            cache_hit_rate: stats.cache_hit_rate,
        }
    }
}

/// Get synchronization status for all workspaces
pub async fn get_sync_status(
    State(app_state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<ApiResponse<TodoSyncStatusResponse>>, ServerError> {
    debug!("Getting todo sync status for user: {}", user.user_id);

    let status = app_state
        .domain_services
        .todo_sync_service
        .get_sync_status(&user.user_id)
        .await
        .map_err(|e| {
            error!("Failed to get sync status: {}", e);
            ServerError(CoreError::Internal(format!("Failed to get sync status: {}", e)))
        })?;

    info!("Retrieved sync status for user {}: {} total workspaces, {} synced",
          user.user_id, status.total_workspaces, status.synced_workspaces);

    Ok(Json(ApiResponse::success(TodoSyncStatusResponse::from(status))))
}

/// Sync a specific workspace
pub async fn sync_workspace(
    Path(workspace_id): Path<String>,
    State(app_state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Syncing workspace {} for user: {}", workspace_id, user.user_id);

    // Get the workspace first to ensure it exists and belongs to the user
    let workspace = app_state
        .domain_services
        .workspace_service
        .get_workspace(&user.user_id, &workspace_id)
        .await
        .map_err(|e| {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            ServerError(CoreError::Internal(format!("Failed to get workspace: {}", e)))
        })?;

    // Ensure the project list exists for this workspace
    app_state
        .domain_services
        .todo_sync_service
        .ensure_project_list(&user.user_id, &workspace)
        .await
        .map_err(|e| {
            error!("Failed to sync workspace {}: {}", workspace_id, e);
            ServerError(CoreError::Internal(format!("Failed to sync workspace: {}", e)))
        })?;

    info!("Successfully synced workspace {} for user: {}", workspace_id, user.user_id);

    Ok(Json(ApiResponse::success(())))
}

/// Sync all workspaces for the user
pub async fn sync_all_workspaces(
    State(app_state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Syncing all workspaces for user: {}", user.user_id);

    let mappings = app_state
        .domain_services
        .todo_sync_service
        .sync_all_workspace_lists(&user.user_id)
        .await
        .map_err(|e| {
            error!("Failed to sync all workspaces for user {}: {}", user.user_id, e);
            ServerError(CoreError::Internal(format!("Failed to sync all workspaces: {}", e)))
        })?;

    info!("Successfully synced {} workspaces for user: {}", mappings.len(), user.user_id);

    Ok(Json(ApiResponse::success(())))
}

/// Refresh the cache
pub async fn refresh_cache(
    State(app_state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Refreshing todo sync cache for user: {}", user.user_id);

    app_state
        .domain_services
        .todo_sync_service
        .refresh_cache()
        .await
        .map_err(|e| {
            error!("Failed to refresh cache: {}", e);
            ServerError(CoreError::Internal(format!("Failed to refresh cache: {}", e)))
        })?;

    info!("Successfully refreshed todo sync cache");

    Ok(Json(ApiResponse::success(())))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/sync/status", get(get_sync_status))
        .route("/sync/workspace/:workspace_id", post(sync_workspace))
        .route("/sync/all", post(sync_all_workspaces))
        .route("/sync/cache/refresh", post(refresh_cache))
}