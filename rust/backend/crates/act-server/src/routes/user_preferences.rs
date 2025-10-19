use crate::{
    error::ServerError, middleware::sso_auth::AuthenticatedUser, models::ApiResponse, AppState,
};
use act_core::user_preferences::UserPreferences;
use axum::{extract::State, response::Json, routing::get, Router};
use tracing::info;

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/",
        get(get_user_preferences).patch(update_user_preferences),
    )
}

async fn get_user_preferences(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Option<UserPreferences>>>, ServerError> {
    info!("Getting user preferences for user {}", user.sso_user_id);

    let preferences = state
        .domain_services
        .user_preferences_service
        .get_user_preferences(&user.db_user_id)
        .await?;

    Ok(Json(ApiResponse::success(preferences)))
}

async fn update_user_preferences(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Json(request): Json<UserPreferences>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Updating user preferences for user {}", user.sso_user_id);

    state
        .domain_services
        .user_preferences_service
        .save_user_preferences(&user.db_user_id, &request)
        .await?;

    Ok(Json(ApiResponse::success(())))
}
