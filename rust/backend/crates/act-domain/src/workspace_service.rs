use std::path::Path;
use std::sync::Arc;

use act_core::{
    filesystem::FileSystem,
    repository::{
        CreateWorkspaceRequest, UpdateWorkspaceRequest, Workspace, WorkspaceId, WorkspaceRepository,
    },
    CoreError, Result,
};

use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info, warn};
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
    async fn clone_repository(
        &self,
        git_url: &str,
        target_path: &Path,
        branch: Option<&str>,
        token: Option<&str>,
    ) -> Result<GitCommit>;
    async fn get_git_status(&self, repo_path: &Path) -> Result<GitStatus>;
    async fn get_git_history(&self, repo_path: &Path, limit: usize) -> Result<Vec<GitCommit>>;
    async fn get_current_branch(&self, repo_path: &Path) -> Result<String>;
    async fn get_latest_commit(&self, repo_path: &Path) -> Result<GitCommit>;
}

#[derive(Clone)]
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

    pub fn workspace_root(&self) -> &str {
        &self.workspace_root
    }

    pub async fn create_workspace(
        &self,
        user_id: &str,
        name: String,
        github_url: Option<String>,
        _description: Option<String>,
    ) -> Result<Workspace> {
        let workspace_id = Uuid::new_v4().to_string();
        let github_repo = self.extract_github_repo(&github_url, &name);
        let local_path = format!("{}/{}", self.workspace_root, workspace_id);

        let create_request = act_core::filesystem::CreateDirectoryRequest {
            path: std::path::PathBuf::from(&local_path),
            create_parent_dirs: true,
        };
        self.filesystem
            .create_directory(create_request)
            .await
            .map_err(|e| {
                CoreError::FileSystem(format!("Failed to create workspace directory: {}", e))
            })?;

        let request = CreateWorkspaceRequest {
            name: name.clone(),
            github_repo,
            github_url: github_url.unwrap_or_else(|| name.clone()),
            local_path: Some(local_path.clone()),
        };

        let workspace = self.repository.create(user_id, request).await?;
        info!("Workspace created: {} at {}", workspace.id, local_path);
        Ok(workspace)
    }

    pub async fn create_empty_workspace(
        &self,
        user_id: &str,
        name: String,
        path: Option<String>,
    ) -> Result<Workspace> {
        let workspace_id = Uuid::new_v4().to_string();

        // Use provided path or generate default path
        let local_path = match path {
            Some(custom_path) if !custom_path.is_empty() => custom_path,
            _ => format!("{}/{}", self.workspace_root, workspace_id),
        };

        // Create the workspace directory
        let create_request = act_core::filesystem::CreateDirectoryRequest {
            path: std::path::PathBuf::from(&local_path),
            create_parent_dirs: true,
        };
        self.filesystem
            .create_directory(create_request)
            .await
            .map_err(|e| {
                CoreError::FileSystem(format!("Failed to create empty workspace directory: {}", e))
            })?;

        // Create workspace record without GitHub info
        let request = CreateWorkspaceRequest {
            name: name.clone(),
            github_repo: format!("local/{}", name), // Use a local identifier for empty workspaces
            github_url: format!("local:{}", name),  // Use a local identifier
            local_path: Some(local_path.clone()),
        };

        let workspace = self.repository.create(user_id, request).await?;
        info!(
            "Empty workspace created: {} at {}",
            workspace.id, local_path
        );

        Ok(workspace)
    }

    /// Opens an existing folder as a workspace without creating or modifying it
    ///
    /// This enables users to work with any existing directory on their system,
    /// but only when ALLOW_ACCESS_TO_PARENT_DIRS is enabled.
    pub async fn open_existing_folder(
        &self,
        user_id: &str,
        name: String,
        folder_path: String,
    ) -> Result<Workspace> {
        info!(
            "Opening existing folder as workspace: {} -> {}",
            name, folder_path
        );

        // Check if parent directory access is allowed
        if !self.filesystem.allows_parent_directory_access() {
            return Err(CoreError::Validation(
                "Opening existing folders as workspaces is not allowed when ALLOW_ACCESS_TO_PARENT_DIRS is false".to_string(),
            ));
        }

        let path = Path::new(&folder_path);
        info!("Checking path: {}", path.display());

        // Validate the path exists using filesystem abstraction
        if !self.filesystem.exists(path).await? {
            error!("Path does not exist: {}", folder_path);
            return Err(CoreError::Validation(format!(
                "Path does not exist: {}",
                folder_path
            )));
        }
        info!("Path exists: {}", folder_path);

        // Validate it's a directory using filesystem abstraction
        if !self.filesystem.is_directory(path).await? {
            error!("Path is not a directory: {}", folder_path);
            return Err(CoreError::Validation(format!(
                "Path is not a directory: {}",
                folder_path
            )));
        }
        info!("Path is directory: {}", folder_path);

        // Get canonical path using filesystem abstraction
        let file_info = self.filesystem.get_file_info(path).await?;
        let canonical_path = file_info.path;
        info!("Resolved path using filesystem abstraction: {}", canonical_path.display());

        // Additional validation using filesystem abstraction - check if path is allowed
        if !self.filesystem.is_path_allowed(&canonical_path) {
            error!("Path is not allowed by filesystem security policy: {}", canonical_path.display());
            return Err(CoreError::Validation(format!(
                "Cannot open this directory as workspace: {}",
                folder_path
            )));
        }

        info!(
            "Path passed security validation: {}",
            canonical_path.display()
        );

        // Check if user already has a workspace at this path
        info!("Checking for duplicate workspaces for user: {}", user_id);
        let existing_workspaces = self.repository.list_all(user_id).await?;
        info!(
            "Found {} existing workspaces for user",
            existing_workspaces.len()
        );
        for ws in existing_workspaces {
            info!(
                "Checking existing workspace: {} at {}",
                ws.name, ws.local_path
            );
            let existing_path = Path::new(&ws.local_path);
            if let Ok(existing_info) = self.filesystem.get_file_info(existing_path).await {
                info!(
                    "Existing workspace resolved path: {}",
                    existing_info.path.display()
                );
                if existing_info.path == canonical_path {
                    error!(
                        "Duplicate workspace found: '{}' already exists at path {}",
                        ws.name,
                        canonical_path.display()
                    );
                    return Err(CoreError::Conflict(format!(
                        "A workspace already exists for this path: {}",
                        ws.name
                    )));
                }
            } else {
                warn!(
                    "Failed to resolve existing workspace path: {}",
                    ws.local_path
                );
            }
        }
        info!(
            "No duplicate workspaces found for path: {}",
            canonical_path.display()
        );

        // Test read access by attempting to list the directory using filesystem abstraction
        info!(
            "Testing read access to directory: {}",
            canonical_path.display()
        );
        match self.filesystem.list_directory(&canonical_path).await {
            Ok(_) => {
                // Successfully listed directory, user has at least read access
                info!("Validated read access to {}", canonical_path.display());
            }
            Err(e) => {
                error!("Cannot access directory '{}': {}", folder_path, e);
                return Err(CoreError::Validation(format!(
                    "Cannot access directory '{}': {}",
                    folder_path, e
                )));
            }
        }

        // Create workspace record
        let request = CreateWorkspaceRequest {
            name: name.clone(),
            github_repo: format!("local/{}", name),
            github_url: format!("file://{}", canonical_path.display()),
            local_path: Some(canonical_path.to_string_lossy().to_string()),
        };

        let workspace = self.repository.create(user_id, request).await?;
        info!(
            "Opened existing folder as workspace: {} at {}",
            workspace.id,
            canonical_path.display()
        );

        Ok(workspace)
    }

    pub async fn clone_repository(
        &self,
        user_id: &str,
        request: CloneRequest,
        github_token: Option<&str>,
    ) -> Result<Workspace> {
        info!(
            "Cloning repository: {} -> {}",
            request.git_url, request.name
        );

        let github_repo = self.extract_github_repo(&Some(request.git_url.clone()), &request.name);

        if let Some(_existing) = self
            .repository
            .get_by_github_repo(user_id, &github_repo)
            .await?
        {
            return Err(CoreError::Conflict(format!(
                "Repository {} is already cloned",
                github_repo
            )));
        }

        let workspace_id = Uuid::new_v4().to_string();
        let local_path = format!("{}/{}", self.workspace_root, workspace_id);

        let create_request = act_core::filesystem::CreateDirectoryRequest {
            path: std::path::PathBuf::from(&local_path),
            create_parent_dirs: true,
        };
        self.filesystem
            .create_directory(create_request)
            .await
            .map_err(|e| {
                CoreError::FileSystem(format!("Failed to create workspace directory: {}", e))
            })?;

        let _git_info = self
            .git_service
            .clone_repository(
                &request.git_url,
                Path::new(&local_path),
                request.branch.as_deref(),
                github_token,
            )
            .await
            .inspect_err(|_e| {
                // Clean up on failure
                tokio::task::spawn({
                    let fs = Arc::clone(&self.filesystem);
                    let path = local_path.clone();
                    async move {
                        let _ = fs
                            .delete_directory(&std::path::PathBuf::from(path), true)
                            .await;
                    }
                });
            })?;

        let _current_branch = self
            .git_service
            .get_current_branch(Path::new(&local_path))
            .await?;

        let create_request = CreateWorkspaceRequest {
            name: request.name,
            github_repo: github_repo.clone(),
            github_url: request.git_url,
            local_path: Some(local_path),
        };

        let workspace = self.repository.create(user_id, create_request).await?;
        info!("Repository cloned successfully: {}", workspace.id);
        Ok(workspace)
    }

    pub async fn get_workspace(
        &self,
        user_id: &str,
        workspace_id: &WorkspaceId,
    ) -> Result<Workspace> {
        self.repository.get_by_id(user_id, workspace_id).await
    }

    /// Get workspace without user validation - for system operations only (e.g., background sync)
    pub async fn get_workspace_system(
        &self,
        workspace_id: &WorkspaceId,
    ) -> Result<Option<Workspace>> {
        self.repository.get_by_id_system(workspace_id).await
    }

    pub async fn list_workspaces(
        &self,
        user_id: &str,
        active_only: bool,
    ) -> Result<Vec<Workspace>> {
        if active_only {
            self.repository.list_active(user_id).await
        } else {
            self.repository.list_all(user_id).await
        }
    }

    pub async fn update_workspace(
        &self,
        user_id: &str,
        workspace_id: &WorkspaceId,
        name: Option<String>,
        active: Option<bool>,
    ) -> Result<Workspace> {
        let request = UpdateWorkspaceRequest {
            name,
            is_active: active,
            last_sync_at: Some(Utc::now()),
        };

        self.repository.update(user_id, workspace_id, request).await
    }

    pub async fn delete_workspace(&self, user_id: &str, workspace_id: &WorkspaceId) -> Result<()> {
        let workspace = self.repository.get_by_id(user_id, workspace_id).await?;

        self.repository.delete(user_id, workspace_id).await?;

        if let Err(e) = self
            .filesystem
            .delete_directory(&std::path::PathBuf::from(&workspace.local_path), true)
            .await
        {
            warn!(
                "Failed to remove workspace directory {}: {}",
                workspace.local_path, e
            );
        }

        info!("Workspace deleted: {}", workspace_id);
        Ok(())
    }

    pub async fn set_active(
        &self,
        user_id: &str,
        workspace_id: &WorkspaceId,
        active: bool,
    ) -> Result<()> {
        self.repository
            .set_active(user_id, workspace_id, active)
            .await
    }

    pub async fn get_git_status(
        &self,
        user_id: &str,
        workspace_id: &WorkspaceId,
    ) -> Result<GitStatus> {
        let workspace = self.repository.get_by_id(user_id, workspace_id).await?;
        self.git_service
            .get_git_status(Path::new(&workspace.local_path))
            .await
    }

    pub async fn get_git_history(
        &self,
        user_id: &str,
        workspace_id: &WorkspaceId,
        limit: usize,
    ) -> Result<Vec<GitCommit>> {
        let workspace = self.repository.get_by_id(user_id, workspace_id).await?;
        self.git_service
            .get_git_history(Path::new(&workspace.local_path), limit)
            .await
    }

    fn extract_github_repo(&self, git_url: &Option<String>, fallback_name: &str) -> String {
        if let Some(ref url) = git_url {
            if let Some(repo_path) = url.strip_prefix("https://github.com/") {
                repo_path
                    .strip_suffix(".git")
                    .unwrap_or(repo_path)
                    .to_string()
            } else {
                url.clone()
            }
        } else {
            fallback_name.to_string()
        }
    }
}
