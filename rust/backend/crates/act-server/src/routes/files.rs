use crate::{
    models::ApiResponse,
    services::FileSystemService,
    AppState,
};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put, patch, delete},
    Router,
};
use serde::Deserialize;
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

pub async fn list_directory(
    Query(params): Query<ListDirectoryQuery>,
    State(_state): State<AppState>
) -> Result<Json<ApiResponse<Vec<crate::services::filesystem::FileItem>>>, StatusCode> {
    let path = params.path.unwrap_or_else(|| "./".to_string());
    
    info!("Directory listing requested for: {}", path);
    
    // Create filesystem service with workspace root
    let workspace_root = std::path::PathBuf::from("./workspaces");
    let fs_service = FileSystemService::new(workspace_root);
    
    match fs_service.list_directory(&path).await {
        Ok(listing) => {
            debug!("Directory listing successful: {} items", listing.total_count);
            
            // Convert DirectoryListing to Vec<FileItem>
            let mut items: Vec<crate::services::filesystem::FileItem> = Vec::new();
            
            // Add directories first
            for dir_entry in listing.directories {
                items.push(dir_entry.into());
            }
            
            // Add files
            for file_entry in listing.files {
                items.push(file_entry.into());
            }
            
            Ok(Json(ApiResponse::success(items)))
        }
        Err(e) => {
            error!("Failed to list directory {}: {}", path, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ReadFileQuery {
    pub path: String,
}

pub async fn read_file(
    Query(params): Query<ReadFileQuery>,
    State(_state): State<AppState>
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    info!("File read requested for: {}", params.path);
    
    // Create filesystem service with workspace root
    let workspace_root = std::path::PathBuf::from("./workspaces");
    let fs_service = FileSystemService::new(workspace_root);
    
    match fs_service.read_file(&params.path).await {
        Ok(content) => {
            debug!("File read successful: {} bytes", content.content.len());
            Ok(Json(ApiResponse::success(content.content)))
        }
        Err(e) => {
            error!("Failed to read file {}: {}", params.path, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SaveFileRequest {
    pub path: String,
    pub content: String,
}

pub async fn save_file(
    State(_state): State<AppState>,
    Json(request): Json<SaveFileRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File save requested for: {}", request.path);
    
    // Create filesystem service with workspace root
    let workspace_root = std::path::PathBuf::from("./workspaces");
    let fs_service = FileSystemService::new(workspace_root);
    
    match fs_service.write_file(&request.path, &request.content).await {
        Ok(_) => {
            info!("File save successful: {}", request.path);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to save file {}: {}", request.path, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateFileRequest {
    pub path: String,
    pub content: Option<String>,
    pub r#type: String,
}

pub async fn create_file(
    State(_state): State<AppState>,
    Json(request): Json<CreateFileRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File creation requested for: {}", request.path);
    
    // Create filesystem service with workspace root
    let workspace_root = std::path::PathBuf::from("./workspaces");
    let fs_service = FileSystemService::new(workspace_root);
    
    if request.r#type == "directory" {
        match fs_service.create_directory(&request.path).await {
            Ok(_) => {
                info!("Directory creation successful: {}", request.path);
                Ok(Json(ApiResponse::success(())))
            }
            Err(e) => {
                error!("Failed to create directory {}: {}", request.path, e);
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    } else {
        let content = request.content.unwrap_or_default();
        match fs_service.write_file(&request.path, &content).await {
            Ok(_) => {
                info!("File creation successful: {}", request.path);
                Ok(Json(ApiResponse::success(())))
            }
            Err(e) => {
                error!("Failed to create file {}: {}", request.path, e);
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    }
}

pub async fn delete_file(
    Query(params): Query<ReadFileQuery>,
    State(_state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File deletion requested for: {}", params.path);
    
    // Create filesystem service with workspace root
    let workspace_root = std::path::PathBuf::from("./workspaces");
    let fs_service = FileSystemService::new(workspace_root);
    
    match fs_service.delete_item(&params.path).await {
        Ok(_) => {
            info!("File deletion successful: {}", params.path);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to delete file {}: {}", params.path, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct RenameFileRequest {
    pub oldPath: String,
    pub newPath: String,
}

pub async fn rename_file(
    State(_state): State<AppState>,
    Json(request): Json<RenameFileRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File rename requested: {} -> {}", request.oldPath, request.newPath);
    
    // Create filesystem service with workspace root
    let workspace_root = std::path::PathBuf::from("./workspaces");
    let fs_service = FileSystemService::new(workspace_root);
    
    match fs_service.rename_item(&request.oldPath, &request.newPath).await {
        Ok(_) => {
            info!("File rename successful: {} -> {}", request.oldPath, request.newPath);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to rename file {} -> {}: {}", request.oldPath, request.newPath, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

