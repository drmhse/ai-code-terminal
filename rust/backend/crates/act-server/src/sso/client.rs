use super::types::{JwkSet, ProviderTokenResponse, SsoTokenClaims};
use anyhow::{anyhow, Context, Result};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Convert standard base64 to base64url format
/// Replaces '+' with '-' and '/' with '_' and removes padding
fn convert_base64_to_base64url(input: &str) -> String {
    input
        .replace('+', "-")
        .replace('/', "_")
        .trim_end_matches('=')
        .to_string()
}

/// Cached JWKS with expiration
#[derive(Clone)]
struct CachedJwks {
    jwks: JwkSet,
    expires_at: Instant,
}

/// SSO client for interacting with the external SSO service
#[derive(Clone)]
pub struct SsoClient {
    base_url: String,
    org_slug: String,
    service_slug: String,
    jwks_url: String,
    http_client: reqwest::Client,
    cached_jwks: Arc<RwLock<Option<CachedJwks>>>,
}

impl SsoClient {
    /// Create a new SSO client
    /// Note: SSO server handles client identification automatically via org and service slugs
    pub fn new(
        base_url: String,
        org_slug: String,
        service_slug: String,
        jwks_url: String,
    ) -> Result<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            base_url,
            org_slug,
            service_slug,
            jwks_url,
            http_client,
            cached_jwks: Arc::new(RwLock::new(None)),
        })
    }

    // NOTE: Device flow and OAuth callback flows are handled client-side by @drmhse/sso-sdk
    // The backend only validates JWTs using JWKS - no need to implement auth flows here

    /// Fetch and cache JWKS from the SSO service
    pub async fn fetch_jwks(&self) -> Result<JwkSet> {
        // Check cache first
        {
            let cache = self.cached_jwks.read().await;
            if let Some(ref cached) = *cache {
                if cached.expires_at > Instant::now() {
                    return Ok(cached.jwks.clone());
                }
            }
        }

        // Fetch from SSO service
        let response = self
            .http_client
            .get(&self.jwks_url)
            .send()
            .await
            .context("Failed to fetch JWKS")?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch JWKS: {}", response.status()));
        }

        let jwks: JwkSet = response
            .json()
            .await
            .context("Failed to parse JWKS response")?;

        // Cache the JWKS with 1-hour TTL
        let cached = CachedJwks {
            jwks: jwks.clone(),
            expires_at: Instant::now() + Duration::from_secs(3600),
        };

        {
            let mut cache = self.cached_jwks.write().await;
            *cache = Some(cached);
        }

        Ok(jwks)
    }

    /// Validate an SSO token using RS256 with JWKS
    pub async fn validate_token(&self, token: &str) -> Result<SsoTokenClaims> {
        // Decode JWT header to get the key ID
        let header = jsonwebtoken::decode_header(token).context("Failed to decode JWT header")?;

        let kid = header
            .kid
            .ok_or_else(|| anyhow!("JWT missing key ID (kid)"))?;

        // Fetch JWKS and find the matching key
        let jwks = self.fetch_jwks().await?;
        let jwk = jwks
            .keys
            .iter()
            .find(|key| key.kid == kid)
            .ok_or_else(|| anyhow!("No matching key found for kid: {}", kid))?;

        // Convert base64 to base64url format for jsonwebtoken compatibility
        let n_base64url = convert_base64_to_base64url(&jwk.n);
        let e_base64url = convert_base64_to_base64url(&jwk.e);

        // Create RSA decoding key from JWK with base64url encoded values
        let decoding_key =
            jsonwebtoken::DecodingKey::from_rsa_components(&n_base64url, &e_base64url)
                .context("Failed to create RSA decoding key from JWK")?;

        // Configure validation for RS256
        let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
        validation.validate_exp = true;

        // Decode and validate the token
        let token_data = jsonwebtoken::decode::<SsoTokenClaims>(token, &decoding_key, &validation)
            .context("Failed to validate SSO token")?;

        // Validate that the token is for the correct organization and service
        if token_data.claims.org != self.org_slug {
            return Err(anyhow!(
                "Token organization '{}' does not match expected '{}'",
                token_data.claims.org,
                self.org_slug
            ));
        }

        if token_data.claims.service != self.service_slug {
            return Err(anyhow!(
                "Token service '{}' does not match expected '{}'",
                token_data.claims.service,
                self.service_slug
            ));
        }

        Ok(token_data.claims)
    }

    // NOTE: get_user_info and get_subscription are not needed - all user info is in JWT claims

    /// Get provider-specific token from SSO (for GitHub, Microsoft, etc.)
    pub async fn get_provider_token(
        &self,
        sso_token: &str,
        provider: &str,
    ) -> Result<ProviderTokenResponse> {
        let url = format!("{}/api/provider-token/{}", self.base_url, provider);

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

        let token_response = response
            .json::<ProviderTokenResponse>()
            .await
            .context("Failed to parse provider token response")?;

        Ok(token_response)
    }
}
