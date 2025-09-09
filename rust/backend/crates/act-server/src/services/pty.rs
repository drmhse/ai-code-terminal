use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    io::Read,
    thread,
    time::Duration,
};
use portable_pty::{CommandBuilder, PtySize, Child, MasterPty};
use tokio::sync::mpsc;
use tracing::{info, error, debug};

pub type SessionId = String;
pub type WorkspaceId = String;

pub struct PtySession {
    pub session_id: SessionId,
    pub workspace_id: WorkspaceId,
    pub child: Box<dyn Child + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub tx: mpsc::UnboundedSender<String>, // Channel to send data to PTY
}

impl std::fmt::Debug for PtySession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PtySession")
            .field("session_id", &self.session_id)
            .field("workspace_id", &self.workspace_id)
            .field("child", &"Box<dyn Child>")
            .field("master", &"Box<dyn MasterPty>")
            .field("tx", &self.tx)
            .finish()
    }
}

#[derive(Debug, Clone)]
pub struct PtyService {
    sessions: Arc<Mutex<HashMap<SessionId, Arc<Mutex<PtySession>>>>>,
}

impl PtyService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_session(
        &self,
        session_id: SessionId,
        workspace_id: WorkspaceId,
        cols: u16,
        rows: u16,
    ) -> Result<mpsc::UnboundedReceiver<String>, Box<dyn std::error::Error + Send + Sync>> {
        info!("Creating PTY session {} for workspace {}", session_id, workspace_id);

        let pty_size = PtySize {
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
        };

        // Create PTY pair
        let pty_system = portable_pty::native_pty_system();
        let pty_pair = pty_system.openpty(pty_size)?;

        // Determine shell and working directory
        let shell = if cfg!(windows) {
            "powershell.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        };

        let workspace_path = format!("./workspaces/{}", workspace_id.replace('/', "_"));

        // Build command
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&workspace_path);

        // Split the pty pair
        let (master, slave) = (pty_pair.master, pty_pair.slave);

        // Spawn process
        let child = slave.spawn_command(cmd)?;

        // Create channels for communication
        let (output_tx, output_rx) = mpsc::unbounded_channel::<String>();
        let (input_tx, mut input_rx) = mpsc::unbounded_channel::<String>();

        // Clone master for reading thread
        let mut reader = master.try_clone_reader()?;
        let read_output_tx = output_tx.clone();
        let read_session_id = session_id.clone();

        // Spawn thread to read from PTY
        thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            loop {
                match reader.read(&mut buffer) {
                    Ok(n) if n > 0 => {
                        let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                        
                        if let Err(err) = read_output_tx.send(output) {
                            error!("Failed to send PTY output for session {}: {}", read_session_id, err);
                            break;
                        }
                    }
                    Ok(_) => {
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(err) => {
                        error!("PTY read error for session {}: {}", read_session_id, err);
                        break;
                    }
                }
            }
            debug!("PTY read thread ended for session {}", read_session_id);
        });

        // Take the writer for the PTY
        let mut writer = master.take_writer().map_err(|e| anyhow::anyhow!("Failed to take PTY writer: {}", e))?;
        let write_session_id = session_id.clone();

        // Spawn thread to handle PTY input (writing to PTY)
        thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                while let Some(input) = input_rx.recv().await {
                    match std::io::Write::write_all(&mut writer, input.as_bytes()) {
                        Ok(_) => {
                            if let Err(err) = std::io::Write::flush(&mut writer) {
                                error!("Failed to flush PTY session {}: {}", write_session_id, err);
                            } else {
                                debug!("Wrote {} bytes to PTY session {}", input.len(), write_session_id);
                            }
                        }
                        Err(err) => {
                            error!("Failed to write to PTY session {}: {}", write_session_id, err);
                            break;
                        }
                    }
                }
                debug!("PTY write thread ended for session {}", write_session_id);
            });
        });

        // Create session
        let pty_session = PtySession {
            session_id: session_id.clone(),
            workspace_id,
            child,
            master,
            tx: input_tx,
        };

        // Store session
        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(session_id.clone(), Arc::new(Mutex::new(pty_session)));
        }

        info!("✅ PTY session {} created successfully", session_id);
        Ok(output_rx)
    }

    pub fn send_input(&self, session_id: &str, data: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sessions = self.sessions.lock().unwrap();
        
        if let Some(session) = sessions.get(session_id) {
            let session = session.lock().unwrap();
            session.tx.send(data.to_string())
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
            
            debug!("Sent input to PTY session {}: {} bytes", session_id, data.len());
            Ok(())
        } else {
            Err(format!("PTY session {} not found", session_id).into())
        }
    }

    pub fn resize_session(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sessions = self.sessions.lock().unwrap();
        
        if let Some(session) = sessions.get(session_id) {
            let session = session.lock().unwrap();
            let pty_size = PtySize {
                cols,
                rows,
                pixel_width: 0,
                pixel_height: 0,
            };
            
            session.master.resize(pty_size)?;
            info!("Resized PTY session {} to {}x{}", session_id, cols, rows);
            Ok(())
        } else {
            Err(format!("PTY session {} not found", session_id).into())
        }
    }

    pub fn destroy_session(&self, session_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut sessions = self.sessions.lock().unwrap();
        
        if let Some(session_arc) = sessions.remove(session_id) {
            let mut session = session_arc.lock().unwrap();
            
            // Kill the child process
            if let Err(err) = session.child.kill() {
                error!("Failed to kill child process for session {}: {}", session_id, err);
            }
            
            // Wait for process to exit
            if let Err(err) = session.child.wait() {
                error!("Failed to wait for child process for session {}: {}", session_id, err);
            }
            
            info!("🔴 PTY session {} destroyed", session_id);
            Ok(())
        } else {
            Err(format!("PTY session {} not found", session_id).into())
        }
    }

    pub fn get_active_sessions(&self) -> Vec<SessionId> {
        let sessions = self.sessions.lock().unwrap();
        sessions.keys().cloned().collect()
    }
}