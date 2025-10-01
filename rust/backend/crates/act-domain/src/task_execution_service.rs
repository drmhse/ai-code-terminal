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
    Plan,
    AcceptEdits,
    BypassAll,
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
    pub session_id: Option<String>,
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

// ===== Output Broadcaster Trait =====

#[async_trait::async_trait]
pub trait OutputBroadcaster: Send + Sync {
    async fn broadcast_output(&self, execution_id: &str, chunk: String);
    async fn broadcast_status(&self, execution_id: &str, status: TaskExecutionStatus);
}

// ===== Main Service =====

#[derive(Clone)]
pub struct TaskExecutionService {
    task_sync_service: Arc<crate::TaskSyncService>,
    active_executions: Arc<RwLock<HashMap<TaskExecutionId, TaskExecution>>>,
    output_broadcaster: Arc<dyn OutputBroadcaster>,
}

impl TaskExecutionService {
    pub fn new(
        task_sync_service: Arc<crate::TaskSyncService>,
        output_broadcaster: Arc<dyn OutputBroadcaster>,
    ) -> Self {
        Self {
            task_sync_service,
            active_executions: Arc::new(RwLock::new(HashMap::new())),
            output_broadcaster,
        }
    }

    pub async fn start_execution(
        &self,
        request: TaskExecutionRequest,
    ) -> Result<TaskExecutionId, TaskExecutionError> {
        info!("Starting execution for task: {}", request.task_id);

        // Check if task is already being executed
        {
            let executions = self.active_executions.read().await;
            if executions.values().any(|e| e.task_id == request.task_id
                && matches!(e.status, TaskExecutionStatus::Running | TaskExecutionStatus::Queued)) {
                return Err(TaskExecutionError::AlreadyRunning);
            }
        }

        let execution_id = Uuid::new_v4().to_string();
        let command = self.build_claude_command(&request)?;

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

        {
            let mut executions = self.active_executions.write().await;
            executions.insert(execution_id.clone(), execution.clone());
        }

        let service_clone = self.clone();
        let execution_id_clone = execution_id.clone();
        tokio::spawn(async move {
            if let Err(e) = service_clone.run_execution(&execution_id_clone, request).await {
                error!("Execution {} failed: {:?}", execution_id_clone, e);
            }
        });

        Ok(execution_id)
    }

    fn build_claude_command(
        &self,
        request: &TaskExecutionRequest,
    ) -> Result<String, TaskExecutionError> {
        let permission_flag = match request.permission_mode {
            ExecutionPermissionMode::Plan => "--permission-mode plan",
            ExecutionPermissionMode::AcceptEdits => "--permission-mode acceptEdits",
            ExecutionPermissionMode::BypassAll => "--dangerously-skip-permissions",
        };

        let prompt = format!(
            "Task: {}\\n\\nDescription:\\n{}",
            request.task_title,
            request.task_description
        );

        Ok(format!(
            "claude -p '{}' --output-format stream-json --include-partial-messages {} --add-dir '{}'",
            prompt.replace("'", "'\\''"),
            permission_flag,
            request.working_directory
        ))
    }

    async fn run_execution(
        &self,
        execution_id: &str,
        request: TaskExecutionRequest,
    ) -> Result<(), TaskExecutionError> {
        info!("Running execution: {}", execution_id);

        self.update_execution_status(execution_id, TaskExecutionStatus::Running).await?;

        let command = {
            let executions = self.active_executions.read().await;
            let execution = executions.get(execution_id)
                .ok_or(TaskExecutionError::ExecutionNotFound)?;
            execution.command.clone()
        };

        let mut child = Command::new("bash")
            .arg("-c")
            .arg(&command)
            .current_dir(&request.working_directory)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| TaskExecutionError::ProcessSpawnFailed(e.to_string()))?;

        let stdout = child.stdout.take()
            .ok_or(TaskExecutionError::OutputCaptureFailed)?;
        let stderr = child.stderr.take()
            .ok_or(TaskExecutionError::OutputCaptureFailed)?;

        {
            let mut executions = self.active_executions.write().await;
            if let Some(execution) = executions.get_mut(execution_id) {
                execution.child_process = Some(Arc::new(Mutex::new(child)));
            }
        }

        let execution_id_clone = execution_id.to_string();
        let service_clone = self.clone();
        let stdout_task = tokio::spawn(async move {
            service_clone.process_stdout(execution_id_clone, stdout).await;
        });

        let execution_id_clone = execution_id.to_string();
        let service_clone = self.clone();
        let stderr_task = tokio::spawn(async move {
            service_clone.process_stderr(execution_id_clone, stderr).await;
        });

        let timeout_duration = request.timeout_seconds
            .map(|s| tokio::time::Duration::from_secs(s))
            .unwrap_or(tokio::time::Duration::from_secs(1800));

        let wait_result = {
            let executions = self.active_executions.read().await;
            let execution = executions.get(execution_id)
                .ok_or(TaskExecutionError::ExecutionNotFound)?;
            let child_arc = execution.child_process.as_ref()
                .ok_or(TaskExecutionError::ProcessSpawnFailed("No child process".to_string()))?;
            let mut child = child_arc.lock().await;
            tokio::time::timeout(timeout_duration, child.wait()).await
        };

