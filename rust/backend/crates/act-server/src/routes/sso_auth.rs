use crate::{
    middleware::sso_auth::AuthenticatedUser, models::ApiResponse, sso::types::SsoUserInfo, AppState,
};
use axum::{extract::State, response::Result, Json};
use serde::Serialize;
use tracing::info;

// NOTE: All authentication flows (device flow, OAuth callbacks) are handled
// client-side by the @drmhse/sso-sdk. The backend only validates JWTs using JWKS.
// See: https://github.com/drmhse/sso-sdk#authentication-flows

/// Get current user from SSO token
pub async fn get_me(
    State(_state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<SsoUserInfo>>> {
    info!("Getting current user info for: {}", auth_user.sso_user_id);

    // Construct user info from auth_user claims
    let user_info = SsoUserInfo {
        id: auth_user.sso_user_id.clone(),
        email: auth_user.email.clone(),
        username: auth_user.sso_user_id.clone(), // Use sso_user_id as username for now
        avatar_url: None,
        provider: "sso".to_string(),
    };

    Ok(Json(ApiResponse::success(user_info)))
}

/// Logout - client should call SDK's logout and clear local tokens
pub async fn logout(
    State(_state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<String>>> {
    info!("Logout request for user: {}", auth_user.sso_user_id);

    // With client-side SSO SDK, logout is handled on the frontend:
    // 1. Call sso.auth.logout() to invalidate token on SSO server
    // 2. Clear localStorage tokens
    // Backend doesn't maintain sessions, so nothing to do here

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
    info!("Getting subscription for user: {}", auth_user.sso_user_id);

    // Return subscription info from auth_user claims
    let subscription = SubscriptionInfo {
        plan: "free".to_string(), // Default plan
        features: auth_user.features,
        status: "active".to_string(),
    };

    Ok(Json(ApiResponse::success(subscription)))
}
