pub mod workspace_service;
pub mod session_service;
pub mod system_service;
pub mod git_service;
pub mod auth_service;
pub mod github_service;

pub use workspace_service::{
    WorkspaceService, GitService, WorkspaceSettings, GitStatus, GitCommit, CloneRequest
};

pub use session_service::{
    SessionService, SessionState, CreateSessionOptions
};

pub use system_service::{
    SystemService, MetricsRepository, SystemMonitor, MetricEvent, MetricsSummary, 
    PerformanceMetrics, TimePeriod, UserActivity, SystemHealth, HealthStatus, DailyReport
};

pub use git_service::{LocalGitService};

pub use auth_service::{AuthService, AuthResult, AuthStatus};

pub use github_service::{GitHubService, RepositoryQuery};

use std::sync::Arc;

use act_core::{
    repository::{WorkspaceRepository, SessionRepository},
    filesystem::FileSystem,
    pty::PtyService,
    GitHubAuthService, JwtService, AuthRepository, GitHubRepositoryService,
};

pub struct DomainServices {
    pub workspace_service: WorkspaceService,
    pub session_service: SessionService,
    pub system_service: SystemService,
    pub auth_service: AuthService,
    pub github_service: GitHubService,
}

impl DomainServices {
    pub fn new(
        workspace_repository: Arc<dyn WorkspaceRepository>,
        session_repository: Arc<dyn SessionRepository>,
        filesystem: Arc<dyn FileSystem>,
        pty_service: Arc<dyn PtyService>,
        git_service: Arc<dyn GitService>,
        metrics_repository: Arc<dyn MetricsRepository>,
        system_monitor: Arc<dyn SystemMonitor>,
        github_auth_service: Arc<dyn GitHubAuthService>,
        jwt_service: Arc<dyn JwtService>,
        auth_repository: Arc<dyn AuthRepository>,
        github_repository_service: Arc<dyn GitHubRepositoryService>,
        workspace_root: String,
    ) -> Self {
        let workspace_service = WorkspaceService::new(
            workspace_repository,
            filesystem,
            git_service,
            workspace_root,
        );

        let session_service = SessionService::new(
            session_repository,
            pty_service,
            Some(24), // 24 hour recovery timeout
        );

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

        Self {
            workspace_service,
            session_service,
            system_service,
            auth_service,
            github_service,
        }
    }
}