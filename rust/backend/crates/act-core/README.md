# ACT Core - Domain Types and Traits

The `act-core` crate contains the fundamental domain types, traits, and error handling for the ACT (AI Coding Terminal) system. This crate is the foundation of our hexagonal architecture implementation.

## Architecture

This crate defines the "hexagon" in our hexagonal architecture:
- **Domain Models**: Pure business objects without dependencies
- **Repository Traits**: Interfaces for data persistence  
- **Service Traits**: Interfaces for external services (PTY, File System, etc.)
- **Error Types**: Unified error handling across the domain

## Key Components

### Error Handling (`error.rs`)

Centralized error types for the entire domain:

```rust
use act_core::{Result, CoreError};

// All domain operations return Result<T, CoreError>
async fn my_operation() -> Result<String> {
    // Business logic here
    Ok("success".to_string())
}
```

**Available Error Types:**
- `CoreError::Database` - Database operations
- `CoreError::Auth` - Authentication failures  
- `CoreError::NotFound` - Resource not found
- `CoreError::Validation` - Input validation errors
- `CoreError::FileSystem` - File operations
- `CoreError::Pty` - Terminal operations
- And more...

### Repository Traits (`repository.rs`)

Interfaces for data persistence that adapters must implement:

```rust
use act_core::{WorkspaceRepository, CreateWorkspaceRequest};

// Implementations are provided by the persistence layer
async fn use_workspace_repo(repo: Arc<dyn WorkspaceRepository>) -> Result<()> {
    let workspace = repo.create(&CreateWorkspaceRequest {
        name: "My Workspace".to_string(),
        github_repo: Some("user/repo".to_string()),
        github_url: Some("https://github.com/user/repo".to_string()),
        local_path: None,
    }).await?;
    
    println!("Created workspace: {}", workspace.name);
    Ok(())
}
```

**Available Repositories:**
- `WorkspaceRepository` - Workspace CRUD operations
- `SessionRepository` - Terminal session management

### File System Trait (`filesystem.rs`)

Interface for file system operations with sandboxing:

```rust
use act_core::{FileSystem, CreateFileRequest};

async fn use_filesystem(fs: Arc<dyn FileSystem>) -> Result<()> {
    // List directory contents
    let listing = fs.list_directory(&PathBuf::from("/workspaces")).await?;
    
    // Create a new file
    fs.create_file(&CreateFileRequest {
        path: "/workspaces/test.txt".to_string(),
        content: "Hello, world!".to_string(),
        overwrite: false,
    }).await?;
    
    // Read file contents
    let content = fs.read_file(&PathBuf::from("/workspaces/test.txt")).await?;
    println!("File content: {}", content.content);
    
    Ok(())
}
```

### PTY Service Trait (`pty.rs`)

Interface for terminal/process operations:

```rust
use act_core::{PtyService, SessionConfig, PtySize};

async fn use_pty(pty: Arc<dyn PtyService>) -> Result<()> {
    let config = SessionConfig {
        session_id: "terminal_1".to_string(),
        command: Some("/bin/bash".to_string()),
        working_dir: Some("/workspaces".to_string()),
        environment: HashMap::new(),
        size: PtySize { cols: 80, rows: 24 },
    };
    
    let session_info = pty.create_session(&config).await?;
    println!("Created PTY session: {}", session_info.session_id);
    
    // Send input to the terminal
    pty.send_input(&session_info.session_id, b"ls -la\n").await?;
    
    // Get output stream
    let mut output = pty.get_session_output(&session_info.session_id).await?;
    
    Ok(())
}
```

### Authentication Traits (`auth.rs`)

Interfaces for authentication and authorization:

```rust
use act_core::{GitHubAuthService, JwtService, AuthRepository};

async fn use_auth_services(
    github: Arc<dyn GitHubAuthService>,
    jwt: Arc<dyn JwtService>,
    repo: Arc<dyn AuthRepository>
) -> Result<()> {
    // Get GitHub OAuth URL
    let auth_url = github.get_authorization_url("csrf_token").await?;
    
    // Exchange code for token after OAuth callback
    let auth_token = github.exchange_code_for_token("oauth_code", "csrf_token").await?;
    
    // Generate JWT for the authenticated user
    let jwt_token = jwt.generate_token(&auth_token.user)?;
    
    // Store tokens for later use
    repo.store_github_token(
        &auth_token.user.user_id,
        &auth_token.access_token,
        auth_token.refresh_token.as_deref(),
        auth_token.expires_at
    ).await?;
    
    Ok(())
}
```

