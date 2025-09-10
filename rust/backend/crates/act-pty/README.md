# ACT PTY - Terminal Process Management Adapter

The `act-pty` crate provides terminal (PTY) process management capabilities for the ACT (AI Coding Terminal) system. This crate implements the `PtyService` trait from `act-core` using async Rust and the `portable-pty` library for cross-platform terminal support.

## Architecture

This crate is an **adapter** in our hexagonal architecture:
- **Domain Interface Implementation**: Implements `PtyService` trait from `act-core`
- **Async Processing**: Non-blocking terminal I/O using tokio
- **Cross-Platform**: Works on Linux, macOS, and Windows
- **Session Management**: Handles multiple concurrent terminal sessions
- **Event Streaming**: Real-time terminal output via async channels

## Core Component: TokioPtyService

The main export is `TokioPtyService`, which provides async terminal session management.

### Basic Usage

```rust
use act_pty::TokioPtyService;
use act_core::{PtyService, SessionConfig, PtySize};
use std::collections::HashMap;

// Create the PTY service
let pty_service = TokioPtyService::new();

// Configure a new terminal session
let config = SessionConfig {
    session_id: "terminal_1".to_string(),
    command: Some("/bin/bash".to_string()),
    working_dir: Some("/workspaces/project".to_string()),
    environment: HashMap::new(),
    size: PtySize { cols: 80, rows: 24 },
};

// Create the session
let session_info = pty_service.create_session(&config).await?;
println!("Created PTY session: {} (PID: {})", 
         session_info.session_id, session_info.pid);
```

### Session Management

```rust
use tokio::time::{timeout, Duration};

// Create multiple sessions
let session1 = pty_service.create_session(&SessionConfig {
    session_id: "bash_session".to_string(),
    command: Some("/bin/bash".to_string()),
    working_dir: Some("/workspaces".to_string()),
    environment: HashMap::new(),
    size: PtySize { cols: 80, rows: 24 },
}).await?;

let session2 = pty_service.create_session(&SessionConfig {
    session_id: "python_session".to_string(),  
    command: Some("/usr/bin/python3".to_string()),
    working_dir: Some("/workspaces".to_string()),
    environment: HashMap::new(),
    size: PtySize { cols: 80, rows: 24 },
}).await?;

// List all active sessions
let sessions = pty_service.list_sessions().await?;
for session in sessions {
    println!("Active session: {}", session.session_id);
}

// Check if specific session is still active
let is_active = pty_service.is_session_active(&"bash_session".to_string()).await?;
if is_active {
    println!("Bash session is still running");
}
```

## Terminal I/O Operations

### Sending Input

```rust
// Send commands to the terminal
pty_service.send_input(&"bash_session".to_string(), b"ls -la\n").await?;
pty_service.send_input(&"bash_session".to_string(), b"cd src\n").await?;
pty_service.send_input(&"bash_session".to_string(), b"pwd\n").await?;

// Send interactive input
pty_service.send_input(&"python_session".to_string(), b"import os\n").await?;
pty_service.send_input(&"python_session".to_string(), b"print(os.getcwd())\n").await?;

// Handle special characters and escape sequences
pty_service.send_input(&"bash_session".to_string(), b"\x03").await?; // Ctrl+C
pty_service.send_input(&"bash_session".to_string(), b"\x04").await?; // Ctrl+D
```

### Receiving Output

```rust
use act_core::PtyEvent;

// Get output stream for a session
let mut output = pty_service.get_session_output(&"bash_session".to_string()).await?;

// Process output events
while let Some(event) = output.recv().await {
    match event {
        PtyEvent::Output(data) => {
            let text = String::from_utf8_lossy(&data);
            print!("{}", text); // Display terminal output
        },
        PtyEvent::Closed => {
            println!("Terminal session closed");
            break;
        }
    }
}
```

### Real-time Output Processing

