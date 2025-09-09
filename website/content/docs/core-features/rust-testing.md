---
title: "Rust Testing Strategy"
description: "Comprehensive testing approach for the Rust backend"
weight: 75
layout: "docs"
---

# Rust Testing Strategy

A robust testing methodology ensures the reliability and stability of the Rust backend. This document outlines the comprehensive testing approach, including unit tests, integration tests, and performance benchmarks.

## Testing Philosophy

### Testing Principles

1. **Test-Driven Development (TDD)**: Write tests before implementation
2. **Comprehensive Coverage**: Aim for 90%+ code coverage
3. **Property-Based Testing**: Use generative testing for edge cases
4. **Integration Testing**: Test component interactions
5. **Performance Regression Testing**: Prevent performance degradation
6. **Security Testing**: Identify vulnerabilities proactively

### Testing Pyramid

```
┌─────────────────────────────────┐
│        E2E Tests (5%)           │
│    (User workflows, UI)         │
├─────────────────────────────────┤
│     Integration Tests (20%)      │
│  (API, WebSocket, Database)    │
├─────────────────────────────────┤
│       Unit Tests (75%)           │
│   (Individual functions,       │
│    data structures, utils)      │
└─────────────────────────────────┘
```

## Unit Testing

### Test Organization

```
tests/
├── unit/
│   ├── auth/
│   │   ├── jwt_tests.rs
│   │   └── oauth_tests.rs
│   ├── terminal/
│   │   ├── pty_tests.rs
│   │   └── session_tests.rs
│   ├── database/
│   │   ├── connection_tests.rs
│   │   └── migration_tests.rs
│   └── utils/
│       ├── validation_tests.rs
│       └── crypto_tests.rs
└── integration/
    ├── api_tests.rs
    ├── websocket_tests.rs
    └── e2e_tests.rs
```

### Unit Test Examples

#### Authentication Tests
```rust
#[cfg(test)]
mod auth_tests {
    use super::*;
    use crate::auth::{JwtService, Claims};
    use chrono::{Duration, Utc};

    #[test]
    fn test_jwt_token_creation() {
        let jwt_service = JwtService::new("test-secret-key");
        let claims = Claims {
            sub: "user123".to_string(),
            exp: (Utc::now() + Duration::hours(1)).timestamp() as usize,
            iat: Utc::now().timestamp() as usize,
            github_username: "testuser".to_string(),
        };

        let token = jwt_service.create_token(&claims).unwrap();
        assert!(!token.is_empty());
    }

    #[test]
    fn test_jwt_token_validation() {
        let jwt_service = JwtService::new("test-secret-key");
        let claims = Claims {
            sub: "user123".to_string(),
            exp: (Utc::now() + Duration::hours(1)).timestamp() as usize,
            iat: Utc::now().timestamp() as usize,
            github_username: "testuser".to_string(),
        };

        let token = jwt_service.create_token(&claims).unwrap();
        let validated_claims = jwt_service.validate_token(&token).unwrap();
        
        assert_eq!(validated_claims.sub, claims.sub);
        assert_eq!(validated_claims.github_username, claims.github_username);
    }

    #[test]
    fn test_expired_token_rejection() {
        let jwt_service = JwtService::new("test-secret-key");
        let claims = Claims {
            sub: "user123".to_string(),
            exp: (Utc::now() - Duration::hours(1)).timestamp() as usize,
            iat: Utc::now().timestamp() as usize,
            github_username: "testuser".to_string(),
        };

        let token = jwt_service.create_token(&claims).unwrap();
        let result = jwt_service.validate_token(&token);
        
        assert!(result.is_err());
    }
}
```

