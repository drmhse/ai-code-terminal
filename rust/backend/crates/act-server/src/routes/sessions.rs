use axum::{
    extract::{Path, State},
    response::Json,
    routing::{get, post, delete},
    Router,
};
use tracing::info;

use crate::{
    models::{Session, ApiResponse, session_from_domain},
    AppState,
    error::ServerError,
};
use act_core::repository::{SessionType, TerminalSize as DomainTerminalSize};
use act_domain::CreateSessionOptions;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub workspace_id: String,
    pub session_name: Option<String>,
    pub terminal_size: Option<crate::models::TerminalSize>,
    #[allow(dead_code)]
    pub layout_id: Option<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_sessions))
        .route("/", post(create_session))
        .route("/:id", get(get_session))
        .route("/:id", delete(terminate_session))
        .route("/:id/resize", post(resize_session))
        .route("/:id/history", get(get_session_history))
        .route("/recover", post(recover_session))
        .route("/cleanup", post(cleanup_sessions))
}

pub async fn list_sessions(
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<Session>>>, ServerError> {
    let domain_sessions = state.domain_services.session_service
        .list_active_sessions()
        .await?;
    
    let sessions: Vec<Session> = domain_sessions.into_iter().map(session_from_domain).collect();
    
    info!("Retrieved {} active sessions", sessions.len());
    Ok(Json(ApiResponse::success(sessions)))
}

pub async fn create_session(
    State(state): State<AppState>,
    Json(request): Json<CreateSessionRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Session creation requested: {:?}", request);
    
    let options = CreateSessionOptions {
        workspace_id: Some(request.workspace_id),
        session_name: request.session_name.unwrap_or_else(|| "Terminal".to_string()),
        session_type: SessionType::Terminal,
        terminal_size: request.terminal_size.map(|size| DomainTerminalSize {
            cols: size.cols,
            rows: size.rows,
        }),
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 30,
    };
    
    let _session_state = state.domain_services.session_service
        .create_session(options)
        .await?;
    
    info!("Session created successfully");
    Ok(Json(ApiResponse::success(())))
}

pub async fn get_session(
    Path(session_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Session>>, ServerError> {
    info!("Session details requested: {}", session_id);
    
    let domain_session = state.domain_services.session_service
        .get_session(&session_id)
        .await?;
    
    let session = session_from_domain(domain_session);
    Ok(Json(ApiResponse::success(session)))
}

pub async fn terminate_session(
    Path(session_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Session termination requested: {}", session_id);
    
    state.domain_services.session_service
        .terminate_session(&session_id)
        .await?;
    
    info!("Session terminated successfully: {}", session_id);
    Ok(Json(ApiResponse::success(())))
}

#[derive(Debug, Deserialize)]
pub struct RecoverSessionRequest {
    pub recovery_token: String,
    #[allow(dead_code)]
    pub socket_id: Option<String>,
}

pub async fn recover_session(
    State(state): State<AppState>,
    Json(request): Json<RecoverSessionRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Session recovery requested: {}", request.recovery_token);
    
    let _session_state = state.domain_services.session_service
        .recover_session(&request.recovery_token)
        .await?;
    
    // For now, return success without session details
    info!("Session recovered successfully");
    Ok(Json(ApiResponse::success(())))
}

#[derive(Debug, Deserialize)]
pub struct ResizeRequest {
    pub cols: u16,
    pub rows: u16,
}

pub async fn resize_session(
    Path(session_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<ResizeRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Session resize requested: {} -> {}x{}", session_id, request.cols, request.rows);
    
    state.domain_services.session_service
        .resize_terminal(&session_id, request.cols, request.rows)
        .await?;
    
    info!("Session resized successfully: {}", session_id);
    Ok(Json(ApiResponse::success(())))
}

#[derive(Debug, Serialize)]
pub struct CleanupResult {
    pub cleaned_count: usize,
}

pub async fn cleanup_sessions(
    State(state): State<AppState>
) -> Result<Json<ApiResponse<CleanupResult>>, ServerError> {
    info!("Session cleanup requested");
    
    let cleaned_count = state.domain_services.session_service
        .cleanup_expired_sessions()
        .await?;
    
    info!("Session cleanup completed: {} sessions cleaned", cleaned_count);
    Ok(Json(ApiResponse::success(CleanupResult { cleaned_count })))
}

pub async fn get_session_history(
    Path(session_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<String>>>, ServerError> {
    info!("Session history requested: {}", session_id);
    
    let domain_session = state.domain_services.session_service
        .get_session(&session_id)
        .await?;
    
    // Extract shell history from the session
    let history = domain_session.shell_history.unwrap_or_default();
    
    info!("Retrieved history for session {}: {} commands", session_id, history.len());
    Ok(Json(ApiResponse::success(history)))
}