use crate::{
    error::ServerError, middleware::auth::AuthenticatedUser, models::ApiResponse, AppState,
};
use act_core::{
    CopyRequest, CreateDirectoryRequest, CreateFileRequest, DirectoryListing, FileContent,
    MoveRequest,
};
use axum::{
    extract::{Query, State},
    response::Json,
    routing::{delete, get, patch, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing::{debug, error, info};

// Response wrapper for file content that properly encodes content as string
#[derive(Debug, Serialize, Deserialize)]
pub struct FileContentResponse {
    pub path: String,
    pub content: String,
    pub encoding: String,
    pub size: u64,
    pub is_binary: bool,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_directory))
        .route("/content", get(read_file))
        .route("/content", put(save_file))
        .route("/", post(create_file))
        .route("/", delete(delete_file))
        .route("/rename", patch(rename_file))
        .route("/move", patch(move_file))
        .route("/copy", post(copy_file))
}

#[derive(Debug, Deserialize)]
pub struct ListDirectoryQuery {
    pub path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReadFileQuery {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveFileRequest {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateFileRequestPayload {
    pub path: String,
    pub content: Option<String>,
    pub is_directory: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RenameFileRequest {
    pub from_path: String,
    pub to_path: String,
}

#[derive(Debug, Deserialize)]
pub struct MoveFileRequest {
    pub from_path: String,
    pub to_path: String,
}

#[derive(Debug, Deserialize)]
pub struct CopyFileRequest {
    pub from_path: String,
    pub to_path: String,
    pub recursive: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteFileQuery {
    pub path: String,
}

pub async fn list_directory(
    Query(params): Query<ListDirectoryQuery>,
    State(state): State<AppState>,
    _user: AuthenticatedUser,
) -> Result<Json<ApiResponse<DirectoryListing>>, ServerError> {
    // Handle root directory requests
    let path_str = params.path.unwrap_or_else(|| ".".to_string());
    let path = if path_str == "." || path_str == "./" || path_str.is_empty() {
        PathBuf::from("") // Empty path means workspace root
    } else {
        PathBuf::from(path_str)
    };

    info!("Directory listing requested for: {}", path.display());

    info!("Directory listing requested for: {}", path.display());

    match state.filesystem.list_directory(&path).await {
        Ok(listing) => {
            debug!("Directory listing successful");
            Ok(Json(ApiResponse::success(listing)))
        }
        Err(e) => {
            error!("Failed to list directory: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn read_file(
    Query(params): Query<ReadFileQuery>,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<FileContentResponse>>, ServerError> {
    let path = PathBuf::from(params.path);
    info!("File read requested for: {}", path.display());

    match state.filesystem.read_file(&path).await {
        Ok(content) => {
            // Convert FileContent to FileContentResponse with proper string encoding
            let response = convert_file_content_to_response(content);
            Ok(Json(ApiResponse::success(response)))
        }
        Err(e) => {
            error!("Failed to read file: {}", e);
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
                use base64::{engine::general_purpose::STANDARD, Engine as _};
                (STANDARD.encode(&content.content), true)
            }
        }
    } else {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
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

pub async fn save_file(
    State(state): State<AppState>,
    Json(request): Json<SaveFileRequest>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("File save requested for: {}", request.path);

    let file_request = CreateFileRequest {
        path: PathBuf::from(request.path),
        content: request.content.into_bytes(),
        create_parent_dirs: true,
    };

    match state.filesystem.write_file(file_request).await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            error!("Failed to save file: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn create_file(
    State(state): State<AppState>,
    Json(request): Json<CreateFileRequestPayload>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("File/directory creation requested for: {}", request.path);

    if request.is_directory.unwrap_or(false) {
        let dir_request = CreateDirectoryRequest {
            path: PathBuf::from(request.path),
            create_parent_dirs: true,
        };

        match state.filesystem.create_directory(dir_request).await {
            Ok(_) => Ok(Json(ApiResponse::success(()))),
            Err(e) => {
                error!("Failed to create directory: {}", e);
                Err(ServerError::from(e))
            }
        }
    } else {
        let file_request = CreateFileRequest {
            path: PathBuf::from(request.path),
            content: request.content.unwrap_or_default().into_bytes(),
            create_parent_dirs: true,
        };

        match state.filesystem.write_file(file_request).await {
            Ok(_) => Ok(Json(ApiResponse::success(()))),
            Err(e) => {
                error!("Failed to create file: {}", e);
                Err(ServerError::from(e))
            }
        }
    }
}

pub async fn delete_file(
    Query(params): Query<DeleteFileQuery>,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    let path = PathBuf::from(params.path);
    info!("File deletion requested for: {}", path.display());

    // Check if it's a directory first and delete appropriately
    match state.filesystem.is_directory(&path).await {
        Ok(true) => match state.filesystem.delete_directory(&path, true).await {
            Ok(_) => Ok(Json(ApiResponse::success(()))),
            Err(e) => {
                error!("Failed to delete directory: {}", e);
                Err(ServerError::from(e))
            }
        },
        _ => match state.filesystem.delete_file(&path).await {
            Ok(_) => Ok(Json(ApiResponse::success(()))),
            Err(e) => {
                error!("Failed to delete file: {}", e);
                Err(ServerError::from(e))
            }
        },
    }
}

pub async fn rename_file(
    State(state): State<AppState>,
    Json(request): Json<RenameFileRequest>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!(
        "File rename requested from {} to {}",
        request.from_path, request.to_path
    );

    let move_request = MoveRequest {
        from: PathBuf::from(request.from_path),
        to: PathBuf::from(request.to_path),
    };

    match state.filesystem.move_item(move_request).await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            error!("Failed to rename file: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn move_file(
    State(state): State<AppState>,
    Json(request): Json<MoveFileRequest>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!(
        "File move requested from {} to {}",
        request.from_path, request.to_path
    );

    let move_request = MoveRequest {
        from: PathBuf::from(request.from_path),
        to: PathBuf::from(request.to_path),
    };

    match state.filesystem.move_item(move_request).await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            error!("Failed to move file: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn copy_file(
    State(state): State<AppState>,
    Json(request): Json<CopyFileRequest>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!(
        "File copy requested from {} to {}",
        request.from_path, request.to_path
    );

    let copy_request = CopyRequest {
        from: PathBuf::from(request.from_path),
        to: PathBuf::from(request.to_path),
        recursive: request.recursive.unwrap_or(true),
    };

    match state.filesystem.copy_item(copy_request).await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            error!("Failed to copy file: {}", e);
            Err(ServerError::from(e))
        }
    }
}
