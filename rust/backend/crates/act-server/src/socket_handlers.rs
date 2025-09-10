use std::sync::Arc;
use socketioxide::{
    extract::{Data, SocketRef},
    SocketIo,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error, debug, warn};
use jsonwebtoken::{decode, DecodingKey, Validation};


use crate::AppState;
use act_core::repository::{SessionType, TerminalSize};
use act_domain::CreateSessionOptions;
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
pub struct SessionRecoveryRequest {
    #[serde(rename = "recoveryToken")]
    pub recovery_token: String,
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

// Enhanced session output forwarder that integrates with SessionService
pub struct SessionOutputForwarder {
    socket: SocketRef,
    session_id: String,
    output_rx: Option<tokio::sync::mpsc::UnboundedReceiver<String>>,
}

// Session manager for tracking active terminal sessions per socket
pub struct SocketSessionManager {
    socket: SocketRef,
    sessions: HashMap<String, SessionOutputForwarder>,
}

impl SocketSessionManager {
    pub fn new(socket: SocketRef) -> Self {
        Self {
            socket,
            sessions: HashMap::new(),
        }
    }

    pub async fn add_session(&mut self, session_id: String, state: Arc<AppState>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut forwarder = SessionOutputForwarder::new(self.socket.clone(), session_id.clone());
        forwarder.start(state.clone()).await?;
        forwarder.send_welcome_message().await;
        self.sessions.insert(session_id, forwarder);
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn remove_session(&mut self, session_id: &str, state: Arc<AppState>) {
        if let Some(forwarder) = self.sessions.remove(session_id) {
            forwarder.stop(state).await;
        }
    }

    pub async fn cleanup_all(&mut self, state: Arc<AppState>) {
        for (session_id, forwarder) in self.sessions.drain() {
            forwarder.stop(state.clone()).await;
            info!("Cleaned up session {} for socket {}", session_id, self.socket.id);
        }
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

        socket.emit("stats:data", stats_event)?;
        Ok(())
    }
}

impl SessionOutputForwarder {
    pub fn new(socket: SocketRef, session_id: String) -> Self {
        Self { 
            socket, 
            session_id,
            output_rx: None,
        }
    }

    pub async fn start(&mut self, state: Arc<AppState>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Register with SessionService for output forwarding
        let output_rx = state.domain_services.session_service
            .register_websocket_connection(&self.session_id).await;
        
        self.output_rx = Some(output_rx);
        
        // Start the output forwarding task
        let socket = self.socket.clone();
        let session_id = self.session_id.clone();
        let mut rx = self.output_rx.take().unwrap();
        
        tokio::spawn(async move {
            info!("✅ Started output forwarding task for session {}", session_id);
            while let Some(output) = rx.recv().await {
                info!("📤 Forwarding output for session {}: {:?}", session_id, output);
                let event = TerminalOutputEvent {
                    session_id: session_id.clone(),
                    output,
                };
                if let Err(e) = socket.emit("terminal:output", event) {
                    error!("Failed to forward terminal output for session {}: {}", session_id, e);
                    break;
                }
            }
            warn!("⚠️ Output forwarding ended for session {} - channel closed", session_id);
        });
        
        Ok(())
    }

    pub async fn stop(&self, _state: Arc<AppState>) {
        if let Some(rx) = &self.output_rx {
            // Note: We can't clone the receiver, so we'll just drop it
            // The session service will clean up when the channel is closed
            let _ = rx;
        }
    }

