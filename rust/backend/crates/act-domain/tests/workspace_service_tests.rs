use std::sync::Arc;
use async_trait::async_trait;
use act_core::{
    Result, CoreError,
    repository::{Workspace, WorkspaceRepository, CreateWorkspaceRequest},
    filesystem::FileSystem,
};
use act_domain::{WorkspaceService, GitService};

// Mock implementations for testing

struct MockWorkspaceRepository {
    workspaces: std::sync::Mutex<Vec<Workspace>>,
    next_id: std::sync::atomic::AtomicUsize,
}

impl MockWorkspaceRepository {
    fn new() -> Self {
        Self {
            workspaces: std::sync::Mutex::new(Vec::new()),
            next_id: std::sync::atomic::AtomicUsize::new(1),
        }
    }
}

#[async_trait]
impl WorkspaceRepository for MockWorkspaceRepository {
    async fn create(&self, request: &CreateWorkspaceRequest) -> Result<Workspace> {
        let id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let workspace = Workspace {
            id: id.to_string(),
            name: request.name.clone(),
            description: request.description.clone(),
            path: format!("/workspaces/{}", request.name),
            owner_id: request.owner_id.clone().unwrap_or_default(),
            git_url: request.git_url.clone(),
            github_repo: request.github_repo.clone(),
            is_active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            last_accessed: Some(chrono::Utc::now()),
            settings: None,
        };
        
        self.workspaces.lock().unwrap().push(workspace.clone());
        Ok(workspace)
    }

    async fn get_by_id(&self, id: &str) -> Result<Option<Workspace>> {
        let workspaces = self.workspaces.lock().unwrap();
        Ok(workspaces.iter().find(|w| w.id == id).cloned())
    }

    async fn list(&self, active_only: bool) -> Result<Vec<Workspace>> {
        let workspaces = self.workspaces.lock().unwrap();
        let filtered: Vec<Workspace> = if active_only {
            workspaces.iter().filter(|w| w.is_active).cloned().collect()
        } else {
            workspaces.clone()
        };
        Ok(filtered)
    }

    async fn update(&self, id: &str, request: &act_core::repository::UpdateWorkspaceRequest) -> Result<Workspace> {
        let mut workspaces = self.workspaces.lock().unwrap();
        let workspace = workspaces.iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| CoreError::NotFound("Workspace not found".to_string()))?;
        
        if let Some(ref name) = request.name {
            workspace.name = name.clone();
        }
        if let Some(ref description) = request.description {
            workspace.description = Some(description.clone());
        }
        if let Some(is_active) = request.is_active {
            workspace.is_active = is_active;
        }
        workspace.updated_at = chrono::Utc::now();
        
        Ok(workspace.clone())
    }

    async fn delete(&self, id: &str) -> Result<()> {
        let mut workspaces = self.workspaces.lock().unwrap();
        let pos = workspaces.iter().position(|w| w.id == id)
            .ok_or_else(|| CoreError::NotFound("Workspace not found".to_string()))?;
        workspaces.remove(pos);
        Ok(())
    }

    async fn update_last_accessed(&self, id: &str) -> Result<()> {
        let mut workspaces = self.workspaces.lock().unwrap();
        let workspace = workspaces.iter_mut()
            .find(|w| w.id == id)
            .ok_or_else(|| CoreError::NotFound("Workspace not found".to_string()))?;
        
        workspace.last_accessed = Some(chrono::Utc::now());
        Ok(())
    }
}

struct MockFileSystem;

#[async_trait]
impl FileSystem for MockFileSystem {
    async fn list_directory(&self, _path: &str) -> Result<act_core::DirectoryListing> {
        Ok(act_core::DirectoryListing { 
            items: vec![],
            path: "/workspaces".to_string(),
            total_count: 0,
        })
    }

    async fn create_file(&self, _request: &act_core::CreateFileRequest) -> Result<()> {
        Ok(())
    }

    async fn read_file(&self, _path: &str) -> Result<act_core::FileContent> {
        Ok(act_core::FileContent {
            content: "mock content".to_string(),
            encoding: "utf-8".to_string(),
            size: 12,
            mime_type: Some("text/plain".to_string()),
        })
    }

    async fn delete_file(&self, _path: &str) -> Result<()> {
        Ok(())
    }

    async fn move_file(&self, _request: &act_core::MoveRequest) -> Result<()> {
        Ok(())
    }

