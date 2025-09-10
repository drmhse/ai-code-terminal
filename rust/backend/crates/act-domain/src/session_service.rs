use std::sync::Arc;

use act_core::{
    repository::{
        Session, SessionRepository, CreateSessionRequest, UpdateSessionRequest, 
        SessionId, SessionStatus, SessionType, TerminalSize, WorkspaceId
    },
    pty::{PtyService, PtyEvent},
    Result, CoreError
};


use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn, debug, error};
use uuid::Uuid;
use tokio::sync::{mpsc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub session_id: String,
    pub workspace_id: Option<String>,
    pub current_working_dir: Option<String>,
    pub environment_vars: HashMap<String, String>,
    pub shell_history: Vec<String>,
    pub terminal_size: Option<TerminalSize>,
    pub last_command: Option<String>,
    pub recovery_token: String,
    pub is_recoverable: bool,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionOptions {
    pub workspace_id: Option<WorkspaceId>,
    pub session_id: Option<String>,
    pub session_name: String,
    pub session_type: SessionType,
    pub terminal_size: Option<TerminalSize>,
    pub is_recoverable: bool,
    pub auto_cleanup: bool,
    pub max_idle_minutes: i32,
    pub working_directory: Option<String>,
}

impl Default for CreateSessionOptions {
    fn default() -> Self {
        Self {
            workspace_id: None,
            session_id: None,
            session_name: "Terminal".to_string(),
            session_type: SessionType::Terminal,
            terminal_size: Some(TerminalSize { cols: 80, rows: 24 }),
            is_recoverable: true,
            auto_cleanup: true,
            max_idle_minutes: 1440, // 24 hours
            working_directory: None,
        }
    }
}

// Forwarding channel for PTY output
#[derive(Debug, Clone)]
pub struct OutputForwarder {
    session_id: String,
    output_tx: mpsc::UnboundedSender<PtyEvent>,
}

impl OutputForwarder {
    pub fn new(session_id: String) -> (Self, mpsc::UnboundedReceiver<PtyEvent>) {
        let (output_tx, output_rx) = mpsc::unbounded_channel();
        (Self { session_id, output_tx }, output_rx)
    }

    pub fn forward_event(&self, event: PtyEvent) -> Result<()> {
        self.output_tx.send(event)
            .map_err(|e| CoreError::Pty(format!("Failed to forward PTY event: {}", e)))
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }
}

// Manages WebSocket connections for output forwarding
#[derive(Debug)]
pub struct SessionWebSocketManager {
    connections: Arc<RwLock<HashMap<String, Vec<mpsc::UnboundedSender<String>>>>>,
}

impl Default for SessionWebSocketManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionWebSocketManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_connection(&self, session_id: String) -> mpsc::UnboundedReceiver<String> {
        let (tx, rx) = mpsc::unbounded_channel();
        let mut connections = self.connections.write().await;
        connections.entry(session_id.clone()).or_insert_with(Vec::new).push(tx);
        info!("Registered WebSocket connection for session {}", session_id);
        rx
    }

    pub async fn unregister_connection(&self, session_id: &str, _rx: mpsc::UnboundedReceiver<String>) {
        let mut connections = self.connections.write().await;
        if let Some(senders) = connections.get_mut(session_id) {
            senders.retain(|sender| !sender.is_closed());
            if senders.is_empty() {
                connections.remove(session_id);
                info!("Unregistered last WebSocket connection for session {}", session_id);
            }
        }
    }

    pub async fn forward_to_websockets(&self, session_id: &str, output: String) {
        let connections = self.connections.read().await;
        if let Some(senders) = connections.get(session_id) {
            info!("✅ Forwarding output to {} WebSocket connections for session {}: {:?}", senders.len(), session_id, output);
            let mut active_senders = Vec::new();
            for sender in senders {
                if !sender.is_closed() {
                    if let Err(e) = sender.send(output.clone()) {
                        warn!("Failed to send output to WebSocket: {}", e);
                    } else {
                        active_senders.push(sender.clone());
                    }
                }
            }
            
            // Clean up closed senders
            if active_senders.len() != senders.len() {
                drop(connections);
                let mut connections = self.connections.write().await;
                if let Some(senders) = connections.get_mut(session_id) {
                    senders.retain(|sender| !sender.is_closed());
                    if senders.is_empty() {
                        connections.remove(session_id);
                    }
                }
            }
        }
    }

    pub async fn has_connections(&self, session_id: &str) -> bool {
        let connections = self.connections.read().await;
        connections.get(session_id).is_some_and(|senders| !senders.is_empty())
    }
}

