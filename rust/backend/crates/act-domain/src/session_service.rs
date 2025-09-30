use std::sync::Arc;
use std::collections::{HashMap, VecDeque};
use tokio::sync::{RwLock, Mutex};
use act_core::{
    Result, CoreError,
    pty::{PtyService, SessionConfig, SessionInfo, PtySize, PtyEvent, SessionId},
};
use tracing::{info, error, debug, warn};

// Type aliases for clarity
pub type UserId = String;
pub type ConnectionId = String;

/// Line-based rolling buffer for terminal output persistence (tmux/screen approach)
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

/// In-memory state for a single user's live session data
#[derive(Debug, Default)]
pub struct UserLiveState {
    /// Active PTY sessions for this user (sessionId -> SessionInfo)
    pub pty_sessions: HashMap<SessionId, SessionInfo>,
}

impl UserLiveState {
    pub fn new() -> Self {
        Self::default()
    }
}

/// Terminal output event for broadcasting
#[derive(serde::Serialize, Debug, Clone)]
pub struct TerminalOutputEvent {
    pub session_id: String,
    pub output: String,
}

/// Output event callback trait for handling PTY output
pub trait OutputEventHandler: Send + Sync {
    fn handle_output(&self, user_id: &str, event: TerminalOutputEvent);
}

/// Refactored SessionService - now the authority on managing live PTY sessions
#[derive(Clone)]
pub struct SessionService {
    /// Terminal buffers for session restoration
    terminal_buffers: Arc<RwLock<HashMap<String, RollingBuffer>>>,
    /// PTY service for terminal operations
    pty_service: Arc<dyn PtyService>,
    /// In-memory live state for real-time multi-device synchronization
    live_state: Arc<RwLock<HashMap<UserId, UserLiveState>>>,
    /// Output event handlers (injected by server layer)
    output_handlers: Arc<RwLock<Vec<Arc<dyn OutputEventHandler>>>>,
}

