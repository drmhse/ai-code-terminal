use serde::{Deserialize, Serialize};

/// SSO JWT token claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoTokenClaims {
    pub sub: String,           // user_id
    pub org: String,           // organization slug
    pub service: String,       // service slug
    pub plan: String,          // subscription plan
    pub features: Vec<String>, // enabled features
    pub exp: usize,            // expiration timestamp
    pub iat: usize,            // issued at timestamp
}

/// User information from SSO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoUserInfo {
    pub id: String,
    pub email: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub provider: String,
}

/// Subscription information from SSO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoSubscription {
    pub plan: String,
    pub features: Vec<String>,
    pub status: String,
    pub current_period_end: String,
}

/// Device code response from SSO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

/// Token response from SSO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
}

/// Error response from SSO API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoErrorResponse {
    pub error: String,
    pub error_description: Option<String>,
}

/// OAuth callback parameters
#[derive(Debug, Deserialize)]
pub struct OAuthCallbackParams {
    pub code: String,
    pub state: String,
}
