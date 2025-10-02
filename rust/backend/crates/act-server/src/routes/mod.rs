pub mod api;
pub mod auth;
pub mod files;
pub mod github;
pub mod health;
pub mod layouts;
pub mod metrics;
pub mod microsoft_auth;
pub mod processes;
pub mod sessions;
pub mod system;
pub mod themes;
pub mod todo_sync;
pub mod user_preferences;
pub mod workspaces;

use crate::AppState;
use axum::Router;

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
        .nest("/microsoft", microsoft_auth_routes())
}

fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/csrf", axum::routing::get(auth::get_csrf_token))
        .route("/status", axum::routing::get(auth::get_auth_status))
        .route("/validate", axum::routing::get(auth::validate_auth))
        .route("/logout", axum::routing::post(auth::logout))
        .route("/me", axum::routing::get(auth::get_current_user))
        .route(
            "/github/callback",
            axum::routing::get(auth::handle_github_callback),
        )
        .route(
            "/github/authorize",
            axum::routing::get(auth::start_authorization),
        )
}

fn github_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/repositories",
            axum::routing::get(github::list_repositories),
        )
        .route(
            "/repositories/:owner/:repo",
            axum::routing::get(github::get_repository_info),
        )
        .route("/clone", axum::routing::post(github::clone_repository))
}

fn microsoft_auth_routes() -> Router<AppState> {
    Router::new()
        // Authentication
        .route(
            "/status",
            axum::routing::get(microsoft_auth::get_auth_status),
        )
        .route(
            "/connect",
            axum::routing::get(microsoft_auth::start_oauth_flow),
        )
        .route(
            "/callback",
            axum::routing::post(microsoft_auth::handle_oauth_callback),
        )
        .route(
            "/disconnect",
            axum::routing::delete(microsoft_auth::disconnect_microsoft),
        )
        // Lists and tasks
        .route(
            "/lists",
            axum::routing::get(microsoft_auth::get_all_task_lists),
        )
        .route(
            "/lists",
            axum::routing::post(microsoft_auth::create_task_list),
        )
        .route(
            "/lists/default",
            axum::routing::get(microsoft_auth::get_default_task_list),
        )
        .route(
            "/lists/:list_id/tasks",
            axum::routing::get(microsoft_auth::get_list_tasks),
        )
        .route(
            "/lists/:list_id/tasks",
            axum::routing::post(microsoft_auth::create_task_in_list),
        )
        .route(
            "/lists/:list_id/tasks/:task_id",
            axum::routing::get(microsoft_auth::get_task),
        )
        .route(
            "/lists/:list_id/tasks/:task_id",
            axum::routing::put(microsoft_auth::update_task),
        )
        .route(
            "/lists/:list_id/tasks/:task_id",
            axum::routing::delete(microsoft_auth::delete_task),
        )
        // Sync operations (nested from todo_sync module)
        .nest("/sync", todo_sync::routes())
        // Utilities
        .route("/health", axum::routing::get(microsoft_auth::health_check))
}