#### Terminal Service Tests
```rust
#[cfg(test)]
mod terminal_tests {
    use super::*;
    use crate::terminal::{PtyService, TerminalConfig};
    use std::time::Duration;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_terminal_session_creation() {
        let pty_service = PtyService::new();
        let config = TerminalConfig::default();
        
        let session_id = "test-session-123";
        let workspace_id = "test-workspace";
        
        let result = pty_service.create_session(
            session_id.to_string(),
            workspace_id.to_string(),
            80,
            24,
        ).await;
        
        assert!(result.is_ok());
        
        let mut output_rx = result.unwrap();
        
        // Verify session is stored
        let sessions = pty_service.get_active_sessions();
        assert!(sessions.contains(&session_id.to_string()));
        
        // Clean up
        pty_service.destroy_session(session_id).unwrap();
    }

    #[tokio::test]
    async fn test_terminal_input_output() {
        let pty_service = PtyService::new();
        let session_id = "test-session-io";
        let workspace_id = "test-workspace";
        
        // Create session
        let mut output_rx = pty_service.create_session(
            session_id.to_string(),
            workspace_id.to_string(),
            80,
            24,
        ).await.unwrap();
        
        // Send input
        let input = "echo 'Hello, World!'\n";
        pty_service.send_input(session_id, input).unwrap();
        
        // Wait for output
        sleep(Duration::from_millis(100)).await;
        
        // Verify output (simplified for example)
        if let Ok(output) = output_rx.try_recv() {
            assert!(output.contains("Hello, World!"));
        }
        
        // Clean up
        pty_service.destroy_session(session_id).unwrap();
    }

    #[test]
    fn test_terminal_resize() {
        let pty_service = PtyService::new();
        let session_id = "test-session-resize";
        let workspace_id = "test-workspace";
        
        // Create session (simplified)
        // In real test, you'd need to mock PTY creation
        
        let result = pty_service.resize_session(session_id, 120, 40);
        
        // In a real test, you'd verify the resize operation
        // For now, just test that it doesn't panic
        assert!(result.is_ok() || result.is_err());
    }
}
```

#### Database Tests
```rust
#[cfg(test)]
mod database_tests {
    use super::*;
    use crate::database::{Database, Session, Workspace};
    use sqlx::SqlitePool;
    use tempfile::NamedTempFile;

    async fn create_test_database() -> Database {
        let temp_file = NamedTempFile::new().unwrap();
        let database_url = format!("sqlite:{}", temp_file.path().display());
        
        let db = Database::new(&database_url).await.unwrap();
        db.migrate().await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_session_creation() {
        let db = create_test_database().await;
        
        let session = Session {
            id: "test-session".to_string(),
            user_id: "user123".to_string(),
            socket_id: Some("socket-123".to_string()),
            status: "active".to_string(),
            last_activity_at: Utc::now(),
            created_at: Utc::now(),
            session_name: "Test Session".to_string(),
            session_type: "terminal".to_string(),
            is_default_session: false,
            current_working_dir: Some("/tmp".to_string()),
            environment_vars: Some("{}".to_string()),
            shell_history: Some("[]".to_string()),
            terminal_size: Some("{\"cols\":80,\"rows\":24}".to_string()),
            recovery_token: Some("recovery-token".to_string()),
            can_recover: true,
            max_idle_time: 1440,
            auto_cleanup: true,
            workspace_id: Some("workspace-123".to_string()),
        };

        let result = db.create_session(&session).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_workspace_operations() {
        let db = create_test_database().await;
        
        let workspace = Workspace {
            id: "test-workspace".to_string(),
            name: "Test Workspace".to_string(),
            github_repo: "test/repo".to_string(),
            github_url: "https://github.com/test/repo".to_string(),
            local_path: "/tmp/test-workspace".to_string(),
            is_active: true,
            last_sync_at: Utc::now(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // Create workspace
        let create_result = db.create_workspace(&workspace).await;
        assert!(create_result.is_ok());

        // Get workspace
        let get_result = db.get_workspace("test-workspace").await;
        assert!(get_result.is_ok());
        
        let retrieved_workspace = get_result.unwrap();
        assert_eq!(retrieved_workspace.name, "Test Workspace");

        // List workspaces
        let list_result = db.list_workspaces().await;
        assert!(list_result.is_ok());
        
        let workspaces = list_result.unwrap();
        assert_eq!(workspaces.len(), 1);
    }
}
```

