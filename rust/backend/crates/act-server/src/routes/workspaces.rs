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
use act_core::{DirectoryListing, FileContent, CreateFileRequest, CreateDirectoryRequest, MoveRequest, CopyRequest};
use crate::models::{Session, session_info_from_domain};

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
pub struct CreateEmptyWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
    pub path: Option<String>,
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
        .route("/empty", post(create_empty_workspace))
        .route("/:workspace_id", get(get_workspace))
        .route("/:workspace_id", put(update_workspace))
        .route("/:workspace_id", delete(delete_workspace))
        .route("/:workspace_id/sessions", get(get_workspace_sessions))
        .route("/:workspace_id/files", get(get_workspace_files))
        .route("/:workspace_id/files", post(create_workspace_file))
        .route("/:workspace_id/files", delete(delete_workspace_file))
        .route("/:workspace_id/files/rename", axum::routing::patch(rename_workspace_file))
        .route("/:workspace_id/files/move", axum::routing::patch(move_workspace_file))
        .route("/:workspace_id/files/copy", post(copy_workspace_file))
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

pub async fn create_empty_workspace(
    auth_user: AuthenticatedUser,
    State(state): State<AppState>,
    Json(request): Json<CreateEmptyWorkspaceRequest>
) -> Result<Json<ApiResponse<act_core::repository::Workspace>>, ServerError> {
    // CSRF verification is handled by the middleware layer
    // This handler only executes if CSRF validation passes
    info!("Empty workspace creation requested: {} for user {}", request.name, auth_user.user_id);

    let workspace = state.domain_services.workspace_service
        .create_empty_workspace(
            &auth_user.user_id,
            request.name,
            request.description,
            request.path
        )
        .await?;

    info!("Empty workspace created successfully: {}", workspace.id);
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
    
    let sessions: Vec<Session> = domain_sessions.into_iter().map(|session_info| {
        let mut session = session_info_from_domain(session_info);
        session.user_id = auth_user.user_id.clone();
        session
    }).collect();
    
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

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceFileRequest {
    pub path: String,
    pub content: Option<String>,
    pub is_directory: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteWorkspaceFileQuery {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct RenameWorkspaceFileRequest {
    pub from_path: String,
    pub to_path: String,
}

#[derive(Debug, Deserialize)]
pub struct MoveWorkspaceFileRequest {
    pub from_path: String,
    pub to_path: String,
}

#[derive(Debug, Deserialize)]
pub struct CopyWorkspaceFileRequest {
    pub from_path: String,
    pub to_path: String,
    pub recursive: Option<bool>,
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



pub async fn create_workspace_file(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<CreateWorkspaceFileRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Workspace file/directory creation requested: {} path: {} for user {}", workspace_id, request.path, auth_user.user_id);

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

    if request.is_directory.unwrap_or(false) {
        info!("Creating directory: {}", file_path.display());
        let dir_request = CreateDirectoryRequest {
            path: file_path,
            create_parent_dirs: true,
        };

        match state.filesystem.create_directory(dir_request).await {
            Ok(_) => {
                info!("Directory created successfully for workspace {} path {}", workspace_id, request.path);
                Ok(Json(ApiResponse::success(())))
            },
            Err(e) => {
                tracing::error!("Failed to create workspace directory: {}", e);
                Err(ServerError::from(e))
            }
        }
    } else {
        info!("Creating file: {}", file_path.display());
        let file_request = CreateFileRequest {
            path: file_path,
            content: request.content.unwrap_or_default().into_bytes(),
            create_parent_dirs: true,
        };

        match state.filesystem.write_file(file_request).await {
            Ok(_) => {
                info!("File created successfully for workspace {} path {}", workspace_id, request.path);
                Ok(Json(ApiResponse::success(())))
            },
            Err(e) => {
                tracing::error!("Failed to create workspace file: {}", e);
                Err(ServerError::from(e))
            }
        }
    }
}

pub async fn delete_workspace_file(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    Query(params): Query<DeleteWorkspaceFileQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Workspace file deletion requested: {} path: {} for user {}", workspace_id, params.path, auth_user.user_id);

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

    info!("Deleting file: {}", file_path.display());

    // Check if it's a directory first and delete appropriately
    match state.filesystem.is_directory(&file_path).await {
        Ok(true) => {
            match state.filesystem.delete_directory(&file_path, true).await {
                Ok(_) => {
                    info!("Directory deleted successfully for workspace {} path {}", workspace_id, params.path);
                    Ok(Json(ApiResponse::success(())))
                },
                Err(e) => {
                    tracing::error!("Failed to delete workspace directory: {}", e);
                    Err(ServerError::from(e))
                }
            }
        }
        _ => {
            match state.filesystem.delete_file(&file_path).await {
                Ok(_) => {
                    info!("File deleted successfully for workspace {} path {}", workspace_id, params.path);
                    Ok(Json(ApiResponse::success(())))
                },
                Err(e) => {
                    tracing::error!("Failed to delete workspace file: {}", e);
                    Err(ServerError::from(e))
                }
            }
        }
    }
}

pub async fn rename_workspace_file(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<RenameWorkspaceFileRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Workspace file rename requested: {} from {} to {} for user {}", workspace_id, request.from_path, request.to_path, auth_user.user_id);

    // Get the workspace to get its local path
    let workspace = state.domain_services.workspace_service
        .get_workspace(&auth_user.user_id, &workspace_id)
        .await?;

    // Handle relative paths within the workspace
    let from_path = if request.from_path.starts_with("/") {
        std::path::PathBuf::from(&workspace.local_path).join(request.from_path.trim_start_matches('/'))
    } else {
        std::path::PathBuf::from(&workspace.local_path).join(&request.from_path)
    };

    let to_path = if request.to_path.starts_with("/") {
        std::path::PathBuf::from(&workspace.local_path).join(request.to_path.trim_start_matches('/'))
    } else {
        std::path::PathBuf::from(&workspace.local_path).join(&request.to_path)
    };

    info!("Renaming file from {} to {}", from_path.display(), to_path.display());

    let move_request = MoveRequest {
        from: from_path,
        to: to_path,
    };

    match state.filesystem.move_item(move_request).await {
        Ok(_) => {
            info!("File renamed successfully for workspace {}", workspace_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            tracing::error!("Failed to rename workspace file: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn move_workspace_file(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<MoveWorkspaceFileRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Workspace file move requested: {} from {} to {} for user {}", workspace_id, request.from_path, request.to_path, auth_user.user_id);

    // Get the workspace to get its local path
    let workspace = state.domain_services.workspace_service
        .get_workspace(&auth_user.user_id, &workspace_id)
        .await?;

    // Handle relative paths within the workspace
    let from_path = if request.from_path.starts_with("/") {
        std::path::PathBuf::from(&workspace.local_path).join(request.from_path.trim_start_matches('/'))
    } else {
        std::path::PathBuf::from(&workspace.local_path).join(&request.from_path)
    };

    let to_path = if request.to_path.starts_with("/") {
        std::path::PathBuf::from(&workspace.local_path).join(request.to_path.trim_start_matches('/'))
    } else {
        std::path::PathBuf::from(&workspace.local_path).join(&request.to_path)
    };

    info!("Moving file from {} to {}", from_path.display(), to_path.display());

    let move_request = MoveRequest {
        from: from_path,
        to: to_path,
    };

    match state.filesystem.move_item(move_request).await {
        Ok(_) => {
            info!("File moved successfully for workspace {}", workspace_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            tracing::error!("Failed to move workspace file: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn copy_workspace_file(
    auth_user: AuthenticatedUser,
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<CopyWorkspaceFileRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Workspace file copy requested: {} from {} to {} for user {}", workspace_id, request.from_path, request.to_path, auth_user.user_id);

    // Get the workspace to get its local path
    let workspace = state.domain_services.workspace_service
        .get_workspace(&auth_user.user_id, &workspace_id)
        .await?;

    // Handle relative paths within the workspace
    let from_path = if request.from_path.starts_with("/") {
        std::path::PathBuf::from(&workspace.local_path).join(request.from_path.trim_start_matches('/'))
    } else {
        std::path::PathBuf::from(&workspace.local_path).join(&request.from_path)
    };

    let to_path = if request.to_path.starts_with("/") {
        std::path::PathBuf::from(&workspace.local_path).join(request.to_path.trim_start_matches('/'))
    } else {
        std::path::PathBuf::from(&workspace.local_path).join(&request.to_path)
    };

    info!("Copying file from {} to {}", from_path.display(), to_path.display());

    let copy_request = CopyRequest {
        from: from_path,
        to: to_path,
        recursive: request.recursive.unwrap_or(true),
    };

    match state.filesystem.copy_item(copy_request).await {
        Ok(_) => {
            info!("File copied successfully for workspace {}", workspace_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            tracing::error!("Failed to copy workspace file: {}", e);
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
