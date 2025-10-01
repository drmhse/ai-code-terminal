# Background Autonomous Task Execution System

## Executive Summary

This document outlines the complete architectural design and implementation plan for enabling Microsoft To-Do tasks to be executed autonomously by Claude Code in the background. When a user opens a task and clicks "Work on Task", the system will:

1. Execute Claude Code with the task description/requirements
2. Capture all output in real-time
3. Update the task's description/notes field with results
4. Mark the task as completed (or failed with error details)
5. Provide live progress updates via WebSocket

## Table of Contents

- [1. System Architecture](#1-system-architecture)
- [2. Claude Code Integration Research](#2-claude-code-integration-research)
- [3. Technical Design](#3-technical-design)
- [4. Data Flow](#4-data-flow)
- [5. Implementation Checklist](#5-implementation-checklist)
- [6. API Specifications](#6-api-specifications)
- [7. Security & Error Handling](#7-security--error-handling)
- [8. Testing Strategy](#8-testing-strategy)
- [9. Future Enhancements](#9-future-enhancements)

---

## 1. System Architecture

### 1.1 Current Architecture Analysis

**Backend Stack (Rust)**
```
rust/backend/crates/
├── act-core/          # Core traits and interfaces
├── act-domain/        # Business logic services
├── act-process/       # Process management (TokioProcessRunner)
├── act-pty/           # PTY/terminal sessions (TokioPtyService)
├── act-server/        # Axum HTTP + Socket.IO server
└── act-persistence/   # Database repositories
```

**Frontend Stack (Vue 3 + TypeScript)**
```
rust/frontend/src/
├── components/tasks/  # Task UI components
├── stores/           # Pinia state management
│   ├── todo.ts       # Microsoft Tasks store
│   ├── workspace.ts  # Workspace management
│   ├── process.ts    # Process tracking
│   └── terminal-tree.ts # Terminal session tracking
└── services/         # API clients
```

**Key Architectural Patterns:**
- Domain-Driven Design (DDD) with service layer
- Repository pattern for data access
- Event-driven communication (Socket.IO)
- In-memory ephemeral process tracking (like terminal sessions)
- Prisma ORM for database operations

### 1.2 Integration Points

The system will integrate at these layers:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vue 3)                     │
│  TaskDetailPanel.vue → todoStore → Socket.IO Client    │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket
                         ↓
┌─────────────────────────────────────────────────────────┐
│              Backend (Rust + Axum + Socket.IO)          │
│  socket_handlers → TaskExecutionService → PTY/Process   │
└────────────────────────┬────────────────────────────────┘
                         │
                    ┌────┴────┐
                    ↓         ↓
            ┌───────────┐ ┌──────────────────┐
            │ Database  │ │ Claude Code CLI  │
            │ (Prisma)  │ │ (External Exec)  │
            └───────────┘ └──────────────────┘
```

---

## 2. Claude Code Integration Research

### 2.1 Claude Code Capabilities

**What is Claude Code?**
- Agentic coding tool by Anthropic
- Operates directly in terminal
- Can read/write files, execute commands, create commits
- Highly scriptable and composable
- Enterprise-ready with security features

**Installation:**
```bash
npm install -g @anthropic-ai/claude-code
```

### 2.2 CLI Execution Patterns

**Key Commands:**
```bash
# Interactive mode
claude "implement feature X"

# Non-interactive (print) mode - CRITICAL for automation
claude -p "fix bug in auth.rs" --output-format json

# Pipe input
cat requirements.txt | claude -p "implement these features"

# Continue session
claude -c -p "add tests for the feature"

# With specific workspace
claude -p "refactor user service" --add-dir /path/to/workspace

# Permission modes
claude -p "analyze codebase" --permission-mode plan  # Read-only
claude -p "implement feature" --permission-mode acceptEdits  # Auto-accept edits
claude -p "fix tests" --dangerously-skip-permissions  # Full automation (sandbox only)
```

**Output Formats:**
```bash
# Text output (default)
claude -p "query"

# JSON output (structured, parseable)
claude -p "query" --output-format json
# Returns: {"type":"result","subtype":"success","result":"...","session_id":"...","total_cost_usd":0.045}

# Streaming JSON (real-time)
claude -p "query" --output-format stream-json --include-partial-messages
```

### 2.3 Critical Flags for Automation

| Flag | Purpose | Use Case |
|------|---------|----------|
| `-p, --print` | Non-interactive execution | Background automation |
| `--output-format json` | Structured output | Parsing results |
| `--output-format stream-json` | Real-time streaming | Live progress updates |
| `--dangerously-skip-permissions` | Skip all prompts | Sandboxed automation |
| `--permission-mode plan` | Read-only mode | Safe analysis |
| `--add-dir` | Set workspace directory | Workspace isolation |
| `--session-id <uuid>` | Specific session ID | Track executions |
| `--allowedTools` | Limit tool access | Security constraints |
| `--model` | Specify model | Cost/performance tuning |

### 2.4 Example Execution & Output

**Command:**
```bash
cd /workspace/my-project
claude -p "Fix TypeScript errors in auth module" \
  --output-format json \
  --permission-mode acceptEdits \
  --add-dir /workspace/my-project
```

**Output (JSON):**
```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 4581,
  "duration_api_ms": 6014,
  "num_turns": 3,
  "result": "Fixed 5 TypeScript errors in auth module:\n- Updated type definitions\n- Fixed async/await usage\n- Corrected import paths\n\nAll tests passing.",
  "session_id": "13cee7a9-cf6b-4c98-862c-e3140ee1b8de",
  "total_cost_usd": 0.04573135,
  "usage": {
    "input_tokens": 4,
    "cache_creation_input_tokens": 11711,
    "cache_read_input_tokens": 5291,
    "output_tokens": 5
  },
  "permission_denials": []
}
```

### 2.5 Advanced Features for Task Automation

**1. Subagents (Specialized Autonomous Agents)**
- Create task-specific subagents
- Example: "test-runner" subagent that only runs and fixes tests
- Invoke: `claude -p "Use test-runner subagent to fix failing tests"`

**2. Hooks (Output Capture)**
- Define shell commands that run at specific points
- Example: Log all bash commands executed
- Capture intermediate results

**3. Custom Output Styles**
- Modify system prompt for specific formats
- Example: "Learning" style with TODO markers
- Useful for structured task results

---

## 3. Technical Design

### 3.1 New Domain Service: TaskExecutionService

**Location:** `rust/backend/crates/act-domain/src/task_execution_service.rs`

**Core Responsibilities:**
1. Execute Claude Code CLI with task requirements
2. Capture output (stdout/stderr) in real-time
3. Parse structured results
4. Update task description with execution summary
5. Manage execution lifecycle (start, monitor, cancel)
6. Handle errors and retries

**Service Structure:**
```rust
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::{RwLock, Mutex};
use tokio::process::Command;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use tracing::{info, warn, error};

// ===== Type Definitions =====

pub type TaskExecutionId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskExecutionRequest {
    pub task_id: String,
    pub workspace_id: String,
    pub task_title: String,
    pub task_description: String,
    pub working_directory: String,
    pub permission_mode: ExecutionPermissionMode,
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecutionPermissionMode {
    Plan,              // Read-only analysis
    AcceptEdits,       // Auto-accept file changes
    BypassAll,         // Full automation (sandbox only)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskExecutionStatus {
    Queued,
    Running,
    Completed {
        exit_code: i32,
        duration_ms: u64,
        cost_usd: f64,
    },
    Failed {
        error: String,
        exit_code: Option<i32>,
    },
    Cancelled,
    TimedOut,
}

#[derive(Debug, Clone)]
pub struct TaskExecution {
    pub id: TaskExecutionId,
    pub task_id: String,
    pub workspace_id: String,
    pub command: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub status: TaskExecutionStatus,
    pub output_buffer: Arc<RwLock<Vec<String>>>,
    pub session_id: Option<String>,  // Claude Code session ID
    pub child_process: Option<Arc<Mutex<tokio::process::Child>>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskExecutionResult {
    pub execution_id: TaskExecutionId,
    pub task_id: String,
    pub status: TaskExecutionStatus,
    pub output: String,
    pub summary: String,
    pub duration_ms: u64,
    pub cost_usd: Option<f64>,
    pub files_modified: Vec<String>,
}

// ===== Main Service =====

#[derive(Clone)]
pub struct TaskExecutionService {
    task_sync_service: Arc<crate::TaskSyncService>,
    workspace_service: Arc<crate::WorkspaceService>,
    active_executions: Arc<RwLock<HashMap<TaskExecutionId, TaskExecution>>>,
    output_broadcaster: Arc<dyn OutputBroadcaster>,
}

// Trait for broadcasting output to WebSocket clients
#[async_trait::async_trait]
pub trait OutputBroadcaster: Send + Sync {
    async fn broadcast_output(&self, execution_id: &str, chunk: String);
    async fn broadcast_status(&self, execution_id: &str, status: TaskExecutionStatus);
}

impl TaskExecutionService {
    pub fn new(
        task_sync_service: Arc<crate::TaskSyncService>,
        workspace_service: Arc<crate::WorkspaceService>,
        output_broadcaster: Arc<dyn OutputBroadcaster>,
    ) -> Self {
        Self {
            task_sync_service,
            workspace_service,
            active_executions: Arc::new(RwLock::new(HashMap::new())),
            output_broadcaster,
        }
    }

    /// Start executing a task with Claude Code
    pub async fn start_execution(
        &self,
        request: TaskExecutionRequest,
    ) -> Result<TaskExecutionId, TaskExecutionError> {
        info!("Starting execution for task: {}", request.task_id);

        // Validate workspace exists
        let workspace = self.workspace_service
            .get_workspace(&request.workspace_id)
            .await
            .map_err(|e| TaskExecutionError::WorkspaceNotFound(e.to_string()))?;

        // Check if task is already being executed
        {
            let executions = self.active_executions.read().await;
            if executions.values().any(|e| e.task_id == request.task_id
                && matches!(e.status, TaskExecutionStatus::Running | TaskExecutionStatus::Queued)) {
                return Err(TaskExecutionError::AlreadyRunning);
            }
        }

        // Generate execution ID
        let execution_id = Uuid::new_v4().to_string();

        // Build Claude Code command
        let command = self.build_claude_command(&request)?;

        // Create execution record
        let execution = TaskExecution {
            id: execution_id.clone(),
            task_id: request.task_id.clone(),
            workspace_id: request.workspace_id.clone(),
            command: command.clone(),
            start_time: Utc::now(),
            end_time: None,
            status: TaskExecutionStatus::Queued,
            output_buffer: Arc::new(RwLock::new(Vec::new())),
            session_id: None,
            child_process: None,
        };

        // Store execution
        {
            let mut executions = self.active_executions.write().await;
            executions.insert(execution_id.clone(), execution.clone());
        }

        // Spawn execution task
        let service_clone = self.clone();
        let execution_id_clone = execution_id.clone();
        tokio::spawn(async move {
            if let Err(e) = service_clone.run_execution(&execution_id_clone, request).await {
                error!("Execution {} failed: {:?}", execution_id_clone, e);
            }
        });

        Ok(execution_id)
    }

    /// Build Claude Code CLI command
    fn build_claude_command(
        &self,
        request: &TaskExecutionRequest,
    ) -> Result<String, TaskExecutionError> {
        let permission_flag = match request.permission_mode {
            ExecutionPermissionMode::Plan => "--permission-mode plan",
            ExecutionPermissionMode::AcceptEdits => "--permission-mode acceptEdits",
            ExecutionPermissionMode::BypassAll => "--dangerously-skip-permissions",
        };

        // Construct prompt from task details
        let prompt = format!(
            "Task: {}\n\nDescription:\n{}",
            request.task_title,
            request.task_description
        );

        // Build command with all necessary flags
        Ok(format!(
            "claude -p '{}' --output-format stream-json --include-partial-messages {} --add-dir '{}'",
            prompt.replace("'", "'\\''"),  // Escape single quotes
            permission_flag,
            request.working_directory
        ))
    }

    /// Execute the Claude Code command and capture output
    async fn run_execution(
        &self,
        execution_id: &str,
        request: TaskExecutionRequest,
    ) -> Result<(), TaskExecutionError> {
        info!("Running execution: {}", execution_id);

        // Update status to Running
        self.update_execution_status(execution_id, TaskExecutionStatus::Running).await?;

        // Get command
        let command = {
            let executions = self.active_executions.read().await;
            let execution = executions.get(execution_id)
                .ok_or(TaskExecutionError::ExecutionNotFound)?;
            execution.command.clone()
        };

        // Spawn Claude Code process
        let mut child = Command::new("bash")
            .arg("-c")
            .arg(&command)
            .current_dir(&request.working_directory)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| TaskExecutionError::ProcessSpawnFailed(e.to_string()))?;

        // Store child process for cancellation
        {
            let mut executions = self.active_executions.write().await;
            if let Some(execution) = executions.get_mut(execution_id) {
                execution.child_process = Some(Arc::new(Mutex::new(child)));
            }
        }

        // Capture stdout (streaming JSON output)
        let stdout = child.stdout.take()
            .ok_or(TaskExecutionError::OutputCaptureFailed)?;

        let execution_id_clone = execution_id.to_string();
        let service_clone = self.clone();
        let stdout_task = tokio::spawn(async move {
            service_clone.process_stdout(execution_id_clone, stdout).await;
        });

        // Capture stderr
        let stderr = child.stderr.take()
            .ok_or(TaskExecutionError::OutputCaptureFailed)?;

        let execution_id_clone = execution_id.to_string();
        let service_clone = self.clone();
        let stderr_task = tokio::spawn(async move {
            service_clone.process_stderr(execution_id_clone, stderr).await;
        });

        // Wait for process to complete (with timeout)
        let timeout_duration = request.timeout_seconds
            .map(|s| tokio::time::Duration::from_secs(s))
            .unwrap_or(tokio::time::Duration::from_secs(1800)); // 30 min default

        let wait_result = tokio::time::timeout(
            timeout_duration,
            child.wait()
        ).await;

        // Wait for output tasks to complete
        let _ = tokio::join!(stdout_task, stderr_task);

        // Process result
        match wait_result {
            Ok(Ok(exit_status)) => {
                let exit_code = exit_status.code().unwrap_or(-1);
                let duration_ms = self.calculate_duration(execution_id).await;

                if exit_code == 0 {
                    self.handle_successful_completion(execution_id, exit_code, duration_ms).await?;
                } else {
                    self.handle_failed_completion(execution_id, exit_code).await?;
                }
            }
            Ok(Err(e)) => {
                self.update_execution_status(
                    execution_id,
                    TaskExecutionStatus::Failed {
                        error: e.to_string(),
                        exit_code: None,
                    }
                ).await?;
            }
            Err(_) => {
                // Timeout - kill process
                self.kill_execution(execution_id).await?;
                self.update_execution_status(
                    execution_id,
                    TaskExecutionStatus::TimedOut
                ).await?;
            }
        }

        Ok(())
    }

    /// Process stdout (streaming JSON)
    async fn process_stdout(
        &self,
        execution_id: String,
        stdout: tokio::process::ChildStdout,
    ) {
        use tokio::io::{AsyncBufReadExt, BufReader};

        let mut reader = BufReader::new(stdout).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            // Each line is a JSON object
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                // Extract relevant information
                if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
                    // Store output
                    if let Ok(mut executions) = self.active_executions.write().await {
                        if let Some(execution) = executions.get_mut(&execution_id) {
                            execution.output_buffer.write().await.push(content.to_string());
                        }
                    }

                    // Broadcast to WebSocket
                    self.output_broadcaster.broadcast_output(&execution_id, content.to_string()).await;
                }

                // Track session ID
                if let Some(session_id) = json.get("session_id").and_then(|v| v.as_str()) {
                    if let Ok(mut executions) = self.active_executions.write().await {
                        if let Some(execution) = executions.get_mut(&execution_id) {
                            execution.session_id = Some(session_id.to_string());
                        }
                    }
                }
            }
        }
    }

    /// Process stderr
    async fn process_stderr(
        &self,
        execution_id: String,
        stderr: tokio::process::ChildStderr,
    ) {
        use tokio::io::{AsyncBufReadExt, BufReader};

        let mut reader = BufReader::new(stderr).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            warn!("Execution {} stderr: {}", execution_id, line);

            // Store error output
            if let Ok(mut executions) = self.active_executions.write().await {
                if let Some(execution) = executions.get_mut(&execution_id) {
                    execution.output_buffer.write().await.push(format!("[ERROR] {}", line));
                }
            }
        }
    }

    /// Handle successful completion
    async fn handle_successful_completion(
        &self,
        execution_id: &str,
        exit_code: i32,
        duration_ms: u64,
    ) -> Result<(), TaskExecutionError> {
        info!("Execution {} completed successfully", execution_id);

        // Get full output
        let output = self.get_execution_output(execution_id).await?;

        // Parse Claude Code result
        let parsed_result = self.parse_claude_output(&output)?;

        // Update task description with results
        self.update_task_with_results(execution_id, &parsed_result).await?;

        // Update execution status
        self.update_execution_status(
            execution_id,
            TaskExecutionStatus::Completed {
                exit_code,
                duration_ms,
                cost_usd: parsed_result.cost_usd,
            }
        ).await?;

        // Cleanup
        self.cleanup_execution(execution_id).await?;

        Ok(())
    }

    /// Handle failed completion
    async fn handle_failed_completion(
        &self,
        execution_id: &str,
        exit_code: i32,
    ) -> Result<(), TaskExecutionError> {
        warn!("Execution {} failed with exit code {}", execution_id, exit_code);

        let output = self.get_execution_output(execution_id).await?;

        self.update_execution_status(
            execution_id,
            TaskExecutionStatus::Failed {
                error: format!("Claude Code exited with code {}", exit_code),
                exit_code: Some(exit_code),
            }
        ).await?;

        // Update task with error information
        self.update_task_with_error(execution_id, &output).await?;

        // Cleanup
        self.cleanup_execution(execution_id).await?;

        Ok(())
    }

    /// Parse Claude Code JSON output
    fn parse_claude_output(&self, output: &str) -> Result<ParsedClaudeResult, TaskExecutionError> {
        // Look for the final result JSON line
        for line in output.lines().rev() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                if json.get("type").and_then(|v| v.as_str()) == Some("result") {
                    return Ok(ParsedClaudeResult {
                        success: json.get("subtype").and_then(|v| v.as_str()) == Some("success"),
                        result: json.get("result").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        session_id: json.get("session_id").and_then(|v| v.as_str()).map(String::from),
                        cost_usd: json.get("total_cost_usd").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        duration_ms: json.get("duration_ms").and_then(|v| v.as_u64()).unwrap_or(0),
                    });
                }
            }
        }

        Err(TaskExecutionError::OutputParseFailed)
    }

    /// Update Microsoft To-Do task with execution results
    async fn update_task_with_results(
        &self,
        execution_id: &str,
        result: &ParsedClaudeResult,
    ) -> Result<(), TaskExecutionError> {
        let execution = {
            let executions = self.active_executions.read().await;
            executions.get(execution_id)
                .ok_or(TaskExecutionError::ExecutionNotFound)?
                .clone()
        };

        // Format results as markdown
        let results_section = format!(
            r#"

---

## 🤖 Autonomous Execution Results
**Execution ID:** `{}`
**Completed:** {}
**Duration:** {:.2}s
**Cost:** ${:.4}

### Summary
{}

### Claude Code Session
Session ID: `{}`
"#,
            execution_id,
            execution.start_time.format("%Y-%m-%d %H:%M:%S UTC"),
            result.duration_ms as f64 / 1000.0,
            result.cost_usd,
            result.result,
            result.session_id.as_deref().unwrap_or("N/A")
        );

        // Update task via TaskSyncService
        self.task_sync_service
            .append_to_task_description(&execution.task_id, &results_section)
            .await
            .map_err(|e| TaskExecutionError::TaskUpdateFailed(e.to_string()))?;

        info!("Updated task {} with execution results", execution.task_id);
        Ok(())
    }

    /// Update task with error information
    async fn update_task_with_error(
        &self,
        execution_id: &str,
        error_output: &str,
    ) -> Result<(), TaskExecutionError> {
        let execution = {
            let executions = self.active_executions.read().await;
            executions.get(execution_id)
                .ok_or(TaskExecutionError::ExecutionNotFound)?
                .clone()
        };

        let error_section = format!(
            r#"

---

## ⚠️ Execution Failed
**Execution ID:** `{}`
**Failed at:** {}

### Error Output
```
{}
```
"#,
            execution_id,
            Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
            error_output.lines().take(50).collect::<Vec<_>>().join("\n")
        );

        self.task_sync_service
            .append_to_task_description(&execution.task_id, &error_section)
            .await
            .map_err(|e| TaskExecutionError::TaskUpdateFailed(e.to_string()))?;

        Ok(())
    }

    /// Cancel a running execution
    pub async fn cancel_execution(
        &self,
        execution_id: &str,
    ) -> Result<(), TaskExecutionError> {
        info!("Cancelling execution: {}", execution_id);

        self.kill_execution(execution_id).await?;

        self.update_execution_status(
            execution_id,
            TaskExecutionStatus::Cancelled
        ).await?;

        self.cleanup_execution(execution_id).await?;

        Ok(())
    }

    /// Kill the child process
    async fn kill_execution(&self, execution_id: &str) -> Result<(), TaskExecutionError> {
        let executions = self.active_executions.read().await;
        if let Some(execution) = executions.get(execution_id) {
            if let Some(child_arc) = &execution.child_process {
                let mut child = child_arc.lock().await;
                let _ = child.kill().await;  // Ignore errors
            }
        }
        Ok(())
    }

    /// Get execution status
    pub async fn get_execution_status(
        &self,
        execution_id: &str,
    ) -> Option<TaskExecutionStatus> {
        let executions = self.active_executions.read().await;
        executions.get(execution_id).map(|e| e.status.clone())
    }

    /// Get full execution output
    async fn get_execution_output(&self, execution_id: &str) -> Result<String, TaskExecutionError> {
        let executions = self.active_executions.read().await;
        let execution = executions.get(execution_id)
            .ok_or(TaskExecutionError::ExecutionNotFound)?;

        let buffer = execution.output_buffer.read().await;
        Ok(buffer.join("\n"))
    }

    /// Update execution status and broadcast
    async fn update_execution_status(
        &self,
        execution_id: &str,
        status: TaskExecutionStatus,
    ) -> Result<(), TaskExecutionError> {
        {
            let mut executions = self.active_executions.write().await;
            if let Some(execution) = executions.get_mut(execution_id) {
                execution.status = status.clone();

                if matches!(status, TaskExecutionStatus::Completed { .. }
                    | TaskExecutionStatus::Failed { .. }
                    | TaskExecutionStatus::Cancelled
                    | TaskExecutionStatus::TimedOut) {
                    execution.end_time = Some(Utc::now());
                }
            }
        }

        // Broadcast status update
        self.output_broadcaster.broadcast_status(execution_id, status).await;

        Ok(())
    }

    /// Calculate execution duration
    async fn calculate_duration(&self, execution_id: &str) -> u64 {
        let executions = self.active_executions.read().await;
        if let Some(execution) = executions.get(execution_id) {
            let end = execution.end_time.unwrap_or_else(Utc::now);
            (end - execution.start_time).num_milliseconds().max(0) as u64
        } else {
            0
        }
    }

    /// Cleanup execution from memory after completion
    async fn cleanup_execution(&self, execution_id: &str) -> Result<(), TaskExecutionError> {
        // Keep for 1 hour for status queries, then remove
        let execution_id = execution_id.to_string();
        let active_executions = self.active_executions.clone();

        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
            let mut executions = active_executions.write().await;
            executions.remove(&execution_id);
            info!("Cleaned up execution: {}", execution_id);
        });

        Ok(())
    }
}

