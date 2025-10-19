use act_core::{GitHubRepository, GitHubRepositoryService, RepositoryListOptions, Result};
use std::sync::Arc;

pub struct GitHubService {
    github_repo_service: Arc<dyn GitHubRepositoryService>,
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
    pub fn new(github_repo_service: Arc<dyn GitHubRepositoryService>) -> Self {
        Self {
            github_repo_service,
        }
    }

    /// List repositories using a GitHub access token (from SSO session)
    pub async fn list_user_repositories(
        &self,
        access_token: &str,
        query: RepositoryQuery,
    ) -> Result<Vec<GitHubRepository>> {
        tracing::debug!("Listing GitHub repositories with SSO token");

        let options = RepositoryListOptions {
            page: query.page,
            per_page: query.per_page,
            sort: query.sort,
            type_filter: query.type_filter,
        };

        let mut repositories = self
            .github_repo_service
            .list_repositories(access_token, options)
            .await?;

        // Apply search filter if provided
        if let Some(search_term) = query.search {
            let search_lower = search_term.to_lowercase();
            repositories.retain(|repo| {
                repo.name.to_lowercase().contains(&search_lower)
                    || repo.full_name.to_lowercase().contains(&search_lower)
                    || repo
                        .description
                        .as_ref()
                        .is_some_and(|desc| desc.to_lowercase().contains(&search_lower))
            });
        }

        Ok(repositories)
    }

    /// Get repository info using a GitHub access token (from SSO session)
    pub async fn get_repository_info(
        &self,
        access_token: &str,
        owner: &str,
        repo: &str,
    ) -> Result<GitHubRepository> {
        self.github_repo_service
            .get_repository(access_token, owner, repo)
            .await
    }
}
