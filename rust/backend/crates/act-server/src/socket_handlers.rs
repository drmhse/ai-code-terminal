use std::sync::Arc;
use socketioxide::{
    extract::{Data, SocketRef},
    SocketIo,
};
use serde::{Deserialize, Serialize};
use tracing::{info, error, debug};
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

// Simple session output forwarder
pub struct SessionOutputForwarder {
    socket: SocketRef,
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
    pub fn new(socket: SocketRef) -> Self {
        Self { socket }
    }

    pub async fn forward_output(&self, session_id: String, output: String) {
        let event = TerminalOutputEvent {
            session_id: session_id.clone(),
            output,
        };
        if let Err(e) = self.socket.emit("terminal:output", event) {
            error!("Failed to forward terminal output for session {}: {}", session_id, e);
        }
    }
}

// JWT Claims structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub exp: usize,
    pub iat: usize,
}

pub fn setup_socket_handlers(io: SocketIo, state: Arc<AppState>) {
    let stats_subscriptions = Arc::new(RwLock::new(HashMap::<String, StatsSubscription>::new()));
    
    io.ns("/", move |socket: SocketRef| {
        let state = state.clone();
        let stats_subs = stats_subscriptions.clone();
        info!("New socket connection: {}", socket.id);

        // Authentication handler
        socket.on("authenticate", {
            let state = state.clone();
            move |socket: SocketRef, Data::<AuthenticateRequest>(data)| {
                let _state = state.clone();
                async move {
                    match authenticate_user(&data.token).await {
                        Ok(claims) => {
                            info!("User {} authenticated via socket", claims.username);
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
            let socket_clone = socket.clone();
            move |socket: SocketRef, Data::<TerminalCreateRequest>(data)| {
                let state = state.clone();
                let socket_for_forward = socket_clone.clone();
                async move {
                    let options = CreateSessionOptions {
                        workspace_id: Some(data.workspace_id.clone()),
                        session_name: "Terminal".to_string(),
                        session_type: SessionType::Terminal,
                        terminal_size: Some(TerminalSize { cols: 80, rows: 24 }),
                        is_recoverable: true,
                        auto_cleanup: false,
                        max_idle_minutes: 30,
                    };

                    match state.domain_services.session_service.create_session(options).await {
                        Ok(session_state) => {
                            info!("Created terminal session: {}", session_state.session_id);
                            
                            // For now, send a simple welcome message to demonstrate output streaming
                            let forwarder = SessionOutputForwarder::new(socket_for_forward);
                            let session_id = session_state.session_id.clone();
                            
                            // Spawn a task to forward output (this is a simplified version)
                            tokio::spawn(async move {
                                // Send welcome message
                                forwarder.forward_output(
                                    session_id.clone(),
                                    "\r\n\x1b[1;32m● Connected to AI Code Terminal\x1b[0m\r\n".to_string()
                                ).await;
                                
                                // Send initial prompt
                                forwarder.forward_output(
                                    session_id.clone(),
                                    "\x1b[36muser@act-terminal:~$ \x1b[0m".to_string()
                                ).await;
                            });
                            
                            socket.emit("terminal:created", SessionCreatedEvent {
                                session_id: session_state.session_id,
                                workspace_id: data.workspace_id,
                                success: true,
                            }).ok();
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
                    match state.domain_services.session_service.resize_terminal(&data.session_id, data.cols, data.rows).await {
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
                    match state.domain_services.session_service.list_active_sessions().await {
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
            move |socket: SocketRef, Data::<SessionRecoveryRequest>(data)| {
                let state = state.clone();
                async move {
                    match state.domain_services.session_service.recover_session(&data.recovery_token).await {
                        Ok(session_state) => {
                            info!("Recovered session: {}", session_state.session_id);
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
            move |socket: SocketRef| {
                let subs = stats_subs.clone();
                async move {
                    let socket_id = socket.id.to_string();
                    
                    // Clean up stats subscription if it exists
                    let mut subscriptions = subs.write().await;
                    if let Some(mut subscription) = subscriptions.remove(&socket_id) {
                        subscription.stop().await;
                    }
                    
                    info!("Socket disconnected: {}", socket.id);
                    // Note: In a real implementation, we would call domain service to handle cleanup
                    // For now, sessions remain active and can be recovered
                }
            }
        });
    });
}

async fn authenticate_user(token: &str) -> Result<Claims, Box<dyn std::error::Error + Send + Sync>> {
    // In a real implementation, this would validate the JWT token
    // For now, we'll create a simple placeholder
    let validation = Validation::new(jsonwebtoken::Algorithm::HS256);
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-secret".to_string());
    let key = DecodingKey::from_secret(secret.as_bytes());
    
    let token_data = decode::<Claims>(token, &key, &validation)?;
    Ok(token_data.claims)
}