### Domain Models (`models.rs`)

Pure domain objects representing business concepts:

```rust
use act_core::{Settings, TerminalLayout, SystemMetrics};

// Settings for user preferences
let settings = Settings {
    theme: "dark".to_string(),
    font_size: 14,
    shell: "/bin/zsh".to_string(),
};

// Terminal layout configuration
let layout = TerminalLayout {
    id: "layout_1".to_string(),
    name: "Development".to_string(),
    layout_type: "horizontal_split".to_string(),
    panels: vec![],
    is_default: false,
    created_at: chrono::Utc::now(),
    updated_at: chrono::Utc::now(),
};
```

## Usage in Domain Services

Domain services use these traits to implement business logic:

```rust
use act_core::*;
use std::sync::Arc;

struct MyDomainService {
    workspace_repo: Arc<dyn WorkspaceRepository>,
    filesystem: Arc<dyn FileSystem>,
    pty_service: Arc<dyn PtyService>,
}

impl MyDomainService {
    pub fn new(
        workspace_repo: Arc<dyn WorkspaceRepository>,
        filesystem: Arc<dyn FileSystem>,
        pty_service: Arc<dyn PtyService>,
    ) -> Self {
        Self {
            workspace_repo,
            filesystem,
            pty_service,
        }
    }
    
    pub async fn create_workspace_with_terminal(&self, name: String) -> Result<String> {
        // Create workspace using repository
        let workspace = self.workspace_repo.create(&CreateWorkspaceRequest {
            name: name.clone(),
            github_repo: None,
            github_url: None,
            local_path: None,
        }).await?;
        
        // Create workspace directory
        self.filesystem.create_directory(&CreateDirectoryRequest {
            path: format!("/workspaces/{}", workspace.id),
        }).await?;
        
        // Start terminal session
        let session_info = self.pty_service.create_session(&SessionConfig {
            session_id: format!("workspace_{}", workspace.id),
            command: Some("/bin/bash".to_string()),
            working_dir: Some(format!("/workspaces/{}", workspace.id)),
            environment: HashMap::new(),
            size: PtySize { cols: 80, rows: 24 },
        }).await?;
        
        Ok(format!("Created workspace '{}' with terminal session '{}'", 
                  workspace.name, session_info.session_id))
    }
}
```

## Design Principles

1. **Dependency Inversion**: All concrete dependencies are injected as traits
2. **No Framework Dependencies**: Core domain logic has no external framework dependencies
3. **Unified Error Handling**: All operations use the same `Result<T, CoreError>` pattern
4. **Async First**: All I/O operations are async by design
5. **Type Safety**: Strong typing prevents invalid states at compile time

## Testing

All traits can be easily mocked for testing:

```rust
use async_trait::async_trait;

struct MockWorkspaceRepository;

#[async_trait]
impl WorkspaceRepository for MockWorkspaceRepository {
    async fn create(&self, request: &CreateWorkspaceRequest) -> Result<Workspace> {
        // Mock implementation
        Ok(Workspace { /* mock data */ })
    }
    
    // ... other methods
}

#[tokio::test]
async fn test_my_domain_service() {
    let mock_repo = Arc::new(MockWorkspaceRepository);
    let service = MyDomainService::new(mock_repo, /* other mocks */);
    
    let result = service.create_workspace_with_terminal("test".to_string()).await;
    assert!(result.is_ok());
}
```

## Integration with Adapters

Concrete implementations are provided by adapter crates:

```rust
// In act-server (web adapter)
use act_core::*;
use act_persistence::SqlxWorkspaceRepository;
use act_vfs::SandboxedFileSystem;
use act_pty::TokioPtyService;

let workspace_repo: Arc<dyn WorkspaceRepository> = Arc::new(SqlxWorkspaceRepository::new(pool));
let filesystem: Arc<dyn FileSystem> = Arc::new(SandboxedFileSystem::new("/workspaces"));
let pty_service: Arc<dyn PtyService> = Arc::new(TokioPtyService::new());

let domain_service = MyDomainService::new(workspace_repo, filesystem, pty_service);
```

This design ensures that domain logic is completely isolated from implementation details and can be easily tested, reused, and evolved independently.