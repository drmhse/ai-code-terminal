use act_core::{
    error::CoreError,
    repository::{Workspace, WorkspaceRepository, CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceId},
};
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "act-cli")]
#[command(about = "A CLI tool demonstrating ACT domain crate extractability")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    CreateWorkspace {
        name: String,
        #[arg(long)]
        github_repo: Option<String>,
    },
    ListWorkspaces,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    
    println!("🚀 ACT CLI Tool - Demonstrating Domain Crate Usage");
    
    // Create mock repository
    let mock_repo = MockWorkspaceRepository::new();
    
    match cli.command {
        Commands::CreateWorkspace { name, github_repo } => {
            let repo = github_repo.unwrap_or_else(|| "example/repo".to_string());
            let create_request = CreateWorkspaceRequest {
                name: name.clone(),
                github_repo: repo.clone(),
                github_url: format!("https://github.com/{}", repo),
                local_path: Some(format!("/tmp/{}", name)),
            };
            
            match mock_repo.create(create_request).await {
                Ok(workspace) => {
                    println!("✅ Created workspace: {} (ID: {})", workspace.name, workspace.id);
                }
                Err(e) => {
                    eprintln!("❌ Failed to create workspace: {:?}", e);
                    return Err(e.into());
                }
            }
        }
        Commands::ListWorkspaces => {
            match mock_repo.list_all().await {
                Ok(workspaces) => {
                    println!("📋 Found {} workspaces:", workspaces.len());
                    for workspace in workspaces {
                        println!("  - {} (active: {})", workspace.name, workspace.is_active);
                    }
                }
                Err(e) => {
                    eprintln!("❌ Failed to list workspaces: {:?}", e);
                    return Err(e.into());
                }
            }
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
        let workspaces = vec![Workspace {
            id: uuid::Uuid::new_v4().to_string(),
            name: "sample-project".to_string(),
            github_repo: "example/sample-project".to_string(),
            github_url: "https://github.com/example/sample-project".to_string(),
            local_path: "/tmp/sample-project".to_string(),
            is_active: true,
            last_sync_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }];
        
        Self {
            workspaces: std::sync::Mutex::new(workspaces),
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
            local_path: request.local_path.unwrap_or_else(|| "/tmp/default".to_string()),
            is_active: true,
            last_sync_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        
        self.workspaces.lock().unwrap().push(workspace.clone());
        Ok(workspace)
    }
    
    async fn get_by_id(&self, id: &WorkspaceId) -> Result<Workspace, CoreError> {
        let workspaces = self.workspaces.lock().unwrap();
        workspaces.iter().find(|w| &w.id == id).cloned()
            .ok_or_else(|| CoreError::NotFound("Workspace not found".to_string()))
    }
    
    async fn get_by_github_repo(&self, repo: &str) -> Result<Option<Workspace>, CoreError> {
        let workspaces = self.workspaces.lock().unwrap();
        Ok(workspaces.iter().find(|w| w.github_repo == repo).cloned())
    }
    
    async fn list_all(&self) -> Result<Vec<Workspace>, CoreError> {
        Ok(self.workspaces.lock().unwrap().clone())
    }
    
    async fn list_active(&self) -> Result<Vec<Workspace>, CoreError> {
        let workspaces = self.workspaces.lock().unwrap();
        Ok(workspaces.iter().filter(|w| w.is_active).cloned().collect())
    }
    
    async fn update(&self, id: &WorkspaceId, request: UpdateWorkspaceRequest) -> Result<Workspace, CoreError> {
        let mut workspaces = self.workspaces.lock().unwrap();
        if let Some(workspace) = workspaces.iter_mut().find(|w| &w.id == id) {
            if let Some(new_name) = request.name {
                workspace.name = new_name;
            }
            if let Some(active) = request.is_active {
                workspace.is_active = active;
            }
            workspace.updated_at = chrono::Utc::now();
            Ok(workspace.clone())
        } else {
            Err(CoreError::NotFound("Workspace not found".to_string()))
        }
    }
    
    async fn delete(&self, id: &WorkspaceId) -> Result<(), CoreError> {
        let mut workspaces = self.workspaces.lock().unwrap();
        if let Some(pos) = workspaces.iter().position(|w| &w.id == id) {
            workspaces.remove(pos);
            Ok(())
        } else {
            Err(CoreError::NotFound("Workspace not found".to_string()))
        }
    }
    
    async fn set_active(&self, id: &WorkspaceId, active: bool) -> Result<(), CoreError> {
        let mut workspaces = self.workspaces.lock().unwrap();
        if let Some(workspace) = workspaces.iter_mut().find(|w| &w.id == id) {
            workspace.is_active = active;
            workspace.updated_at = chrono::Utc::now();
            Ok(())
        } else {
            Err(CoreError::NotFound("Workspace not found".to_string()))
        }
    }
}