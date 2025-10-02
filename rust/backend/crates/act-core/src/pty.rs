use crate::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type SessionId = String;
pub type WorkspaceId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PtyEvent {
    Output(Vec<u8>),
    Closed,
    Error(String),
    Resized { cols: u16, rows: u16 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PtySize {
    pub cols: u16,
    pub rows: u16,
    pub pixel_width: u16,
    pub pixel_height: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SessionConfig {
    pub session_id: SessionId,
    pub workspace_id: WorkspaceId,
    pub pane_id: Option<String>,
    pub size: PtySize,
    pub shell: Option<String>,
    pub working_dir: Option<String>,
    pub environment: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SessionInfo {
    pub session_id: SessionId,
    pub workspace_id: WorkspaceId,
    pub pane_id: Option<String>,
    pub pid: Option<u32>,
    pub status: SessionStatus,
    pub size: PtySize,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionStatus {
    Active,
    Inactive,
    Terminated,
    Error(String),
}

#[async_trait]
pub trait PtyService: Send + Sync {
    async fn create_session(
        &self,
        config: SessionConfig,
    ) -> Result<(tokio::sync::mpsc::UnboundedReceiver<PtyEvent>, SessionInfo)>;

    async fn send_input(&self, session_id: &SessionId, data: &[u8]) -> Result<()>;

    async fn resize_session(&self, session_id: &SessionId, size: PtySize) -> Result<()>;

    async fn destroy_session(&self, session_id: &SessionId) -> Result<()>;

    async fn get_session_info(&self, session_id: &SessionId) -> Result<SessionInfo>;

    async fn list_sessions(&self) -> Result<Vec<SessionInfo>>;

    async fn is_session_active(&self, session_id: &SessionId) -> Result<bool>;

    async fn update_session_pane_id(
        &self,
        session_id: &SessionId,
        pane_id: Option<String>,
    ) -> Result<()>;
}
