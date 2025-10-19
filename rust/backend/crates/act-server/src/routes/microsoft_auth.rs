//! Microsoft To-Do Integration Routes
//!
//! # Token Management Architecture
//!
//! This module uses a **dual-token approach** to support both user-initiated requests
//! and autonomous background sync:
//!
//! ## User-Initiated Requests (HTTP Routes)
//! - Routes fetch fresh tokens from SSO on-demand via `sso_client.get_provider_token()`
//! - These tokens are used directly for immediate Microsoft Graph API calls
//! - **Important**: Routes optionally cache tokens in the repository for background sync
//!
//! ## Background Sync Operations
//! - Background sync has no HTTP context and cannot access SSO JWT tokens
//! - Instead, it reads cached tokens from repository via `microsoft_auth_service.get_access_token()`
//! - These cached tokens are populated by routes when they fetch from SSO
//!
//! ## When to Cache Tokens
//! Routes should cache SSO tokens if background sync needs to access Microsoft on behalf of users:
//!
//! ```rust,ignore
//! // Get token from SSO
//! let provider_token = state.sso_client
//!     .get_provider_token(&auth_user.raw_jwt, "microsoft")
//!     .await?;
//!
//! // Cache for background sync (use db_user_id as key, not sso_user_id!)
//! cache_provider_token(&state, &auth_user.db_user_id, &provider_token).await;
//!
//! // Use token immediately
//! let result = state.domain_services.microsoft_auth_service.graph_client
//!     .get_task_lists(&provider_token.access_token, None)
//!     .await?;
//! ```
//!
//! ## Current Status
//! - ✅ Routes use SSO for immediate token fetching
//! - ✅ MicrosoftAuthService can read cached tokens for background sync
//! - ✅ Routes now cache tokens for background sync using `cache_provider_token` helper

use crate::{middleware::sso_auth::AuthenticatedUser, models::ApiResponse, AppState};
use act_core::PaginationParams;
use act_domain::{
    CreateListRequest, CreateTaskRequest as DomainCreateTaskRequest, TaskBody, TaskImportance,
};
use axum::{
    extract::{Path, Query, State},
    response::Result,
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

#[derive(Debug, Serialize)]
pub struct MicrosoftAuthStatusResponse {
    authenticated: bool,
    microsoft_email: Option<String>,
    connected_at: Option<String>,
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

/// Helper function to cache Microsoft tokens for background sync
///
/// This caches tokens fetched from SSO so that background operations (like todo sync)
/// can access Microsoft Graph API without an active HTTP request context.
async fn cache_provider_token(
    state: &AppState,
    db_user_id: &str,
    provider_token: &crate::sso::types::ProviderTokenResponse,
) {
    // Calculate expires_in from expires_at timestamp
    let expires_in_seconds = if let Some(expires_at_str) = &provider_token.expires_at {
        match chrono::DateTime::parse_from_rfc3339(expires_at_str) {
            Ok(expires_at) => {
                let now = chrono::Utc::now();
                let duration = expires_at.signed_duration_since(now);
                duration.num_seconds().max(0) as u64
            }
            Err(_) => {
                warn!("Failed to parse expires_at timestamp, using default 3600 seconds");
                3600 // Default to 1 hour
            }
        }
    } else {
        3600 // Default to 1 hour if no expiry provided
    };

    if let Err(e) = state
        .domain_services
        .microsoft_auth_service
        .cache_token_for_background_sync(
            db_user_id,
            &provider_token.access_token,
            expires_in_seconds,
            provider_token.refresh_token.as_deref(),
        )
        .await
    {
        warn!(
            "Failed to cache Microsoft token for user {}: {}",
            db_user_id, e
        );
        // Continue despite cache failure - token is still valid for immediate use
    }
}

/// Get Microsoft authentication status for current user
pub async fn get_auth_status(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<MicrosoftAuthStatusResponse>>> {
    // Check if SSO can provide a Microsoft token for this user
    match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(_) => {
            Ok(Json(ApiResponse::success(MicrosoftAuthStatusResponse {
                authenticated: true,
                microsoft_email: Some(auth_user.email.clone()),
                connected_at: None, // Not tracked anymore with SSO
            })))
        }
        Err(e) => {
            // If SSO can't provide token, user needs to connect Microsoft in SSO UI
            warn!(
                "User {} not connected to Microsoft via SSO: {}",
                auth_user.sso_user_id, e
            );
            Ok(Json(ApiResponse::success(MicrosoftAuthStatusResponse {
                authenticated: false,
                microsoft_email: None,
                connected_at: None,
            })))
        }
    }
}

/// Get all task lists for the user
pub async fn get_all_task_lists(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Vec<act_domain::TaskList>>>> {
    // Get Microsoft token from SSO
    let provider_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(token) => token,
        Err(e) => {
            warn!(
                "Failed to get Microsoft token from SSO for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(
                "Microsoft account not connected. Please connect your Microsoft account in Settings."
            )));
        }
    };

    // Cache token for background sync operations
    cache_provider_token(&state, &auth_user.db_user_id, &provider_token).await;

    // Call Graph API directly with SSO-provided token
    match state
        .domain_services
        .microsoft_auth_service
        .graph_client
        .get_task_lists(&provider_token.access_token, None)
        .await
    {
        Ok((lists, _)) => {
            info!(
                "Retrieved {} task lists for user: {}",
                lists.len(),
                auth_user.sso_user_id
            );
            Ok(Json(ApiResponse::success(lists)))
        }
        Err(act_domain::GraphApiError::NotFound { resource }) => {
            warn!(
                "Task lists not found for user {}: {}",
                auth_user.sso_user_id, resource
            );
            Ok(Json(ApiResponse::error(format!(
                "Task lists not found: {}",
                resource
            ))))
        }
        Err(e) => {
            error!(
                "Microsoft Graph API error for user {}: {}",
                auth_user.sso_user_id, e
            );
            Ok(Json(ApiResponse::error(format!(
                "Failed to get task lists: {}",
                e
            ))))
        }
    }
}

