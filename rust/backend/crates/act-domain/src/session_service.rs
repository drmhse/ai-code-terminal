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
use std::collections::{HashMap, VecDeque};
use tracing::{info, warn, debug, error};
use uuid::Uuid;
use tokio::sync::{mpsc, RwLock};

// Removed complex UTF-8 buffering - VS Code approach uses simple conversion

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

// Line-based rolling buffer for terminal output persistence (tmux/screen approach)
#[derive(Debug, Clone)]
pub struct RollingBuffer {
    complete_lines: VecDeque<String>,  // Only complete lines (ending with \n)
    pending_line: String,              // Accumulates until newline arrives
    max_lines: usize,                  // Maximum number of complete lines to keep
}

impl RollingBuffer {
    pub fn new(max_lines: usize) -> Self {
        Self {
            complete_lines: VecDeque::with_capacity(max_lines),
            pending_line: String::new(),
            max_lines,
        }
    }

    pub fn append(&mut self, output: String) {
        // Add new output to pending line
        self.pending_line.push_str(&output);

        // Process any complete lines (ending with \n or \r\n)
        while let Some(newline_pos) = self.pending_line.find('\n') {
            // Extract complete line including the newline
            let mut complete_line = self.pending_line[..=newline_pos].to_string();

            // Handle \r\n by normalizing to \n
            if complete_line.ends_with("\r\n") {
                complete_line = complete_line.replace("\r\n", "\n");
            }

            // Move to complete lines buffer
            self.complete_lines.push_back(complete_line);

            // Keep remainder in pending
            self.pending_line = self.pending_line[newline_pos + 1..].to_string();

            // Trim if exceeding line limit (safe - only removes complete lines)
            if self.complete_lines.len() > self.max_lines {
                self.complete_lines.pop_front();
            }
        }
    }

    pub fn get_content(&self) -> String {
        let mut result = String::new();

        // Add all complete lines
        for line in &self.complete_lines {
            result.push_str(line);
        }

        // Add pending line (without newline)
        if !self.pending_line.is_empty() {
            result.push_str(&self.pending_line);
        }

        result
    }

