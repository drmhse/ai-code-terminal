use std::path::Path;
use std::sync::Arc;

use act_core::{
    repository::{
        Workspace, WorkspaceRepository, CreateWorkspaceRequest, UpdateWorkspaceRequest,
        WorkspaceId
    },
    filesystem::FileSystem,
    Result, CoreError
};


use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    pub auto_save: bool,
    pub format_on_save: bool,
    pub lint_on_save: bool,
    pub default_shell: String,
    pub environment_variables: HashMap<String, String>,
    pub exclude_patterns: Vec<String>,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            auto_save: true,
            format_on_save: false,
            lint_on_save: false,
            default_shell: "bash".to_string(),
            environment_variables: HashMap::new(),
            exclude_patterns: vec![
                ".git".to_string(),
                "node_modules".to_string(),
                ".DS_Store".to_string(),
                "*.log".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub is_clean: bool,
    pub staged_files: Vec<String>,
    pub unstaged_files: Vec<String>,
    pub untracked_files: Vec<String>,
    pub ahead: u32,
    pub behind: u32,
    pub remote: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub email: String,
    pub message: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneRequest {
    pub name: String,
    pub git_url: String,
    pub branch: Option<String>,
    pub description: Option<String>,
}

#[async_trait]
pub trait GitService: Send + Sync {
    async fn clone_repository(&self, git_url: &str, target_path: &Path, branch: Option<&str>, token: Option<&str>) -> Result<GitCommit>;
    async fn get_git_status(&self, repo_path: &Path) -> Result<GitStatus>;
    async fn get_git_history(&self, repo_path: &Path, limit: usize) -> Result<Vec<GitCommit>>;
    async fn get_current_branch(&self, repo_path: &Path) -> Result<String>;
    async fn get_latest_commit(&self, repo_path: &Path) -> Result<GitCommit>;
}

pub struct WorkspaceService {
    repository: Arc<dyn WorkspaceRepository>,
    filesystem: Arc<dyn FileSystem>,
    git_service: Arc<dyn GitService>,
    workspace_root: String,
}

impl WorkspaceService {
    pub fn new(
        repository: Arc<dyn WorkspaceRepository>,
        filesystem: Arc<dyn FileSystem>,
        git_service: Arc<dyn GitService>,
        workspace_root: String,
    ) -> Self {
        Self {
            repository,
            filesystem,
            git_service,
            workspace_root,
        }
    }

    pub async fn create_workspace(&self, name: String, github_url: Option<String>, _description: Option<String>) -> Result<Workspace> {
        let workspace_id = Uuid::new_v4().to_string();
        let github_repo = self.extract_github_repo(&github_url, &name);
        let local_path = format!("{}/{}", self.workspace_root, workspace_id);

        let create_request = act_core::filesystem::CreateDirectoryRequest {
            path: std::path::PathBuf::from(&local_path),
            create_parent_dirs: true,
        };
        self.filesystem.create_directory(create_request).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to create workspace directory: {}", e)))?;

        let request = CreateWorkspaceRequest {
            name: name.clone(),
            github_repo,
            github_url: github_url.unwrap_or_else(|| name.clone()),
            local_path: Some(local_path.clone()),
        };

        let workspace = self.repository.create(request).await?;
        info!("Workspace created: {} at {}", workspace.id, local_path);
        Ok(workspace)
    }

    pub async fn clone_repository(&self, request: CloneRequest, github_token: Option<&str>) -> Result<Workspace> {
        info!("Cloning repository: {} -> {}", request.git_url, request.name);

        let github_repo = self.extract_github_repo(&Some(request.git_url.clone()), &request.name);

        if let Some(_existing) = self.repository.get_by_github_repo(&github_repo).await? {
            return Err(CoreError::Conflict(format!("Repository {} is already cloned", github_repo)));
        }

        let workspace_id = Uuid::new_v4().to_string();
        let local_path = format!("{}/{}", self.workspace_root, workspace_id);

        let create_request = act_core::filesystem::CreateDirectoryRequest {
            path: std::path::PathBuf::from(&local_path),
            create_parent_dirs: true,
        };
        self.filesystem.create_directory(create_request).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to create workspace directory: {}", e)))?;

        let _git_info = self.git_service.clone_repository(
            &request.git_url,
            Path::new(&local_path),
            request.branch.as_deref(),
            github_token,
        ).await.map_err(|e| {
            // Clean up on failure
            tokio::task::spawn({
                let fs = Arc::clone(&self.filesystem);
                let path = local_path.clone();
                async move {
                    let _ = fs.delete_directory(&std::path::PathBuf::from(path), true).await;
                }
            });
            e
        })?;

        let _current_branch = self.git_service.get_current_branch(Path::new(&local_path)).await?;

        let create_request = CreateWorkspaceRequest {
            name: request.name,
            github_repo: github_repo.clone(),
            github_url: request.git_url,
            local_path: Some(local_path),
        };

        let workspace = self.repository.create(create_request).await?;
        info!("Repository cloned successfully: {}", workspace.id);
        Ok(workspace)
    }

    pub async fn get_workspace(&self, workspace_id: &WorkspaceId) -> Result<Workspace> {
        self.repository.get_by_id(workspace_id).await
    }

    pub async fn list_workspaces(&self, active_only: bool) -> Result<Vec<Workspace>> {
        if active_only {
            self.repository.list_active().await
        } else {
            self.repository.list_all().await
        }
    }

    pub async fn update_workspace(
        &self,
        workspace_id: &WorkspaceId,
        name: Option<String>,
        active: Option<bool>,
    ) -> Result<Workspace> {
        let request = UpdateWorkspaceRequest {
            name,
            is_active: active,
            last_sync_at: Some(Utc::now()),
        };

        self.repository.update(workspace_id, request).await
    }

    pub async fn delete_workspace(&self, workspace_id: &WorkspaceId) -> Result<()> {
        let workspace = self.repository.get_by_id(workspace_id).await?;
        
        self.repository.delete(workspace_id).await?;

        if let Err(e) = self.filesystem.delete_directory(&std::path::PathBuf::from(&workspace.local_path), true).await {
            warn!("Failed to remove workspace directory {}: {}", workspace.local_path, e);
        }

        info!("Workspace deleted: {}", workspace_id);
        Ok(())
    }

    pub async fn set_active(&self, workspace_id: &WorkspaceId, active: bool) -> Result<()> {
        self.repository.set_active(workspace_id, active).await
    }

    pub async fn get_git_status(&self, workspace_id: &WorkspaceId) -> Result<GitStatus> {
        let workspace = self.repository.get_by_id(workspace_id).await?;
        self.git_service.get_git_status(Path::new(&workspace.local_path)).await
    }

    pub async fn get_git_history(&self, workspace_id: &WorkspaceId, limit: usize) -> Result<Vec<GitCommit>> {
        let workspace = self.repository.get_by_id(workspace_id).await?;
        self.git_service.get_git_history(Path::new(&workspace.local_path), limit).await
    }

    fn extract_github_repo(&self, git_url: &Option<String>, fallback_name: &str) -> String {
        if let Some(ref url) = git_url {
            if let Some(repo_path) = url.strip_prefix("https://github.com/") {
                repo_path.strip_suffix(".git").unwrap_or(repo_path).to_string()
            } else {
                url.clone()
            }
        } else {
            fallback_name.to_string()
        }
    }
}