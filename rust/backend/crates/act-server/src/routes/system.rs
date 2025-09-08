use crate::{
    models::ApiResponse,
    AppState,
};
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use sysinfo::{System, Disks};
use tracing::{info, error};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub memory_total: u64,
    pub memory_percentage: f32,
    pub disk_usage: u64,
    pub disk_total: u64,
    pub disk_percentage: f32,
    pub active_sessions: u64,
    pub uptime_seconds: u64,
    pub load_average: Option<f32>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/stats", get(get_system_stats))
}

pub async fn get_system_stats(
    State(state): State<AppState>
) -> Result<Json<ApiResponse<SystemStats>>, StatusCode> {
    info!("System stats requested");
    
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Get CPU usage
    let cpu_usage = sys.global_cpu_info().cpu_usage();
    
    // Get memory usage
    let memory_total = sys.total_memory();
    let memory_usage = sys.used_memory();
    let memory_percentage = (memory_usage as f32 / memory_total as f32) * 100.0;
    
    // Get disk usage (for all disks)
    let disks = Disks::new_with_refreshed_list();
    let mut disk_total = 0;
    let mut disk_usage = 0;
    
    for disk in disks.list() {
        disk_total += disk.total_space();
        disk_usage += disk.total_space() - disk.available_space();
    }
    
    let disk_percentage = if disk_total > 0 {
        (disk_usage as f32 / disk_total as f32) * 100.0
    } else {
        0.0
    };
    
    // Get active sessions count
    let active_sessions = match sqlx::query_scalar!(
        "SELECT COUNT(*) as count FROM sessions WHERE status != 'terminated'"
    )
    .fetch_one(state.db.pool())
    .await
    {
        Ok(result) => result,
        Err(e) => {
            error!("Failed to get active sessions count: {}", e);
            0
        }
    };
    
    // Get system uptime
    let uptime_seconds = System::uptime();
    
    // Get load average (Unix-like systems only)
    let load_average = System::load_average();
    
    let stats = SystemStats {
        cpu_usage,
        memory_usage,
        memory_total,
        memory_percentage,
        disk_usage,
        disk_total,
        disk_percentage,
        active_sessions: active_sessions as u64,
        uptime_seconds,
        load_average: Some(load_average.one as f32),
    };
    
    info!("System stats retrieved successfully");
    Ok(Json(ApiResponse::success(stats)))
}