pub struct SessionService {
    repository: Arc<dyn SessionRepository>,
    pty_service: Arc<dyn PtyService>,
    websocket_manager: Arc<SessionWebSocketManager>,
    output_forwarders: Arc<RwLock<HashMap<String, OutputForwarder>>>,
    recovery_timeout_hours: i64,
}

impl SessionService {
    pub fn new(
        repository: Arc<dyn SessionRepository>,
        pty_service: Arc<dyn PtyService>,
        recovery_timeout_hours: Option<i64>,
    ) -> Self {
        Self {
            repository,
            pty_service,
            websocket_manager: Arc::new(SessionWebSocketManager::new()),
            output_forwarders: Arc::new(RwLock::new(HashMap::new())),
            recovery_timeout_hours: recovery_timeout_hours.unwrap_or(24),
        }
    }

pub async fn create_session(&self, user_id: &str, options: CreateSessionOptions) -> Result<SessionState> {
        // Use provided session_id if available, otherwise generate a new one
        let session_id = options.session_id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let recovery_token = session_id.clone();
        
        let terminal_size = options.terminal_size.unwrap_or(TerminalSize { cols: 80, rows: 24 });

        let environment_vars = self.get_default_environment_vars();

        let request = CreateSessionRequest {
            session_id: Some(session_id.clone()),
            workspace_id: options.workspace_id.clone(),
            session_name: options.session_name.clone(),
            session_type: options.session_type,
            terminal_size: Some(terminal_size.clone()),
            layout_id: None,
        };

        let mut session = self.repository.create(user_id, request).await?;

        session.recovery_token = Some(recovery_token.clone());
        session.can_recover = options.is_recoverable;
        session.auto_cleanup = options.auto_cleanup;
        session.max_idle_time = options.max_idle_minutes;
        session.environment_vars = Some(environment_vars.clone());
        session.current_working_dir = options.working_directory.clone();

        if let Some(ref workspace_id) = options.workspace_id {
            info!("🔧 Creating PTY for session {} in workspace {}", session.id, workspace_id);
            let config = act_core::pty::SessionConfig {
                session_id: session.id.clone(),
                workspace_id: workspace_id.clone(),
                size: act_core::pty::PtySize {
                    cols: terminal_size.cols.max(80),
                    rows: terminal_size.rows.max(24),
                    pixel_width: 0,
                    pixel_height: 0,
                },
                shell: None,
                working_dir: session.current_working_dir.clone().or_else(|| Some("/tmp".to_string())),
                environment: session.environment_vars.clone(),
            };
            
            info!("🔧 About to call pty_service.create_session");
            let (output_rx, _session_info) = self.pty_service.create_session(config).await?;
            info!("🔧 PTY service returned output_rx channel");

            // Create output forwarder for this session
            let (forwarder, internal_rx) = OutputForwarder::new(session.id.clone());
            {
                let mut forwarders = self.output_forwarders.write().await;
                forwarders.insert(session.id.clone(), forwarder);
            }

            // Start output forwarding task
            let websocket_manager = self.websocket_manager.clone();
            let session_id_clone = session.id.clone();
            tokio::spawn(async move {
                Self::handle_pty_output(output_rx, websocket_manager, session_id_clone, internal_rx).await;
            });

            // Send initial prompt/output and trigger shell prompt
            tokio::spawn({
                let session_id = session.id.clone();
                let websocket_manager = self.websocket_manager.clone();
                let pty_service = self.pty_service.clone();
                async move {
                    // Wait a bit for PTY and WebSocket to be established
                    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                    
                    // Send welcome message
                    let welcome_output = format!("\x1b[1;32m● Terminal ready - session {}\x1b[0m\r\n", session_id);
                    websocket_manager.forward_to_websockets(&session_id, welcome_output).await;
                    
                    // Send commands to initialize shell and trigger prompt
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    
                    // Send a simple command to get shell output
                    if let Err(e) = pty_service.send_input(&session_id, b"echo 'Shell ready'\n").await {
                        warn!("Failed to send initialization command to session {}: {}", session_id, e);
                    }
                    
                    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                    
                    // Send a newline to get prompt
                    if let Err(e) = pty_service.send_input(&session_id, b"\n").await {
                        warn!("Failed to send prompt trigger to session {}: {}", session_id, e);
                    }
                }
            });

            info!("Created PTY session for session {} with output forwarding", session.id);
        }

        let session_state = SessionState {
            session_id: session.id.clone(),
            workspace_id: options.workspace_id,
            current_working_dir: session.current_working_dir.clone(),
            environment_vars,
            shell_history: Vec::new(),
            terminal_size: Some(terminal_size),
            last_command: None,
            recovery_token,
            is_recoverable: options.is_recoverable,
            created_at: session.created_at,
            last_activity: session.last_activity_at,
        };

        info!("Created session {} with recovery capabilities", session.id);
        Ok(session_state)
    }

