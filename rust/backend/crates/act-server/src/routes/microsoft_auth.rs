use crate::{
    AppState,
    models::ApiResponse,
    middleware::auth::AuthenticatedUser
};
use act_domain::{
    MicrosoftAuthError, CreateTaskRequest as DomainCreateTaskRequest, CreateListRequest, TaskBody, TaskImportance,
    microsoft_auth_types::OAuthState,
};
use axum::{
    extract::{State, Path},
    response::Result,
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};


#[derive(Debug, Deserialize)]
pub struct MicrosoftCallbackRequest {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MicrosoftAuthStatusResponse {
    authenticated: bool,
    microsoft_email: Option<String>,
    connected_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthUrlResponse {
    auth_url: String,
    state: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    title: String,
    body_content: Option<String>,
    importance: Option<TaskImportance>,
    code_context: Option<CodeContext>,
    status: Option<act_domain::TaskStatus>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CodeContext {
    file_path: String,
    line_start: Option<u32>,
    line_end: Option<u32>,
    branch: Option<String>,
    commit: Option<String>,
    language: Option<String>,
    context_snippet: Option<String>,
}


/// Get Microsoft authentication status for current user
pub async fn get_auth_status(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<MicrosoftAuthStatusResponse>>> {
    match state.domain_services.microsoft_auth_service.is_authenticated(&auth_user.user_id).await {
        Ok(is_authenticated) => {
            let status = MicrosoftAuthStatusResponse {
                authenticated: is_authenticated,
                microsoft_email: None, // Could be enhanced to fetch from repository
                connected_at: None,    // Could be enhanced to fetch from repository
            };

            Ok(Json(ApiResponse::success(status)))
        }
        Err(e) => {
            error!("Failed to check Microsoft auth status for user {}: {}", auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to check authentication status: {}", e))))
        }
    }
}

// Note: PKCE state is now managed via database (see OAuthState in domain layer)
// Previously used in-memory cache has been removed for persistence and horizontal scalability

/// Start Microsoft OAuth flow - redirect to Microsoft authorization
pub async fn start_oauth_flow(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<AuthUrlResponse>>> {
    match state.domain_services.microsoft_auth_service.get_authorization_url().await {
        Ok(auth_response) => {
            info!("Generated Microsoft OAuth URL for user: {}", auth_user.user_id);

            // Store OAuth state in database for persistence across restarts
            let oauth_state = OAuthState::new(
                auth_response.state.clone(),
                auth_user.user_id.clone(),
                auth_response.code_verifier,
            );

            if let Err(e) = state.domain_services.microsoft_auth_service.repository()
                .store_oauth_state(&oauth_state).await
            {
                error!("Failed to store OAuth state for user {}: {}", auth_user.user_id, e);
                return Ok(Json(ApiResponse::error("Failed to initiate OAuth flow")));
            }

            // Clean up expired states asynchronously
            let repo = state.domain_services.microsoft_auth_service.repository().clone();
            tokio::spawn(async move {
                let _ = repo.cleanup_expired_oauth_states().await;
            });

            let response = AuthUrlResponse {
                auth_url: auth_response.url,
                state: auth_response.state,
            };

            Ok(Json(ApiResponse::success(response)))
        }
        Err(e) => {
            error!("Failed to generate Microsoft OAuth URL for user {}: {}", auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to generate authorization URL: {}", e))))
        }
    }
}

/// Handle Microsoft OAuth callback - called by frontend with auth code
pub async fn handle_oauth_callback(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Json(request): Json<MicrosoftCallbackRequest>,
) -> Result<Json<ApiResponse<()>>> {
    if let Some(error) = request.error {
        error!("Microsoft OAuth error for user {}: {} - {}",
               auth_user.user_id, error,
               request.error_description.unwrap_or_default());
        return Ok(Json(ApiResponse::error("Microsoft OAuth failed")));
    }

    let code = match request.code {
        Some(code) => code,
        None => {
            error!("No authorization code received for user: {}", auth_user.user_id);
            return Ok(Json(ApiResponse::error("No authorization code received")));
        }
    };

    let state_param = match request.state {
        Some(state) => state,
        None => {
            error!("No state parameter received for user: {}", auth_user.user_id);
            return Ok(Json(ApiResponse::error("No state parameter received")));
        }
    };

    // Retrieve code_verifier from database using state (CSRF token)
    let code_verifier = match state.domain_services.microsoft_auth_service.repository()
        .get_oauth_state(&state_param).await
    {
        Ok(Some(oauth_state)) => {
            // Validate that the entry belongs to the current user
            if oauth_state.user_id != auth_user.user_id {
                error!("OAuth state user mismatch for state {}: expected {}, got {}",
                       state_param, auth_user.user_id, oauth_state.user_id);
                return Ok(Json(ApiResponse::error("Invalid state parameter")));
            }

            // Check expiration
            if oauth_state.is_expired() {
                error!("OAuth state expired for state {} and user: {}", state_param, auth_user.user_id);
                // Clean up expired state
                let _ = state.domain_services.microsoft_auth_service.repository()
                    .remove_oauth_state(&state_param).await;
                return Ok(Json(ApiResponse::error("Expired state parameter")));
            }

            // Remove the state after retrieval (one-time use)
            if let Err(e) = state.domain_services.microsoft_auth_service.repository()
                .remove_oauth_state(&state_param).await
            {
                warn!("Failed to remove OAuth state after retrieval: {}", e);
            }

            oauth_state.code_verifier
        }
        Ok(None) => {
            error!("OAuth state not found for state {} and user: {}", state_param, auth_user.user_id);
            return Ok(Json(ApiResponse::error("Invalid or expired state parameter")));
        }
        Err(e) => {
            error!("Failed to retrieve OAuth state for user {}: {}", auth_user.user_id, e);
            return Ok(Json(ApiResponse::error("Failed to retrieve OAuth state")));
        }
    };

    info!("Processing Microsoft OAuth callback for user: {}, code: {}, state: {}, verifier: {}",
          auth_user.user_id, &code[..8], state_param, &code_verifier[..8]);

    match state.domain_services.microsoft_auth_service.handle_oauth_callback(
        &auth_user.user_id,
        &code,
        &state_param,
        &code_verifier,
    ).await {
        Ok(()) => {
            info!("Microsoft authentication successful for user: {}", auth_user.user_id);

            // Verify auth was actually stored
            match state.domain_services.microsoft_auth_service.is_authenticated(&auth_user.user_id).await {
                Ok(true) => info!("✅ Verified Microsoft auth stored for user: {}", auth_user.user_id),
                Ok(false) => error!("❌ Microsoft auth NOT stored for user: {}", auth_user.user_id),
                Err(e) => error!("❌ Failed to verify Microsoft auth for user {}: {}", auth_user.user_id, e),
            }

            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Microsoft OAuth callback failed for user {}: {}", auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("OAuth callback failed: {}", e))))
        }
    }
}

/// Disconnect Microsoft account
pub async fn disconnect_microsoft(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<()>>> {
    match state.domain_services.microsoft_auth_service.disconnect(&auth_user.user_id).await {
        Ok(()) => {
            info!("Microsoft account disconnected for user: {}", auth_user.user_id);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to disconnect Microsoft account for user {}: {}", auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to disconnect Microsoft account: {}", e))))
        }
    }
}


/// Get all task lists for the user
pub async fn get_all_task_lists(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Vec<act_domain::TaskList>>>> {
    match state.domain_services.microsoft_auth_service.get_all_task_lists(&auth_user.user_id).await {
        Ok(lists) => {
            info!("Retrieved {} task lists for user: {}", lists.len(), auth_user.user_id);
            Ok(Json(ApiResponse::success(lists)))
        }
        Err(MicrosoftAuthError::NotAuthenticated) => {
            warn!("User {} not authenticated with Microsoft", auth_user.user_id);
            Ok(Json(ApiResponse::error("Microsoft authentication required")))
        }
        Err(MicrosoftAuthError::GraphApi(act_domain::GraphApiError::NotFound { resource })) => {
            warn!("Task lists not found for user {}: {}", auth_user.user_id, resource);
            // For debugging purposes, still return the error to understand what's happening
            // In the future, this might return an empty array after we fix the root issue
            Ok(Json(ApiResponse::error(format!("Task lists not found: {}", resource))))
        }
        Err(e) => {
            error!("Failed to get task lists for user {}: {}", auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to get task lists: {}", e))))
        }
    }
}

/// Get tasks from a specific list
pub async fn get_list_tasks(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Path(list_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<act_domain::Task>>>> {
    match state.domain_services.microsoft_auth_service.get_list_tasks(&auth_user.user_id, &list_id).await {
        Ok(tasks) => {
            info!("Retrieved {} tasks from list {} for user: {}", tasks.len(), list_id, auth_user.user_id);
            Ok(Json(ApiResponse::success(tasks)))
        }
        Err(MicrosoftAuthError::NotAuthenticated) => {
            warn!("User {} not authenticated with Microsoft", auth_user.user_id);
            Ok(Json(ApiResponse::error("Microsoft authentication required")))
        }
        Err(e) => {
            error!("Failed to get tasks from list {} for user {}: {}", list_id, auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to get tasks: {}", e))))
        }
    }
}

/// Get the user's default task list
pub async fn get_default_task_list(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Option<act_domain::TaskList>>>> {
    match state.domain_services.microsoft_auth_service.get_default_task_list(&auth_user.user_id).await {
        Ok(Some(list)) => {
            info!("Retrieved default task list '{}' for user: {}", list.display_name, auth_user.user_id);
            Ok(Json(ApiResponse::success(Some(list))))
        }
        Ok(None) => {
            info!("No default task list found for user: {}", auth_user.user_id);
            Ok(Json(ApiResponse::success(None)))
        }
        Err(MicrosoftAuthError::NotAuthenticated) => {
            warn!("User {} not authenticated with Microsoft", auth_user.user_id);
            Ok(Json(ApiResponse::error("Microsoft authentication required")))
        }
        Err(e) => {
            error!("Failed to get default task list for user {}: {}", auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to get default task list: {}", e))))
        }
    }
}

/// Create a new task list
pub async fn create_task_list(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Json(request): Json<CreateListRequest>,
) -> Result<Json<ApiResponse<act_domain::TaskList>>> {
    // Validate input
    if request.display_name.trim().is_empty() {
        return Ok(Json(ApiResponse::error("List name cannot be empty")));
    }

    match state.domain_services.microsoft_auth_service.create_task_list(
        &auth_user.user_id,
        &request.display_name,
    ).await {
        Ok(list) => {
            info!("Created task list '{}' for user: {}", list.display_name, auth_user.user_id);
            Ok(Json(ApiResponse::success(list)))
        }
        Err(MicrosoftAuthError::NotAuthenticated) => {
            warn!("User {} not authenticated with Microsoft", auth_user.user_id);
            Ok(Json(ApiResponse::error("Microsoft authentication required")))
        }
        Err(e) => {
            error!("Failed to create task list for user {}: {}", auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to create list: {}", e))))
        }
    }
}

/// Create a task in any list (general endpoint)
pub async fn create_task_in_list(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Path(list_id): Path<String>,
    Json(request): Json<CreateTaskRequest>,
) -> Result<Json<ApiResponse<act_domain::Task>>> {
    // Validate input
    if request.title.trim().is_empty() {
        return Ok(Json(ApiResponse::error("Task title cannot be empty")));
    }

    // Build task body with optional code context
    let body_content = if let Some(context) = &request.code_context {
        let mut content = request.body_content.unwrap_or_default();

        // Add code context metadata
        content.push_str("\n\n---\n<!-- DEV-CONTEXT\n");
        content.push_str(&serde_json::to_string_pretty(&serde_json::json!({
            "file": context.file_path,
            "lines": [context.line_start, context.line_end],
            "branch": context.branch,
            "commit": context.commit,
            "language": context.language,
            "context_snippet": context.context_snippet,
        })).unwrap_or_default());
        content.push_str("\n-->");

        Some(TaskBody {
            content,
            content_type: "text".to_string(),
        })
    } else {
        request.body_content.map(|content| TaskBody {
            content,
            content_type: "text".to_string(),
        })
    };

    let domain_request = DomainCreateTaskRequest {
        title: request.title,
        body: body_content,
        importance: request.importance,
        due_date_time: None,
        status: None,
    };

    match state.domain_services.microsoft_auth_service.create_task_in_list(
        &auth_user.user_id,
        &list_id,
        domain_request,
    ).await {
        Ok(task) => {
            info!("Created task '{}' in list {} for user: {}", task.title, list_id, auth_user.user_id);
            Ok(Json(ApiResponse::success(task)))
        }
        Err(MicrosoftAuthError::NotAuthenticated) => {
            warn!("User {} not authenticated with Microsoft", auth_user.user_id);
            Ok(Json(ApiResponse::error("Microsoft authentication required")))
        }
        Err(e) => {
            error!("Failed to create task in list {} for user {}: {}", list_id, auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to create task: {}", e))))
        }
    }
}

/// Update a task in a list
pub async fn update_task(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Path((list_id, task_id)): Path<(String, String)>,
    Json(request): Json<CreateTaskRequest>,
) -> Result<Json<ApiResponse<act_domain::Task>>> {
    // Validate input
    if request.title.trim().is_empty() {
        return Ok(Json(ApiResponse::error("Task title cannot be empty")));
    }

    // Build task body with optional code context
    let body_content = if let Some(context) = &request.code_context {
        let mut content = request.body_content.unwrap_or_default();

        // Add code context metadata
        content.push_str("\n\n---\n<!-- DEV-CONTEXT\n");
        content.push_str(&serde_json::to_string_pretty(&serde_json::json!({
            "file": context.file_path,
            "lines": [context.line_start, context.line_end],
            "branch": context.branch,
            "commit": context.commit,
            "language": context.language,
            "context_snippet": context.context_snippet,
        })).unwrap_or_default());
        content.push_str("\n-->");

        Some(TaskBody {
            content,
            content_type: "text".to_string(),
        })
    } else {
        request.body_content.map(|content| TaskBody {
            content,
            content_type: "text".to_string(),
        })
    };

    let domain_request = DomainCreateTaskRequest {
        title: request.title,
        body: body_content,
        importance: request.importance,
        due_date_time: None,
        status: request.status,
    };

    match state.domain_services.microsoft_auth_service.update_task(
        &auth_user.user_id,
        &list_id,
        &task_id,
        domain_request,
    ).await {
        Ok(task) => {
            info!("Updated task '{}' in list {} for user: {}", task.title, list_id, auth_user.user_id);
            Ok(Json(ApiResponse::success(task)))
        }
        Err(MicrosoftAuthError::NotAuthenticated) => {
            warn!("User {} not authenticated with Microsoft", auth_user.user_id);
            Ok(Json(ApiResponse::error("Microsoft authentication required")))
        }
        Err(e) => {
            error!("Failed to update task in list {} for user {}: {}", list_id, auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to update task: {}", e))))
        }
    }
}

/// Delete a task from a list
pub async fn delete_task(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Path((list_id, task_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<()>>> {
    match state.domain_services.microsoft_auth_service.delete_task(
        &auth_user.user_id,
        &list_id,
        &task_id,
    ).await {
        Ok(()) => {
            info!("Deleted task {} from list {} for user: {}", task_id, list_id, auth_user.user_id);
            Ok(Json(ApiResponse::success(())))
        }
        Err(MicrosoftAuthError::NotAuthenticated) => {
            warn!("User {} not authenticated with Microsoft", auth_user.user_id);
            Ok(Json(ApiResponse::error("Microsoft authentication required")))
        }
        Err(e) => {
            error!("Failed to delete task {} from list {} for user {}: {}", task_id, list_id, auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Failed to delete task: {}", e))))
        }
    }
}

/// Health check endpoint for Microsoft integration
pub async fn health_check(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    match state.domain_services.microsoft_auth_service.health_check(&auth_user.user_id).await {
        Ok(status) => {
            let health_info = serde_json::json!({
                "microsoft_integration": "available",
                "authenticated": status.authenticated,
                "graph_accessible": status.graph_accessible,
                "configuration_valid": status.configuration_valid,
                "user_email": status.user_email,
                "error": status.error
            });

            Ok(Json(ApiResponse::success(health_info)))
        }
        Err(e) => {
            error!("Microsoft health check failed for user {}: {}", auth_user.user_id, e);
            Ok(Json(ApiResponse::error(format!("Health check failed: {}", e))))
        }
    }
}