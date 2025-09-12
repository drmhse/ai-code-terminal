use crate::{
    models::ApiResponse,
    middleware::auth::AuthenticatedUser,
    AppState,
    error::ServerError,
};

use axum::{
    extract::{Path, Query, State},
    response::Json,
    routing::{get, post, put, delete},
    Router,
};
use serde::{Deserialize, Serialize};
use tracing::info;
use act_core::{DirectoryListing, FileContent, CreateFileRequest};
use crate::models::{Session, session_from_domain};

// Response wrapper for file content that properly encodes content as string
#[derive(Debug, Serialize, Deserialize)]
pub struct FileContentResponse {
    pub path: String,
    pub content: String,
    pub encoding: String,
    pub size: u64,
    pub is_binary: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub github_repo: Option<String>,
    pub github_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListWorkspacesQuery {
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_workspaces))
        .route("/", post(create_workspace))
        .route("/:workspace_id", get(get_workspace))
        .route("/:workspace_id", put(update_workspace))
        .route("/:workspace_id", delete(delete_workspace))
        .route("/:workspace_id/sessions", get(get_workspace_sessions))
        .route("/:workspace_id/files", get(get_workspace_files))
        .route("/:workspace_id/files/content", get(get_workspace_file_content))
        .route("/:workspace_id/files/content", put(save_workspace_file_content))
}

pub async fn list_workspaces(
    auth_user: AuthenticatedUser,
    Query(_params): Query<ListWorkspacesQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<act_core::repository::Workspace>>>, ServerError> {
    info!("Workspace list requested for user {}", auth_user.user_id);
    
    let workspaces = state.domain_services.workspace_service
        .list_workspaces(&auth_user.user_id, true) // active_only
        .await?;
    
    Ok(Json(ApiResponse::success(workspaces)))
}

pub async fn create_workspace(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
    Json(request): Json<CreateWorkspaceRequest>
) -> Result<Json<ApiResponse<act_core::repository::Workspace>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Workspace creation requested: {} for user {}", request.name, auth_user.user_id);
    
    let workspace = state.domain_services.workspace_service
        .create_workspace(
            &auth_user.user_id,
            request.name,
            request.github_repo,
            request.github_url
        )
        .await?;
    
    info!("Workspace created successfully: {}", workspace.id);
    Ok(Json(ApiResponse::success(workspace)))
}

pub async fn get_workspace(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<act_core::repository::Workspace>>, ServerError> {
    info!("Workspace details requested: {} for user {}", workspace_id, auth_user.user_id);
    
    let workspace = state.domain_services.workspace_service
        .get_workspace(&auth_user.user_id, &workspace_id)
        .await?;
    
    Ok(Json(ApiResponse::success(workspace)))
}

pub async fn update_workspace(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<UpdateWorkspaceRequest>
) -> Result<Json<ApiResponse<act_core::repository::Workspace>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Workspace update requested: {} for user {}", workspace_id, auth_user.user_id);
    
    let workspace = state.domain_services.workspace_service
        .update_workspace(&auth_user.user_id, &workspace_id, request.name, request.is_active)
        .await?;
    
    info!("Workspace updated successfully: {}", workspace_id);
    Ok(Json(ApiResponse::success(workspace)))
}

pub async fn delete_workspace(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Workspace deletion requested: {} for user {}", workspace_id, auth_user.user_id);
    
    state.domain_services.workspace_service
        .delete_workspace(&auth_user.user_id, &workspace_id)
        .await?;
    
    info!("Workspace deleted successfully: {}", workspace_id);
    Ok(Json(ApiResponse::success(())))
}

