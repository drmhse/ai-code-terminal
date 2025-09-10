use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::net::IpAddr;
use std::str::FromStr;
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub auth: AuthConfig,
    pub cors: CorsConfig,
    pub workspace: WorkspaceConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub static_files: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub github_client_id: String,
    pub github_client_secret: String,
    pub github_redirect_url: String,
    pub tenant_github_usernames: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorsConfig {
    pub allowed_origins: Vec<String>,
    pub allowed_headers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub root_path: PathBuf,
    pub auto_create: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 3001,
                static_files: None,
            },
            database: DatabaseConfig {
                url: "sqlite:./data/act.db".to_string(),
                max_connections: 10,
            },
            auth: AuthConfig {
                jwt_secret: "your-secret-key-change-in-production".to_string(),
                github_client_id: String::new(),
                github_client_secret: String::new(),
                github_redirect_url: "http://localhost:3001/auth/callback".to_string(),
                tenant_github_usernames: Vec::new(),
            },
            cors: CorsConfig {
                allowed_origins: vec!["http://localhost:5173".to_string()],
                allowed_headers: vec![
                    "content-type".to_string(),
                    "authorization".to_string(),
                    "x-requested-with".to_string(),
                ],
            },
            workspace: WorkspaceConfig {
                root_path: PathBuf::from("./workspaces"),
                auto_create: true,
            },
        }
    }
}

impl Config {
    /// Load configuration from environment variables and optional TOML file
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        // Load .env file if it exists
        dotenvy::dotenv().ok();
        
        let mut config = Config::default();
        
        // Override with environment variables if they exist
        if let Ok(url) = std::env::var("ACT_DATABASE_URL") {
            config.database.url = url;
        }
        
        if let Ok(max_connections) = std::env::var("ACT_DATABASE_MAX_CONNECTIONS") {
            config.database.max_connections = max_connections.parse().unwrap_or(config.database.max_connections);
        }
        
        if let Ok(host) = std::env::var("ACT_SERVER_HOST") {
            config.server.host = host;
        }
        
        if let Ok(port) = std::env::var("ACT_SERVER_PORT") {
            config.server.port = port.parse().unwrap_or(config.server.port);
        }
        
        if let Ok(jwt_secret) = std::env::var("ACT_AUTH_JWT_SECRET") {
            config.auth.jwt_secret = jwt_secret;
        }
        
        if let Ok(github_client_id) = std::env::var("ACT_AUTH_GITHUB_CLIENT_ID") {
            config.auth.github_client_id = github_client_id;
        }
        
        if let Ok(github_client_secret) = std::env::var("ACT_AUTH_GITHUB_CLIENT_SECRET") {
            config.auth.github_client_secret = github_client_secret;
        }
        
        if let Ok(github_redirect_url) = std::env::var("ACT_AUTH_GITHUB_REDIRECT_URL") {
            config.auth.github_redirect_url = github_redirect_url;
        }
        
        if let Ok(tenant_github_usernames) = std::env::var("ACT_AUTH_TENANT_GITHUB_USERNAME") {
            config.auth.tenant_github_usernames = tenant_github_usernames
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }
        
        // Handle CORS origins (could be multiple)
        if let Ok(origins) = std::env::var("ACT_CORS_ALLOWED_ORIGINS") {
            config.cors.allowed_origins = origins.split(',').map(|s| s.trim().to_string()).collect();
        }
        
        // Handle workspace configuration
        if let Ok(workspace_root) = std::env::var("ACT_WORKSPACE_ROOT_PATH") {
            config.workspace.root_path = PathBuf::from(&workspace_root);
        }
        