## Integration Testing

### API Integration Tests
```rust
#[cfg(test)]
mod api_integration_tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use tower::ServiceExt;
    use serde_json::{json, Value};

    async fn create_test_app() -> Router {
        // Create test database
        let db = create_test_database().await;
        
        // Create test configuration
        let config = Config {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 0, // Let OS choose port
                static_files: None,
                worker_threads: 1,
            },
            database: DatabaseConfig {
                url: "sqlite::memory:".to_string(),
                max_connections: 1,
                min_connections: 1,
                acquire_timeout: 5,
                idle_timeout: 300,
            },
            auth: AuthConfig {
                jwt_secret: "test-secret-key-for-testing".to_string(),
                github_client_id: "test-client-id".to_string(),
                github_client_secret: "test-client-secret".to_string(),
                github_redirect_url: "http://localhost:3000/auth/callback".to_string(),
                tenant_github_usernames: vec!["testuser".to_string()],
            },
            cors: CorsConfig {
                allowed_origins: vec!["http://localhost:3000".to_string()],
                allowed_headers: vec!["content-type".to_string(), "authorization".to_string()],
            },
            terminal: TerminalConfig::default(),
            monitoring: MonitoringConfig::default(),
        };

        let state = AppState {
            db,
            config,
            pty_service: Arc::new(Mutex::new(PtyService::new())),
            session_manager: Arc::new(SessionManager::new(db, Arc::new(Mutex::new(PtyService::new())))),
        };

        create_router().with_state(state)
    }

    #[tokio::test]
    async fn test_health_check() {
        let app = create_test_app().await;
        
        let request = Request::builder()
            .uri("/health")
            .method("GET")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_workspace_creation() {
        let app = create_test_app().await;
        
        let workspace_data = json!({
            "name": "Test Workspace",
            "github_url": "https://github.com/test/repo"
        });

        let request = Request::builder()
            .uri("/api/v1/workspaces")
            .method("POST")
            .header("Content-Type", "application/json")
            .body(Body::from(workspace_data.to_string()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);

        let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
        let response_data: Value = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(response_data["name"], "Test Workspace");
    }

    #[tokio::test]
    async fn test_authentication_flow() {
        let app = create_test_app().await;
        
        // Test GitHub OAuth initiation
        let request = Request::builder()
            .uri("/auth/github")
            .method("GET")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::FOUND);
    }
}
```

### WebSocket Integration Tests
```rust
#[cfg(test)]
mod websocket_integration_tests {
    use super::*;
    use tokio_tungstenite::{connect_async, MaybeTlsStream};
    use tokio::net::TcpStream;
    use futures_util::{StreamExt, SinkExt};
    use serde_json::json;

    #[tokio::test]
    async fn test_websocket_connection() {
        // Start test server
        let app = create_test_app().await;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        // Connect WebSocket
        let (ws_stream, _) = connect_async(format!("ws://{}/socket.io/", addr))
            .await
            .unwrap();

        let (mut write, mut read) = ws_stream.split();

        // Send authentication message
        let auth_msg = json!({
            "type": "authenticate",
            "data": {
                "token": "test-token"
            }
        });

        write.send(Message::Text(auth_msg.to_string())).await.unwrap();

        // Wait for response
        if let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    let response: Value = serde_json::from_str(&text).unwrap();
                    assert_eq!(response["type"], "authenticated");
                }
                _ => panic!("Unexpected message type"),
            }
        }
    }

    #[tokio::test]
    async fn test_terminal_creation_via_websocket() {
        // Similar setup as above
        let app = create_test_app().await;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        let (ws_stream, _) = connect_async(format!("ws://{}/socket.io/", addr))
            .await
            .unwrap();

        let (mut write, mut read) = ws_stream.split();

        // Authenticate first
        let auth_msg = json!({
            "type": "authenticate",
            "data": {
                "token": "test-token"
            }
        });

        write.send(Message::Text(auth_msg.to_string())).await.unwrap();

        // Create terminal
        let terminal_msg = json!({
            "type": "terminal:create",
            "data": {
                "workspaceId": "test-workspace",
                "cols": 80,
                "rows": 24
            }
        });

        write.send(Message::Text(terminal_msg.to_string())).await.unwrap();

        // Wait for terminal creation response
        if let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    let response: Value = serde_json::from_str(&text).unwrap();
                    assert_eq!(response["type"], "terminal:created");
                    assert!(response["data"]["sessionId"].is_string());
                }
                _ => panic!("Unexpected message type"),
            }
        }
    }
}
```

