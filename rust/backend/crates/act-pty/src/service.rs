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

#[derive(Debug, Clone)]
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
        info!("Shell detection: SHELL env var is {:?}", std::env::var("SHELL"));

        let default_shell = if cfg!(windows) {
            "cmd.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        };

        let shell = config.shell.as_deref().unwrap_or(&default_shell);

        info!("Selected shell for PTY session: {}", shell);

        let mut cmd = portable_pty::CommandBuilder::new(shell);
        // Use simpler shell invocation to avoid profile script interference
        if shell.contains("bash") {
            cmd.args(["-i"]);
        } else if shell.contains("zsh") {
            cmd.args(["-i"]);
        }
        // No shell args for other shells to minimize interference

        if let Some(ref working_dir) = config.working_dir {
            cmd.cwd(working_dir);
        }

        // Set minimal required environment variables
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Don't override PS1 - let the shell handle its own prompt
        // Don't force color output - let applications decide

        // For zsh, prevent theme loading that might output garbage
        if shell.contains("zsh") {
            cmd.env("ZSH_THEME", "");
            cmd.env("DISABLE_AUTO_UPDATE", "true");
        }

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

        let pty_system = portable_pty::native_pty_system();
        let pty_pair = pty_system.openpty(pty_size)
            .map_err(|e| CoreError::Pty(format!("Failed to create PTY: {}", e)))?;

        let (master, slave) = (pty_pair.master, pty_pair.slave);

        let child = slave.spawn_command(cmd)
            .map_err(|e| CoreError::Pty(format!("Failed to spawn shell command: {}", e)))?;

        let pid = child.process_id();

        let (output_tx, output_rx) = mpsc::unbounded_channel::<PtyEvent>();
        let (input_tx, mut input_rx) = mpsc::unbounded_channel::<Vec<u8>>();

        let reader = master.try_clone_reader()
            .map_err(|e| CoreError::Pty(format!("Failed to clone reader: {}", e)))?;
        let writer = master.take_writer()
            .map_err(|e| CoreError::Pty(format!("Failed to take writer: {}", e)))?;

        let pty_session = PtySession::new(
            config.session_id.clone(),
            config.workspace_id.clone(),
            child,
            master,
            input_tx.clone(),
            pid,
            config.size.clone(),
        );

        let session_arc = Arc::new(Mutex::new(pty_session));
        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(config.session_id.clone(), session_arc.clone());
        }

        let read_output_tx = output_tx.clone();
        let read_session_id = config.session_id.clone();
        let session_clone_for_reader = session_arc.clone();

        tokio::spawn(async move {
            let child_process = {
                let session = session_clone_for_reader.lock().await;
                session.child.clone()
            };
            let mut reader = reader;

            loop {
                let mut buffer = [0u8; 4096];
                // **FIX:** Clone the Arc inside the loop before moving it into the closure.
                let child_process_clone = child_process.clone();

                tokio::select! {
                    exit_result = tokio::task::spawn_blocking(move || {
                        let mut child_guard = tokio::runtime::Handle::current().block_on(child_process_clone.lock());
                        child_guard.wait()
                    }) => {
                        match exit_result {
                            Ok(Ok(exit_status)) => {
                                info!("PTY process for session {} exited with status: {}", read_session_id, exit_status);
                                let _ = read_output_tx.send(PtyEvent::Closed);
                            }
                            Ok(Err(e)) => {
                                error!("Error waiting for PTY process for session {}: {}", read_session_id, e);
                                let _ = read_output_tx.send(PtyEvent::Error(e.to_string()));
                            }
                            Err(e) => {
                                error!("Join error on PTY wait task for session {}: {}", read_session_id, e);
                                let _ = read_output_tx.send(PtyEvent::Error(e.to_string()));
                            }
                        }
                        break;
                    }

                    read_result = tokio::task::spawn_blocking(move || {
                        use std::io::Read;
                        let result = reader.read(&mut buffer);
                        (result, reader, buffer)
                    }) => {
                        match read_result {
                            Ok((Ok(n), new_reader, new_buffer)) => {
                                reader = new_reader;
                                if n > 0 {
                                    let data = new_buffer[..n].to_vec();
                                    if let Err(err) = read_output_tx.send(PtyEvent::Output(data)) {
                                        error!("Failed to send PTY output for session {}: {}", read_session_id, err);
                                        break;
                                    }
                                } else {
                                    info!("PTY EOF for session {}", read_session_id);
                                    let _ = read_output_tx.send(PtyEvent::Closed);
                                    break;
                                }
                            }
                            Ok((Err(err), _, _)) => {
                                error!("PTY read error for session {}: {}", read_session_id, err);
                                break;
                            }
                            Err(join_err) => {
                                error!("PTY read task join error for session {}: {}", read_session_id, join_err);
                                break;
                            }
                        }
                    }
                }
            }
            debug!("PTY I/O and process wait task ended for session {}", read_session_id);
        });

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
                        debug!("✅ Wrote {} bytes to PTY session {}: {:?}",
                               input.len(), write_session_id, String::from_utf8_lossy(&input));
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

        // Remove automatic welcome message to prevent conflicts with frontend
        // Let the frontend handle welcome messages

        let session_info = SessionInfo {
            session_id: config.session_id.clone(),
            workspace_id: config.workspace_id.clone(),
            pid,
            status: SessionStatus::Active,
            size: config.size.clone(),
            created_at: chrono::Utc::now(),
        };

        info!("✅ PTY session {} created successfully with PID {:?}", config.session_id, pid);
        Ok((output_rx, session_info))
    }

    async fn send_input(&self, session_id: &SessionId, data: &[u8]) -> Result<()> {
        let sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get(session_id) {
            let session = session.lock().await;
            session.input_tx.send(data.to_vec())
                .map_err(|e| CoreError::Pty(format!("Failed to send input: {}", e)))?;
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
                cols: size.cols.max(1),
                rows: size.rows.max(1),
                pixel_width: size.pixel_width,
                pixel_height: size.pixel_height,
            };
            session.master.resize(pty_size)
                .map_err(|e| CoreError::Pty(format!("Failed to resize PTY: {}", e)))?;
            session.size = size.clone();
            info!("✅ Resized PTY session {} to {}x{}", session_id, size.cols, size.rows);
            Ok(())
        } else {
            Err(CoreError::NotFound(format!("PTY session {} not found", session_id)))
        }
    }

    async fn destroy_session(&self, session_id: &SessionId) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        if sessions.remove(session_id).is_some() {
            info!("✅ Destroyed PTY session {}", session_id);
            Ok(())
        } else {
            warn!("PTY session {} not found for destruction", session_id);
            Err(CoreError::NotFound(format!("PTY session {} not found", session_id)))
        }
    }

    async fn list_sessions(&self) -> Result<Vec<SessionInfo>> {
        let sessions = self.sessions.lock().await;
        let mut session_infos = Vec::new();
        for (session_id, session_arc) in sessions.iter() {
            let session = session_arc.lock().await;
            session_infos.push(SessionInfo {
                session_id: session_id.clone(),
                workspace_id: session.workspace_id.clone(),
                pid: session.pid,
                status: SessionStatus::Active,
                size: session.size.clone(),
                created_at: session.created_at,
            });
        }
        Ok(session_infos)
    }

    async fn get_session_info(&self, session_id: &SessionId) -> Result<SessionInfo> {
        let sessions = self.sessions.lock().await;
        if let Some(session_arc) = sessions.get(session_id) {
            let session = session_arc.lock().await;
            Ok(SessionInfo {
                session_id: session_id.clone(),
                workspace_id: session.workspace_id.clone(),
                pid: session.pid,
                status: SessionStatus::Active,
                size: session.size.clone(),
                created_at: session.created_at,
            })
        } else {
            Err(CoreError::NotFound(format!("PTY session {} not found", session_id)))
        }
    }

    async fn is_session_active(&self, session_id: &SessionId) -> Result<bool> {
        let sessions = self.sessions.lock().await;
        Ok(sessions.contains_key(session_id))
    }
}
