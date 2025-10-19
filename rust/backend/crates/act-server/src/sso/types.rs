use serde::{Deserialize, Serialize};

/// JSON Web Key from JWKS endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Jwk {
    pub kty: String,           // Key type (e.g., "RSA")
    pub kid: String,           // Key ID
    pub r#use: Option<String>, // Key use (e.g., "sig")
    pub n: String,             // Modulus for RSA keys
    pub e: String,             // Exponent for RSA keys
    pub alg: Option<String>,   // Algorithm (e.g., "RS256")
}

/// JWKS (JSON Web Key Set) response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwkSet {
    pub keys: Vec<Jwk>,
}

/// Provider token response from SSO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<String>,
    pub scopes: Vec<String>,
    pub provider: String,
}

/// SSO JWT token claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoTokenClaims {
    pub sub: String,   // user_id
    pub email: String, // user email
    #[serde(default)]
    pub is_platform_owner: bool, // platform owner flag
    pub org: String,   // organization slug
    pub service: String, // service slug
    pub plan: String,  // subscription plan
    #[serde(default)]
    pub features: Vec<String>, // enabled features (optional)
    pub exp: usize,    // expiration timestamp
    pub iat: usize,    // issued at timestamp
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
