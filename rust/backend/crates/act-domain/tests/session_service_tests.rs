use std::sync::Arc;
use async_trait::async_trait;
use tokio::sync::mpsc;
use act_core::{
    Result, CoreError,
    repository::{Session, SessionRepository, CreateSessionRequest, SessionType, SessionStatus},
    pty::{PtyService, PtyEvent, SessionConfig, SessionInfo, PtySize},
};
use act_domain::{SessionService, CreateSessionOptions};

// Mock implementations for testing

struct MockSessionRepository {
    sessions: std::sync::Mutex<Vec<Session>>,
    next_id: std::sync::atomic::AtomicUsize,
}

impl MockSessionRepository {
    fn new() -> Self {
        Self {
            sessions: std::sync::Mutex::new(Vec::new()),
            next_id: std::sync::atomic::AtomicUsize::new(1),
        }
    }
}

#[async_trait]
impl SessionRepository for MockSessionRepository {
    async fn create(&self, request: &CreateSessionRequest) -> Result<Session> {
        let id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let session = Session {
            id: id.to_string(),
            workspace_id: request.workspace_id.clone(),
            session_name: request.session_name.clone(),
            session_type: request.session_type.clone(),
            status: SessionStatus::Active,
            pid: Some(1234),
            terminal_size: request.terminal_size.clone(),
            recovery_token: Some(format!("token_{}", id)),
            can_recover: request.is_recoverable,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            last_accessed: Some(chrono::Utc::now()),
        };
        
        self.sessions.lock().unwrap().push(session.clone());
        Ok(session)
    }

    async fn get_by_id(&self, id: &str) -> Result<Option<Session>> {
        let sessions = self.sessions.lock().unwrap();
        Ok(sessions.iter().find(|s| s.id == id).cloned())
    }

    async fn list_by_workspace(&self, workspace_id: &str) -> Result<Vec<Session>> {
        let sessions = self.sessions.lock().unwrap();
        Ok(sessions.iter()
            .filter(|s| s.workspace_id.as_ref() == Some(&workspace_id.to_string()))
            .cloned()
            .collect())
    }

    async fn update_status(&self, id: &str, status: SessionStatus) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions.iter_mut()
            .find(|s| s.id == id)
            .ok_or_else(|| CoreError::NotFound("Session not found".to_string()))?;
        
        session.status = status;
        session.updated_at = chrono::Utc::now();
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        let pos = sessions.iter().position(|s| s.id == id)
            .ok_or_else(|| CoreError::NotFound("Session not found".to_string()))?;
        sessions.remove(pos);
        Ok(())
    }

    async fn get_by_recovery_token(&self, token: &str) -> Result<Option<Session>> {
        let sessions = self.sessions.lock().unwrap();
        Ok(sessions.iter()
            .find(|s| s.recovery_token.as_ref() == Some(&token.to_string()))
            .cloned())
    }

    async fn cleanup_expired(&self, _hours: i64) -> Result<u64> {
        Ok(0)
    }
}

struct MockPtyService {
    sessions: std::sync::Mutex<std::collections::HashMap<String, mpsc::UnboundedSender<PtyEvent>>>,
}

impl MockPtyService {
    fn new() -> Self {
        Self {
            sessions: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }
}

#[async_trait]
impl PtyService for MockPtyService {
    async fn create_session(&self, config: &SessionConfig) -> Result<SessionInfo> {
        let (tx, _rx) = mpsc::unbounded_channel();
        let session_id = format!("pty_{}", config.session_id);
        
        self.sessions.lock().unwrap().insert(session_id.clone(), tx);
        
        Ok(SessionInfo {
            session_id: session_id.clone(),
            pid: 1234,
            size: config.size.clone(),
        })
    }

    async fn get_session_output(&self, session_id: &str) -> Result<mpsc::UnboundedReceiver<PtyEvent>> {
        let (_tx, rx) = mpsc::unbounded_channel();
        Ok(rx)
    }

    async fn send_input(&self, _session_id: &str, _data: &[u8]) -> Result<()> {
        Ok(())
    }

