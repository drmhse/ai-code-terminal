use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum CoreError {
    #[error("Database error: {0}")]
    Database(String),
    
    #[error("Migration error: {0}")]
    Migration(String),
    
    #[error("IO error: {0}")]
    Io(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Internal server error: {0}")]
    Internal(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    #[error("Resource conflict: {0}")]
    Conflict(String),
    
    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),
    
    #[error("Operation timeout: {0}")]
    Timeout(String),
    
    #[error("Serialization error: {0}")]
    Serialization(String),
    
    #[error("PTY error: {0}")]
    Pty(String),
    
    #[error("File system error: {0}")]
    FileSystem(String),
    
    #[error("Session error: {0}")]
    Session(String),
    
    #[error("Workspace error: {0}")]
    Workspace(String),
    
    #[error("Process error: {0}")]
    Process(String),
    
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("Repository error: {0}")]
    Repository(String),
    
    #[error("Configuration error: {0}")]
    Configuration(String),
    
    #[error("Authorization error: {0}")]
    Authorization(String),
    
    #[error("External service error: {0}")]
    External(String),

    #[error("GitHub authentication required")]
    GitHubAuthRequired,
}

impl From<std::io::Error> for CoreError {
    fn from(err: std::io::Error) -> Self {
        CoreError::Io(err.to_string())
    }
}

impl From<serde_json::Error> for CoreError {
    fn from(err: serde_json::Error) -> Self {
        CoreError::Serialization(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, CoreError>;

pub type Error = CoreError;