// ===== Helper Structs =====

#[derive(Debug)]
struct ParsedClaudeResult {
    success: bool,
    result: String,
    session_id: Option<String>,
    cost_usd: f64,
    duration_ms: u64,
}

// ===== Error Types =====

#[derive(Debug, thiserror::Error)]
pub enum TaskExecutionError {
    #[error("Workspace not found: {0}")]
    WorkspaceNotFound(String),

    #[error("Task is already running")]
    AlreadyRunning,

    #[error("Execution not found")]
    ExecutionNotFound,

    #[error("Failed to spawn process: {0}")]
    ProcessSpawnFailed(String),

    #[error("Failed to capture output")]
    OutputCaptureFailed,

    #[error("Failed to parse Claude Code output")]
    OutputParseFailed,

    #[error("Failed to update task: {0}")]
    TaskUpdateFailed(String),
}
```

### 3.2 Socket.IO Handler Integration

**Location:** `rust/backend/crates/act-server/src/socket_handlers.rs`

**Add new handlers:**

```rust
// ===== Task Execution Request Types =====

#[derive(Debug, Serialize, Deserialize)]
pub struct StartTaskExecutionRequest {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    #[serde(rename = "permissionMode")]
    pub permission_mode: String,  // "plan", "acceptEdits", "bypassAll"
    #[serde(rename = "timeoutSeconds")]
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CancelTaskExecutionRequest {
    #[serde(rename = "executionId")]
    pub execution_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetExecutionStatusRequest {
    #[serde(rename = "executionId")]
    pub execution_id: String,
}

// ===== Event Types =====

#[derive(Debug, Serialize)]
pub struct TaskExecutionStartedEvent {
    #[serde(rename = "executionId")]
    pub execution_id: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct TaskExecutionOutputEvent {
    #[serde(rename = "executionId")]
    pub execution_id: String,
    pub output: String,
}

#[derive(Debug, Serialize)]
pub struct TaskExecutionStatusEvent {
    #[serde(rename = "executionId")]
    pub execution_id: String,
    pub status: String,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    #[serde(rename = "durationMs")]
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct TaskExecutionCompletedEvent {
    #[serde(rename = "executionId")]
    pub execution_id: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub success: bool,
    pub summary: String,
}

// ===== WebSocket Output Broadcaster =====

pub struct SocketIOOutputBroadcaster {
    io: SocketIo,
}

impl SocketIOOutputBroadcaster {
    pub fn new(io: SocketIo) -> Self {
        Self { io }
    }
}

#[async_trait::async_trait]
impl act_domain::OutputBroadcaster for SocketIOOutputBroadcaster {
    async fn broadcast_output(&self, execution_id: &str, chunk: String) {
        self.io.emit("task:execution:output", TaskExecutionOutputEvent {
            execution_id: execution_id.to_string(),
            output: chunk,
        }).ok();
    }

    async fn broadcast_status(&self, execution_id: &str, status: act_domain::TaskExecutionStatus) {
        let (status_str, exit_code, duration_ms) = match status {
            act_domain::TaskExecutionStatus::Queued => ("queued".to_string(), None, None),
            act_domain::TaskExecutionStatus::Running => ("running".to_string(), None, None),
            act_domain::TaskExecutionStatus::Completed { exit_code, duration_ms, .. } =>
                ("completed".to_string(), Some(exit_code), Some(duration_ms)),
            act_domain::TaskExecutionStatus::Failed { exit_code, .. } =>
                ("failed".to_string(), exit_code, None),
            act_domain::TaskExecutionStatus::Cancelled => ("cancelled".to_string(), None, None),
            act_domain::TaskExecutionStatus::TimedOut => ("timeout".to_string(), None, None),
        };

        self.io.emit("task:execution:status", TaskExecutionStatusEvent {
            execution_id: execution_id.to_string(),
            status: status_str,
            exit_code,
            duration_ms,
        }).ok();
    }
}

// ===== Socket Handler Setup =====

pub fn setup_task_execution_handlers(io: SocketIo, state: Arc<AppState>) {
    // Handler: Start task execution
    io.ns("/", move |socket: SocketRef| {
        let state = state.clone();

        socket.on("task:execution:start", move |socket: SocketRef, Data::<StartTaskExecutionRequest>(req)| {
            let state = state.clone();

            async move {
                info!("Received task:execution:start for task {}", req.task_id);

                // Get task details from database
                let task = match state.task_sync_service.get_task(&req.task_id).await {
                    Ok(Some(task)) => task,
                    Ok(None) => {
                        socket.emit("task:execution:error", ErrorEvent {
                            error: "Task not found".to_string(),
                        }).ok();
                        return;
                    }
                    Err(e) => {
                        error!("Failed to get task: {:?}", e);
                        socket.emit("task:execution:error", ErrorEvent {
                            error: format!("Failed to get task: {}", e),
                        }).ok();
                        return;
                    }
                };

                // Get workspace details
                let workspace = match state.workspace_service.get_workspace(&req.workspace_id).await {
                    Ok(workspace) => workspace,
                    Err(e) => {
                        error!("Failed to get workspace: {:?}", e);
                        socket.emit("task:execution:error", ErrorEvent {
                            error: format!("Workspace not found: {}", e),
                        }).ok();
                        return;
                    }
                };

                // Parse permission mode
                let permission_mode = match req.permission_mode.as_str() {
                    "plan" => act_domain::ExecutionPermissionMode::Plan,
                    "acceptEdits" => act_domain::ExecutionPermissionMode::AcceptEdits,
                    "bypassAll" => act_domain::ExecutionPermissionMode::BypassAll,
                    _ => act_domain::ExecutionPermissionMode::Plan,  // Default to safe mode
                };

                // Create execution request
                let exec_request = act_domain::TaskExecutionRequest {
                    task_id: req.task_id.clone(),
                    workspace_id: req.workspace_id.clone(),
                    task_title: task.title,
                    task_description: task.body_content.unwrap_or_default(),
                    working_directory: workspace.local_path,
                    permission_mode,
                    timeout_seconds: req.timeout_seconds,
                };

                // Start execution
                match state.task_execution_service.start_execution(exec_request).await {
                    Ok(execution_id) => {
                        info!("Started execution: {}", execution_id);
                        socket.emit("task:execution:started", TaskExecutionStartedEvent {
                            execution_id: execution_id.clone(),
                            task_id: req.task_id,
                            status: "running".to_string(),
                        }).ok();
                    }
                    Err(e) => {
                        error!("Failed to start execution: {:?}", e);
                        socket.emit("task:execution:error", ErrorEvent {
                            error: format!("Failed to start execution: {}", e),
                        }).ok();
                    }
                }
            }
        });

        // Handler: Cancel task execution
        socket.on("task:execution:cancel", move |socket: SocketRef, Data::<CancelTaskExecutionRequest>(req)| {
            let state = state.clone();

            async move {
                info!("Received task:execution:cancel for execution {}", req.execution_id);

                match state.task_execution_service.cancel_execution(&req.execution_id).await {
                    Ok(_) => {
                        info!("Cancelled execution: {}", req.execution_id);
                        socket.emit("task:execution:cancelled", serde_json::json!({
                            "executionId": req.execution_id,
                        })).ok();
                    }
                    Err(e) => {
                        error!("Failed to cancel execution: {:?}", e);
                        socket.emit("task:execution:error", ErrorEvent {
                            error: format!("Failed to cancel execution: {}", e),
                        }).ok();
                    }
                }
            }
        });

        // Handler: Get execution status
        socket.on("task:execution:status", move |socket: SocketRef, Data::<GetExecutionStatusRequest>(req)| {
            let state = state.clone();

            async move {
                if let Some(status) = state.task_execution_service.get_execution_status(&req.execution_id).await {
                    let (status_str, exit_code, duration_ms) = match status {
                        act_domain::TaskExecutionStatus::Queued => ("queued", None, None),
                        act_domain::TaskExecutionStatus::Running => ("running", None, None),
                        act_domain::TaskExecutionStatus::Completed { exit_code, duration_ms, .. } =>
                            ("completed", Some(exit_code), Some(duration_ms)),
                        act_domain::TaskExecutionStatus::Failed { exit_code, .. } =>
                            ("failed", exit_code, None),
                        act_domain::TaskExecutionStatus::Cancelled => ("cancelled", None, None),
                        act_domain::TaskExecutionStatus::TimedOut => ("timeout", None, None),
                    };

                    socket.emit("task:execution:status", TaskExecutionStatusEvent {
                        execution_id: req.execution_id.clone(),
                        status: status_str.to_string(),
                        exit_code,
                        duration_ms,
                    }).ok();
                } else {
                    socket.emit("task:execution:error", ErrorEvent {
                        error: "Execution not found".to_string(),
                    }).ok();
                }
            }
        });
    });
}
```

### 3.3 Frontend Store Integration

**Location:** `rust/frontend/src/stores/todo.ts`

**Add execution management:**

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { socket } from '@/services/socket'
import { logger } from '@/utils/logger'

export interface TaskExecution {
  executionId: string
  taskId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  output: string[]
  exitCode?: number
  durationMs?: number
  startTime: Date
  endTime?: Date
}

export const useTodoStore = defineStore('todo', () => {
  // ... existing state ...

  // Task execution state
  const activeExecutions = ref<Map<string, TaskExecution>>(new Map())
  const executionHistory = ref<TaskExecution[]>([])

  // Computed
  const getExecutionByTaskId = computed(() => {
    return (taskId: string) => {
      for (const execution of activeExecutions.value.values()) {
        if (execution.taskId === taskId) {
          return execution
        }
      }
      return null
    }
  })

  const isTaskExecuting = computed(() => {
    return (taskId: string) => {
      const execution = getExecutionByTaskId.value(taskId)
      return execution && (execution.status === 'queued' || execution.status === 'running')
    }
  })

  // Actions
  async function startTaskExecution(
    taskId: string,
    workspaceId: string,
    permissionMode: 'plan' | 'acceptEdits' | 'bypassAll' = 'acceptEdits',
    timeoutSeconds?: number
  ) {
    try {
      logger.log(`Starting execution for task ${taskId}`)

      return new Promise<string>((resolve, reject) => {
        // Set up event listeners
        const startedHandler = (event: any) => {
          logger.log('Task execution started:', event)

          // Create execution record
          const execution: TaskExecution = {
            executionId: event.executionId,
            taskId: event.taskId,
            status: 'running',
            output: [],
            startTime: new Date(),
          }

          activeExecutions.value.set(event.executionId, execution)
          resolve(event.executionId)
        }

        const errorHandler = (event: any) => {
          logger.error('Task execution error:', event)
          reject(new Error(event.error))
        }

        socket.once('task:execution:started', startedHandler)
        socket.once('task:execution:error', errorHandler)

        // Send start request
        socket.emit('task:execution:start', {
          taskId,
          workspaceId,
          permissionMode,
          timeoutSeconds,
        })
      })
    } catch (error) {
      logger.error('Failed to start task execution:', error)
      throw error
    }
  }

  async function cancelTaskExecution(executionId: string) {
    try {
      logger.log(`Cancelling execution ${executionId}`)

      return new Promise<void>((resolve, reject) => {
        const cancelledHandler = () => {
          logger.log('Task execution cancelled')

          const execution = activeExecutions.value.get(executionId)
          if (execution) {
            execution.status = 'cancelled'
            execution.endTime = new Date()
            executionHistory.value.push(execution)
            activeExecutions.value.delete(executionId)
          }

          resolve()
        }

        const errorHandler = (event: any) => {
          logger.error('Cancel execution error:', event)
          reject(new Error(event.error))
        }

        socket.once('task:execution:cancelled', cancelledHandler)
        socket.once('task:execution:error', errorHandler)

        socket.emit('task:execution:cancel', { executionId })
      })
    } catch (error) {
      logger.error('Failed to cancel task execution:', error)
      throw error
    }
  }

  function getExecutionStatus(executionId: string) {
    socket.emit('task:execution:status', { executionId })
  }

  // Socket event handlers
  function setupExecutionListeners() {
    // Output events
    socket.on('task:execution:output', (event: any) => {
      const execution = activeExecutions.value.get(event.executionId)
      if (execution) {
        execution.output.push(event.output)
      }
    })

    // Status updates
    socket.on('task:execution:status', (event: any) => {
      const execution = activeExecutions.value.get(event.executionId)
      if (execution) {
        execution.status = event.status
        execution.exitCode = event.exitCode
        execution.durationMs = event.durationMs

        if (event.status === 'completed' || event.status === 'failed' ||
            event.status === 'cancelled' || event.status === 'timeout') {
          execution.endTime = new Date()
          executionHistory.value.push(execution)
          activeExecutions.value.delete(event.executionId)

          // Refresh task to get updated description
          if (execution.taskId) {
            refreshTask(execution.taskId)
          }
        }
      }
    })
  }

  // Call this in onMounted
  setupExecutionListeners()

  return {
    // ... existing exports ...

    // Execution state
    activeExecutions,
    executionHistory,
    getExecutionByTaskId,
    isTaskExecuting,

    // Execution actions
    startTaskExecution,
    cancelTaskExecution,
    getExecutionStatus,
  }
})
```

### 3.4 Frontend UI Components

**Location:** `rust/frontend/src/components/tasks/TaskDetailPanel.vue`

**Add "Work on Task" button and execution status:**

```vue
<template>
  <div class="task-detail-panel">
    <!-- ... existing header ... -->

    <!-- Execution Controls -->
    <div v-if="workspaceStore.currentWorkspace" class="section execution-section">
      <div class="execution-header">
        <label class="section-label">
          <PlayIcon v-if="!isExecuting" />
          <ArrowPathIcon v-else class="animate-spin" />
          <span>Task Execution</span>
        </label>

        <button
          v-if="!isExecuting"
          @click="handleWorkOnTask"
          :disabled="!canExecute"
          class="btn-execute"
          title="Execute this task with Claude Code"
        >
          <PlayIcon />
          <span>Work on Task</span>
        </button>

        <button
          v-else
          @click="handleCancelExecution"
          class="btn-cancel"
          title="Cancel execution"
        >
          <StopIcon />
          <span>Cancel</span>
        </button>
      </div>

      <!-- Execution Status -->
      <div v-if="currentExecution" class="execution-status">
        <div class="status-badge" :class="`status-${currentExecution.status}`">
          {{ formatStatus(currentExecution.status) }}
        </div>

        <div v-if="currentExecution.status === 'running'" class="execution-info">
          <span class="info-label">Started:</span>
          <span class="info-value">{{ formatRelativeTime(currentExecution.startTime) }}</span>
        </div>

        <div v-if="currentExecution.durationMs" class="execution-info">
          <span class="info-label">Duration:</span>
          <span class="info-value">{{ formatDuration(currentExecution.durationMs) }}</span>
        </div>
      </div>

      <!-- Live Output (Optional, collapsible) -->
      <div v-if="currentExecution && showOutput" class="execution-output">
        <div class="output-header">
          <span class="output-title">Live Output</span>
          <button @click="showOutput = false" class="btn-icon btn-xs">
            <ChevronUpIcon />
          </button>
        </div>
        <div class="output-content">
          <pre>{{ currentExecution.output.join('\n') }}</pre>
        </div>
      </div>

      <button
        v-if="currentExecution && !showOutput"
        @click="showOutput = true"
        class="btn-link"
      >
        <ChevronDownIcon />
        Show Output ({{ currentExecution.output.length }} lines)
      </button>

      <!-- Permission Mode Selector -->
      <div v-if="!isExecuting" class="permission-mode">
        <label class="mode-label">Permission Mode:</label>
        <select v-model="selectedPermissionMode" class="mode-select">
          <option value="plan">Plan Mode (Read-only)</option>
          <option value="acceptEdits">Accept Edits (Recommended)</option>
          <option value="bypassAll">Bypass All (Dangerous)</option>
        </select>
      </div>
    </div>

    <!-- ... rest of existing content ... -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { useWorkspaceStore } from '@/stores/workspace'
import {
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/vue/24/outline'
import { logger } from '@/utils/logger'
import type { TodoTask } from '@/services/microsoft-auth'

interface Props {
  task: TodoTask
  listId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  update: [updates: any]
  delete: []
}>()

const todoStore = useTodoStore()
const workspaceStore = useWorkspaceStore()

// Execution state
const selectedPermissionMode = ref<'plan' | 'acceptEdits' | 'bypassAll'>('acceptEdits')
const showOutput = ref(false)
const executing = ref(false)

const currentExecution = computed(() => {
  return todoStore.getExecutionByTaskId(props.task.id)
})

const isExecuting = computed(() => {
  return todoStore.isTaskExecuting(props.task.id)
})

const canExecute = computed(() => {
  return workspaceStore.currentWorkspace &&
         props.task.title &&
         !isExecuting.value
})

// Watch for execution completion
watch(() => currentExecution.value?.status, (newStatus, oldStatus) => {
  if (oldStatus === 'running' &&
      (newStatus === 'completed' || newStatus === 'failed')) {
    showOutput.value = false

    if (newStatus === 'completed') {
      // Show success notification
      logger.log('Task execution completed successfully')
    } else {
      // Show error notification
      logger.error('Task execution failed')
    }
  }
})

// Actions
async function handleWorkOnTask() {
  if (!workspaceStore.currentWorkspace) {
    logger.error('No workspace selected')
    return
  }

  try {
    executing.value = true
    showOutput.value = true

    await todoStore.startTaskExecution(
      props.task.id,
      workspaceStore.currentWorkspace.id,
      selectedPermissionMode.value,
      1800  // 30 min timeout
    )

    logger.log('Task execution started')
  } catch (error) {
    logger.error('Failed to start task execution:', error)
    executing.value = false
  }
}

async function handleCancelExecution() {
  if (!currentExecution.value) return

  try {
    await todoStore.cancelTaskExecution(currentExecution.value.executionId)
    logger.log('Task execution cancelled')
  } catch (error) {
    logger.error('Failed to cancel task execution:', error)
  }
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    queued: 'Queued',
    running: 'Running...',
    completed: 'Completed ✓',
    failed: 'Failed ✗',
    cancelled: 'Cancelled',
    timeout: 'Timed Out',
  }
  return statusMap[status] || status
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m ago`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
</script>

<style scoped>
.execution-section {
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-primary);
}

.execution-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.btn-execute {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: white;
  background: var(--color-success);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-execute:hover:not(:disabled) {
  background: var(--color-success-hover);
  transform: translateY(-1px);
}

.btn-execute:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: white;
  background: var(--color-danger);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
}

.execution-status {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-base);
  margin-bottom: var(--space-3);
}

.status-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-full);
  width: fit-content;
}