        Ok(config)
    }
    
    /// Validate that required environment variables are present
    #[allow(dead_code, clippy::result_large_err)]
    pub fn validate_required_env_vars() -> Result<(), figment::Error> {
        let required_vars = [
            "ACT_AUTH_JWT_SECRET",
            "ACT_AUTH_GITHUB_CLIENT_ID", 
            "ACT_AUTH_GITHUB_CLIENT_SECRET",
            "ACT_AUTH_TENANT_GITHUB_USERNAME",
        ];
        
        let missing_vars: Vec<String> = required_vars
            .iter()
            .filter(|&var| std::env::var(var).is_err())
            .map(|&var| var.to_string())
            .collect();
        
        if !missing_vars.is_empty() {
            return Err(figment::error::Kind::Message(format!("Missing required environment variables: {}", missing_vars.join(", "))).into());
        }
        
        // Warn about optional but recommended variables
        let recommended_vars = [
            "ACT_DATABASE_URL",
            "ACT_SERVER_HOST",
            "ACT_SERVER_PORT",
            "ACT_CORS_ALLOWED_ORIGINS_0",
        ];
        
        let missing_recommended: Vec<String> = recommended_vars
            .iter()
            .filter(|&var| std::env::var(var).is_err())
            .map(|&var| var.to_string())
            .collect();
        
        if !missing_recommended.is_empty() {
            tracing::warn!("Recommended environment variables not set: {}. Using defaults.", missing_recommended.join(", "));
        }
        
        Ok(())
    }
    
    /// Validate configuration
    pub fn validate(&self) -> Result<(), String> {
        // Validate server configuration
        self.validate_server_config()?;
        
        // Validate database configuration
        self.validate_database_config()?;
        
        // Validate authentication configuration
        self.validate_auth_config()?;
        
        // Validate CORS configuration
        self.validate_cors_config()?;
        
        Ok(())
    }
    
    /// Validate server configuration
    fn validate_server_config(&self) -> Result<(), String> {
        // Validate host is a valid IP address or localhost
        if self.server.host != "localhost" && 
           self.server.host != "0.0.0.0" && 
           IpAddr::from_str(&self.server.host).is_err() {
            return Err(format!("Invalid server host: {}", self.server.host));
        }
        
        // Validate port is in valid range
        if !(1..=65535).contains(&self.server.port) {
            return Err(format!("Invalid server port: {}", self.server.port));
        }
        
        // Validate static files path if provided
        if let Some(ref static_path) = self.server.static_files {
            if !static_path.exists() {
                return Err(format!("Static files path does not exist: {}", static_path.display()));
            }
        }
        
        Ok(())
    }
    
    /// Validate database configuration
    fn validate_database_config(&self) -> Result<(), String> {
        // Validate database URL format
        if !self.database.url.starts_with("sqlite:") && 
           !self.database.url.starts_with("postgres:") && 
           !self.database.url.starts_with("mysql:") {
            return Err(format!("Invalid database URL format: {}", self.database.url));
        }
        
        // Validate max connections is reasonable
        if self.database.max_connections == 0 {
            return Err("Database max connections must be at least 1".to_string());
        }
        
        if self.database.max_connections > 100 {
            return Err("Database max connections cannot exceed 100".to_string());
        }
        
        Ok(())
    }
    
    /// Validate authentication configuration
    fn validate_auth_config(&self) -> Result<(), String> {
        if self.auth.jwt_secret.is_empty() {
            return Err("JWT secret cannot be empty".to_string());
        }
        
        if self.auth.jwt_secret.len() < 32 {
            return Err("JWT secret must be at least 32 characters long".to_string());
        }
        
        if self.auth.jwt_secret == "your-secret-key-change-in-production" {
            tracing::warn!("Using default JWT secret - change this in production!");
        }
        
        if self.auth.github_client_id.is_empty() {
            return Err("GitHub client ID is required".to_string());
        }
        
        if self.auth.github_client_secret.is_empty() {
            return Err("GitHub client secret is required".to_string());
        }
        
        if self.auth.tenant_github_usernames.is_empty() {
            return Err("At least one tenant GitHub username is required".to_string());
        }
        
        // Validate GitHub redirect URL is a valid URL
        if Url::parse(&self.auth.github_redirect_url).is_err() {
            return Err(format!("Invalid GitHub redirect URL: {}", self.auth.github_redirect_url));
        }
        
        // Validate each GitHub username format (alphanumeric and hyphens only)
        for username in &self.auth.tenant_github_usernames {
            if !username.chars().all(|c| c.is_alphanumeric() || c == '-') {
                return Err(format!("GitHub username '{}' can only contain alphanumeric characters and hyphens", username));
            }
        }
        
        Ok(())
    }
    
    /// Validate CORS configuration
    fn validate_cors_config(&self) -> Result<(), String> {
        if self.cors.allowed_origins.is_empty() {
            return Err("At least one CORS origin must be allowed".to_string());
        }
        
        // Validate each origin is a valid URL or wildcard
        for origin in &self.cors.allowed_origins {
            if origin != "*" && Url::parse(origin).is_err() {
                return Err(format!("Invalid CORS origin: {}", origin));
            }
        }
        
        if self.cors.allowed_headers.is_empty() {
            return Err("At least one CORS header must be allowed".to_string());
        }
        
        // Check for essential headers
        let essential_headers = ["content-type", "authorization", "x-requested-with"];
        for essential in &essential_headers {
            if !self.cors.allowed_headers.iter().any(|h| h.to_lowercase() == *essential) {
                return Err(format!("Essential CORS header '{}' is missing", essential));
            }
        }
        
        Ok(())
    }
}