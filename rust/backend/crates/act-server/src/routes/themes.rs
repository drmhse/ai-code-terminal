use crate::{
    models::ApiResponse,
    services::theme::{ThemeService, ThemePreference},
    AppState,
};
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use tracing::{error, info};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/current", get(get_current_theme))
        .route("/current", post(set_current_theme))
}

#[derive(Debug, Deserialize)]
pub struct SetThemeRequest {
    #[serde(flatten)]
    pub preferences: ThemePreference,
}

/// Get user's current theme preferences
async fn get_current_theme(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<ThemePreference>>, StatusCode> {
    let theme_service = ThemeService::new(state.db);
    let user_id = "anonymous"; // TODO: Add proper authentication
    
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
    Json(request): Json<SetThemeRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    let theme_service = ThemeService::new(state.db);
    let user_id = "anonymous"; // TODO: Add proper authentication
    
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