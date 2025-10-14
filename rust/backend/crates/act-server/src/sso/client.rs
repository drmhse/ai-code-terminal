use super::types::{
    DeviceCodeResponse, SsoErrorResponse, SsoSubscription, SsoTokenClaims, SsoUserInfo,
    TokenResponse,
};
use anyhow::{anyhow, Context, Result};
use reqwest::StatusCode;
use serde_json::json;

/// SSO client for interacting with the external SSO service
#[derive(Clone)]
pub struct SsoClient {
    base_url: String,
    client_id: String,
    client_secret: String,
    org_slug: String,
    service_slug: String,
    http_client: reqwest::Client,
}

impl SsoClient {
    /// Create a new SSO client
    pub fn new(
        base_url: String,
        client_id: String,
        client_secret: String,
        org_slug: String,
        service_slug: String,
    ) -> Result<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            base_url,
            client_id,
            client_secret,
            org_slug,
            service_slug,
            http_client,
        })
    }

    /// Request a device code for device flow authentication
    pub async fn request_device_code(&self) -> Result<DeviceCodeResponse> {
        let url = format!("{}/auth/device/code", self.base_url);

        let response = self
            .http_client
            .post(&url)
            .json(&json!({
                "client_id": self.client_id,
                "org_slug": self.org_slug,
                "service_slug": self.service_slug,
            }))
            .send()
            .await
            .context("Failed to request device code")?;

        if !response.status().is_success() {
            let error: SsoErrorResponse = response.json().await.unwrap_or(SsoErrorResponse {
                error: "unknown_error".to_string(),
                error_description: Some("Failed to parse error response".to_string()),
            });
            return Err(anyhow!(
                "Device code request failed: {}",
                error.error_description.unwrap_or(error.error)
            ));
        }

        response
            .json::<DeviceCodeResponse>()
            .await
            .context("Failed to parse device code response")
    }

    /// Poll for token using device code
    pub async fn poll_for_token(&self, device_code: &str) -> Result<TokenResponse> {
        let url = format!("{}/auth/token", self.base_url);

        let response = self
            .http_client
            .post(&url)
            .json(&json!({
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": device_code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }))
            .send()
            .await
            .context("Failed to poll for token")?;

        // Handle specific polling responses
        match response.status() {
            StatusCode::OK => response
                .json::<TokenResponse>()
                .await
                .context("Failed to parse token response"),
            StatusCode::BAD_REQUEST => {
                let error: SsoErrorResponse = response.json().await?;
                // Return specific error codes for proper handling by frontend
                Err(anyhow!("{}", error.error))
            }
            _ => {
                let error: SsoErrorResponse = response.json().await.unwrap_or(SsoErrorResponse {
                    error: "unknown_error".to_string(),
                    error_description: Some("Unexpected response from SSO".to_string()),
                });
                Err(anyhow!(
                    "Token polling failed: {}",
                    error.error_description.unwrap_or(error.error)
                ))
            }
        }
    }

    /// Get OAuth authorization URL for web flow
    pub fn get_auth_url(&self, provider: &str, redirect_uri: &str) -> Result<String> {
        // Construct SSO authorization URL
        let auth_url = format!(
            "{}/auth/{}?client_id={}&org_slug={}&service_slug={}&redirect_uri={}",
            self.base_url,
            provider,
            urlencoding::encode(&self.client_id),
            urlencoding::encode(&self.org_slug),
            urlencoding::encode(&self.service_slug),
            urlencoding::encode(redirect_uri),
        );

        Ok(auth_url)
    }

    /// Exchange authorization code for token
    pub async fn exchange_code(&self, code: &str, state: &str) -> Result<TokenResponse> {
        let url = format!("{}/auth/token", self.base_url);

        let response = self
            .http_client
            .post(&url)
            .json(&json!({
                "grant_type": "authorization_code",
                "code": code,
                "state": state,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }))
            .send()
            .await
            .context("Failed to exchange code for token")?;

        if !response.status().is_success() {
            let error: SsoErrorResponse = response.json().await.unwrap_or(SsoErrorResponse {
                error: "unknown_error".to_string(),
                error_description: Some("Code exchange failed".to_string()),
            });
            return Err(anyhow!(
                "Code exchange failed: {}",
                error.error_description.unwrap_or(error.error)
            ));
        }

        response
            .json::<TokenResponse>()
            .await
            .context("Failed to parse token response")
    }

    /// Validate an SSO token
    pub async fn validate_token(&self, token: &str) -> Result<SsoTokenClaims> {
        // Decode JWT without verification first to extract claims
        // In production, you should verify the signature using SSO's public key
        let decoding_key = jsonwebtoken::DecodingKey::from_secret(self.client_secret.as_ref());
        let validation = jsonwebtoken::Validation::default();

        let token_data = jsonwebtoken::decode::<SsoTokenClaims>(token, &decoding_key, &validation)
            .context("Failed to decode SSO token")?;

        Ok(token_data.claims)
    }

    /// Get user information from SSO
    pub async fn get_user_info(&self, token: &str) -> Result<SsoUserInfo> {
        let url = format!("{}/api/user", self.base_url);

        let response = self
            .http_client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("Failed to get user info")?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to get user info: {}", response.status()));
        }

        response
            .json::<SsoUserInfo>()
            .await
            .context("Failed to parse user info response")
    }

    /// Get subscription information from SSO
    #[allow(dead_code)]
    pub async fn get_subscription(&self, token: &str) -> Result<SsoSubscription> {
        let url = format!("{}/api/subscription", self.base_url);

        let response = self
            .http_client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .context("Failed to get subscription info")?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to get subscription info: {}",
                response.status()
            ));
        }

        response
            .json::<SsoSubscription>()
            .await
            .context("Failed to parse subscription response")
    }

    /// Get provider-specific token from SSO (for Microsoft To Do integration)
    #[allow(dead_code)]
    pub async fn get_provider_token(&self, sso_token: &str, provider: &str) -> Result<String> {
        let url = format!("{}/api/provider/{}/token", self.base_url, provider);

        let response = self
            .http_client
            .get(&url)
            .bearer_auth(sso_token)
            .send()
            .await
            .context("Failed to get provider token")?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to get provider token: {}",
                response.status()
            ));
        }

        #[derive(serde::Deserialize)]
        #[allow(dead_code)]
        struct ProviderTokenResponse {
            access_token: String,
        }

        let token_response = response
            .json::<ProviderTokenResponse>()
            .await
            .context("Failed to parse provider token response")?;

        Ok(token_response.access_token)
    }
}
