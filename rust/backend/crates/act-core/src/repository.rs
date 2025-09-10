use crate::Result;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type WorkspaceId = String;
pub type SessionId = String;
pub type LayoutId = String;
pub type UserId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: WorkspaceId,
    pub name: String,
    pub github_repo: String,
    pub github_url: String,
    pub local_path: String,
    pub is_active: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: SessionId,
    pub shell_pid: Option<i32>,
    pub socket_id: Option<String>,
    pub status: SessionStatus,
    pub last_activity_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    
    pub session_name: String,
    pub session_type: SessionType,
    pub is_default_session: bool,
    
    pub current_working_dir: Option<String>,
    pub environment_vars: Option<HashMap<String, String>>,
    pub shell_history: Option<Vec<String>>,
    pub terminal_size: Option<TerminalSize>,
    pub last_command: Option<String>,
    pub session_timeout: Option<i32>,
    pub recovery_token: Option<String>,
    
    pub can_recover: bool,
    pub max_idle_time: i32,
    pub auto_cleanup: bool,
    
    pub layout_id: Option<LayoutId>,
    pub workspace_id: Option<WorkspaceId>,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionStatus {
    Active,
    Inactive,
    Terminated,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionType {
    Terminal,
    Editor,
    Debug,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub github_repo: String,
    pub github_url: String,
    pub local_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub is_active: Option<bool>,
    pub last_sync_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub session_id: Option<String>,
    pub workspace_id: Option<WorkspaceId>,
    pub session_name: String,
    pub session_type: SessionType,
    pub terminal_size: Option<TerminalSize>,
    pub layout_id: Option<LayoutId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSessionRequest {
    pub status: Option<SessionStatus>,
    pub current_working_dir: Option<String>,
    pub environment_vars: Option<HashMap<String, String>>,
    pub terminal_size: Option<TerminalSize>,
    pub last_command: Option<String>,
    pub last_activity_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateLayoutRequest {
    pub name: String,
    pub layout_type: String,
    pub configuration: crate::models::TerminalLayoutConfig,
    pub is_default: Option<bool>,
    pub workspace_id: WorkspaceId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateLayoutRequest {
    pub name: Option<String>,
    pub configuration: Option<crate::models::TerminalLayoutConfig>,
    pub is_default: Option<bool>,
}

#[async_trait]
pub trait WorkspaceRepository: Send + Sync {
    async fn create(&self, user_id: &str, request: CreateWorkspaceRequest) -> Result<Workspace>;
    
    async fn get_by_id(&self, user_id: &str, id: &WorkspaceId) -> Result<Workspace>;
    
    async fn get_by_github_repo(&self, user_id: &str, repo: &str) -> Result<Option<Workspace>>;
    
    async fn list_all(&self, user_id: &str) -> Result<Vec<Workspace>>;
    
    async fn list_active(&self, user_id: &str) -> Result<Vec<Workspace>>;
    
    async fn update(&self, user_id: &str, id: &WorkspaceId, request: UpdateWorkspaceRequest) -> Result<Workspace>;
    
    async fn delete(&self, user_id: &str, id: &WorkspaceId) -> Result<()>;
    
    async fn set_active(&self, user_id: &str, id: &WorkspaceId, active: bool) -> Result<()>;
}

#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn create(&self, user_id: &str, request: CreateSessionRequest) -> Result<Session>;
    
    async fn get_by_id(&self, user_id: &str, id: &SessionId) -> Result<Session>;
    
    async fn list_by_workspace(&self, user_id: &str, workspace_id: &WorkspaceId) -> Result<Vec<Session>>;
    
    async fn list_active(&self, user_id: &str) -> Result<Vec<Session>>;
    
    async fn list_by_status(&self, user_id: &str, status: SessionStatus) -> Result<Vec<Session>>;
    
    async fn update(&self, user_id: &str, id: &SessionId, request: UpdateSessionRequest) -> Result<Session>;
    
    async fn delete(&self, user_id: &str, id: &SessionId) -> Result<()>;
    
    async fn cleanup_inactive(&self, user_id: &str, older_than: DateTime<Utc>) -> Result<usize>;
    
    async fn set_shell_pid(&self, user_id: &str, id: &SessionId, pid: Option<i32>) -> Result<()>;
    
    async fn update_activity(&self, user_id: &str, id: &SessionId) -> Result<()>;
}

#[async_trait]
pub trait LayoutRepository: Send + Sync {
    async fn create(&self, user_id: &str, request: CreateLayoutRequest) -> Result<crate::models::TerminalLayout>;
    
    async fn get_by_id(&self, user_id: &str, id: &LayoutId) -> Result<crate::models::TerminalLayout>;
    
    async fn list_for_workspace(&self, user_id: &str, workspace_id: &WorkspaceId) -> Result<Vec<crate::models::TerminalLayout>>;
    
    async fn list_all(&self, user_id: &str) -> Result<Vec<crate::models::TerminalLayout>>;
    
    async fn update(&self, user_id: &str, id: &LayoutId, request: UpdateLayoutRequest) -> Result<crate::models::TerminalLayout>;
    
    async fn delete(&self, user_id: &str, id: &LayoutId) -> Result<()>;
    
    async fn set_default(&self, user_id: &str, id: &LayoutId, workspace_id: &WorkspaceId) -> Result<()>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProcessRequest {
    pub name: String,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub working_directory: String,
    pub environment_variables: Option<std::collections::HashMap<String, String>>,
    pub max_restarts: Option<i32>,
    pub auto_restart: Option<bool>,
    pub workspace_id: Option<WorkspaceId>,
    pub session_id: Option<SessionId>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProcessRequest {
    pub name: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub working_directory: Option<String>,
    pub environment_variables: Option<std::collections::HashMap<String, String>>,
    pub max_restarts: Option<i32>,
    pub auto_restart: Option<bool>,
    pub tags: Option<Vec<String>>,
}

#[async_trait]
pub trait ProcessRepository: Send + Sync {
    async fn create(&self, user_id: &str, request: CreateProcessRequest) -> Result<crate::models::UserProcess>;
    
    async fn get_by_id(&self, user_id: &str, id: &str) -> Result<crate::models::UserProcess>;
    
    async fn list_for_user(&self, user_id: &str) -> Result<Vec<crate::models::UserProcess>>;
    
    async fn list_for_workspace(&self, user_id: &str, workspace_id: &WorkspaceId) -> Result<Vec<crate::models::UserProcess>>;
    
    async fn list_for_session(&self, user_id: &str, session_id: &SessionId) -> Result<Vec<crate::models::UserProcess>>;
    
    async fn list_by_status(&self, user_id: &str, status: &str) -> Result<Vec<crate::models::UserProcess>>;
    
    async fn update(&self, user_id: &str, id: &str, request: UpdateProcessRequest) -> Result<crate::models::UserProcess>;
    
    async fn delete(&self, user_id: &str, id: &str) -> Result<()>;
    
    async fn update_status(&self, user_id: &str, id: &str, status: &str, exit_code: Option<i32>) -> Result<()>;
    
    async fn increment_restart_count(&self, user_id: &str, id: &str) -> Result<i32>;
}

#[derive(Debug, Clone)]
pub struct ProcessStartRequest {
    pub command: String,
    pub args: Vec<String>,
    pub working_directory: String,
    pub environment_variables: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: i32,
    pub status: String,
    pub start_time: std::time::SystemTime,
    pub exit_code: Option<i32>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
}

#[async_trait]
pub trait ProcessRunner: Send + Sync {
    async fn start_process(&self, request: ProcessStartRequest) -> Result<ProcessInfo>;
    
    async fn stop_process(&self, pid: i32) -> Result<()>;
    
    async fn get_process_status(&self, pid: i32) -> Result<ProcessInfo>;
    
    async fn get_process_output(&self, pid: i32) -> Result<(String, String)>;
    
    async fn is_process_running(&self, pid: i32) -> Result<bool>;
}