```rust
use tokio::select;
use tokio::time::{interval, Duration};

// Handle multiple sessions simultaneously
let mut bash_output = pty_service.get_session_output(&"bash_session".to_string()).await?;
let mut python_output = pty_service.get_session_output(&"python_session".to_string()).await?;
let mut heartbeat = interval(Duration::from_secs(30));

loop {
    select! {
        // Handle bash output
        Some(event) = bash_output.recv() => {
            match event {
                PtyEvent::Output(data) => {
                    println!("[BASH] {}", String::from_utf8_lossy(&data));
                }
                PtyEvent::Closed => {
                    println!("[BASH] Session closed");
                    break;
                }
            }
        }
        
        // Handle python output
        Some(event) = python_output.recv() => {
            match event {
                PtyEvent::Output(data) => {
                    println!("[PYTHON] {}", String::from_utf8_lossy(&data));
                }
                PtyEvent::Closed => {
                    println!("[PYTHON] Session closed");
                    break;
                }
            }
        }
        
        // Periodic health check
        _ = heartbeat.tick() => {
            let sessions = pty_service.list_sessions().await?;
            println!("Health check: {} active sessions", sessions.len());
        }
    }
}
```

## Session Configuration

### Environment Variables

```rust
use std::collections::HashMap;

let mut environment = HashMap::new();
environment.insert("NODE_ENV".to_string(), "development".to_string());
environment.insert("PATH".to_string(), "/usr/local/bin:/usr/bin:/bin".to_string());
environment.insert("TERM".to_string(), "xterm-256color".to_string());

let config = SessionConfig {
    session_id: "node_session".to_string(),
    command: Some("/usr/local/bin/node".to_string()),
    working_dir: Some("/workspaces/my-app".to_string()),
    environment,
    size: PtySize { cols: 120, rows: 30 },
};

let session = pty_service.create_session(&config).await?;
```

### Custom Commands and Arguments

```rust
// Start specific applications
let configs = vec![
    // Vim editor
    SessionConfig {
        session_id: "vim_session".to_string(),
        command: Some("/usr/bin/vim".to_string()),
        working_dir: Some("/workspaces".to_string()),
        environment: HashMap::new(),
        size: PtySize { cols: 80, rows: 24 },
    },
    
    // Node.js REPL
    SessionConfig {
        session_id: "node_repl".to_string(),
        command: Some("/usr/local/bin/node".to_string()),
        working_dir: Some("/workspaces".to_string()),
        environment: HashMap::new(),
        size: PtySize { cols: 80, rows: 24 },
    },
    
    // Custom script
    SessionConfig {
        session_id: "build_script".to_string(),
        command: Some("/workspaces/scripts/build.sh".to_string()),
        working_dir: Some("/workspaces".to_string()),
        environment: HashMap::new(),
        size: PtySize { cols: 120, rows: 30 },
    },
];

for config in configs {
    let session = pty_service.create_session(&config).await?;
    println!("Started {}: PID {}", session.session_id, session.pid);
}
```

## Terminal Resizing

```rust
use act_core::PtySize;

// Resize terminal when UI layout changes
let new_size = PtySize { cols: 120, rows: 40 };
pty_service.resize_session(&"bash_session".to_string(), new_size).await?;

// Handle dynamic resizing based on window size
async fn handle_resize_event(
    pty_service: &TokioPtyService,
    session_id: &str,
    cols: u16,
    rows: u16
) -> Result<()> {
    let size = PtySize { cols, rows };
    pty_service.resize_session(&session_id.to_string(), size).await?;
    println!("Resized session {} to {}x{}", session_id, cols, rows);
    Ok(())
}
```

## Session Lifecycle Management

### Getting Session Information

```rust
// Get detailed session info
let session_info = pty_service.get_session_info(&"bash_session".to_string()).await?;
println!("Session: {}", session_info.session_id);
println!("Process ID: {}", session_info.pid);
println!("Terminal size: {}x{}", session_info.size.cols, session_info.size.rows);

// Check if session is active
let active = pty_service.is_session_active(&"bash_session".to_string()).await?;
if !active {
    println!("Session has terminated");
}
```

### Session Termination

```rust
// Graceful termination
pty_service.send_input(&"bash_session".to_string(), b"exit\n").await?;

// Or force termination
pty_service.destroy_session(&"bash_session".to_string()).await?;
println!("Session terminated");

// Wait for session to actually close
use tokio::time::{sleep, Duration};

let mut attempts = 0;
while pty_service.is_session_active(&"bash_session".to_string()).await? {
    if attempts > 10 {
        // Force kill if graceful exit doesn't work
        pty_service.destroy_session(&"bash_session".to_string()).await?;
        break;
    }
    sleep(Duration::from_millis(100)).await;
    attempts += 1;
}
```

