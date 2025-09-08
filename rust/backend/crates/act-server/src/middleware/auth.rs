use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // GitHub user ID
    pub username: String,  // GitHub username
    pub exp: usize,   // Expiration timestamp
    pub iat: usize,   // Issued at timestamp
}

pub struct AuthMiddleware;

impl AuthMiddleware {
    pub async fn verify_jwt(
        State(state): State<AppState>,
        headers: HeaderMap,
        request: Request,
        next: Next,
    ) -> Result<Response, StatusCode> {
        // Extract JWT from Authorization header
        let token = match headers.get("authorization") {
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
        let _claims = decode::<Claims>(&token, &secret, &validation)
            .map_err(|e| {
                warn!("JWT verification failed: {}", e);
                StatusCode::UNAUTHORIZED
            })?;

        debug!("JWT verification successful for user: {}", _claims.claims.username);
        Ok(next.run(request).await)
    }
}