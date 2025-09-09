use crate::{AppState, services::{GitHubService, SettingsService}, models::ApiResponse};
use axum::{
    extract::{Query, State},
    response::{Redirect, Result},
    Json,
};
use jsonwebtoken::{encode, EncodingKey, Header, decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // GitHub user ID
    pub username: String,  // GitHub username
    pub exp: usize,   // Expiration timestamp
    pub iat: usize,   // Issued at timestamp
}

#[derive(Debug, Deserialize)]
pub struct AuthCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthStatusResponse {
    success: bool,
    authorized: bool,
    user_info: Option<serde_json::Value>,
    github_configured: bool,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthValidationResponse {
    valid: bool,
    reason: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitHubCallbackResponse {
    success: bool,
    access_token: String,
    user: Option<serde_json::Value>,
    message: Option<String>,
}

pub async fn start_authorization(State(state): State<AppState>) -> Result<Redirect> {
    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|_| {
            error!("Failed to initialize GitHub service");
            axum::response::Response::builder()
                .status(503)
                .body(axum::body::Body::from("GitHub OAuth is not configured"))
                .unwrap()
        })?;

    if !github_service.is_configured() {
        return Ok(Redirect::temporary("/?error=github_not_configured"));
    }

    match github_service.get_authorization_url("single-tenant") {
        Ok(auth_url) => Ok(Redirect::temporary(&auth_url)),
        Err(e) => {
            error!("Failed to generate GitHub authorization URL: {}", e);
            Ok(Redirect::temporary("/?error=auth_failed"))
        }
    }
}

#[allow(dead_code)]
pub async fn handle_callback(
    Query(params): Query<AuthCallbackQuery>,
    State(state): State<AppState>
) -> Result<Redirect> {
    // Handle OAuth errors
    if let Some(oauth_error) = params.error {
        warn!("GitHub OAuth error: {}", oauth_error);
        return Ok(Redirect::temporary(&format!("/?error={}", urlencoding::encode(&oauth_error))));
    }

    let code = params.code.ok_or_else(|| {
        error!("Missing authorization code in callback");
        axum::response::Response::builder()
            .status(400)
            .body(axum::body::Body::from("Missing code parameter"))
            .unwrap()
    })?;

    let state_param = params.state.ok_or_else(|| {
        error!("Missing state parameter in callback");
        axum::response::Response::builder()
            .status(400)
            .body(axum::body::Body::from("Missing state parameter"))
            .unwrap()
    })?;

    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|e| {
            error!("Failed to initialize GitHub service: {}", e);
            axum::response::Response::builder()
                .status(500)
                .body(axum::body::Body::from("Internal server error"))
                .unwrap()
        })?;

    // Exchange code for token
    let token_result = match github_service.exchange_code_for_token(&code, &state_param).await {
        Ok(result) => result,
        Err(e) => {
            error!("Failed to exchange code for token: {}", e);
            return Ok(Redirect::temporary(&format!("/?error={}", urlencoding::encode(&e.to_string()))));
        }
    };

    // Validate user is the authorized tenant
    if !github_service.validate_tenant_user(&token_result.user.login) {
        warn!("Unauthorized GitHub user attempted login: {}", token_result.user.login);
        return Ok(Redirect::temporary("/?error=unauthorized_user"));
    }

    // Store GitHub tokens in settings
    let settings_service = SettingsService::new(state.db.clone());
    
    if let Err(e) = settings_service.update_github_tokens(
        &github_service,
        Some(&token_result.access_token),
        token_result.refresh_token.as_deref(),
        Some(token_result.expires_at)
    ).await {
        error!("Failed to store GitHub tokens: {}", e);
        return Ok(Redirect::temporary("/?error=token_storage_failed"));
    }

    // Generate JWT token
    let now = chrono::Utc::now();
    let exp = now + chrono::Duration::days(7);
    
    let claims = Claims {
        sub: token_result.user.id.to_string(),
        username: token_result.user.login.clone(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    let jwt_token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.auth.jwt_secret.as_ref())
    ).map_err(|e| {
        error!("Failed to generate JWT token: {}", e);
        axum::response::Response::builder()
            .status(500)
            .body(axum::body::Body::from("Failed to generate access token"))
            .unwrap()
    })?;

