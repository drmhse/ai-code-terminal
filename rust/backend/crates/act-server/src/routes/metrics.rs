use crate::{
    models::ApiResponse,
    services::metrics::{MetricsService, MetricsSummary, PerformanceMetrics, TimePeriod, UserActivity},
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
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    info!("Recording metric event: {} / {}", request.event_type, request.event_name);
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.record_event(
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
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn record_command(
    State(state): State<AppState>,
    Json(request): Json<RecordCommandRequest>
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    info!("Recording command execution: {}", request.command);
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.record_command_execution(
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
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn record_session_event(
    State(state): State<AppState>,
    Json(request): Json<RecordSessionEventRequest>
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    info!("Recording session event: {} for session {}", request.event_name, request.session_id);
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.record_session_event(
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
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn record_performance(
    State(state): State<AppState>,
    Json(request): Json<RecordPerformanceRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Recording performance metrics");
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.record_performance_metrics(request.metrics).await {
        Ok(()) => {
            info!("Performance metrics recorded successfully");
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to record performance metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_summary(
    Query(params): Query<SummaryQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<MetricsSummary>>, StatusCode> {
    info!("Metrics summary requested");
    
    let now = chrono::Utc::now().timestamp();
    let end_time = params.end_time.unwrap_or(now);
    let start_time = params.start_time.unwrap_or(now - 86400); // Default to last 24 hours
    let period_type = params.period_type.unwrap_or_else(|| "day".to_string());
    
    let time_period = TimePeriod {
        start_time,
        end_time,
        period_type,
    };
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.get_metrics_summary(time_period).await {
        Ok(summary) => Ok(Json(ApiResponse::success(summary))),
        Err(e) => {
            error!("Failed to get metrics summary: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_performance_metrics(
    Path(period): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<PerformanceMetrics>>>, StatusCode> {
    info!("Performance metrics requested for period: {}", period);
    
    let now = chrono::Utc::now().timestamp();
    let (start_time, period_type) = match period.as_str() {
        "hour" => (now - 3600, "hour"),
        "day" => (now - 86400, "day"),
        "week" => (now - 604800, "week"),
        "month" => (now - 2592000, "month"),
        _ => return Err(StatusCode::BAD_REQUEST),
    };
    
    let time_period = TimePeriod {
        start_time,
        end_time: now,
        period_type: period_type.to_string(),
    };
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.get_performance_metrics(time_period).await {
        Ok(metrics) => Ok(Json(ApiResponse::success(metrics))),
        Err(e) => {
            error!("Failed to get performance metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_user_activity(
    Path(user_id): Path<String>,
    Query(params): Query<UserActivityQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<UserActivity>>, StatusCode> {
    info!("User activity requested: {}", user_id);
    
    let days = params.days.unwrap_or(7); // Default to last 7 days
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.get_user_activity(&user_id, days).await {
        Ok(activity) => Ok(Json(ApiResponse::success(activity))),
        Err(e) => {
            error!("Failed to get user activity for {}: {}", user_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn export_metrics(
    Query(params): Query<ExportQuery>,
    State(state): State<AppState>
) -> Result<String, StatusCode> {
    info!("Metrics export requested");
    
    let format = params.format.unwrap_or_else(|| "json".to_string());
    
    let time_period = TimePeriod {
        start_time: params.start_time,
        end_time: params.end_time,
        period_type: "custom".to_string(),
    };
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.export_metrics(time_period, &format).await {
        Ok(data) => Ok(data),
        Err(e) => {
            error!("Failed to export metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn cleanup_old_metrics(
    Query(params): Query<CleanupQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<u64>>, StatusCode> {
    info!("Metrics cleanup requested");
    
    let days_to_keep = params.days_to_keep.unwrap_or(30); // Default to keep 30 days
    
    let metrics_service = MetricsService::new(state.db.clone());
    
    match metrics_service.cleanup_old_metrics(days_to_keep).await {
        Ok(deleted_count) => {
            info!("Cleaned up {} old metric records", deleted_count);
            Ok(Json(ApiResponse::success(deleted_count)))
        },
        Err(e) => {
            error!("Failed to cleanup old metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}