use crate::{
    error::ServerError, middleware::sso_auth::AuthenticatedUser, models::ApiResponse, AppState,
};

use axum::{
    extract::{Path, Query, State},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

#[derive(Debug, Deserialize)]
pub struct CreateProcessRequest {
    pub name: String,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub working_directory: String,
    pub environment_variables: Option<std::collections::HashMap<String, String>>,
    pub max_restarts: Option<i32>,
    pub auto_restart: Option<bool>,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct UpdateProcessRequest {
    pub name: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub working_directory: Option<String>,
    pub environment_variables: Option<std::collections::HashMap<String, String>>,
    pub max_restarts: Option<i32>,
    pub auto_restart: Option<bool>,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ListProcessesQuery {
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub _status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProcessResponse {
    pub id: String,
    pub name: String,
    pub pid: Option<i32>,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub working_directory: String,
    pub environment_variables: Option<std::collections::HashMap<String, String>>,
    pub status: String,
    pub exit_code: Option<i32>,
    pub start_time: String,
    pub end_time: Option<String>,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub restart_count: i32,
    pub max_restarts: i32,
    pub auto_restart: bool,
    pub user_id: String,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub data: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<act_core::models::UserProcess> for ProcessResponse {
    fn from(process: act_core::models::UserProcess) -> Self {
        Self {
            id: process.id,
            name: process.name,
            pid: process.pid,
            command: process.command,
            args: process.args,
            working_directory: process.working_directory,
            environment_variables: process.environment_variables,
            status: format!("{:?}", process.status),
            exit_code: process.exit_code,
            start_time: process.start_time.to_rfc3339(),
            end_time: process.end_time.map(|t| t.to_rfc3339()),
            cpu_usage: process.cpu_usage,
            memory_usage: process.memory_usage,
            restart_count: process.restart_count,
            max_restarts: process.max_restarts,
            auto_restart: process.auto_restart,
            user_id: process.user_id,
            workspace_id: process.workspace_id,
            session_id: process.session_id,
            tags: process.tags,
            data: process.data,
            created_at: process.created_at.to_rfc3339(),
            updated_at: process.updated_at.to_rfc3339(),
        }
    }
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_processes).post(create_process))
        .route(
            "/:id",
            get(get_process).put(update_process).delete(delete_process),
        )
        .route("/:id/stop", post(stop_process))
        .route("/:id/restart", post(restart_process))
        .route("/:id/output", get(get_process_output))
}

async fn list_processes(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Query(params): Query<ListProcessesQuery>,
) -> Result<Json<ApiResponse<Vec<ProcessResponse>>>, ServerError> {
    info!("Listing processes for user {}", user.sso_user_id);

    let processes = if let Some(workspace_id) = &params.workspace_id {
        state
            .domain_services
            .process_service
            .list_workspace_processes(&user.db_user_id, workspace_id)
            .await
    } else if let Some(session_id) = &params.session_id {
        state
            .domain_services
            .process_service
            .list_session_processes(&user.db_user_id, session_id)
            .await
    } else {
        state
            .domain_services
            .process_service
            .list_user_processes(&user.db_user_id)
            .await
    }?;

    let process_responses: Vec<ProcessResponse> =
        processes.into_iter().map(ProcessResponse::from).collect();

    Ok(Json(ApiResponse::success(process_responses)))
}

async fn create_process(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Json(request): Json<CreateProcessRequest>,
) -> Result<Json<ApiResponse<ProcessResponse>>, ServerError> {
    info!(
        "Creating process '{}' for user {}",
        request.name, user.sso_user_id
    );

    // Fetch workspace_root if workspace_id is provided
    let workspace_root = if let Some(ref workspace_id) = request.workspace_id {
        match state
            .domain_services
            .workspace_service
            .get_workspace(&user.db_user_id, workspace_id)
            .await
        {
            Ok(workspace) => Some(workspace.local_path),
            Err(e) => {
                warn!(
                    "Failed to fetch workspace {} for process creation: {}",
                    workspace_id, e
                );
                None
            }
        }
    } else {
        None
    };

    let domain_request = act_core::repository::CreateProcessRequest {
        name: request.name,
        command: request.command,
        args: request.args,
        working_directory: request.working_directory,
        environment_variables: request.environment_variables,
        max_restarts: request.max_restarts,
        auto_restart: request.auto_restart,
        workspace_id: request.workspace_id,
        workspace_root,
        session_id: request.session_id,
        tags: request.tags,
    };

    let process = state
        .domain_services
        .process_service
        .create_process(&user.db_user_id, domain_request)
        .await?;

    Ok(Json(ApiResponse::success(ProcessResponse::from(process))))
}

async fn get_process(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<ProcessResponse>>, ServerError> {
    info!("Getting process {} for user {}", id, user.sso_user_id);

    let process = state
        .domain_services
        .process_service
        .get_process(&user.db_user_id, &id)
        .await?;

    Ok(Json(ApiResponse::success(ProcessResponse::from(process))))
}

async fn update_process(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
    Json(request): Json<UpdateProcessRequest>,
) -> Result<Json<ApiResponse<ProcessResponse>>, ServerError> {
    info!("Updating process {} for user {}", id, user.sso_user_id);

    let domain_request = act_core::repository::UpdateProcessRequest {
        name: request.name,
        command: request.command,
        args: request.args,
        working_directory: request.working_directory,
        environment_variables: request.environment_variables,
        max_restarts: request.max_restarts,
        auto_restart: request.auto_restart,
        tags: request.tags,
    };

    let process = state
        .domain_services
        .process_service
        .update_process(&user.db_user_id, &id, domain_request)
        .await?;

    Ok(Json(ApiResponse::success(ProcessResponse::from(process))))
}

async fn delete_process(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Deleting process {} for user {}", id, user.sso_user_id);

    state
        .domain_services
        .process_service
        .delete_process(&user.db_user_id, &id)
        .await?;

    Ok(Json(ApiResponse::success(())))
}

async fn stop_process(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Stopping process {} for user {}", id, user.sso_user_id);

    state
        .domain_services
        .process_service
        .stop_process(&user.db_user_id, &id)
        .await?;

    Ok(Json(ApiResponse::success(())))
}

async fn restart_process(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Restarting process {} for user {}", id, user.sso_user_id);

    state
        .domain_services
        .process_service
        .restart_process(&user.db_user_id, &id)
        .await?;

    Ok(Json(ApiResponse::success(())))
}

async fn get_process_output(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<String>>, ServerError> {
    info!(
        "Getting output for process {} for user {}",
        id, user.sso_user_id
    );

    let (stdout, stderr) = state
        .domain_services
        .process_service
        .get_process_output(&user.db_user_id, &id)
        .await?;

    let combined_output = format!("STDOUT:\n{}\n\nSTDERR:\n{}", stdout, stderr);

    Ok(Json(ApiResponse::success(combined_output)))
}