    pub async fn recover_session(&self, user_id: &str, recovery_token: &str) -> Result<SessionState> {
        let sessions = self.repository.list_active(user_id).await?;
        
        let session = sessions
            .into_iter()
            .find(|s| {
                s.recovery_token.as_ref() == Some(&recovery_token.to_string()) 
                && s.can_recover
                && s.status != SessionStatus::Terminated
            })
            .ok_or_else(|| CoreError::NotFound("Recovery token not found or session not recoverable".to_string()))?;

        let now = Utc::now();
        let created_duration = now.signed_duration_since(session.created_at);
        
        if created_duration > Duration::hours(self.recovery_timeout_hours) {
            warn!("Session {} recovery token expired", session.id);
            return Err(CoreError::Validation("Recovery token expired".to_string()));
        }

        self.repository.update_activity(user_id, &session.id).await?;

        let session_state = SessionState {
            session_id: session.id.clone(),
            workspace_id: session.workspace_id.clone(),
            current_working_dir: session.current_working_dir.clone(),
            environment_vars: session.environment_vars.unwrap_or_default(),
            shell_history: session.shell_history.unwrap_or_default(),
            terminal_size: session.terminal_size.clone(),
            last_command: session.last_command.clone(),
            recovery_token: recovery_token.to_string(),
            is_recoverable: session.can_recover,
            created_at: session.created_at,
            last_activity: now,
        };

        info!("Recovered session {} using recovery token", session.id);
        Ok(session_state)
    }

    pub async fn update_session_state(
        &self,
        user_id: &str,
        session_id: &SessionId,
        current_dir: Option<String>,
        last_command: Option<String>,
        history_entry: Option<String>,
    ) -> Result<()> {
        let update_request = UpdateSessionRequest {
            status: None,
            current_working_dir: current_dir,
            environment_vars: None,
            terminal_size: None,
            last_command,
            last_activity_at: Some(Utc::now()),
        };

        if let Some(entry) = history_entry {
        let session = self.repository.get_by_id(user_id, session_id).await?;
            let mut history = session.shell_history.unwrap_or_default();
            
            history.push(entry);
            if history.len() > 1000 {
                history.remove(0);
            }
            
            // Note: This would need to be handled differently in actual implementation
            // as UpdateSessionRequest doesn't have shell_history field
        }

        self.repository.update(user_id, session_id, update_request).await?;
        
        debug!("Updated session {} state", session_id);
        Ok(())
    }

    pub async fn get_session(&self, user_id: &str, session_id: &SessionId) -> Result<Session> {
        self.repository.get_by_id(user_id, session_id).await
    }

    pub async fn list_active_sessions(&self, user_id: &str) -> Result<Vec<Session>> {
        self.repository.list_active(user_id).await
    }

    pub async fn list_workspace_sessions(&self, user_id: &str, workspace_id: &WorkspaceId) -> Result<Vec<Session>> {
        self.repository.list_by_workspace(user_id, workspace_id).await
    }

    pub async fn terminate_session(&self, user_id: &str, session_id: &SessionId) -> Result<()> {
        let _session = self.repository.get_by_id(user_id, session_id).await?;

        // Clean up output forwarder
        {
            let mut forwarders = self.output_forwarders.write().await;
            if let Some(forwarder) = forwarders.remove(session_id) {
                // Send close signal
                let _ = forwarder.forward_event(PtyEvent::Closed);
                debug!("Cleaned up output forwarder for session {}", session_id);
            }
        }

        // Send termination message to any connected WebSockets
        self.websocket_manager.forward_to_websockets(session_id, 
            "\r\n\x1b[1;31m● Session terminated by server\x1b[0m\r\n".to_string()).await;

        if let Err(e) = self.pty_service.destroy_session(session_id).await {
            warn!("Failed to destroy PTY session {}: {}", session_id, e);
        }

        let update_request = UpdateSessionRequest {
            status: Some(SessionStatus::Terminated),
            current_working_dir: None,
            environment_vars: None,
            terminal_size: None,
            last_command: None,
            last_activity_at: Some(Utc::now()),
        };

        self.repository.update(user_id, session_id, update_request).await?;

        info!("Terminated session {}", session_id);
        Ok(())
    }

