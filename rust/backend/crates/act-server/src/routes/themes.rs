use crate::{
    middleware::auth::{AuthenticatedUser, Claims},
    models::ApiResponse,
    services::theme::{ThemeService, ThemePreference},
    AppState,
};
use axum::{
    extract::State,
    http::{StatusCode, HeaderMap},
    response::Json,
    routing::{get, post},
    Router,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;
use tracing::{error, info, warn};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/current", get(get_current_theme))
        .route("/current", post(set_current_theme))
}

/// Helper function to extract authenticated user from JWT token
async fn extract_authenticated_user(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<AuthenticatedUser, StatusCode> {
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
            warn!("No authorization header found");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };
    
    // Verify JWT with secret from config
    let secret = DecodingKey::from_secret(state.config.auth.jwt_secret.as_ref());
    let validation = Validation::default();
    let token_data = decode::<Claims>(&token, &secret, &validation)
        .map_err(|e| {
            warn!("JWT verification failed: {}", e);
            StatusCode::UNAUTHORIZED
        })?;
    
    let claims = token_data.claims;
    
    Ok(AuthenticatedUser {
        user_id: claims.sub.clone(),
        username: claims.github_username.clone(),
    })
}

#[derive(Debug, Deserialize)]
pub struct SetThemeRequest {
    #[serde(flatten)]
    pub preferences: ThemePreference,
}

/// Get user's current theme preferences
async fn get_current_theme(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<ApiResponse<ThemePreference>>, StatusCode> {
    let auth_user = extract_authenticated_user(&headers, &state).await?;
    let theme_service = ThemeService::new(state.db);
    let user_id = &auth_user.user_id;
    
    match theme_service.get_user_preferences(user_id).await {
        Ok(Some(preferences)) => {
            info!("Retrieved theme preferences for user {}: {}", user_id, preferences.theme_id);
            Ok(Json(ApiResponse {
                success: true,
                data: Some(preferences),
                error: None,
            }))
        }
        Ok(None) => {
            // Return default preferences if user hasn't set any
            let default_preferences = ThemeService::get_default_preferences();
            info!("No theme preferences found for user {}, returning defaults", user_id);
            Ok(Json(ApiResponse {
                success: true,
                data: Some(default_preferences),
                error: None,
            }))
        }
        Err(err) => {
            error!("Failed to get theme preferences for user {}: {}", user_id, err);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Set user's theme preferences
async fn set_current_theme(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(request): Json<SetThemeRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    let auth_user = extract_authenticated_user(&headers, &state).await?;
    let theme_service = ThemeService::new(state.db);
    let user_id = &auth_user.user_id;
    
    // Validate theme_id (basic validation - frontend manages available themes)
    if request.preferences.theme_id.trim().is_empty() {
        return Ok(Json(ApiResponse {
            success: false,
            data: None,
            error: Some("Theme ID cannot be empty".to_string()),
        }));
    }

    match theme_service.save_user_preferences(user_id, &request.preferences).await {
        Ok(()) => {
            info!("Saved theme preferences for user {}: {}", user_id, request.preferences.theme_id);
            Ok(Json(ApiResponse {
                success: true,
                data: Some(()),
                error: None,
            }))
        }
        Err(err) => {
            error!("Failed to save theme preferences for user {}: {}", user_id, err);
            Ok(Json(ApiResponse {
                success: false,
                data: None,
                error: Some("Failed to save theme preferences".to_string()),
            }))
        }
    }
}