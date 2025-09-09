use crate::{
    models::ApiResponse,
    services::workspace::{WorkspaceService, Workspace, CloneRequest, WorkspaceSettings, GitStatus, GitCommit},
    services::{GitHubService, SettingsService},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put, delete},
    Router,
};
use serde::Deserialize;
use std::path::PathBuf;
use tracing::{error, info, warn};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_workspaces))
        .route("/", post(create_workspace))
        .route("/:workspace_id", get(get_workspace))
        .route("/:workspace_id", put(update_workspace))
        .route("/:workspace_id", delete(delete_workspace))
        .route("/clone", post(clone_repository))
        .route("/:workspace_id/git/status", get(get_git_status))
        .route("/:workspace_id/git/history", get(get_git_history))
        .route("/:workspace_id/access", post(update_last_accessed))
        .route("/:workspace_id/sessions", get(get_workspace_sessions))
        .route("/:workspace_id/files", get(crate::routes::files::list_directory_workspace))
        .route("/:workspace_id/files/content", get(crate::routes::files::read_file_workspace))
        .route("/:workspace_id/files/content", put(crate::routes::files::save_file_workspace))
        .route("/:workspace_id/files", post(crate::routes::files::create_file_workspace))
        .route("/:workspace_id/files", delete(crate::routes::files::delete_file_workspace))
        .route("/:workspace_id/files/rename", put(crate::routes::files::rename_file_workspace))
}

#[derive(Debug, Deserialize)]
pub struct ListWorkspacesQuery {
    pub owner_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub settings: Option<WorkspaceSettings>,
}

#[derive(Debug, Deserialize)]
pub struct GitHistoryQuery {
    pub limit: Option<usize>,
}

