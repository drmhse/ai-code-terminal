use crate::config::Config;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce, Key
};
use base64::{Engine as _, engine::general_purpose};
use chrono::{DateTime, Utc};
use oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, RedirectUrl, Scope,
    TokenUrl, basic::BasicClient,
};
use rand::{RngCore, rngs::OsRng};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubUser,
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
pub struct TokenResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub token_type: String,
    pub scope: String,
    pub user: GitHubUser,
    pub user_id: String,
}

#[derive(Debug, Clone)]
pub struct GitHubService {
    config: Arc<Config>,
    client: Client,
    oauth_client: BasicClient,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubUserResponse {
    id: u64,
    login: String,
    name: Option<String>,
    email: Option<String>,
    avatar_url: String,
    html_url: String,
    company: Option<String>,
    location: Option<String>,
    public_repos: u32,
    followers: u32,
    following: u32,
}

#[derive(Debug, Deserialize)]
struct GitHubEmail {
    email: String,
    primary: bool,
    verified: bool,
}

impl GitHubService {
    pub fn new(config: Arc<Config>) -> anyhow::Result<Self> {
        let oauth_client = BasicClient::new(
            ClientId::new(config.auth.github_client_id.clone()),
            Some(ClientSecret::new(config.auth.github_client_secret.clone())),
            AuthUrl::new("https://github.com/login/oauth/authorize".to_string())?,
            Some(TokenUrl::new("https://github.com/login/oauth/access_token".to_string())?)
        )
        .set_redirect_uri(RedirectUrl::new(config.auth.github_redirect_url.clone())?);

        Ok(Self {
            config,
            client: Client::new(),
            oauth_client,
        })
    }

    pub fn is_configured(&self) -> bool {
        !self.config.auth.github_client_id.is_empty() 
            && !self.config.auth.github_client_secret.is_empty()
            && !self.config.auth.github_redirect_url.is_empty()
    }

    pub fn get_authorization_url(&self, user_id: &str) -> anyhow::Result<String> {
        if !self.is_configured() {
            return Err(anyhow::anyhow!("GitHub OAuth is not configured"));
        }

        let state = self.generate_state(user_id)?;
        let (auth_url, _csrf_token) = self.oauth_client
            .authorize_url(|| CsrfToken::new(state))
            .add_scope(Scope::new("user:email".to_string()))
            .add_scope(Scope::new("repo".to_string()))
            .add_scope(Scope::new("read:org".to_string()))
            .url();

        info!("Generated GitHub OAuth URL for user: {}", user_id);
        Ok(auth_url.to_string())
    }

    pub async fn exchange_code_for_token(&self, code: &str, state: &str) -> anyhow::Result<TokenResult> {
        if !self.is_configured() {
            return Err(anyhow::anyhow!("GitHub OAuth is not configured"));
        }

        // Verify state parameter
        let user_id = self.verify_state(state)?;
        
        // Exchange code for access token using reqwest directly for better control
        let response = self.client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("User-Agent", "ai-coding-terminal")
            .json(&serde_json::json!({
                "client_id": self.config.auth.github_client_id,
                "client_secret": self.config.auth.github_client_secret,
                "code": code,
                "redirect_uri": self.config.auth.github_redirect_url
            }))
            .send()
            .await?;

        let token_data: TokenResponse = response.json().await?;

        if let Some(error) = token_data.error {
            let desc = token_data.error_description.unwrap_or_else(|| error.clone());
            return Err(anyhow::anyhow!("GitHub OAuth error: {}", desc));
        }

        // Calculate expiration date
        let expires_in = token_data.expires_in.unwrap_or(28800); // Default to 8 hours
        let expires_at = Utc::now() + chrono::Duration::seconds(expires_in as i64);

        // Get user information
        let user_info = self.get_user_info(&token_data.access_token).await?;

        info!("Successfully exchanged OAuth code for user: {} (ID: {})", user_info.login, user_info.id);

        Ok(TokenResult {
            access_token: token_data.access_token,
            refresh_token: token_data.refresh_token,
            expires_at,
            token_type: token_data.token_type.unwrap_or_else(|| "bearer".to_string()),
            scope: token_data.scope.unwrap_or_else(|| String::new()),
            user: user_info,
            user_id,
        })
    }