        let _ = tokio::join!(stdout_task, stderr_task);

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
                self.kill_execution(execution_id).await?;
                self.update_execution_status(
                    execution_id,
                    TaskExecutionStatus::TimedOut
                ).await?;
            }
        }

        Ok(())
    }

    async fn process_stdout(
        &self,
        execution_id: String,
        stdout: tokio::process::ChildStdout,
    ) {
        use tokio::io::{AsyncBufReadExt, BufReader};

        let mut reader = BufReader::new(stdout).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
                    {
                        let mut executions = self.active_executions.write().await;
                        if let Some(execution) = executions.get_mut(&execution_id) {
                            execution.output_buffer.write().await.push(content.to_string());
                        }
                    }

                    self.output_broadcaster.broadcast_output(&execution_id, content.to_string()).await;
                }

                if let Some(session_id) = json.get("session_id").and_then(|v| v.as_str()) {
                    let mut executions = self.active_executions.write().await;
                    if let Some(execution) = executions.get_mut(&execution_id) {
                        execution.session_id = Some(session_id.to_string());
                    }
                }
            }
        }
    }

    async fn process_stderr(
        &self,
        execution_id: String,
        stderr: tokio::process::ChildStderr,
    ) {
        use tokio::io::{AsyncBufReadExt, BufReader};

        let mut reader = BufReader::new(stderr).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            warn!("Execution {} stderr: {}", execution_id, line);

            let mut executions = self.active_executions.write().await;
            if let Some(execution) = executions.get_mut(&execution_id) {
                execution.output_buffer.write().await.push(format!("[ERROR] {}", line));
            }
        }
    }

    async fn handle_successful_completion(
        &self,
        execution_id: &str,
        exit_code: i32,
        duration_ms: u64,
    ) -> Result<(), TaskExecutionError> {
        info!("Execution {} completed successfully", execution_id);

        let output = self.get_execution_output(execution_id).await?;
        let parsed_result = self.parse_claude_output(&output)?;

        self.update_task_with_results(execution_id, &parsed_result).await?;

        self.update_execution_status(
            execution_id,
            TaskExecutionStatus::Completed {
                exit_code,
                duration_ms,
                cost_usd: parsed_result.cost_usd,
            }
        ).await?;

        self.cleanup_execution(execution_id).await?;

        Ok(())
    }

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

        self.update_task_with_error(execution_id, &output).await?;
        self.cleanup_execution(execution_id).await?;

        Ok(())
    }

    fn parse_claude_output(&self, output: &str) -> Result<ParsedClaudeResult, TaskExecutionError> {
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

        let status_emoji = if result.success { "✅" } else { "⚠️" };
        let status_text = if result.success { "Completed Successfully" } else { "Completed with Issues" };

        let results_section = format!(
            r#"

---

## {} Autonomous Execution Results
**Status:** {}
**Execution ID:** `{}`
**Completed:** {}
**Duration:** {:.2}s
**Cost:** ${:.4}

### Summary
{}

### Claude Code Session
Session ID: `{}`
"#,
            status_emoji,
            status_text,
            execution_id,
            execution.start_time.format("%Y-%m-%d %H:%M:%S UTC"),
            result.duration_ms as f64 / 1000.0,
            result.cost_usd,
            result.result,
            result.session_id.as_deref().unwrap_or("N/A")
        );

        self.task_sync_service
            .append_to_task_description(&execution.workspace_id, &execution.task_id, &results_section)
            .await
            .map_err(|e| TaskExecutionError::TaskUpdateFailed(e.to_string()))?;

        info!("Updated task {} with execution results", execution.task_id);
        Ok(())
    }

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

## Execution Failed
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
            .append_to_task_description(&execution.workspace_id, &execution.task_id, &error_section)
            .await
            .map_err(|e| TaskExecutionError::TaskUpdateFailed(e.to_string()))?;

        Ok(())
    }

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

    async fn kill_execution(&self, execution_id: &str) -> Result<(), TaskExecutionError> {
        let executions = self.active_executions.read().await;
        if let Some(execution) = executions.get(execution_id) {
            if let Some(child_arc) = &execution.child_process {
                let mut child = child_arc.lock().await;
                let _ = child.kill().await;
            }
        }
        Ok(())
    }

    pub async fn get_execution_status(
        &self,
        execution_id: &str,
    ) -> Option<TaskExecutionStatus> {
        let executions = self.active_executions.read().await;
        executions.get(execution_id).map(|e| e.status.clone())
    }

    async fn get_execution_output(&self, execution_id: &str) -> Result<String, TaskExecutionError> {
        let executions = self.active_executions.read().await;
        let execution = executions.get(execution_id)
            .ok_or(TaskExecutionError::ExecutionNotFound)?;

        let buffer = execution.output_buffer.read().await;
        Ok(buffer.join("\n"))
    }

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

        self.output_broadcaster.broadcast_status(execution_id, status).await;

        Ok(())
    }

    async fn calculate_duration(&self, execution_id: &str) -> u64 {
        let executions = self.active_executions.read().await;
        if let Some(execution) = executions.get(execution_id) {
            let end = execution.end_time.unwrap_or_else(Utc::now);
            (end - execution.start_time).num_milliseconds().max(0) as u64
        } else {
            0
        }
    }

    async fn cleanup_execution(&self, execution_id: &str) -> Result<(), TaskExecutionError> {
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