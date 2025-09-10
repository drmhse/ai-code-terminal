use crate::{
    models::ApiResponse,
    AppState,
    error::ServerError,
};

use axum::{
    extract::{Path, Query, State},
    response::Json,
    routing::{get, post, put, delete},
    Router,
};
use serde::Deserialize;
use tracing::info;

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub github_repo: Option<String>,
    pub github_url: Option<String>,
    #[allow(dead_code)]
    pub local_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListWorkspacesQuery {
    #[allow(dead_code)]
    pub active_only: Option<bool>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_workspaces))
        .route("/", post(create_workspace))
        .route("/:workspace_id", get(get_workspace))
        .route("/:workspace_id", put(update_workspace))
        .route("/:workspace_id", delete(delete_workspace))
}

pub async fn list_workspaces(
    Query(_params): Query<ListWorkspacesQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<act_core::repository::Workspace>>>, ServerError> {
    info!("Workspace list requested");
    
    let workspaces = state.domain_services.workspace_service
        .list_workspaces(true) // active_only
        .await?;
    
    Ok(Json(ApiResponse::success(workspaces)))
}

pub async fn create_workspace(
    State(state): State<AppState>,
    Json(request): Json<CreateWorkspaceRequest>
) -> Result<Json<ApiResponse<act_core::repository::Workspace>>, ServerError> {
    info!("Workspace creation requested: {}", request.name);
    
    let workspace = state.domain_services.workspace_service
        .create_workspace(
            request.name,
            request.github_repo,
            request.github_url
        )
        .await?;
    
    info!("Workspace created successfully: {}", workspace.id);
    Ok(Json(ApiResponse::success(workspace)))
}

pub async fn get_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<act_core::repository::Workspace>>, ServerError> {
    info!("Workspace details requested: {}", workspace_id);
    
    let workspace = state.domain_services.workspace_service
        .get_workspace(&workspace_id)
        .await?;
    
    Ok(Json(ApiResponse::success(workspace)))
}

pub async fn update_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<UpdateWorkspaceRequest>
) -> Result<Json<ApiResponse<act_core::repository::Workspace>>, ServerError> {
    info!("Workspace update requested: {}", workspace_id);
    
    let workspace = state.domain_services.workspace_service
        .update_workspace(&workspace_id, request.name, request.is_active)
        .await?;
    
    info!("Workspace updated successfully: {}", workspace_id);
    Ok(Json(ApiResponse::success(workspace)))
}

pub async fn delete_workspace(
    Path(workspace_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Workspace deletion requested: {}", workspace_id);
    
    state.domain_services.workspace_service
        .delete_workspace(&workspace_id)
        .await?;
    
    info!("Workspace deleted successfully: {}", workspace_id);
    Ok(Json(ApiResponse::success(())))
}
