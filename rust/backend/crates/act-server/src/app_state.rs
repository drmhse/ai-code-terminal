use std::sync::Arc;
use tokio::sync::RwLock;
use act_core::{
    Database,
    filesystem::FileSystem,
    pty::PtyService,
    GitHubAuthService, JwtService, GitHubRepositoryService,
    repository::ProcessRunner,
    Result, CoreError,
};
use act_domain::{
    DomainServices, GitService, git_service::LocalGitService, ProcessRecoveryConfig,
    MicrosoftOAuthConfig, EncryptionService, MicrosoftGraphClient,
    TokenEncryption, GraphClient
};
use act_core::{EventPublisher, SecurityAuditLogger};
use act_core::events::InMemoryEventPublisher;
use act_core::security::{ProcessSecurityValidator, InMemorySecurityAuditLogger};
use act_persistence::{create_repositories};
use act_pty::TokioPtyService;
use act_vfs::SandboxedFileSystem;
use crate::config::Config;
use crate::metrics::RealSystemMonitor;
use act_persistence::SqlxMetricsRepository;
use crate::services::{ServerGitHubAuthService, ServerJwtService, GitHubService};
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
    pub pty_service: Arc<dyn PtyService>,
    /// File system service
    pub filesystem: Arc<dyn FileSystem>,
    /// Task execution service (initialized separately with Socket.IO)
    pub task_execution_service: Arc<RwLock<Option<act_domain::TaskExecutionService>>>,
}

impl AppState {
    /// Initialize TaskExecutionService with Socket.IO broadcaster
    pub async fn initialize_task_execution_service(
        &self,
        broadcaster: Arc<dyn act_domain::OutputBroadcaster>,
    ) {
        // Create TaskExecutionService with broadcaster
        let task_execution_service = act_domain::TaskExecutionService::new(
            Arc::new(self.domain_services.task_sync_service.clone()),
            broadcaster,
        );

        // Store in RwLock
        let mut service = self.task_execution_service.write().await;
        *service = Some(task_execution_service);
    }
}

impl AppState {
    /// Create new application state with all dependencies injected
    pub async fn new(config: Config) -> Result<Self> {
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
        sandboxed_fs.initialize().await?;
            
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
        let github_service = Arc::new(GitHubService::new(Arc::new(config.clone())).map_err(|e| CoreError::External(e.to_string()))?);
        let github_repository_service: Arc<dyn GitHubRepositoryService> = github_service.clone();
        
        // Create process runner
        let process_runner: Arc<dyn ProcessRunner> = Arc::new(TokioProcessRunner::new());
        
        // Create domain services
        let event_publisher: Arc<dyn EventPublisher> = Arc::new(InMemoryEventPublisher::new(100));
        let security_validator = Arc::new(ProcessSecurityValidator::new(act_core::security::ProcessSecurityConfig::default()).unwrap());
        let security_audit_logger: Arc<dyn SecurityAuditLogger> = Arc::new(InMemorySecurityAuditLogger::new());
        let process_recovery_config = ProcessRecoveryConfig::default();

        // Create Microsoft auth service dependencies
        let encryption_key = config.microsoft.encryption_key.clone()
            .ok_or_else(|| CoreError::Configuration("Microsoft encryption key not configured".to_string()))?;
        let encryption_service: Arc<dyn TokenEncryption> = Arc::new(
            EncryptionService::new(&encryption_key)
                .map_err(|e| CoreError::Configuration(format!("Failed to create encryption service: {}", e)))?
        );

        let graph_client: Arc<dyn GraphClient> = Arc::new(
            MicrosoftGraphClient::new()
                .map_err(|e| CoreError::Configuration(format!("Failed to create Graph client: {}", e)))?
        );

        let microsoft_oauth_config = MicrosoftOAuthConfig {
            client_id: config.microsoft.client_id.clone()
                .ok_or_else(|| CoreError::Configuration("Microsoft client ID not configured".to_string()))?,
            client_secret: config.microsoft.client_secret.clone()
                .ok_or_else(|| CoreError::Configuration("Microsoft client secret not configured".to_string()))?,
            redirect_uri: config.microsoft.redirect_uri.clone()
                .ok_or_else(|| CoreError::Configuration("Microsoft redirect URI not configured".to_string()))?,
            tenant_id: config.microsoft.tenant_id.clone(), // Optional field
        };

        let microsoft_auth_repository = repositories.microsoft_auth_repo();

        let domain_services = Arc::new(DomainServices::new(
            repositories.workspace_repo(),
            repositories.layout_repo(),
            repositories.process_repo(),
            process_runner.clone(),
            repositories.theme_repo(),
            repositories.user_preferences_repo(),
            filesystem.clone(),
            pty_service.clone(),
            git_service,
            metrics_repository,
            system_monitor,
            github_auth_service,
            jwt_service,
            auth_repository,
            github_repository_service,
            event_publisher,
            security_validator,
            security_audit_logger,
            process_recovery_config,
            workspace_root.to_string_lossy().to_string(),
            // Microsoft auth service dependencies
            microsoft_auth_repository,
            encryption_service,
            graph_client,
            microsoft_oauth_config,
        ));
        
        Ok(Self {
            db: database,
            config,
            domain_services,
            pty_service,
            filesystem,
            task_execution_service: Arc::new(RwLock::new(None)),
        })
    }
}