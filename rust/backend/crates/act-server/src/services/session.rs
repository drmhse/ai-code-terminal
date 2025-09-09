use crate::{Database, services::PtyService};
use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};
use tracing::{debug, error, info, warn};
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
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone)]
pub struct ActiveSession {
    pub id: String,
    pub workspace_id: Option<String>,
    pub socket_id: Option<String>,
    pub recovery_token: String,
    pub terminal_size: Option<TerminalSize>,
    pub current_working_dir: Option<String>,
    pub last_command: Option<String>,
    pub shell_history: Vec<String>,
    pub last_activity: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct SessionManager {
    db: Database,
    pty_service: Arc<Mutex<PtyService>>,
    active_sessions: Arc<Mutex<HashMap<String, ActiveSession>>>,
    output_receivers: Arc<Mutex<HashMap<String, mpsc::UnboundedReceiver<String>>>>,
    recovery_timeout: Duration,
}

impl SessionManager {
    pub fn new(db: Database, pty_service: Arc<Mutex<PtyService>>) -> Self {
        Self {
            db,
            pty_service,
            active_sessions: Arc::new(Mutex::new(HashMap::new())),
            output_receivers: Arc::new(Mutex::new(HashMap::new())),
            recovery_timeout: Duration::hours(24), // 24 hour recovery window
        }
    }

    /// Create a new session with recovery capabilities
    #[allow(dead_code)]
    pub async fn create_session(
        &self,
        workspace_id: Option<String>,
        session_name: Option<String>,
        cols: Option<u16>,
        rows: Option<u16>
    ) -> anyhow::Result<SessionState> {
        let session_id = Uuid::new_v4().to_string();
        let recovery_token = Uuid::new_v4().to_string();
        let now = Utc::now();

        let terminal_size = if let (Some(c), Some(r)) = (cols, rows) {
            Some(TerminalSize { cols: c, rows: r })
        } else {
            Some(TerminalSize { cols: 80, rows: 24 }) // Default size
        };

        // Create PTY session if we have workspace
        if let Some(ref ws_id) = workspace_id {
            let pty_service = self.pty_service.lock().await;
            let (output_rx, _pid) = pty_service.create_session(
                session_id.clone(),
                ws_id.clone(),
                terminal_size.as_ref().unwrap().cols,
                terminal_size.as_ref().unwrap().rows
            ).map_err(|e| anyhow::anyhow!("Failed to create PTY session: {}", e))?;

            // Store the output receiver for proper session management
            {
                let mut receivers = self.output_receivers.lock().await;
                receivers.insert(session_id.clone(), output_rx);
            }
            
            info!("Stored output receiver for session {}", session_id);
        }

        let session_state = SessionState {
            session_id: session_id.clone(),
            workspace_id: workspace_id.clone(),
            current_working_dir: workspace_id.as_ref().map(|id| format!("./workspaces/{}", id)),
            environment_vars: std::env::vars().collect(),
            shell_history: Vec::new(),
            terminal_size: terminal_size.clone(),
            last_command: None,
            recovery_token: recovery_token.clone(),
            is_recoverable: true,
            created_at: now,
            last_activity: now,
        };

        // Store in database
        let env_vars_json = serde_json::to_string(&session_state.environment_vars)?;
        let history_json = serde_json::to_string(&session_state.shell_history)?;
        let size_json = serde_json::to_string(&session_state.terminal_size)?;

        sqlx::query(
            r#"
            INSERT INTO sessions (
                id, socket_id, status, last_activity_at, created_at,
                session_name, session_type, is_default_session,
                current_working_dir, environment_vars, shell_history,
                terminal_size, recovery_token, can_recover,
                max_idle_time, auto_cleanup, workspace_id
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
            )
            "#
        )
        .bind(&session_id)
        .bind(None::<String>) // socket_id - will be set when client connects
        .bind("active")
        .bind(now)
        .bind(now)
        .bind(session_name.as_deref().unwrap_or("Terminal"))
        .bind("terminal")
        .bind(false)
        .bind(&session_state.current_working_dir)
        .bind(&env_vars_json)
        .bind(&history_json)
        .bind(&size_json)
        .bind(&recovery_token)
        .bind(true)
        .bind(1440i32) // 24 hours in minutes
        .bind(true)
        .bind(&workspace_id)
        .execute(self.db.pool())
        .await?;

        // Store in active sessions
        {
            let mut sessions = self.active_sessions.lock().await;
            sessions.insert(session_id.clone(), ActiveSession {
                id: session_id.clone(),
                workspace_id: workspace_id.clone(),
                socket_id: None,
                recovery_token: recovery_token.clone(),
                terminal_size: terminal_size.clone(),
                current_working_dir: session_state.current_working_dir.clone(),
                last_command: None,
                shell_history: Vec::new(),
                last_activity: now,
                created_at: now,
            });
        }

        info!("Created session {} with recovery token", session_id);
        Ok(session_state)
    }

