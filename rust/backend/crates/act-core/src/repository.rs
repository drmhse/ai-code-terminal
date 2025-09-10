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

#[async_trait]
pub trait WorkspaceRepository: Send + Sync {
    async fn create(&self, request: CreateWorkspaceRequest) -> Result<Workspace>;
    
    async fn get_by_id(&self, id: &WorkspaceId) -> Result<Workspace>;
    
    async fn get_by_github_repo(&self, repo: &str) -> Result<Option<Workspace>>;
    
    async fn list_all(&self) -> Result<Vec<Workspace>>;
    
    async fn list_active(&self) -> Result<Vec<Workspace>>;
    
    async fn update(&self, id: &WorkspaceId, request: UpdateWorkspaceRequest) -> Result<Workspace>;
    
    async fn delete(&self, id: &WorkspaceId) -> Result<()>;
    
    async fn set_active(&self, id: &WorkspaceId, active: bool) -> Result<()>;
}

#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn create(&self, request: CreateSessionRequest) -> Result<Session>;
    
    async fn get_by_id(&self, id: &SessionId) -> Result<Session>;
    
    async fn list_by_workspace(&self, workspace_id: &WorkspaceId) -> Result<Vec<Session>>;
    
    async fn list_active(&self) -> Result<Vec<Session>>;
    
    async fn list_by_status(&self, status: SessionStatus) -> Result<Vec<Session>>;
    
    async fn update(&self, id: &SessionId, request: UpdateSessionRequest) -> Result<Session>;
    
    async fn delete(&self, id: &SessionId) -> Result<()>;
    
    async fn cleanup_inactive(&self, older_than: DateTime<Utc>) -> Result<usize>;
    
    async fn set_shell_pid(&self, id: &SessionId, pid: Option<i32>) -> Result<()>;
    
    async fn update_activity(&self, id: &SessionId) -> Result<()>;
}