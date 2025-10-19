use serde::{Deserialize, Serialize};
use socketioxide::{
    extract::{Data, SocketRef},
    SocketIo,
};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use crate::AppState;
use sqlx;
use std::collections::HashMap;
use tokio::sync::RwLock;

// Request/Response types for socket communication
#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticateRequest {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalCreateRequest {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(rename = "paneId")]
    pub pane_id: Option<String>,
    pub shell: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalDataRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalCommandRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub command: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalResizeRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionListRequest {
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionUpdatePaneRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "paneId")]
    pub pane_id: String,
}

// Event types for socket emission
#[derive(Debug, Serialize)]
pub struct AuthenticatedEvent {
    pub user_id: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct SystemStatsEvent {
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_total: u64,
    pub disk_usage: u64,
    pub disk_total: u64,
    pub uptime: u64,
    pub load_average: f64,
    pub processes: u32,
    pub active_sessions: u32,
    pub timestamp: i64,
}

#[derive(Debug, Serialize)]
pub struct TerminalOutputEvent {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub output: String,
}

#[derive(Debug, Serialize)]
pub struct SessionCreatedEvent {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub success: bool,
}

#[derive(Debug, Serialize)]
pub struct ErrorEvent {
    pub error: String,
}

// WebSocket output handler that implements OutputEventHandler for SessionService integration
pub struct WebSocketOutputHandler {
    io: SocketIo,
}

impl WebSocketOutputHandler {
    pub fn new(io: SocketIo) -> Self {
        Self { io }
    }
}

impl act_domain::OutputEventHandler for WebSocketOutputHandler {
    fn handle_output(&self, _user_id: &str, event: act_domain::TerminalOutputEvent) {
        // Emit to all sockets for this user - multi-device support
        self.io
            .emit(
                "terminal:output",
                TerminalOutputEvent {
                    session_id: event.session_id,
                    output: event.output,
                },
            )
            .ok();
    }
}

// Stats subscription manager
pub struct StatsSubscription {
    socket: SocketRef,
    is_active: bool,
    task_handle: Option<tokio::task::JoinHandle<()>>,
}

impl StatsSubscription {
    pub fn new(socket: SocketRef) -> Self {
        Self {
            socket,
            is_active: false,
            task_handle: None,
        }
    }

    pub async fn start(
        &mut self,
        state: Arc<AppState>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.is_active {
            return Ok(());
        }

        let socket = self.socket.clone();
        let state_clone = state.clone();

        let task_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));

            loop {
                interval.tick().await;

                if let Err(e) = Self::collect_and_send_stats(&socket, &state_clone).await {
                    error!("Failed to send system stats: {}", e);
                    break;
                }
            }
        });

        self.task_handle = Some(task_handle);
        self.is_active = true;
        Ok(())
    }

    pub async fn stop(&mut self) {
        if !self.is_active {
            return;
        }

        if let Some(handle) = self.task_handle.take() {
            handle.abort();
        }

        self.is_active = false;
    }

    async fn collect_and_send_stats(
        socket: &SocketRef,
        state: &Arc<AppState>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Get system metrics using the system service
        let metrics = state
            .domain_services
            .system_service
            .get_current_system_metrics()
            .await?;

        // Get actual active session count from session service
        let active_sessions = state
            .domain_services
            .session_service
            .count_all_active_sessions()
            .await
            .unwrap_or(0) as u32;

        let stats_event = SystemStatsEvent {
            cpu_usage: metrics.cpu_usage_percent,
            memory_usage: metrics.memory_used_bytes,
            memory_total: metrics.memory_total_bytes,
            disk_usage: metrics.disk_used_bytes,
            disk_total: metrics.disk_total_bytes,
            uptime: metrics.uptime_seconds,
            load_average: metrics.load_average,
            processes: metrics.process_count,
            active_sessions,
            timestamp: chrono::Utc::now().timestamp(),
        };

        // FIX: Handle potential socket disconnection errors gracefully
        socket.emit("stats:data", stats_event).map_err(
            |e| -> Box<dyn std::error::Error + Send + Sync> {
                format!("Failed to emit stats data: {}", e).into()
            },
        )?;
        Ok(())
    }
}

