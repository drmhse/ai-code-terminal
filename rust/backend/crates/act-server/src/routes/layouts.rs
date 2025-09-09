use crate::{
    models::ApiResponse,
    services::layout::{LayoutManager, LayoutType, LayoutPane, PanePosition, PaneSize, PaneType},
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
use tracing::{error, info};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_layouts))
        .route("/", post(create_layout))
        .route("/:layout_id", get(get_layout))
        .route("/:layout_id", put(update_layout))
        .route("/:layout_id", delete(delete_layout))
        .route("/:layout_id/panes", post(add_pane))
        .route("/:layout_id/panes/:pane_id", delete(remove_pane))
        .route("/:layout_id/panes/:pane_id/activate", post(activate_pane))
        .route("/:layout_id/resize", post(resize_layout))
}

#[derive(Debug, Deserialize)]
pub struct CreateLayoutRequest {
    pub name: String,
    pub layout_type: LayoutType,
    pub workspace_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLayoutRequest {
    #[allow(dead_code)]
    pub name: Option<String>,
    pub active_pane_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddPaneRequest {
    pub name: Option<String>,
    pub process_id: Option<String>,
    #[allow(dead_code)]
    pub working_directory: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ResizeLayoutRequest {
    pub width: u16,
    pub height: u16,
}

#[derive(Debug, Deserialize)]
pub struct ListLayoutsQuery {
    pub workspace_id: Option<String>,
}

pub async fn list_layouts(
    Query(params): Query<ListLayoutsQuery>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<Vec<crate::services::layout::TerminalLayout>>>, StatusCode> {
    info!("Layout list requested for workspace: {:?}", params.workspace_id);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    match layout_manager.list_layouts_for_workspace(&params.workspace_id.unwrap_or_default()).await {
        Ok(layouts) => Ok(Json(ApiResponse::success(layouts))),
        Err(e) => {
            error!("Failed to list layouts: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn create_layout(
    State(state): State<AppState>,
    Json(request): Json<CreateLayoutRequest>
) -> Result<Json<ApiResponse<crate::services::layout::TerminalLayout>>, StatusCode> {
    info!("Layout creation requested: {} (type: {:?})", request.name, request.layout_type);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    match layout_manager.create_layout(
        request.name, 
        request.layout_type,
        request.workspace_id.unwrap_or_default(),
        None
    ).await {
        Ok(layout) => {
            info!("Layout created successfully: {}", layout.id);
            Ok(Json(ApiResponse::success(layout)))
        },
        Err(e) => {
            error!("Failed to create layout: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_layout(
    Path(layout_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<crate::services::layout::TerminalLayout>>, StatusCode> {
    info!("Layout details requested: {}", layout_id);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    match layout_manager.get_layout(&layout_id).await {
        Ok(Some(layout)) => Ok(Json(ApiResponse::success(layout))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get layout {}: {}", layout_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_layout(
    Path(layout_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<UpdateLayoutRequest>
) -> Result<Json<ApiResponse<crate::services::layout::TerminalLayout>>, StatusCode> {
    info!("Layout update requested: {}", layout_id);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    // Get the existing layout first
    match layout_manager.get_layout(&layout_id).await {
        Ok(Some(layout)) => {
            // Update active pane if provided
            if let Some(active_pane_id) = request.active_pane_id {
                match layout_manager.set_active_pane(&layout_id, &active_pane_id).await {
                    Ok(_) => {
                        info!("Layout updated successfully: {}", layout_id);
                        Ok(Json(ApiResponse::success(layout)))
                    },
                    Err(e) => {
                        error!("Failed to update layout {}: {}", layout_id, e);
                        Err(StatusCode::INTERNAL_SERVER_ERROR)
                    }
                }
            } else {
                Ok(Json(ApiResponse::success(layout)))
            }
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to update layout {}: {}", layout_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn delete_layout(
    Path(layout_id): Path<String>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Layout deletion requested: {}", layout_id);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    match layout_manager.delete_layout(&layout_id).await {
        Ok(()) => {
            info!("Layout deleted successfully: {}", layout_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to delete layout {}: {}", layout_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn add_pane(
    Path(layout_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<AddPaneRequest>
) -> Result<Json<ApiResponse<crate::services::layout::TerminalPane>>, StatusCode> {
    info!("Pane addition requested for layout: {}", layout_id);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    let layout_pane = LayoutPane {
        id: uuid::Uuid::new_v4().to_string(),
        session_id: request.process_id,
        position: PanePosition { x: 0, y: 0, row: None, col: None },
        size: PaneSize { width: 80, height: 24, min_width: None, min_height: None },
        title: request.name.clone().unwrap_or_else(|| "Terminal".to_string()),
        is_active: true,
        pane_type: PaneType::Terminal,
    };
    
    match layout_manager.add_pane_to_layout(&layout_id, layout_pane.clone()).await {
        Ok(_) => {
            info!("Pane added successfully to layout {}", layout_id);
            // Create a default TerminalPane to return
            let terminal_pane = crate::services::layout::TerminalPane {
                id: layout_pane.id.clone(),
                session_id: layout_pane.session_id.clone(),
                name: Some(layout_pane.title.clone()),
                process_id: layout_pane.session_id.clone(),
                working_directory: None,
                shell: None,
                position: layout_pane.position.clone(),
                size: layout_pane.size.clone(),
                is_active: layout_pane.is_active,
            };
            Ok(Json(ApiResponse::success(terminal_pane)))
        },
        Err(e) => {
            error!("Failed to add pane to layout {}: {}", layout_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn remove_pane(
    Path((layout_id, pane_id)): Path<(String, String)>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Pane removal requested: {} from layout {}", pane_id, layout_id);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    match layout_manager.remove_pane_from_layout(&layout_id, &pane_id).await {
        Ok(()) => {
            info!("Pane removed successfully: {} from layout {}", pane_id, layout_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to remove pane {} from layout {}: {}", pane_id, layout_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn activate_pane(
    Path((layout_id, pane_id)): Path<(String, String)>,
    State(state): State<AppState>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Pane activation requested: {} in layout {}", pane_id, layout_id);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    match layout_manager.set_active_pane(&layout_id, &pane_id).await {
        Ok(()) => {
            info!("Pane activated successfully: {} in layout {}", pane_id, layout_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to activate pane {} in layout {}: {}", pane_id, layout_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn resize_layout(
    Path(layout_id): Path<String>,
    State(state): State<AppState>,
    Json(request): Json<ResizeLayoutRequest>
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    info!("Layout resize requested: {} ({}x{})", layout_id, request.width, request.height);
    
    let layout_manager = LayoutManager::new(state.db.clone());
    
    match layout_manager.resize_layout(&layout_id, request.width, request.height).await {
        Ok(()) => {
            info!("Layout resized successfully: {}", layout_id);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to resize layout {}: {}", layout_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}