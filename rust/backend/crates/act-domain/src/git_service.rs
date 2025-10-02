use std::path::Path;

use act_core::{CoreError, Result};

use async_trait::async_trait;
use tokio::process::Command;
use tracing::{debug, error, info};

use crate::workspace_service::{GitCommit, GitService, GitStatus};

pub struct LocalGitService;

impl LocalGitService {
    pub fn new() -> Self {
        Self
    }
}

impl Default for LocalGitService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl GitService for LocalGitService {
    async fn clone_repository(
        &self,
        git_url: &str,
        target_path: &Path,
        branch: Option<&str>,
        token: Option<&str>,
    ) -> Result<GitCommit> {
        let mut cmd = Command::new("git");
        cmd.arg("clone").arg("--progress").arg("--verbose");

        let authenticated_url = if let Some(token) = token {
            if git_url.starts_with("https://github.com/") {
                git_url.replace(
                    "https://github.com/",
                    &format!("https://token:{}@github.com/", token),
                )
            } else {
                git_url.to_string()
            }
        } else {
            git_url.to_string()
        };

        cmd.arg(&authenticated_url).arg(target_path);

        if let Some(branch) = branch {
            cmd.args(["-b", branch]);
        }

        info!(
            "Starting git clone: git clone {} {}",
            authenticated_url,
            target_path.display()
        );

        let output = cmd
            .output()
            .await
            .map_err(|e| CoreError::Process(format!("Failed to execute git clone: {}", e)))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            error!("Git clone failed: {}", error_msg);
            return Err(CoreError::Process(format!(
                "Git clone failed: {}",
                error_msg
            )));
        }

        let clone_output = String::from_utf8_lossy(&output.stderr);
        debug!("Git clone output: {}", clone_output);

        self.get_latest_commit(target_path).await
    }

    async fn get_git_status(&self, repo_path: &Path) -> Result<GitStatus> {
        let current_branch = self.get_current_branch(repo_path).await?;

        let status_output = Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .current_dir(repo_path)
            .output()
            .await
            .map_err(|e| CoreError::Process(format!("Failed to execute git status: {}", e)))?;

        if !status_output.status.success() {
            return Err(CoreError::Process("Git status command failed".to_string()));
        }

        let status_text = String::from_utf8_lossy(&status_output.stdout);
        let mut staged_files = Vec::new();
        let mut unstaged_files = Vec::new();
        let mut untracked_files = Vec::new();

        for line in status_text.lines() {
            if line.len() < 3 {
                continue;
            }
            let status = &line[0..2];
            let file = &line[3..];

            match status {
                "??" => untracked_files.push(file.to_string()),
                status if !status.starts_with(' ') => staged_files.push(file.to_string()),
                status if status.chars().nth(1).unwrap() != ' ' => {
                    unstaged_files.push(file.to_string())
                }
                _ => {}
            }
        }

        let (ahead, behind) = self
            .get_remote_tracking_info(repo_path)
            .await
            .unwrap_or((0, 0));
        let remote = self.get_remote_url(repo_path).await.ok();

        Ok(GitStatus {
            branch: current_branch,
            is_clean: staged_files.is_empty()
                && unstaged_files.is_empty()
                && untracked_files.is_empty(),
            staged_files,
            unstaged_files,
            untracked_files,
            ahead,
            behind,
            remote,
        })
    }

    async fn get_git_history(&self, repo_path: &Path, limit: usize) -> Result<Vec<GitCommit>> {
        let output = Command::new("git")
            .args([
                "log",
                "--format=%H|%h|%an|%ae|%s|%ct",
                &format!("-{}", limit),
            ])
            .current_dir(repo_path)
            .output()
            .await
            .map_err(|e| CoreError::Process(format!("Failed to execute git log: {}", e)))?;

        if !output.status.success() {
            return Err(CoreError::Process("Git log command failed".to_string()));
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

    async fn get_current_branch(&self, repo_path: &Path) -> Result<String> {
        let output = Command::new("git")
            .args(["branch", "--show-current"])
            .current_dir(repo_path)
            .output()
            .await
            .map_err(|e| CoreError::Process(format!("Failed to execute git branch: {}", e)))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(CoreError::Process(
                "Failed to get current branch".to_string(),
            ))
        }
    }

    async fn get_latest_commit(&self, repo_path: &Path) -> Result<GitCommit> {
        let output = Command::new("git")
            .args(["log", "-1", "--format=%H|%h|%an|%ae|%s|%ct"])
            .current_dir(repo_path)
            .output()
            .await
            .map_err(|e| CoreError::Process(format!("Failed to execute git log: {}", e)))?;

        if !output.status.success() {
            return Err(CoreError::Process("Failed to get git info".to_string()));
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

        Err(CoreError::Process("Invalid git log format".to_string()))
    }
}

impl LocalGitService {
    async fn get_remote_tracking_info(&self, repo_path: &Path) -> Result<(u32, u32)> {
        let output = Command::new("git")
            .args(["rev-list", "--count", "--left-right", "@{upstream}...HEAD"])
            .current_dir(repo_path)
            .output()
            .await
            .map_err(|e| CoreError::Process(format!("Failed to execute git rev-list: {}", e)))?;

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

    async fn get_remote_url(&self, repo_path: &Path) -> Result<String> {
        let output = Command::new("git")
            .args(["remote", "get-url", "origin"])
            .current_dir(repo_path)
            .output()
            .await
            .map_err(|e| CoreError::Process(format!("Failed to execute git remote: {}", e)))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(CoreError::Process("Failed to get remote URL".to_string()))
        }
    }
}
