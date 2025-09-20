use crate::{
    models::ApiResponse,
    middleware::auth::AuthenticatedUser,
    AppState,
    error::ServerError,
};

use axum::{
    extract::{Path, Query, State},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error};

#[derive(Debug, Deserialize)]
pub struct CreateLayoutRequest {
    pub name: String,
    pub layout_type: String,
    pub tree_structure: String, // Required JSON string of hierarchical layout
    pub is_default: Option<bool>,
    pub workspace_id: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLayoutRequest {
    pub name: Option<String>,
    pub tree_structure: Option<String>, // JSON string of hierarchical layout
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListLayoutsQuery {
    pub workspace_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LayoutResponse {
    pub id: String,
    pub name: String,
    pub layout_type: String,
    pub tree_structure: String, // JSON string of hierarchical layout
    pub is_default: bool,
    pub workspace_id: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<act_core::models::TerminalLayout> for LayoutResponse {
    fn from(layout: act_core::models::TerminalLayout) -> Self {
        Self {
            id: layout.id,
            name: layout.name,
            layout_type: layout.layout_type,
            tree_structure: layout.tree_structure,
            is_default: layout.is_default,
            workspace_id: layout.workspace_id,
            created_at: layout.created_at.to_rfc3339(),
            updated_at: layout.updated_at.to_rfc3339(),
        }
    }
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_layouts).post(create_layout))
        .route("/:id", get(get_layout).put(update_layout).delete(delete_layout))
        .route("/:id/default", post(set_default_layout))
        .route("/:id/duplicate", post(duplicate_layout))
}

async fn list_layouts(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Query(params): Query<ListLayoutsQuery>,
) -> Result<Json<ApiResponse<Vec<LayoutResponse>>>, ServerError> {
    info!("Listing layouts for user {}", user.user_id);

    let layouts = if let Some(workspace_id) = &params.workspace_id {
        state.domain_services.layout_service
            .list_workspace_layouts(&user.user_id, workspace_id)
            .await
    } else {
        state.domain_services.layout_service
            .list_all_layouts(&user.user_id)
            .await
    }?;

    let layout_responses: Vec<LayoutResponse> = layouts.into_iter().map(LayoutResponse::from).collect();

    Ok(Json(ApiResponse::success(layout_responses)))
}

async fn create_layout(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Json(request): Json<CreateLayoutRequest>,
) -> Result<Json<ApiResponse<LayoutResponse>>, ServerError> {
    info!("Creating layout '{}' for user {}", request.name, user.user_id);

    let domain_request = act_core::repository::CreateLayoutRequest {
        name: request.name,
        layout_type: request.layout_type,
        tree_structure: request.tree_structure,
        is_default: request.is_default,
        workspace_id: request.workspace_id,
    };

    let layout = state.domain_services.layout_service
        .create_layout(&user.user_id, domain_request)
        .await?;

    Ok(Json(ApiResponse::success(LayoutResponse::from(layout))))
}

async fn get_layout(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<LayoutResponse>>, ServerError> {
    info!("Getting layout {} for user {}", id, user.user_id);

    let layout = state.domain_services.layout_service
        .get_layout(&user.user_id, &id)
        .await?;

    Ok(Json(ApiResponse::success(LayoutResponse::from(layout))))
}

async fn update_layout(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
    Json(request): Json<UpdateLayoutRequest>,
) -> Result<Json<ApiResponse<LayoutResponse>>, ServerError> {
    info!("Updating layout {} for user {}", id, user.user_id);

    let domain_request = act_core::repository::UpdateLayoutRequest {
        name: request.name,
        tree_structure: request.tree_structure,
        is_default: request.is_default,
    };

    let layout = state.domain_services.layout_service
        .update_layout(&user.user_id, &id, domain_request)
        .await?;

    Ok(Json(ApiResponse::success(LayoutResponse::from(layout))))
}

async fn delete_layout(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Deleting layout {} for user {}", id, user.user_id);

    state.domain_services.layout_service
        .delete_layout(&user.user_id, &id)
        .await?;

    Ok(Json(ApiResponse::success(())))
}

async fn set_default_layout(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Setting layout {} as default for user {}", id, user.user_id);

    // First, get the layout to find its workspace_id
    let layout = state.domain_services.layout_service
        .get_layout(&user.user_id, &id)
        .await?;

    state.domain_services.layout_service
        .set_default_layout(&user.user_id, &id, &layout.workspace_id)
        .await?;

    Ok(Json(ApiResponse::success(())))
}

async fn duplicate_layout(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(id): Path<String>,
    Json(request): Json<serde_json::Value>, // Optional new_name in request body
) -> Result<Json<ApiResponse<LayoutResponse>>, ServerError> {
    info!("Duplicating layout {} for user {}", id, user.user_id);

    let new_name = request.get("name").and_then(|v| v.as_str()).map(|name| name.to_string());

    let layout = state.domain_services.layout_service
        .duplicate_layout(&user.user_id, &id, new_name)
        .await?;

    Ok(Json(ApiResponse::success(LayoutResponse::from(layout))))
}