    pub async fn send_welcome_message(&self) {
        let event = TerminalOutputEvent {
            session_id: self.session_id.clone(),
            output: "\r\n\x1b[1;32m● Connected to AI Code Terminal\x1b[0m\r\n".to_string(),
        };
        if let Err(e) = self.socket.emit("terminal:output", event) {
            error!("Failed to send welcome message for session {}: {}", self.session_id, e);
        }
    }
}

use crate::middleware::auth::Claims;

pub fn setup_socket_handlers(io: SocketIo, state: Arc<AppState>) {
    let stats_subscriptions = Arc::new(RwLock::new(HashMap::<String, StatsSubscription>::new()));
    let session_managers = Arc::new(RwLock::new(HashMap::<String, SocketSessionManager>::new()));
    
    io.ns("/", move |socket: SocketRef| {
        let state = state.clone();
        let stats_subs = stats_subscriptions.clone();
        let session_mgrs = session_managers.clone();
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

        // Create terminal session handler
        socket.on("terminal:create", {
            let state = state.clone();
            let session_mgrs = session_mgrs.clone();
            move |socket: SocketRef, Data::<TerminalCreateRequest>(data)| {
                let state = state.clone();
                let socket_id = socket.id.to_string();
                let session_mgrs = session_mgrs.clone();
                async move {
                    info!("🔧 Received terminal create request: workspace_id={}, session_id={:?}", data.workspace_id, data.session_id);
                    
                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Some(user_id) => user_id,
                        None => {
                            error!("Terminal create request from unauthenticated socket");
                            socket.emit("terminal:error", ErrorEvent {
                                error: "Authentication required".to_string(),
                            }).ok();
                            return;
                        }
                    };
                    
                    // Get the actual workspace path for the working directory
                    let workspace_path = match state.domain_services.workspace_service.get_workspace(&user_id, &data.workspace_id).await {
                        Ok(workspace) => {
                            info!("🔧 Using workspace path: {}", workspace.local_path);
                            Some(workspace.local_path)
                        }
                        Err(e) => {
                            error!("Failed to get workspace {}: {}", data.workspace_id, e);
                            None
                        }
                    };
                    
                    let options = CreateSessionOptions {
                        workspace_id: Some(data.workspace_id.clone()),
                        session_id: data.session_id.clone(),
                        session_name: "Terminal".to_string(),
                        session_type: SessionType::Terminal,
                        terminal_size: Some(TerminalSize { cols: 80, rows: 24 }),
                        is_recoverable: true,
                        auto_cleanup: false,
                        max_idle_minutes: 30,
                        working_directory: workspace_path,
                    };

                    match state.domain_services.session_service.create_session(&user_id, options).await {
                        Ok(session_state) => {
                            info!("Created terminal session: {}", session_state.session_id);
                            
                            // Add session to socket manager
                            let mut session_managers = session_mgrs.write().await;
                            let session_manager = session_managers.entry(socket_id.clone()).or_insert_with(|| {
                                SocketSessionManager::new(socket.clone())
                            });
                            
                            if let Err(e) = session_manager.add_session(session_state.session_id.clone(), state.clone()).await {
                                error!("Failed to add session to socket manager: {}", e);
                                socket.emit("terminal:error", ErrorEvent {
                                    error: format!("Failed to setup session: {}", e),
                                }).ok();
                                return;
                            }
                            
                            // Send the correct format that frontend expects
                            socket.emit("terminal:created", serde_json::json!({
                                "sessionId": session_state.session_id,
                                "pid": 0  // portable-pty doesn't expose PID, use 0 as placeholder
                            })).ok();
                        }
                        Err(err) => {
                            error!("Failed to create terminal session: {}", err);
                            socket.emit("terminal:error", ErrorEvent {
                                error: format!("Failed to create session: {}", err),
                            }).ok();
                        }
                    }
                }
            }
        });

        // Terminal input handler
        socket.on("terminal:data", {
            let state = state.clone();
            move |socket: SocketRef, Data::<TerminalDataRequest>(data)| {
                let state = state.clone();
                async move {
                    // Check authentication
                    let _user_id = match get_authenticated_user_id(&socket) {
                        Some(user_id) => user_id,
                        None => {
                            error!("Terminal data request from unauthenticated socket");
                            return;
                        }
                    };
                    
                    match state.domain_services.session_service.send_input(&data.session_id, data.data.as_bytes()).await {
                        Ok(_) => {
                            debug!("Wrote data to session {}", data.session_id);
                        }
                        Err(err) => {
                            error!("Failed to write to session {}: {}", data.session_id, err);
                            socket.emit("terminal-error", ErrorEvent {
                                error: format!("Failed to write to session: {}", err),
                            }).ok();
                        }
                    }
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
                        Some(user_id) => user_id,
                        None => {
                            error!("Terminal resize request from unauthenticated socket");
                            return;
                        }
                    };
                    
                    match state.domain_services.session_service.resize_terminal(&user_id, &data.session_id, data.cols, data.rows).await {
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
                        Some(user_id) => user_id,
                        None => {
                            error!("Session list request from unauthenticated socket");
                            return;
                        }
                    };
                    
                    match state.domain_services.session_service.list_active_sessions(&user_id).await {
                        Ok(sessions) => {
                            let workspace_sessions: Vec<_> = sessions
                                .into_iter()
                                .filter(|s| {
                                    if let Some(ref workspace_id) = data.workspace_id {
                                        s.workspace_id.as_ref() == Some(workspace_id)
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

        // Session recovery handler
        socket.on("session:recover", {
            let state = state.clone();
            let session_mgrs = session_mgrs.clone();
            move |socket: SocketRef, Data::<SessionRecoveryRequest>(data)| {
                let state = state.clone();
                let socket_id = socket.id.to_string();
                let session_mgrs = session_mgrs.clone();
                async move {
                    // Check authentication
                    let user_id = match get_authenticated_user_id(&socket) {
                        Some(user_id) => user_id,
                        None => {
                            error!("Session recovery request from unauthenticated socket");
                            return;
                        }
                    };
                    
                    match state.domain_services.session_service.recover_session(&user_id, &data.recovery_token).await {
                        Ok(session_state) => {
                            info!("Recovered session: {}", session_state.session_id);
                            
                            // Add recovered session to socket manager
                            let mut session_managers = session_mgrs.write().await;
                            let session_manager = session_managers.entry(socket_id.clone()).or_insert_with(|| {
                                SocketSessionManager::new(socket.clone())
                            });
                            
                            if let Err(e) = session_manager.add_session(session_state.session_id.clone(), state.clone()).await {
                                error!("Failed to add recovered session to socket manager: {}", e);
                                socket.emit("terminal-error", ErrorEvent {
                                    error: format!("Failed to setup recovered session: {}", e),
                                }).ok();
                                return;
                            }
                            
                            socket.emit("session-recovered", serde_json::json!({
                                "sessionId": session_state.session_id,
                                "success": true
                            })).ok();
                        }
                        Err(err) => {
                            error!("Failed to recover session: {}", err);
                            socket.emit("terminal-error", ErrorEvent {
                                error: format!("Failed to recover session: {}", err),
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
                        Some(user_id) => user_id,
                        None => {
                            error!("Session termination request from unauthenticated socket");
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

        // Disconnect handler
        socket.on_disconnect({
            let stats_subs = stats_subs.clone();
            let session_mgrs = session_mgrs.clone();
            move |socket: SocketRef| {
                let subs = stats_subs.clone();
                let session_mgrs = session_mgrs.clone();
                async move {
                    let socket_id = socket.id.to_string();
                    
                    // Clean up stats subscription if it exists
                    let mut subscriptions = subs.write().await;
                    if let Some(mut subscription) = subscriptions.remove(&socket_id) {
                        subscription.stop().await;
                    }
                    
                    // Clean up session manager and all associated sessions
                    let mut session_managers = session_mgrs.write().await;
                    if let Some(mut session_manager) = session_managers.remove(&socket_id) {
                        session_manager.cleanup_all(state.clone()).await;
                    }
                    
                    info!("Socket disconnected: {}", socket.id);
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

// Helper function to extract user_id from socket extensions
fn get_authenticated_user_id(socket: &SocketRef) -> Option<String> {
    socket.extensions.get::<String>().map(|s| s.clone())
}