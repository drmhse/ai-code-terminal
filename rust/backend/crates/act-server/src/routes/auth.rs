use crate::{AppState, models::ApiResponse, error::ServerError, middleware::csrf::CsrfProtection};
use act_core::CoreError;
use axum::{
    extract::{Query, State},
    response::{Redirect, Result},
    Json, http::HeaderMap,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

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
    match state.domain_services.auth_service.get_authorization_url("single-tenant").await {
        Ok(auth_url) => Ok(Redirect::temporary(&auth_url)),
        Err(e) => {
            error!("Failed to get authorization URL: {}", e);
            Ok(Redirect::temporary("/?error=github_not_configured"))
        }
    }
}



pub async fn handle_github_callback(
    Query(params): Query<AuthCallbackQuery>,
    State(state): State<AppState>
) -> Result<Json<GitHubCallbackResponse>> {
    if let Some(oauth_error) = params.error {
        return Ok(Json(GitHubCallbackResponse {
            success: false,
            access_token: String::new(),
            user: None,
            message: Some(oauth_error),
        }));
    }

    let code = params.code.ok_or_else(|| ServerError(CoreError::Validation("Missing code parameter".to_string())))?;
    let state_param = params.state.ok_or_else(|| ServerError(CoreError::Validation("Missing state parameter".to_string())))?;

    match state.domain_services.auth_service.handle_oauth_callback(&code, &state_param).await {
        Ok(auth_result) => {
            let user_json = serde_json::to_value(&auth_result.user)
                .map_err(|e| ServerError(CoreError::Serialization(e.to_string())))?;
            Ok(Json(GitHubCallbackResponse {
                success: true,
                access_token: auth_result.jwt_token,
                user: Some(user_json),
                message: None,
            }))
        },
        Err(e) => Ok(Json(GitHubCallbackResponse {
            success: false,
            access_token: String::new(),
            user: None,
            message: Some(e.to_string()),
        }))
    }
}

pub async fn get_csrf_token(State(state): State<AppState>) -> Result<Json<ApiResponse<String>>> {
    let csrf = CsrfProtection::new(state.config.auth.jwt_secret.clone());
    let token = csrf.generate_token();
    
    Ok(Json(ApiResponse {
        success: true,
        data: Some(token),
        error: None,
    }))
}

pub async fn get_auth_status(State(state): State<AppState>) -> Result<Json<AuthStatusResponse>> {
    match state.domain_services.auth_service.get_auth_status("default_user").await {
        Ok(status) => {
            let user_info = status.user_info.map(|u| serde_json::to_value(u).unwrap_or(serde_json::Value::Null));
            Ok(Json(AuthStatusResponse {
                success: true,
                authorized: status.is_authenticated,
                user_info,
                github_configured: status.github_configured,
                message: None,
            }))
        },
        Err(e) => {
            error!("Failed to get auth status: {}", e);
            Ok(Json(AuthStatusResponse {
                success: false,
                authorized: false,
                user_info: None,
                github_configured: false,
                message: Some(e.to_string()),
            }))
        }
    }
}

pub async fn logout(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    match state.domain_services.auth_service.logout("default_user").await {
        Ok(_) => {
            info!("User logged out successfully");
            Ok(Json(serde_json::json!({"success": true, "message": "Logged out successfully"})))
        },
        Err(e) => {
            error!("Logout failed: {}", e);
            Ok(Json(serde_json::json!({"success": false, "message": format!("Logout failed: {}", e)})))
        }
    }
}

pub async fn get_current_user(
    State(state): State<AppState>,
    headers: HeaderMap
) -> Result<Json<ApiResponse<serde_json::Value>>> {
    let token = extract_bearer_token(&headers)?;
    
    match state.domain_services.auth_service.get_current_user(&token).await {
        Ok(user) => {
            let user_json = serde_json::to_value(user)
                .map_err(|e| ServerError(CoreError::Serialization(e.to_string())))?;
            Ok(Json(ApiResponse::success(user_json)))
        },
        Err(e) => Err(ServerError(CoreError::Auth(e.to_string())).into())
    }
}

pub async fn validate_auth(
    State(state): State<AppState>,
    headers: HeaderMap
) -> Result<Json<AuthValidationResponse>> {
    let token = match extract_bearer_token(&headers) {
        Ok(token) => token,
        Err(_) => return Ok(Json(AuthValidationResponse {
            valid: false,
            reason: Some("no_token".to_string()),
            message: Some("No authentication token provided".to_string()),
        }))
    };

    match state.domain_services.auth_service.validate_auth(&token).await {
        Ok(valid) => Ok(Json(AuthValidationResponse {
            valid,
            reason: None,
            message: if valid { Some("Authentication is valid".to_string()) } else { Some("Authentication is invalid".to_string()) },
        })),
        Err(e) => Ok(Json(AuthValidationResponse {
            valid: false,
            reason: Some("validation_error".to_string()),
            message: Some(e.to_string()),
        }))
    }
}

fn extract_bearer_token(headers: &HeaderMap) -> Result<String, ServerError> {
    let auth_header = headers.get("authorization")
        .ok_or_else(|| ServerError(CoreError::Auth("Missing authorization header".to_string())))?;
    
    let auth_str = auth_header.to_str()
        .map_err(|_| ServerError(CoreError::Validation("Invalid authorization header".to_string())))?;
    
    if !auth_str.starts_with("Bearer ") {
        return Err(ServerError(CoreError::Validation("Authorization header must start with 'Bearer '".to_string())));
    }
    
    Ok(auth_str[7..].to_string())
}