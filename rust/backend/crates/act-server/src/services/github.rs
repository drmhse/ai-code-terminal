use crate::config::Config;
use act_core::{
    GitHubRepository, GitHubRepositoryOwner, GitHubRepositoryService, RepositoryListOptions,
    Result as CoreResult,
};
use reqwest::Client;
use serde::Deserialize;
use std::sync::Arc;

/// GitHub API client service - OAuth is now handled via SSO
#[derive(Debug, Clone)]
pub struct GitHubService {
    client: Client,
}

impl GitHubService {
    /// Create a new GitHub API client (OAuth now handled via SSO)
    pub fn new(_config: Arc<Config>) -> anyhow::Result<Self> {
        Ok(Self {
            client: Client::new(),
        })
    }

    /// Get user repositories with pagination
    pub async fn get_user_repositories(
        &self,
        access_token: &str,
        page: Option<u32>,
        per_page: Option<u32>,
        sort: Option<&str>,
        type_filter: Option<&str>,
    ) -> anyhow::Result<Vec<GitHubRepository>> {
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(30).min(100); // GitHub API max is 100
        let sort = sort.unwrap_or("updated");
        let type_filter = type_filter.unwrap_or("all");

        let url = format!(
            "https://api.github.com/user/repos?page={}&per_page={}&sort={}&type={}",
            page, per_page, sort, type_filter
        );

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("token {}", access_token))
            .header("User-Agent", "ai-coding-terminal")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to get repositories: {}",
                response.status()
            ));
        }

        #[derive(Deserialize)]
        struct GitHubRepoResponse {
            id: u64,
            name: String,
            full_name: String,
            owner: GitHubRepoOwner,
            description: Option<String>,
            html_url: String,
            clone_url: String,
            ssh_url: String,
            private: bool,
            fork: bool,
            language: Option<String>,
            stargazers_count: u32,
            forks_count: u32,
            updated_at: String,
            pushed_at: Option<String>,
            size: u32,
            default_branch: String,
        }

        #[derive(Deserialize)]
        struct GitHubRepoOwner {
            id: u64,
            login: String,
            avatar_url: String,
            html_url: String,
        }

        let repos: Vec<GitHubRepoResponse> = response.json().await?;

        Ok(repos
            .into_iter()
            .map(|repo| GitHubRepository {
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
            })
            .collect())
    }

    /// Get specific repository information
    pub async fn get_repository_info(
        &self,
        access_token: &str,
        owner: &str,
        repo: &str,
    ) -> anyhow::Result<GitHubRepository> {
        let url = format!("https://api.github.com/repos/{}/{}", owner, repo);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("token {}", access_token))
            .header("User-Agent", "ai-coding-terminal")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to get repository info: {}",
                response.status()
            ));
        }

        #[derive(Deserialize)]
        struct GitHubRepoResponse {
            id: u64,
            name: String,
            full_name: String,
            owner: GitHubUserResponse,
            description: Option<String>,
            html_url: String,
            clone_url: String,
            ssh_url: String,
            private: bool,
            fork: bool,
            language: Option<String>,
            stargazers_count: u32,
            forks_count: u32,
            updated_at: String,
            pushed_at: Option<String>,
            size: u32,
            default_branch: String,
        }

        #[derive(Deserialize)]
        struct GitHubUserResponse {
            id: u64,
            login: String,
            avatar_url: String,
            html_url: String,
        }

        let repo_data: GitHubRepoResponse = response.json().await?;

        Ok(GitHubRepository {
            id: repo_data.id,
            name: repo_data.name,
            full_name: repo_data.full_name,
            owner: GitHubRepositoryOwner {
                id: repo_data.owner.id,
                login: repo_data.owner.login,
                avatar_url: repo_data.owner.avatar_url,
                html_url: repo_data.owner.html_url,
            },
            description: repo_data.description,
            html_url: repo_data.html_url,
            clone_url: repo_data.clone_url,
            ssh_url: repo_data.ssh_url,
            private: repo_data.private,
            fork: repo_data.fork,
            language: repo_data.language,
            stargazers_count: repo_data.stargazers_count,
            forks_count: repo_data.forks_count,
            updated_at: repo_data.updated_at,
            pushed_at: repo_data.pushed_at,
            size: repo_data.size,
            default_branch: repo_data.default_branch,
        })
    }
}

// Implement the GitHubRepositoryService trait directly, eliminating the adapter layer
#[async_trait::async_trait]
impl GitHubRepositoryService for GitHubService {
    async fn list_repositories(
        &self,
        access_token: &str,
        options: RepositoryListOptions,
    ) -> CoreResult<Vec<GitHubRepository>> {
        self.get_user_repositories(
            access_token,
            options.page,
            options.per_page,
            options.sort.as_deref(),
            options.type_filter.as_deref(),
        )
        .await
        .map_err(|e| act_core::CoreError::External(e.to_string()))
    }

    async fn get_repository(
        &self,
        access_token: &str,
        owner: &str,
        repo: &str,
    ) -> CoreResult<GitHubRepository> {
        self.get_repository_info(access_token, owner, repo)
            .await
            .map_err(|e| act_core::CoreError::External(e.to_string()))
    }
}
