pub mod workspace_service;
pub mod session_service;
pub mod system_service;
pub mod git_service;
pub mod auth_service;
pub mod github_service;
pub mod layout_service;
pub mod process_service;
pub mod process_recovery_service;
pub mod theme_service;
pub mod user_preferences_service;
pub mod encryption_service;
pub mod microsoft_graph_client;
pub mod microsoft_auth_service;
pub mod microsoft_auth_types;
pub mod todo_sync_service;
pub mod task_context_parser;
pub mod task_attachment_service;
pub mod task_priority_service;
pub mod task_sync_service;

pub use workspace_service::{
    WorkspaceService, GitService, WorkspaceSettings, GitStatus, GitCommit, CloneRequest
};

pub use session_service::{
    SessionService, RollingBuffer, UserLiveState, TerminalOutputEvent, OutputEventHandler, UserId, ConnectionId
};

pub use system_service::{
    SystemService, MetricsRepository, SystemMonitor, MetricEvent, MetricsSummary, 
    PerformanceMetrics, TimePeriod, UserActivity, SystemHealth, HealthStatus, DailyReport
};

pub use git_service::{LocalGitService};

pub use auth_service::{AuthService, AuthResult, AuthStatus};

pub use github_service::{GitHubService, RepositoryQuery};

pub use layout_service::{LayoutService};
pub use process_service::{ProcessService};
pub use process_recovery_service::{ProcessRecoveryService, ProcessRecoveryConfig};
pub use theme_service::{ThemeService};
pub use user_preferences_service::{UserPreferencesService};
pub use encryption_service::{EncryptionService, TokenEncryption, EncryptionError};
pub use microsoft_graph_client::{
    MicrosoftGraphClient, GraphClient, GraphApiError, TaskList, Task, TaskBody,
    TaskStatus, TaskImportance, TaskDateTime, ChecklistItem, CreateTaskRequest,
    CreateListRequest, CreateChecklistItemRequest
};
pub use microsoft_auth_service::{
    MicrosoftAuthService, MicrosoftAuthError, MicrosoftOAuthConfig, AuthorizationUrl, MicrosoftTokenResponse, MicrosoftHealthStatus
};
pub use microsoft_auth_types::{
    MicrosoftAuthRepository, MicrosoftAuthData, WorkspaceTodoMapping, MicrosoftAuthRepositoryError
};
pub use todo_sync_service::{
    TodoSyncService, TodoSyncError, TodoSyncConfig, TodoSync, TodoSyncStatus, WorkspaceSyncStatus, CacheStats
};
pub use task_context_parser::{
    TaskContextParser, TaskContext, ParsedTaskNote, TaskContextError
};
pub use task_attachment_service::{
    TaskAttachmentService, TaskAttachment, AttachmentUpload, AttachmentStrategy, AttachmentDecision
};
pub use task_priority_service::{
    TaskPriorityService, PriorityAnalysis, PriorityFlag
};
pub use task_sync_service::{
    TaskSyncService, TaskSync, TaskSyncError, TaskSyncConfig, TaskSyncResult, SyncAction
};

use std::sync::Arc;

use act_core::{
    repository::{WorkspaceRepository, LayoutRepository, ProcessRepository, ProcessRunner},
    theme::ThemeRepository,
    user_preferences::UserPreferencesRepository,
    filesystem::FileSystem,
    pty::PtyService,
    events::EventPublisher,
    security::{ProcessSecurityValidator, SecurityAuditLogger},
    GitHubAuthService, JwtService, AuthRepository, GitHubRepositoryService,
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
        // Microsoft auth service dependencies
        microsoft_auth_repository: Arc<dyn MicrosoftAuthRepository>,
        encryption_service: Arc<dyn TokenEncryption>,
        graph_client: Arc<dyn GraphClient>,
        microsoft_oauth_config: MicrosoftOAuthConfig,
    ) -> Self {
        let workspace_service = WorkspaceService::new(
            workspace_repository,
            filesystem,
            git_service,
            workspace_root,
        );

        let session_service = SessionService::new(pty_service);

        let system_service = SystemService::new(
            metrics_repository,
            system_monitor,
        );

        let auth_service = AuthService::new(
            github_auth_service,
            jwt_service,
            auth_repository.clone(),
        );

        let github_service = GitHubService::new(
            github_repository_service,
            auth_repository,
        );

        let layout_service = LayoutService::new(
            layout_repository,
        );

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

        let theme_service = ThemeService::new(
            theme_repository,
        );

        let user_preferences_service = UserPreferencesService::new(
            user_preferences_repository,
        );

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
        }
    }
}