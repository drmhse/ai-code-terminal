use act_pty::TokioPtyService;
use act_core::{PtyService as CorePtyService, SessionConfig, PtySize};
use std::sync::Arc;
use tokio::sync::mpsc;

pub type SessionId = String;
pub type WorkspaceId = String;

// Note: PtyEvent is now imported directly from act_core in other modules

#[derive(Debug, Clone)]
pub struct PtyService {
    inner: Arc<TokioPtyService>,
}

impl Default for PtyService {
    fn default() -> Self {
        Self::new()
    }
}

impl PtyService {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(TokioPtyService::new()),
        }
    }

    pub async fn create_session(
        &self,
        session_id: SessionId,
        workspace_id: WorkspaceId,
        cols: u16,
        rows: u16,
    ) -> Result<(mpsc::UnboundedReceiver<act_core::PtyEvent>, u32), Box<dyn std::error::Error + Send + Sync>> {
        let config = SessionConfig {
            session_id,
            workspace_id,
            size: PtySize {
                cols,
                rows,
                pixel_width: 0,
                pixel_height: 0,
            },
            shell: None,
            working_dir: None,
            environment: None,
        };

        let (receiver, info) = self.inner.create_session(config).await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
        
        Ok((receiver, info.pid.unwrap_or(0)))
    }

    #[allow(dead_code)]
    pub async fn send_input(&self, session_id: &str, data: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.inner.send_input(&session_id.to_string(), data.as_bytes()).await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }

    pub async fn resize_session(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let size = PtySize {
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
        };

        self.inner.resize_session(&session_id.to_string(), size).await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }

    #[allow(dead_code)]
    pub async fn destroy_session(&self, session_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.inner.destroy_session(&session_id.to_string()).await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }

    #[allow(dead_code)]
    pub async fn remove_session(&self, session_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.destroy_session(session_id).await
    }

    #[allow(dead_code)]
    pub async fn get_active_sessions(&self) -> Vec<SessionId> {
        match self.inner.list_sessions().await {
            Ok(sessions) => sessions.into_iter().map(|s| s.session_id).collect(),
            Err(_) => Vec::new(),
        }
    }
}