use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete},
    Router,
};
use tracing::{info, error};

use crate::{
    models::{Session, CreateSessionRequest, ApiResponse},
    AppState,
};
use serde::{Deserialize, Serialize};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_sessions))
        .route("/", post(create_session))
        .route("/:id", get(get_session))
        .route("/:id", delete(terminate_session))
        .route("/:id/resize", post(resize_session))
        .route("/recover", post(recover_session))
        .route("/cleanup", post(cleanup_sessions))
}

pub async fn list_sessions(
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<Session>>>, StatusCode> {
    // Get active sessions from SessionManager and also query database for complete info
    let active_sessions = state.session_manager.list_active_sessions().await;
    
    match sqlx::query_as::<_, Session>(
        "SELECT * FROM sessions WHERE status != 'terminated' ORDER BY last_activity_at DESC"
    )
    .fetch_all(state.db.pool())
    .await
    {
        Ok(sessions) => {
            info!("Retrieved {} database sessions and {} active sessions", sessions.len(), active_sessions.len());
            Ok(Json(ApiResponse::success(sessions)))
        }
        Err(err) => {
            error!("Failed to fetch sessions: {}", err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn create_session(
    State(state): State<AppState>,
    Json(request): Json<CreateSessionRequest>
) -> Result<Json<ApiResponse<Session>>, StatusCode> {
    info!("Creating session for workspace: {:?}", request.workspace_id);

    // Use SessionManager to create the session
    match state.session_manager.create_session(
        Some(request.workspace_id.clone()),
        request.session_name.clone(),
        Some(80), // Default cols
        Some(24)  // Default rows
    ).await {
        Ok(session_state) => {
            // Convert SessionState to Session model for response
            let session = Session {
                id: session_state.session_id.clone(),
                shell_pid: None,
                socket_id: None,
                status: "active".to_string(),
                last_activity_at: session_state.last_activity,
                created_at: session_state.created_at,
                ended_at: None,
                session_name: request.session_name.unwrap_or_else(|| "Terminal".to_string()),
                session_type: "terminal".to_string(),
                is_default_session: false,
                current_working_dir: session_state.current_working_dir,
                environment_vars: Some(serde_json::to_string(&session_state.environment_vars).unwrap_or_default()),
                shell_history: Some(serde_json::to_string(&session_state.shell_history).unwrap_or_default()),
                terminal_size: session_state.terminal_size.map(|size| serde_json::to_string(&size).unwrap_or_default()),
                last_command: session_state.last_command,
                session_timeout: None,
                recovery_token: Some(session_state.recovery_token),
                can_recover: session_state.is_recoverable,
                max_idle_time: 1440, // 24 hours
                auto_cleanup: true,
                layout_id: None,
                workspace_id: Some(request.workspace_id),
            };

            info!("Created session: {} for workspace {:?}", session.id, session.workspace_id);
            Ok(Json(ApiResponse::success(session)))
        }
        Err(err) => {
            error!("Failed to create session: {}", err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>
) -> Result<Json<ApiResponse<Session>>, StatusCode> {
    match sqlx::query_as::<_, Session>(
        "SELECT * FROM sessions WHERE id = ?1"
    )
    .bind(&session_id)
    .fetch_optional(state.db.pool())
    .await
    {
        Ok(Some(session)) => {
            Ok(Json(ApiResponse::success(session)))
        }
        Ok(None) => {
            Err(StatusCode::NOT_FOUND)
        }
        Err(err) => {
            error!("Failed to fetch session {}: {}", session_id, err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn terminate_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Terminating session: {}", session_id);
    
    match state.session_manager.terminate_session(&session_id).await {
        Ok(_) => {
            info!("Successfully terminated session: {}", session_id);
            Ok(Json(ApiResponse::success(())))
        }
        Err(err) => {
            error!("Failed to terminate session: {}", err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ResizeSessionRequest {
    #[allow(dead_code)]
    pub cols: u16,
    #[allow(dead_code)]
    pub rows: u16,
}

pub async fn resize_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<ResizeSessionRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Resize request for session: {} to {}x{}", session_id, request.cols, request.rows);
    
    match state.session_manager.resize_terminal(&session_id, request.cols, request.rows).await {
        Ok(_) => {
            info!("Successfully resized session: {}", session_id);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to resize session {}: {}", session_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct RecoverSessionRequest {
    #[allow(dead_code)]
    pub recovery_token: String,
    #[allow(dead_code)]
    pub socket_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RecoverSessionResponse {
    pub session_id: String,
    pub workspace_id: Option<String>,
    pub recovery_token: String,
    pub terminal_size: Option<serde_json::Value>,
}

pub async fn recover_session(
    State(state): State<AppState>,
    Json(request): Json<RecoverSessionRequest>
) -> Result<Json<ApiResponse<RecoverSessionResponse>>, StatusCode> {
    info!("Session recovery requested with token: {}", &request.recovery_token[..20]);
    
    match state.session_manager.recover_session(&request.recovery_token, request.socket_id.as_deref()).await {
        Ok(session_state) => {
            info!("Successfully recovered session: {}", session_state.session_id);
            
            let response = RecoverSessionResponse {
                session_id: session_state.session_id,
                workspace_id: session_state.workspace_id,
                recovery_token: session_state.recovery_token,
                terminal_size: session_state.terminal_size.map(|size| serde_json::json!({
                    "cols": size.cols,
                    "rows": size.rows
                })),
            };
            
            Ok(Json(ApiResponse::success(response)))
        }
        Err(e) => {
            error!("Failed to recover session: {}", e);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

pub async fn cleanup_sessions(
    State(state): State<AppState>
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("Session cleanup requested");
    
    match state.session_manager.cleanup_expired_sessions().await {
        Ok(cleaned_count) => {
            info!("Successfully cleaned up {} expired sessions", cleaned_count);
            Ok(Json(ApiResponse::success(serde_json::json!({
                "cleaned": cleaned_count
            }))))
        }
        Err(e) => {
            error!("Failed to cleanup sessions: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}