---
title: "Rust Architecture Deep Dive"
description: "Detailed architectural overview of the Rust backend implementation"
weight: 74
layout: "docs"
---

# Rust Architecture Deep Dive

Explore the comprehensive architectural design of the Rust backend, including component relationships, data flow, and design patterns that enable high performance and reliability.

## System Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Rust Backend                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   HTTP Server   │  │  WebSocket      │  │   Session       │ │
│  │   (Axum)        │  │  (Socketioxide) │  │   Manager       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                    │                    │        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Router        │  │  Event Handler  │  │   State Store   │ │
│  │   & Middleware  │  │  & Dispatcher   │  │   & Recovery    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                    │                    │        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Services      │  │   PTY Service   │  │   Database      │ │
│  │   (Auth, etc.)  │  │   (Terminal)    │  │   (SQLite)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Application State
```rust
#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: Config,
    pub pty_service: Arc<Mutex<PtyService>>,
    pub session_manager: Arc<SessionManager>,
}
```

#### 2. Service Layer
```rust
pub struct ServiceLayer {
    pub auth_service: AuthService,
    pub workspace_service: WorkspaceService,
    pub terminal_service: TerminalService,
    pub metrics_service: MetricsService,
}
```

#### 3. Data Layer
```rust
pub struct DataLayer {
    pub database: Database,
    pub session_store: SessionStore,
    pub workspace_store: WorkspaceStore,
    pub metrics_store: MetricsStore,
}
```

## Component Architecture

### HTTP Server Layer

#### Axum Router Configuration
```rust
pub fn create_router() -> Router<AppState> {
    Router::new()
        // Health and status endpoints
        .route("/health", get(health_check))
        .route("/api/v1/status", get(get_status))
        .route("/api/v1/metrics", get(get_metrics))
        
        // Authentication endpoints
        .route("/auth/github", get(github_auth))
        .route("/auth/callback", get(github_callback))
        .route("/auth/logout", post(logout))
        
        // Workspace management
        .route("/api/v1/workspaces", get(list_workspaces))
        .route("/api/v1/workspaces", post(create_workspace))
        .route("/api/v1/workspaces/:id", get(get_workspace))
        .route("/api/v1/workspaces/:id", delete(delete_workspace))
        
        // Session management
        .route("/api/v1/sessions", get(list_sessions))
        .route("/api/v1/sessions", post(create_session))
        .route("/api/v1/sessions/:id", get(get_session))
        .route("/api/v1/sessions/:id", delete(delete_session))
        
        // File operations
        .route("/api/v1/files/*path", get(list_files))
        .route("/api/v1/files/*path", post(upload_file))
        .route("/api/v1/files/*path", delete(delete_file))
}
```

#### Middleware Stack
```rust
pub fn middleware_stack() -> MiddlewareStack {
    MiddlewareStack::new()
        .layer(CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any))
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::new(Duration::from_secs(30)))
        .layer(LimitLayer::new(100)) // Rate limiting
}
```

### WebSocket Layer

#### Socketioxide Integration
```rust
pub fn setup_socket_handlers(io: SocketIo, state: AppState) {
    io.ns("/", move |socket: SocketRef| {
        let state = state.clone();
        
        // Authentication
        socket.on("authenticate", authenticate_handler);
        
        // Terminal operations
        socket.on("terminal:create", terminal_create_handler);
        socket.on("terminal:data", terminal_data_handler);
        socket.on("terminal:resize", terminal_resize_handler);
        socket.on("terminal:destroy", terminal_destroy_handler);
        
        // Session management
        socket.on("session:list", session_list_handler);
        socket.on("session:recover", session_recover_handler);
        
        // File operations
        socket.on("file:read", file_read_handler);
        socket.on("file:write", file_write_handler);
        socket.on("file:list", file_list_handler);
        
        // Disconnect handling
        socket.on_disconnect(disconnect_handler);
    });
}
```

