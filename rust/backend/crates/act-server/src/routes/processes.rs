use crate::{
    models::ApiResponse,
    services::process::{ProcessSupervisor, ProcessConfig, ProcessInfo, ProcessStatus, ProcessMetrics},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete},
    Router,
};
use serde::Deserialize;
use tracing::{error, info};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_processes))
        .route("/", post(start_process))
        .route("/:process_id", get(get_process))
        .route("/:process_id", delete(stop_process))
        .route("/:process_id/restart", post(restart_process))
        .route("/:process_id/metrics", get(get_process_metrics))
        .route("/:process_id/logs", get(get_process_logs))
}

#[derive(Debug, Deserialize)]
pub struct ListProcessesQuery {
    pub user_id: Option<String>,
    pub workspace_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StartProcessRequest {
    pub config: ProcessConfig,
    pub user_id: Option<String>,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProcessMetricsQuery {
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct ProcessLogsQuery {
    pub limit: Option<usize>,
    pub since: Option<i64>,
    pub level: Option<String>,
}

pub async fn list_processes(
    Query(params): Query<ListProcessesQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<ProcessInfo>>>, StatusCode> {
    info!("Process list requested");
    
    let process_supervisor = ProcessSupervisor::new(state.db.clone());
    
    // Parse status filter
    let status_filter = params.status.and_then(|s| match s.as_str() {
        "starting" => Some(ProcessStatus::Starting),
        "running" => Some(ProcessStatus::Running),
        "stopped" => Some(ProcessStatus::Stopped),
        "failed" => Some(ProcessStatus::Failed),
        "crashed" => Some(ProcessStatus::Crashed),
        "restarting" => Some(ProcessStatus::Restarting),
        "terminated" => Some(ProcessStatus::Terminated),
        _ => None,
    });
    
    match process_supervisor.list_processes(
        params.user_id.as_deref(),
        params.workspace_id.as_deref(),
        status_filter,
    ).await {
        Ok(processes) => Ok(Json(ApiResponse::success(processes))),
        Err(e) => {
            error!("Failed to list processes: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn start_process(
    State(state): State<AppState>,
    Json(request): Json<StartProcessRequest>
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    info!("Process start requested: {}", request.config.name);
    
    let process_supervisor = ProcessSupervisor::new(state.db.clone());
    
    match process_supervisor.start_process(
        request.config,
        request.user_id,
        request.workspace_id,
        request.session_id,
    ).await {
        Ok(process_id) => {
            info!("Process started successfully: {}", process_id);
            Ok(Json(ApiResponse::success(process_id)))
        },
        Err(e) => {
            error!("Failed to start process: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_process(
    Path(process_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<ProcessInfo>>, StatusCode> {
    info!("Process info requested: {}", process_id);
    
    let process_supervisor = ProcessSupervisor::new(state.db.clone());
    
    match process_supervisor.get_process_info(&process_id).await {
        Ok(Some(process_info)) => Ok(Json(ApiResponse::success(process_info))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get process info {}: {}", process_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn stop_process(
    Path(process_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Process stop requested: {}", process_id);
    
    let process_supervisor = ProcessSupervisor::new(state.db.clone());
    
    match process_supervisor.stop_process(&process_id).await {
        Ok(()) => {
            info!("Process stopped successfully: {}", process_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to stop process {}: {}", process_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn restart_process(
    Path(process_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Process restart requested: {}", process_id);
    
    let process_supervisor = ProcessSupervisor::new(state.db.clone());
    
    match process_supervisor.restart_process(&process_id).await {
        Ok(()) => {
            info!("Process restarted successfully: {}", process_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to restart process {}: {}", process_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_process_metrics(
    Path(process_id): Path<String>,
    Query(params): Query<ProcessMetricsQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<ProcessMetrics>>>, StatusCode> {
    info!("Process metrics requested: {}", process_id);
    
    let process_supervisor = ProcessSupervisor::new(state.db.clone());
    
    match process_supervisor.get_process_metrics(&process_id, params.limit).await {
        Ok(metrics) => Ok(Json(ApiResponse::success(metrics))),
        Err(e) => {
            error!("Failed to get process metrics {}: {}", process_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_process_logs(
    Path(process_id): Path<String>,
    Query(_params): Query<ProcessLogsQuery>,
    State(_state): State<AppState>
) -> Result<Json<ApiResponse<Vec<crate::services::process::ProcessLogEntry>>>, StatusCode> {
    info!("Process logs requested: {}", process_id);
    
    // TODO: Implement process log retrieval
    // For now, return empty logs
    Ok(Json(ApiResponse::success(Vec::new())))
}