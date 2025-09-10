# ACT Domain Services - Business Logic Layer

The `act-domain` crate contains the core business logic services for the ACT (AI Coding Terminal) system. This crate implements the application services in our hexagonal architecture, orchestrating between domain entities and infrastructure concerns.

## Architecture

This crate sits at the heart of our hexagonal architecture:
- **Business Logic**: Pure domain operations without infrastructure dependencies
- **Dependency Injection**: All external dependencies are injected as traits from `act-core`
- **Orchestration**: Coordinates between repositories, file systems, PTY services, etc.
- **Domain Events**: Manages complex workflows across multiple domain boundaries

## Services Overview

### AuthService - Authentication & Authorization

Handles user authentication workflows, token management, and GitHub OAuth integration.

```rust
use act_domain::AuthService;
use act_core::{GitHubAuthService, JwtService, AuthRepository};
use std::sync::Arc;

// Service setup with dependency injection
let auth_service = AuthService::new(
    github_service,  // Arc<dyn GitHubAuthService>
    jwt_service,     // Arc<dyn JwtService>
    auth_repository  // Arc<dyn AuthRepository>
);

// Complete OAuth flow
let auth_result = auth_service.handle_oauth_callback("oauth_code", "csrf_state").await?;
println!("User {} authenticated with JWT: {}", 
         auth_result.user.username, auth_result.jwt_token);

// Validate authentication
let is_valid = auth_service.validate_auth(&jwt_token).await?;

// Get authentication status
let status = auth_service.get_auth_status("user_id").await?;
if status.is_authenticated {
    println!("User is authenticated: {:?}", status.user_info);
}

// Logout user
auth_service.logout("user_id").await?;
```

**Key Features:**
- Complete GitHub OAuth workflow
- JWT token generation and validation
- Token refresh and expiration handling
- Multi-tenant user validation
- Session management

### WorkspaceService - Workspace Management

Manages development workspaces, Git repositories, and workspace lifecycles.

```rust
use act_domain::WorkspaceService;

// Create a new workspace
let workspace = workspace_service.create_workspace(
    "My Project".to_string(),
    Some("user/repo".to_string()),        // GitHub repo
    Some("https://github.com/user/repo.git".to_string()) // Git URL
).await?;

// Clone a repository into a workspace
let cloned_workspace = workspace_service.clone_repository(
    "https://github.com/user/repo.git",
    Some("github_token_here")
).await?;

// List all workspaces
let workspaces = workspace_service.list_workspaces(true).await?; // active_only = true

// Get workspace details
let workspace = workspace_service.get_workspace(&workspace_id).await?;

// Update workspace
let updated = workspace_service.update_workspace(
    &workspace_id,
    Some("New Name".to_string()),
    None // description
).await?;

// Delete workspace and cleanup
workspace_service.delete_workspace(&workspace_id).await?;

// Get Git status for workspace
let git_status = workspace_service.get_git_status(&workspace_id).await?;
println!("Branch: {}, Clean: {}", git_status.branch, git_status.is_clean);
```

**Key Features:**
- Workspace creation and management
- Git repository cloning with authentication
- Workspace directory management
- Git status and history tracking
- Workspace lifecycle management
- File system integration

### SessionService - Terminal Session Management

Manages terminal sessions, PTY processes, and session recovery.

```rust
use act_domain::{SessionService, CreateSessionOptions};
use act_core::SessionType;

// Create a new terminal session
let options = CreateSessionOptions {
    workspace_id: Some("workspace_123".to_string()),
    session_name: "Main Terminal".to_string(),
    session_type: SessionType::Terminal,
    terminal_size: None,
    is_recoverable: true,
    auto_cleanup: false,
    max_idle_minutes: 30,
};

let session_state = session_service.create_session(options).await?;
println!("Created session: {}", session_state.session_id);

// Get session by ID
let session = session_service.get_session(&session_id).await?;

// List sessions for a workspace
let sessions = session_service.list_sessions_by_workspace(&workspace_id).await?;

// Send input to session
session_service.send_input(&session_id, "ls -la\n").await?;

// Get session output stream
let mut output = session_service.get_output_stream(&session_id).await?;
while let Some(event) = output.recv().await {
    match event {
        PtyEvent::Output(data) => println!("Output: {}", String::from_utf8_lossy(&data)),
        PtyEvent::Closed => break,
    }
}

// Terminate session
session_service.terminate_session(&session_id).await?;
```

**Key Features:**
- Terminal session creation and management
- PTY process orchestration
- Session recovery mechanisms
- Real-time output streaming
- Session persistence and cleanup
- Multi-session support per workspace

### SystemService - System Monitoring & Metrics

Handles system metrics, performance monitoring, and resource usage tracking.

