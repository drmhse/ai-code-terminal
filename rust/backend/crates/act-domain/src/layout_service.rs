use std::sync::Arc;
use act_core::{
    repository::{
        LayoutRepository, CreateLayoutRequest, UpdateLayoutRequest, LayoutId, WorkspaceId
    },
    models::TerminalLayout,
    Result
};
use tracing::{info, error};

#[derive(Clone)]
pub struct LayoutService {
    layout_repository: Arc<dyn LayoutRepository>,
}

impl LayoutService {
    pub fn new(layout_repository: Arc<dyn LayoutRepository>) -> Self {
        Self {
            layout_repository,
        }
    }

    pub async fn create_layout(
        &self,
        user_id: &str,
        request: CreateLayoutRequest,
    ) -> Result<TerminalLayout> {
        info!("Creating layout '{}' for user {}", request.name, user_id);
        
        let layout = self.layout_repository.create(user_id, request).await
            .map_err(|e| {
                error!("Failed to create layout: {}", e);
                e
            })?;
        
        info!("Successfully created layout {} with id {}", layout.name, layout.id);
        Ok(layout)
    }

    pub async fn get_layout(
        &self,
        user_id: &str,
        layout_id: &LayoutId,
    ) -> Result<TerminalLayout> {
        let layout = self.layout_repository.get_by_id(user_id, layout_id).await
            .map_err(|e| {
                error!("Failed to get layout {}: {}", layout_id, e);
                e
            })?;
        
        Ok(layout)
    }

    pub async fn list_workspace_layouts(
        &self,
        user_id: &str,
        workspace_id: &WorkspaceId,
    ) -> Result<Vec<TerminalLayout>> {
        let layouts = self.layout_repository.list_for_workspace(user_id, workspace_id).await
            .map_err(|e| {
                error!("Failed to list layouts for workspace {}: {}", workspace_id, e);
                e
            })?;
        
        Ok(layouts)
    }

    pub async fn list_all_layouts(
        &self,
        user_id: &str,
    ) -> Result<Vec<TerminalLayout>> {
        let layouts = self.layout_repository.list_all(user_id).await
            .map_err(|e| {
                error!("Failed to list all layouts for user {}: {}", user_id, e);
                e
            })?;
        
        Ok(layouts)
    }

    pub async fn update_layout(
        &self,
        user_id: &str,
        layout_id: &LayoutId,
        request: UpdateLayoutRequest,
    ) -> Result<TerminalLayout> {
        info!("Updating layout {} for user {}", layout_id, user_id);
        
        let layout = self.layout_repository.update(user_id, layout_id, request).await
            .map_err(|e| {
                error!("Failed to update layout {}: {}", layout_id, e);
                e
            })?;
        
        info!("Successfully updated layout {}", layout_id);
        Ok(layout)
    }

    pub async fn delete_layout(
        &self,
        user_id: &str,
        layout_id: &LayoutId,
    ) -> Result<()> {
        info!("Deleting layout {} for user {}", layout_id, user_id);
        
        self.layout_repository.delete(user_id, layout_id).await
            .map_err(|e| {
                error!("Failed to delete layout {}: {}", layout_id, e);
                e
            })?;
        
        info!("Successfully deleted layout {}", layout_id);
        Ok(())
    }

    pub async fn set_default_layout(
        &self,
        user_id: &str,
        layout_id: &LayoutId,
        workspace_id: &WorkspaceId,
    ) -> Result<()> {
        info!("Setting layout {} as default for workspace {} and user {}", layout_id, workspace_id, user_id);
        
        self.layout_repository.set_default(user_id, layout_id, workspace_id).await
            .map_err(|e| {
                error!("Failed to set default layout {} for workspace {}: {}", layout_id, workspace_id, e);
                e
            })?;
        
        info!("Successfully set layout {} as default for workspace {}", layout_id, workspace_id);
        Ok(())
    }

    pub async fn get_default_layout(
        &self,
        user_id: &str,
        workspace_id: &WorkspaceId,
    ) -> Result<Option<TerminalLayout>> {
        let layouts = self.list_workspace_layouts(user_id, workspace_id).await?;
        
        let default_layout = layouts.into_iter()
            .find(|layout| layout.is_default);
        
        Ok(default_layout)
    }

    pub async fn duplicate_layout(
        &self,
        user_id: &str,
        layout_id: &LayoutId,
        new_name: Option<String>,
    ) -> Result<TerminalLayout> {
        let original_layout = self.get_layout(user_id, layout_id).await?;
        
        let name = new_name.unwrap_or_else(|| format!("{} (Copy)", original_layout.name));
        
        let create_request = CreateLayoutRequest {
            name,
            layout_type: original_layout.layout_type.clone(),
            tree_structure: original_layout.tree_structure.clone(),
            is_default: Some(false), // Never duplicate as default
            workspace_id: original_layout.workspace_id.clone(),
        };
        
        self.create_layout(user_id, create_request).await
    }
}