use crate::{
    middleware::auth::AuthenticatedUser,
    models::ApiResponse,
    sso::types::{DeviceCodeResponse, OAuthCallbackParams, SsoUserInfo, TokenResponse},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Redirect, Result},
    Json,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tracing::{error, info, warn};
use uuid::Uuid;

/// Start device flow authentication
pub async fn device_start(State(state): State<AppState>) -> Result<Json<DeviceCodeResponse>> {
    info!("Starting device flow authentication");

    let response = state.sso_client.request_device_code().await.map_err(|e| {
        error!("Failed to request device code: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(response))
}

/// Poll for device flow token
pub async fn device_poll(
    State(state): State<AppState>,
    Path(device_code): Path<String>,
) -> Result<Json<TokenResponse>> {
    info!("Polling for device token");

    let token_response = state
        .sso_client
        .poll_for_token(&device_code)
        .await
        .map_err(|e| {
            // Return specific error codes for proper frontend handling
            let error_msg = e.to_string();
            if error_msg.contains("authorization_pending") {
                warn!("Authorization still pending for device code");
                StatusCode::ACCEPTED
            } else if error_msg.contains("expired_token") {
                warn!("Device code expired");
                StatusCode::GONE
            } else {
                error!("Token polling failed: {}", e);
                StatusCode::BAD_REQUEST
            }
        })?;

    // Store session locally
    store_sso_session(&state, &token_response)
        .await
        .map_err(|e| {
            error!("Failed to store SSO session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(token_response))
}

/// Start OAuth flow for a provider
pub async fn provider_start(
    State(state): State<AppState>,
    Path(provider): Path<String>,
) -> Result<Redirect> {
    info!("Starting OAuth flow for provider: {}", provider);

    // Validate provider
    if !["github", "microsoft", "google"].contains(&provider.as_str()) {
        warn!("Invalid provider requested: {}", provider);
        return Err(StatusCode::BAD_REQUEST.into());
    }

    // Construct redirect URI - pointing back to our backend
    let redirect_uri = format!(
        "http://{}:{}/api/v1/auth/{}/callback",
        state.config.server.host, state.config.server.port, provider
    );

    let auth_url = state
        .sso_client
        .get_auth_url(&provider, &redirect_uri)
        .map_err(|e| {
            error!("Failed to get auth URL: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    info!("Redirecting to SSO auth URL for provider: {}", provider);
    Ok(Redirect::temporary(&auth_url))
}

/// Handle OAuth callback from SSO
pub async fn provider_callback(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(params): Query<OAuthCallbackParams>,
) -> Result<Redirect> {
    info!("Handling OAuth callback for provider: {}", provider);

    let token_response = state
        .sso_client
        .exchange_code(&params.code, &params.state)
        .await
        .map_err(|e| {
            error!("Failed to exchange code: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Store session locally
    store_sso_session(&state, &token_response)
        .await
        .map_err(|e| {
            error!("Failed to store SSO session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Redirect to frontend with token
    let frontend_url = state
        .config
        .cors
        .allowed_origins
        .first()
        .cloned()
        .unwrap_or_else(|| "http://localhost:5173".to_string());

    let redirect_url = format!(
        "{}/auth/callback?token={}",
        frontend_url, token_response.access_token
    );

    info!("Redirecting to frontend after successful OAuth");
    Ok(Redirect::temporary(&redirect_url))
}

/// Get current user from SSO token
pub async fn get_me(
    State(_state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<SsoUserInfo>>> {
    info!("Getting current user info for: {}", auth_user.user_id);

    // We could fetch from SSO, but we have the claims already
    // For now, construct from auth_user
    let user_info = SsoUserInfo {
        id: auth_user.user_id,
        email: String::new(), // Would need to fetch from SSO or database
        username: auth_user.username,
        avatar_url: None,
        provider: "sso".to_string(),
    };

    Ok(Json(ApiResponse::success(user_info)))
}

/// Logout - revoke SSO session
pub async fn logout(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<String>>> {
    info!("Logging out user: {}", auth_user.user_id);

    // Delete all sessions for this user
    sqlx::query("DELETE FROM sso_sessions WHERE user_id = ?")
        .bind(&auth_user.user_id)
        .execute(state.db.pool())
        .await
        .map_err(|e| {
            error!("Failed to delete SSO sessions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(ApiResponse::success(
        "Logged out successfully".to_string(),
    )))
}

/// Get subscription information
#[derive(Debug, Serialize)]
pub struct SubscriptionInfo {
    pub plan: String,
    pub features: Vec<String>,
    pub status: String,
}

pub async fn get_subscription(
    State(_state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<SubscriptionInfo>>> {
    info!("Getting subscription for user: {}", auth_user.user_id);

    // Return subscription info from auth_user claims
    let subscription = SubscriptionInfo {
        plan: "free".to_string(), // Default plan
        features: auth_user.features,
        status: "active".to_string(),
    };

    Ok(Json(ApiResponse::success(subscription)))
}

// Helper function to store SSO session
async fn store_sso_session(state: &AppState, token_response: &TokenResponse) -> anyhow::Result<()> {
    // Validate and decode token to get user info
    let _claims = state
        .sso_client
        .validate_token(&token_response.access_token)
        .await?;

    // Get user info from SSO
    let user_info = state
        .sso_client
        .get_user_info(&token_response.access_token)
        .await?;

    // Hash token for storage
    let mut hasher = Sha256::new();
    hasher.update(token_response.access_token.as_bytes());
    let token_hash = format!("{:x}", hasher.finalize());

    // Calculate expiration
    let expires_at =
        chrono::Utc::now() + chrono::Duration::seconds(token_response.expires_in as i64);

    // Find or create user
    let user_id = ensure_user_exists(state, &user_info).await?;

    // Store session
    let session_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO sso_sessions (id, user_id, sso_token, sso_token_hash, provider, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    )
    .bind(&session_id)
    .bind(&user_id)
    .bind(&token_response.access_token)
    .bind(&token_hash)
    .bind(&user_info.provider)
    .bind(expires_at.to_rfc3339())
    .execute(state.db.pool())
    .await?;

    info!("Stored SSO session for user: {}", user_id);

    Ok(())
}

// Helper function to ensure user exists in database
async fn ensure_user_exists(state: &AppState, user_info: &SsoUserInfo) -> anyhow::Result<String> {
    // Check if user exists by SSO user ID
    let existing_user =
        sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE sso_user_id = ?")
            .bind(&user_info.id)
            .fetch_optional(state.db.pool())
            .await?;

    if let Some(user_id) = existing_user {
        // Update user info
        sqlx::query(
            "UPDATE users SET username = ?, email = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?"
        )
        .bind(&user_info.username)
        .bind(&user_info.email)
        .bind(&user_info.avatar_url)
        .bind(&user_id)
        .execute(state.db.pool())
        .await?;

        return Ok(user_id);
    }

    // Create new user
    let user_id = Uuid::new_v4().to_string();
    let github_id = format!("sso_{}", &user_info.id); // Temporary GitHub ID for compatibility

    sqlx::query(
        "INSERT INTO users (id, github_id, username, email, avatar_url, sso_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    )
    .bind(&user_id)
    .bind(&github_id)
    .bind(&user_info.username)
    .bind(&user_info.email)
    .bind(&user_info.avatar_url)
    .bind(&user_info.id)
    .execute(state.db.pool())
    .await?;

    // Create user settings
    sqlx::query(
        "INSERT INTO user_settings (user_id, default_provider, created_at, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    .bind(&user_id)
    .bind(&user_info.provider)
    .execute(state.db.pool())
    .await?;

    info!("Created new user from SSO: {}", user_id);

    Ok(user_id)
}
