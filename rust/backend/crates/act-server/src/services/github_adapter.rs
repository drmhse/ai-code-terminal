use std::sync::Arc;
use async_trait::async_trait;
use act_core::{
    Result, GitHubRepositoryService, GitHubRepository, GitHubRepositoryOwner, 
    RepositoryListOptions, CoreError
};
use crate::services::GitHubService;

pub struct GitHubRepositoryServiceAdapter {
    github_service: Arc<GitHubService>,
}

impl GitHubRepositoryServiceAdapter {
    pub fn new(github_service: Arc<GitHubService>) -> Self {
        Self {
            github_service,
        }
    }
}

#[async_trait]
impl GitHubRepositoryService for GitHubRepositoryServiceAdapter {
    async fn list_repositories(
        &self, 
        access_token: &str, 
        options: RepositoryListOptions
    ) -> Result<Vec<GitHubRepository>> {
        let repos = self.github_service
            .get_user_repositories(
                access_token,
                options.page,
                options.per_page,
                options.sort.as_deref(),
                options.type_filter.as_deref(),
            )
            .await
            .map_err(|e| CoreError::External(format!("Failed to fetch repositories: {}", e)))?;

        // Convert from server GitHubRepository to core GitHubRepository
        let core_repos = repos.into_iter().map(|repo| GitHubRepository {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            owner: GitHubRepositoryOwner {
                id: repo.owner.id,
                login: repo.owner.login,
                avatar_url: repo.owner.avatar_url,
                html_url: repo.owner.html_url,
            },
            description: repo.description,
            html_url: repo.html_url,
            clone_url: repo.clone_url,
            ssh_url: repo.ssh_url,
            private: repo.private,
            fork: repo.fork,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            updated_at: repo.updated_at,
            pushed_at: repo.pushed_at,
            size: repo.size,
            default_branch: repo.default_branch,
        }).collect();

        Ok(core_repos)
    }

    async fn get_repository(
        &self, 
        access_token: &str, 
        owner: &str, 
        repo: &str
    ) -> Result<GitHubRepository> {
        let repo_info = self.github_service
            .get_repository_info(access_token, owner, repo)
            .await
            .map_err(|e| CoreError::External(format!("Failed to fetch repository info: {}", e)))?;

        // Convert from server GitHubRepository to core GitHubRepository
        Ok(GitHubRepository {
            id: repo_info.id,
            name: repo_info.name,
            full_name: repo_info.full_name,
            owner: GitHubRepositoryOwner {
                id: repo_info.owner.id,
                login: repo_info.owner.login,
                avatar_url: repo_info.owner.avatar_url,
                html_url: repo_info.owner.html_url,
            },
            description: repo_info.description,
            html_url: repo_info.html_url,
            clone_url: repo_info.clone_url,
            ssh_url: repo_info.ssh_url,
            private: repo_info.private,
            fork: repo_info.fork,
            language: repo_info.language,
            stargazers_count: repo_info.stargazers_count,
            forks_count: repo_info.forks_count,
            updated_at: repo_info.updated_at,
            pushed_at: repo_info.pushed_at,
            size: repo_info.size,
            default_branch: repo_info.default_branch,
        })
    }
}