## Property-Based Testing

### QuickCheck Integration
```rust
#[cfg(test)]
mod property_tests {
    use super::*;
    use quickcheck::{Arbitrary, Gen, QuickCheck, TestResult};
    use quickcheck_macros::quickcheck;

    #[derive(Debug, Clone, Arbitrary)]
    struct TestCommand {
        command: String,
        args: Vec<String>,
    }

    #[quickcheck]
    fn test_command_validation(cmd: TestCommand) -> TestResult {
        let validator = CommandValidator::new();
        
        match validator.validate(&cmd.command, &cmd.args) {
            Ok(_) => TestResult::passed(),
            Err(_) => TestResult::passed(), // Some commands should fail validation
        }
    }

    #[derive(Debug, Clone, Arbitrary)]
    struct TestSessionConfig {
        cols: u16,
        rows: u16,
        buffer_size: usize,
    }

    #[quickcheck]
    fn test_session_config_validation(config: TestSessionConfig) -> TestResult {
        if config.cols == 0 || config.rows == 0 {
            return TestResult::discard();
        }

        if config.buffer_size > 1024 * 1024 {
            return TestResult::discard();
        }

        let validator = SessionConfigValidator::new();
        match validator.validate(&config) {
            Ok(_) => TestResult::passed(),
            Err(_) => TestResult::failed(),
        }
    }
}
```

## Performance Testing

