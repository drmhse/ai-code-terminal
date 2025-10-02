#![warn(clippy::clone_on_copy)]

use std::path::PathBuf;

pub mod auth_service;
pub mod encryption_service;
pub mod git_service;
pub mod github_service;
pub mod layout_service;
pub mod microsoft_auth_service;
pub mod microsoft_auth_types;
pub mod microsoft_graph_client;
pub mod process_recovery_service;
pub mod process_service;
pub mod session_service;
pub mod system_service;
pub mod task_attachment_service;
pub mod task_context_parser;
pub mod task_execution_service;
pub mod task_priority_service;
pub mod task_sync_service;
pub mod theme_service;
pub mod todo_sync_service;
pub mod user_preferences_service;
pub mod workspace_service;

pub use workspace_service::{
    CloneRequest, GitCommit, GitService, GitStatus, WorkspaceService, WorkspaceSettings,
};
pub use system_service::{SystemServiceConfig};

pub use session_service::{
    ConnectionId, OutputEventHandler, RollingBuffer, SessionService, TerminalOutputEvent, UserId,
    UserLiveState,
};

pub use system_service::{
    BrowseDirectoryResponse, DailyReport, DirectoryEntry, HealthStatus, MetricEvent,
    MetricsRepository, MetricsSummary, PerformanceMetrics, SystemHealth, SystemMonitor,
    SystemService, TimePeriod, UserActivity,
};

pub use git_service::LocalGitService;

pub use auth_service::{AuthResult, AuthService, AuthStatus};

pub use github_service::{GitHubService, RepositoryQuery};

pub use encryption_service::{EncryptionError, EncryptionService, TokenEncryption};
pub use layout_service::LayoutService;
pub use microsoft_auth_service::{
    AuthorizationUrl, MicrosoftAuthError, MicrosoftAuthService, MicrosoftHealthStatus,
    MicrosoftOAuthConfig, MicrosoftTokenResponse,
};
pub use microsoft_auth_types::{
    MicrosoftAuthData, MicrosoftAuthRepository, MicrosoftAuthRepositoryError, WorkspaceTodoMapping,
};
pub use microsoft_graph_client::{
    ChecklistItem, CreateChecklistItemRequest, CreateListRequest, CreateTaskRequest, GraphApiError,
    GraphClient, MicrosoftGraphClient, Task, TaskBody, TaskDateTime, TaskImportance, TaskList,
    TaskStatus,
};
pub use process_recovery_service::{ProcessRecoveryConfig, ProcessRecoveryService};
pub use process_service::ProcessService;
pub use task_attachment_service::{
    AttachmentDecision, AttachmentStrategy, AttachmentUpload, TaskAttachment, TaskAttachmentService,
};
pub use task_context_parser::{ParsedTaskNote, TaskContext, TaskContextError, TaskContextParser};
pub use task_execution_service::{
    ExecutionPermissionMode, OutputBroadcaster, TaskExecution, TaskExecutionError, TaskExecutionId,
    TaskExecutionRequest, TaskExecutionResult, TaskExecutionService, TaskExecutionStatus,
};
pub use task_priority_service::{PriorityAnalysis, PriorityFlag, TaskPriorityService};
pub use task_sync_service::{
    SyncAction, TaskSync, TaskSyncConfig, TaskSyncError, TaskSyncResult, TaskSyncService,
};
pub use theme_service::ThemeService;
pub use todo_sync_service::{
    CacheStats, TodoSync, TodoSyncConfig, TodoSyncError, TodoSyncService, TodoSyncStatus,
    WorkspaceSyncStatus,
};
pub use user_preferences_service::UserPreferencesService;

use std::sync::Arc;

use act_core::{
    events::EventPublisher,
    filesystem::FileSystem,
    pty::PtyService,
    repository::{LayoutRepository, ProcessRepository, ProcessRunner, WorkspaceRepository},
    security::{ProcessSecurityValidator, SecurityAuditLogger},
    theme::ThemeRepository,
    user_preferences::UserPreferencesRepository,
    AuthRepository, GitHubAuthService, GitHubRepositoryService, JwtService,
};