pub fn setup_socket_handlers(io: SocketIo, state: Arc<AppState>) {
    let stats_subscriptions = Arc::new(RwLock::new(HashMap::<String, StatsSubscription>::new()));

    // Register WebSocket output handler with SessionService for terminal output broadcasting
    let websocket_handler = Arc::new(WebSocketOutputHandler::new(io.clone()));
    tokio::spawn({
        let session_service = state.domain_services.session_service.clone();
        async move {
            session_service.add_output_handler(websocket_handler).await;
        }
    });

    io.ns("/", move |socket: SocketRef| {
        let state = state.clone();
        let stats_subs = stats_subscriptions.clone();
        info!("New socket connection: {}", socket.id);

        // Authentication handler - validates SSO JWT tokens
        socket.on("authenticate", {
            let state = state.clone();
            move |socket: SocketRef, Data::<AuthenticateRequest>(data)| {
                let state = state.clone();
                async move {
                    match authenticate_user_with_sso(&state, &data.token).await {
                        Ok((user_id, email)) => {
                            info!("User {} authenticated via socket with SSO", user_id);
                            // Store user_id in socket extensions for future use
                            socket.extensions.insert(user_id.clone());
                            socket.emit("authenticated", AuthenticatedEvent {
                                user_id: user_id.clone(),
                                username: email, // Use email as username for display
                            }).ok();
                        }
                        Err(err) => {
                            error!("Socket SSO authentication failed: {}", err);
                            socket.emit("auth_error", ErrorEvent {
                                error: format!("Authentication failed: {}", err),
                            }).ok();
                        }
                    }
                }
            }
        });

        // Create terminal session handler - NEW MULTI-DEVICE PTY SHARING LOGIC
        socket.on("terminal:create", {
            let state = state.clone();
            move |socket: SocketRef, Data::<TerminalCreateRequest>(data)| {
                let state = state.clone();
                let _connection_id = socket.id.to_string();
                async move {
                    info!("MULTI-DEVICE: Terminal create request: workspace_id={}, session_id={:?}, pane_id={:?}", data.workspace_id, data.session_id, data.pane_id);

                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Ok(user_id) => user_id,
                        Err(err) => {
                            error!("Terminal create request from unauthenticated socket: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Authentication required: {}", err),
                            }).ok();
                            return;
                        }
                    };

                    // Generate session ID if not provided
                    let session_id = data.session_id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

                    // Get workspace path for PTY working directory
                    let workspace_path = match state.domain_services.workspace_service.get_workspace(&user_id, &data.workspace_id).await {
                        Ok(workspace) => {
                            info!("Using workspace path: {}", workspace.local_path);
                            Some(workspace.local_path)
                        }
                        Err(e) => {
                            warn!("Failed to get workspace {}: {}, using default", data.workspace_id, e);
                            None
                        }
                    };

                    // CORE MULTI-DEVICE LOGIC: Get or create PTY session with pane association
                    match state.domain_services.session_service.get_or_create_pty_session(&user_id, &session_id, &data.workspace_id, workspace_path, data.pane_id.clone()).await {
                        Ok(is_new_session) => {
                            if is_new_session {
                                info!("🆕 MULTI-DEVICE: Created NEW PTY session {} for user {}", session_id, user_id);
                            } else {
                                info!("🔗 MULTI-DEVICE: Connecting to EXISTING PTY session {} for user {}", session_id, user_id);
                            }

                            // WebSocket broadcasting is handled automatically by the session service output handlers
                            // The SessionService's pty_output_broadcaster already handles PTY output forwarding

                            // Get session info (PID) for frontend
                            let pid = match state.pty_service.get_session_info(&session_id).await {
                                Ok(info) => info.pid.unwrap_or(0),
                                Err(_) => 0,
                            };

                            // Send success response to frontend
                            socket.emit("terminal:created", serde_json::json!({
                                "sessionId": session_id,
                                "pid": pid,
                                "multiDevice": true,
                                "isNewSession": is_new_session
                            })).ok();

                            info!("MULTI-DEVICE: Terminal session {} ready for user {} (pid: {})", session_id, user_id, pid);
                        }
                        Err(err) => {
                            error!("🚨 MULTI-DEVICE: Failed to create/connect to PTY session: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Failed to create terminal session: {}", err),
                            }).ok();
                        }
                    }
                }
            }
        });

        // Terminal input handler - NEW MULTI-DEVICE INPUT ROUTING
        socket.on("terminal:data", {
            let state = state.clone();
            move |socket: SocketRef, Data::<TerminalDataRequest>(data)| {
                let state = state.clone();
                async move {
                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Ok(user_id) => user_id,
                        Err(err) => {
                            error!("Terminal data request from unauthenticated socket: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Authentication required: {}", err),
                            }).ok();
                            return;
                        }
                    };

                    debug!("MULTI-DEVICE: Input from user {} to session {}: {:?}", user_id, data.session_id, data.data);

                    // Check if PTY session exists and send input
                    match state.domain_services.session_service.has_pty_session(&user_id, &data.session_id).await {
                        Ok(true) => {
                            // Send input directly to PTY service
                            match state.pty_service.send_input(&data.session_id, data.data.as_bytes()).await {
                                Ok(_) => {
                                    debug!("MULTI-DEVICE: Input sent to PTY session {}", data.session_id);
                                }
                                Err(err) => {
                                    error!("🚨 MULTI-DEVICE: Failed to write to PTY session {}: {}", data.session_id, err);
                                    socket.emit("terminal:error", ErrorEvent {
                                        error: format!("Failed to write to session: {}", err),
                                    }).ok();
                                }
                            }
                        }
                        Ok(false) => {
                            error!("🚨 MULTI-DEVICE: PTY session {} not found for user {}", data.session_id, user_id);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Session {} not found", data.session_id),
                            }).ok();
                        }
                        Err(err) => {
                            error!("🚨 MULTI-DEVICE: Failed to check PTY session {}: {}", data.session_id, err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Failed to access session: {}", err),
                            }).ok();
                        }
                    }
                }
            }
        });

        // Terminal command handler (for persistent command history)
        socket.on("terminal:command", {
            let state = state.clone();
            move |socket: SocketRef, Data::<TerminalCommandRequest>(data)| {
                let _state = state.clone();
                async move {
                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Ok(user_id) => user_id,
                        Err(err) => {
                            error!("Terminal command request from unauthenticated socket: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Authentication required: {}", err),
                            }).ok();
                            return;
                        }
                    };

                    info!("Terminal command executed by user {}: session={}, command='{}'", user_id, data.session_id, data.command);

                    // Command history is handled by the shell itself through the PTY
                    socket.emit("terminal:command:ack", serde_json::json!({
                        "sessionId": data.session_id,
                        "command": data.command,
                        "success": true
                    })).ok();
                }
            }
        });

        // Terminal resize handler
        socket.on("terminal:resize", {
            let state = state.clone();
            move |socket: SocketRef, Data::<TerminalResizeRequest>(data)| {
                let state = state.clone();
                async move {
                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Ok(user_id) => user_id,
                        Err(err) => {
                            error!("Terminal resize request from unauthenticated socket: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Authentication required: {}", err),
                            }).ok();
                            return;
                        }
                    };

                    match state.domain_services.session_service.resize_session(&user_id, &data.session_id, data.cols, data.rows).await {
                        Ok(_) => {
                            debug!("Resized session {} to {}x{}", data.session_id, data.cols, data.rows);
                        }
                        Err(err) => {
                            error!("Failed to resize session {}: {}", data.session_id, err);
                            socket.emit("terminal-error", ErrorEvent {
                                error: format!("Failed to resize session: {}", err),
                            }).ok();
                        }
                    }
                }
            }
        });

        // Get workspace sessions handler
        socket.on("workspace:sessions", {
            let state = state.clone();
            move |socket: SocketRef, Data::<SessionListRequest>(data)| {
                let state = state.clone();
                async move {
                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Ok(user_id) => user_id,
                        Err(err) => {
                            error!("Session list request from unauthenticated socket: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Authentication required: {}", err),
                            }).ok();
                            return;
                        }
                    };

                    match state.domain_services.session_service.list_active_sessions(&user_id).await {
                        Ok(sessions) => {
                            let workspace_sessions: Vec<_> = sessions
                                .into_iter()
                                .filter(|s| {
                                    if let Some(ref workspace_id) = data.workspace_id {
                                        s.workspace_id == *workspace_id
                                    } else {
                                        true
                                    }
                                })
                                .collect();

                            socket.emit("workspace-sessions", serde_json::json!({
                                "workspaceId": data.workspace_id,
                                "sessions": workspace_sessions
                            })).ok();
                        }
                        Err(err) => {
                            error!("Failed to get workspace sessions: {}", err);
                            socket.emit("terminal-error", ErrorEvent {
                                error: format!("Failed to get sessions: {}", err),
                            }).ok();
                        }
                    }
                }
            }
        });


        // Session termination handler
        socket.on("terminal:terminate", {
            let state = state.clone();
            move |socket: SocketRef, Data::<TerminalDataRequest>(data)| {
                let state = state.clone();
                async move {
                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Ok(user_id) => user_id,
                        Err(err) => {
                            error!("Session termination request from unauthenticated socket: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Authentication required: {}", err),
                            }).ok();
                            return;
                        }
                    };

                    match state.domain_services.session_service.terminate_session(&user_id, &data.session_id).await {
                        Ok(_) => {
                            info!("Terminated session: {}", data.session_id);
                            socket.emit("terminal:terminated", serde_json::json!({
                                "sessionId": data.session_id,
                                "success": true
                            })).ok();
                        }
                        Err(err) => {
                            error!("Failed to terminate session: {}", err);
                            socket.emit("terminal-error", ErrorEvent {
                                error: format!("Failed to terminate session: {}", err),
                            }).ok();
                        }
                    }
                }
            }
        });

        // Session pane association update handler
        socket.on("session:update-pane", {
            let state = state.clone();
            move |socket: SocketRef, Data::<SessionUpdatePaneRequest>(data)| {
                let state = state.clone();
                async move {
                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Ok(user_id) => user_id,
                        Err(err) => {
                            error!("Session pane update request from unauthenticated socket: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Authentication required: {}", err),
                            }).ok();
                            return;
                        }
                    };

                    match state.domain_services.session_service.update_session_pane_association(&user_id, &data.session_id, data.pane_id.clone()).await {
                        Ok(_) => {
                            info!("Updated pane association for session {} to pane {}", data.session_id, data.pane_id);
                            socket.emit("session:pane-updated", serde_json::json!({
                                "sessionId": data.session_id,
                                "paneId": data.pane_id,
                                "success": true
                            })).ok();
                        }
                        Err(err) => {
                            error!("Failed to update session pane association: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Failed to update session pane association: {}", err),
                            }).ok();
                        }
                    }
                }
            }
        });

        // Stats subscription handler
        socket.on("stats:subscribe", {
            let state = state.clone();
            let stats_subs = stats_subs.clone();
            move |socket: SocketRef| {
                let state = state.clone();
                let subs = stats_subs.clone();
                async move {
                    let socket_id = socket.id.to_string();

                    let mut subscriptions = subs.write().await;
                    let mut subscription = StatsSubscription::new(socket.clone());

                    match subscription.start(state.clone()).await {
                        Ok(_) => {
                            subscriptions.insert(socket_id, subscription);
                            info!("Started stats subscription for socket {}", socket.id);
                            socket.emit("stats:subscribed", serde_json::json!({
                                "success": true
                            })).ok();
                        }
                        Err(e) => {
                            error!("Failed to start stats subscription: {}", e);
                            socket.emit("stats:error", ErrorEvent {
                                error: format!("Failed to start subscription: {}", e),
                            }).ok();
                        }
                    }
                }
            }
        });

        // Stats unsubscription handler
        socket.on("stats:unsubscribe", {
            let stats_subs = stats_subs.clone();
            move |socket: SocketRef| {
                let subs = stats_subs.clone();
                async move {
                    let socket_id = socket.id.to_string();

                    let mut subscriptions = subs.write().await;
                    if let Some(mut subscription) = subscriptions.remove(&socket_id) {
                        subscription.stop().await;
                        info!("Stopped stats subscription for socket {}", socket.id);
                    }

                    socket.emit("stats:unsubscribed", serde_json::json!({
                        "success": true
                    })).ok();
                }
            }
        });

        // Task execution handlers
        socket.on("task:execution:start", {
            let state = state.clone();
            move |socket: SocketRef, Data::<StartTaskExecutionRequest>(req)| {
                let state = state.clone();

                async move {
                    info!("Received task:execution:start for task {}", req.task_id);

                    // Get authenticated user ID
                    let user_id = match get_authenticated_user_id(&socket) {
                        Ok(user_id) => user_id,
                        Err(e) => {
                            error!("Authentication required for task execution: {}", e);
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: "Authentication required".to_string(),
                            });
                            return;
                        }
                    };

                    let task_execution_service_guard = state.task_execution_service.read().await;
                    let task_execution_service = match task_execution_service_guard.as_ref() {
                        Some(service) => service,
                        None => {
                            error!("TaskExecutionService not initialized");
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: "Task execution service not available".to_string(),
                            });
                            return;
                        }
                    };

                    // Get task details from TaskSyncService with authenticated user ID
                    let task = match state.domain_services.task_sync_service
                        .get_task(&user_id, &req.workspace_id, &req.task_id).await {
                        Ok(Some(task)) => task,
                        Ok(None) => {
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: "Task not found".to_string(),
                            });
                            return;
                        }
                        Err(e) => {
                            error!("Failed to get task: {:?}", e);
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: format!("Failed to get task: {}", e),
                            });
                            return;
                        }
                    };

                    // Get workspace details
                    // user_id already obtained above (line 644)

                    let workspace = match state.domain_services.workspace_service
                        .get_workspace(&user_id, &req.workspace_id).await {
                        Ok(workspace) => workspace,
                        Err(e) => {
                            error!("Failed to get workspace: {:?}", e);
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: format!("Workspace not found: {}", e),
                            });
                            return;
                        }
                    };

                    // Parse permission mode
                    let permission_mode = match req.permission_mode.as_str() {
                        "plan" => act_domain::ExecutionPermissionMode::Plan,
                        "acceptEdits" => act_domain::ExecutionPermissionMode::AcceptEdits,
                        "bypassAll" => act_domain::ExecutionPermissionMode::BypassAll,
                        _ => act_domain::ExecutionPermissionMode::Plan,
                    };

                    // Create execution request
                    let exec_request = act_domain::TaskExecutionRequest {
                        user_id: user_id.clone(),
                        task_id: req.task_id.clone(),
                        workspace_id: req.workspace_id.clone(),
                        task_title: task.title,
                        task_description: task.body.map(|b| b.content).unwrap_or_default(),
                        working_directory: workspace.local_path,
                        permission_mode,
                        timeout_seconds: req.timeout_seconds,
                    };

                    // Start execution
                    match task_execution_service.start_execution(exec_request).await {
                        Ok(execution_id) => {
                            info!("Started execution: {}", execution_id);
                            let _ = socket.emit("task:execution:started", TaskExecutionStartedEvent {
                                execution_id: execution_id.clone(),
                                task_id: req.task_id,
                                status: "running".to_string(),
                            });
                        }
                        Err(e) => {
                            error!("Failed to start execution: {:?}", e);
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: format!("Failed to start execution: {}", e),
                            });
                        }
                    }
                }
            }
        });

        socket.on("task:execution:cancel", {
            let state = state.clone();
            move |socket: SocketRef, Data::<CancelTaskExecutionRequest>(req)| {
                let state = state.clone();

                async move {
                    info!("Received task:execution:cancel for execution {}", req.execution_id);

                    let task_execution_service_guard = state.task_execution_service.read().await;
                    let task_execution_service = match task_execution_service_guard.as_ref() {
                        Some(service) => service,
                        None => {
                            error!("TaskExecutionService not initialized");
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: "Task execution service not available".to_string(),
                            });
                            return;
                        }
                    };

                    match task_execution_service.cancel_execution(&req.execution_id).await {
                        Ok(_) => {
                            info!("Cancelled execution: {}", req.execution_id);
                            let _ = socket.emit("task:execution:cancelled", serde_json::json!({
                                "executionId": req.execution_id,
                            }));
                        }
                        Err(e) => {
                            error!("Failed to cancel execution: {:?}", e);
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: format!("Failed to cancel execution: {}", e),
                            });
                        }
                    }
                }
            }
        });

        socket.on("task:execution:status", {
            let state = state.clone();
            move |socket: SocketRef, Data::<GetExecutionStatusRequest>(req)| {
                let state = state.clone();

                async move {
                    let task_execution_service_guard = state.task_execution_service.read().await;
                    let task_execution_service = match task_execution_service_guard.as_ref() {
                        Some(service) => service,
                        None => {
                            let _ = socket.emit("task:execution:error", ErrorEvent {
                                error: "Task execution service not available".to_string(),
                            });
                            return;
                        }
                    };

                    if let Some(status) = task_execution_service.get_execution_status(&req.execution_id).await {
                        use act_domain::TaskExecutionStatus;

                        let (status_str, exit_code, duration_ms) = match status {
                            TaskExecutionStatus::Queued => ("queued", None, None),
                            TaskExecutionStatus::Running => ("running", None, None),
                            TaskExecutionStatus::Completed { exit_code, duration_ms, .. } =>
                                ("completed", Some(exit_code), Some(duration_ms)),
                            TaskExecutionStatus::Failed { exit_code, .. } =>
                                ("failed", exit_code, None),
                            TaskExecutionStatus::Cancelled => ("cancelled", None, None),
                            TaskExecutionStatus::TimedOut => ("timeout", None, None),
                        };

                        let _ = socket.emit("task:execution:status", TaskExecutionStatusEvent {
                            execution_id: req.execution_id.clone(),
                            status: status_str.to_string(),
                            exit_code,
                            duration_ms,
                        });
                    } else {
                        let _ = socket.emit("task:execution:error", ErrorEvent {
                            error: "Execution not found".to_string(),
                        });
                    }
                }
            }
        });

        // Disconnect handler - NEW MULTI-DEVICE CLEANUP LOGIC
        socket.on_disconnect({
            let stats_subs = stats_subs.clone();
            let state = state.clone();
            move |socket: SocketRef| {
                let subs = stats_subs.clone();
                let _state = state.clone();
                async move {
                    let connection_id = socket.id.to_string();

                    info!("🔌 MULTI-DEVICE: Socket disconnecting: {}", connection_id);

                    // Clean up stats subscription if it exists
                    let mut subscriptions = subs.write().await;
                    if let Some(mut subscription) = subscriptions.remove(&connection_id) {
                        subscription.stop().await;
                    }

                    // Get user ID for cleanup (if authenticated)
                    if let Ok(user_id) = get_authenticated_user_id(&socket) {
                        // WebSocket cleanup is handled automatically by the socket layer
                        // PTY sessions remain alive for multi-device sharing
                        info!("MULTI-DEVICE: WebSocket {} disconnected for user {} (PTY sessions preserved)", connection_id, user_id);
                    }

                    info!("MULTI-DEVICE: Socket cleanup complete: {}", connection_id);
                }
            }
        });
    });
}

