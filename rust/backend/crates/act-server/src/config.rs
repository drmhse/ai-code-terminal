use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::path::PathBuf;
use std::str::FromStr;
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub sso: SsoConfig,
    pub cors: CorsConfig,
    pub workspace: WorkspaceConfig,
    pub microsoft: MicrosoftConfig,
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
pub struct CorsConfig {
    pub allowed_origins: Vec<String>,
    pub allowed_headers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub root_path: PathBuf,
    pub auto_create: bool,
    pub allow_access_to_parent_dirs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoConfig {
    pub base_url: String,
    pub org_slug: String,
    pub service_slug: String,
    pub jwks_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrosoftConfig {
    /// Encryption key for caching provider tokens from SSO
    /// Used to store Microsoft tokens securely for background sync operations
    pub encryption_key: Option<String>,
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
            cors: CorsConfig {
                allowed_origins: vec!["http://localhost:5173".to_string()],
                allowed_headers: vec![
                    "content-type".to_string(),
                    "authorization".to_string(),
                    "x-requested-with".to_string(),
                ],
            },
            workspace: WorkspaceConfig {
                root_path: std::env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .join("workspaces"),
                auto_create: true,
                allow_access_to_parent_dirs: false,
            },
            sso: SsoConfig {
                base_url: String::new(),
                org_slug: String::new(),
                service_slug: String::new(),
                jwks_url: String::new(),
            },
            microsoft: MicrosoftConfig {
                encryption_key: None,
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
            config.database.max_connections = max_connections
                .parse()
                .unwrap_or(config.database.max_connections);
        }

        if let Ok(host) = std::env::var("ACT_SERVER_HOST") {
            config.server.host = host;
        }

        if let Ok(port) = std::env::var("ACT_SERVER_PORT") {
            config.server.port = port.parse().unwrap_or(config.server.port);
        }

        // Handle CORS origins (could be multiple)
        if let Ok(origins) = std::env::var("ACT_CORS_ALLOWED_ORIGINS") {
            config.cors.allowed_origins =
                origins.split(',').map(|s| s.trim().to_string()).collect();
        }

        // Handle workspace configuration
        if let Ok(workspace_root) = std::env::var("ACT_WORKSPACE_ROOT_PATH") {
            config.workspace.root_path = PathBuf::from(&workspace_root);
        }

        // Handle parent directory access flag
        if let Ok(allow_parent_dirs) = std::env::var("ALLOW_ACCESS_TO_PARENT_DIRS") {
            config.workspace.allow_access_to_parent_dirs =
                allow_parent_dirs.to_lowercase() == "true" || allow_parent_dirs == "1";
        }

        // Handle Microsoft token encryption configuration
        // Note: OAuth is handled by SSO, but we still need encryption for token caching
        if let Ok(encryption_key) = std::env::var("MS_ENCRYPTION_KEY") {
            config.microsoft.encryption_key = Some(encryption_key);
        }

        // Handle SSO configuration
        // Note: SSO server handles client identification automatically via org and service slugs
        if let Ok(sso_base_url) = std::env::var("ACT_SSO_BASE_URL") {
            config.sso.base_url = sso_base_url;
        }

        if let Ok(sso_org_slug) = std::env::var("ACT_SSO_ORG_SLUG") {
            config.sso.org_slug = sso_org_slug;
        }

        if let Ok(sso_service_slug) = std::env::var("ACT_SSO_SERVICE_SLUG") {
            config.sso.service_slug = sso_service_slug;
        }

        if let Ok(sso_jwks_url) = std::env::var("ACT_SSO_JWKS_URL") {
            config.sso.jwks_url = sso_jwks_url;
        }

        Ok(config)
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<(), String> {
        // Validate server configuration
        self.validate_server_config()?;

        // Validate database configuration
        self.validate_database_config()?;

        // Validate SSO configuration
        self.validate_sso_config()?;

        // Validate CORS configuration
        self.validate_cors_config()?;

        Ok(())
    }

    /// Validate server configuration
    fn validate_server_config(&self) -> Result<(), String> {
        // Validate host is a valid IP address or localhost
        if self.server.host != "localhost"
            && self.server.host != "0.0.0.0"
            && IpAddr::from_str(&self.server.host).is_err()
        {
            return Err(format!("Invalid server host: {}", self.server.host));
        }

        // Validate port is in valid range
        if !(1..=65535).contains(&self.server.port) {
            return Err(format!("Invalid server port: {}", self.server.port));
        }

        // Validate static files path if provided
        if let Some(ref static_path) = self.server.static_files {
            if !static_path.exists() {
                return Err(format!(
                    "Static files path does not exist: {}",
                    static_path.display()
                ));
            }
        }

        Ok(())
    }

    /// Validate database configuration
    fn validate_database_config(&self) -> Result<(), String> {
        // Validate database URL format
        if !self.database.url.starts_with("sqlite:")
            && !self.database.url.starts_with("postgres:")
            && !self.database.url.starts_with("mysql:")
        {
            return Err(format!(
                "Invalid database URL format: {}",
                self.database.url
            ));
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

    /// Validate SSO configuration
    fn validate_sso_config(&self) -> Result<(), String> {
        if self.sso.base_url.is_empty() {
            return Err("SSO base URL cannot be empty".to_string());
        }

        if Url::parse(&self.sso.base_url).is_err() {
            return Err(format!("Invalid SSO base URL: {}", self.sso.base_url));
        }

        if self.sso.org_slug.is_empty() {
            return Err("SSO organization slug is required".to_string());
        }

        if self.sso.service_slug.is_empty() {
            return Err("SSO service slug is required".to_string());
        }

        if self.sso.jwks_url.is_empty() {
            return Err("SSO JWKS URL is required".to_string());
        }

        if Url::parse(&self.sso.jwks_url).is_err() {
            return Err(format!("Invalid SSO JWKS URL: {}", self.sso.jwks_url));
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
            if !self
                .cors
                .allowed_headers
                .iter()
                .any(|h| h.to_lowercase() == *essential)
            {
                return Err(format!("Essential CORS header '{}' is missing", essential));
            }
        }

        Ok(())
    }
}