    async fn resize_session(&self, _session_id: &str, _size: PtySize) -> Result<()> {
        Ok(())
    }

    async fn terminate_session(&self, session_id: &str) -> Result<()> {
        self.sessions.lock().unwrap().remove(session_id);
        Ok(())
    }

    async fn list_sessions(&self) -> Result<Vec<String>> {
        let sessions = self.sessions.lock().unwrap();
        Ok(sessions.keys().cloned().collect())
    }
}

#[tokio::test]
async fn test_create_session_success() {
    let service = create_session_service();
    
    let options = CreateSessionOptions {
        workspace_id: Some("workspace_1".to_string()),
        session_name: "Terminal".to_string(),
        session_type: SessionType::Terminal,
        terminal_size: None,
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 30,
    };
    
    let result = service.create_session(options).await;
    
    assert!(result.is_ok());
    let session_state = result.unwrap();
    assert_eq!(session_state.session_name, "Terminal");
}

#[tokio::test]
async fn test_get_session_by_id() {
    let service = create_session_service();
    
    // Create a session first
    let options = CreateSessionOptions {
        workspace_id: Some("workspace_1".to_string()),
        session_name: "Test Session".to_string(),
        session_type: SessionType::Terminal,
        terminal_size: None,
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 30,
    };
    
    let session_state = service.create_session(options).await.unwrap();
    
    // Get the session
    let result = service.get_session(&session_state.session_id).await;
    
    assert!(result.is_ok());
    let session = result.unwrap();
    assert!(session.is_some());
    assert_eq!(session.unwrap().session_name, "Test Session");
}

#[tokio::test]
async fn test_list_sessions_by_workspace() {
    let service = create_session_service();
    
    // Create sessions in different workspaces
    let options1 = CreateSessionOptions {
        workspace_id: Some("workspace_1".to_string()),
        session_name: "Session 1".to_string(),
        session_type: SessionType::Terminal,
        terminal_size: None,
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 30,
    };
    
    let options2 = CreateSessionOptions {
        workspace_id: Some("workspace_1".to_string()),
        session_name: "Session 2".to_string(),
        session_type: SessionType::Terminal,
        terminal_size: None,
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 30,
    };
    
    let options3 = CreateSessionOptions {
        workspace_id: Some("workspace_2".to_string()),
        session_name: "Session 3".to_string(),
        session_type: SessionType::Terminal,
        terminal_size: None,
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 30,
    };
    
    let _ = service.create_session(options1).await.unwrap();
    let _ = service.create_session(options2).await.unwrap();
    let _ = service.create_session(options3).await.unwrap();
    
    // List sessions for workspace_1
    let result = service.list_sessions_by_workspace("workspace_1").await;
    
    assert!(result.is_ok());
    let sessions = result.unwrap();
    assert_eq!(sessions.len(), 2);
}

#[tokio::test]
async fn test_terminate_session() {
    let service = create_session_service();
    
    // Create a session
    let options = CreateSessionOptions {
        workspace_id: Some("workspace_1".to_string()),
        session_name: "To Terminate".to_string(),
        session_type: SessionType::Terminal,
        terminal_size: None,
        is_recoverable: true,
        auto_cleanup: false,
        max_idle_minutes: 30,
    };
    
    let session_state = service.create_session(options).await.unwrap();
    
    // Terminate the session
    let result = service.terminate_session(&session_state.session_id).await;
    
    assert!(result.is_ok());
    
    // Verify session is terminated
    let session = service.get_session(&session_state.session_id).await.unwrap();
    assert!(session.is_some());
    assert_eq!(session.unwrap().status, SessionStatus::Terminated);
}

fn create_session_service() -> SessionService {
    let session_repo: Arc<dyn SessionRepository> = Arc::new(MockSessionRepository::new());
    let pty_service: Arc<dyn PtyService> = Arc::new(MockPtyService::new());
    let recovery_timeout_hours = Some(24);
    
    SessionService::new(session_repo, pty_service, recovery_timeout_hours)
}