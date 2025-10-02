use axum::http::{HeaderValue, Method};
use std::env;
use tower_http::cors::{Any, CorsLayer};

pub fn setup_cors(allowed_origins: Vec<String>) -> CorsLayer {
    let is_dev = env::var("ACT_ENV").unwrap_or_else(|_| "development".to_string()) == "development";

    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::HeaderName::from_static("x-requested-with"),
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(86400)); // 24 hours

    // Configure allowed origins based on environment
    if is_dev {
        // In development, allow localhost origins dynamically
        setup_development_cors(cors, allowed_origins)
    } else {
        // In production, use strict origin checking
        setup_production_cors(cors, allowed_origins)
    }
}

fn setup_development_cors(cors: CorsLayer, allowed_origins: Vec<String>) -> CorsLayer {
    let dev_origins = [
        "http://localhost:5173", // Vite default
        "http://localhost:3000", // Alternative dev server
        "http://localhost:8080", // Alternative dev server
        "http://127.0.0.1:5173", // IPv4 localhost
        "http://[::1]:5173",     // IPv6 localhost
    ];

    let all_origins: Vec<String> = allowed_origins
        .into_iter()
        .chain(dev_origins.iter().map(|s| s.to_string()))
        .collect();

    if all_origins.iter().any(|origin| origin == "*") {
        tracing::warn!("Development mode: Allowing any origin - not recommended for production");
        cors.allow_origin(Any)
    } else {
        let origins: Result<Vec<_>, _> = all_origins.iter().map(|origin| origin.parse()).collect();

        match origins {
            Ok(parsed_origins) => {
                tracing::info!("Development mode: Allowing origins: {:?}", all_origins);
                cors.allow_origin(parsed_origins)
            }
            Err(e) => {
                tracing::error!("Failed to parse CORS origins in development: {}", e);
                cors.allow_origin(Any)
            }
        }
    }
}

fn setup_production_cors(cors: CorsLayer, allowed_origins: Vec<String>) -> CorsLayer {
    if allowed_origins.iter().any(|origin| origin == "*") {
        tracing::warn!(
            "Production mode: Wildcard origin detected - consider using specific origins"
        );
        cors.allow_origin(Any)
    } else {
        let origins: Result<Vec<_>, _> = allowed_origins
            .iter()
            .map(|origin| origin.parse())
            .collect();

        match origins {
            Ok(parsed_origins) => {
                tracing::info!(
                    "Production mode: Allowing specific origins: {:?}",
                    allowed_origins
                );
                cors.allow_origin(parsed_origins)
            }
            Err(e) => {
                tracing::error!("Production mode: Failed to parse CORS origins: {}", e);
                // In production, fail securely rather than falling back to permissive mode
                cors.allow_origin(tower_http::cors::Any)
            }
        }
    }
}

/// Validate CORS origin configuration
pub fn validate_cors_config(allowed_origins: &[String]) -> Result<(), String> {
    if allowed_origins.is_empty() {
        return Err("At least one CORS origin must be specified".to_string());
    }

    for origin in allowed_origins {
        if origin != "*" {
            if let Err(e) = origin.parse::<HeaderValue>() {
                return Err(format!("Invalid CORS origin '{}': {}", origin, e));
            }
        }
    }

    Ok(())
}