#### Event Handling Architecture
```rust
pub struct EventHandler {
    pub auth_handler: AuthHandler,
    pub terminal_handler: TerminalHandler,
    pub session_handler: SessionHandler,
    pub file_handler: FileHandler,
}

impl EventHandler {
    pub async fn handle_event(&self, event: SocketEvent) -> Result<SocketResponse> {
        match event {
            SocketEvent::Authenticate(req) => self.auth_handler.handle(req).await,
            SocketEvent::TerminalCreate(req) => self.terminal_handler.create(req).await,
            SocketEvent::TerminalData(req) => self.terminal_handler.data(req).await,
            SocketEvent::TerminalResize(req) => self.terminal_handler.resize(req).await,
            SocketEvent::TerminalDestroy(req) => self.terminal_handler.destroy(req).await,
            SocketEvent::SessionList(req) => self.session_handler.list(req).await,
            SocketEvent::SessionRecover(req) => self.session_handler.recover(req).await,
            SocketEvent::FileRead(req) => self.file_handler.read(req).await,
            SocketEvent::FileWrite(req) => self.file_handler.write(req).await,
            SocketEvent::FileList(req) => self.file_handler.list(req).await,
        }
    }
}
```

### Service Layer Architecture

#### Authentication Service
```rust
pub struct AuthService {
    pub jwt_service: JwtService,
    pub github_oauth: GitHubOAuth,
    pub session_store: SessionStore,
}

impl AuthService {
    pub async fn authenticate(&self, token: &str) -> Result<AuthResult> {
        // Validate JWT token
        let claims = self.jwt_service.validate_token(token)?;
        
        // Check session validity
        let session = self.session_store.get_session(&claims.sub).await?;
        
        // Verify user authorization
        self.verify_user_authorization(&claims.github_username).await?;
        
        Ok(AuthResult {
            user_id: claims.sub,
            username: claims.github_username,
            session_id: session.id,
        })
    }
    
    pub async fn create_session(&self, user_id: &str) -> Result<Session> {
        let session = Session {
            id: Uuid::new_v4().to_string(),
            user_id: user_id.to_string(),
            created_at: Utc::now(),
            expires_at: Utc::now() + Duration::hours(24),
        };
        
        self.session_store.create_session(&session).await?;
        Ok(session)
    }
}
```

#### Terminal Service
```rust
pub struct TerminalService {
    pub pty_service: Arc<Mutex<PtyService>>,
    pub session_manager: Arc<SessionManager>,
    pub workspace_service: WorkspaceService,
}

impl TerminalService {
    pub async fn create_terminal(&self, request: CreateTerminalRequest) -> Result<TerminalSession> {
        // Validate workspace
        let workspace = self.workspace_service.get_workspace(&request.workspace_id).await?;
        
        // Create PTY session
        let pty_service = self.pty_service.lock().await;
        let output_rx = pty_service.create_session(
            request.session_id.clone(),
            request.workspace_id.clone(),
            request.cols.unwrap_or(80),
            request.rows.unwrap_or(24),
        )?;
        
        // Create session state
        let session_state = SessionState {
            session_id: request.session_id.clone(),
            workspace_id: request.workspace_id.clone(),
            current_working_dir: workspace.local_path,
            terminal_size: Some(TerminalSize {
                cols: request.cols.unwrap_or(80),
                rows: request.rows.unwrap_or(24),
            }),
            recovery_token: Uuid::new_v4().to_string(),
            created_at: Utc::now(),
            last_activity: Utc::now(),
        };
        
        // Store session state
        self.session_manager.create_session(session_state).await?;
        
        Ok(TerminalSession {
            session_id: request.session_id,
            workspace_id: request.workspace_id,
            output_rx,
        })
    }
}
```

#### Workspace Service
```rust
pub struct WorkspaceService {
    pub db: Database,
    pub git_service: GitService,
    pub file_service: FileService,
}

impl WorkspaceService {
    pub async fn create_workspace(&self, request: CreateWorkspaceRequest) -> Result<Workspace> {
        // Clone repository
        let repo_path = self.git_service.clone_repository(
            &request.github_url,
            &request.name,
        ).await?;
        
        // Create workspace record
        let workspace = Workspace {
            id: Uuid::new_v4().to_string(),
            name: request.name,
            github_repo: request.github_url,
            github_url: request.github_url.clone(),
            local_path: repo_path,
            is_active: true,
            last_sync_at: Utc::now(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        // Store in database
        sqlx::query!(
            "INSERT INTO workspaces (id, name, github_repo, github_url, local_path, is_active, last_sync_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            workspace.id,
            workspace.name,
            workspace.github_repo,
            workspace.github_url,
            workspace.local_path,
            workspace.is_active,
            workspace.last_sync_at,
            workspace.created_at,
            workspace.updated_at,
        )
        .execute(self.db.pool())
        .await?;
        
        Ok(workspace)
    }
}
```

