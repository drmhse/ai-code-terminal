use crate::error::Result;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub username: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub user: AuthenticatedUser,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub user_id: String,
    pub theme: Option<String>,
}

#[async_trait]
pub trait AuthRepository: Send + Sync {
    async fn update_user(
        &self,
        user_id: &str,
        username: &str,
        email: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<AuthenticatedUser>;

    async fn get_user_settings(&self, user_id: &str) -> Result<Option<UserSettings>>;
    async fn update_user_settings(&self, user_id: &str, settings: &UserSettings) -> Result<()>;
    async fn get_all_users(&self) -> Result<Vec<AuthenticatedUser>>;
    /// Find or create user by SSO ID and email - primary method for SSO authentication
    async fn find_or_create_user_by_sso_id_and_email(
        &self,
        sso_id: &str,
        email: &str,
    ) -> Result<AuthenticatedUser>;
    /// Delete all SSO sessions for a user (used for logout)
    async fn delete_sso_sessions(&self, user_id: &str) -> Result<()>;
}

// GitHub Repository data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubRepositoryOwner,
    pub description: Option<String>,
    pub html_url: String,
    pub clone_url: String,
    pub ssh_url: String,
    pub private: bool,
    pub fork: bool,
    pub language: Option<String>,
    pub stargazers_count: u32,
    pub forks_count: u32,
    pub updated_at: String,
    pub pushed_at: Option<String>,
    pub size: u32,
    pub default_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepositoryOwner {
    pub id: u64,
    pub login: String,
    pub avatar_url: String,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: String,
    pub html_url: String,
    pub company: Option<String>,
    pub location: Option<String>,
    pub public_repos: u32,
    pub followers: u32,
    pub following: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RepositoryListOptions {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    pub sort: Option<String>,
    pub type_filter: Option<String>,
}

#[async_trait]
pub trait GitHubRepositoryService: Send + Sync {
    async fn list_repositories(
        &self,
        access_token: &str,
        options: RepositoryListOptions,
    ) -> Result<Vec<GitHubRepository>>;
    async fn get_repository(
        &self,
        access_token: &str,
        owner: &str,
        repo: &str,
    ) -> Result<GitHubRepository>;
}
