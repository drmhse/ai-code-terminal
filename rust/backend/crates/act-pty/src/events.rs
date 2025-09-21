// Re-export events from core for convenience
pub use act_core::PtyEvent;
pub use act_core::pty::SessionStatus;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCreatedEvent {
    pub session_id: String,
    pub workspace_id: String,
    pub pid: Option<u32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTerminatedEvent {
    pub session_id: String,
    pub exit_code: Option<i32>,
    pub terminated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionResizedEvent {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionErrorEvent {
    pub session_id: String,
    pub error: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}