#![warn(clippy::clone_on_copy)]

pub mod auth;
pub mod db;
pub mod error;
pub mod events;
pub mod filesystem;
pub mod models;
pub mod pty;
pub mod repository;
pub mod security;
pub mod theme;
pub mod user_preferences;

pub use db::Database;
pub use error::{CoreError, Error, Result};

pub use auth::{
    AuthConfig, AuthRepository, AuthToken, AuthenticatedUser, GitHubAuthService, GitHubRepository,
    GitHubRepositoryOwner, GitHubRepositoryService, GitHubUser, JwtClaims, JwtService,
    RepositoryListOptions,
};
pub use events::{
    create_process_created_event, create_process_output_received_event,
    create_process_started_event, create_process_status_changed_event, DomainEvent, EventPublisher,
    InMemoryEventPublisher, ProcessCreatedEvent, ProcessDeletedEvent, ProcessEvent,
    ProcessFailedEvent, ProcessOutputReceivedEvent, ProcessResourceLimitExceededEvent,
    ProcessRestartedEvent, ProcessStartedEvent, ProcessStatusChangedEvent, ProcessStoppedEvent,
};
pub use filesystem::{
    CopyRequest, CreateDirectoryRequest, CreateFileRequest, DirectoryListing, FileContent,
    FileItem, FilePermissions, FileSystem, MoveRequest,
};
pub use models::{
    ApiResponse, HierarchicalLayout, PaneNode, PaneNodeType, PaginatedResponse, PaginationInfo,
    PaginationParams, ProcessStatus, Settings, SplitDirection, SystemMetrics, TerminalLayout,
    TerminalTabConfig, TerminalTabSize, UserProcess,
};
pub use pty::{PtyEvent, PtyService, PtySize, SessionConfig, SessionInfo};
pub use repository::{
    CreateWorkspaceRequest, LayoutId, UpdateWorkspaceRequest, UserId, Workspace, WorkspaceId,
    WorkspaceRepository,
};
pub use security::{
    InMemorySecurityAuditLogger, ProcessSecurityAuditEntry, ProcessSecurityConfig,
    ProcessSecurityValidator, RiskLevel, SecurityAction, SecurityAuditLogger, SecurityResult,
};
pub use theme::{ThemePreference, ThemeRepository};
pub use user_preferences::{UserPreferences, UserPreferencesRepository};
