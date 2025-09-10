use act_core::{
    PtyService, PtyEvent, PtySize, SessionConfig, SessionInfo,
    SessionId, Result, CoreError
};
use act_core::pty::SessionStatus;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use std::process::Command;
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

    async fn check_tmux_session_exists(&self, session_id: &str) -> Result<bool> {
        let output = Command::new("tmux")
            .arg("has-session")
            .arg("-t")
            .arg(session_id)
            .output();

        match output {
            Ok(output) => Ok(output.status.success()),
            Err(e) => {
                error!("Failed to check tmux session existence: {}", e);
                Ok(false) // Assume doesn't exist if we can't check
            }
        }
    }

    async fn create_tmux_session(&self, session_id: &str, config: &SessionConfig) -> Result<()> {
        let default_shell = if cfg!(windows) {
            "powershell.exe"
        } else {
            Box::leak(std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string()).into_boxed_str())
        };
        
        let _shell = config.shell.as_deref().unwrap_or(default_shell);

        let working_dir = config.working_dir.as_deref().unwrap_or("./workspaces");

        let mut cmd = Command::new("tmux");
        cmd.arg("new-session")
            .arg("-d") // detached
            .arg("-s") // session name
            .arg(session_id)
            .arg("-c") // working directory
            .arg(working_dir);

        // If we have a specific shell, use it
        if let Some(shell) = &config.shell {
            cmd.arg(shell);
        }

        let output = cmd.output()
            .map_err(|e| CoreError::Pty(format!("Failed to execute tmux new-session: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CoreError::Pty(format!("Failed to create tmux session: {}", stderr)));
        }

        info!("Created tmux session: {}", session_id);
        Ok(())
    }

    pub async fn list_tmux_sessions(&self) -> Result<Vec<String>> {
        let output = Command::new("tmux")
            .arg("list-sessions")
            .arg("-F")
            .arg("#{session_name}")
            .output();

        match output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let sessions: Vec<String> = stdout
                    .lines()
                    .filter(|line| line.starts_with("act-"))
                    .map(|line| line.to_string())
                    .collect();
                Ok(sessions)
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                warn!("Failed to list tmux sessions: {}", stderr);
                Ok(vec![]) // Return empty list if no sessions or tmux not available
            }
            Err(e) => {
                warn!("Failed to execute tmux list-sessions: {}", e);
                Ok(vec![]) // Return empty list if tmux not available
            }
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

        // Check if tmux session already exists
        let tmux_session_id = format!("act-{}", config.session_id);
        let session_exists = self.check_tmux_session_exists(&tmux_session_id).await?;

        // If session doesn't exist, create it
        if !session_exists {
            self.create_tmux_session(&tmux_session_id, &config).await?;
        } else {
            info!("Tmux session {} already exists, attaching to it", tmux_session_id);
        }

        let pty_size = portable_pty::PtySize {
            cols: config.size.cols,
            rows: config.size.rows,
            pixel_width: config.size.pixel_width,
            pixel_height: config.size.pixel_height,
        };

        // Create PTY pair
        let pty_system = portable_pty::native_pty_system();
        let pty_pair = pty_system.openpty(pty_size)
            .map_err(|e| CoreError::Pty(format!("Failed to create PTY: {}", e)))?;

        // Build command to attach to tmux session
        let mut cmd = portable_pty::CommandBuilder::new("tmux");
        cmd.arg("attach-session");
        cmd.arg("-t");
        cmd.arg(&tmux_session_id);

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
            .map_err(|e| CoreError::Pty(format!("Failed to spawn tmux attach command: {}", e)))?;

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
                        
                        if let Err(err) = read_output_tx.send(PtyEvent::Output(output)) {
                            error!("Failed to send PTY output for session {}: {}", read_session_id, err);
                            break;
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
            debug!("PTY read task ended for session {}", read_session_id);
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
            
            debug!("Sent input to PTY session {}: {} bytes", session_id, data.len());
            Ok(())
        } else {
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
            
            // Kill the child process (tmux attach process)
            if let Err(err) = session.child.kill() {
                error!("Failed to kill child process for session {}: {}", session_id, err);
            }
            
            // Wait for process to exit
            if let Err(err) = session.child.wait() {
                error!("Failed to wait for child process for session {}: {}", session_id, err);
            }
            
            // Kill the actual tmux session
            let tmux_session_id = format!("act-{}", session_id);
            let kill_result = Command::new("tmux")
                .arg("kill-session")
                .arg("-t")
                .arg(&tmux_session_id)
                .output();

            match kill_result {
                Ok(output) if output.status.success() => {
                    info!("Successfully killed tmux session: {}", tmux_session_id);
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    warn!("Failed to kill tmux session {}: {}", tmux_session_id, stderr);
                }
                Err(e) => {
                    warn!("Failed to execute tmux kill-session for {}: {}", tmux_session_id, e);
                }
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