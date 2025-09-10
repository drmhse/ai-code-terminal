//! Persistence layer for ACT domain objects
//! 
//! This crate provides SQLx-based implementations of the repository traits
//! defined in act-core, enabling persistent storage of workspaces and sessions.

pub mod workspace_repository;
pub mod session_repository;
pub mod error;

pub use workspace_repository::SqlWorkspaceRepository;
pub use session_repository::SqlSessionRepository;
pub use error::PersistenceError;

use act_core::repository::{WorkspaceRepository, SessionRepository};
use sqlx::SqlitePool;

/// Factory function to create all repositories with a shared database pool
pub fn create_repositories(pool: SqlitePool) -> Repositories {
    Repositories {
        workspace: SqlWorkspaceRepository::new(pool.clone()),
        session: SqlSessionRepository::new(pool),
    }
}

/// Container for all repository implementations
pub struct Repositories {
    pub workspace: SqlWorkspaceRepository,
    pub session: SqlSessionRepository,
}

impl Repositories {
    /// Get workspace repository as trait object
    pub fn workspace_repo(&self) -> Arc<dyn WorkspaceRepository> {
        Arc::new(self.workspace.clone())
    }

    /// Get session repository as trait object
    pub fn session_repo(&self) -> Arc<dyn SessionRepository> {
        Arc::new(self.session.clone())
    }
}

use std::sync::Arc;