### Data Layer Architecture

#### Database Service
```rust
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(3))
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(database_url.strip_prefix("sqlite:").unwrap_or(database_url))
                    .create_if_missing(true)
                    .journal_mode(SqliteJournalMode::Wal)
                    .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
            ).await?;
        
        Ok(Self { pool })
    }
    
    pub async fn migrate(&self) -> Result<()> {
        sqlx::migrate!("../migrations").run(&self.pool).await?;
        Ok(())
    }
    
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}
```

#### Session Store
```rust
pub struct SessionStore {
    db: Database,
}

impl SessionStore {
    pub async fn create_session(&self, session: &Session) -> Result<()> {
        sqlx::query!(
            "INSERT INTO sessions (id, user_id, socket_id, status, last_activity_at, created_at, session_name, session_type, is_default_session, current_working_dir, environment_vars, shell_history, terminal_size, recovery_token, can_recover, max_idle_time, auto_cleanup, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            session.id,
            session.user_id,
            session.socket_id,
            session.status,
            session.last_activity_at,
            session.created_at,
            session.session_name,
            session.session_type,
            session.is_default_session,
            session.current_working_dir,
            session.environment_vars,
            session.shell_history,
            session.terminal_size,
            session.recovery_token,
            session.can_recover,
            session.max_idle_time,
            session.auto_cleanup,
            session.workspace_id,
        )
        .execute(self.db.pool())
        .await?;
        
        Ok(())
    }
    
    pub async fn get_session(&self, session_id: &str) -> Result<Session> {
        let session = sqlx::query_as!(
            Session,
            "SELECT * FROM sessions WHERE id = ?",
            session_id
        )
        .fetch_one(self.db.pool())
        .await?;
        
        Ok(session)
    }
    
    pub async fn update_session_activity(&self, session_id: &str) -> Result<()> {
        sqlx::query!(
            "UPDATE sessions SET last_activity_at = ? WHERE id = ?",
            Utc::now(),
            session_id
        )
        .execute(self.db.pool())
        .await?;
        
        Ok(())
    }
}
```

### PTY Service Architecture

#### PTY Management
```rust
pub struct PtyService {
    sessions: Arc<Mutex<HashMap<SessionId, Arc<Mutex<PtySession>>>>>>,
}

pub struct PtySession {
    pub session_id: SessionId,
    pub workspace_id: WorkspaceId,
    pub child: Box<dyn Child + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub tx: mpsc::UnboundedSender<String>,
    pub rx: Option<mpsc::UnboundedReceiver<String>>,
}

impl PtyService {
    pub fn create_session(
        &self,
        session_id: SessionId,
        workspace_id: WorkspaceId,
        cols: u16,
        rows: u16,
    ) -> Result<mpsc::UnboundedReceiver<String>> {
        let pty_size = PtySize {
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
        };
        
        // Create PTY pair
        let pty_system = portable_pty::native_pty_system();
        let pty_pair = pty_system.openpty(pty_size)?;
        
        // Determine shell and working directory
        let shell = if cfg!(windows) {
            "powershell.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        };
        
        let workspace_path = format!("./workspaces/{}", workspace_id.replace('/', "_"));
        
        // Build command
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&workspace_path);
        
        // Split the pty pair
        let (master, slave) = (pty_pair.master, pty_pair.slave);
        
        // Spawn process
        let child = slave.spawn_command(cmd)?;
        
        // Create channels for communication
        let (output_tx, output_rx) = mpsc::unbounded_channel::<String>();
        let (input_tx, input_rx) = mpsc::unbounded_channel::<String>();
        
        // Spawn reader thread
        let mut reader = master.try_clone_reader()?;
        let read_output_tx = output_tx.clone();
        let read_session_id = session_id.clone();
        
        thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            loop {
                match reader.read(&mut buffer) {
                    Ok(n) if n > 0 => {
                        let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                        if let Err(err) = read_output_tx.send(output) {
                            error!("Failed to send PTY output: {}", err);
                            break;
                        }
                    }
                    Ok(_) => {
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(err) => {
                        error!("PTY read error: {}", err);
                        break;
                    }
                }
            }
        });
        
        // Spawn writer thread
        let mut writer = master.take_writer()?;
        let write_session_id = session_id.clone();
        
        thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                while let Some(input) = input_rx.recv().await {
                    if let Err(err) = writer.write_all(input.as_bytes()) {
                        error!("Failed to write to PTY: {}", err);
                        break;
                    }
                }
            });
        });
        
        // Create and store session
        let pty_session = PtySession {
            session_id: session_id.clone(),
            workspace_id,
            child,
            master,
            tx: input_tx,
            rx: None,
        };
        
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), Arc::new(Mutex::new(pty_session)));
        
        Ok(output_rx)
    }
}
```