/// Get tasks from a specific list
pub async fn get_list_tasks(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Path(list_id): Path<String>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<ApiResponse<act_core::PaginatedResponse<act_domain::Task>>>> {
    // Validate pagination parameters
    if let Err(err) = pagination.validate() {
        return Ok(Json(ApiResponse::error(err)));
    }

    // Get Microsoft token from SSO
    let provider_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(token) => token,
        Err(e) => {
            warn!(
                "Failed to get Microsoft token from SSO for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(
                "Microsoft account not connected. Please connect your Microsoft account in Settings."
            )));
        }
    };

    // Cache token for background sync operations
    cache_provider_token(&state, &auth_user.db_user_id, &provider_token).await;

    // Call Graph API directly with SSO-provided token
    let (tasks, _) = match state
        .domain_services
        .microsoft_auth_service
        .graph_client
        .get_tasks(&provider_token.access_token, &list_id, Some(&pagination))
        .await
    {
        Ok(result) => result,
        Err(e) => {
            error!(
                "Microsoft Graph API error for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(format!(
                "Failed to get tasks: {}",
                e
            ))));
        }
    };

    // Estimate total count based on page size
    let total_count = if tasks.len() < pagination.get_limit() as usize {
        let offset = pagination.get_offset();
        (offset + tasks.len() as u32) as u64
    } else {
        let offset = pagination.get_offset();
        (offset + tasks.len() as u32 + 1) as u64
    };

    info!(
        "Retrieved {} tasks from list {} for user: {} (total: {})",
        tasks.len(),
        list_id,
        auth_user.sso_user_id,
        total_count
    );

    let page = pagination.page.unwrap_or(1);
    let page_size = pagination.get_limit();
    let pagination_info = act_core::PaginationInfo::new(page, page_size, total_count);

    let paginated_response = act_core::PaginatedResponse {
        data: tasks,
        pagination: pagination_info,
    };

    Ok(Json(ApiResponse::success(paginated_response)))
}