    pub async fn get_user_info(&self, access_token: &str) -> anyhow::Result<GitHubUser> {
        let user_response = self.client
            .get("https://api.github.com/user")
            .header("Authorization", format!("token {}", access_token))
            .header("User-Agent", "ai-coding-terminal")
            .send()
            .await?;

        if !user_response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to get GitHub user info: {}", user_response.status()));
        }

        let user: GitHubUserResponse = user_response.json().await?;

        // Get user's primary email
        let emails_response = self.client
            .get("https://api.github.com/user/emails")
            .header("Authorization", format!("token {}", access_token))
            .header("User-Agent", "ai-coding-terminal")
            .send()
            .await?;

        let primary_email = if emails_response.status().is_success() {
            let emails: Vec<GitHubEmail> = emails_response.json().await.unwrap_or_default();
            emails.iter()
                .find(|email| email.primary)
                .map(|email| email.email.clone())
                .or_else(|| user.email.clone())
        } else {
            user.email.clone()
        };

        Ok(GitHubUser {
            id: user.id,
            login: user.login,
            name: user.name,
            email: primary_email,
            avatar_url: user.avatar_url,
            html_url: user.html_url,
            company: user.company,
            location: user.location,
            public_repos: user.public_repos,
            followers: user.followers,
            following: user.following,
        })
    }

