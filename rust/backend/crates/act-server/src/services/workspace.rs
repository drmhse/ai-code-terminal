use act_core::Database;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::process::Command;
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub git_url: Option<String>,
    pub git_branch: Option<String>,
    pub git_commit: Option<String>,
    pub is_git_repo: bool,
    pub owner_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_accessed: Option<i64>,
    pub settings: WorkspaceSettings,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    pub auto_save: bool,
    pub format_on_save: bool,
    pub lint_on_save: bool,
    pub default_shell: String,
    pub environment_variables: std::collections::HashMap<String, String>,
    pub exclude_patterns: Vec<String>,
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
    pub owner_id: String,
}

pub struct WorkspaceService {
    db: Database,
    workspace_root: PathBuf,
}

impl WorkspaceService {
    pub fn new(db: Database, workspace_root: PathBuf) -> Self {
        Self { db, workspace_root }
    }

    pub async fn create_workspace(&self, mut workspace: Workspace) -> Result<Workspace> {
        workspace.id = Uuid::new_v4().to_string();
        workspace.created_at = chrono::Utc::now().timestamp();
        workspace.updated_at = workspace.created_at;

        // Create workspace directory
        let workspace_path = self.workspace_root.join(&workspace.id);
        tokio::fs::create_dir_all(&workspace_path).await?;
        workspace.path = workspace_path.to_string_lossy().to_string();

        // Insert into database
        let settings_json = serde_json::to_string(&workspace.settings)?;
        
        // Extract github_repo from git URL if available
        let github_repo = if let Some(ref git_url) = workspace.git_url {
            if let Some(repo_path) = git_url.strip_prefix("https://github.com/") {
                repo_path.strip_suffix(".git").unwrap_or(repo_path).to_string()
            } else {
                git_url.clone()
            }
        } else {
            // For non-git workspaces, use workspace name as fallback
            workspace.name.clone()
        };

        sqlx::query(
            r#"
            INSERT INTO workspaces (
                id, name, github_repo, description, local_path, path, github_url, git_url, git_branch, git_commit, 
                is_git_repo, owner_id, created_at, updated_at, last_accessed, settings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&workspace.id)
        .bind(&workspace.name)
        .bind(&github_repo)
        .bind(&workspace.description)
        .bind(&workspace.path)
        .bind(&workspace.path)
        .bind(&workspace.git_url)
        .bind(&workspace.git_url)
        .bind(&workspace.git_branch)
        .bind(&workspace.git_commit)
        .bind(workspace.is_git_repo)
        .bind(&workspace.owner_id)
        .bind(workspace.created_at)
        .bind(workspace.updated_at)
        .bind(workspace.last_accessed)
        .bind(&settings_json)
        .execute(self.db.pool())
        .await?;

        info!("Workspace created: {} at {}", workspace.id, workspace.path);
        Ok(workspace)
    }

    pub async fn clone_repository(&self, request: CloneRequest, github_token: &str) -> Result<Workspace> {
        info!("Cloning repository: {} -> {}", request.git_url, request.name);

        // Extract github_repo from git URL (format: "owner/repo") 
        let github_repo = if let Some(repo_path) = request.git_url.strip_prefix("https://github.com/") {
            repo_path.strip_suffix(".git").unwrap_or(repo_path).to_string()
        } else {
            // Fallback for other URL formats
            request.git_url.clone()
        };

        // Check if workspace already exists for this user and repository
        let existing = sqlx::query("SELECT id FROM workspaces WHERE github_repo = ? AND owner_id = ?")
            .bind(&github_repo)
            .bind(&request.owner_id)
            .fetch_optional(self.db.pool())
            .await?;

        if existing.is_some() {
            return Err(anyhow!("Repository {} is already cloned for this user", github_repo));
        }

        let workspace_id = Uuid::new_v4().to_string();
        let workspace_path = self.workspace_root.join(&workspace_id);

        // Create the workspace directory
        tokio::fs::create_dir_all(&workspace_path).await?;

        // Clone the repository with GitHub token authentication
        let mut cmd = Command::new("git");
        cmd.arg("clone")
            .arg("--progress")  // Enable progress output
            .arg("--verbose");   // Verbose output for better tracking
            
        // Modify the git URL to include authentication token for HTTPS
        let authenticated_url = if request.git_url.starts_with("https://github.com/") {
            request.git_url.replace("https://github.com/", &format!("https://token:{}@github.com/", github_token))
        } else {
            request.git_url.clone()
        };
        
        cmd.arg(&authenticated_url)
            .arg(&workspace_path);

        if let Some(branch) = &request.branch {
            cmd.args(["-b", branch]);
        }

        info!("Starting git clone: git clone {} {}", authenticated_url, workspace_path.display());
        
        let output = cmd.output().await?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            error!("Git clone failed: {}", error_msg);
            // Clean up the directory
            let _ = tokio::fs::remove_dir_all(&workspace_path).await;
            return Err(anyhow!("Git clone failed: {}", error_msg));
        }

        let clone_output = String::from_utf8_lossy(&output.stderr);
        debug!("Git clone output: {}", clone_output);

        // Get git information
        let git_info = self.get_git_info(&workspace_path).await?;
        let current_branch = self.get_current_branch(&workspace_path).await?;
        
        
        let workspace = Workspace {
            id: workspace_id,
            name: request.name,
            description: request.description,
            path: workspace_path.to_string_lossy().to_string(),
            git_url: Some(request.git_url),
            git_branch: Some(current_branch),
            git_commit: Some(git_info.hash),
            is_git_repo: true,
            owner_id: request.owner_id,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            last_accessed: None,
            settings: WorkspaceSettings::default(),
        };

        // Save to database
        let settings_json = serde_json::to_string(&workspace.settings)?;

        sqlx::query(
            r#"
            INSERT INTO workspaces (
                id, name, github_repo, description, local_path, path, github_url, git_url, git_branch, git_commit, 
                is_git_repo, owner_id, created_at, updated_at, last_accessed, settings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&workspace.id)
        .bind(&workspace.name)
        .bind(&github_repo)
        .bind(&workspace.description)
        .bind(&workspace.path)
        .bind(&workspace.path)
        .bind(&workspace.git_url)
        .bind(&workspace.git_url)
        .bind(&workspace.git_branch)
        .bind(&workspace.git_commit)
        .bind(workspace.is_git_repo)
        .bind(&workspace.owner_id)
        .bind(workspace.created_at)
        .bind(workspace.updated_at)
        .bind(workspace.last_accessed)
        .bind(&settings_json)
        .execute(self.db.pool())
        .await?;

        info!("Repository cloned successfully: {}", workspace.id);
        Ok(workspace)
    }

    /// Clone repository without authentication (for public repos)
    pub async fn clone_repository_without_auth(&self, request: CloneRequest) -> Result<Workspace> {
        info!("Cloning repository without auth: {} -> {}", request.git_url, request.name);

        let workspace_id = Uuid::new_v4().to_string();
        let workspace_path = self.workspace_root.join(&workspace_id);

        // Create the workspace directory
        tokio::fs::create_dir_all(&workspace_path).await?;

        // Clone the repository without authentication
        let mut cmd = Command::new("git");
        cmd.arg("clone")
            .arg("--progress")  // Enable progress output
            .arg("--verbose")   // Verbose output for better tracking
            .arg(&request.git_url)
            .arg(&workspace_path);

        if let Some(branch) = &request.branch {
            cmd.args(["-b", branch]);
        }

        info!("Starting git clone: git clone {} {}", request.git_url, workspace_path.display());
        
        let output = cmd.output().await?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            error!("Git clone failed: {}", error_msg);
            // Clean up the directory
            let _ = tokio::fs::remove_dir_all(&workspace_path).await;
            return Err(anyhow!("Git clone failed: {}", error_msg));
        }

        let clone_output = String::from_utf8_lossy(&output.stderr);
        debug!("Git clone output: {}", clone_output);

        // Get git information
        let git_info = self.get_git_info(&workspace_path).await?;
        let current_branch = self.get_current_branch(&workspace_path).await?;
        
        // Extract github_repo from git URL (format: "owner/repo")
        let github_repo = if let Some(repo_path) = request.git_url.strip_prefix("https://github.com/") {
            repo_path.strip_suffix(".git").unwrap_or(repo_path).to_string()
        } else {
            // Fallback for other URL formats
            request.git_url.clone()
        };
        
        let workspace = Workspace {
            id: workspace_id,
            name: request.name,
            description: request.description,
            path: workspace_path.to_string_lossy().to_string(),
            git_url: Some(request.git_url),
            git_branch: Some(current_branch),
            git_commit: Some(git_info.hash),
            is_git_repo: true,
            owner_id: request.owner_id,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            last_accessed: None,
            settings: WorkspaceSettings::default(),
        };

        // Save to database
        let settings_json = serde_json::to_string(&workspace.settings)?;

        sqlx::query(
            r#"
            INSERT INTO workspaces (
                id, name, github_repo, description, local_path, path, github_url, git_url, git_branch, git_commit, 
                is_git_repo, owner_id, created_at, updated_at, last_accessed, settings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&workspace.id)
        .bind(&workspace.name)
        .bind(&github_repo)
        .bind(&workspace.description)
        .bind(&workspace.path)
        .bind(&workspace.path)
        .bind(&workspace.git_url)
        .bind(&workspace.git_url)
        .bind(&workspace.git_branch)
        .bind(&workspace.git_commit)
        .bind(workspace.is_git_repo)
        .bind(&workspace.owner_id)
        .bind(workspace.created_at)
        .bind(workspace.updated_at)
        .bind(workspace.last_accessed)
        .bind(&settings_json)
        .execute(self.db.pool())
        .await?;

        info!("Repository cloned successfully: {}", workspace.id);
        Ok(workspace)
    }

    pub async fn get_workspace(&self, workspace_id: &str) -> Result<Option<Workspace>> {
        let row = sqlx::query(
            r#"
            SELECT id, name, github_repo, description, local_path, path, github_url, git_url, git_branch, git_commit, 
                   is_git_repo, owner_id, created_at, updated_at, last_accessed, settings
            FROM workspaces WHERE id = ?
            "#
        )
        .bind(workspace_id)
        .fetch_optional(self.db.pool())
        .await?;

        if let Some(row) = row {
            let settings: WorkspaceSettings = serde_json::from_str(&row.get::<String, _>("settings"))?;

            Ok(Some(Workspace {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                path: row.get("path"),
                git_url: row.get("git_url"),
                git_branch: row.get("git_branch"),
                git_commit: row.get("git_commit"),
                is_git_repo: row.get("is_git_repo"),
                owner_id: row.get("owner_id"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                last_accessed: row.get("last_accessed"),
                settings,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn list_workspaces(&self, owner_id: Option<&str>) -> Result<Vec<Workspace>> {
        let query = if let Some(owner) = owner_id {
            sqlx::query(
                r#"
                SELECT id, name, github_repo, description, local_path, path, github_url, git_url, git_branch, git_commit, 
                       is_git_repo, owner_id, created_at, updated_at, last_accessed, settings
                FROM workspaces WHERE owner_id = ? ORDER BY updated_at DESC
                "#
            ).bind(owner)
        } else {
            sqlx::query(
                r#"
                SELECT id, name, github_repo, description, local_path, path, github_url, git_url, git_branch, git_commit, 
                       is_git_repo, owner_id, created_at, updated_at, last_accessed, settings
                FROM workspaces ORDER BY updated_at DESC
                "#
            )
        };

        let rows = query.fetch_all(self.db.pool()).await?;
        let mut workspaces = Vec::new();

        for row in rows {
            let settings: WorkspaceSettings = serde_json::from_str(&row.get::<String, _>("settings"))?;

            workspaces.push(Workspace {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                path: row.get("path"),
                git_url: row.get("git_url"),
                git_branch: row.get("git_branch"),
                git_commit: row.get("git_commit"),
                is_git_repo: row.get("is_git_repo"),
                owner_id: row.get("owner_id"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                last_accessed: row.get("last_accessed"),
                settings,
            });
        }

        Ok(workspaces)
    }

    pub async fn update_workspace(&self, workspace_id: &str, name: Option<String>, description: Option<String>, settings: Option<WorkspaceSettings>) -> Result<Workspace> {
        let current = self.get_workspace(workspace_id).await?.ok_or_else(|| anyhow!("Workspace not found"))?;
        
        let updated_name = name.unwrap_or_else(|| current.name.clone());
        let updated_description = description.or_else(|| current.description.clone());
        let updated_settings = settings.unwrap_or_else(|| current.settings.clone());
        let updated_at = chrono::Utc::now().timestamp();

        let settings_json = serde_json::to_string(&updated_settings)?;

        sqlx::query(
            "UPDATE workspaces SET name = ?, description = ?, settings = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&updated_name)
        .bind(&updated_description)
        .bind(&settings_json)
        .bind(updated_at)
        .bind(workspace_id)
        .execute(self.db.pool())
        .await?;

        let mut workspace = current;
        workspace.name = updated_name;
        workspace.description = updated_description;
        workspace.settings = updated_settings;
        workspace.updated_at = updated_at;

        info!("Workspace updated: {}", workspace_id);
        Ok(workspace)
    }

    pub async fn delete_workspace(&self, workspace_id: &str) -> Result<()> {
        let workspace = self.get_workspace(workspace_id).await?.ok_or_else(|| anyhow!("Workspace not found"))?;
        
        // Remove from database
        sqlx::query("DELETE FROM workspaces WHERE id = ?")
            .bind(workspace_id)
            .execute(self.db.pool())
            .await?;

        // Remove workspace directory
        if let Err(e) = tokio::fs::remove_dir_all(&workspace.path).await {
            warn!("Failed to remove workspace directory {}: {}", workspace.path, e);
        }

        info!("Workspace deleted: {}", workspace_id);
        Ok(())
    }

    pub async fn update_last_accessed(&self, workspace_id: &str) -> Result<()> {
        let last_accessed = chrono::Utc::now().timestamp();
        
        sqlx::query("UPDATE workspaces SET last_accessed = ? WHERE id = ?")
            .bind(last_accessed)
            .bind(workspace_id)
            .execute(self.db.pool())
            .await?;

        Ok(())
    }

    pub async fn get_git_status(&self, workspace_path: &Path) -> Result<GitStatus> {
        let current_branch = self.get_current_branch(workspace_path).await?;
        let status_output = Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .current_dir(workspace_path)
            .output().await?;

        if !status_output.status.success() {
            return Err(anyhow!("Git status command failed"));
        }

        let status_text = String::from_utf8_lossy(&status_output.stdout);
        let mut staged_files = Vec::new();
        let mut unstaged_files = Vec::new();
        let mut untracked_files = Vec::new();

        for line in status_text.lines() {
            if line.len() < 3 { continue; }
            let status = &line[0..2];
            let file = &line[3..];

            match status {
                "??" => untracked_files.push(file.to_string()),
                status if !status.starts_with(' ') => staged_files.push(file.to_string()),
                status if status.chars().nth(1).unwrap() != ' ' => unstaged_files.push(file.to_string()),
                _ => {}
            }
        }

        // Get remote tracking info
        let (ahead, behind) = self.get_remote_tracking_info(workspace_path).await.unwrap_or((0, 0));
        let remote = self.get_remote_url(workspace_path).await.ok();

        Ok(GitStatus {
            branch: current_branch,
            is_clean: staged_files.is_empty() && unstaged_files.is_empty() && untracked_files.is_empty(),
            staged_files,
            unstaged_files,
            untracked_files,
            ahead,
            behind,
            remote,
        })
    }

    pub async fn get_git_history(&self, workspace_path: &Path, limit: usize) -> Result<Vec<GitCommit>> {
        let output = Command::new("git")
            .args(["log", "--format=%H|%h|%an|%ae|%s|%ct", &format!("-{}", limit)])
            .current_dir(workspace_path)
            .output().await?;

        if !output.status.success() {
            return Err(anyhow!("Git log command failed"));
        }

        let log_text = String::from_utf8_lossy(&output.stdout);
        let mut commits = Vec::new();

        for line in log_text.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() == 6 {
                if let Ok(timestamp) = parts[5].parse::<i64>() {
                    commits.push(GitCommit {
                        hash: parts[0].to_string(),
                        short_hash: parts[1].to_string(),
                        author: parts[2].to_string(),
                        email: parts[3].to_string(),
                        message: parts[4].to_string(),
                        timestamp,
                    });
                }
            }
        }

        Ok(commits)
    }

    async fn get_git_info(&self, workspace_path: &Path) -> Result<GitCommit> {
        let output = Command::new("git")
            .args(["log", "-1", "--format=%H|%h|%an|%ae|%s|%ct"])
            .current_dir(workspace_path)
            .output().await?;

        if !output.status.success() {
            return Err(anyhow!("Failed to get git info"));
        }

        let log_text = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = log_text.trim().split('|').collect();
        
        if parts.len() == 6 {
            if let Ok(timestamp) = parts[5].parse::<i64>() {
                return Ok(GitCommit {
                    hash: parts[0].to_string(),
                    short_hash: parts[1].to_string(),
                    author: parts[2].to_string(),
                    email: parts[3].to_string(),
                    message: parts[4].to_string(),
                    timestamp,
                });
            }
        }

        Err(anyhow!("Invalid git log format"))
    }

    async fn get_current_branch(&self, workspace_path: &Path) -> Result<String> {
        let output = Command::new("git")
            .args(["branch", "--show-current"])
            .current_dir(workspace_path)
            .output().await?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(anyhow!("Failed to get current branch"))
        }
    }

    async fn get_remote_tracking_info(&self, workspace_path: &Path) -> Result<(u32, u32)> {
        let output = Command::new("git")
            .args(["rev-list", "--count", "--left-right", "@{upstream}...HEAD"])
            .current_dir(workspace_path)
            .output().await?;

        if output.status.success() {
            let count_text = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = count_text.trim().split('\t').collect();
            if parts.len() == 2 {
                let behind: u32 = parts[0].parse().unwrap_or(0);
                let ahead: u32 = parts[1].parse().unwrap_or(0);
                return Ok((ahead, behind));
            }
        }

        Ok((0, 0))
    }

    async fn get_remote_url(&self, workspace_path: &Path) -> Result<String> {
        let output = Command::new("git")
            .args(["remote", "get-url", "origin"])
            .current_dir(workspace_path)
            .output().await?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(anyhow!("Failed to get remote URL"))
        }
    }
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            auto_save: true,
            format_on_save: false,
            lint_on_save: false,
            default_shell: "bash".to_string(),
            environment_variables: std::collections::HashMap::new(),
            exclude_patterns: vec![
                ".git".to_string(),
                "node_modules".to_string(),
                ".DS_Store".to_string(),
                "*.log".to_string(),
            ],
        }
    }
}