mod config;
mod routes;
mod services;
mod middleware;
mod models;
mod socket;

use act_core::Database;
use axum::Router;
use config::Config;
use services::PtyService;
use std::sync::Arc;
use tokio::sync::Mutex;
use socketioxide::SocketIo;
use tracing::{info, error, debug};

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: Config,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "act_server=debug,tower_http=debug".into())
        )
        .init();

    info!("Starting AI Code Terminal server...");

    // Load configuration
    let config = Config::load()
        .map_err(|err| anyhow::anyhow!("Failed to load configuration: {}", err))?;
    
    // Validate configuration
    config.validate()
        .map_err(|err| anyhow::anyhow!("Configuration validation failed: {}", err))?;

    info!("Configuration loaded successfully");

    // Initialize database
    let database = Database::new(&config.database.url).await?;
    
    // Run migrations
    database.migrate().await?;

    // Initialize PTY service
    let pty_service = Arc::new(Mutex::new(PtyService::new()));
    info!("PTY service initialized");

    // Initialize session manager
    let session_manager = Arc::new(services::SessionManager::new(database.clone(), pty_service.clone()));
    info!("Session manager initialized");

    // Start background session cleanup task
    let session_manager_cleanup = session_manager.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600)); // Every hour
        loop {
            interval.tick().await;
            if let Err(e) = session_manager_cleanup.cleanup_expired_sessions().await {
                error!("Failed to cleanup expired sessions: {}", e);
            } else {
                debug!("Session cleanup completed");
            }
        }
    });
    info!("Session cleanup task started");

    // Create application state
    let state = AppState {
        db: database,
        config: config.clone(),
    };

    // Create Socket.IO server
    let (socket_layer, io) = SocketIo::new_layer();
    
    // Set up socket event handlers
    socket::setup_socket_handlers(io, pty_service.clone(), session_manager.clone(), state.clone());
    info!("WebSocket handlers configured");

    // Validate CORS configuration
    middleware::cors::validate_cors_config(&config.cors.allowed_origins)
        .map_err(|err| anyhow::anyhow!("CORS configuration validation failed: {}", err))?;
    
    // Create CORS layer
    let cors = middleware::cors::setup_cors(config.cors.allowed_origins.clone());

    // Build the application router
    let app = Router::new()
        .nest("/api/v1", routes::api_routes())
        .layer(cors)
        .layer(socket_layer)  // Add Socket.IO layer
        .with_state(state);

    // Start the server
    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.server.host, config.server.port)).await?;
    
    info!("🚀 AI Code Terminal server listening on http://{}:{}", config.server.host, config.server.port);
    info!("📡 WebSocket endpoint available at ws://{}:{}/socket.io/", config.server.host, config.server.port);

    axum::serve(listener, app).await?;

    Ok(())
}