mod config;
mod routes;
mod middleware;
mod models;
mod services;
mod socket_handlers;
mod app_state;
mod error;
mod metrics;

use axum::Router;
use config::Config;
use tracing::{info, warn};
use app_state::AppState;
use socketioxide::SocketIo;

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

    // Create application state with dependency injection
    let state = AppState::new(config.clone()).await
        .map_err(|err| anyhow::anyhow!("Failed to create application state: {}", err))?;
    
    info!("Application state initialized with domain services");

    // Perform initial session reconciliation
    info!("Performing initial session reconciliation...");
    
    // Get all users from the system
    let users_to_reconcile = match state.domain_services.auth_service.get_all_users().await {
        Ok(users) => {
            let user_ids: Vec<String> = users.into_iter().map(|user| user.user_id).collect();
            info!("Found {} users for session reconciliation", user_ids.len());
            user_ids
        }
        Err(e) => {
            warn!("Failed to get users for session reconciliation: {}", e);
            // Fallback to single user mode for backward compatibility
            vec!["single-tenant".to_string()]
        }
    };
    
    for user_id in users_to_reconcile {
        match state.domain_services.session_service.reconcile_sessions(&user_id).await {
            Ok(result) => {
                info!("Session reconciliation for user {}: recovered={}, cleaned={}, failed={}", 
                      user_id, result.recovered_sessions, result.cleaned_sessions, result.failed_sessions);
            }
            Err(e) => {
                warn!("Session reconciliation failed for user {}: {}", user_id, e);
            }
        }
        
        // Start periodic reconciliation for this user (every 30 minutes)
        state.domain_services.session_service
            .start_periodic_reconciliation(user_id.clone(), 30);
    }
    
    info!("Session reconciliation initialized");

    // Create Socket.IO server
    let (socket_layer, io) = SocketIo::new_layer();
    
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
        .layer(axum::middleware::from_fn(middleware::csrf::CsrfProtection::verify_csrf))
        .layer(socket_layer)  // Add Socket.IO layer
        .with_state(state);

    // Start the server
    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.server.host, config.server.port)).await?;
    
    info!("🚀 AI Code Terminal server listening on http://{}:{}", config.server.host, config.server.port);
    info!("📡 WebSocket endpoint available at ws://{}:{}/socket.io/", config.server.host, config.server.port);

    axum::serve(listener, app).await?;

    Ok(())
}