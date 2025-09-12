use axum::{
    extract::{Path, State},
    response::Json,
    routing::{get, post, delete},
    Router,
};
use tracing::info;

use crate::{
    models::{Session, ApiResponse, session_from_domain},
    middleware::auth::AuthenticatedUser,
    AppState,
    error::ServerError,
};
use act_core::repository::SessionType;
use act_domain::CreateSessionOptions;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub workspace_id: String,
    pub session_name: Option<String>,
    pub terminal_size: Option<crate::models::TerminalSize>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_sessions))
        .route("/", post(create_session))
        .route("/:id", delete(terminate_session))
        .route("/:id/resize", post(resize_session))
        .route("/:id/history", get(get_session_history))
        .route("/recover", post(recover_session))
        .route("/cleanup", post(cleanup_sessions))
}

pub async fn list_sessions(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<Session>>>, ServerError> {
    let domain_sessions = state.domain_services.session_service
        .list_active_sessions(&auth_user.user_id)
        .await?;
    
    let sessions: Vec<Session> = domain_sessions.into_iter().map(session_from_domain).collect();
    
    info!("Retrieved {} active sessions for user {}", sessions.len(), auth_user.user_id);
    Ok(Json(ApiResponse::success(sessions)))
}

pub async fn create_session(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
    Json(request): Json<CreateSessionRequest>
) -> Result<Json<ApiResponse<Session>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Session creation requested: workspace_id={}, session_name={:?}", request.workspace_id, request.session_name);
    
    let options = CreateSessionOptions {
        workspace_id: Some(request.workspace_id.clone()),
        session_id: None,
        session_name: request.session_name.clone().unwrap_or_else(|| "Terminal".to_string()),
        session_type: SessionType::Terminal,
        terminal_size: request.terminal_size.clone().map(|size| act_core::repository::TerminalSize {
            cols: size.cols,
            rows: size.rows,
        }),
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 30,
        working_directory: None, // Will be set by the service
    };
    
    let session_state = state.domain_services.session_service
        .create_session(&auth_user.user_id, options)
        .await?;
    
    // Convert SessionState to Session for API response
    let session = Session {
        id: session_state.session_id,
        shell_pid: None,
        socket_id: None,
        status: "active".to_string(),
        last_activity_at: session_state.last_activity,
        created_at: session_state.created_at,
        ended_at: None,
        session_name: "Terminal".to_string(),
        session_type: "terminal".to_string(),
        is_default_session: false,
        current_working_dir: session_state.current_working_dir,
        environment_vars: Some(serde_json::to_string(&session_state.environment_vars).unwrap_or_default()),
        shell_history: Some(serde_json::to_string(&session_state.shell_history).unwrap_or_default()),
        terminal_size: session_state.terminal_size.map(|size| serde_json::to_string(&size).unwrap_or_default()),
        last_command: session_state.last_command,
        session_timeout: Some(30),
        recovery_token: Some(session_state.recovery_token),
        can_recover: session_state.is_recoverable,
        max_idle_time: 30,
        auto_cleanup: false,
        layout_id: None,
        workspace_id: session_state.workspace_id,
        user_id: auth_user.user_id,
    };
    
    info!("Session created successfully: {}", session.id);
    Ok(Json(ApiResponse::success(session)))
}

pub async fn terminate_session(
    auth_user: AuthenticatedUser,
    Path(session_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Session termination requested: {}", session_id);
    
    state.domain_services.session_service
        .terminate_session(&auth_user.user_id, &session_id)
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
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
    Json(request): Json<RecoverSessionRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Session recovery requested: {}", request.recovery_token);
    
    let _session_state = state.domain_services.session_service
        .recover_session(&auth_user.user_id, &request.recovery_token)
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
    auth_user: AuthenticatedUser,
    Path(session_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<ResizeRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Session resize requested: {} -> {}x{}", session_id, request.cols, request.rows);
    
    state.domain_services.session_service
        .resize_terminal(&auth_user.user_id, &session_id, request.cols, request.rows)
        .await?;
    
    info!("Session resized successfully: {}", session_id);
    Ok(Json(ApiResponse::success(())))
}

#[derive(Debug, Serialize)]
pub struct CleanupResult {
    pub cleaned_count: usize,
}

pub async fn cleanup_sessions(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<CleanupResult>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Session cleanup requested");
    
    let cleaned_count = state.domain_services.session_service
        .cleanup_expired_sessions(&auth_user.user_id)
        .await?;
    
    info!("Session cleanup completed: {} sessions cleaned", cleaned_count);
    Ok(Json(ApiResponse::success(CleanupResult { cleaned_count })))
}

pub async fn get_session_history(
    auth_user: AuthenticatedUser,
    Path(session_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<String>>>, ServerError> {
    info!("Session history requested: {}", session_id);
    
    let domain_session = state.domain_services.session_service
        .get_session(&auth_user.user_id, &session_id)
        .await?;
    
    // Extract shell history from the session
    let history = domain_session.shell_history.unwrap_or_default();
    
    info!("Retrieved history for session {}: {} commands", session_id, history.len());
    Ok(Json(ApiResponse::success(history)))
}