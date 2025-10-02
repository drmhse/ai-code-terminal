use crate::AppState;
use axum::{extract::State, response::Json, routing::get, Router};
use serde_json::{json, Value};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(health_check))
        .route("/ready", get(readiness_check))
}

pub async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "service": "act-server",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

pub async fn readiness_check(State(state): State<AppState>) -> Json<Value> {
    // Check database connectivity
    let db_healthy = match sqlx::query("SELECT 1").fetch_one(state.db.pool()).await {
        Ok(_) => true,
        Err(err) => {
            tracing::error!("Database health check failed: {}", err);
            false
        }
    };

    Json(json!({
        "status": if db_healthy { "ready" } else { "not_ready" },
        "checks": {
            "database": db_healthy
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
