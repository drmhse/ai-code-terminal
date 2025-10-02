use crate::{
    error::ServerError, middleware::auth::AuthenticatedUser, models::ApiResponse, AppState,
};
use act_domain::BrowseDirectoryResponse;
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
    _user: AuthenticatedUser,
) -> Result<Json<ApiResponse<BrowseDirectoryResponse>>, ServerError> {
    debug!("Browse directory requested: {:?}", params.path);

    let response = state
        .domain_services
        .system_service
        .browse_directory(params.path.as_deref())
        .await?;

    Ok(Json(ApiResponse::success(response)))
}
