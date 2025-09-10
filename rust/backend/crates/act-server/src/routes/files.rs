use crate::{models::ApiResponse, AppState, error::ServerError};
use axum::{
    extract::{Query, State},
    response::Json,
    routing::{get, post, put, patch, delete},
    Router,
};
use act_core::{DirectoryListing, CreateFileRequest, FileContent, CreateDirectoryRequest, MoveRequest};
use serde::Deserialize;
use std::path::PathBuf;
use tracing::{debug, error, info};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_directory))
        .route("/content", get(read_file))
        .route("/content", put(save_file))
        .route("/", post(create_file))
        .route("/", delete(delete_file))
        .route("/rename", patch(rename_file))
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
pub struct DeleteFileQuery {
    pub path: String,
}

pub async fn list_directory(
    Query(params): Query<ListDirectoryQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<DirectoryListing>>, ServerError> {
    let path = PathBuf::from(params.path.unwrap_or_else(|| "./".to_string()));
    info!("Directory listing requested for: {}", path.display());

    match state.filesystem.list_directory(&path).await {
        Ok(listing) => {
            debug!("Directory listing successful");
            Ok(Json(ApiResponse::success(listing)))
        },
        Err(e) => {
            error!("Failed to list directory: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn read_file(
    Query(params): Query<ReadFileQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<FileContent>>, ServerError> {
    let path = PathBuf::from(params.path);
    info!("File read requested for: {}", path.display());

    match state.filesystem.read_file(&path).await {
        Ok(content) => Ok(Json(ApiResponse::success(content))),
        Err(e) => {
            error!("Failed to read file: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn save_file(
    State(state): State<AppState>,
    Json(request): Json<SaveFileRequest>
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
    Json(request): Json<CreateFileRequestPayload>
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
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    let path = PathBuf::from(params.path);
    info!("File deletion requested for: {}", path.display());

    // Check if it's a directory first and delete appropriately
    match state.filesystem.is_directory(&path).await {
        Ok(true) => {
            match state.filesystem.delete_directory(&path, true).await {
                Ok(_) => Ok(Json(ApiResponse::success(()))),
                Err(e) => {
                    error!("Failed to delete directory: {}", e);
                    Err(ServerError::from(e))
                }
            }
        }
        _ => {
            match state.filesystem.delete_file(&path).await {
                Ok(_) => Ok(Json(ApiResponse::success(()))),
                Err(e) => {
                    error!("Failed to delete file: {}", e);
                    Err(ServerError::from(e))
                }
            }
        }
    }
}

pub async fn rename_file(
    State(state): State<AppState>,
    Json(request): Json<RenameFileRequest>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("File rename requested from {} to {}", request.from_path, request.to_path);

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