    async fn copy_file(&self, _request: &act_core::CopyRequest) -> Result<()> {
        Ok(())
    }

    async fn create_directory(&self, _request: &act_core::CreateDirectoryRequest) -> Result<()> {
        Ok(())
    }

    async fn file_exists(&self, _path: &str) -> Result<bool> {
        Ok(true)
    }

    async fn get_file_info(&self, _path: &str) -> Result<act_core::FileItem> {
        Ok(act_core::FileItem {
            name: "test.txt".to_string(),
            path: "/test.txt".to_string(),
            size: Some(12),
            is_directory: false,
            created_at: Some(chrono::Utc::now()),
            modified_at: Some(chrono::Utc::now()),
            permissions: Some(act_core::FilePermissions {
                readable: true,
                writable: true,
                executable: false,
            }),
        })
    }
}

struct MockGitService;

impl GitService for MockGitService {
    fn clone_repository(&self, _url: &str, _path: &str, _auth_token: Option<&str>) -> Result<()> {
        Ok(())
    }

    fn get_status(&self, _path: &str) -> Result<act_domain::workspace_service::GitStatus> {
        Ok(act_domain::workspace_service::GitStatus {
            branch: "main".to_string(),
            is_clean: true,
            ahead: 0,
            behind: 0,
            staged: 0,
            unstaged: 0,
        })
    }

    fn get_commits(&self, _path: &str, _limit: usize) -> Result<Vec<act_domain::workspace_service::GitCommit>> {
        Ok(vec![])
    }
}

#[tokio::test]
async fn test_create_workspace_success() {
    let service = create_workspace_service();
    
    let result = service.create_workspace(
        "Test Workspace".to_string(),
        None,
        None,
    ).await;
    
    assert!(result.is_ok());
    let workspace = result.unwrap();
    assert_eq!(workspace.name, "Test Workspace");
    assert!(workspace.is_active);
}

#[tokio::test]
async fn test_create_workspace_with_github_repo() {
    let service = create_workspace_service();
    
    let result = service.create_workspace(
        "GitHub Workspace".to_string(),
        Some("user/repo".to_string()),
        Some("https://github.com/user/repo.git".to_string()),
    ).await;
    
    assert!(result.is_ok());
    let workspace = result.unwrap();
    assert_eq!(workspace.name, "GitHub Workspace");
    assert_eq!(workspace.github_repo, Some("user/repo".to_string()));
    assert_eq!(workspace.git_url, Some("https://github.com/user/repo.git".to_string()));
}

#[tokio::test]
async fn test_list_workspaces() {
    let service = create_workspace_service();
    
    // Create a few workspaces
    let _ = service.create_workspace("Workspace 1".to_string(), None, None).await.unwrap();
    let _ = service.create_workspace("Workspace 2".to_string(), None, None).await.unwrap();
    
    let result = service.list_workspaces(true).await;
    
    assert!(result.is_ok());
    let workspaces = result.unwrap();
    assert_eq!(workspaces.len(), 2);
}

#[tokio::test]
async fn test_get_workspace_by_id() {
    let service = create_workspace_service();
    
    let created = service.create_workspace("Test".to_string(), None, None).await.unwrap();
    let result = service.get_workspace(&created.id).await;
    
    assert!(result.is_ok());
    let workspace = result.unwrap();
    assert!(workspace.is_some());
    assert_eq!(workspace.unwrap().name, "Test");
}

#[tokio::test]
async fn test_get_nonexistent_workspace() {
    let service = create_workspace_service();
    
    let result = service.get_workspace("nonexistent").await;
    
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}

#[tokio::test]
async fn test_delete_workspace() {
    let service = create_workspace_service();
    
    let created = service.create_workspace("To Delete".to_string(), None, None).await.unwrap();
    let delete_result = service.delete_workspace(&created.id).await;
    
    assert!(delete_result.is_ok());
    
    let get_result = service.get_workspace(&created.id).await.unwrap();
    assert!(get_result.is_none());
}

fn create_workspace_service() -> WorkspaceService {
    let workspace_repo: Arc<dyn WorkspaceRepository> = Arc::new(MockWorkspaceRepository::new());
    let filesystem: Arc<dyn FileSystem> = Arc::new(MockFileSystem);
    let git_service: Arc<dyn GitService> = Arc::new(MockGitService);
    let workspace_root = "/workspaces".to_string();
    
    WorkspaceService::new(
        workspace_repo,
        filesystem,
        git_service,
        workspace_root,
    )
}