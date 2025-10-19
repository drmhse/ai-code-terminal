use std::sync::Arc;

use base64::Engine;
use serde::Serialize;
use thiserror::Error;

use crate::{
    EncryptionError, GraphApiError, GraphClient, MicrosoftAuthRepository,
    MicrosoftAuthRepositoryError, TokenEncryption,
};

#[derive(Debug, Error)]
pub enum MicrosoftAuthError {
    #[error("Encryption error: {0}")]
    Encryption(#[from] EncryptionError),

    #[error("Graph API error: {0}")]
    GraphApi(#[from] GraphApiError),

    #[error("Repository error: {0}")]
    Repository(#[from] MicrosoftAuthRepositoryError),

    #[error("OAuth error: {0}")]
    OAuth(String),

    #[error("Token expired")]
    TokenExpired,

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

/// Service for managing Microsoft To Do integration
///
/// # Architecture Notes
/// - **User-initiated requests**: Routes get tokens from SSO and pass directly to graph_client
/// - **Background sync**: Uses cached tokens from repository (populated by routes)
///
/// This service provides:
/// 1. Access to Graph API client
/// 2. Token retrieval from repository for background sync operations
#[derive(Clone)]
pub struct MicrosoftAuthService {
    pub graph_client: Arc<dyn GraphClient>,
    repository: Arc<dyn MicrosoftAuthRepository>,
    encryption: Arc<dyn TokenEncryption>,
}

impl MicrosoftAuthService {
    pub fn new(
        graph_client: Arc<dyn GraphClient>,
        repository: Arc<dyn MicrosoftAuthRepository>,
        encryption: Arc<dyn TokenEncryption>,
    ) -> Self {
        Self {
            graph_client,
            repository,
            encryption,
        }
    }

    /// Get cached access token from repository for background sync operations
    ///
    /// This is used by background sync when there's no SSO JWT context available.
    /// The tokens are populated by routes when they fetch from SSO.
    ///
    /// Note: This does NOT refresh expired tokens - routes are responsible for
    /// updating cached tokens when they fetch fresh ones from SSO.
    pub async fn get_access_token(&self, user_id: &str) -> Result<String, MicrosoftAuthError> {
        // Get encrypted tokens from repository
        let auth_data = self
            .repository
            .get_auth_data(user_id)
            .await?
            .ok_or(MicrosoftAuthError::NotAuthenticated)?;

        // Check if token is expired
        let now = chrono::Utc::now().timestamp();
        if auth_data.token_expires_at <= now {
            return Err(MicrosoftAuthError::TokenExpired);
        }

        // Convert encrypted bytes to base64 string
        let encrypted_base64 =
            base64::engine::general_purpose::STANDARD.encode(&auth_data.access_token_encrypted);

        // Decrypt access token
        let access_token = self
            .encryption
            .decrypt_token(&encrypted_base64, user_id)
            .await?;

        Ok(access_token)
    }

    /// Cache SSO provider token for background sync operations
    ///
    /// Routes should call this when they fetch fresh tokens from SSO to ensure
    /// background sync has access to valid tokens.
    pub async fn cache_token_for_background_sync(
        &self,
        user_id: &str,
        access_token: &str,
        expires_in_seconds: u64,
        refresh_token: Option<&str>,
    ) -> Result<(), MicrosoftAuthError> {
        // Encrypt access token
        let access_token_encrypted_base64 =
            self.encryption.encrypt_token(access_token, user_id).await?;
        let access_token_encrypted = base64::engine::general_purpose::STANDARD
            .decode(&access_token_encrypted_base64)
            .map_err(|e| {
                EncryptionError::DecryptionFailed(format!("Base64 decode failed: {}", e))
            })?;

        // Encrypt refresh token if provided
        let refresh_token_encrypted = if let Some(refresh_token) = refresh_token {
            let encrypted_base64 = self
                .encryption
                .encrypt_token(refresh_token, user_id)
                .await?;
            base64::engine::general_purpose::STANDARD
                .decode(&encrypted_base64)
                .map_err(|e| {
                    EncryptionError::DecryptionFailed(format!("Base64 decode failed: {}", e))
                })?
        } else {
            // Empty vec if no refresh token
            Vec::new()
        };

        // Calculate expiry timestamp
        let expires_at = chrono::Utc::now().timestamp() + expires_in_seconds as i64;

        // Store in repository
        self.repository
            .store_auth_tokens(
                user_id,
                &access_token_encrypted,
                &refresh_token_encrypted,
                expires_at,
                None, // microsoft_user_id - not needed for caching
                None, // microsoft_email - not needed for caching
            )
            .await?;

        Ok(())
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