    /// Recover a session using recovery token
    pub async fn recover_session(&self, recovery_token: &str, socket_id: Option<&str>) -> anyhow::Result<SessionState> {
        // Query database for session with this recovery token
        let row = sqlx::query(
            "SELECT * FROM sessions WHERE recovery_token = ?1 AND can_recover = 1 AND status != 'terminated'"
        )
        .bind(recovery_token)
        .fetch_optional(self.db.pool())
        .await?;

        let row = row.ok_or_else(|| anyhow::anyhow!("Recovery token not found or session not recoverable"))?;

        let session_id: String = row.try_get("id")?;
        let workspace_id: Option<String> = row.try_get("workspace_id")?;
        let current_working_dir: Option<String> = row.try_get("current_working_dir")?;
        let env_vars_json: Option<String> = row.try_get("environment_vars")?;
        let history_json: Option<String> = row.try_get("shell_history")?;
        let size_json: Option<String> = row.try_get("terminal_size")?;
        let created_at: DateTime<Utc> = row.try_get("created_at")?;

        // Check if session is within recovery window
        let now = Utc::now();
        if now.signed_duration_since(created_at) > self.recovery_timeout {
            warn!("Session {} recovery token expired", session_id);
            return Err(anyhow::anyhow!("Recovery token expired"));
        }

        let environment_vars: HashMap<String, String> = if let Some(json) = env_vars_json {
            serde_json::from_str(&json).unwrap_or_default()
        } else {
            HashMap::new()
        };

        let shell_history: Vec<String> = if let Some(json) = history_json {
            serde_json::from_str(&json).unwrap_or_default()
        } else {
            Vec::new()
        };

        let terminal_size: Option<TerminalSize> = if let Some(json) = size_json {
            serde_json::from_str(&json).ok()
        } else {
            None
        };

        // Update session activity and socket ID
        sqlx::query(
            "UPDATE sessions SET last_activity_at = ?1, socket_id = ?2, status = 'active' WHERE id = ?3"
        )
        .bind(now)
        .bind(socket_id)
        .bind(&session_id)
        .execute(self.db.pool())
        .await?;

        let session_state = SessionState {
            session_id: session_id.clone(),
            workspace_id: workspace_id.clone(),
            current_working_dir: current_working_dir.clone(),
            environment_vars,
            shell_history: shell_history.clone(),
            terminal_size: terminal_size.clone(),
            last_command: row.try_get("last_command")?,
            recovery_token: recovery_token.to_string(),
            is_recoverable: true,
            created_at,
            last_activity: now,
        };

        // Add to active sessions
        {
            let mut sessions = self.active_sessions.lock().await;
            sessions.insert(session_id.clone(), ActiveSession {
                id: session_id.clone(),
                workspace_id,
                socket_id: socket_id.map(|s| s.to_string()),
                recovery_token: recovery_token.to_string(),
                terminal_size,
                current_working_dir,
                last_command: row.try_get("last_command").ok().flatten(),
                shell_history,
                last_activity: now,
                created_at,
            });
        }

        info!("Recovered session {} using recovery token", session_id);
        Ok(session_state)
    }

    /// Update session activity and state
    #[allow(dead_code)]
    pub async fn update_session(
        &self,
        session_id: &str,
        current_dir: Option<String>,
        last_command: Option<String>,
        history_entry: Option<String>
    ) -> anyhow::Result<()> {
        let now = Utc::now();

        // Update active sessions map
        {
            let mut sessions = self.active_sessions.lock().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.last_activity = now;

                if let Some(dir) = &current_dir {
                    session.current_working_dir = Some(dir.clone());
                }

                if let Some(cmd) = &last_command {
                    session.last_command = Some(cmd.clone());
                }

                if let Some(entry) = history_entry {
                    session.shell_history.push(entry);
                    // Keep only last 1000 history entries
                    if session.shell_history.len() > 1000 {
                        session.shell_history.remove(0);
                    }
                }
            }
        }

