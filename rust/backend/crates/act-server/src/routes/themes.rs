use crate::{
    error::ServerError, middleware::sso_auth::AuthenticatedUser, models::ApiResponse, AppState,
};
use act_core::theme::ThemePreference;
use axum::{extract::State, response::Json, routing::get, Router};
use tracing::info;

pub fn routes() -> Router<AppState> {
    Router::new().route("/current", get(get_current_theme).post(save_current_theme))
}

async fn get_current_theme(
    State(state): State<AppState>,
    user: AuthenticatedUser,
) -> Result<Json<ApiResponse<Option<ThemePreference>>>, ServerError> {
    info!("Getting theme for user {}", user.sso_user_id);

    let preference = state
        .domain_services
        .theme_service
        .get_theme_preference(&user.db_user_id)
        .await?;

    Ok(Json(ApiResponse::success(preference)))
}

async fn save_current_theme(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Json(request): Json<ThemePreference>,
) -> Result<Json<ApiResponse<()>>, ServerError> {
    info!("Saving theme for user {}", user.sso_user_id);

    state
        .domain_services
        .theme_service
        .save_theme_preference(&user.db_user_id, &request)
        .await?;

    Ok(Json(ApiResponse::success(())))
}