/// Authenticate user via SSO JWT token validation
async fn authenticate_user_with_sso(
    state: &AppState,
    token: &str,
) -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
    // Validate token using SSO client with RS256 verification
    let claims = state
        .sso_client
        .validate_token(token)
        .await
        .map_err(|e| format!("SSO token validation failed: {}", e))?;

    // Check if token is expired
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;

    if claims.exp < now {
        return Err("SSO token has expired".into());
    }

    // Find or create user in local database to ensure consistency
    let pool = state.db.pool();

    // Try to find user by SSO user ID
    let user =
        sqlx::query_as::<_, (String, String)>("SELECT id, email FROM users WHERE sso_user_id = ?")
            .bind(&claims.sub)
            .fetch_optional(pool)
            .await?;

    let (db_user_id, email) = if let Some((id, email)) = user {
        // Update email if changed
        if email != claims.email {
            sqlx::query("UPDATE users SET email = ? WHERE id = ?")
                .bind(&claims.email)
                .bind(&id)
                .execute(pool)
                .await?;
        }
        (id, claims.email)
    } else {
        // Check if user exists by email (migration case)
        let user_by_email =
            sqlx::query_as::<_, (String, String)>("SELECT id, email FROM users WHERE email = ?")
                .bind(&claims.email)
                .fetch_optional(pool)
                .await?;

        if let Some((id, email)) = user_by_email {
            // Update existing user with SSO user ID
            sqlx::query("UPDATE users SET sso_user_id = ? WHERE id = ?")
                .bind(&claims.sub)
                .bind(&id)
                .execute(pool)
                .await?;
            (id, email)
        } else {
            // Create new user
            let user_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO users (id, email, sso_user_id, created_at) VALUES (?, ?, ?, datetime('now'))"
            )
            .bind(&user_id)
            .bind(&claims.email)
            .bind(&claims.sub)
            .execute(pool)
            .await?;
            (user_id, claims.email)
        }
    };

    // Return database user_id and email for socket authentication
    Ok((db_user_id, email))
}

