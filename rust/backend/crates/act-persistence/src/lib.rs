//! Persistence layer for ACT domain objects
//! 
//! This crate provides SQLx-based implementations of the repository traits
//! defined in act-core, enabling persistent storage of workspaces and sessions.

pub mod workspace_repository;
pub mod session_repository;
pub mod auth_repository;
pub mod layout_repository;
pub mod process_repository;
pub mod metrics_repository;
pub mod error;
pub mod theme_repository;

pub use workspace_repository::SqlWorkspaceRepository;
pub use session_repository::SqlSessionRepository;
pub use auth_repository::SqlAuthRepository;
pub use layout_repository::SqlLayoutRepository;
pub use process_repository::SqlProcessRepository;
pub use metrics_repository::SqlxMetricsRepository;
pub use theme_repository::SqlThemeRepository;
pub use error::PersistenceError;

use act_core::repository::{WorkspaceRepository, SessionRepository, LayoutRepository, ProcessRepository};
use act_core::auth::AuthRepository;
use act_core::theme::ThemeRepository;
use sqlx::SqlitePool;

/// Factory function to create all repositories with a shared database pool
pub fn create_repositories(pool: SqlitePool) -> Repositories {
    Repositories {
        workspace: SqlWorkspaceRepository::new(pool.clone()),
        session: SqlSessionRepository::new(pool.clone()),
        auth: SqlAuthRepository::new(pool.clone()),
        layout: SqlLayoutRepository::new(pool.clone()),
        process: SqlProcessRepository::new(pool.clone()),
        theme: SqlThemeRepository::new(pool.clone()),
    }
}

/// Container for all repository implementations
pub struct Repositories {
    pub workspace: SqlWorkspaceRepository,
    pub session: SqlSessionRepository,
    pub auth: SqlAuthRepository,
    pub layout: SqlLayoutRepository,
    pub process: SqlProcessRepository,
    pub theme: SqlThemeRepository,
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

    /// Get auth repository as trait object
    pub fn auth_repo(&self) -> Arc<dyn AuthRepository> {
        Arc::new(self.auth.clone())
    }

    /// Get layout repository as trait object
    pub fn layout_repo(&self) -> Arc<dyn LayoutRepository> {
        Arc::new(self.layout.clone())
    }

    /// Get process repository as trait object
    pub fn process_repo(&self) -> Arc<dyn ProcessRepository> {
        Arc::new(self.process.clone())
    }

    /// Get theme repository as trait object
    pub fn theme_repo(&self) -> Arc<dyn ThemeRepository> {
        Arc::new(self.theme.clone())
    }
}

use std::sync::Arc;