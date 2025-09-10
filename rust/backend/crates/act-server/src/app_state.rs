use std::sync::Arc;
use act_core::{
    Database,
    filesystem::FileSystem,
    pty::PtyService,
    GitHubAuthService, JwtService, GitHubRepositoryService,
    repository::{ProcessRunner},
};
use act_domain::{DomainServices, GitService, git_service::LocalGitService};
use act_persistence::{create_repositories};
use act_pty::TokioPtyService;
use act_vfs::SandboxedFileSystem;
use crate::config::Config;
use crate::metrics_placeholder::RealSystemMonitor;
use act_persistence::SqlxMetricsRepository;
use crate::services::{ServerGitHubAuthService, ServerJwtService, GitHubService, GitHubRepositoryServiceAdapter};
use act_process::TokioProcessRunner;

/// Application state with dependency injection container
#[derive(Clone)]
pub struct AppState {
    /// Database connection
    pub db: Database,
    /// Application configuration
    pub config: Config,
    /// Domain services container
    pub domain_services: Arc<DomainServices>,
    /// PTY service for terminal operations
    #[allow(dead_code)]
    pub pty_service: Arc<dyn PtyService>,
    /// File system service
    pub filesystem: Arc<dyn FileSystem>,
}

impl AppState {
    /// Create new application state with all dependencies injected
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        // Initialize database
        let database = Database::new(&config.database.url).await?;
        
        // Run migrations
        database.migrate().await?;
        
        // Get SQLx pool for persistence layer
        let pool = database.pool();
        
        // Create persistence repositories
        let repositories = create_repositories(pool.clone());
        
        // Create PTY service
        let pty_service: Arc<dyn PtyService> = Arc::new(TokioPtyService::new());
        
        // Create filesystem service
        let workspace_root = config.workspace.root_path.clone();
        let mut sandboxed_fs = SandboxedFileSystem::new(workspace_root.clone());
        
        // Initialize the filesystem (create workspace directory if needed)
        sandboxed_fs.initialize().await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
            
        let filesystem: Arc<dyn FileSystem> = Arc::new(sandboxed_fs);
        
        // Create additional services
        let git_service: Arc<dyn GitService> = Arc::new(LocalGitService::new());
        let metrics_repository: Arc<dyn act_domain::system_service::MetricsRepository> = Arc::new(SqlxMetricsRepository::new(Arc::new(pool.clone())));
        let system_monitor: Arc<dyn act_domain::system_service::SystemMonitor> = Arc::new(RealSystemMonitor::new());
        
        // Create auth services
        let github_auth_service: Arc<dyn GitHubAuthService> = Arc::new(
            ServerGitHubAuthService::new(Arc::new(config.clone()))?
        );
        let jwt_service: Arc<dyn JwtService> = Arc::new(
            ServerJwtService::new(config.auth.jwt_secret.clone())
        );
        let auth_repository = repositories.auth_repo();
        
        // Create GitHub service for repository operations
        let github_service = Arc::new(GitHubService::new(Arc::new(config.clone()))?);
        let github_repository_service: Arc<dyn GitHubRepositoryService> = Arc::new(
            GitHubRepositoryServiceAdapter::new(github_service)
        );
        
        // Create process runner
        let process_runner: Arc<dyn ProcessRunner> = Arc::new(TokioProcessRunner::new());
        
        // Create domain services
        let domain_services = Arc::new(DomainServices::new(
            repositories.workspace_repo(),
            repositories.session_repo(),
            repositories.layout_repo(),
            repositories.process_repo(),
            process_runner.clone(),
            filesystem.clone(),
            pty_service.clone(),
            git_service,
            metrics_repository,
            system_monitor,
            github_auth_service,
            jwt_service,
            auth_repository,
            github_repository_service,
            workspace_root.to_string_lossy().to_string(),
        ));
        
        Ok(Self {
            db: database,
            config,
            domain_services,
            pty_service,
            filesystem,
        })
    }
}