// Helper function to extract user_id from socket extensions - returns Result for proper error handling
fn get_authenticated_user_id(
    socket: &SocketRef,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    #[allow(clippy::map_clone)]
    socket
        .extensions
        .get::<String>()
        .map(|s| s.clone())
        .ok_or_else(|| "Authentication required: user not found in socket extensions".into())
}

// ===== Task Execution Socket.IO Types =====

#[derive(Debug, Serialize, Deserialize)]
pub struct StartTaskExecutionRequest {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    #[serde(rename = "permissionMode")]
    pub permission_mode: String,
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
pub struct TaskExecutionWarningEvent {
    #[serde(rename = "executionId")]
    pub execution_id: String,
    pub message: String,
}

// ===== Socket.IO Output Broadcaster =====

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
        let _ = self.io.emit(
            "task:execution:output",
            TaskExecutionOutputEvent {
                execution_id: execution_id.to_string(),
                output: chunk,
            },
        );
    }

    async fn broadcast_status(&self, execution_id: &str, status: act_domain::TaskExecutionStatus) {
        use act_domain::TaskExecutionStatus;

        let (status_str, exit_code, duration_ms) = match status {
            TaskExecutionStatus::Queued => ("queued".to_string(), None, None),
            TaskExecutionStatus::Running => ("running".to_string(), None, None),
            TaskExecutionStatus::Completed {
                exit_code,
                duration_ms,
                ..
            } => ("completed".to_string(), Some(exit_code), Some(duration_ms)),
            TaskExecutionStatus::Failed { exit_code, .. } => {
                ("failed".to_string(), exit_code, None)
            }
            TaskExecutionStatus::Cancelled => ("cancelled".to_string(), None, None),
            TaskExecutionStatus::TimedOut => ("timeout".to_string(), None, None),
        };

        let _ = self.io.emit(
            "task:execution:status",
            TaskExecutionStatusEvent {
                execution_id: execution_id.to_string(),
                status: status_str,
                exit_code,
                duration_ms,
            },
        );
    }

    async fn broadcast_warning(&self, execution_id: &str, message: String) {
        let _ = self.io.emit(
            "task:execution:warning",
            TaskExecutionWarningEvent {
                execution_id: execution_id.to_string(),
                message,
            },
        );
    }
}
