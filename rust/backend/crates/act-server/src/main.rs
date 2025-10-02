#![warn(clippy::clone_on_copy)]

mod app_state;
mod config;
mod error;
mod metrics;
mod middleware;
mod models;
mod routes;
mod services;
mod socket_handlers;
mod utils;

use app_state::AppState;
use axum::Router;
use config::Config;
use socketioxide::SocketIo;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "act_server=debug,tower_http=debug".into()),
        )
        .init();

    info!("Starting AI Code Terminal server...");

    // Load configuration
    let config =
        Config::load().map_err(|err| anyhow::anyhow!("Failed to load configuration: {}", err))?;

    // Validate configuration
    config
        .validate()
        .map_err(|err| anyhow::anyhow!("Configuration validation failed: {}", err))?;

    info!("Configuration loaded successfully");

    // Create application state with dependency injection
    let state = AppState::new(config.clone())
        .await
        .map_err(|err| anyhow::anyhow!("Failed to create application state: {}", err))?;

    info!("Application state initialized with domain services");

    // Create Socket.IO server
    let (socket_layer, io) = SocketIo::new_layer();

    // Initialize TaskExecutionService with Socket.IO broadcaster
    let broadcaster =
        std::sync::Arc::new(socket_handlers::SocketIOOutputBroadcaster::new(io.clone()));
    state.initialize_task_execution_service(broadcaster).await;
    info!("TaskExecutionService initialized with Socket.IO broadcaster");

    // Setup socket handlers with domain services
    socket_handlers::setup_socket_handlers(io, std::sync::Arc::new(state.clone()));
    info!("WebSocket handlers initialized with domain services");

    // Validate CORS configuration
    middleware::cors::validate_cors_config(&config.cors.allowed_origins)
        .map_err(|err| anyhow::anyhow!("CORS configuration validation failed: {}", err))?;

    // Create CORS layer
    let cors = middleware::cors::setup_cors(config.cors.allowed_origins.clone());

    // Build the application router
    let app = Router::new()
        .nest("/api/v1", routes::api_routes())
        .layer(cors)
        .layer(axum::middleware::from_fn(
            middleware::csrf::CsrfProtection::verify_csrf,
        ))
        .layer(socket_layer) // Add Socket.IO layer
        .with_state(state);

    // Start the server
    let listener =
        tokio::net::TcpListener::bind(format!("{}:{}", config.server.host, config.server.port))
            .await?;

    info!(
        "AI Code Terminal server listening on http://{}:{}",
        config.server.host, config.server.port
    );
    info!(
        "📡 WebSocket endpoint available at ws://{}:{}/socket.io/",
        config.server.host, config.server.port
    );

    axum::serve(listener, app).await?;

    Ok(())
}
