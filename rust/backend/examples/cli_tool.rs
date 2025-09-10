use act_core::{
    error::CoreError,
    models::{Workspace, WorkspaceStatus},
    repository::{WorkspaceRepository, CreateWorkspaceRequest},
};
use act_domain::workspace_service::WorkspaceService;
use act_persistence::{workspace_repository_factory, database::DatabaseConnection};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("ACT CLI Tool - Demonstrating Domain Crate Usage");
    
    // This demonstrates that domain crates can be used independently
    // without any web framework dependencies
    
    // For this example, we'll create mock implementations
    let mock_repo = MockWorkspaceRepository::new();
    let workspace_service = WorkspaceService::new(Arc::new(mock_repo));
    
    // Create a workspace
    let create_request = CreateWorkspaceRequest {
        name: "test-workspace".to_string(),
        github_repo: Some("example/repo".to_string()),
        github_url: Some("https://github.com/example/repo".to_string()),
        is_active: true,
    };
    
    match workspace_service.create_workspace(create_request).await {
        Ok(workspace) => {
            println!("✅ Created workspace: {} (ID: {})", workspace.name, workspace.id);
        }
        Err(e) => {
            eprintln!("❌ Failed to create workspace: {:?}", e);
        }
    }
    
    // List workspaces
    match workspace_service.list_workspaces().await {
        Ok(workspaces) => {
            println!("📋 Found {} workspaces:", workspaces.len());
            for workspace in workspaces {
                println!("  - {} ({})", workspace.name, workspace.status);
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to list workspaces: {:?}", e);
        }
    }
    
    println!("🎉 CLI tool completed successfully - domain crates are extractable!");
    Ok(())
}

// Mock implementation for demonstration
struct MockWorkspaceRepository {
    workspaces: std::sync::Mutex<Vec<Workspace>>,
}

impl MockWorkspaceRepository {
    fn new() -> Self {
        Self {
            workspaces: std::sync::Mutex::new(Vec::new()),
        }
    }
}

#[async_trait::async_trait]
impl WorkspaceRepository for MockWorkspaceRepository {
    async fn create(&self, request: CreateWorkspaceRequest) -> Result<Workspace, CoreError> {
        let workspace = Workspace {
            id: uuid::Uuid::new_v4().to_string(),
            name: request.name,
            github_repo: request.github_repo,
            github_url: request.github_url,
            status: WorkspaceStatus::Active,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        
        self.workspaces.lock().unwrap().push(workspace.clone());
        Ok(workspace)
    }
    
    async fn find_by_id(&self, id: &str) -> Result<Option<Workspace>, CoreError> {
        let workspaces = self.workspaces.lock().unwrap();
        Ok(workspaces.iter().find(|w| w.id == id).cloned())
    }
    
    async fn find_all(&self) -> Result<Vec<Workspace>, CoreError> {
        Ok(self.workspaces.lock().unwrap().clone())
    }
    
    async fn update(&self, id: &str, name: Option<String>, is_active: Option<bool>) -> Result<Workspace, CoreError> {
        let mut workspaces = self.workspaces.lock().unwrap();
        if let Some(workspace) = workspaces.iter_mut().find(|w| w.id == id) {
            if let Some(new_name) = name {
                workspace.name = new_name;
            }
            if let Some(active) = is_active {
                workspace.status = if active { WorkspaceStatus::Active } else { WorkspaceStatus::Inactive };
            }
            workspace.updated_at = chrono::Utc::now();
            Ok(workspace.clone())
        } else {
            Err(CoreError::NotFound("Workspace not found".to_string()))
        }
    }
    
    async fn delete(&self, id: &str) -> Result<(), CoreError> {
        let mut workspaces = self.workspaces.lock().unwrap();
        if let Some(pos) = workspaces.iter().position(|w| w.id == id) {
            workspaces.remove(pos);
            Ok(())
        } else {
            Err(CoreError::NotFound("Workspace not found".to_string()))
        }
    }
}