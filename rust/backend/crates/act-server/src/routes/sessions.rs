use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete},
    Router,
};
use uuid::Uuid;
use chrono::Utc;
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
    match sqlx::query_as::<_, Session>(
        "SELECT * FROM sessions WHERE status != 'terminated' ORDER BY last_activity_at DESC"
    )
    .fetch_all(state.db.pool())
    .await
    {
        Ok(sessions) => {
            info!("Retrieved {} active sessions", sessions.len());
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
    let session_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    
    // Generate a unique recovery token
    let recovery_token = Uuid::new_v4().to_string();
    
    let session = Session {
        id: session_id.clone(),
        shell_pid: None,
        socket_id: None,
        status: "active".to_string(),
        last_activity_at: now,
        created_at: now,
        ended_at: None,
        session_name: request.session_name.unwrap_or_else(|| "Terminal".to_string()),
        session_type: "terminal".to_string(),
        is_default_session: false,
        current_working_dir: None,
        environment_vars: None,
        shell_history: None,
        terminal_size: Some(r#"{"cols": 80, "rows": 24}"#.to_string()),
        last_command: None,
        session_timeout: None,
        recovery_token: Some(recovery_token),
        can_recover: true,
        max_idle_time: 1440, // 24 hours
        auto_cleanup: true,
        layout_id: None,
        workspace_id: Some(request.workspace_id),
    };

    match sqlx::query(
        r#"
        INSERT INTO sessions (
            id, shell_pid, socket_id, status, last_activity_at, created_at, ended_at,
            session_name, session_type, is_default_session, current_working_dir,
            environment_vars, shell_history, terminal_size, last_command,
            session_timeout, recovery_token, can_recover, max_idle_time,
            auto_cleanup, layout_id, workspace_id
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22
        )
        "#
    )
    .bind(&session.id)
    .bind(session.shell_pid)
    .bind(&session.socket_id)
    .bind(&session.status)
    .bind(&session.last_activity_at)
    .bind(&session.created_at)
    .bind(&session.ended_at)
    .bind(&session.session_name)
    .bind(&session.session_type)
    .bind(session.is_default_session)
    .bind(&session.current_working_dir)
    .bind(&session.environment_vars)
    .bind(&session.shell_history)
    .bind(&session.terminal_size)
    .bind(&session.last_command)
    .bind(session.session_timeout)
    .bind(&session.recovery_token)
    .bind(session.can_recover)
    .bind(session.max_idle_time)
    .bind(session.auto_cleanup)
    .bind(&session.layout_id)
    .bind(&session.workspace_id)
    .execute(state.db.pool())
    .await
    {
        Ok(_) => {
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
    let now = Utc::now();
    
    match sqlx::query(
        "UPDATE sessions SET status = 'terminated', ended_at = ?1 WHERE id = ?2"
    )
    .bind(now)
    .bind(&session_id)
    .execute(state.db.pool())
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Err(StatusCode::NOT_FOUND)
            } else {
                info!("Terminated session: {}", &session_id);
                Ok(Json(ApiResponse::success(())))
            }
        }
        Err(err) => {
            error!("Failed to terminate session: {}", err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ResizeSessionRequest {
    pub cols: u16,
    pub rows: u16,
}

pub async fn resize_session(
    State(_state): State<AppState>,
    Path(session_id): Path<String>,
    Json(_request): Json<ResizeSessionRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    // TODO: Implement using SessionManager
    info!("Resize request for session: {}", session_id);
    Ok(Json(ApiResponse::success(())))
}

#[derive(Debug, Deserialize)]
pub struct RecoverSessionRequest {
    pub recovery_token: String,
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
    State(_state): State<AppState>,
    Json(_request): Json<RecoverSessionRequest>
) -> Result<Json<ApiResponse<RecoverSessionResponse>>, StatusCode> {
    // TODO: Implement using SessionManager
    info!("Session recovery requested");
    Err(StatusCode::NOT_IMPLEMENTED)
}

pub async fn cleanup_sessions(
    State(_state): State<AppState>
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    // TODO: Implement using SessionManager
    info!("Session cleanup requested");
    Ok(Json(ApiResponse::success(serde_json::json!({"cleaned": 0}))))
}