    info!("Successful GitHub OAuth login for user: {}", token_result.user.login);

    // Redirect to main page with token
    Ok(Redirect::temporary(&format!("/?token={}", jwt_token)))
}

pub async fn handle_github_callback(
    Query(params): Query<AuthCallbackQuery>,
    State(state): State<AppState>
) -> Result<Json<GitHubCallbackResponse>, axum::response::Response<axum::body::Body>> {
    // Handle OAuth errors
    if let Some(oauth_error) = params.error {
        warn!("GitHub OAuth error: {}", oauth_error);
        return Err(create_error_response(400, "OAuth error", &oauth_error));
    }

    let code = params.code.ok_or_else(|| {
        error!("Missing authorization code in callback");
        create_error_response(400, "Missing code", "Authorization code is required")
    })?;

    let state_param = params.state.ok_or_else(|| {
        error!("Missing state parameter in callback");
        create_error_response(400, "Missing state", "State parameter is required")
    })?;

    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|e| {
            error!("Failed to initialize GitHub service: {}", e);
            create_error_response(500, "Internal server error", &e.to_string())
        })?;

    // Exchange code for token
    let token_result = match github_service.exchange_code_for_token(&code, &state_param).await {
        Ok(result) => result,
        Err(e) => {
            error!("Failed to exchange code for token: {}", e);
            return Err(create_error_response(400, "Token exchange failed", &e.to_string()));
        }
    };

    // Validate user is the authorized tenant
    if !github_service.validate_tenant_user(&token_result.user.login) {
        warn!("Unauthorized GitHub user attempted login: {}", token_result.user.login);
        return Err(create_error_response(403, "Unauthorized user", "User is not authorized to access this system"));
    }

    // Store GitHub tokens in settings
    let settings_service = SettingsService::new(state.db.clone());
    
    if let Err(e) = settings_service.update_github_tokens(
        &github_service,
        Some(&token_result.access_token),
        token_result.refresh_token.as_deref(),
        Some(token_result.expires_at)
    ).await {
        error!("Failed to store GitHub tokens: {}", e);
        return Err(create_error_response(500, "Token storage failed", &e.to_string()));
    }

    // Generate JWT token
    let now = chrono::Utc::now();
    let exp = now + chrono::Duration::days(7);
    
    let claims = Claims {
        sub: token_result.user.id.to_string(),
        username: token_result.user.login.clone(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    let jwt_token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.auth.jwt_secret.as_ref())
    ).map_err(|e| {
        error!("Failed to generate JWT token: {}", e);
        create_error_response(500, "Token generation failed", &e.to_string())
    })?;

    info!("Successful GitHub OAuth login for user: {}", token_result.user.login);

    // Convert user info to JSON
    let user_json = match serde_json::to_value(token_result.user) {
        Ok(user) => user,
        Err(e) => {
            error!("Failed to serialize user info: {}", e);
            return Err(create_error_response(500, "User serialization failed", &e.to_string()));
        }
    };

    let response = GitHubCallbackResponse {
        success: true,
        access_token: jwt_token,
        user: Some(user_json),
        message: None,
    };

    Ok(Json(response))
}

pub async fn get_auth_status(State(state): State<AppState>) -> Result<Json<AuthStatusResponse>> {
    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|e| {
            error!("Failed to initialize GitHub service: {}", e);
            axum::response::Response::builder()
                .status(500)
                .body(axum::body::Body::from("Internal server error"))
                .unwrap()
        })?;

    let settings_service = SettingsService::new(state.db.clone());
    
    let is_authenticated = settings_service.is_github_authenticated().await
        .unwrap_or(false);
    
    let mut user_info = None;
    if is_authenticated {
        // Check if token is still valid and get user info
        if let Ok(Some(access_token)) = settings_service.get_github_token(&github_service).await {
            if github_service.validate_token(&access_token).await {
                if let Ok(user) = github_service.get_user_info(&access_token).await {
                    user_info = Some(serde_json::to_value(user).map_err(|e| {
                        error!("Failed to serialize user info: {}", e);
                        axum::response::Response::builder()
                            .status(500)
                            .body(axum::body::Body::from("Internal server error"))
                            .unwrap()
                    })?);
                }
            }
        }
    }

    let response = AuthStatusResponse {
        success: true,
        authorized: is_authenticated && user_info.is_some(),
        user_info,
        github_configured: github_service.is_configured(),
        message: None,
    };

    Ok(Json(response))
}

