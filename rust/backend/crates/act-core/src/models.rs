pub use crate::repository::{
    CreateLayoutRequest, CreateProcessRequest, CreateWorkspaceRequest, LayoutId,
    UpdateLayoutRequest, UpdateProcessRequest, UpdateWorkspaceRequest, UserId, Workspace,
    WorkspaceId,
};

pub use crate::filesystem::{
    CopyRequest, CreateDirectoryRequest, CreateFileRequest, DirectoryListing, FileContent,
    FileItem, FilePermissions, MoveRequest,
};

pub use crate::pty::{
    PtyEvent, PtySize, SessionConfig, SessionId as PtySessionId, SessionInfo,
    WorkspaceId as PtyWorkspaceId,
};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// Pagination support models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub offset: Option<u32>,
    pub limit: Option<u32>,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: Some(1),
            page_size: Some(20),
            offset: None,
            limit: None,
        }
    }
}

impl PaginationParams {
    pub fn new(page: u32, page_size: u32) -> Self {
        Self {
            page: Some(page),
            page_size: Some(page_size),
            offset: None,
            limit: None,
        }
    }

    pub fn with_limit(limit: u32) -> Self {
        Self {
            page: None,
            page_size: None,
            offset: None,
            limit: Some(limit),
        }
    }

    pub fn get_offset(&self) -> u32 {
        if let Some(offset) = self.offset {
            return offset;
        }

        match (self.page, self.page_size) {
            (Some(page), Some(page_size)) => (page - 1) * page_size,
            _ => 0,
        }
    }

    pub fn get_limit(&self) -> u32 {
        self.limit.or(self.page_size).unwrap_or(20)
    }

    pub fn validate(&self) -> Result<(), String> {
        let page_size = self.get_limit();
        if page_size > 100 {
            return Err("Page size cannot exceed 100".to_string());
        }
        if page_size == 0 {
            return Err("Page size must be greater than 0".to_string());
        }

        if let Some(page) = self.page {
            if page == 0 {
                return Err("Page number must be greater than 0".to_string());
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationInfo {
    pub page: u32,
    pub page_size: u32,
    pub total_count: u64,
    pub total_pages: u32,
    pub has_next: bool,
    pub has_prev: bool,
}

impl PaginationInfo {
    pub fn new(page: u32, page_size: u32, total_count: u64) -> Self {
        let total_pages = ((total_count as f64) / (page_size as f64)).ceil() as u32;
        let total_pages = if total_pages == 0 { 1 } else { total_pages };

        Self {
            page,
            page_size,
            total_count,
            total_pages,
            has_next: page < total_pages,
            has_prev: page > 1,
        }
    }
}

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