```rust
use act_domain::{SystemService, MetricEvent, TimePeriod};

// Record a user action
let event = MetricEvent {
    event_type: "terminal_command".to_string(),
    user_id: Some("user_123".to_string()),
    workspace_id: Some("workspace_456".to_string()),
    session_id: Some("session_789".to_string()),
    metadata: serde_json::json!({
        "command": "npm install",
        "duration_ms": 45000
    }),
};

system_service.record_event(event).await?;

// Get metrics summary
let summary = system_service.get_metrics_summary(TimePeriod::LastWeek).await?;
println!("Commands executed: {}", summary.total_commands);
println!("Active users: {}", summary.active_users);

// Get system health
let health = system_service.get_system_health().await?;
match health.status {
    HealthStatus::Healthy => println!("System is running smoothly"),
    HealthStatus::Warning => println!("Warning: {}", health.message.unwrap_or_default()),
    HealthStatus::Critical => println!("Critical: {}", health.message.unwrap_or_default()),
}

// Get user activity
let activity = system_service.get_user_activity("user_123", 30).await?;
println!("User has been active {} days in the last 30", activity.active_days);
```

**Key Features:**
- Event and metrics recording
- Performance monitoring
- System health checks
- User activity tracking
- Resource usage monitoring
- Analytics and reporting

## Service Composition

Domain services can be composed together for complex workflows:

```rust
use act_domain::DomainServices;

// Factory for creating all domain services together
let domain_services = DomainServices::new(
    workspace_repository,
    session_repository,
    filesystem,
    pty_service,
    git_service,
    metrics_repository,
    system_monitor,
    github_auth_service,
    jwt_service,
    auth_repository,
    workspace_root,
);

// Complex workflow: Create workspace and start development session
async fn setup_development_environment(
    services: &DomainServices,
    user_token: &str,
    repo_url: &str
) -> Result<String> {
    // 1. Validate user authentication
    let user = services.auth_service.get_current_user(user_token).await?;
    
    // 2. Clone repository into new workspace
    let workspace = services.workspace_service.clone_repository(repo_url, Some(user_token)).await?;
    
    // 3. Create terminal session for the workspace
    let session_options = CreateSessionOptions {
        workspace_id: Some(workspace.id.clone()),
        session_name: "Development Terminal".to_string(),
        session_type: SessionType::Terminal,
        terminal_size: None,
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 60,
    };
    
    let session = services.session_service.create_session(session_options).await?;
    
    // 4. Record metrics
    services.system_service.record_event(MetricEvent {
        event_type: "workspace_created".to_string(),
        user_id: Some(user.user_id),
        workspace_id: Some(workspace.id.clone()),
        session_id: Some(session.session_id.clone()),
        metadata: serde_json::json!({
            "repo_url": repo_url,
            "clone_method": "authenticated"
        }),
    }).await?;
    
    Ok(format!("Development environment ready: workspace '{}', session '{}'", 
              workspace.name, session.session_id))
}
```

## Error Handling

All services use consistent error handling patterns:

```rust
use act_core::{Result, CoreError};

match workspace_service.create_workspace("".to_string(), None, None).await {
    Ok(workspace) => println!("Created: {}", workspace.name),
    Err(CoreError::Validation(msg)) => println!("Invalid input: {}", msg),
    Err(CoreError::Database(msg)) => println!("Database error: {}", msg),
    Err(CoreError::FileSystem(msg)) => println!("File system error: {}", msg),
    Err(e) => println!("Unexpected error: {}", e),
}
```

## Testing

Domain services are designed for comprehensive testing:

```rust
// Integration tests with mock repositories
#[tokio::test]
async fn test_workspace_creation_flow() {
    let mock_repo = Arc::new(MockWorkspaceRepository::new());
    let mock_fs = Arc::new(MockFileSystem::new());
    let mock_git = Arc::new(MockGitService::new());
    
    let service = WorkspaceService::new(mock_repo, mock_fs, mock_git, "/tmp".to_string());
    
    let result = service.create_workspace("Test".to_string(), None, None).await;
    assert!(result.is_ok());
}

// Unit tests for business logic
#[tokio::test]
async fn test_workspace_name_validation() {
    let service = create_workspace_service();
    
    // Empty name should fail
    let result = service.create_workspace("".to_string(), None, None).await;
    assert!(matches!(result, Err(CoreError::Validation(_))));
    
    // Valid name should succeed
    let result = service.create_workspace("Valid Name".to_string(), None, None).await;
    assert!(result.is_ok());
}
```

## Integration with Web Layer

Domain services are injected into web controllers:

```rust
// In act-server routes
async fn create_workspace(
    State(state): State<AppState>,
    Json(request): Json<CreateWorkspaceRequest>
) -> Result<Json<ApiResponse<Workspace>>, ServerError> {
    let workspace = state.domain_services.workspace_service
        .create_workspace(
            request.name,
            request.github_repo,
            request.github_url
        )
        .await?;
    
    Ok(Json(ApiResponse::success(workspace)))
}
```

## Key Design Principles

1. **Dependency Inversion**: All dependencies injected as traits
2. **Single Responsibility**: Each service has a clear, focused purpose
3. **Composition**: Services can be composed for complex workflows
4. **Testability**: Easy to mock and test in isolation
5. **Domain Purity**: No web or infrastructure concerns in business logic
6. **Async First**: All operations are async for scalability
7. **Error Transparency**: Consistent error handling across all operations

This architecture ensures that business logic remains clean, testable, and independent of infrastructure concerns while providing a rich set of services for building complex terminal-based development workflows.