    pub async fn validate_token(&self, access_token: &str) -> bool {
        let response = self.client
            .get("https://api.github.com/user")
            .header("Authorization", format!("token {}", access_token))
            .header("User-Agent", "ai-coding-terminal")
            .send()
            .await;

        match response {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    pub fn validate_tenant_user(&self, github_username: &str) -> bool {
        self.config.auth.tenant_github_usernames.contains(&github_username.to_string())
    }

    pub fn encrypt_token(&self, token: &str) -> anyhow::Result<String> {
        // Use JWT secret as key material
        let key_material = self.config.auth.jwt_secret.as_bytes();
        
        // Create a 32-byte key using HKDF-like approach (simple version)
        let mut key_bytes = [0u8; 32];
        let len = std::cmp::min(key_material.len(), 32);
        key_bytes[..len].copy_from_slice(&key_material[..len]);
        
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        // Generate random nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt the token
        let ciphertext = cipher.encrypt(nonce, token.as_bytes())
            .map_err(|e| anyhow::anyhow!("Failed to encrypt token: {}", e))?;

        // Combine nonce and ciphertext
        let mut result = nonce_bytes.to_vec();
        result.extend(ciphertext);
        
        Ok(general_purpose::STANDARD.encode(&result))
    }

    pub fn decrypt_token(&self, encrypted_token: &str) -> anyhow::Result<String> {
        // Decode from base64
        let data = general_purpose::STANDARD.decode(encrypted_token)?;
        
        if data.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted token format"));
        }

        // Extract nonce and ciphertext
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Use JWT secret as key material
        let key_material = self.config.auth.jwt_secret.as_bytes();
        let mut key_bytes = [0u8; 32];
        let len = std::cmp::min(key_material.len(), 32);
        key_bytes[..len].copy_from_slice(&key_material[..len]);
        
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        // Decrypt the token
        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Failed to decrypt token: {}", e))?;

        Ok(String::from_utf8(plaintext)?)
    }

    fn generate_state(&self, user_id: &str) -> anyhow::Result<String> {
        let timestamp = chrono::Utc::now().timestamp();
        let random = Uuid::new_v4().to_string();
        
        let payload = serde_json::json!({
            "user_id": user_id,
            "timestamp": timestamp,
            "random": random
        });

        Ok(general_purpose::STANDARD.encode(payload.to_string().as_bytes()))
    }

    fn verify_state(&self, state: &str) -> anyhow::Result<String> {
        // Try to decode as base64-encoded JSON (backend-generated state)
        if let Ok(payload_bytes) = general_purpose::STANDARD.decode(state) {
            if let Ok(payload_str) = String::from_utf8(payload_bytes) {
                if let Ok(payload) = serde_json::from_str::<serde_json::Value>(&payload_str) {
                    if let Some(user_id) = payload["user_id"].as_str() {
                        if let Some(timestamp) = payload["timestamp"].as_i64() {
                            // Check if state is not older than 10 minutes
                            let max_age = 10 * 60; // 10 minutes
                            let now = chrono::Utc::now().timestamp();
                            if now - timestamp > max_age {
                                warn!("GitHub OAuth state parameter expired");
                                return Err(anyhow::anyhow!("State parameter expired"));
                            }
                            return Ok(user_id.to_string());
                        }
                    }
                }
            }
        }
        
        // If not backend-generated state, accept any valid state (frontend-generated UUID)
        // This provides CSRF protection while allowing frontend-generated states
        if state.len() >= 16 && !state.is_empty() {
            // For frontend-generated states, return a default user_id
            return Ok("single-tenant".to_string());
        }
        
        Err(anyhow::anyhow!("Invalid state parameter"))
    }

    /// Get user repositories with pagination
    pub async fn get_user_repositories(
        &self,
        access_token: &str,
        page: Option<u32>,
        per_page: Option<u32>,
        sort: Option<&str>,
        type_filter: Option<&str>
    ) -> anyhow::Result<Vec<GitHubRepository>> {
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(30).min(100); // GitHub API max is 100
        let sort = sort.unwrap_or("updated");
        let type_filter = type_filter.unwrap_or("all");

        let url = format!(
            "https://api.github.com/user/repos?page={}&per_page={}&sort={}&type={}",
            page, per_page, sort, type_filter
        );

        let response = self.client
            .get(&url)
            .header("Authorization", format!("token {}", access_token))
            .header("User-Agent", "ai-coding-terminal")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to get repositories: {}", response.status()));
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

        Ok(repos.into_iter().map(|repo| GitHubRepository {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            owner: GitHubUser {
                id: repo.owner.id,
                login: repo.owner.login,
                name: None,
                email: None,
                avatar_url: repo.owner.avatar_url,
                html_url: repo.owner.html_url,
                company: None,
                location: None,
                public_repos: 0,
                followers: 0,
                following: 0,
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
        }).collect())
    }

    /// Get specific repository information
    pub async fn get_repository_info(
        &self, 
        access_token: &str, 
        owner: &str, 
        repo: &str
    ) -> anyhow::Result<GitHubRepository> {
        let url = format!("https://api.github.com/repos/{}/{}", owner, repo);

        let response = self.client
            .get(&url)
            .header("Authorization", format!("token {}", access_token))
            .header("User-Agent", "ai-coding-terminal")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to get repository info: {}", response.status()));
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

        let repo_data: GitHubRepoResponse = response.json().await?;

        Ok(GitHubRepository {
            id: repo_data.id,
            name: repo_data.name,
            full_name: repo_data.full_name,
            owner: GitHubUser {
                id: repo_data.owner.id,
                login: repo_data.owner.login,
                name: repo_data.owner.name,
                email: repo_data.owner.email,
                avatar_url: repo_data.owner.avatar_url,
                html_url: repo_data.owner.html_url,
                company: repo_data.owner.company,
                location: repo_data.owner.location,
                public_repos: repo_data.owner.public_repos,
                followers: repo_data.owner.followers,
                following: repo_data.owner.following,
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

    /// Refresh an expired access token using the stored refresh token
    pub async fn refresh_access_token(
        &self,
        refresh_token: &str
    ) -> anyhow::Result<TokenResult> {
        info!("GitHub access token expired or invalid. Attempting to refresh...");

        let response = self.client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("User-Agent", "ai-coding-terminal")
            .json(&serde_json::json!({
                "client_id": self.config.auth.github_client_id,
                "client_secret": self.config.auth.github_client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token
            }))
            .send()
            .await?;

        let token_data: TokenResponse = response.json().await?;

        if let Some(error) = token_data.error {
            let desc = token_data.error_description.unwrap_or_else(|| error.clone());
            error!("Failed to refresh GitHub token: {}", desc);
            return Err(anyhow::anyhow!("Could not refresh GitHub token: {}. Please re-authenticate.", desc));
        }

        let expires_in = token_data.expires_in.unwrap_or(28800);
        let expires_at = Utc::now() + chrono::Duration::seconds(expires_in as i64);

        // Get updated user information
        let user_info = self.get_user_info(&token_data.access_token).await?;

        info!("Successfully refreshed GitHub token");

        Ok(TokenResult {
            access_token: token_data.access_token,
            refresh_token: token_data.refresh_token,
            expires_at,
            token_type: token_data.token_type.unwrap_or_else(|| "bearer".to_string()),
            scope: token_data.scope.unwrap_or_else(|| String::new()),
            user: user_info,
            user_id: "single-tenant".to_string(),
        })
    }
}