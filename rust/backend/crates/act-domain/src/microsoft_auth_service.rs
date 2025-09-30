use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::microsoft_auth_types::{MicrosoftAuthRepository, MicrosoftAuthData, MicrosoftAuthRepositoryError};
use oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, RedirectUrl, Scope,
    TokenUrl, AuthorizationCode, PkceCodeVerifier, RefreshToken, TokenResponse,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{debug, error, info, warn};

use crate::{
    TokenEncryption, EncryptionError,
    GraphClient, GraphApiError,
    CreateTaskRequest, CreateListRequest, Task, TaskList,
};

#[derive(Debug, Error)]
pub enum MicrosoftAuthError {
    #[error("Encryption error: {0}")]
    Encryption(#[from] EncryptionError),

    #[error("Repository error: {0}")]
    Repository(#[from] MicrosoftAuthRepositoryError),

    #[error("Graph API error: {0}")]
    GraphApi(#[from] GraphApiError),

    #[error("OAuth error: {0}")]
    OAuth(String),

    #[error("Token expired")]
    TokenExpired,

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

/// OAuth configuration for Microsoft authentication
#[derive(Debug, Clone)]
pub struct MicrosoftOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub tenant_id: Option<String>, // Support for different tenant types (defaults to "common" for both personal and work accounts)
}

impl MicrosoftOAuthConfig {
    /// Create configuration from environment variables
    pub fn from_env() -> Result<Self, MicrosoftAuthError> {
        let client_id = std::env::var("MICROSOFT_CLIENT_ID")
            .map_err(|_| MicrosoftAuthError::InvalidConfig("MICROSOFT_CLIENT_ID not set".to_string()))?;

        let client_secret = std::env::var("MICROSOFT_CLIENT_SECRET")
            .map_err(|_| MicrosoftAuthError::InvalidConfig("MICROSOFT_CLIENT_SECRET not set".to_string()))?;

        let redirect_uri = std::env::var("MICROSOFT_REDIRECT_URI")
            .unwrap_or_else(|_| "http://localhost:3000/api/microsoft/callback".to_string());

        let tenant_id = std::env::var("MICROSOFT_TENANT_ID").ok(); // Defaults to "common" if not set

        Ok(Self {
            client_id,
            client_secret,
            redirect_uri,
            tenant_id,
        })
    }

    /// Get the authorization URL based on tenant configuration
    pub fn get_auth_url(&self) -> String {
        match &self.tenant_id {
            Some(tenant_id) if tenant_id == "common" || tenant_id == "consumers" => {
                format!("https://login.microsoftonline.com/{}/oauth2/v2.0/authorize", tenant_id)
            }
            Some(tenant_id) => {
                format!("https://login.microsoftonline.com/{}/oauth2/v2.0/authorize", tenant_id)
            }
            None => {
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string()
            }
        }
    }

    /// Get the token URL based on tenant configuration
    pub fn get_token_url(&self) -> String {
        match &self.tenant_id {
            Some(tenant_id) if tenant_id == "common" || tenant_id == "consumers" => {
                format!("https://login.microsoftonline.com/{}/oauth2/v2.0/token", tenant_id)
            }
            Some(tenant_id) => {
                format!("https://login.microsoftonline.com/{}/oauth2/v2.0/token", tenant_id)
            }
            None => {
                "https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string()
            }
        }
    }
}

/// OAuth authorization URL and state
#[derive(Debug, Serialize)]
pub struct AuthorizationUrl {
    pub url: String,
    pub state: String,
    pub code_verifier: String,
}

/// Token response from Microsoft
#[derive(Debug, Deserialize)]
pub struct MicrosoftTokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

/// Service for managing Microsoft authentication and To Do integration
#[derive(Clone)]
pub struct MicrosoftAuthService {
    repository: Arc<dyn MicrosoftAuthRepository>,
    encryption: Arc<dyn TokenEncryption>,
    graph_client: Arc<dyn GraphClient>,
    oauth_config: MicrosoftOAuthConfig,
}

impl MicrosoftAuthService {
    const SCOPES: &'static [&'static str] = &["Tasks.ReadWrite", "offline_access", "openid", "profile", "User.Read"];

    /// Minimum time before expiry to trigger token refresh (15 minutes)
    const REFRESH_BUFFER_SECONDS: i64 = 15 * 60;

    pub fn new(
        repository: Arc<dyn MicrosoftAuthRepository>,
        encryption: Arc<dyn TokenEncryption>,
        graph_client: Arc<dyn GraphClient>,
        oauth_config: MicrosoftOAuthConfig,
    ) -> Self {
        Self {
            repository,
            encryption,
            graph_client,
            oauth_config,
        }
    }

    /// Generate authorization URL for OAuth flow
    pub async fn get_authorization_url(&self) -> Result<AuthorizationUrl, MicrosoftAuthError> {
        debug!("Generating Microsoft OAuth authorization URL");

        let client = oauth2::basic::BasicClient::new(
            ClientId::new(self.oauth_config.client_id.clone()),
            Some(ClientSecret::new(self.oauth_config.client_secret.clone())),
            AuthUrl::new(self.oauth_config.get_auth_url())
                .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?,
            Some(TokenUrl::new(self.oauth_config.get_token_url())
                .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?),
        )
        .set_redirect_uri(
            RedirectUrl::new(self.oauth_config.redirect_uri.clone())
                .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?,
        );

        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let (auth_url, csrf_token) = client
            .authorize_url(CsrfToken::new_random)
            .add_scopes(Self::SCOPES.iter().map(|&s| Scope::new(s.to_string())))
            .set_pkce_challenge(pkce_challenge)
            .url();

        let auth_response = AuthorizationUrl {
            url: auth_url.to_string(),
            state: csrf_token.secret().clone(),
            code_verifier: pkce_verifier.secret().clone(),
        };

        debug!("Authorization URL generated successfully");
        Ok(auth_response)
    }

    /// Exchange authorization code for tokens and store them
    pub async fn handle_oauth_callback(
        &self,
        user_id: &str,
        code: &str,
        _state: &str,
        code_verifier: &str,
    ) -> Result<(), MicrosoftAuthError> {
        info!("Handling OAuth callback for user: {}", user_id);

        let client = oauth2::basic::BasicClient::new(
            ClientId::new(self.oauth_config.client_id.clone()),
            Some(ClientSecret::new(self.oauth_config.client_secret.clone())),
            AuthUrl::new(self.oauth_config.get_auth_url())
                .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?,
            Some(TokenUrl::new(self.oauth_config.get_token_url())
                .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?),
        )
        .set_redirect_uri(
            RedirectUrl::new(self.oauth_config.redirect_uri.clone())
                .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?,
        );

        let pkce_verifier = PkceCodeVerifier::new(code_verifier.to_string());

        // Exchange authorization code for tokens
        let token_result = client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .set_pkce_verifier(pkce_verifier)
            .request_async(oauth2::reqwest::async_http_client)
            .await
            .map_err(|e| {
                error!("Microsoft token exchange failed: {:?}", e);
                MicrosoftAuthError::OAuth(format!("Token exchange failed: {:?}", e))
            })?;

        let access_token = token_result.access_token().secret();
        let refresh_token = token_result.refresh_token()
            .ok_or_else(|| MicrosoftAuthError::OAuth("No refresh token received".to_string()))?
            .secret();

        let expires_in = token_result.expires_in()
            .ok_or_else(|| MicrosoftAuthError::OAuth("No expiry information received".to_string()))?;

        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64 + expires_in.as_secs() as i64;

        // Encrypt tokens
        let access_token_encrypted = self.encryption.encrypt_token(access_token, user_id).await?;
        let refresh_token_encrypted = self.encryption.encrypt_token(refresh_token, user_id).await?;

        // Get user info from Microsoft Graph
        let (microsoft_user_id, microsoft_email) = match self.get_user_info(access_token).await {
            Ok((user_id, email)) => (Some(user_id), Some(email)),
            Err(e) => {
                warn!("Failed to get user info from Microsoft Graph: {}", e);
                (None, None)
            }
        };

        // Store encrypted tokens
        self.repository.store_auth_tokens(
            user_id,
            access_token_encrypted.as_bytes(),
            refresh_token_encrypted.as_bytes(),
            expires_at,
            microsoft_user_id.as_deref(),
            microsoft_email.as_deref(),
        ).await?;

        info!("Microsoft authentication completed for user: {}", user_id);
        Ok(())
    }

    /// Get current access token, refreshing if necessary
    pub async fn get_access_token(&self, user_id: &str) -> Result<String, MicrosoftAuthError> {
        debug!("Getting access token for user: {}", user_id);

        let auth_data = self.repository.get_auth_data(user_id).await?
            .ok_or(MicrosoftAuthError::NotAuthenticated)?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Check if token needs refreshing
        if auth_data.token_expires_at <= now + Self::REFRESH_BUFFER_SECONDS {
            debug!("Token expiring soon, refreshing for user: {}", user_id);

            // Attempt to refresh the token
            match self.refresh_token_internal(&auth_data).await {
                Ok(()) => {
                    // Get updated auth data
                    let auth_data = self.repository.get_auth_data(user_id).await?
                        .ok_or(MicrosoftAuthError::NotAuthenticated)?;

                    let access_token = self.encryption.decrypt_token(
                        &String::from_utf8_lossy(&auth_data.access_token_encrypted),
                        user_id,
                    ).await?;

                    debug!("Successfully refreshed access token for user: {}", user_id);
                    Ok(access_token)
                }
                Err(refresh_error) => {
                    error!("Failed to refresh token for user {}: {}", user_id, refresh_error);

                    // If refresh fails, remove the auth data to force re-authentication
                    if let Err(remove_error) = self.repository.remove_auth(user_id).await {
                        error!("Failed to remove invalid auth for user {}: {}", user_id, remove_error);
                    }

                    Err(MicrosoftAuthError::TokenExpired)
                }
            }
        } else {
            let access_token = self.encryption.decrypt_token(
                &String::from_utf8_lossy(&auth_data.access_token_encrypted),
                user_id,
            ).await?;

            debug!("Using existing access token for user: {}", user_id);
            Ok(access_token)
        }
    }

    /// Disconnect Microsoft account for a user
    pub async fn disconnect(&self, user_id: &str) -> Result<(), MicrosoftAuthError> {
        info!("Disconnecting Microsoft account for user: {}", user_id);

        self.repository.remove_auth(user_id).await?;

        info!("Microsoft account disconnected for user: {}", user_id);
        Ok(())
    }

    /// Check if user has Microsoft authentication
    pub async fn is_authenticated(&self, user_id: &str) -> Result<bool, MicrosoftAuthError> {
        match self.repository.get_auth_data(user_id).await? {
            Some(_) => Ok(true),
            None => Ok(false),
        }
    }


    /// Proactively refresh expiring tokens for all users
    pub async fn refresh_expiring_tokens(&self) -> Result<(), MicrosoftAuthError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let expires_before = now + Self::REFRESH_BUFFER_SECONDS;

        let user_ids = self.repository.get_users_with_expiring_tokens(expires_before).await?;

        info!("Found {} users with expiring tokens", user_ids.len());

        for user_id in user_ids {
            if let Err(e) = self.refresh_user_token(&user_id).await {
                error!("Failed to refresh token for user {}: {}", user_id, e);
            }
        }

        Ok(())
    }

    // Private helper methods

    async fn refresh_user_token(&self, user_id: &str) -> Result<(), MicrosoftAuthError> {
        debug!("Refreshing token for user: {}", user_id);

        let auth_data = self.repository.get_auth_data(user_id).await?
            .ok_or(MicrosoftAuthError::NotAuthenticated)?;

        self.refresh_token_internal(&auth_data).await
    }

    async fn refresh_token_internal(&self, auth_data: &MicrosoftAuthData) -> Result<(), MicrosoftAuthError> {
        let refresh_token = self.encryption.decrypt_token(
            &String::from_utf8_lossy(&auth_data.refresh_token_encrypted),
            &auth_data.user_id,
        ).await?;

        let client = oauth2::basic::BasicClient::new(
            ClientId::new(self.oauth_config.client_id.clone()),
            Some(ClientSecret::new(self.oauth_config.client_secret.clone())),
            AuthUrl::new(self.oauth_config.get_auth_url())
                .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?,
            Some(TokenUrl::new(self.oauth_config.get_token_url())
                .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?),
        );

        let token_result = client
            .exchange_refresh_token(&RefreshToken::new(refresh_token))
            .request_async(oauth2::reqwest::async_http_client)
            .await
            .map_err(|e| MicrosoftAuthError::OAuth(e.to_string()))?;

        let new_access_token = token_result.access_token().secret();
        let expires_in = token_result.expires_in()
            .ok_or_else(|| MicrosoftAuthError::OAuth("No expiry information received".to_string()))?;

        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64 + expires_in.as_secs() as i64;

        let access_token_encrypted = self.encryption.encrypt_token(new_access_token, &auth_data.user_id).await?;

        self.repository.update_access_token(
            &auth_data.user_id,
            access_token_encrypted.as_bytes(),
            expires_at,
        ).await?;

        debug!("Token refreshed successfully for user: {}", auth_data.user_id);
        Ok(())
    }

    async fn get_user_info(&self, access_token: &str) -> Result<(String, String), GraphApiError> {
        debug!("Getting user info from Microsoft Graph");

        // Use the Graph client to get user information - we need to make a direct HTTP request
        // since the GraphClient trait is specific to To Do operations
        let client = reqwest::Client::new();
        let response = client
            .get("https://graph.microsoft.com/v1.0/me")
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(GraphApiError::NetworkError)?;

        if !response.status().is_success() {
            return Err(GraphApiError::RequestFailed {
                status: response.status().as_u16(),
                message: format!("Failed to get user info: {}", response.status()),
            });
        }

        let user_info: serde_json::Value = response.json().await
            .map_err(|e| GraphApiError::RequestFailed {
                status: 500,
                message: format!("Failed to parse user info: {}", e),
            })?;

        let microsoft_user_id = user_info["id"]
            .as_str()
            .ok_or_else(|| GraphApiError::RequestFailed {
                status: 500,
                message: "User ID not found in response".to_string(),
            })?
            .to_string();

        let microsoft_email = user_info["mail"]
            .as_str()
            .or_else(|| user_info["userPrincipalName"].as_str())
            .ok_or_else(|| GraphApiError::RequestFailed {
                status: 500,
                message: "Email not found in response".to_string(),
            })?
            .to_string();

        debug!("Retrieved user info: ID={}, Email={}", microsoft_user_id, microsoft_email);
        Ok((microsoft_user_id, microsoft_email))
    }

    /// Get all task lists for the user (including default and workspace-specific lists)
    pub async fn get_all_task_lists(&self, user_id: &str) -> Result<Vec<TaskList>, MicrosoftAuthError> {
        debug!("Getting all task lists for user: {}", user_id);

        let access_token = self.get_access_token(user_id).await?;
        let lists = self.graph_client.get_task_lists(&access_token).await?;

        debug!("Retrieved {} task lists for user {}", lists.len(), user_id);
        Ok(lists)
    }

    /// Get tasks from any specific list ID (not just workspace lists)
    pub async fn get_list_tasks(&self, user_id: &str, list_id: &str) -> Result<Vec<Task>, MicrosoftAuthError> {
        debug!("Getting tasks from list {} for user: {}", list_id, user_id);

        let access_token = self.get_access_token(user_id).await?;
        let tasks = self.graph_client.get_tasks(&access_token, list_id).await?;

        debug!("Retrieved {} tasks from list {} for user {}", tasks.len(), list_id, user_id);
        Ok(tasks)
    }

    /// Get the user's default "Tasks" list (wellknown list)
    pub async fn get_default_task_list(&self, user_id: &str) -> Result<Option<TaskList>, MicrosoftAuthError> {
        debug!("Getting default task list for user: {}", user_id);

        match self.get_all_task_lists(user_id).await {
            Ok(all_lists) => {
                // Look for the default "Tasks" list - it's marked with wellknown_list_name
                let default_list = all_lists.into_iter()
                    .find(|list| {
                        list.wellknown_list_name.as_ref()
                            .is_some_and(|name| name == "defaultList")
                            || list.display_name == "Tasks"
                    });

                if let Some(ref list) = default_list {
                    debug!("Found default task list '{}' ({}) for user {}", list.display_name, list.id, user_id);
                } else {
                    debug!("No default task list found for user {}", user_id);
                }

                Ok(default_list)
            }
            Err(MicrosoftAuthError::GraphApi(crate::GraphApiError::NotFound { resource })) => {
                warn!("Task lists not found for user {}: {}", user_id, resource);
                Ok(None)
            }
            Err(e) => Err(e)
        }
    }

    /// Create a new task list for the user
    pub async fn create_task_list(&self, user_id: &str, display_name: &str) -> Result<TaskList, MicrosoftAuthError> {
        debug!("Creating task list '{}' for user: {}", display_name, user_id);

        let access_token = self.get_access_token(user_id).await?;
        let create_request = CreateListRequest {
            display_name: display_name.to_string(),
        };

        let task_list = self.graph_client.create_task_list(&access_token, create_request).await?;

        info!("Created task list '{}' ({}) for user {}", task_list.display_name, task_list.id, user_id);
        Ok(task_list)
    }

    /// Create a task in any list (not just workspace lists)
    pub async fn create_task_in_list(
        &self,
        user_id: &str,
        list_id: &str,
        task_request: CreateTaskRequest,
    ) -> Result<Task, MicrosoftAuthError> {
        debug!("Creating task '{}' in list {} for user {}", task_request.title, list_id, user_id);

        let access_token = self.get_access_token(user_id).await?;
        let task = self.graph_client.create_task(&access_token, list_id, task_request).await?;

        info!("Created task '{}' ({}) in list {} for user {}", task.title, task.id, list_id, user_id);
        Ok(task)
    }

    /// Update a task in any list
    pub async fn update_task(
        &self,
        user_id: &str,
        list_id: &str,
        task_id: &str,
        task_request: CreateTaskRequest,
    ) -> Result<Task, MicrosoftAuthError> {
        debug!("Updating task '{}' in list {} for user {}", task_request.title, list_id, user_id);

        let access_token = self.get_access_token(user_id).await?;
        let task = self.graph_client.update_task(&access_token, list_id, task_id, task_request).await?;

        info!("Updated task '{}' ({}) in list {} for user {}", task.title, task.id, list_id, user_id);
        Ok(task)
    }

    /// Delete a task from any list
    pub async fn delete_task(
        &self,
        user_id: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<(), MicrosoftAuthError> {
        debug!("Deleting task {} from list {} for user {}", task_id, list_id, user_id);

        let access_token = self.get_access_token(user_id).await?;
        self.graph_client.delete_task(&access_token, list_id, task_id).await?;

        info!("Deleted task {} from list {} for user {}", task_id, list_id, user_id);
        Ok(())
    }

    /// Perform a health check on the Microsoft Graph integration
    ///
    /// This method verifies that:
    /// - Configuration is valid
    /// - Graph API is accessible
    /// - Authentication is working for the specified user
    pub async fn health_check(&self, user_id: &str) -> Result<MicrosoftHealthStatus, MicrosoftAuthError> {
        debug!("Performing Microsoft Graph health check for user: {}", user_id);

        // Check if user is authenticated
        let is_auth = self.is_authenticated(user_id).await?;
        if !is_auth {
            return Ok(MicrosoftHealthStatus {
                authenticated: false,
                graph_accessible: false,
                configuration_valid: true,
                user_email: None,
                error: None,
            });
        }

        // Try to get access token
        let access_token = match self.get_access_token(user_id).await {
            Ok(token) => token,
            Err(e) => {
                return Ok(MicrosoftHealthStatus {
                    authenticated: false,
                    graph_accessible: false,
                    configuration_valid: true,
                    user_email: None,
                    error: Some(format!("Failed to get access token: {}", e)),
                });
            }
        };

        // Try to access Graph API
        match self.get_user_info(&access_token).await {
            Ok(_) => {
                // Get user info for detailed status
                if let Ok(Some(auth_data)) = self.repository.get_auth_data(user_id).await {
                    return Ok(MicrosoftHealthStatus {
                        authenticated: true,
                        graph_accessible: true,
                        configuration_valid: true,
                        user_email: auth_data.microsoft_email,
                        error: None,
                    });
                }
            }
            Err(e) => {
                return Ok(MicrosoftHealthStatus {
                    authenticated: true,
                    graph_accessible: false,
                    configuration_valid: true,
                    user_email: None,
                    error: Some(format!("Graph API access failed: {}", e)),
                });
            }
        }

        Ok(MicrosoftHealthStatus {
            authenticated: true,
            graph_accessible: true,
            configuration_valid: true,
            user_email: None,
            error: None,
        })
    }
}

/// Health status for Microsoft Graph integration
#[derive(Debug, Clone, Serialize)]
pub struct MicrosoftHealthStatus {
    pub authenticated: bool,
    pub graph_accessible: bool,
    pub configuration_valid: bool,
    pub user_email: Option<String>,
    pub error: Option<String>,
}