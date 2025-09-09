use crate::{
    models::ApiResponse,
    services::FileSystemService,
    AppState,
};
use axum::{
    extract::{Path, Query, State},
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
    pub old_path: String,
    pub new_path: String,
}

pub async fn rename_file(
    State(_state): State<AppState>,
    Json(request): Json<RenameFileRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File rename requested: {} -> {}", request.old_path, request.new_path);

    // Create filesystem service with workspace root
    let workspace_root = std::path::PathBuf::from("./workspaces");
    let fs_service = FileSystemService::new(workspace_root);

    match fs_service.rename_item(&request.old_path, &request.new_path).await {
        Ok(_) => {
            info!("File rename successful: {} -> {}", request.old_path, request.new_path);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to rename file {} -> {}: {}", request.old_path, request.new_path, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Workspace-scoped file handlers

pub async fn list_directory_workspace(
    Path(workspace_id): Path<String>,
    Query(params): Query<ListDirectoryQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<crate::services::filesystem::FileItem>>>, StatusCode> {
    let path = params.path.unwrap_or_else(|| "./".to_string());

    info!("Directory listing requested for workspace {}: {}", workspace_id, path);

    // Get workspace details to find the actual path
    use crate::services::workspace::WorkspaceService;
    let workspace_service = WorkspaceService::new(state.db.clone(), std::path::PathBuf::from("./workspaces"));

    let workspace = match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(ws)) => ws,
        Ok(None) => {
            error!("Workspace not found: {}", workspace_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Create filesystem service with specific workspace root
    let workspace_path = match std::path::PathBuf::from(&workspace.path).canonicalize() {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to canonicalize workspace path {}: {}", workspace.path, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let fs_service = FileSystemService::new(workspace_path);

    match fs_service.list_directory(&path).await {
        Ok(listing) => {
            debug!("Directory listing successful: {} items", listing.total_count);

            // Convert DirectoryListing to Vec<FileItem>
            let mut items: Vec<crate::services::filesystem::FileItem> = Vec::new();

            // Add directories first
            for dir in listing.directories {
                items.push(crate::services::filesystem::FileItem::from(dir));
            }

            // Add files
            for file in listing.files {
                items.push(crate::services::filesystem::FileItem::from(file));
            }

            Ok(Json(ApiResponse::success(items)))
        }
        Err(e) => {
            error!("Failed to list directory {} in workspace {}: {}", path, workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn read_file_workspace(
    Path(workspace_id): Path<String>,
    Query(params): Query<ReadFileQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<crate::services::filesystem::FileContent>>, StatusCode> {
    info!("File read requested for workspace {}: {}", workspace_id, params.path);

    // Get workspace details
    use crate::services::workspace::WorkspaceService;
    let workspace_service = WorkspaceService::new(state.db.clone(), std::path::PathBuf::from("./workspaces"));

    let workspace = match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(ws)) => ws,
        Ok(None) => {
            error!("Workspace not found: {}", workspace_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let workspace_path = match std::path::PathBuf::from(&workspace.path).canonicalize() {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to canonicalize workspace path {}: {}", workspace.path, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let fs_service = FileSystemService::new(workspace_path);

    match fs_service.read_file(&params.path).await {
        Ok(content) => {
            debug!("File read successful: {} ({} bytes)", params.path, content.size);
            Ok(Json(ApiResponse::success(content)))
        }
        Err(e) => {
            error!("Failed to read file {} in workspace {}: {}", params.path, workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn save_file_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<SaveFileRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File save requested for workspace {}: {}", workspace_id, request.path);

    // Get workspace details
    use crate::services::workspace::WorkspaceService;
    let workspace_service = WorkspaceService::new(state.db.clone(), std::path::PathBuf::from("./workspaces"));

    let workspace = match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(ws)) => ws,
        Ok(None) => {
            error!("Workspace not found: {}", workspace_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let workspace_path = match std::path::PathBuf::from(&workspace.path).canonicalize() {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to canonicalize workspace path {}: {}", workspace.path, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let fs_service = FileSystemService::new(workspace_path);

    match fs_service.write_file(&request.path, &request.content).await {
        Ok(_) => {
            info!("File save successful: {} ({} bytes)", request.path, request.content.len());
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to save file {} in workspace {}: {}", request.path, workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn create_file_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<CreateFileRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File creation requested for workspace {}: {}", workspace_id, request.path);

    // Get workspace details
    use crate::services::workspace::WorkspaceService;
    let workspace_service = WorkspaceService::new(state.db.clone(), std::path::PathBuf::from("./workspaces"));

    let workspace = match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(ws)) => ws,
        Ok(None) => {
            error!("Workspace not found: {}", workspace_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let workspace_path = match std::path::PathBuf::from(&workspace.path).canonicalize() {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to canonicalize workspace path {}: {}", workspace.path, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let fs_service = FileSystemService::new(workspace_path);

    match &request.r#type[..] {
        "file" => {
            match fs_service.write_file(&request.path, &request.content.unwrap_or_default()).await {
                Ok(_) => {
                    info!("File creation successful: {}", request.path);
                    Ok(Json(ApiResponse::success(())))
                }
                Err(e) => {
                    error!("Failed to create file {} in workspace {}: {}", request.path, workspace_id, e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
        "directory" => {
            match fs_service.create_directory(&request.path).await {
                Ok(_) => {
                    info!("Directory creation successful: {}", request.path);
                    Ok(Json(ApiResponse::success(())))
                }
                Err(e) => {
                    error!("Failed to create directory {} in workspace {}: {}", request.path, workspace_id, e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
        _ => {
            error!("Invalid file type: {}", request.r#type);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

pub async fn delete_file_workspace(
    Path(workspace_id): Path<String>,
    Query(params): Query<ReadFileQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File deletion requested for workspace {}: {}", workspace_id, params.path);

    // Get workspace details
    use crate::services::workspace::WorkspaceService;
    let workspace_service = WorkspaceService::new(state.db.clone(), std::path::PathBuf::from("./workspaces"));

    let workspace = match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(ws)) => ws,
        Ok(None) => {
            error!("Workspace not found: {}", workspace_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let workspace_path = match std::path::PathBuf::from(&workspace.path).canonicalize() {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to canonicalize workspace path {}: {}", workspace.path, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let fs_service = FileSystemService::new(workspace_path);

    match fs_service.delete_item(&params.path).await {
        Ok(_) => {
            info!("File deletion successful: {}", params.path);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to delete file {} in workspace {}: {}", params.path, workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn rename_file_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<RenameFileRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("File rename requested for workspace {}: {} -> {}", workspace_id, request.old_path, request.new_path);

    // Get workspace details
    use crate::services::workspace::WorkspaceService;
    let workspace_service = WorkspaceService::new(state.db.clone(), std::path::PathBuf::from("./workspaces"));

    let workspace = match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(ws)) => ws,
        Ok(None) => {
            error!("Workspace not found: {}", workspace_id);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let workspace_path = match std::path::PathBuf::from(&workspace.path).canonicalize() {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to canonicalize workspace path {}: {}", workspace.path, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let fs_service = FileSystemService::new(workspace_path);

    match fs_service.rename_item(&request.old_path, &request.new_path).await {
        Ok(_) => {
            info!("File rename successful in workspace {}: {} -> {}", workspace_id, request.old_path, request.new_path);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to rename file {} -> {} in workspace {}: {}", request.old_path, request.new_path, workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
