use crate::{
    error::ServerError, middleware::auth::AuthenticatedUser, models::ApiResponse, AppState,
};
use act_core::CoreError;
use axum::{
    extract::{Query, State},
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use tracing::debug;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_total: u64,
    pub memory_percentage: f64,
    pub disk_usage: u64,
    pub disk_total: u64,
    pub disk_percentage: f64,
    pub active_sessions: u32,
    pub active_processes: u32,
    pub uptime_seconds: u64,
    pub load_average: f64,
    pub network_rx: u64,
    pub network_tx: u64,
    pub system_health: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/stats", get(get_system_stats))
        .route("/browse", get(browse_directory))
}

#[derive(Debug, Deserialize)]
pub struct BrowseDirectoryQuery {
    pub path: Option<String>,
    pub workspace_id: Option<String>,
}

pub async fn get_system_stats(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<SystemStats>>, ServerError> {
    debug!("System stats requested");

    // Get system metrics from the domain service
    let system_metrics = state
        .domain_services
        .system_service
        .get_current_system_metrics()
        .await?;

    // Get system health
    let system_health = state
        .domain_services
        .system_service
        .get_system_health()
        .await?;

    // Calculate memory percentage
    let memory_percentage = if system_metrics.memory_total_bytes > 0 {
        (system_metrics.memory_used_bytes as f64 / system_metrics.memory_total_bytes as f64) * 100.0
    } else {
        0.0
    };

    // Calculate disk percentage
    let disk_percentage = if system_metrics.disk_total_bytes > 0 {
        (system_metrics.disk_used_bytes as f64 / system_metrics.disk_total_bytes as f64) * 100.0
    } else {
        0.0
    };

    // Determine system health status
    let health_status = match system_health.status {
        act_domain::system_service::HealthStatus::Healthy => "Healthy".to_string(),
        act_domain::system_service::HealthStatus::Warning => "Warning".to_string(),
        act_domain::system_service::HealthStatus::Critical => "Critical".to_string(),
    };

    let stats = SystemStats {
        cpu_usage: system_metrics.cpu_usage_percent,
        memory_usage: system_metrics.memory_used_bytes,
        memory_total: system_metrics.memory_total_bytes,
        memory_percentage,
        disk_usage: system_metrics.disk_used_bytes,
        disk_total: system_metrics.disk_total_bytes,
        disk_percentage,
        active_sessions: system_metrics.active_sessions,
        active_processes: system_metrics.active_processes,
        uptime_seconds: system_metrics.uptime_seconds,
        load_average: system_metrics.load_average,
        network_rx: system_metrics.network_rx,
        network_tx: system_metrics.network_tx,
        system_health: health_status,
    };

    debug!("System stats retrieved successfully");
    Ok(Json(ApiResponse::success(stats)))
}

pub async fn browse_directory(
    Query(params): Query<BrowseDirectoryQuery>,
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<ApiResponse<act_domain::BrowseDirectoryResponse>>, ServerError> {
    debug!(
        "Browse directory requested: {:?} for user: {} in workspace: {:?}",
        params.path, user.user_id, params.workspace_id
    );

    // Determine the path to browse
    let browse_path = if let Some(workspace_id) = &params.workspace_id {
        // If workspace_id is provided, verify user has access to this workspace
        let workspace = state
            .domain_services
            .workspace_service
            .get_workspace(&user.user_id, workspace_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to access workspace {}: {}", workspace_id, e);
                ServerError::from(CoreError::NotFound(format!(
                    "Workspace not found: {}",
                    workspace_id
                )))
            })?;

        debug!(
            "User {} accessing workspace {} at path: {}",
            user.user_id, workspace_id, workspace.local_path
        );

        // Resolve path within workspace
        match &params.path {
            Some(path) if !path.is_empty() => {
                let workspace_base = std::path::Path::new(&workspace.local_path);
                workspace_base.join(path)
            }
            _ => std::path::Path::new(&workspace.local_path).to_path_buf(),
        }
    } else {
        // No workspace_id, use the path directly or current directory
        match &params.path {
            Some(path) if !path.is_empty() => std::path::Path::new(path).to_path_buf(),
            _ => std::env::current_dir().map_err(|e| {
                tracing::error!("Failed to get current directory: {}", e);
                ServerError::from(CoreError::FileSystem(e.to_string()))
            })?,
        }
    };

    // Use the filesystem abstraction to list directory
    let directory_listing = state
        .filesystem
        .list_directory(&browse_path)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list directory {}: {}", browse_path.display(), e);
            ServerError::from(e)
        })?;

    // Convert to the expected response format
    let current_path_str = browse_path.to_string_lossy().to_string();
    let parent_path = browse_path
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    let entries = directory_listing
        .items
        .into_iter()
        .map(|item| {
            let is_hidden = item.name.starts_with('.');
            act_domain::DirectoryEntry {
                name: item.name,
                path: item.path.to_string_lossy().to_string(),
                is_directory: item.is_directory,
                is_hidden,
            }
        })
        .collect();

    let response = act_domain::BrowseDirectoryResponse {
        current_path: current_path_str,
        parent_path,
        entries,
    };

    Ok(Json(ApiResponse::success(response)))
}
