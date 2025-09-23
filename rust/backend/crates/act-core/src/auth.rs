use async_trait::async_trait;
use crate::error::Result;
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JwtClaims {
    pub sub: String,
    pub github_username: String,  // GitHub username  
    pub username: String,  // GitHub username (for compatibility)
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub user_id: String,
    pub github_token: Option<String>,
    pub github_refresh_token: Option<String>,
    pub github_token_expires_at: Option<DateTime<Utc>>,
    pub theme: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub jwt_secret: String,
    pub allowed_users: Option<Vec<String>>,
}

#[async_trait]
pub trait GitHubAuthService: Send + Sync {
    async fn get_authorization_url(&self, state: &str) -> Result<String>;
    async fn exchange_code_for_token(&self, code: &str, state: &str) -> Result<AuthToken>;
    async fn refresh_access_token(&self, refresh_token: &str) -> Result<AuthToken>;
    async fn validate_token(&self, token: &str) -> Result<bool>;
    async fn get_user_info(&self, token: &str) -> Result<AuthenticatedUser>;
    async fn revoke_token(&self, token: &str) -> Result<()>;
    fn validate_tenant_user(&self, username: &str) -> bool;
    fn is_configured(&self) -> bool;
}

#[async_trait]
pub trait JwtService: Send + Sync {
    fn generate_token(&self, user: &AuthenticatedUser) -> Result<String>;
    fn validate_token(&self, token: &str) -> Result<JwtClaims>;
    fn is_token_expired(&self, claims: &JwtClaims) -> bool;
}

#[async_trait]
pub trait AuthRepository: Send + Sync {
    async fn find_user_by_github_id(&self, github_id: &str) -> Result<Option<AuthenticatedUser>>;
    async fn create_user(&self, github_id: &str, username: &str, email: Option<String>, avatar_url: Option<String>) -> Result<AuthenticatedUser>;
    async fn update_user(&self, user_id: &str, username: &str, email: Option<String>, avatar_url: Option<String>) -> Result<AuthenticatedUser>;
    async fn store_github_token(&self, user_id: &str, token: &str, refresh_token: Option<String>, expires_at: DateTime<Utc>) -> Result<()>;
    async fn get_github_token(&self, user_id: &str) -> Result<Option<String>>;
    async fn get_github_refresh_token(&self, user_id: &str) -> Result<Option<String>>;
    async fn is_github_token_expired(&self, user_id: &str) -> Result<bool>;
    async fn clear_github_tokens(&self, user_id: &str) -> Result<()>;
    async fn is_github_authenticated(&self, user_id: &str) -> Result<bool>;
    async fn get_user_settings(&self, user_id: &str) -> Result<Option<UserSettings>>;
    async fn update_user_settings(&self, user_id: &str, settings: &UserSettings) -> Result<()>;
    async fn get_all_users(&self) -> Result<Vec<AuthenticatedUser>>;
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
    async fn list_repositories(&self, access_token: &str, options: RepositoryListOptions) -> Result<Vec<GitHubRepository>>;
    async fn get_repository(&self, access_token: &str, owner: &str, repo: &str) -> Result<GitHubRepository>;
}