        // Update database
        let mut query_builder = sqlx::QueryBuilder::new("UPDATE sessions SET last_activity_at = ");
        query_builder.push_bind(now);

        if let Some(dir) = current_dir {
            query_builder.push(", current_working_dir = ");
            query_builder.push_bind(dir);
        }

        if let Some(cmd) = last_command {
            query_builder.push(", last_command = ");
            query_builder.push_bind(cmd);
        }

        // Update shell history in database
        if let Some(sessions) = self.active_sessions.lock().await.get(session_id) {
            let history_json = serde_json::to_string(&sessions.shell_history)?;
            query_builder.push(", shell_history = ");
            query_builder.push_bind(history_json);
        }

        query_builder.push(" WHERE id = ");
        query_builder.push_bind(session_id);

        query_builder.build().execute(self.db.pool()).await?;

        debug!("Updated session {} activity", session_id);
        Ok(())
    }

    /// Get session state
    #[allow(dead_code)]
    pub async fn get_session(&self, session_id: &str) -> Option<ActiveSession> {
        let sessions = self.active_sessions.lock().await;
        sessions.get(session_id).cloned()
    }

    /// List active sessions
    pub async fn list_active_sessions(&self) -> Vec<ActiveSession> {
        let sessions = self.active_sessions.lock().await;
        sessions.values().cloned().collect()
    }

    /// Get output receiver for a session (for real-time output streaming)
    pub async fn get_output_receiver(&self, session_id: &str) -> Option<mpsc::UnboundedReceiver<String>> {
        let mut receivers = self.output_receivers.lock().await;
        receivers.remove(session_id)
    }

    /// Terminate session
    pub async fn terminate_session(&self, session_id: &str) -> anyhow::Result<()> {
        let now = Utc::now();

        // Remove from active sessions
        {
            let mut sessions = self.active_sessions.lock().await;
            sessions.remove(session_id);
        }

        // Remove output receiver
        {
            let mut receivers = self.output_receivers.lock().await;
            receivers.remove(session_id);
        }

        // Terminate PTY session
        let pty_service = self.pty_service.lock().await;
        if let Err(e) = pty_service.destroy_session(session_id) {
            warn!("Failed to destroy PTY session {}: {}", session_id, e);
        }

        // Update database
        sqlx::query(
            "UPDATE sessions SET status = 'terminated', ended_at = ?1, can_recover = 0 WHERE id = ?2"
        )
        .bind(now)
        .bind(session_id)
        .execute(self.db.pool())
        .await?;

        info!("Terminated session {}", session_id);
        Ok(())
    }

    /// Cleanup expired sessions
    pub async fn cleanup_expired_sessions(&self) -> anyhow::Result<u64> {
        let now = Utc::now();
        let cleanup_threshold = now - Duration::minutes(1440); // 24 hours

        // Get expired sessions
        let rows = sqlx::query(
            "SELECT id FROM sessions WHERE last_activity_at < ?1 AND status = 'active' AND auto_cleanup = 1"
        )
        .bind(cleanup_threshold)
        .fetch_all(self.db.pool())
        .await?;

        let mut cleaned_count = 0;

        for row in rows {
            let session_id: String = row.try_get("id")?;

            if let Err(e) = self.terminate_session(&session_id).await {
                error!("Failed to cleanup session {}: {}", session_id, e);
            } else {
                cleaned_count += 1;
            }
        }

        if cleaned_count > 0 {
            info!("Cleaned up {} expired sessions", cleaned_count);
        }

        Ok(cleaned_count)
    }

    /// Resize terminal for session
    #[allow(dead_code)]
    pub async fn resize_terminal(&self, session_id: &str, cols: u16, rows: u16) -> anyhow::Result<()> {
        let terminal_size = TerminalSize { cols, rows };

        // Update active session
        {
            let mut sessions = self.active_sessions.lock().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.terminal_size = Some(terminal_size.clone());
            }
        }

        // Resize PTY
        let pty_service = self.pty_service.lock().await;
        pty_service.resize_session(session_id, cols, rows)
                .map_err(|e| anyhow::anyhow!("Failed to resize PTY session: {}", e))?;

        // Update database
        let size_json = serde_json::to_string(&terminal_size)?;
        sqlx::query("UPDATE sessions SET terminal_size = ?1 WHERE id = ?2")
            .bind(size_json)
            .bind(session_id)
            .execute(self.db.pool())
            .await?;

        debug!("Resized terminal for session {} to {}x{}", session_id, cols, rows);
        Ok(())
    }
}
