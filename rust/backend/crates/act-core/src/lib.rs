pub mod db;
pub mod error;
pub mod pty;
pub mod filesystem;
pub mod repository;
pub mod models;
pub mod auth;
pub mod theme;
pub mod user_preferences;
pub mod events;
pub mod security;

pub use error::{CoreError, Error, Result};
pub use db::Database;

pub use pty::{PtyService, PtyEvent, PtySize, SessionConfig, SessionInfo};
pub use filesystem::{
    FileSystem, FileItem, FilePermissions, DirectoryListing, FileContent,
    CreateFileRequest, CreateDirectoryRequest, MoveRequest, CopyRequest
};
pub use repository::{
    WorkspaceRepository, Workspace,
    CreateWorkspaceRequest, UpdateWorkspaceRequest,
    WorkspaceId, LayoutId, UserId
};
pub use models::{
    Settings, TerminalLayout, UserProcess, ProcessStatus, SystemMetrics, ApiResponse,
    HierarchicalLayout, PaneNode, PaneNodeType, SplitDirection, TerminalTabConfig, TerminalTabSize
};
pub use auth::{
    AuthenticatedUser, AuthToken, JwtClaims, AuthConfig,
    GitHubAuthService, JwtService, AuthRepository,
    GitHubRepository, GitHubRepositoryOwner, GitHubRepositoryService, RepositoryListOptions
};
pub use theme::{ThemePreference, ThemeRepository};
pub use user_preferences::{UserPreferences, UserPreferencesRepository};
pub use events::{
    DomainEvent, ProcessEvent, EventPublisher, InMemoryEventPublisher,
    ProcessCreatedEvent, ProcessStartedEvent, ProcessStoppedEvent,
    ProcessFailedEvent, ProcessStatusChangedEvent, ProcessOutputReceivedEvent,
    ProcessResourceLimitExceededEvent, ProcessRestartedEvent, ProcessDeletedEvent,
    create_process_created_event, create_process_started_event,
    create_process_status_changed_event, create_process_output_received_event
};
pub use security::{
    ProcessSecurityConfig, ProcessSecurityValidator, ProcessSecurityAuditEntry,
    SecurityAction, SecurityResult, RiskLevel, SecurityAuditLogger,
    InMemorySecurityAuditLogger
};