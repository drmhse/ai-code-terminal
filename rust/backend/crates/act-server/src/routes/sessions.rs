use axum::{
    extract::{Path, State},
    response::Json,
    routing::{delete, get, post},
    Router,
};
use tracing::{info, warn};

use crate::{
    error::ServerError,
    middleware::auth::AuthenticatedUser,
    models::{session_info_from_domain, ApiResponse, Session},
    AppState,
};
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
        .route("/:id/buffer", get(get_session_buffer))
        .route("/cleanup", post(cleanup_sessions))
}

pub async fn list_sessions(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<Session>>>, ServerError> {
    let domain_sessions = state
        .domain_services
        .session_service
        .list_active_sessions(&auth_user.user_id)
        .await?;

    let sessions: Vec<Session> = domain_sessions
        .into_iter()
        .map(|session_info| {
            let mut session = session_info_from_domain(session_info);
            session.user_id = auth_user.user_id.clone();
            session
        })
        .collect();

    info!(
        "Retrieved {} active sessions for user {}",
        sessions.len(),
        auth_user.user_id
    );
    Ok(Json(ApiResponse::success(sessions)))
}

pub async fn create_session(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<Json<ApiResponse<Session>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!(
        "Session creation requested: workspace_id={}, session_name={:?}",
        request.workspace_id, request.session_name
    );

    let session_id = uuid::Uuid::new_v4().to_string();

    // Get workspace path from workspace service
    let workspace_path = match state
        .domain_services
        .workspace_service
        .get_workspace(&auth_user.user_id, &request.workspace_id)
        .await
    {
        Ok(workspace) => Some(workspace.local_path),
        Err(e) => {
            warn!(
                "Could not get workspace path for {}: {}",
                request.workspace_id, e
            );
            None
        }
    };

    let _was_created = state
        .domain_services
        .session_service
        .get_or_create_pty_session(
            &auth_user.user_id,
            &session_id,
            &request.workspace_id,
            workspace_path,
            None,
        )
        .await?;

    // Create a Session response (this would typically come from a database in a real app)
    let session = Session {
        id: session_id.clone(),
        shell_pid: None,
        socket_id: None,
        status: "active".to_string(),
        last_activity_at: chrono::Utc::now(),
        created_at: chrono::Utc::now(),
        ended_at: None,
        session_name: request
            .session_name
            .unwrap_or_else(|| "Terminal".to_string()),
        session_type: "terminal".to_string(),
        is_default_session: false,
        current_working_dir: None,
        environment_vars: None,
        shell_history: None,
        terminal_size: request.terminal_size.map(|size| {
            serde_json::to_string(&crate::models::TerminalSize {
                cols: size.cols,
                rows: size.rows,
            })
            .unwrap_or_default()
        }),
        last_command: None,
        session_timeout: Some(30),
        layout_id: None,
        workspace_id: Some(request.workspace_id),
        user_id: auth_user.user_id,
    };

    info!("Session created successfully: {}", session.id);
    Ok(Json(ApiResponse::success(session)))
}

pub async fn terminate_session(
    auth_user: AuthenticatedUser,
    Path(session_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Session termination requested: {}", session_id);

    state
        .domain_services
        .session_service
        .terminate_session(&auth_user.user_id, &session_id)
        .await?;

    info!("Session terminated successfully: {}", session_id);
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
    Json(request): Json<ResizeRequest>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!(
        "Session resize requested: {} -> {}x{}",
        session_id, request.cols, request.rows
    );

    state
        .domain_services
        .session_service
        .resize_session(&auth_user.user_id, &session_id, request.cols, request.rows)
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
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<CleanupResult>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Session cleanup requested for user {}", auth_user.user_id);

    let cleaned_count = state
        .domain_services
        .session_service
        .cleanup_terminated_sessions(&auth_user.user_id)
        .await?;

    info!(
        "Session cleanup completed: {} sessions cleaned",
        cleaned_count
    );
    Ok(Json(ApiResponse::success(CleanupResult { cleaned_count })))
}

pub async fn get_session_buffer(
    auth_user: AuthenticatedUser,
    Path(session_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<String>>, ServerError> {
    info!(
        "Session buffer requested: {} for user {}",
        session_id, auth_user.user_id
    );

    // Get terminal buffer from session service
    let buffer_content = state
        .domain_services
        .session_service
        .get_terminal_buffer(&session_id)
        .await?;

    info!(
        "Retrieved buffer for session {}: {} characters",
        session_id,
        buffer_content.len()
    );
    Ok(Json(ApiResponse::success(buffer_content)))
}
