pub use crate::repository::{
    Workspace, Session, SessionStatus, SessionType, TerminalSize,
    CreateWorkspaceRequest, UpdateWorkspaceRequest, 
    CreateSessionRequest, UpdateSessionRequest,
    WorkspaceId, SessionId, LayoutId, UserId
};

pub use crate::filesystem::{
    FileItem, FilePermissions, DirectoryListing, FileContent,
    CreateFileRequest, CreateDirectoryRequest, MoveRequest, CopyRequest
};

pub use crate::pty::{
    PtyEvent, PtySize, SessionConfig, SessionInfo,
    SessionId as PtySessionId, WorkspaceId as PtyWorkspaceId
};

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub id: String,
    pub github_token: Option<String>,
    pub github_refresh_token: Option<String>,
    pub github_token_expires_at: Option<DateTime<Utc>>,
    pub theme: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalLayout {
    pub id: LayoutId,
    pub name: String,
    pub layout_type: String,
    pub configuration: TerminalLayoutConfig,
    pub is_default: bool,
    pub workspace_id: WorkspaceId,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

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
    pub panel_type: PanelType,
    pub size: Option<PanelSize>,
    pub position: Option<PanelPosition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PanelType {
    Terminal,
    Editor,
    Split,
    Custom(String),
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
pub struct UserProcess {
    pub id: String,
    pub pid: i32,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub cwd: String,
    pub status: ProcessStatus,
    pub exit_code: Option<i32>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub last_seen: DateTime<Utc>,
    pub auto_restart: bool,
    pub restart_count: i32,
    pub session_id: Option<SessionId>,
    pub workspace_id: Option<WorkspaceId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessStatus {
    Running,
    Stopped,
    Terminated,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub timestamp: DateTime<Utc>,
    pub cpu_usage_percent: f64,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub uptime_seconds: u64,
    pub load_average: f64,
    pub process_count: u32,
    pub network_rx: u64,
    pub network_tx: u64,
    pub active_sessions: u32,
    pub active_processes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
        }
    }
}