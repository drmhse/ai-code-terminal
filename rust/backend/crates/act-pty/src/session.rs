use act_core::{PtySize};
use act_core::pty::{SessionId, WorkspaceId};
use portable_pty::{Child, MasterPty};
use tokio::sync::mpsc;
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct PtySession {
    pub session_id: SessionId,
    pub workspace_id: WorkspaceId,
    pub pane_id: Option<String>,
    // **FIX:** Wrap child in Arc<Mutex<>> to allow shared, mutable access for waiting.
    pub child: Arc<Mutex<Box<dyn Child + Send>>>,
    pub master: Box<dyn MasterPty + Send>,
    pub input_tx: mpsc::UnboundedSender<Vec<u8>>,
    pub pid: Option<u32>,
    pub size: PtySize,
    pub created_at: DateTime<Utc>,
}

impl PtySession {
    pub fn new(
        session_id: SessionId,
        workspace_id: WorkspaceId,
        pane_id: Option<String>,
        child: Box<dyn Child + Send>,
        master: Box<dyn MasterPty + Send>,
        input_tx: mpsc::UnboundedSender<Vec<u8>>,
        pid: Option<u32>,
        size: PtySize,
    ) -> Self {
        Self {
            session_id,
            workspace_id,
            pane_id,
            child: Arc::new(Mutex::new(child)), // **FIX:** Wrap in Arc<Mutex<>>
            master,
            input_tx,
            pid,
            size,
            created_at: Utc::now(),
        }
    }

    pub fn session_id(&self) -> &SessionId {
        &self.session_id
    }

    pub fn workspace_id(&self) -> &WorkspaceId {
        &self.workspace_id
    }

    pub fn pid(&self) -> Option<u32> {
        self.pid
    }

    pub fn size(&self) -> &PtySize {
        &self.size
    }
}

impl std::fmt::Debug for PtySession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PtySession")
            .field("session_id", &self.session_id)
            .field("workspace_id", &self.workspace_id)
            .field("child", &"Arc<Mutex<Box<dyn Child>>>")
            .field("master", &"Box<dyn MasterPty>")
            .field("input_tx", &self.input_tx)
            .field("pid", &self.pid)
            .field("size", &self.size)
            .field("created_at", &self.created_at)
            .finish()
    }
}