/// Get the user's default task list
pub async fn get_default_task_list(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Option<act_domain::TaskList>>>> {
    // Get Microsoft token from SSO
    let provider_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(token) => token,
        Err(e) => {
            warn!(
                "Failed to get Microsoft token from SSO for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(
                "Microsoft account not connected. Please connect your Microsoft account in Settings."
            )));
        }
    };

    // Cache token for background sync operations
    cache_provider_token(&state, &auth_user.db_user_id, &provider_token).await;

    // Call Graph API to get all lists
    match state
        .domain_services
        .microsoft_auth_service
        .graph_client
        .get_task_lists(&provider_token.access_token, None)
        .await
    {
        Ok((all_lists, _)) => {
            // Look for the default "Tasks" list
            let default_list = all_lists.into_iter().find(|list| {
                list.wellknown_list_name
                    .as_ref()
                    .is_some_and(|name| name == "defaultList")
                    || list.display_name == "Tasks"
            });

            if let Some(ref list) = default_list {
                info!(
                    "Retrieved default task list '{}' for user: {}",
                    list.display_name, auth_user.sso_user_id
                );
            } else {
                info!(
                    "No default task list found for user: {}",
                    auth_user.sso_user_id
                );
            }

            Ok(Json(ApiResponse::success(default_list)))
        }
        Err(act_domain::GraphApiError::NotFound { resource }) => {
            warn!(
                "Task lists not found for user {}: {}",
                auth_user.sso_user_id, resource
            );
            Ok(Json(ApiResponse::success(None)))
        }
        Err(e) => {
            error!(
                "Microsoft Graph API error for user {}: {}",
                auth_user.sso_user_id, e
            );
            Ok(Json(ApiResponse::error(format!(
                "Failed to get default task list: {}",
                e
            ))))
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

    // Get Microsoft token from SSO
    let provider_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(token) => token,
        Err(e) => {
            warn!(
                "Failed to get Microsoft token from SSO for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(
                "Microsoft account not connected. Please connect your Microsoft account in Settings."
            )));
        }
    };

    // Call Graph API to create task list
    match state
        .domain_services
        .microsoft_auth_service
        .graph_client
        .create_task_list(&provider_token.access_token, request)
        .await
    {
        Ok(list) => {
            info!(
                "Created task list '{}' for user: {}",
                list.display_name, auth_user.sso_user_id
            );
            Ok(Json(ApiResponse::success(list)))
        }
        Err(e) => {
            error!(
                "Microsoft Graph API error for user {}: {}",
                auth_user.sso_user_id, e
            );
            Ok(Json(ApiResponse::error(format!(
                "Failed to create list: {}",
                e
            ))))
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
        content.push_str(
            &serde_json::to_string_pretty(&serde_json::json!({
                "file": context.file_path,
                "lines": [context.line_start, context.line_end],
                "branch": context.branch,
                "commit": context.commit,
                "language": context.language,
                "context_snippet": context.context_snippet,
            }))
            .unwrap_or_default(),
        );
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

    // Get Microsoft token from SSO
    let provider_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(token) => token,
        Err(e) => {
            warn!(
                "Failed to get Microsoft token from SSO for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(
                "Microsoft account not connected. Please connect your Microsoft account in Settings."
            )));
        }
    };

    // Cache token for background sync operations
    cache_provider_token(&state, &auth_user.db_user_id, &provider_token).await;

    // Call Graph API to create task
    match state
        .domain_services
        .microsoft_auth_service
        .graph_client
        .create_task(&provider_token.access_token, &list_id, domain_request)
        .await
    {
        Ok(task) => {
            info!(
                "Created task '{}' in list {} for user: {}",
                task.title, list_id, auth_user.sso_user_id
            );
            Ok(Json(ApiResponse::success(task)))
        }
        Err(e) => {
            error!(
                "Microsoft Graph API error for user {}: {}",
                auth_user.sso_user_id, e
            );
            Ok(Json(ApiResponse::error(format!(
                "Failed to create task: {}",
                e
            ))))
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
        content.push_str(
            &serde_json::to_string_pretty(&serde_json::json!({
                "file": context.file_path,
                "lines": [context.line_start, context.line_end],
                "branch": context.branch,
                "commit": context.commit,
                "language": context.language,
                "context_snippet": context.context_snippet,
            }))
            .unwrap_or_default(),
        );
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

    // Get Microsoft token from SSO
    let provider_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(token) => token,
        Err(e) => {
            warn!(
                "Failed to get Microsoft token from SSO for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(
                "Microsoft account not connected. Please connect your Microsoft account in Settings."
            )));
        }
    };

    // Call Graph API to update task
    match state
        .domain_services
        .microsoft_auth_service
        .graph_client
        .update_task(
            &provider_token.access_token,
            &list_id,
            &task_id,
            domain_request,
        )
        .await
    {
        Ok(task) => {
            info!(
                "Updated task '{}' in list {} for user: {}",
                task.title, list_id, auth_user.sso_user_id
            );
            Ok(Json(ApiResponse::success(task)))
        }
        Err(e) => {
            error!(
                "Microsoft Graph API error for user {}: {}",
                auth_user.sso_user_id, e
            );
            Ok(Json(ApiResponse::error(format!(
                "Failed to update task: {}",
                e
            ))))
        }
    }
}