impl SessionService {
    pub fn new(pty_service: Arc<dyn PtyService>) -> Self {
        Self {
            terminal_buffers: Arc::new(RwLock::new(HashMap::new())),
            pty_service,
            live_state: Arc::new(RwLock::new(HashMap::new())),
            output_handlers: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Add an output event handler (typically called by server layer)
    pub async fn add_output_handler(&self, handler: Arc<dyn OutputEventHandler>) {
        let mut handlers = self.output_handlers.write().await;
        handlers.push(handler);
    }

    /// Get or create a PTY session for multi-device sharing
    /// This is the core method implementing the multi-device synchronization logic
    pub async fn get_or_create_pty_session(
        &self,
        user_id: &str,
        session_id: &str,
        workspace_id: &str,
        workspace_path: Option<String>,
        pane_id: Option<String>,
    ) -> Result<bool> {
        let mut live_state = self.live_state.write().await;

        // Get or create user state
        let user_state = live_state.entry(user_id.to_string()).or_insert_with(UserLiveState::new);

        // Check if PTY session already exists
        if user_state.pty_sessions.contains_key(session_id) {
            info!("🔗 PTY session {} already exists for user {}, sharing across devices", session_id, user_id);

            // Send existing buffer content to newly connected client
            self.send_buffer_to_handlers(session_id).await?;

            return Ok(false); // Session already existed
        }

        // Create new PTY session
        info!("🆕 Creating new PTY session {} for user {}", session_id, user_id);

        let config = SessionConfig {
            session_id: session_id.to_string(),
            workspace_id: workspace_id.to_string(),
            pane_id,
            size: PtySize {
                cols: 80,
                rows: 24,
                pixel_width: 0,
                pixel_height: 0,
            },
            shell: None,
            working_dir: workspace_path,
            environment: None,
        };

        let (event_receiver, session_info) = self.pty_service.create_session(config).await?;

        // Store session info in live state
        user_state.pty_sessions.insert(
            session_id.to_string(),
            session_info.clone()
        );

        // Initialize terminal buffer for this session
        self.initialize_terminal_buffer(session_id).await?;

        // Start PTY output broadcasting task
        let service_clone = self.clone();
        let user_id_clone = user_id.to_string();
        let session_id_clone = session_id.to_string();

        tokio::spawn(async move {
            service_clone.pty_output_broadcaster(
                user_id_clone,
                session_id_clone,
                Arc::new(Mutex::new(event_receiver))
            ).await;
        });

        Ok(true) // New session was created
    }

    /// PTY output broadcasting task - listens to PTY events and broadcasts to handlers
    async fn pty_output_broadcaster(
        &self,
        user_id: String,
        session_id: String,
        event_receiver: Arc<Mutex<tokio::sync::mpsc::UnboundedReceiver<PtyEvent>>>
    ) {
        info!("🎯 Starting PTY output broadcaster for session {}", session_id);

        let mut receiver = event_receiver.lock().await;
        while let Some(event) = receiver.recv().await {
            match event {
                PtyEvent::Output(data) => {
                    let output = String::from_utf8_lossy(&data);

                    // Append to terminal buffer for persistence
                    if let Err(e) = self.append_to_buffer(&session_id, &output).await {
                        error!("Failed to append to terminal buffer: {}", e);
                    }

                    // Notify output handlers
                    let output_event = TerminalOutputEvent {
                        session_id: session_id.clone(),
                        output: output.to_string(),
                    };

                    let handlers = self.output_handlers.read().await;
                    for handler in handlers.iter() {
                        handler.handle_output(&user_id, output_event.clone());
                    }
                }
                PtyEvent::Closed => {
                    info!("🔚 PTY session {} closed", session_id);
                    // Remove session from live state
                    if let Err(e) = self.remove_pty_session(&user_id, &session_id).await {
                        error!("Failed to remove PTY session: {}", e);
                    }
                    break;
                }
                PtyEvent::Error(error) => {
                    error!("🚨 PTY session {} error: {}", session_id, error);
                    break;
                }
                PtyEvent::Resized { cols, rows } => {
                    debug!("📐 PTY session {} resized to {}x{}", session_id, cols, rows);
                }
            }
        }

        info!("🏁 PTY output broadcaster ended for session {}", session_id);
    }

    /// Check if a PTY session exists for a user
    pub async fn has_pty_session(
        &self,
        user_id: &str,
        session_id: &str,
    ) -> Result<bool> {
        let live_state = self.live_state.read().await;

        if let Some(user_state) = live_state.get(user_id) {
            return Ok(user_state.pty_sessions.contains_key(session_id));
        }

        Ok(false)
    }

    /// Remove a PTY session from live state
    pub async fn remove_pty_session(
        &self,
        user_id: &str,
        session_id: &str,
    ) -> Result<()> {
        let mut live_state = self.live_state.write().await;

        if let Some(user_state) = live_state.get_mut(user_id) {
            user_state.pty_sessions.remove(session_id);
            info!("🗑️ Removed PTY session {} for user {}", session_id, user_id);
        }

        // Also remove terminal buffer
        self.remove_terminal_buffer(session_id).await?;

        Ok(())
    }

    /// Send input to a PTY session
    pub async fn send_input_to_session(
        &self,
        user_id: &str,
        session_id: &str,
        input: &[u8],
    ) -> Result<()> {
        // Check if session exists for this user
        if !self.has_pty_session(user_id, session_id).await? {
            return Err(CoreError::NotFound(format!("Session {} not found for user {}", session_id, user_id)));
        }

        self.pty_service.send_input(&session_id.to_string(), input).await
    }

    /// Resize a PTY session
    pub async fn resize_session(
        &self,
        user_id: &str,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<()> {
        // Check if session exists for this user
        if !self.has_pty_session(user_id, session_id).await? {
            return Err(CoreError::NotFound(format!("Session {} not found for user {}", session_id, user_id)));
        }

        let size = PtySize {
            cols: cols.max(1),
            rows: rows.max(1),
            pixel_width: 0,
            pixel_height: 0,
        };

        self.pty_service.resize_session(&session_id.to_string(), size).await
    }

    /// Terminate a PTY session
    pub async fn terminate_session(
        &self,
        user_id: &str,
        session_id: &str,
    ) -> Result<()> {
        // Check if session exists for this user
        if !self.has_pty_session(user_id, session_id).await? {
            return Err(CoreError::NotFound(format!("Session {} not found for user {}", session_id, user_id)));
        }

        // Destroy the PTY session
        self.pty_service.destroy_session(&session_id.to_string()).await?;

        // Remove from live state and buffers
        self.remove_pty_session(user_id, session_id).await?;

        Ok(())
    }

    /// List active sessions for a user
    pub async fn list_active_sessions(&self, user_id: &str) -> Result<Vec<SessionInfo>> {
        let live_state = self.live_state.read().await;

        if let Some(user_state) = live_state.get(user_id) {
            return Ok(user_state.pty_sessions.values().cloned().collect());
        }

        Ok(vec![])
    }

    /// List active sessions for a user in a specific workspace
    pub async fn list_workspace_sessions(&self, user_id: &str, workspace_id: &str) -> Result<Vec<SessionInfo>> {
        let live_state = self.live_state.read().await;

        if let Some(user_state) = live_state.get(user_id) {
            let workspace_sessions: Vec<SessionInfo> = user_state.pty_sessions
                .values()
                .filter(|session| session.workspace_id == workspace_id)
                .cloned()
                .collect();
            return Ok(workspace_sessions);
        }

        Ok(vec![])
    }

    // === Terminal buffer management methods ===

    /// Initialize terminal buffer for a session
    pub async fn initialize_terminal_buffer(&self, session_id: &str) -> Result<()> {
        let mut buffers = self.terminal_buffers.write().await;
        buffers.insert(session_id.to_string(), RollingBuffer::new(5000));
        Ok(())
    }

    /// Append output to terminal buffer
    pub async fn append_to_buffer(&self, session_id: &str, output: &str) -> Result<()> {
        let mut buffers = self.terminal_buffers.write().await;
        if let Some(buffer) = buffers.get_mut(session_id) {
            buffer.append(output.to_string());
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

    /// Remove terminal buffer when session ends
    pub async fn remove_terminal_buffer(&self, session_id: &str) -> Result<()> {
        let mut buffers = self.terminal_buffers.write().await;
        buffers.remove(session_id);
        Ok(())
    }

    /// Send existing buffer content to all output handlers (for session reconnection)
    async fn send_buffer_to_handlers(&self, session_id: &str) -> Result<()> {
        // Get the existing buffer content
        let buffer_content = self.get_terminal_buffer(session_id).await?;

        if !buffer_content.is_empty() {
            info!("📤 Sending {} characters of buffered content for session {}", buffer_content.len(), session_id);

            // Send buffer content to all registered output handlers
            let handlers = self.output_handlers.read().await;
            for handler in &*handlers {
                handler.handle_output(session_id, TerminalOutputEvent {
                    session_id: session_id.to_string(),
                    output: buffer_content.clone(),
                });
            }
        } else {
            debug!("📭 No buffered content to send for session {}", session_id);
        }

        Ok(())
    }

    /// Get session info for a specific session
    pub async fn get_session_info(
        &self,
        user_id: &str,
        session_id: &str,
    ) -> Result<Option<SessionInfo>> {
        let live_state = self.live_state.read().await;

        if let Some(user_state) = live_state.get(user_id) {
            if let Some(session_info) = user_state.pty_sessions.get(session_id) {
                return Ok(Some(session_info.clone()));
            }
        }

        Ok(None)
    }

    /// Count all active sessions across all users
    pub async fn count_all_active_sessions(&self) -> Result<usize> {
        let live_state = self.live_state.read().await;

        let total_sessions = live_state.values()
            .map(|user_state| user_state.pty_sessions.len())
            .sum();

        Ok(total_sessions)
    }

    /// Clean up terminated sessions for a user
    pub async fn cleanup_terminated_sessions(&self, user_id: &str) -> Result<usize> {
        let mut live_state = self.live_state.write().await;
        let mut cleaned_count = 0;

        if let Some(user_state) = live_state.get_mut(user_id) {
            let mut sessions_to_remove = Vec::new();

            // Check each session's status via PTY service
            for session_id in user_state.pty_sessions.keys() {
                match self.pty_service.get_session_info(session_id).await {
                    Ok(current_info) => {
                        // If session is terminated, mark for removal
                        if matches!(current_info.status, act_core::pty::SessionStatus::Terminated | act_core::pty::SessionStatus::Error(_)) {
                            sessions_to_remove.push(session_id.clone());
                        }
                    }
                    Err(_) => {
                        // If we can't get session info, it's likely dead
                        sessions_to_remove.push(session_id.clone());
                    }
                }
            }

            // Remove terminated sessions
            for session_id in sessions_to_remove {
                user_state.pty_sessions.remove(&session_id);
                // Also clean up terminal buffer
                let mut buffers = self.terminal_buffers.write().await;
                buffers.remove(&session_id);
                cleaned_count += 1;
                info!("Cleaned up terminated session: {}", session_id);
            }
        }

        Ok(cleaned_count)
    }

    /// Update the pane association for an existing session
    pub async fn update_session_pane_association(
        &self,
        user_id: &str,
        session_id: &str,
        new_pane_id: String,
    ) -> Result<()> {
        // Check if session exists for this user
        if !self.has_pty_session(user_id, session_id).await? {
            return Err(CoreError::NotFound(format!("Session {} not found for user {}", session_id, user_id)));
        }

        let mut live_state = self.live_state.write().await;

        if let Some(user_state) = live_state.get_mut(user_id) {
            if let Some(session_info) = user_state.pty_sessions.get_mut(session_id) {
                session_info.pane_id = Some(new_pane_id.clone());
                info!("Updated pane association for session {} to pane {}", session_id, new_pane_id);

                // Also update the PTY service to keep it synchronized
                drop(live_state); // Release the lock before calling PTY service
                if let Err(e) = self.pty_service.update_session_pane_id(&session_id.to_string(), Some(new_pane_id)).await {
                    warn!("Failed to update pane_id in PTY service for session {}: {}", session_id, e);
                }

                return Ok(());
            }
        }

        Err(CoreError::NotFound(format!("Session {} not found for user {}", session_id, user_id)))
    }
}