pub async fn logout(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    info!("User logout requested");
    
    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|e| {
            error!("Failed to initialize GitHub service: {}", e);
            axum::response::Response::builder()
                .status(500)
                .body(axum::body::Body::from("Internal server error"))
                .unwrap()
        })?;
    
    let settings_service = SettingsService::new(state.db.clone());
    
    // Get current access token for revocation
    if let Ok(Some(access_token)) = settings_service.get_github_token(&github_service).await {
        // Revoke the GitHub OAuth token
        if let Err(e) = github_service.revoke_token(&access_token).await {
            warn!("Failed to revoke GitHub token: {}", e);
            // Continue with logout even if revocation fails
        } else {
            info!("Successfully revoked GitHub OAuth token");
        }
    }
    
    // Clear tokens from database
    if let Err(e) = settings_service.clear_github_tokens().await {
        error!("Failed to clear GitHub tokens: {}", e);
        return Ok(Json(serde_json::json!({
            "success": false,
            "message": format!("Logout failed: {}", e)
        })));
    }
    
    info!("User logged out successfully");
    
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Logged out successfully"
    })))
}

pub async fn get_current_user(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap
) -> Result<Json<ApiResponse<serde_json::Value>>, axum::response::Response<axum::body::Body>> {
    let auth_header = headers.get("authorization")
        .ok_or_else(|| create_error_response(401, "Missing authorization header", "Authorization header is required"))?;
    
    let auth_str = auth_header.to_str()
        .map_err(|_| create_error_response(400, "Invalid authorization header", "Authorization header must be a valid string"))?;
    
    if !auth_str.starts_with("Bearer ") {
        return Err(create_error_response(400, "Invalid authorization format", "Authorization header must start with 'Bearer '"));
    }
    
    let token = &auth_str[7..];
    
    // Decode and validate JWT token
    let _claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.auth.jwt_secret.as_ref()),
        &Validation::default()
    ).map_err(|_| create_error_response(401, "Invalid token", "Failed to decode JWT token"))?;
    
    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|e| {
            error!("Failed to initialize GitHub service: {}", e);
            create_error_response(500, "Internal server error", &e.to_string())
        })?;
    
    let settings_service = SettingsService::new(state.db.clone());
    
    // Get access token
    let access_token = match settings_service.get_github_token(&github_service).await {
        Ok(Some(token)) => token,
        Ok(None) => return Err(create_error_response(401, "Not authenticated", "GitHub token not found")),
        Err(e) => {
            error!("Failed to get GitHub token: {}", e);
            return Err(create_error_response(500, "Failed to get GitHub token", &e.to_string()));
        }
    };
    
    // Get user info from GitHub
    let user_info = match github_service.get_user_info(&access_token).await {
        Ok(user) => serde_json::to_value(user).map_err(|e| {
            error!("Failed to serialize user info: {}", e);
            create_error_response(500, "Internal server error", &e.to_string())
        })?,
        Err(e) => {
            error!("Failed to get user info: {}", e);
            return Err(create_error_response(500, "Failed to get user info", &e.to_string()));
        }
    };
    
    Ok(Json(ApiResponse::success(user_info)))
}