/// Delete a task from a list
pub async fn delete_task(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Path((list_id, task_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<()>>> {
    // Get Microsoft token from SSO
    let provider_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(token) => token,
        Err(e) => {
            warn!(
                "Failed to get Microsoft token from SSO for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(
                "Microsoft account not connected. Please connect your Microsoft account in Settings."
            )));
        }
    };

    // Call Graph API to delete task
    match state
        .domain_services
        .microsoft_auth_service
        .graph_client
        .delete_task(&provider_token.access_token, &list_id, &task_id)
        .await
    {
        Ok(()) => {
            info!(
                "Deleted task {} from list {} for user: {}",
                task_id, list_id, auth_user.sso_user_id
            );
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!(
                "Microsoft Graph API error for user {}: {}",
                auth_user.sso_user_id, e
            );
            Ok(Json(ApiResponse::error(format!(
                "Failed to delete task: {}",
                e
            ))))
        }
    }
}

/// Get a specific task from a list
pub async fn get_task(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Path((list_id, task_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<act_domain::Task>>> {
    // Get Microsoft token from SSO
    let provider_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(token) => token,
        Err(e) => {
            warn!(
                "Failed to get Microsoft token from SSO for user {}: {}",
                auth_user.sso_user_id, e
            );
            return Ok(Json(ApiResponse::error(
                "Microsoft account not connected. Please connect your Microsoft account in Settings."
            )));
        }
    };

    // Call Graph API to get task
    match state
        .domain_services
        .microsoft_auth_service
        .graph_client
        .get_task(&provider_token.access_token, &list_id, &task_id)
        .await
    {
        Ok(task) => {
            info!(
                "Retrieved task {} from list {} for user: {}",
                task_id, list_id, auth_user.sso_user_id
            );
            Ok(Json(ApiResponse::success(task)))
        }
        Err(e) => {
            error!(
                "Microsoft Graph API error for user {}: {}",
                auth_user.sso_user_id, e
            );
            Ok(Json(ApiResponse::error(format!(
                "Failed to retrieve task: {}",
                e
            ))))
        }
    }
}

/// Health check endpoint for Microsoft integration
pub async fn health_check(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    // Check if SSO can provide a Microsoft token
    match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "microsoft")
        .await
    {
        Ok(_token) => {
            let health_info = serde_json::json!({
                "microsoft_integration": "available",
                "authenticated": true,
                "graph_accessible": true,
                "configuration_valid": true,
                "user_email": Some(auth_user.email.clone()),
                "error": null
            });

            Ok(Json(ApiResponse::success(health_info)))
        }
        Err(e) => {
            warn!(
                "Microsoft health check failed for user {}: {}",
                auth_user.sso_user_id, e
            );
            let health_info = serde_json::json!({
                "microsoft_integration": "available",
                "authenticated": false,
                "graph_accessible": false,
                "configuration_valid": true,
                "user_email": null,
                "error": "Microsoft account not connected"
            });

            Ok(Json(ApiResponse::success(health_info)))
        }
    }
}