pub async fn get_workspace_sessions(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<Session>>>, ServerError> {
    info!("Workspace sessions requested: {} for user {}", workspace_id, auth_user.user_id);
    
    let domain_sessions = state.domain_services.session_service
        .list_workspace_sessions(&auth_user.user_id, &workspace_id)
        .await?;
    
    let sessions: Vec<Session> = domain_sessions.into_iter().map(session_from_domain).collect();
    
    info!("Retrieved {} sessions for workspace {}", sessions.len(), workspace_id);
    Ok(Json(ApiResponse::success(sessions)))
}

#[derive(Debug, Deserialize)]
pub struct WorkspaceFilesQuery {
    pub path: Option<String>,
}

pub async fn get_workspace_files(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    Query(params): Query<WorkspaceFilesQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<DirectoryListing>>, ServerError> {
    info!("Workspace files requested: {} path: {:?} for user {}", workspace_id, params.path, auth_user.user_id);
    
    // Get the workspace to get its local path
    let workspace = state.domain_services.workspace_service
        .get_workspace(&auth_user.user_id, &workspace_id)
        .await?;
    
    // Handle relative path within the workspace
    let path_str = params.path.unwrap_or_else(|| ".".to_string());
    let full_path = if path_str == "." || path_str == "./" || path_str.is_empty() {
        std::path::PathBuf::from(&workspace.local_path)
    } else {
        std::path::PathBuf::from(&workspace.local_path).join(path_str)
    };
    
    info!("Listing directory: {}", full_path.display());
    
    match state.filesystem.list_directory(&full_path).await {
        Ok(listing) => {
            info!("Directory listing successful for workspace {}", workspace_id);
            Ok(Json(ApiResponse::success(listing)))
        },
        Err(e) => {
            tracing::error!("Failed to list workspace directory: {}", e);
            Err(ServerError::from(e))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct WorkspaceFileContentQuery {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveWorkspaceFileRequest {
    pub path: String,
    pub content: String,
}

pub async fn get_workspace_file_content(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    Query(params): Query<WorkspaceFileContentQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<FileContentResponse>>, ServerError> {
    info!("Workspace file content requested: {} path: {} for user {}", workspace_id, params.path, auth_user.user_id);
    
    // Get the workspace to get its local path
    let workspace = state.domain_services.workspace_service
        .get_workspace(&auth_user.user_id, &workspace_id)
        .await?;
    
    // Handle relative path within the workspace
    let file_path = if params.path.starts_with("/") {
        // Absolute path - use as is but make it relative to workspace
        std::path::PathBuf::from(&workspace.local_path).join(params.path.trim_start_matches('/'))
    } else {
        // Relative path - join with workspace path
        std::path::PathBuf::from(&workspace.local_path).join(&params.path)
    };
    
    info!("Reading file: {}", file_path.display());
    
    match state.filesystem.read_file(&file_path).await {
        Ok(content) => {
            info!("File read successful for workspace {} file {}", workspace_id, params.path);
            // Convert FileContent to FileContentResponse with proper string encoding
            let response = convert_file_content_to_response(content);
            Ok(Json(ApiResponse::success(response)))
        },
        Err(e) => {
            tracing::error!("Failed to read workspace file: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn save_workspace_file_content(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<SaveWorkspaceFileRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Workspace file save requested: {} path: {} for user {}", workspace_id, request.path, auth_user.user_id);
    
    // Get the workspace to get its local path
    let workspace = state.domain_services.workspace_service
        .get_workspace(&auth_user.user_id, &workspace_id)
        .await?;
    
    // Handle relative path within the workspace
    let file_path = if request.path.starts_with("/") {
        // Absolute path - use as is but make it relative to workspace
        std::path::PathBuf::from(&workspace.local_path).join(request.path.trim_start_matches('/'))
    } else {
        // Relative path - join with workspace path
        std::path::PathBuf::from(&workspace.local_path).join(&request.path)
    };
    
    info!("Saving file: {}", file_path.display());
    
    let file_request = CreateFileRequest {
        path: file_path,
        content: request.content.into_bytes(),
        create_parent_dirs: true,
    };
    
    match state.filesystem.write_file(file_request).await {
        Ok(_) => {
            info!("File saved successfully for workspace {} file {}", workspace_id, request.path);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            tracing::error!("Failed to save workspace file: {}", e);
            Err(ServerError::from(e))
        }
    }
}



// Helper function to convert FileContent to FileContentResponse
fn convert_file_content_to_response(content: FileContent) -> FileContentResponse {
    let (content_str, is_binary) = if content.encoding == "utf-8" {
        match String::from_utf8(content.content.clone()) {
            Ok(text) => (text, false),
            Err(_) => {
                // Fallback to base64 for binary content
                use base64::{Engine as _, engine::general_purpose::STANDARD};
                (STANDARD.encode(&content.content), true)
            }
        }
    } else {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        (STANDARD.encode(&content.content), true)
    };

    FileContentResponse {
        path: content.path.to_string_lossy().to_string(),
        content: content_str,
        encoding: content.encoding,
        size: content.size,
        is_binary,
    }
}
