use std::sync::Arc;
use act_core::{
    Result, GitHubRepositoryService, GitHubRepository, RepositoryListOptions,
    AuthRepository
};

pub struct GitHubService {
    github_repo_service: Arc<dyn GitHubRepositoryService>,
    auth_repository: Arc<dyn AuthRepository>,
}

#[derive(Debug)]
pub struct RepositoryQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    pub sort: Option<String>,
    pub type_filter: Option<String>,
    pub search: Option<String>,
}

impl GitHubService {
    pub fn new(
        github_repo_service: Arc<dyn GitHubRepositoryService>,
        auth_repository: Arc<dyn AuthRepository>,
    ) -> Self {
        Self {
            github_repo_service,
            auth_repository,
        }
    }

    pub async fn list_user_repositories(
        &self,
        user_id: &str,
        query: RepositoryQuery,
    ) -> Result<Vec<GitHubRepository>> {
        tracing::debug!("Looking up GitHub token for user_id: {}", user_id);
        // Get the user's GitHub access token
        let access_token = self.auth_repository
            .get_github_token(user_id)
            .await?
            .ok_or_else(|| act_core::CoreError::NotFound(format!("GitHub token not found for user {}", user_id)))?;

        let options = RepositoryListOptions {
            page: query.page,
            per_page: query.per_page,
            sort: query.sort,
            type_filter: query.type_filter,
        };

        let mut repositories = self.github_repo_service
            .list_repositories(&access_token, options)
            .await?;

        // Apply search filter if provided
        if let Some(search_term) = query.search {
            let search_lower = search_term.to_lowercase();
            repositories.retain(|repo| {
                repo.name.to_lowercase().contains(&search_lower) ||
                repo.full_name.to_lowercase().contains(&search_lower) ||
                repo.description.as_ref().is_some_and(|desc| desc.to_lowercase().contains(&search_lower))
            });
        }

        Ok(repositories)
    }

    pub async fn get_repository_info(
        &self,
        user_id: &str,
        owner: &str,
        repo: &str,
    ) -> Result<GitHubRepository> {
        // Get the user's GitHub access token
        let access_token = self.auth_repository
            .get_github_token(user_id)
            .await?
            .ok_or_else(|| act_core::CoreError::NotFound("GitHub token not found for user".to_string()))?;

        self.github_repo_service
            .get_repository(&access_token, owner, repo)
            .await
    }
}