pub struct DomainServices {
    pub workspace_service: WorkspaceService,
    pub session_service: SessionService,
    pub system_service: SystemService,
    pub auth_service: AuthService,
    pub github_service: GitHubService,
    pub layout_service: LayoutService,
    pub process_service: ProcessService,
    pub process_recovery_service: ProcessRecoveryService,
    pub theme_service: ThemeService,
    pub user_preferences_service: UserPreferencesService,
    pub microsoft_auth_service: MicrosoftAuthService,
    pub todo_sync_service: TodoSyncService,
    pub task_sync_service: TaskSyncService,
    pub task_execution_service: Option<TaskExecutionService>,
}

impl DomainServices {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        workspace_repository: Arc<dyn WorkspaceRepository>,
        layout_repository: Arc<dyn LayoutRepository>,
        process_repository: Arc<dyn ProcessRepository>,
        process_runner: Arc<dyn ProcessRunner>,
        theme_repository: Arc<dyn ThemeRepository>,
        user_preferences_repository: Arc<dyn UserPreferencesRepository>,
        filesystem: Arc<dyn FileSystem>,
        pty_service: Arc<dyn PtyService>,
        git_service: Arc<dyn GitService>,
        metrics_repository: Arc<dyn MetricsRepository>,
        system_monitor: Arc<dyn SystemMonitor>,
        github_auth_service: Arc<dyn GitHubAuthService>,
        jwt_service: Arc<dyn JwtService>,
        auth_repository: Arc<dyn AuthRepository>,
        github_repository_service: Arc<dyn GitHubRepositoryService>,
        event_publisher: Arc<dyn EventPublisher>,
        security_validator: Arc<ProcessSecurityValidator>,
        security_audit_logger: Arc<dyn SecurityAuditLogger>,
        process_recovery_config: ProcessRecoveryConfig,
        workspace_root: String,
        allow_access_to_parent_dirs: bool,
        // Microsoft auth service dependencies
        microsoft_auth_repository: Arc<dyn MicrosoftAuthRepository>,
        encryption_service: Arc<dyn TokenEncryption>,
        graph_client: Arc<dyn GraphClient>,
        microsoft_oauth_config: MicrosoftOAuthConfig,
    ) -> Self {
        let workspace_service = WorkspaceService::new(
            workspace_repository.clone(),
            filesystem,
            git_service,
            workspace_root.clone(),
        );

        let session_service = SessionService::new(pty_service);

        let system_service_config = SystemServiceConfig {
            workspace_root: PathBuf::from(workspace_root),
            allow_access_to_parent_dirs,
        };
        let system_service = SystemService::new(metrics_repository, system_monitor, system_service_config);

        let auth_service =
            AuthService::new(github_auth_service, jwt_service, auth_repository.clone());

        let github_service = GitHubService::new(github_repository_service, auth_repository);

        let layout_service = LayoutService::new(layout_repository);

        let process_service = ProcessService::new(
            process_repository.clone(),
            process_runner.clone(),
            event_publisher.clone(),
            security_validator,
            security_audit_logger.clone(),
        );

        let process_recovery_service = ProcessRecoveryService::new(
            process_repository,
            process_runner,
            event_publisher,
            security_audit_logger,
            process_recovery_config,
        );

        let theme_service = ThemeService::new(theme_repository);

        let user_preferences_service = UserPreferencesService::new(user_preferences_repository);

        let microsoft_auth_service = MicrosoftAuthService::new(
            microsoft_auth_repository.clone(),
            encryption_service,
            graph_client.clone(),
            microsoft_oauth_config,
        );

        let todo_sync_service = TodoSyncService::new(
            Arc::new(microsoft_auth_service.clone()),
            Arc::new(workspace_service.clone()),
            microsoft_auth_repository.clone(),
            graph_client.clone(),
            None, // Use default config
        );

        let task_sync_service = TaskSyncService::new(
            TaskSyncConfig::default(),
            Arc::new(microsoft_auth_service.clone()),
            graph_client.clone(),
            microsoft_auth_repository.clone(),
            Arc::new(workspace_service.clone()),
        );

        Self {
            workspace_service,
            session_service,
            system_service,
            auth_service,
            github_service,
            layout_service,
            process_service,
            process_recovery_service,
            theme_service,
            user_preferences_service,
            microsoft_auth_service,
            todo_sync_service,
            task_sync_service,
            task_execution_service: None, // Will be initialized with OutputBroadcaster in server
        }
    }
}
