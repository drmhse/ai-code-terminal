pub mod api;
pub mod auth;
pub mod github;
pub mod files;
pub mod health;
pub mod workspaces;
pub mod sessions;
pub mod layouts;
pub mod processes;
pub mod metrics;
pub mod system;
pub mod themes;
pub mod user_preferences;

use axum::Router;
use crate::AppState;

pub fn api_routes() -> Router<AppState> {
    Router::new()
        // Public routes (no authentication required)
        .nest("/auth", auth_routes())
        .nest("/github", github_routes())
        .nest("/health", health::routes())
        // Protected routes (authentication required)
        .nest("/files", files::routes())
        .nest("/workspaces", workspaces::routes())
        .nest("/sessions", sessions::routes())
        .nest("/layouts", layouts::routes())
        .nest("/processes", processes::routes())
        .nest("/metrics", metrics::routes())
        .nest("/system", system::routes())
        .nest("/themes", themes::routes())
        .nest("/user/preferences", user_preferences::routes())
}

fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/csrf", axum::routing::get(auth::get_csrf_token))
        .route("/status", axum::routing::get(auth::get_auth_status))
        .route("/validate", axum::routing::get(auth::validate_auth))
        .route("/logout", axum::routing::post(auth::logout))
        .route("/me", axum::routing::get(auth::get_current_user))
        .route("/github/callback", axum::routing::get(auth::handle_github_callback))
        .route("/github/authorize", axum::routing::get(auth::start_authorization))
}

fn github_routes() -> Router<AppState> {
    Router::new()
        .route("/repositories", axum::routing::get(github::list_repositories))
        .route("/repositories/:owner/:repo", axum::routing::get(github::get_repository_info))
        .route("/clone", axum::routing::post(github::clone_repository))
}