pub async fn validate_auth(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap
) -> Result<Json<AuthValidationResponse>, axum::response::Response<axum::body::Body>> {
    let auth_header = match headers.get("authorization") {
        Some(header) => header,
        None => {
            return Ok(Json(AuthValidationResponse {
                valid: false,
                reason: Some("no_token".to_string()),
                message: Some("No authentication token provided".to_string()),
            }));
        }
    };
    
    let auth_str = match auth_header.to_str() {
        Ok(str) => str,
        Err(_) => {
            return Ok(Json(AuthValidationResponse {
                valid: false,
                reason: Some("invalid_header".to_string()),
                message: Some("Invalid authorization header format".to_string()),
            }));
        }
    };
    
    if !auth_str.starts_with("Bearer ") {
        return Ok(Json(AuthValidationResponse {
            valid: false,
            reason: Some("invalid_format".to_string()),
            message: Some("Authorization header must start with 'Bearer '".to_string()),
        }));
    }
    
    let token = &auth_str[7..];
    
    // Validate JWT token
    let claims = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.auth.jwt_secret.as_ref()),
        &Validation::default()
    ) {
        Ok(token_data) => token_data.claims,
        Err(_) => {
            return Ok(Json(AuthValidationResponse {
                valid: false,
                reason: Some("jwt_invalid".to_string()),
                message: Some("Invalid JWT token".to_string()),
            }));
        }
    };
    
    // Check if JWT is expired
    let now = chrono::Utc::now().timestamp() as usize;
    if claims.exp < now {
        return Ok(Json(AuthValidationResponse {
            valid: false,
            reason: Some("jwt_expired".to_string()),
            message: Some("JWT token has expired".to_string()),
        }));
    }
    
    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|e| {
            error!("Failed to initialize GitHub service: {}", e);
            create_error_response(500, "Internal server error", &e.to_string())
        })?;
    
    let settings_service = SettingsService::new(state.db.clone());
    
    // Check if GitHub token exists
    let github_token = match settings_service.get_github_token(&github_service).await {
        Ok(Some(token)) => token,
        Ok(None) => {
            return Ok(Json(AuthValidationResponse {
                valid: false,
                reason: Some("github_token_missing".to_string()),
                message: Some("GitHub session expired. Please re-authenticate.".to_string()),
            }));
        }
        Err(_) => {
            return Ok(Json(AuthValidationResponse {
                valid: false,
                reason: Some("github_token_error".to_string()),
                message: Some("Failed to retrieve GitHub token".to_string()),
            }));
        }
    };
    
    // Check if GitHub token is expired
    if let Ok(true) = settings_service.is_github_token_expired().await {
        // Try to refresh the token
        if let Ok(Some(refresh_token)) = settings_service.get_github_refresh_token(&github_service).await {
            match github_service.refresh_access_token(&refresh_token).await {
                Ok(new_token_result) => {
                    // Update tokens in database
                    if settings_service.update_github_tokens(
                        &github_service,
                        Some(&new_token_result.access_token),
                        new_token_result.refresh_token.as_deref(),
                        Some(new_token_result.expires_at),
                    ).await.is_err() {
                        return Ok(Json(AuthValidationResponse {
                            valid: false,
                            reason: Some("token_refresh_failed".to_string()),
                            message: Some("Failed to refresh GitHub token".to_string()),
                        }));
                    }
                    info!("Successfully refreshed GitHub token for user {}", claims.username);
                }
                Err(_) => {
                    return Ok(Json(AuthValidationResponse {
                        valid: false,
                        reason: Some("github_token_expired".to_string()),
                        message: Some("GitHub token expired and could not be refreshed. Please re-authenticate.".to_string()),
                    }));
                }
            }
        } else {
            return Ok(Json(AuthValidationResponse {
                valid: false,
                reason: Some("github_token_expired".to_string()),
                message: Some("GitHub token expired. Please re-authenticate.".to_string()),
            }));
        }
    }
    
    // Validate GitHub token with GitHub API
    if !github_service.validate_token(&github_token).await {
        return Ok(Json(AuthValidationResponse {
            valid: false,
            reason: Some("github_token_invalid".to_string()),
            message: Some("GitHub token is invalid. Please re-authenticate.".to_string()),
        }));
    }
    
    // All validations passed
    Ok(Json(AuthValidationResponse {
        valid: true,
        reason: None,
        message: Some("Authentication is valid".to_string()),
    }))
}

fn create_error_response(status: u16, error: &str, message: &str) -> axum::response::Response<axum::body::Body> {
    let error_response = crate::models::ErrorResponse {
        success: false,
        error: error.to_string(),
        message: message.to_string(),
    };
    
    axum::response::Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&error_response).unwrap()))
        .unwrap()
}