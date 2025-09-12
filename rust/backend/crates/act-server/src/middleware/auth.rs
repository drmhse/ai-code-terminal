use axum::{
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,  // GitHub user ID
    pub github_username: String,  // GitHub username  
    pub username: String,  // GitHub username (for compatibility)
    pub exp: usize,   // Expiration timestamp
    pub iat: usize,   // Issued at timestamp
}

// Extension type to pass authenticated user info through requests
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub username: String,
}

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
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
        
        // Verify JWT with secret from config
        let secret = DecodingKey::from_secret(state.config.auth.jwt_secret.as_ref());
        let validation = Validation::default();
        let token_data = decode::<Claims>(&token, &secret, &validation)
            .map_err(|e| {
                warn!("JWT verification failed: {}", e);
                StatusCode::UNAUTHORIZED
            })?;

        let claims = token_data.claims;
        debug!("JWT verification successful for user: {}", claims.username);
        
        // Return authenticated user info
        Ok(AuthenticatedUser {
            user_id: claims.sub.clone(),
            username: claims.github_username.clone(),
        })
    }
}

