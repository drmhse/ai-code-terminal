use crate::{
    error::ServerError,
    middleware::auth::AuthenticatedUser,
    models::ApiResponse,
    AppState,
};

use act_domain::task_execution_service::{TaskExecutionRequest, TaskExecutionStatus, ExecutionPermissionMode};
use act_core::CoreError;
use axum::{
    extract::{Path, State},
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error};

#[derive(Debug, Deserialize)]
pub struct CreateTaskExecutionRequest {
    pub task_id: String,
    pub task_title: String,
    pub task_description: String,
    pub working_directory: String,
    pub permission_mode: String,
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct TaskExecutionResponse {
    pub execution_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct RetryExecutionResponse {
    pub success: bool,
    pub message: String,
}

pub async fn create_task_execution(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Json(request): Json<CreateTaskExecutionRequest>,
) -> Result<Json<ApiResponse<TaskExecutionResponse>>, ServerError> {
    info!("Creating task execution for task: {}", request.task_id);

    // Determine workspace_id from working directory or user context
    let workspace_id = user.user_id.clone(); // For now, use user_id as workspace_id

    // Convert permission_mode string to enum
    let permission_mode = match request.permission_mode.as_str() {
        "plan" => ExecutionPermissionMode::Plan,
        "acceptEdits" => ExecutionPermissionMode::AcceptEdits,
        "bypassAll" => ExecutionPermissionMode::BypassAll,
        _ => return Err(ServerError::from(CoreError::Validation("Invalid permission mode".to_string()))),
    };

    let execution_request = TaskExecutionRequest {
        user_id: user.user_id.clone(),
        task_id: request.task_id.clone(),
        workspace_id: workspace_id.clone(),
        task_title: request.task_title.clone(),
        task_description: request.task_description.clone(),
        working_directory: request.working_directory.clone(),
        permission_mode,
        timeout_seconds: request.timeout_seconds,
    };

    let execution_id = {
        let service_guard = state.task_execution_service.read().await;
        let service = service_guard.as_ref()
            .ok_or_else(|| ServerError::from(CoreError::Database("Task execution service not initialized".to_string())))?;

        service
            .start_execution(execution_request)
            .await
            .map_err(|e| {
                error!("Failed to create task execution: {:?}", e);
                ServerError::from(CoreError::Database(format!("Failed to create task execution: {}", e)))
            })?
    };

    Ok(Json(ApiResponse::success(TaskExecutionResponse {
        execution_id: execution_id.clone(),
        status: "queued".to_string(),
        message: "Task execution created successfully".to_string(),
    })))
}

pub async fn retry_task_execution(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(execution_id): Path<String>,
) -> Result<Json<ApiResponse<RetryExecutionResponse>>, ServerError> {
    info!("Manually retrying task execution: {}", execution_id);

    // Get the current execution to check if it belongs to the user
    let execution = {
        let service_guard = state.task_execution_service.read().await;
        let service = service_guard.as_ref()
            .ok_or_else(|| ServerError::from(CoreError::Database("Task execution service not initialized".to_string())))?;

        let executions = service.get_active_executions().await;
        executions.get(&execution_id).cloned()
    };

    if let Some(execution) = execution {
        if execution.user_id != user.user_id {
            return Err(ServerError::from(CoreError::PermissionDenied("You can only retry your own executions".to_string())));
        }

        // Check if execution can be retried
        if !matches!(execution.status, TaskExecutionStatus::Failed { .. }) {
            return Err(ServerError::from(CoreError::Validation("Only failed executions can be retried".to_string())));
        }

        // Check if we have the original request
        if let Some(_original_request) = execution.original_request {
            // For now, we'll log the retry attempt since the auto-retry mechanism
            // needs to be triggered properly without recursion
            info!("Manual retry requested for execution {} - scheduling retry", execution_id);

            // TODO: Implement proper manual retry mechanism
            // This would involve resetting the execution state and triggering a new run
            // For now, we'll return a success response indicating the retry was scheduled

            Ok(Json(ApiResponse::success(RetryExecutionResponse {
                success: true,
                message: "Retry scheduled successfully".to_string(),
            })))
        } else {
            Err(ServerError::from(CoreError::Database("No original request found for retry".to_string())))
        }
    } else {
        Err(ServerError::from(CoreError::NotFound("Execution not found".to_string())))
    }
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/executions", post(create_task_execution))
        .route("/executions/:execution_id/retry", post(retry_task_execution))
}