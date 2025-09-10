use act_core::error::CoreError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PersistenceError {
    #[error("Database connection error: {0}")]
    DatabaseConnection(#[from] sqlx::Error),

    #[error("Workspace not found: {0}")]
    WorkspaceNotFound(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Invalid session state: {0}")]
    InvalidSessionState(String),
}

impl From<PersistenceError> for CoreError {
    fn from(err: PersistenceError) -> Self {
        match err {
            PersistenceError::DatabaseConnection(e) => CoreError::Database(format!("Database error: {}", e)),
            PersistenceError::WorkspaceNotFound(id) => CoreError::NotFound(format!("Workspace {}", id)),
            PersistenceError::SessionNotFound(id) => CoreError::NotFound(format!("Session {}", id)),
            PersistenceError::Serialization(e) => CoreError::Serialization(e.to_string()),
            PersistenceError::SerializationError(msg) => CoreError::Serialization(msg),
            PersistenceError::InvalidSessionState(msg) => CoreError::Validation(msg),
        }
    }
}