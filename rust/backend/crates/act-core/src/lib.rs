pub mod db;
pub mod error;
pub mod pty;
pub mod filesystem;
pub mod repository;
pub mod models;
pub mod auth;
pub mod theme;

pub use error::{CoreError, Error, Result};
pub use db::Database;

pub use pty::{PtyService, PtyEvent, PtySize, SessionConfig, SessionInfo};
pub use filesystem::{
    FileSystem, FileItem, FilePermissions, DirectoryListing, FileContent,
    CreateFileRequest, CreateDirectoryRequest, MoveRequest, CopyRequest
};
pub use repository::{
    WorkspaceRepository, SessionRepository, Workspace, Session, SessionStatus, SessionType,
    TerminalSize, CreateWorkspaceRequest, UpdateWorkspaceRequest,
    CreateSessionRequest, UpdateSessionRequest,
    WorkspaceId, SessionId, LayoutId, UserId
};
pub use models::{
    Settings, TerminalLayout, TerminalLayoutConfig, PaneConfig, PaneType,
    PanelSize, PanelPosition, UserProcess, ProcessStatus, SystemMetrics, ApiResponse
};
pub use auth::{
    AuthenticatedUser, AuthToken, JwtClaims, AuthConfig,
    GitHubAuthService, JwtService, AuthRepository,
    GitHubRepository, GitHubRepositoryOwner, GitHubRepositoryService, RepositoryListOptions
};
pub use theme::{ThemePreference, ThemeRepository};