    pub fn clear(&mut self) {
        self.complete_lines.clear();
        self.pending_line.clear();
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

#[derive(Clone)]
pub struct SessionService {
    repository: Arc<dyn SessionRepository>,
    pty_service: Arc<dyn PtyService>,
    websocket_manager: Arc<SessionWebSocketManager>,
    output_forwarders: Arc<RwLock<HashMap<String, OutputForwarder>>>,
    terminal_buffers: Arc<RwLock<HashMap<String, RollingBuffer>>>,
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
            terminal_buffers: Arc::new(RwLock::new(HashMap::new())),
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

            // Initialize rolling buffer for this session (5000 lines max)
            {
                let mut buffers = self.terminal_buffers.write().await;
                buffers.insert(session.id.clone(), RollingBuffer::new(5000));
            }

            // Start output forwarding task
            let websocket_manager = self.websocket_manager.clone();
            let terminal_buffers = self.terminal_buffers.clone();
            let session_id_clone = session.id.clone();
            tokio::spawn(async move {
                Self::handle_pty_output(output_rx, websocket_manager, terminal_buffers, session_id_clone, internal_rx).await;
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

    pub async fn add_command_to_history(&self, user_id: &str, session_id: &SessionId, command: &str) -> Result<()> {
        let session = self.repository.get_by_id(user_id, session_id).await?;

        let mut history = session.shell_history.unwrap_or_default();

        // Add the command to history
        history.push(command.to_string());

        // Limit history size to prevent memory bloat
        if history.len() > 1000 {
            history.remove(0);
        }

        // Update the session with the new history
        let update_request = UpdateSessionRequest {
            status: None,
            current_working_dir: None,
            environment_vars: None,
            terminal_size: None,
            last_command: Some(command.to_string()),
            last_activity_at: Some(Utc::now()),
            shell_history: Some(history),
        };

        self.repository.update(user_id, session_id, update_request).await?;

        debug!("Added command '{}' to session {} history", command, session_id);
        Ok(())
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
            shell_history: None,
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

    pub async fn count_all_active_sessions(&self) -> Result<u64> {
        self.repository.count_all_active().await
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

        // Clean up terminal buffer
        {
            let mut buffers = self.terminal_buffers.write().await;
            buffers.remove(session_id);
            debug!("Cleaned up terminal buffer for session {}", session_id);
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
            shell_history: None,
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
            shell_history: None,
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
        terminal_buffers: Arc<RwLock<HashMap<String, RollingBuffer>>>,
        session_id: String,
        mut internal_rx: mpsc::UnboundedReceiver<PtyEvent>,
    ) {
        loop {
            tokio::select! {
                Some(event) = output_rx.recv() => {
                    match event {
                        PtyEvent::Output(data) => {
                            // VS Code approach: Simple, direct conversion
                            let output = String::from_utf8_lossy(&data).to_string();

                            if !output.is_empty() {
                                debug!("✅ Forwarding PTY output for session {}: {} bytes", session_id, output.len());

                                // Capture output to rolling buffer for persistence
                                {
                                    let mut buffers = terminal_buffers.write().await;
                                    if let Some(buffer) = buffers.get_mut(&session_id) {
                                        buffer.append(output.clone());
                                    }
                                }

                                // Forward to WebSocket connections
                                websocket_manager.forward_to_websockets(&session_id, output).await;
                            }
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

    /// Get terminal buffer contents for session restoration
    pub async fn get_terminal_buffer(&self, session_id: &str) -> Result<String> {
        let buffers = self.terminal_buffers.read().await;
        if let Some(buffer) = buffers.get(session_id) {
            Ok(buffer.get_content())
        } else {
            Ok(String::new()) // Return empty string if session not found or no buffer
        }
    }

    fn get_default_environment_vars(&self) -> HashMap<String, String> {
        std::env::vars().collect()
    }

    /// Session reconciliation - detects and handles orphaned/dead sessions
    pub async fn reconcile_sessions(&self, user_id: &str) -> Result<SessionReconciliationResult> {
        info!("Starting session reconciliation for user {}", user_id);

        let mut result = SessionReconciliationResult {
            recovered_sessions: 0,
            cleaned_sessions: 0,
            failed_sessions: 0,
            reconciliation_errors: Vec::new(),
        };

        // Get all active sessions for the user
        let active_sessions = match self.repository.list_active(user_id).await {
            Ok(sessions) => sessions,
            Err(e) => {
                error!("Failed to list active sessions for reconciliation: {}", e);
                result.reconciliation_errors.push(format!("Failed to list sessions: {}", e));
                return Ok(result);
            }
        };

        let now = Utc::now();

        for session in active_sessions {
            debug!("Reconciling session {} (status: {:?})", session.id, session.status);

            // Check if session is actually alive by testing PTY connection
            let is_alive = self.is_session_alive(&session.id).await;

            if !is_alive {
                info!("Session {} appears to be dead, attempting recovery", session.id);

                if session.can_recover && session.recovery_token.is_some() {
                    // Attempt to recover the session
                    match self.recover_dead_session(user_id, &session).await {
                        Ok(_) => {
                            info!("Successfully recovered session {}", session.id);
                            result.recovered_sessions += 1;
                        }
                        Err(e) => {
                            warn!("Failed to recover session {}: {}", session.id, e);
                            result.failed_sessions += 1;
                            result.reconciliation_errors.push(
                                format!("Failed to recover session {}: {}", session.id, e)
                            );

                            // Clean up the failed session
                            if let Err(cleanup_err) = self.cleanup_failed_session(user_id, &session.id).await {
                                error!("Failed to cleanup session {}: {}", session.id, cleanup_err);
                                result.reconciliation_errors.push(
                                    format!("Failed to cleanup session {}: {}", session.id, cleanup_err)
                                );
                            } else {
                                result.cleaned_sessions += 1;
                            }
                        }
                    }
                } else {
                    // Session is not recoverable, clean it up
                    info!("Session {} is not recoverable, cleaning up", session.id);
                    if let Err(e) = self.cleanup_failed_session(user_id, &session.id).await {
                        error!("Failed to cleanup session {}: {}", session.id, e);
                        result.reconciliation_errors.push(
                            format!("Failed to cleanup session {}: {}", session.id, e)
                        );
                        result.failed_sessions += 1;
                    } else {
                        result.cleaned_sessions += 1;
                    }
                }
            } else {
                debug!("Session {} is alive and healthy", session.id);
            }
        }

        // Clean up expired sessions based on idle time
        let idle_cleanup_threshold = now - chrono::Duration::hours(self.recovery_timeout_hours);
        match self.repository.cleanup_inactive(user_id, idle_cleanup_threshold).await {
            Ok(cleaned_count) => {
                if cleaned_count > 0 {
                    info!("Cleaned up {} idle sessions during reconciliation", cleaned_count);
                    result.cleaned_sessions += cleaned_count;
                }
            }
            Err(e) => {
                error!("Failed to cleanup idle sessions: {}", e);
                result.reconciliation_errors.push(format!("Failed to cleanup idle sessions: {}", e));
            }
        }

        info!("Session reconciliation completed for user {}: recovered={}, cleaned={}, failed={}",
              user_id, result.recovered_sessions, result.cleaned_sessions, result.failed_sessions);

        Ok(result)
    }

    /// Check if a session is actually alive by testing the PTY connection
    async fn is_session_alive(&self, session_id: &str) -> bool {
        // Try to send a simple command to test if the PTY is responsive
        let session_id_string = session_id.to_string();
        match self.pty_service.send_input(&session_id_string, b"echo 'ping'\n").await {
            Ok(_) => {
                // If we can send input, assume the session is alive
                // In a real implementation, we might want to wait for a response
                true
            }
            Err(_) => {
                // If we can't send input, the session is likely dead
                false
            }
        }
    }

    /// Attempt to recover a dead session
    async fn recover_dead_session(&self, user_id: &str, session: &Session) -> Result<()> {
        info!("Attempting to recover dead session {}", session.id);

        // First, clean up the old PTY session
        if let Err(e) = self.pty_service.destroy_session(&session.id).await {
            warn!("Failed to destroy old PTY session {}: {}", session.id, e);
            // Continue anyway, as the session might already be destroyed
        }

        // Create a new PTY session with the same configuration
        if let Some(ref workspace_id) = session.workspace_id {
            let terminal_size = session.terminal_size.clone()
                .unwrap_or(TerminalSize { cols: 80, rows: 24 });

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

            // Create new PTY session
            let (output_rx, _session_info) = self.pty_service.create_session(config).await?;

            // Recreate output forwarder
            let (forwarder, internal_rx) = OutputForwarder::new(session.id.clone());
            {
                let mut forwarders = self.output_forwarders.write().await;
                forwarders.insert(session.id.clone(), forwarder);
            }

            // Recreate rolling buffer for this session (5000 lines max)
            {
                let mut buffers = self.terminal_buffers.write().await;
                buffers.insert(session.id.clone(), RollingBuffer::new(5000));
            }

            // Start output forwarding task
            let websocket_manager = self.websocket_manager.clone();
            let terminal_buffers = self.terminal_buffers.clone();
            let session_id_clone = session.id.clone();
            tokio::spawn(async move {
                Self::handle_pty_output(output_rx, websocket_manager, terminal_buffers, session_id_clone, internal_rx).await;
            });

            // Update session status to active
            let update_request = UpdateSessionRequest {
                status: Some(SessionStatus::Active),
                current_working_dir: None,
                environment_vars: None,
                terminal_size: None,
                last_command: None,
                last_activity_at: Some(Utc::now()),
                shell_history: None,
            };

            self.repository.update(user_id, &session.id, update_request).await?;

            // Send recovery notification to any connected clients
            self.websocket_manager.forward_to_websockets(&session.id,
                "\r\n\x1b[1;33m● Session recovered after disconnection\x1b[0m\r\n".to_string()).await;

            info!("Successfully recovered session {}", session.id);
        } else {
            return Err(CoreError::Validation("Cannot recover session without workspace".to_string()));
        }

        Ok(())
    }

    /// Clean up a failed session
    async fn cleanup_failed_session(&self, user_id: &str, session_id: &str) -> Result<()> {
        info!("Cleaning up failed session {}", session_id);

        // Clean up output forwarder
        {
            let mut forwarders = self.output_forwarders.write().await;
            if let Some(forwarder) = forwarders.remove(session_id) {
                let _ = forwarder.forward_event(PtyEvent::Closed);
            }
        }

        // Clean up terminal buffer
        {
            let mut buffers = self.terminal_buffers.write().await;
            buffers.remove(session_id);
        }

        // Destroy PTY session
        let session_id_string = session_id.to_string();
        if let Err(e) = self.pty_service.destroy_session(&session_id_string).await {
            warn!("Failed to destroy PTY session during cleanup: {}", e);
        }

        // Send cleanup message to any connected WebSockets
        self.websocket_manager.forward_to_websockets(session_id,
            "\r\n\x1b[1;31m● Session cleaned up due to inactivity\x1b[0m\r\n".to_string()).await;

        // Mark session as terminated
        let update_request = UpdateSessionRequest {
            status: Some(SessionStatus::Terminated),
            current_working_dir: None,
            environment_vars: None,
            terminal_size: None,
            last_command: None,
            last_activity_at: Some(Utc::now()),
            shell_history: None,
        };

        self.repository.update(user_id, &session_id_string, update_request).await?;

        info!("Successfully cleaned up session {}", session_id);
        Ok(())
    }

    /// Start periodic session reconciliation task
    pub fn start_periodic_reconciliation(&self, user_id: String, interval_minutes: u64) -> tokio::task::JoinHandle<()> {
        let service = self.clone();
        let user_id_clone = user_id.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_minutes * 60));

            loop {
                interval.tick().await;
                info!("Running periodic session reconciliation for user {}", user_id_clone);

                match service.reconcile_sessions(&user_id_clone).await {
                    Ok(result) => {
                        if result.recovered_sessions > 0 || result.cleaned_sessions > 0 {
                            info!("Periodic reconciliation: recovered={}, cleaned={}, failed={}",
                                  result.recovered_sessions, result.cleaned_sessions, result.failed_sessions);
                        }
                    }
                    Err(e) => {
                        error!("Periodic session reconciliation failed: {}", e);
                    }
                }
            }
        })
    }
}

#[derive(Debug, Clone)]
pub struct SessionReconciliationResult {
    pub recovered_sessions: usize,
    pub cleaned_sessions: usize,
    pub failed_sessions: usize,
    pub reconciliation_errors: Vec<String>,
}

impl SessionReconciliationResult {
    pub fn total_processed(&self) -> usize {
        self.recovered_sessions + self.cleaned_sessions + self.failed_sessions
    }

    pub fn success_rate(&self) -> f64 {
        let total = self.total_processed();
        if total == 0 {
            0.0
        } else {
            (self.recovered_sessions + self.cleaned_sessions) as f64 / total as f64
        }
    }
}
