use act_core::{
    PtyService, PtyEvent, PtySize, SessionConfig, SessionInfo,
    SessionId, Result, CoreError
};
use act_core::pty::SessionStatus;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};
use tracing::{info, error, debug, warn};
use crate::session::PtySession;

#[derive(Debug)]
pub struct TokioPtyService {
    sessions: Arc<Mutex<HashMap<SessionId, Arc<Mutex<PtySession>>>>>,
}

impl TokioPtyService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

  
}

impl Default for TokioPtyService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl PtyService for TokioPtyService {
    async fn create_session(
        &self,
        config: SessionConfig,
    ) -> Result<(tokio::sync::mpsc::UnboundedReceiver<PtyEvent>, SessionInfo)> {
        info!("Creating PTY session {} for workspace {}", config.session_id, config.workspace_id);

        // Use direct shell session - simple and reliable
        let default_shell = if cfg!(windows) {
            "powershell.exe"
        } else {
            "/bin/bash"
        };
        
        let shell = config.shell.as_deref().unwrap_or(default_shell);
        let mut cmd = portable_pty::CommandBuilder::new(shell);
        
        // Add shell arguments for interactive mode
        if shell.contains("bash") || shell.contains("zsh") {
            cmd.arg("-i"); // Interactive mode
            cmd.arg("-l"); // Login shell
        }
        
        // Set working directory if specified
        if let Some(ref working_dir) = config.working_dir {
            cmd.cwd(working_dir);
        }
        
        // Set essential environment variables
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        
        // Set environment variables from config
        if let Some(env) = &config.environment {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        let pty_size = portable_pty::PtySize {
            cols: config.size.cols.max(1),
            rows: config.size.rows.max(1),
            pixel_width: config.size.pixel_width,
            pixel_height: config.size.pixel_height,
        };
        
        info!("Creating PTY with size: {}x{}", pty_size.cols, pty_size.rows);

        // Create PTY pair
        let pty_system = portable_pty::native_pty_system();
        let pty_pair = pty_system.openpty(pty_size)
            .map_err(|e| CoreError::Pty(format!("Failed to create PTY: {}", e)))?;

        // Set environment variables
        if let Some(env) = &config.environment {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        // Split the pty pair
        let (master, slave) = (pty_pair.master, pty_pair.slave);

        // Spawn process
        let child = slave.spawn_command(cmd)
            .map_err(|e| CoreError::Pty(format!("Failed to spawn shell command: {}", e)))?;

        // Get process ID (if available)
        let pid = None; // portable_pty Child doesn't expose PID

        // Create channels for communication
        let (output_tx, output_rx) = mpsc::unbounded_channel::<PtyEvent>();
        let (input_tx, mut input_rx) = mpsc::unbounded_channel::<Vec<u8>>();

        // Create the session
        let pty_session = PtySession::new(
            config.session_id.clone(),
            config.workspace_id.clone(),
            child,
            master,
            input_tx.clone(),
            pid,
            config.size.clone(),
        );

        // Start reader task
        let reader = pty_session.master.try_clone_reader()
            .map_err(|e| CoreError::Pty(format!("Failed to clone reader: {}", e)))?;
        let reader = Arc::new(Mutex::new(reader));
        let read_output_tx = output_tx.clone();
        let read_session_id = config.session_id.clone();

        tokio::spawn(async move {
            info!("✅ Started PTY read task for session {}", read_session_id);
            let mut buffer = [0u8; 4096];
            loop {
                let reader_clone = reader.clone();
                match tokio::task::spawn_blocking(move || {
                    let mut reader = reader_clone.blocking_lock();
                    use std::io::Read;
                    reader.read(&mut buffer)
                }).await {
                    Ok(Ok(n)) if n > 0 => {
                        let output = buffer[..n].to_vec();
                        
                        // Filter out streams of null bytes
                        let meaningful_content = output.iter().any(|&b| b != 0);
                        
                        if meaningful_content {
                            info!("📖 PTY read {} bytes for session {}: {:?}", n, read_session_id, String::from_utf8_lossy(&output));
                            
                            if let Err(err) = read_output_tx.send(PtyEvent::Output(output)) {
                                error!("Failed to send PTY output for session {}: {}", read_session_id, err);
                                break;
                            }
                        } else {
                            debug!("Filtered out {} null bytes for session {}", n, read_session_id);
                        }
                    }
                    Ok(Ok(_)) => {
                        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                    }
                    Ok(Err(err)) => {
                        error!("PTY read error for session {}: {}", read_session_id, err);
                        let _ = read_output_tx.send(PtyEvent::Error(err.to_string()));
                        break;
                    }
                    Err(join_err) => {
                        error!("PTY read task join error for session {}: {}", read_session_id, join_err);
                        let _ = read_output_tx.send(PtyEvent::Error(join_err.to_string()));
                        break;
                    }
                }
            }
            let _ = read_output_tx.send(PtyEvent::Closed);
            warn!("⚠️ PTY read task ended for session {}", read_session_id);
        });

        // Start writer task
        let writer = pty_session.master.take_writer()
            .map_err(|e| CoreError::Pty(format!("Failed to take writer: {}", e)))?;
        let writer = Arc::new(Mutex::new(writer));
        let write_session_id = config.session_id.clone();

        tokio::spawn(async move {
            while let Some(input) = input_rx.recv().await {
                let writer_clone = writer.clone();
                match tokio::task::spawn_blocking({
                    let input = input.clone();
                    move || {
                        use std::io::Write;
                        let mut writer = writer_clone.blocking_lock();
                        writer.write_all(&input).and_then(|_| writer.flush())
                    }
                }).await {
                    Ok(Ok(_)) => {
                        debug!("Wrote {} bytes to PTY session {}", input.len(), write_session_id);
                    }
                    Ok(Err(err)) => {
                        error!("Failed to write to PTY session {}: {}", write_session_id, err);
                        break;
                    }
                    Err(join_err) => {
                        error!("PTY write task join error for session {}: {}", write_session_id, join_err);
                        break;
                    }
                }
            }
            debug!("PTY write task ended for session {}", write_session_id);
        });

        // Create session info
        let session_info = SessionInfo {
            session_id: config.session_id.clone(),
            workspace_id: config.workspace_id.clone(),
            pid,
            status: SessionStatus::Active,
            size: config.size.clone(),
            created_at: chrono::Utc::now(),
        };

        // Store session
        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(config.session_id.clone(), Arc::new(Mutex::new(pty_session)));
        }

        info!("✅ PTY session {} created successfully", config.session_id);
        Ok((output_rx, session_info))
    }

    async fn send_input(&self, session_id: &SessionId, data: &[u8]) -> Result<()> {
        let sessions = self.sessions.lock().await;
        
        if let Some(session) = sessions.get(session_id) {
            let session = session.lock().await;
            session.input_tx.send(data.to_vec())
                .map_err(|e| CoreError::Pty(format!("Failed to send input: {}", e)))?;
            
            info!("✅ Sent input to PTY session {}: {} bytes - {:?}", session_id, data.len(), String::from_utf8_lossy(data));
            Ok(())
        } else {
            error!("❌ PTY session {} not found for input", session_id);
            Err(CoreError::NotFound(format!("PTY session {} not found", session_id)))
        }
    }

    async fn resize_session(&self, session_id: &SessionId, size: PtySize) -> Result<()> {
        let sessions = self.sessions.lock().await;
        
        if let Some(session) = sessions.get(session_id) {
            let mut session = session.lock().await;
            let pty_size = portable_pty::PtySize {
                cols: size.cols,
                rows: size.rows,
                pixel_width: size.pixel_width,
                pixel_height: size.pixel_height,
            };
            
            session.master.resize(pty_size)
                .map_err(|e| CoreError::Pty(format!("Failed to resize PTY: {}", e)))?;
            session.size = size.clone();
            
            info!("Resized PTY session {} to {}x{}", session_id, size.cols, size.rows);
            Ok(())
        } else {
            Err(CoreError::NotFound(format!("PTY session {} not found", session_id)))
        }
    }

    async fn destroy_session(&self, session_id: &SessionId) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        
        if let Some(session_arc) = sessions.remove(session_id) {
            let mut session = session_arc.lock().await;
            
            // Kill the child process (shell process)
            if let Err(err) = session.child.kill() {
                error!("Failed to kill child process for session {}: {}", session_id, err);
            }
            
            // Wait for process to exit
            if let Err(err) = session.child.wait() {
                error!("Failed to wait for child process for session {}: {}", session_id, err);
            }
            
            info!("PTY session {} destroyed", session_id);
            Ok(())
        } else {
            Err(CoreError::NotFound(format!("PTY session {} not found", session_id)))
        }
    }

