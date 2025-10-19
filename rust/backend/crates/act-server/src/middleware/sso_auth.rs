use crate::sso::types::SsoTokenClaims;
use crate::AppState;
use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tracing::{debug, warn};

/// SSO-authenticated user information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticatedUser {
    pub db_user_id: String, // Internal database user ID (users.id) - use this for database operations
    pub sso_user_id: String, // SSO user ID (sub claim from JWT)
    pub email: String,      // User email from SSO
    pub org: String,        // Organization slug
    pub service: String,    // Service slug
    pub plan: String,       // Subscription plan
    pub features: Vec<String>, // Enabled features
    pub exp: usize,         // Expiration timestamp
    pub iat: usize,         // Issued at timestamp
    #[serde(skip_serializing)] // Don't expose raw JWT in API responses
    pub raw_jwt: String, // Raw JWT token for fetching provider tokens
}

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // Extract Bearer token from Authorization header
        let token = extract_bearer_token(parts)?;

        debug!("Validating SSO token");

        // Validate token using SSO client with RS256 verification
        let claims = state.sso_client.validate_token(&token).await.map_err(|e| {
            warn!("SSO token validation failed: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

        // Check if token is expired
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize;

        if claims.exp < now {
            warn!("SSO token has expired");
            return Err(StatusCode::UNAUTHORIZED);
        }

        // NOTE: We do NOT check sso_sessions table here because:
        // - Client-side SSO SDK authentication never creates a session in our backend
        // - JWT signature validation (via JWKS) + expiry check is sufficient
        // - The sso_sessions table is only used for device flow and OAuth callback flows
        // - This enables stateless authentication with SSO

        // Find or create user in local database using auth repository
        let auth_user = find_or_create_user(&claims, state).await.map_err(|e| {
            warn!("Failed to find or create user: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        debug!("SSO authentication successful for user: {}", claims.sub);

        // Return authenticated user info with SSO claims and raw JWT
        Ok(AuthenticatedUser {
            db_user_id: auth_user.id, // Use database user ID for database operations
            sso_user_id: claims.sub.clone(),
            email: auth_user.email,
            org: claims.org,
            service: claims.service,
            plan: claims.plan,
            features: claims.features,
            exp: claims.exp,
            iat: claims.iat,
            raw_jwt: token, // Store raw JWT for provider token requests
        })
    }
}

/// Extract Bearer token from Authorization header
fn extract_bearer_token(parts: &Parts) -> Result<String, StatusCode> {
    match parts.headers.get("authorization") {
        Some(header) => {
            let header_str = header.to_str().map_err(|_| {
                warn!("Invalid authorization header format");
                StatusCode::UNAUTHORIZED
            })?;

            if let Some(token) = header_str.strip_prefix("Bearer ") {
                Ok(token.to_string())
            } else {
                warn!("Authorization header missing Bearer prefix");
                Err(StatusCode::UNAUTHORIZED)
            }
        }
        None => {
            debug!("No authorization header found");
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

/// Find existing user or create new user based on SSO claims
async fn find_or_create_user(
    claims: &SsoTokenClaims,
    state: &AppState,
) -> Result<UserInfo, Box<dyn std::error::Error + Send + Sync>> {
    let pool = state.db.pool();

    // Try to find user by SSO user ID first
    let existing_user =
        sqlx::query_as::<_, UserInfo>("SELECT id, email FROM users WHERE sso_user_id = ?")
            .bind(&claims.sub)
            .fetch_optional(pool)
            .await?;

    if let Some(user) = existing_user {
        // User exists, update email if changed
        if user.email != claims.email {
            sqlx::query("UPDATE users SET email = ? WHERE id = ?")
                .bind(&claims.email)
                .bind(&user.id)
                .execute(pool)
                .await?;
        }
        Ok(UserInfo {
            id: user.id,
            email: claims.email.clone(),
        })
    } else {
        // Check if user exists by email (migration case)
        let user_by_email =
            sqlx::query_as::<_, UserInfo>("SELECT id, email FROM users WHERE email = ?")
                .bind(&claims.email)
                .fetch_optional(pool)
                .await?;

        if let Some(user) = user_by_email {
            // Update existing user with SSO user ID
            sqlx::query("UPDATE users SET sso_user_id = ? WHERE id = ?")
                .bind(&claims.sub)
                .bind(&user.id)
                .execute(pool)
                .await?;

            Ok(user)
        } else {
            // Create new user with email from JWT claims
            let user_id = uuid::Uuid::new_v4().to_string();

            sqlx::query(
                "INSERT INTO users (id, email, sso_user_id, created_at) VALUES (?, ?, ?, datetime('now'))"
            )
            .bind(&user_id)
            .bind(&claims.email)
            .bind(&claims.sub)
            .execute(pool)
            .await?;

            Ok(UserInfo {
                id: user_id,
                email: claims.email.clone(),
            })
        }
    }
}

/// User information from database
#[derive(Debug, FromRow)]
struct UserInfo {
    id: String,
    email: String,
}