    pub async fn cleanup_expired_sessions(&self, user_id: &str) -> Result<usize> {
        let cleanup_threshold = Utc::now() - Duration::hours(24);
        let cleaned_count = self.repository.cleanup_inactive(user_id, cleanup_threshold).await?;

        if cleaned_count > 0 {
            info!("Cleaned up {} expired sessions", cleaned_count);
        }

        Ok(cleaned_count)
    }

    pub async fn resize_terminal(&self, user_id: &str, session_id: &SessionId, cols: u16, rows: u16) -> Result<()> {
        let terminal_size = TerminalSize { cols, rows };

        let pty_size = act_core::pty::PtySize {
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
        };
        self.pty_service.resize_session(session_id, pty_size).await?;

        let update_request = UpdateSessionRequest {
            status: None,
            current_working_dir: None,
            environment_vars: None,
            terminal_size: Some(terminal_size),
            last_command: None,
            last_activity_at: Some(Utc::now()),
        };

        self.repository.update(user_id, session_id, update_request).await?;

        debug!("Resized terminal for session {} to {}x{}", session_id, cols, rows);
        Ok(())
    }

    pub async fn send_input(&self, session_id: &SessionId, data: &[u8]) -> Result<()> {
        self.pty_service.send_input(session_id, data).await
    }

    async fn handle_pty_output(
        mut output_rx: mpsc::UnboundedReceiver<PtyEvent>,
        websocket_manager: Arc<SessionWebSocketManager>,
        session_id: String,
        mut internal_rx: mpsc::UnboundedReceiver<PtyEvent>,
    ) {
        loop {
            tokio::select! {
                Some(event) = output_rx.recv() => {
                    match event {
                        PtyEvent::Output(data) => {
                            let output = String::from_utf8_lossy(&data).to_string();
                            info!("✅ Forwarding PTY output for session {}: {} bytes - {:?}", session_id, output.len(), output);
                            websocket_manager.forward_to_websockets(&session_id, output).await;
                        }
                        PtyEvent::Closed => {
                            info!("PTY session {} closed", session_id);
                            websocket_manager.forward_to_websockets(&session_id, 
                                "\r\n\x1b[1;31m● Session terminated\x1b[0m\r\n".to_string()).await;
                            break;
                        }
                        PtyEvent::Error(error_msg) => {
                            error!("PTY error for session {}: {}", session_id, error_msg);
                            websocket_manager.forward_to_websockets(&session_id, 
                                format!("\r\n\x1b[1;31m● PTY Error: {}\x1b[0m\r\n", error_msg)).await;
                        }
                        PtyEvent::Resized { cols, rows } => {
                            debug!("PTY session {} resized to {}x{}", session_id, cols, rows);
                        }
                    }
                }
                Some(event) = internal_rx.recv() => {
                    // Handle internal events (if any)
                    match event {
                        PtyEvent::Output(data) => {
                            let output = String::from_utf8_lossy(&data).to_string();
                            websocket_manager.forward_to_websockets(&session_id, output).await;
                        }
                        PtyEvent::Closed => {
                            info!("Internal close signal for session {}", session_id);
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    // Public methods for WebSocket integration
    pub async fn register_websocket_connection(&self, session_id: &str) -> mpsc::UnboundedReceiver<String> {
        self.websocket_manager.register_connection(session_id.to_string()).await
    }

    pub async fn unregister_websocket_connection(&self, session_id: &str, rx: mpsc::UnboundedReceiver<String>) {
        self.websocket_manager.unregister_connection(session_id, rx).await;
    }

    pub async fn send_custom_output(&self, session_id: &str, output: String) -> Result<()> {
        if let Some(forwarder) = self.output_forwarders.read().await.get(session_id) {
            forwarder.forward_event(PtyEvent::Output(output.into_bytes()))?;
        } else {
            // If no forwarder exists, send directly through websocket manager
            self.websocket_manager.forward_to_websockets(session_id, output).await;
        }
        Ok(())
    }

    fn get_default_environment_vars(&self) -> HashMap<String, String> {
        std::env::vars().collect()
    }
}