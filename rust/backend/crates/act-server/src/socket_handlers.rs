use std::sync::Arc;
use socketioxide::{
    extract::{Data, SocketRef},
    SocketIo,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error, debug, warn};
use jsonwebtoken::{decode, DecodingKey, Validation};


use crate::AppState;
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
        self.io.emit("terminal:output", TerminalOutputEvent {
            session_id: event.session_id,
            output: event.output,
        }).ok();
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

    pub async fn start(&mut self, state: Arc<AppState>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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
        let metrics = state.domain_services.system_service.get_current_system_metrics().await?;

        let stats_event = SystemStatsEvent {
            cpu_usage: metrics.cpu_usage_percent,
            memory_usage: metrics.memory_used_bytes,
            memory_total: metrics.memory_total_bytes,
            disk_usage: metrics.disk_used_bytes,
            disk_total: metrics.disk_total_bytes,
            uptime: metrics.uptime_seconds,
            load_average: metrics.load_average,
            processes: metrics.process_count,
            timestamp: chrono::Utc::now().timestamp(),
        };

        // FIX: Handle potential socket disconnection errors gracefully
        socket.emit("stats:data", stats_event).map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
            format!("Failed to emit stats data: {}", e).into()
        })?;
        Ok(())
    }
}


use crate::middleware::auth::Claims;

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

        // Authentication handler (for backward compatibility and primary auth method)
        socket.on("authenticate", {
            let state = state.clone();
            move |socket: SocketRef, Data::<AuthenticateRequest>(data)| {
                let _state = state.clone();
                async move {
                    match authenticate_user(&data.token).await {
                        Ok(claims) => {
                            info!("User {} authenticated via socket", claims.username);
                            // Store user_id in socket extensions for future use
                            socket.extensions.insert(claims.sub.clone());
                            socket.emit("authenticated", AuthenticatedEvent {
                                user_id: claims.sub,
                                username: claims.username,
                            }).ok();
                        }
                        Err(err) => {
                            error!("Socket authentication failed: {}", err);
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
                    info!("🚀 MULTI-DEVICE: Terminal create request: workspace_id={}, session_id={:?}", data.workspace_id, data.session_id);

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
                            info!("🔧 Using workspace path: {}", workspace.local_path);
                            Some(workspace.local_path)
                        }
                        Err(e) => {
                            warn!("Failed to get workspace {}: {}, using default", data.workspace_id, e);
                            None
                        }
                    };

                    // CORE MULTI-DEVICE LOGIC: Get or create PTY session
                    match state.domain_services.session_service.get_or_create_pty_session(&user_id, &session_id, &data.workspace_id, workspace_path).await {
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

                            info!("✅ MULTI-DEVICE: Terminal session {} ready for user {} (pid: {})", session_id, user_id, pid);
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

                    debug!("⌨️  MULTI-DEVICE: Input from user {} to session {}: {:?}", user_id, data.session_id, data.data);

                    // Check if PTY session exists and send input
                    match state.domain_services.session_service.has_pty_session(&user_id, &data.session_id).await {
                        Ok(true) => {
                            // Send input directly to PTY service
                            match state.pty_service.send_input(&data.session_id, data.data.as_bytes()).await {
                                Ok(_) => {
                                    debug!("✅ MULTI-DEVICE: Input sent to PTY session {}", data.session_id);
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
                        info!("🗑️  MULTI-DEVICE: WebSocket {} disconnected for user {} (PTY sessions preserved)", connection_id, user_id);
                    }

                    info!("✅ MULTI-DEVICE: Socket cleanup complete: {}", connection_id);
                }
            }
        });
    });
}

async fn authenticate_user(token: &str) -> Result<Claims, Box<dyn std::error::Error + Send + Sync>> {
    // Validate the JWT token using the proper environment variable
    let validation = Validation::new(jsonwebtoken::Algorithm::HS256);
    let secret = std::env::var("ACT_AUTH_JWT_SECRET")
        .unwrap_or_else(|_| "default-secret".to_string());
    let key = DecodingKey::from_secret(secret.as_bytes());
    
    let token_data = decode::<Claims>(token, &key, &validation)?;
    Ok(token_data.claims)
}

// Helper function to extract user_id from socket extensions - returns Result for proper error handling
fn get_authenticated_user_id(socket: &SocketRef) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    #[allow(clippy::map_clone)]
    socket.extensions.get::<String>()
        .map(|s| s.clone())
        .ok_or_else(|| "Authentication required: user not found in socket extensions".into())
}