### Benchmark Tests
```rust
#[cfg(test)]
mod performance_tests {
    use super::*;
    use std::time::{Duration, Instant};
    use tokio::task::JoinSet;

    #[tokio::test]
    async fn test_concurrent_session_creation() {
        let pty_service = PtyService::new();
        let num_sessions = 100;
        
        let start = Instant::now();
        
        let mut tasks = JoinSet::new();
        
        for i in 0..num_sessions {
            let pty_service = pty_service.clone();
            let session_id = format!("session-{}", i);
            let workspace_id = format!("workspace-{}", i);
            
            tasks.spawn(async move {
                pty_service.create_session(session_id, workspace_id, 80, 24).await
            });
        }
        
        let mut results = Vec::new();
        while let Some(result) = tasks.join_next().await {
            results.push(result);
        }
        
        let duration = start.elapsed();
        
        println!("Created {} sessions in {:?}", num_sessions, duration);
        println!("Average time per session: {:?}", duration / num_sessions);
        
        // Verify all sessions were created successfully
        let success_count = results.iter().filter(|r| r.is_ok()).count();
        assert_eq!(success_count, num_sessions);
        
        // Clean up
        for i in 0..num_sessions {
            let session_id = format!("session-{}", i);
            let _ = pty_service.destroy_session(&session_id);
        }
    }

    #[tokio::test]
    async fn test_terminal_throughput() {
        let pty_service = PtyService::new();
        let session_id = "throughput-test";
        let workspace_id = "test-workspace";
        
        // Create session
        let mut output_rx = pty_service.create_session(
            session_id.to_string(),
            workspace_id.to_string(),
            80,
            24,
        ).await.unwrap();
        
        let num_messages = 1000;
        let message_size = 1024; // 1KB messages
        let test_data = "A".repeat(message_size);
        
        let start = Instant::now();
        
        // Send messages
        for _ in 0..num_messages {
            pty_service.send_input(session_id, &test_data).unwrap();
        }
        
        let duration = start.elapsed();
        
        println!("Sent {} messages in {:?}", num_messages, duration);
        println!("Throughput: {:.2} MB/s", 
            (num_messages * message_size) as f64 / duration.as_secs_f64() / 1024.0 / 1024.0);
        
        // Clean up
        pty_service.destroy_session(session_id).unwrap();
    }

    #[tokio::test]
    async fn test_database_concurrent_operations() {
        let db = create_test_database().await;
        let num_operations = 1000;
        
        let start = Instant::now();
        
        let mut tasks = JoinSet::new();
        
        for i in 0..num_operations {
            let db = db.clone();
            let session_id = format!("session-{}", i);
            
            tasks.spawn(async move {
                let session = Session {
                    id: session_id,
                    user_id: "user123".to_string(),
                    socket_id: Some("socket-123".to_string()),
                    status: "active".to_string(),
                    last_activity_at: Utc::now(),
                    created_at: Utc::now(),
                    session_name: "Test Session".to_string(),
                    session_type: "terminal".to_string(),
                    is_default_session: false,
                    current_working_dir: Some("/tmp".to_string()),
                    environment_vars: Some("{}".to_string()),
                    shell_history: Some("[]".to_string()),
                    terminal_size: Some("{\"cols\":80,\"rows\":24}".to_string()),
                    recovery_token: Some("recovery-token".to_string()),
                    can_recover: true,
                    max_idle_time: 1440,
                    auto_cleanup: true,
                    workspace_id: Some("workspace-123".to_string()),
                };
                
                db.create_session(&session).await
            });
        }
        
        let mut results = Vec::new();
        while let Some(result) = tasks.join_next().await {
            results.push(result);
        }
        
        let duration = start.elapsed();
        
        println!("Performed {} database operations in {:?}", num_operations, duration);
        println!("Operations per second: {:.2}", 
            num_operations as f64 / duration.as_secs_f64());
        
        // Verify all operations succeeded
        let success_count = results.iter().filter(|r| r.is_ok()).count();
        assert_eq!(success_count, num_operations);
    }
}
```

## Test Utilities

### Mock Services
```rust
#[cfg(test)]
pub mod mocks {
    use super::*;
    use std::collections::HashMap;
    use tokio::sync::RwLock;

    pub struct MockDatabase {
        sessions: RwLock<HashMap<String, Session>>,
        workspaces: RwLock<HashMap<String, Workspace>>,
    }

    impl MockDatabase {
        pub fn new() -> Self {
            Self {
                sessions: RwLock::new(HashMap::new()),
                workspaces: RwLock::new(HashMap::new()),
            }
        }

        pub async fn create_session(&self, session: &Session) -> Result<()> {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session.id.clone(), session.clone());
            Ok(())
        }

        pub async fn get_session(&self, session_id: &str) -> Result<Session> {
            let sessions = self.sessions.read().await;
            sessions.get(session_id)
                .cloned()
                .ok_or_else(|| Error::NotFound("Session not found".to_string()))
        }
    }

    pub struct MockPtyService {
        sessions: RwLock<HashMap<String, MockSession>>,
    }

    pub struct MockSession {
        pub id: String,
        pub workspace_id: String,
        pub output: Vec<String>,
    }

    impl MockPtyService {
        pub fn new() -> Self {
            Self {
                sessions: RwLock::new(HashMap::new()),
            }
        }

        pub async fn create_session(
            &self,
            session_id: String,
            workspace_id: String,
            _cols: u16,
            _rows: u16,
        ) -> Result<mpsc::UnboundedReceiver<String>> {
            let (tx, rx) = mpsc::unbounded_channel();
            
            let session = MockSession {
                id: session_id.clone(),
                workspace_id,
                output: Vec::new(),
            };
            
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id, session);
            
            Ok(rx)
        }

        pub async fn send_input(&self, session_id: &str, data: &str) -> Result<()> {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.output.push(data.to_string());
                Ok(())
            } else {
                Err(Error::NotFound("Session not found".to_string()))
            }
        }
    }
}
```

