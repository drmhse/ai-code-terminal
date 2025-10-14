use crate::AppState;
use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tracing::{debug, warn};

// Legacy JWT claims (kept for backward compatibility during migration)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,             // GitHub user ID
    pub github_username: String, // GitHub username
    pub username: String,        // GitHub username (for compatibility)
    pub exp: usize,              // Expiration timestamp
    pub iat: usize,              // Issued at timestamp
}

// Extension type to pass authenticated user info through requests
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub username: String,
    pub org: Option<String>,
    pub service: Option<String>,
    pub features: Vec<String>,
}

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // Extract JWT from Authorization header
        let token = match parts.headers.get("authorization") {
            Some(header) => {
                let header_str = header.to_str().map_err(|_| {
                    warn!("Invalid authorization header format");
                    StatusCode::UNAUTHORIZED
                })?;

                if let Some(token) = header_str.strip_prefix("Bearer ") {
                    token.to_string()
                } else {
                    warn!("Authorization header missing Bearer prefix");
                    return Err(StatusCode::UNAUTHORIZED);
                }
            }
            None => {
                debug!("No authorization header found");
                return Err(StatusCode::UNAUTHORIZED);
            }
        };

        debug!("JWT token received: {}", &token[..20.min(token.len())]);

        // Validate token with SSO
        let claims = state.sso_client.validate_token(&token).await.map_err(|e| {
            warn!("SSO token validation failed: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

        // Hash the token for session lookup
        let token_hash = hash_token(&token);

        // Check if session exists in local database
        let session = sqlx::query_as::<_, SsoSession>(
            "SELECT * FROM sso_sessions WHERE sso_token_hash = ? AND expires_at > datetime('now')",
        )
        .bind(&token_hash)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|e| {
            warn!("Failed to query SSO session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if session.is_none() {
            warn!("No valid SSO session found for token");
            return Err(StatusCode::UNAUTHORIZED);
        }

        debug!("SSO authentication successful for user: {}", claims.sub);

        // Return authenticated user info with SSO claims
        Ok(AuthenticatedUser {
            user_id: claims.sub.clone(),
            username: claims.sub.clone(), // Use sub as username for now
            org: Some(claims.org),
            service: Some(claims.service),
            features: claims.features,
        })
    }
}

// Helper struct for SSO session
#[derive(Debug, sqlx::FromRow)]
struct SsoSession {
    #[allow(dead_code)]
    id: String,
    #[allow(dead_code)]
    user_id: String,
    #[allow(dead_code)]
    sso_token: String,
    #[allow(dead_code)]
    sso_token_hash: String,
    #[allow(dead_code)]
    provider: String,
    #[allow(dead_code)]
    expires_at: String,
    #[allow(dead_code)]
    created_at: String,
}

// Hash token for storage
fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}
