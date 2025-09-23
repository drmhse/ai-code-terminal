use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

// Import domain models for conversion
use act_core::pty::{SessionInfo as DomainSessionInfo, SessionStatus as DomainSessionStatus, PtySize as DomainTerminalSize};

// JSON field types for proper handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalLayoutConfig {
    pub layout_type: String,
    pub panels: Vec<PanelConfig>,
    pub active_panel: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelConfig {
    pub id: String,
    pub name: String,
    pub panel_type: String, // terminal, editor, split
    pub size: Option<PanelSize>,
    pub position: Option<PanelPosition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelSize {
    pub width: Option<u16>,
    pub height: Option<u16>,
    pub percentage: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

// Settings model has been removed - replaced by user-scoped user_settings table


// Terminal layout model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TerminalLayout {
    pub id: String,
    pub name: String,
    pub layout_type: String,
    pub configuration: String,
    pub is_default: bool,
    pub workspace_id: String,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Session model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: String,
    pub shell_pid: Option<i32>,
    pub socket_id: Option<String>,
    pub status: String,
    pub last_activity_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    
    // Session identification
    pub session_name: String,
    pub session_type: String,
    pub is_default_session: bool,
    
    // Session state
    pub current_working_dir: Option<String>,
    pub environment_vars: Option<String>,
    pub shell_history: Option<String>,
    pub terminal_size: Option<String>,
    pub last_command: Option<String>,
    pub session_timeout: Option<i32>,
    
    // Relations
    pub layout_id: Option<String>,
    pub workspace_id: Option<String>,
    pub user_id: String,
}

// User process model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserProcess {
    pub id: String,
    pub pid: i32,
    pub command: String,
    pub args: Option<String>,
    pub cwd: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub last_seen: DateTime<Utc>,
    pub auto_restart: bool,
    pub restart_count: i32,
    pub session_id: Option<String>,
    pub workspace_id: Option<String>,
}

// Rate limit model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RateLimit {
    pub id: String,
    pub client_ip: String,
    pub key_prefix: String,
    pub request_time: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

// CSRF token model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CsrfToken {
    pub id: String,
    pub token: String,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

// DTOs for API requests/responses

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub workspace_id: String,
    pub session_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalDataRequest {
    pub session_id: String,
    pub data: String,
}

// API response wrapper
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

// Standardized error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub error: String,
    pub message: String,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    #[allow(dead_code)]
    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
        }
    }
}

pub fn session_info_from_domain(domain: DomainSessionInfo) -> Session {
    let session_id = domain.session_id.clone();
    Session {
        id: domain.session_id,
        shell_pid: domain.pid.map(|pid| pid as i32),
        socket_id: None, // Not available in SessionInfo
        status: session_status_to_string(domain.status),
        last_activity_at: domain.created_at, // Use created_at as fallback
        created_at: domain.created_at,
        ended_at: None, // Not available in SessionInfo
        session_name: format!("Session {}", session_id), // Generate a name
        session_type: "terminal".to_string(), // Default to terminal
        is_default_session: false, // Default value
        current_working_dir: None, // Not available in SessionInfo
        environment_vars: None, // Not available in SessionInfo
        shell_history: None, // Not available in SessionInfo
        terminal_size: Some(serde_json::to_string(&TerminalSize {
            cols: domain.size.cols,
            rows: domain.size.rows,
        }).unwrap_or_default()),
        last_command: None, // Not available in SessionInfo
        session_timeout: None, // Not available in SessionInfo
        layout_id: None, // Not available in SessionInfo
        workspace_id: Some(domain.workspace_id),
        user_id: "".to_string(), // Will need to be set by caller
    }
}

pub fn session_status_to_string(status: DomainSessionStatus) -> String {
    match status {
        DomainSessionStatus::Active => "active".to_string(),
        DomainSessionStatus::Inactive => "inactive".to_string(),
        DomainSessionStatus::Terminated => "terminated".to_string(),
        DomainSessionStatus::Error(_) => "error".to_string(),
    }
}


#[allow(dead_code)]
pub fn terminal_size_from_domain(domain: DomainTerminalSize) -> TerminalSize {
    TerminalSize {
        cols: domain.cols,
        rows: domain.rows,
    }
}

// JSON field helper methods
impl TerminalLayout {
    #[allow(dead_code)]
    pub fn get_configuration(&self) -> Result<TerminalLayoutConfig, serde_json::Error> {
        serde_json::from_str(&self.configuration)
    }

    #[allow(dead_code)]
    pub fn set_configuration(&mut self, config: &TerminalLayoutConfig) -> Result<(), serde_json::Error> {
        self.configuration = serde_json::to_string(config)?;
        Ok(())
    }
}

impl Session {
    #[allow(dead_code)]
    pub fn get_environment_vars(&self) -> Result<Option<HashMap<String, String>>, serde_json::Error> {
        match &self.environment_vars {
            Some(env_vars) => Ok(Some(serde_json::from_str(env_vars)?)),
            None => Ok(None),
        }
    }

    #[allow(dead_code)]
    pub fn set_environment_vars(&mut self, env_vars: Option<&HashMap<String, String>>) -> Result<(), serde_json::Error> {
        self.environment_vars = match env_vars {
            Some(env) => Some(serde_json::to_string(env)?),
            None => None,
        };
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_terminal_size(&self) -> Result<Option<TerminalSize>, serde_json::Error> {
        match &self.terminal_size {
            Some(size_str) => Ok(Some(serde_json::from_str(size_str)?)),
            None => Ok(None),
        }
    }

    #[allow(dead_code)]
    pub fn set_terminal_size(&mut self, size: Option<&TerminalSize>) -> Result<(), serde_json::Error> {
        self.terminal_size = match size {
            Some(s) => Some(serde_json::to_string(s)?),
            None => None,
        };
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_shell_history(&self) -> Result<Option<Vec<String>>, serde_json::Error> {
        match &self.shell_history {
            Some(history_str) => Ok(Some(serde_json::from_str(history_str)?)),
            None => Ok(None),
        }
    }

    #[allow(dead_code)]
    pub fn set_shell_history(&mut self, history: Option<&Vec<String>>) -> Result<(), serde_json::Error> {
        self.shell_history = match history {
            Some(h) => Some(serde_json::to_string(h)?),
            None => None,
        };
        Ok(())
    }
}