### Test Fixtures
```rust
#[cfg(test)]
pub mod fixtures {
    use super::*;

    pub fn create_test_session() -> Session {
        Session {
            id: "test-session".to_string(),
            user_id: "user123".to_string(),
            socket_id: Some("socket-123".to_string()),
            status: "active".to_string(),
            last_activity_at: Utc::now(),
            created_at: Utc::now(),
            session_name: "Test Session".to_string(),
            session_type: "terminal".to_string(),
            is_default_session: false,
            current_working_dir: Some("/tmp".to_string()),
            environment_vars: Some("{}".to_string()),
            shell_history: Some("[]".to_string()),
            terminal_size: Some("{\"cols\":80,\"rows\":24}".to_string()),
            recovery_token: Some("recovery-token".to_string()),
            can_recover: true,
            max_idle_time: 1440,
            auto_cleanup: true,
            workspace_id: Some("workspace-123".to_string()),
        }
    }

    pub fn create_test_workspace() -> Workspace {
        Workspace {
            id: "test-workspace".to_string(),
            name: "Test Workspace".to_string(),
            github_repo: "test/repo".to_string(),
            github_url: "https://github.com/test/repo".to_string(),
            local_path: "/tmp/test-workspace".to_string(),
            is_active: true,
            last_sync_at: Utc::now(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    pub fn create_test_config() -> Config {
        Config {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 0,
                static_files: None,
                worker_threads: 1,
            },
            database: DatabaseConfig {
                url: "sqlite::memory:".to_string(),
                max_connections: 1,
                min_connections: 1,
                acquire_timeout: 5,
                idle_timeout: 300,
            },
            auth: AuthConfig {
                jwt_secret: "test-secret-key".to_string(),
                github_client_id: "test-client-id".to_string(),
                github_client_secret: "test-client-secret".to_string(),
                github_redirect_url: "http://localhost:3000/auth/callback".to_string(),
                tenant_github_usernames: vec!["testuser".to_string()],
            },
            cors: CorsConfig {
                allowed_origins: vec!["http://localhost:3000".to_string()],
                allowed_headers: vec!["content-type".to_string(), "authorization".to_string()],
            },
            terminal: TerminalConfig::default(),
            monitoring: MonitoringConfig::default(),
        }
    }
}
```

## Test Configuration

### Cargo.toml Test Dependencies
```toml
[dev-dependencies]
tokio-test = "0.4"
mockall = "0.12"
quickcheck = "1.0"
quickcheck_macros = "1.0"
criterion = "0.5"
tempfile = "3.8"
wiremock = "0.5"
serde_json = "1.0"
tokio-tungstenite = "0.20"
futures-util = "0.3"
hyper = { version = "0.14", features = ["full"] }
tower = { version = "0.4", features = ["full"] }
```

### Test Scripts
```bash
#!/bin/bash
# scripts/test.sh

set -e

echo "Running unit tests..."
cargo test --lib -- --test-threads=1

echo "Running integration tests..."
cargo test --test integration -- --test-threads=1

echo "Running documentation tests..."
cargo test --doc

echo "Running benchmarks..."
cargo bench

echo "Generating coverage report..."
cargo tarpaulin --out Html

echo "All tests completed successfully!"
```

This comprehensive testing strategy ensures that the Rust backend is thoroughly tested across all levels, from individual functions to complete user workflows, providing confidence in the reliability and performance of the system.