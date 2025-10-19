pub mod api;
pub mod files;
pub mod github;
pub mod health;
pub mod layouts;
pub mod metrics;
pub mod microsoft_auth;
pub mod processes;
pub mod sessions;
pub mod sso_auth;
pub mod system;
pub mod task_executions;
pub mod themes;
pub mod todo_sync;
pub mod user_preferences;
pub mod workspaces;

use crate::AppState;
use axum::Router;

pub fn api_routes() -> Router<AppState> {
    Router::new()
        // Public routes (no authentication required)
        .nest("/auth", sso_auth_routes()) // SSO auth routes
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
        .nest("/tasks", task_executions::routes())
        .nest("/themes", themes::routes())
        .nest("/user/preferences", user_preferences::routes())
        .nest("/microsoft", microsoft_auth_routes())
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

fn sso_auth_routes() -> Router<AppState> {
    Router::new()
        // All auth flows (device, OAuth) are handled client-side by @drmhse/sso-sdk
        // Backend only validates JWTs and provides authenticated user info
        .route("/me", axum::routing::get(sso_auth::get_me))
        .route("/logout", axum::routing::post(sso_auth::logout))
        .route(
            "/subscription",
            axum::routing::get(sso_auth::get_subscription),
        )
}

fn microsoft_auth_routes() -> Router<AppState> {
    Router::new()
        // Authentication
        .route(
            "/status",
            axum::routing::get(microsoft_auth::get_auth_status),
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