    async fn get_session_info(&self, session_id: &SessionId) -> Result<SessionInfo> {
        let sessions = self.sessions.lock().await;
        
        if let Some(session) = sessions.get(session_id) {
            let session = session.lock().await;
            Ok(SessionInfo {
                session_id: session.session_id.clone(),
                workspace_id: session.workspace_id.clone(),
                pid: session.pid,
                status: if sessions.contains_key(session_id) { SessionStatus::Active } else { SessionStatus::Terminated },
                size: session.size.clone(),
                created_at: chrono::Utc::now(), // TODO: store actual creation time
            })
        } else {
            Err(CoreError::NotFound(format!("PTY session {} not found", session_id)))
        }
    }

    async fn list_sessions(&self) -> Result<Vec<SessionInfo>> {
        let sessions = self.sessions.lock().await;
        let mut result = Vec::new();
        
        for (_session_id, session_arc) in sessions.iter() {
            let session = session_arc.lock().await;
            result.push(SessionInfo {
                session_id: session.session_id.clone(),
                workspace_id: session.workspace_id.clone(),
                pid: session.pid,
                status: SessionStatus::Active,
                size: session.size.clone(),
                created_at: chrono::Utc::now(), // TODO: store actual creation time
            });
        }
        
        Ok(result)
    }

    async fn is_session_active(&self, session_id: &SessionId) -> Result<bool> {
        let sessions = self.sessions.lock().await;
        Ok(sessions.contains_key(session_id))
    }
}