.status-running {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.status-completed {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-failed {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.execution-info {
  display: flex;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.info-label {
  color: var(--color-text-tertiary);
}

.info-value {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.execution-output {
  margin-top: var(--space-3);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  overflow: hidden;
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border-primary);
}

.output-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.output-content {
  max-height: 300px;
  overflow-y: auto;
  padding: var(--space-3);
  background: var(--color-bg-primary);
}

.output-content pre {
  margin: 0;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.permission-mode {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.mode-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.mode-select {
  flex: 1;
  padding: var(--space-2);
  font-size: var(--font-size-sm);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  color: var(--color-text-primary);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
```

---

## 4. Data Flow

### 4.1 Complete Execution Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER INITIATES                                                │
│    User opens task detail panel                                  │
│    User clicks "Work on Task" button                             │
│    Selects permission mode (plan/acceptEdits/bypassAll)          │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND (Vue Component)                                      │
│    TaskDetailPanel.vue: handleWorkOnTask()                       │
│    → todoStore.startTaskExecution(taskId, workspaceId, mode)    │
│    → Socket.emit('task:execution:start', request)                │
└────────────────────┬─────────────────────────────────────────────┘
                     │ WebSocket
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. BACKEND (Socket Handler)                                      │
│    socket_handlers.rs: on('task:execution:start')                │
│    → Validate request                                            │
│    → Fetch task from Microsoft Graph API                         │
│    → Fetch workspace details                                     │
│    → TaskExecutionService.start_execution(request)               │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. TASK EXECUTION SERVICE                                        │
│    TaskExecutionService::start_execution()                       │
│    → Generate execution ID                                       │
│    → Build Claude Code command                                   │
│    → Store execution in active_executions map                    │
│    → Spawn async execution task                                  │
│    → Return execution_id immediately                             │
└────────────────────┬─────────────────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
           │                   │
           ↓                   ↓
┌──────────────────┐  ┌────────────────────────────────────────────┐
│ 5a. IMMEDIATE    │  │ 5b. ASYNC EXECUTION (Background Task)     │
│     RESPONSE     │  │     TaskExecutionService::run_execution()  │
│                  │  │     → Spawn Claude Code process:           │
│ Socket.emit      │  │       bash -c "claude -p '...' ..."        │
│ ('task:          │  │     → Set status: Running                  │
│  execution:      │  │     → Capture stdout (streaming JSON)      │
│  started')       │  │     → Capture stderr (errors)              │
└──────────────────┘  │     → Broadcast output to WebSocket        │
                      │     → Monitor process with timeout         │
                      └────────────┬───────────────────────────────┘
                                   │
                      ┌────────────┴───────────┐
                      │                        │
                      ↓                        ↓
         ┌─────────────────────┐  ┌──────────────────────────┐
         │ 6a. STREAMING       │  │ 6b. PROCESS COMPLETION   │
         │     OUTPUT          │  │                          │
         │                     │  │ → Parse final result     │
         │ For each line:      │  │ → Update task via        │
         │ → Parse JSON        │  │   TaskSyncService        │
         │ → Extract content   │  │ → Append results to      │
         │ → Store in buffer   │  │   task description       │
         │ → Broadcast via     │  │ → Broadcast status       │
         │   Socket.emit       │  │   update                 │
         │   ('task:execution: │  │ → Cleanup execution      │
         │    output')         │  │                          │
         └─────────────────────┘  └──────────┬───────────────┘
                                             │
                                             ↓
                        ┌────────────────────────────────────────┐
                        │ 7. MICROSOFT GRAPH API UPDATE          │
                        │    TaskSyncService::append_to_task_    │
                        │    description()                        │
                        │    → PATCH /tasks/{taskId}              │
                        │    → Update body.content field          │
                        │    → Append execution summary           │
                        └────────────┬───────────────────────────┘
                                     │
                                     ↓
                        ┌────────────────────────────────────────┐
                        │ 8. FRONTEND UPDATE                     │
                        │    Socket.on('task:execution:status')  │
                        │    → Update UI (status badge)          │
                        │    → Show completion notification      │
                        │    → Refresh task data                 │
                        │    → Display updated description       │
                        └────────────────────────────────────────┘
```

### 4.2 Output Streaming Details

**Claude Code Streaming JSON Format:**

When executed with `--output-format stream-json --include-partial-messages`, Claude Code emits newline-delimited JSON:

```jsonl
{"type":"message_start","session_id":"abc-123"}
{"type":"content_block","content":"Analyzing codebase..."}
{"type":"content_block","content":"Found 3 TypeScript files"}
{"type":"tool_use","tool":"Edit","file":"auth.ts"}
{"type":"content_block","content":"Fixed type error"}
{"type":"result","subtype":"success","result":"All errors fixed","total_cost_usd":0.045,"duration_ms":4500}
```

**Parsing Strategy:**
1. Read stdout line-by-line
2. Parse each line as JSON
3. Extract `content` field for output text
4. Extract `session_id` for tracking
5. Look for `type: "result"` for final summary
6. Accumulate all content blocks for full output

---

## 5. Implementation Status

### Backend (Rust)
- [x] TaskExecutionService (act-domain/src/task_execution_service.rs)
- [x] Task Sync Service Extensions (get_task, append_to_task_description)
- [x] Module Registration (lib.rs exports)
- [x] AppState Integration (SocketIOOutputBroadcaster)
- [x] Socket Handlers (task:execution:start/cancel/status)
- [x] Backend compiles successfully

### Frontend (Vue 3 + TypeScript)
- [x] todoStore extensions (activeExecutions, executionHistory, actions)
- [x] Socket.IO event listeners (output, status, error)
- [x] microsoftAuthService.getTask() method
- [x] socketService.getSocket() method
- [x] TaskDetailPanel.vue updates (Work on Task button, execution UI)
- [x] Frontend compiles successfully

### Testing & Next Steps
- [ ] Verify Claude Code CLI installation
- [ ] Test end-to-end execution flow
- [ ] Verify error handling

### Optional (Future)
- [ ] REST API endpoints
- [ ] Execution history persistence
- [ ] Advanced features (scheduling, workflows)

---

## 6. API Specifications

### 6.1 Socket.IO Events

#### Client → Server Events

**`task:execution:start`**
```typescript
Request: {
  taskId: string
  workspaceId: string
  permissionMode: "plan" | "acceptEdits" | "bypassAll"
  timeoutSeconds?: number
}

Response: "task:execution:started" event
```

**`task:execution:cancel`**
```typescript
Request: {
  executionId: string
}

Response: "task:execution:cancelled" event
```

**`task:execution:status`**
```typescript
Request: {
  executionId: string
}

Response: "task:execution:status" event
```

#### Server → Client Events

**`task:execution:started`**
```typescript
{
  executionId: string
  taskId: string
  status: "running"
}
```

**`task:execution:output`**
```typescript
{
  executionId: string
  output: string  // Single line of output
}
```

**`task:execution:status`**
```typescript
{
  executionId: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "timeout"
  exitCode?: number
  durationMs?: number
}
```

**`task:execution:error`**
```typescript
{
  error: string
}
```

### 6.2 REST API Endpoints (Optional)

**Start Execution**
```http
POST /api/v1/tasks/:taskId/execute
Content-Type: application/json

{
  "workspaceId": "workspace-123",
  "permissionMode": "acceptEdits",
  "timeoutSeconds": 1800
}

Response:
{
  "executionId": "exec-abc-123",
  "taskId": "task-456",
  "status": "running"
}
```

**Cancel Execution**
```http
POST /api/v1/tasks/:taskId/executions/:executionId/cancel

Response:
{
  "executionId": "exec-abc-123",
  "status": "cancelled"
}
```

**Get Execution Status**
```http
GET /api/v1/tasks/:taskId/executions/:executionId/status

Response:
{
  "executionId": "exec-abc-123",
  "taskId": "task-456",
  "status": "completed",
  "exitCode": 0,
  "durationMs": 4500,
  "costUsd": 0.045
}
```

**Get Execution Output**
```http
GET /api/v1/tasks/:taskId/executions/:executionId/output

Response:
{
  "executionId": "exec-abc-123",
  "output": "Full output text...",
  "lines": 125
}
```

---

## 7. Security & Error Handling

### 7.1 Security Considerations

#### 7.1.1 Command Injection Prevention

**Risk:** User-provided task descriptions could contain malicious commands.

**Mitigations:**
1. **Escape shell arguments:** Use proper shell escaping for single quotes
   ```rust
   let escaped_prompt = prompt.replace("'", "'\\''");
   ```

2. **Validate workspace paths:** Ensure paths exist and are within allowed directories
   ```rust
   fn validate_workspace_path(path: &str) -> Result<(), Error> {
       let canonical = std::fs::canonicalize(path)?;
       if !canonical.starts_with(ALLOWED_BASE_PATH) {
           return Err(Error::InvalidPath);
       }
       Ok(())
   }
   ```

3. **Limit Claude Code tools:** Use `--allowedTools` flag to restrict capabilities
   ```bash
   claude -p "..." --allowedTools "Read Edit"  # No Bash execution
   ```

#### 7.1.2 Resource Limits

**Implement resource constraints:**

```rust
// In TaskExecutionService
const MAX_CONCURRENT_EXECUTIONS: usize = 5;
const MAX_OUTPUT_SIZE_BYTES: usize = 10 * 1024 * 1024;  // 10MB
const DEFAULT_TIMEOUT_SECONDS: u64 = 1800;  // 30 minutes
const MAX_TIMEOUT_SECONDS: u64 = 3600;  // 1 hour

// Check concurrent executions
let active_count = self.active_executions.read().await.len();
if active_count >= MAX_CONCURRENT_EXECUTIONS {
    return Err(TaskExecutionError::TooManyExecutions);
}

// Enforce output size limits
if output_buffer.len() > MAX_OUTPUT_SIZE_BYTES {
    warn!("Output size limit exceeded, truncating");
    output_buffer.truncate(MAX_OUTPUT_SIZE_BYTES);
}
```

#### 7.1.3 Workspace Isolation

**Ensure executions only access intended workspaces:**

```rust
// Set working directory explicitly
Command::new("bash")
    .arg("-c")
    .arg(&command)
    .current_dir(&validated_workspace_path)  // Chroot-like behavior
    .env_clear()  // Clear inherited environment
    .env("HOME", &workspace_home)
    .spawn()?;
```

#### 7.1.4 Permission Mode Safeguards

**Default to safest mode:**

```typescript
// Frontend - default to "plan" mode for safety
const selectedPermissionMode = ref<PermissionMode>('plan')

// Show warning for dangerous modes
function showPermissionWarning(mode: PermissionMode) {
  if (mode === 'bypassAll') {
    return confirm('⚠️ Bypass All mode will execute without confirmation. Continue?')
  }
  return true
}
```

**Backend validation:**

```rust
// Reject bypassAll in production unless explicitly configured
if request.permission_mode == ExecutionPermissionMode::BypassAll {
    if !config.allow_bypass_permissions {
        return Err(TaskExecutionError::PermissionDenied);
    }
}
```

### 7.2 Error Handling

#### 7.2.1 Error Types & Recovery

| Error Scenario | Detection | Recovery Strategy | User Feedback |
|----------------|-----------|-------------------|---------------|
| Claude Code not installed | Process spawn fails | Show install instructions | "Claude Code not found. Please install." |
| Invalid workspace | Path validation fails | Prompt to select workspace | "Invalid workspace path." |
| Timeout | `tokio::time::timeout` expires | Kill process, save partial output | "Execution timed out after 30m." |
| Claude Code crash | Exit code != 0 | Save error output | "Execution failed. See output for details." |
| Network failure (Graph API) | HTTP error | Retry with backoff | "Failed to update task. Retrying..." |
| Concurrent execution | Active execution exists | Prevent start | "Task is already running." |
| Output parse failure | JSON parse error | Use raw output | "Warning: Could not parse results." |

#### 7.2.2 Error Logging

**Comprehensive logging strategy:**

```rust
// Structured logging with context
error!(
    execution_id = %execution_id,
    task_id = %task_id,
    error = ?err,
    "Failed to execute task"
);

// Audit logging for security events
info!(
    user_id = %user_id,
    task_id = %task_id,
    permission_mode = ?permission_mode,
    "Task execution started"
);
```

#### 7.2.3 User-Facing Error Messages

**Clear, actionable error messages:**

```rust
fn format_user_error(error: &TaskExecutionError) -> String {
    match error {
        TaskExecutionError::ClaudeNotFound => {
            "Claude Code is not installed. Install with: npm install -g @anthropic-ai/claude-code".to_string()
        }
        TaskExecutionError::WorkspaceNotFound(path) => {
            format!("Workspace not found: {}. Please verify the path exists.", path)
        }
        TaskExecutionError::Timeout => {
            "Execution timed out. Consider simplifying the task or increasing timeout.".to_string()
        }
        TaskExecutionError::PermissionDenied => {
            "Permission denied. Check your Claude Code configuration.".to_string()
        }
        _ => format!("Execution failed: {}", error)
    }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

#### Backend (Rust)

**TaskExecutionService Tests:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_build_claude_command() {
        let service = create_test_service();
        let request = create_test_request();

        let command = service.build_claude_command(&request).unwrap();

        assert!(command.contains("claude -p"));
        assert!(command.contains("--output-format stream-json"));
        assert!(command.contains("--permission-mode acceptEdits"));
    }

    #[tokio::test]
    async fn test_parse_claude_output() {
        let service = create_test_service();
        let mock_output = r#"{"type":"result","subtype":"success","result":"Fixed","total_cost_usd":0.045}"#;

        let result = service.parse_claude_output(mock_output).unwrap();

        assert!(result.success);
        assert_eq!(result.result, "Fixed");
        assert_eq!(result.cost_usd, 0.045);
    }

    #[tokio::test]
    async fn test_concurrent_execution_prevention() {
        let service = create_test_service();
        let request = create_test_request();

        let exec_id1 = service.start_execution(request.clone()).await.unwrap();
        let exec_id2 = service.start_execution(request.clone()).await;

        assert!(exec_id2.is_err());
        assert!(matches!(exec_id2, Err(TaskExecutionError::AlreadyRunning)));
    }

    #[tokio::test]
    async fn test_execution_timeout() {
        let service = create_test_service();
        let mut request = create_test_request();
        request.timeout_seconds = Some(1);  // 1 second timeout

        let exec_id = service.start_execution(request).await.unwrap();

        tokio::time::sleep(Duration::from_secs(2)).await;

        let status = service.get_execution_status(&exec_id).await.unwrap();
        assert!(matches!(status, TaskExecutionStatus::TimedOut));
    }
}
```

#### Frontend (TypeScript)

**todoStore Tests:**

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useTodoStore } from '@/stores/todo'
import { mockSocket } from '@/test-utils/mock-socket'

describe('todoStore - Task Execution', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts task execution and updates state', async () => {
    const store = useTodoStore()

    mockSocket.on('task:execution:start', (data) => {
      mockSocket.emit('task:execution:started', {
        executionId: 'exec-123',
        taskId: data.taskId,
        status: 'running'
      })
    })

    const executionId = await store.startTaskExecution(
      'task-1',
      'workspace-1',
      'acceptEdits'
    )

    expect(executionId).toBe('exec-123')
    expect(store.isTaskExecuting('task-1')).toBe(true)
  })

  it('handles execution output events', async () => {
    const store = useTodoStore()

    // Start execution
    await store.startTaskExecution('task-1', 'workspace-1', 'plan')

    // Simulate output events
    mockSocket.emit('task:execution:output', {
      executionId: 'exec-123',
      output: 'Line 1\n'
    })
    mockSocket.emit('task:execution:output', {
      executionId: 'exec-123',
      output: 'Line 2\n'
    })

    const execution = store.getExecutionByTaskId('task-1')
    expect(execution?.output).toEqual(['Line 1\n', 'Line 2\n'])
  })

  it('handles execution completion', async () => {
    const store = useTodoStore()

    await store.startTaskExecution('task-1', 'workspace-1', 'acceptEdits')

    mockSocket.emit('task:execution:status', {
      executionId: 'exec-123',
      status: 'completed',
      exitCode: 0,
      durationMs: 5000
    })

    expect(store.isTaskExecuting('task-1')).toBe(false)
    expect(store.executionHistory).toHaveLength(1)
    expect(store.executionHistory[0].status).toBe('completed')
  })
})
```

### 8.2 Integration Tests

**End-to-End Flow Test:**

```rust
#[tokio::test]
async fn test_full_execution_flow() {
    // Setup
    let app_state = create_test_app_state().await;
    let io = setup_test_socket_io();

    // Create test task
    let task = create_test_task().await;

    // Emit start event
    io.emit_to_client("task:execution:start", json!({
        "taskId": task.id,
        "workspaceId": "workspace-1",
        "permissionMode": "plan",
    }));

    // Verify started event
    let started_event = io.wait_for_event("task:execution:started").await;
    assert_eq!(started_event["taskId"], task.id);

    // Wait for completion
    let status_event = io.wait_for_event_with_timeout(
        "task:execution:status",
        Duration::from_secs(30)
    ).await;

    assert_eq!(status_event["status"], "completed");

    // Verify task was updated
    let updated_task = fetch_task(&task.id).await;
    assert!(updated_task.body_content.contains("Execution Results"));
}
```

### 8.3 Manual Testing Checklist

**Pre-Release Testing:**

- the user will perform all the testing needed. we only have to make sure typechecks all pass with no errors and no warnings.

---

## Appendix A: Claude Code CLI Reference

### Installation
```bash
npm install -g @anthropic-ai/claude-code
```

### Basic Usage
```bash
# Interactive mode
claude "implement feature X"

# Non-interactive (automation)
claude -p "query" --output-format json

# Continue session
claude -c -p "follow-up"
```

### Key Flags for Automation

| Flag | Description | Example |
|------|-------------|---------|
| `-p, --print` | Non-interactive mode | `claude -p "query"` |
| `--output-format` | Output format (text/json/stream-json) | `--output-format json` |
| `--include-partial-messages` | Include partial chunks (stream-json) | With `--output-format stream-json` |
| `--permission-mode` | Permission level | `--permission-mode acceptEdits` |
| `--dangerously-skip-permissions` | Skip all prompts | For sandboxes only |
| `--add-dir` | Set working directory | `--add-dir /workspace/project` |
| `--session-id` | Specific session ID | `--session-id <uuid>` |
| `--allowedTools` | Restrict tools | `--allowedTools "Read Edit"` |
| `--model` | Specify model | `--model opus` |
| `--fallback-model` | Fallback model | `--fallback-model haiku` |

### Permission Modes

1. **`plan`** - Read-only analysis (safest)
   - No file modifications
   - No command execution
   - Good for code review, analysis

2. **`acceptEdits`** - Auto-accept file changes (recommended)
   - Files are modified automatically
   - No bash commands without confirmation
   - Good for implementation tasks

3. **`bypassAll`** (via `--dangerously-skip-permissions`) - Full automation (dangerous)
   - All operations proceed without confirmation
   - Use only in sandboxed environments
   - Required for background automation

### Output Format Examples

**Text (default):**
```bash
$ claude -p "What is 2+2?"
4
```

**JSON:**
```bash
$ claude -p "What is 2+2?" --output-format json
{"type":"result","subtype":"success","result":"4","session_id":"...","total_cost_usd":0.045}
```

**Streaming JSON:**
```bash
$ claude -p "Implement feature" --output-format stream-json --include-partial-messages
{"type":"message_start"}
{"type":"content_block","content":"Analyzing requirements..."}
{"type":"content_block","content":"Creating file..."}
{"type":"result","subtype":"success","result":"Feature implemented"}
```

---

## Appendix B: Microsoft Graph API Reference

### Update Task Description

**Endpoint:**
```http
PATCH https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks/{taskId}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "body": {
    "contentType": "text",
    "content": "Updated task description with execution results..."
  }
}
```

**Response:**
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users('...')/todo/lists('...')/tasks/$entity",
  "id": "task-id",
  "title": "Task title",
  "body": {
    "contentType": "text",
    "content": "Updated content"
  },
  "status": "notStarted"
}
```

---

## Appendix C: Troubleshooting Guide

### Common Issues & Solutions

**Issue: "Claude Code not found"**
- **Cause:** Claude CLI not installed or not in PATH
- **Solution:** Install with `npm install -g @anthropic-ai/claude-code`
- **Verify:** Run `which claude`

**Issue: "Permission denied"**
- **Cause:** Missing API key or invalid workspace path
- **Solution:** Check environment variables, verify workspace permissions
- **Verify:** Test with `claude -p "hello" --permission-mode plan`

**Issue: "Execution times out"**
- **Cause:** Task is too complex or Claude Code is unresponsive
- **Solution:** Simplify task, increase timeout, check network
- **Verify:** Monitor Claude Code logs

**Issue: "Task description not updated"**
- **Cause:** Microsoft Graph API authentication failed
- **Solution:** Re-authenticate, check token expiry
- **Verify:** Test Graph API with curl

**Issue: "Output not streaming"**
- **Cause:** WebSocket connection lost or buffering issue
- **Solution:** Check Socket.IO connection, verify backend is emitting events
- **Verify:** Monitor browser network tab

---

## Conclusion

This implementation plan provides a complete, production-ready roadmap for integrating autonomous task execution into your AI Coding Terminal. By leveraging Claude Code's powerful CLI capabilities and your existing robust architecture, this feature will enable true background automation of development tasks.

**Key Success Factors:**
1. **Reuse existing infrastructure** (PTY, processes, WebSocket)
2. **Maintain security** (sandboxing, permission modes, validation)
3. **Ensure reliability** (error handling, timeouts, retries)
4. **Provide visibility** (live output, status updates, history)

**Timeline:** As soon as possible, but faitfully implemented completely, with zero placeholder code, always real/actual implementation.

This system will transform your task management from passive tracking to active execution, making your development workflow truly autonomous.
