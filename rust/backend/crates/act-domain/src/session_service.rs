use std::sync::Arc;

use act_core::{
    repository::{
        Session, SessionRepository, CreateSessionRequest, UpdateSessionRequest, 
        SessionId, SessionStatus, SessionType, TerminalSize, WorkspaceId
    },
    pty::PtyService,
    Result, CoreError
};


use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn, debug};
use uuid::Uuid;

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
    pub session_name: String,
    pub session_type: SessionType,
    pub terminal_size: Option<TerminalSize>,
    pub is_recoverable: bool,
    pub auto_cleanup: bool,
    pub max_idle_minutes: i32,
}

impl Default for CreateSessionOptions {
    fn default() -> Self {
        Self {
            workspace_id: None,
            session_name: "Terminal".to_string(),
            session_type: SessionType::Terminal,
            terminal_size: Some(TerminalSize { cols: 80, rows: 24 }),
            is_recoverable: true,
            auto_cleanup: true,
            max_idle_minutes: 1440, // 24 hours
        }
    }
}

pub struct SessionService {
    repository: Arc<dyn SessionRepository>,
    pty_service: Arc<dyn PtyService>,
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
            recovery_timeout_hours: recovery_timeout_hours.unwrap_or(24),
        }
    }

    pub async fn create_session(&self, options: CreateSessionOptions) -> Result<SessionState> {
let session_id = Uuid::new_v4().to_string();
        let recovery_token = session_id.clone();
        
        let _now = Utc::now();

        let terminal_size = options.terminal_size.unwrap_or(TerminalSize { cols: 80, rows: 24 });

        let environment_vars = self.get_default_environment_vars();

        let request = CreateSessionRequest {
            workspace_id: options.workspace_id.clone(),
            session_name: options.session_name.clone(),
            session_type: options.session_type,
            terminal_size: Some(terminal_size.clone()),
            layout_id: None,
        };

        let mut session = self.repository.create(request).await?;

        session.recovery_token = Some(recovery_token.clone());
        session.can_recover = options.is_recoverable;
        session.auto_cleanup = options.auto_cleanup;
        session.max_idle_time = options.max_idle_minutes;
        session.environment_vars = Some(environment_vars.clone());
        session.current_working_dir = options.workspace_id.as_ref()
            .map(|id| format!("./workspaces/{}", id));

        if let Some(ref workspace_id) = options.workspace_id {
            let config = act_core::pty::SessionConfig {
                session_id: session.id.clone(),
                workspace_id: workspace_id.clone(),
                size: act_core::pty::PtySize {
                    cols: terminal_size.cols,
                    rows: terminal_size.rows,
                    pixel_width: 0,
                    pixel_height: 0,
                },
                shell: None,
                working_dir: session.current_working_dir.clone(),
                environment: session.environment_vars.clone(),
            };
            
            let (_output_rx, _session_info) = self.pty_service.create_session(config).await?;

            info!("Created PTY session for session {}", session.id);
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

    pub async fn recover_session(&self, recovery_token: &str) -> Result<SessionState> {
        let sessions = self.repository.list_active().await?;
        
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

        self.repository.update_activity(&session.id).await?;

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
        let session = self.repository.get_by_id(session_id).await?;
            let mut history = session.shell_history.unwrap_or_default();
            
            history.push(entry);
            if history.len() > 1000 {
                history.remove(0);
            }
            
            // Note: This would need to be handled differently in actual implementation
            // as UpdateSessionRequest doesn't have shell_history field
        }

        self.repository.update(session_id, update_request).await?;
        
        debug!("Updated session {} state", session_id);
        Ok(())
    }

    pub async fn get_session(&self, session_id: &SessionId) -> Result<Session> {
        self.repository.get_by_id(session_id).await
    }

    pub async fn list_active_sessions(&self) -> Result<Vec<Session>> {
        self.repository.list_active().await
    }

    pub async fn list_workspace_sessions(&self, workspace_id: &WorkspaceId) -> Result<Vec<Session>> {
        self.repository.list_by_workspace(workspace_id).await
    }

    pub async fn terminate_session(&self, session_id: &SessionId) -> Result<()> {
        let _session = self.repository.get_by_id(session_id).await?;

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

        self.repository.update(session_id, update_request).await?;

        info!("Terminated session {}", session_id);
        Ok(())
    }

    pub async fn cleanup_expired_sessions(&self) -> Result<usize> {
        let cleanup_threshold = Utc::now() - Duration::hours(24);
        let cleaned_count = self.repository.cleanup_inactive(cleanup_threshold).await?;

        if cleaned_count > 0 {
            info!("Cleaned up {} expired sessions", cleaned_count);
        }

        Ok(cleaned_count)
    }

    pub async fn resize_terminal(&self, session_id: &SessionId, cols: u16, rows: u16) -> Result<()> {
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

        self.repository.update(session_id, update_request).await?;

        debug!("Resized terminal for session {} to {}x{}", session_id, cols, rows);
        Ok(())
    }

    pub async fn send_input(&self, session_id: &SessionId, data: &[u8]) -> Result<()> {
        self.pty_service.send_input(session_id, data).await
    }

    fn get_default_environment_vars(&self) -> HashMap<String, String> {
        std::env::vars().collect()
    }
}