## Data Flow Architecture

### Request Flow
```
Client Request → HTTP Server → Router → Middleware → Handler → Service → Database → Response
                ↓
WebSocket → Socketioxide → Event Handler → Service → PTY → Client
```

### Session Lifecycle
```
1. Client connects → WebSocket handshake
2. Authentication → JWT validation
3. Terminal creation → PTY session spawn
4. Command execution → PTY input/output
5. Session management → State persistence
6. Disconnect → Cleanup and recovery
```

### Data Persistence Flow
```
Session Events → Session Manager → Database → SQLite
     ↓
Recovery Tokens → Session Store → Recovery Handler → Client
```

## Error Handling Architecture

### Error Types
```rust
#[derive(Error, Debug)]
pub enum Error {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("Terminal error: {0}")]
    Terminal(String),
    
    #[error("Workspace error: {0}")]
    Workspace(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Internal server error: {0}")]
    Internal(String),
}
```

### Error Handling Strategy
```rust
pub async fn handle_error(error: Error) -> Response {
    match error {
        Error::Auth(msg) => (StatusCode::UNAUTHORIZED, Json(json!({
            "error": "Authentication failed",
            "message": msg
        }))).into_response(),
        
        Error::Terminal(msg) => (StatusCode::BAD_REQUEST, Json(json!({
            "error": "Terminal operation failed",
            "message": msg
        }))).into_response(),
        
        Error::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "Database operation failed",
            "message": "Please try again later"
        }))).into_response(),
        
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "Internal server error",
            "message": "An unexpected error occurred"
        }))).into_response(),
    }
}
```

## Configuration Architecture

### Configuration Structure
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub auth: AuthConfig,
    pub cors: CorsConfig,
    pub terminal: TerminalConfig,
    pub monitoring: MonitoringConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub static_files: Option<PathBuf>,
    pub worker_threads: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout: u64,
    pub idle_timeout: u64,
}
```

### Configuration Loading
```rust
impl Config {
    pub fn load() -> Result<Self> {
        // Load environment variables
        dotenvy::dotenv().ok();
        
        let mut config = Config::default();
        
        // Override with environment variables
        if let Ok(host) = env::var("ACT_SERVER_HOST") {
            config.server.host = host;
        }
        
        if let Ok(port) = env::var("ACT_SERVER_PORT") {
            config.server.port = port.parse()?;
        }
        
        // Validate configuration
        config.validate()?;
        
        Ok(config)
    }
    
    pub fn validate(&self) -> Result<()> {
        // Validate server configuration
        if self.server.port == 0 {
            return Err("Server port must be greater than 0".into());
        }
        
        // Validate database configuration
        if self.database.url.is_empty() {
            return Err("Database URL cannot be empty".into());
        }
        
        // Validate authentication configuration
        if self.auth.jwt_secret.len() < 32 {
            return Err("JWT secret must be at least 32 characters".into());
        }
        
        Ok(())
    }
}
```

This comprehensive architecture provides a solid foundation for the high-performance Rust backend, enabling scalability, maintainability, and optimal performance for production deployments.