## Domain Integration

The PTY service integrates seamlessly with domain services:

```rust
use act_domain::SessionService;
use act_pty::TokioPtyService;
use std::sync::Arc;

// Inject into domain service
let pty_service: Arc<dyn PtyService> = Arc::new(TokioPtyService::new());

let session_service = SessionService::new(
    session_repository,
    pty_service, // <- PTY adapter injected here
    Some(24), // recovery timeout hours
);

// Domain service uses PTY through trait
let session_state = session_service.create_session(CreateSessionOptions {
    workspace_id: Some("workspace_123".to_string()),
    session_name: "Terminal".to_string(),
    session_type: SessionType::Terminal,
    terminal_size: Some(PtySize { cols: 80, rows: 24 }),
    is_recoverable: true,
    auto_cleanup: false,
    max_idle_minutes: 30,
}).await?;
```

## Error Handling

PTY errors are converted to domain errors:

```rust
use act_core::CoreError;

match pty_service.create_session(&config).await {
    Ok(session) => println!("Session created: {}", session.session_id),
    Err(CoreError::Pty(msg)) => println!("PTY error: {}", msg),
    Err(CoreError::Process(msg)) => println!("Process error: {}", msg),
    Err(CoreError::Validation(msg)) => println!("Invalid config: {}", msg),
    Err(e) => println!("Other error: {}", e),
}
```

**Common Error Scenarios:**
- Command not found → `CoreError::Process`
- Permission denied → `CoreError::PermissionDenied`
- Invalid session ID → `CoreError::NotFound`
- PTY allocation failed → `CoreError::Pty`
- Session already exists → `CoreError::Conflict`

## Advanced Features

### Session Recovery

```rust
// Sessions can be designed for recovery
let recoverable_config = SessionConfig {
    session_id: "persistent_session".to_string(),
    command: Some("/bin/bash".to_string()),
    working_dir: Some("/workspaces".to_string()),
    environment: HashMap::new(),
    size: PtySize { cols: 80, rows: 24 },
};

// Even if the service restarts, sessions can be recovered
// through domain service persistence layers
```

### Performance Monitoring

```rust
// Monitor session performance
let sessions = pty_service.list_sessions().await?;
for session_info in sessions {
    println!("Session {} - PID: {}, Size: {}x{}", 
             session_info.session_id, 
             session_info.pid,
             session_info.size.cols, 
             session_info.size.rows);
}
```

## Testing

The PTY service can be tested with mock commands:

```rust
#[tokio::test]
async fn test_echo_command() -> Result<()> {
    let pty_service = TokioPtyService::new();
    
    let config = SessionConfig {
        session_id: "test_session".to_string(),
        command: Some("/bin/echo".to_string()),
        working_dir: Some("/tmp".to_string()),
        environment: HashMap::new(),
        size: PtySize { cols: 80, rows: 24 },
    };
    
    let session = pty_service.create_session(&config).await?;
    assert_eq!(session.session_id, "test_session");
    
    // Send input and verify output
    pty_service.send_input(&session.session_id, b"Hello, World!\n").await?;
    
    let mut output = pty_service.get_session_output(&session.session_id).await?;
    if let Some(PtyEvent::Output(data)) = output.recv().await {
        let text = String::from_utf8_lossy(&data);
        assert!(text.contains("Hello, World!"));
    }
    
    Ok(())
}
```

## Platform Compatibility

- **Linux**: Full support using Unix PTY
- **macOS**: Full support using Unix PTY  
- **Windows**: Support via ConPTY (Windows 10+)

The service automatically handles platform differences through the `portable-pty` library.

## Performance Characteristics

- **Concurrent Sessions**: Can handle hundreds of concurrent terminal sessions
- **Low Latency**: Minimal overhead for terminal I/O operations
- **Memory Efficient**: Streams data without buffering large amounts in memory
- **CPU Usage**: Scales well with number of active sessions
- **Non-blocking**: All operations are async and don't block the runtime

This makes it suitable for multi-user environments where many users need concurrent terminal access.