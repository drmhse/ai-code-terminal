use crate::{
    models::ApiResponse,
    AppState,
    error::ServerError,
};
use act_domain::system_service::{
    TimePeriod, MetricsSummary, PerformanceMetrics, UserActivity
};
use axum::{
    extract::{Path, Query, State},
    response::Json,
    routing::{get, post, delete},
    Router,
};
use serde::Deserialize;
use std::collections::HashMap;
use tracing::{error, info};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/events", post(record_event))
        .route("/command", post(record_command))
        .route("/session", post(record_session_event))
        .route("/performance", post(record_performance))
        .route("/summary", get(get_summary))
        .route("/performance/:period", get(get_performance_metrics))
        .route("/user/:user_id", get(get_user_activity))
        .route("/export", get(export_metrics))
        .route("/cleanup", delete(cleanup_old_metrics))
}

#[derive(Debug, Deserialize)]
pub struct RecordEventRequest {
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub event_type: String,
    pub event_name: String,
    pub properties: HashMap<String, serde_json::Value>,
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct RecordCommandRequest {
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub command: String,
    pub exit_code: i32,
    pub duration_ms: i64,
}

#[derive(Debug, Deserialize)]
pub struct RecordSessionEventRequest {
    pub user_id: Option<String>,
    pub session_id: String,
    pub event_name: String,
    pub properties: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct RecordPerformanceRequest {
    pub metrics: PerformanceMetrics,
}

#[derive(Debug, Deserialize)]
pub struct SummaryQuery {
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub period_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UserActivityQuery {
    pub days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    pub start_time: i64,
    pub end_time: i64,
    pub format: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CleanupQuery {
    pub days_to_keep: Option<i32>,
}

pub async fn record_event(
    State(state): State<AppState>,
    Json(request): Json<RecordEventRequest>
) -> Result<Json<ApiResponse<String>>, ServerError> {
    info!("Recording metric event: {} / {}", request.event_type, request.event_name);
    
    match state.domain_services.system_service.record_event(
        request.user_id,
        request.session_id,
        request.event_type,
        request.event_name,
        request.properties,
        request.duration_ms,
    ).await {
        Ok(event_id) => {
            info!("Event recorded successfully: {}", event_id);
            Ok(Json(ApiResponse::success(event_id)))
        },
        Err(e) => {
            error!("Failed to record event: {}", e);
            Err(ServerError(e))
        }
    }
}

pub async fn record_command(
    State(state): State<AppState>,
    Json(request): Json<RecordCommandRequest>
) -> Result<Json<ApiResponse<String>>, ServerError> {
    info!("Recording command execution: {}", request.command);
    
    match state.domain_services.system_service.record_command_execution(
        request.user_id,
        request.session_id,
        request.command,
        request.exit_code,
        request.duration_ms,
    ).await {
        Ok(event_id) => {
            info!("Command execution recorded successfully: {}", event_id);
            Ok(Json(ApiResponse::success(event_id)))
        },
        Err(e) => {
            error!("Failed to record command execution: {}", e);
            Err(ServerError(e))
        }
    }
}

pub async fn record_session_event(
    State(state): State<AppState>,
    Json(request): Json<RecordSessionEventRequest>
) -> Result<Json<ApiResponse<String>>, ServerError> {
    info!("Recording session event: {} for session {}", request.event_name, request.session_id);
    
    match state.domain_services.system_service.record_session_event(
        request.user_id,
        request.session_id,
        request.event_name,
        request.properties,
    ).await {
        Ok(event_id) => {
            info!("Session event recorded successfully: {}", event_id);
            Ok(Json(ApiResponse::success(event_id)))
        },
        Err(e) => {
            error!("Failed to record session event: {}", e);
            Err(ServerError(e))
        }
    }
}

pub async fn record_performance(
    State(state): State<AppState>,
    Json(_request): Json<RecordPerformanceRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Recording performance metrics");
    
    // Get current active sessions count from the session service
    let active_sessions = match state.domain_services.session_service.count_all_active_sessions().await {
        Ok(count) => count as u32,
        Err(e) => {
            error!("Failed to get active session count: {}", e);
            0 // Fallback to 0 if we can't get the count
        }
    };
    
    // Get active processes count
    let active_processes = match state.domain_services.process_service.count_active_processes().await {
        Ok(count) => count,
        Err(e) => {
            error!("Failed to get active process count: {}", e);
            0 // Fallback to 0 if we can't get the count
        }
    };
    
    match state.domain_services.system_service.record_current_performance_metrics(active_sessions, active_processes).await {
        Ok(()) => {
            info!("Performance metrics recorded successfully");
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to record performance metrics: {}", e);
            Err(ServerError(e))
        }
    }
}

pub async fn get_summary(
    Query(params): Query<SummaryQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<MetricsSummary>>, ServerError> {
    info!("Metrics summary requested");
    
    let now = chrono::Utc::now();
    let end_time = params.end_time.map(|t| chrono::DateTime::from_timestamp(t, 0).unwrap_or_default()).unwrap_or(now);
    let start_time = params.start_time.map(|t| chrono::DateTime::from_timestamp(t, 0).unwrap_or_default()).unwrap_or(now - chrono::Duration::seconds(86400));
    let period_type = params.period_type.unwrap_or_else(|| "day".to_string());
    
    let time_period = TimePeriod {
        start_time,
        end_time,
        period_type,
    };
    
    match state.domain_services.system_service.get_metrics_summary(time_period).await {
        Ok(summary) => Ok(Json(ApiResponse::success(summary))),
        Err(e) => {
            error!("Failed to get metrics summary: {}", e);
            Err(ServerError(e))
        }
    }
}

pub async fn get_performance_metrics(
    Path(period): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<PerformanceMetrics>>>, ServerError> {
    info!("Performance metrics requested for period: {}", period);
    
    let now = chrono::Utc::now();
    let (start_time_duration, period_type) = match period.as_str() {
        "hour" => (chrono::Duration::seconds(3600), "hour"),
        "day" => (chrono::Duration::seconds(86400), "day"),
        "week" => (chrono::Duration::seconds(604800), "week"),
        "month" => (chrono::Duration::seconds(2592000), "month"),
        _ => return Err(ServerError(act_core::error::CoreError::Validation("Invalid period".to_string()))),
    };
    
    let time_period = TimePeriod {
        start_time: now - start_time_duration,
        end_time: now,
        period_type: period_type.to_string(),
    };
    
    match state.domain_services.system_service.get_performance_metrics(time_period).await {
        Ok(metrics) => Ok(Json(ApiResponse::success(metrics))),
        Err(e) => {
            error!("Failed to get performance metrics: {}", e);
            Err(ServerError(e))
        }
    }
}

pub async fn get_user_activity(
    Path(user_id): Path<String>,
    Query(params): Query<UserActivityQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<UserActivity>>, ServerError> {
    info!("User activity requested: {}", user_id);
    
    let days = params.days.unwrap_or(7); // Default to last 7 days
    
    match state.domain_services.system_service.get_user_activity(&user_id, days).await {
        Ok(activity) => Ok(Json(ApiResponse::success(activity))),
        Err(e) => {
            error!("Failed to get user activity for {}: {}", user_id, e);
            Err(ServerError(e))
        }
    }
}

pub async fn export_metrics(
    Query(params): Query<ExportQuery>,
    State(state): State<AppState>
) -> Result<String, ServerError> {
    info!("Metrics export requested");
    
    let format = params.format.unwrap_or_else(|| "json".to_string());
    
    let time_period = TimePeriod {
        start_time: chrono::DateTime::from_timestamp(params.start_time, 0).unwrap_or_default(),
        end_time: chrono::DateTime::from_timestamp(params.end_time, 0).unwrap_or_default(),
        period_type: "custom".to_string(),
    };
    
    match state.domain_services.system_service.export_metrics(time_period, &format).await {
        Ok(data) => Ok(data),
        Err(e) => {
            error!("Failed to export metrics: {}", e);
            Err(ServerError(e))
        }
    }
}

pub async fn cleanup_old_metrics(
    Query(params): Query<CleanupQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<u64>>, ServerError> {
    info!("Metrics cleanup requested");
    
    let days_to_keep = params.days_to_keep.unwrap_or(30); // Default to keep 30 days
    
    match state.domain_services.system_service.cleanup_old_metrics(days_to_keep).await {
        Ok(deleted_count) => {
            info!("Cleaned up {} old metric records", deleted_count);
            Ok(Json(ApiResponse::success(deleted_count)))
        },
        Err(e) => {
            error!("Failed to cleanup old metrics: {}", e);
            Err(ServerError(e))
        }
    }
}