pub async fn list_workspaces(
    Query(params): Query<ListWorkspacesQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<Workspace>>>, StatusCode> {
    info!("Workspace list requested for owner: {:?}", params.owner_id);
    
    // TODO: Get workspace root from configuration
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    match workspace_service.list_workspaces(params.owner_id.as_deref()).await {
        Ok(workspaces) => Ok(Json(ApiResponse::success(workspaces))),
        Err(e) => {
            error!("Failed to list workspaces: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn create_workspace(
    State(state): State<AppState>,
    Json(request): Json<CreateWorkspaceRequest>
) -> Result<Json<ApiResponse<Workspace>>, StatusCode> {
    info!("Workspace creation requested: {}", request.name);
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    let workspace = Workspace {
        id: String::new(), // Will be set by service
        name: request.name,
        description: request.description,
        path: String::new(), // Will be set by service
        git_url: None,
        git_branch: None,
        git_commit: None,
        is_git_repo: false,
        owner_id: request.owner_id,
        created_at: 0, // Will be set by service
        updated_at: 0, // Will be set by service
        last_accessed: None,
        settings: WorkspaceSettings::default(),
    };
    
    match workspace_service.create_workspace(workspace).await {
        Ok(workspace) => {
            info!("Workspace created successfully: {}", workspace.id);
            Ok(Json(ApiResponse::success(workspace)))
        },
        Err(e) => {
            error!("Failed to create workspace: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Workspace>>, StatusCode> {
    info!("Workspace details requested: {}", workspace_id);
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(workspace)) => Ok(Json(ApiResponse::success(workspace))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<UpdateWorkspaceRequest>
) -> Result<Json<ApiResponse<Workspace>>, StatusCode> {
    info!("Workspace update requested: {}", workspace_id);
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    match workspace_service.update_workspace(
        &workspace_id,
        request.name,
        request.description,
        request.settings
    ).await {
        Ok(workspace) => {
            info!("Workspace updated successfully: {}", workspace_id);
            Ok(Json(ApiResponse::success(workspace)))
        },
        Err(e) => {
            error!("Failed to update workspace {}: {}", workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn delete_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Workspace deletion requested: {}", workspace_id);
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    match workspace_service.delete_workspace(&workspace_id).await {
        Ok(()) => {
            info!("Workspace deleted successfully: {}", workspace_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to delete workspace {}: {}", workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn clone_repository(
    State(state): State<AppState>,
    Json(request): Json<CloneRequest>
) -> Result<Json<ApiResponse<Workspace>>, StatusCode> {
    info!("Repository clone requested: {} -> {}", request.git_url, request.name);
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    // Try to get GitHub token if available for private repositories
    let access_token = if let Ok(github_service) = GitHubService::new(std::sync::Arc::new(state.config.clone())) {
        let settings_service = SettingsService::new(state.db.clone());
        match settings_service.get_github_token(&github_service).await {
            Ok(Some(token)) => Some(token),
            Ok(None) => {
                info!("No GitHub token found, proceeding without authentication");
                None
            }
            Err(e) => {
                warn!("Failed to get GitHub token: {}, proceeding without authentication", e);
                None
            }
        }
    } else {
        info!("GitHub service not configured, proceeding without authentication");
        None
    };
    
    // Clone with or without authentication
    let result = if let Some(token) = access_token {
        workspace_service.clone_repository(request, &token).await
    } else {
        // For public repos or when no token is available, try without authentication
        workspace_service.clone_repository_without_auth(request).await
    };
    
    match result {
        Ok(workspace) => {
            info!("Repository cloned successfully: {}", workspace.id);
            Ok(Json(ApiResponse::success(workspace)))
        },
        Err(e) => {
            error!("Failed to clone repository: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_git_status(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<GitStatus>>, StatusCode> {
    info!("Git status requested for workspace: {}", workspace_id);
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    // Get workspace to verify it exists and get path
    match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(workspace)) => {
            if !workspace.is_git_repo {
                return Err(StatusCode::BAD_REQUEST);
            }
            
            let workspace_path = PathBuf::from(&workspace.path);
            match workspace_service.get_git_status(&workspace_path).await {
                Ok(status) => Ok(Json(ApiResponse::success(status))),
                Err(e) => {
                    error!("Failed to get git status for workspace {}: {}", workspace_id, e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_git_history(
    Path(workspace_id): Path<String>,
    Query(params): Query<GitHistoryQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<GitCommit>>>, StatusCode> {
    info!("Git history requested for workspace: {}", workspace_id);
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    let limit = params.limit.unwrap_or(20);
    
    // Get workspace to verify it exists and get path
    match workspace_service.get_workspace(&workspace_id).await {
        Ok(Some(workspace)) => {
            if !workspace.is_git_repo {
                return Err(StatusCode::BAD_REQUEST);
            }
            
            let workspace_path = PathBuf::from(&workspace.path);
            match workspace_service.get_git_history(&workspace_path, limit).await {
                Ok(history) => Ok(Json(ApiResponse::success(history))),
                Err(e) => {
                    error!("Failed to get git history for workspace {}: {}", workspace_id, e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get workspace {}: {}", workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_last_accessed(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Updating last accessed for workspace: {}", workspace_id);
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    match workspace_service.update_last_accessed(&workspace_id).await {
        Ok(()) => {
            info!("Last accessed updated for workspace: {}", workspace_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to update last accessed for workspace {}: {}", workspace_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_workspace_sessions(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<crate::models::Session>>>, StatusCode> {
    info!("Workspace sessions requested for workspace: {}", workspace_id);
    
    match sqlx::query_as::<_, crate::models::Session>(
        "SELECT * FROM sessions WHERE workspace_id = ?1 AND status != 'terminated' ORDER BY last_activity_at DESC"
    )
    .bind(&workspace_id)
    .fetch_all(state.db.pool())
    .await
    {
        Ok(sessions) => {
            info!("Retrieved {} sessions for workspace {}", sessions.len(), workspace_id);
            Ok(Json(ApiResponse::success(sessions)))
        }
        Err(err) => {
            error!("Failed to fetch sessions for workspace {}: {}", workspace_id, err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}