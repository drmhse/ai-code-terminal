pub mod api;
pub mod auth;
pub mod github;
pub mod files;
pub mod health;
pub mod workspaces;
pub mod sessions;
pub mod layouts;
pub mod themes;
pub mod metrics;
pub mod processes;
pub mod system;

use axum::Router;
use crate::AppState;

pub fn api_routes() -> Router<AppState> {
    Router::new()
        .nest("/auth", auth_routes())
        .nest("/github", github_routes())
        .nest("/health", health::routes())
        .nest("/files", files::routes())
        .nest("/workspaces", workspaces::routes())
        .nest("/sessions", sessions::routes())
        .nest("/layouts", layouts::routes())
        .nest("/themes", themes::routes())
        .nest("/metrics", metrics::routes())
        .nest("/processes", processes::routes())
        .nest("/system", system::routes())
}

fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/status", axum::routing::get(auth::get_auth_status))
        .route("/validate", axum::routing::get(auth::validate_auth))
        .route("/logout", axum::routing::post(auth::logout))
        .route("/me", axum::routing::get(auth::get_current_user))
        .route("/github/callback", axum::routing::get(auth::handle_github_callback))
}

fn github_routes() -> Router<AppState> {
    Router::new()
        .route("/auth", axum::routing::get(auth::start_authorization))
        .route("/repositories", axum::routing::get(github::get_repositories))
        .route("/repositories/:owner/:repo", axum::routing::get(github::get_repository))
        .route("/clone", axum::routing::post(github::clone_repository))
}