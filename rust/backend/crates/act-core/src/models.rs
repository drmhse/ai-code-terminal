pub use crate::repository::{
    Workspace,
    CreateWorkspaceRequest, UpdateWorkspaceRequest,
    CreateLayoutRequest, UpdateLayoutRequest,
    CreateProcessRequest, UpdateProcessRequest,
    WorkspaceId, LayoutId, UserId
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
    pub layout_type: String, // "hierarchical" - keeping for potential future layout types
    pub tree_structure: String, // JSON string of hierarchical layout (required)
    pub is_default: bool,
    pub workspace_id: WorkspaceId,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}


// New hierarchical layout models (matching frontend TypeScript interfaces)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HierarchicalLayout {
    pub root: PaneNode,
    pub active_node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: PaneNodeType,
    pub size: f32, // Percentage of parent space (0-100)

    // Container properties
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<SplitDirection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<PaneNode>>,

    // Terminal properties
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tabs: Option<Vec<TerminalTabConfig>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_tab_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaneNodeType {
    Container,
    Terminal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalTabConfig {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub is_active: bool,
    pub order: i32,
    pub buffer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    pub size: TerminalTabSize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalTabSize {
    pub cols: i32,
    pub rows: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProcess {
    pub id: String,
    pub name: String,
    pub pid: Option<i32>,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub working_directory: String,
    pub environment_variables: Option<std::collections::HashMap<String, String>>,
    pub status: ProcessStatus,
    pub exit_code: Option<i32>,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub restart_count: i32,
    pub max_restarts: i32,
    pub auto_restart: bool,
    pub user_id: String,
    pub workspace_id: Option<WorkspaceId>,
    pub session_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub data: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProcessStatus {
    Starting,
    Running,
    Stopped,
    Failed,
    Crashed,
    Restarting,
    Terminated,
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