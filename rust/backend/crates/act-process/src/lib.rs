use act_core::repository::{ProcessRunner, ProcessStartRequest, ProcessInfo};
use async_trait::async_trait;
use std::collections::HashMap;
use tokio::process::Command;
use tokio::io::AsyncBufReadExt;
use std::process::Stdio;
use tracing::{info, warn, error};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

/// Process tracking information
struct ProcessTracker {
    child: tokio::process::Child,
    start_time: SystemTime,
    #[allow(dead_code)]
    command: String,
    #[allow(dead_code)]
    working_dir: String,
}

/// A process runner implementation using tokio::process
#[derive(Clone)]
pub struct TokioProcessRunner {
    running_processes: Arc<Mutex<HashMap<i32, ProcessTracker>>>,
}

impl TokioProcessRunner {
    pub fn new() -> Self {
        Self {
            running_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn capture_output(&self, mut tracker: ProcessTracker, pid: i32) -> (String, String) {
        let mut stdout = String::new();
        let mut stderr = String::new();

        if let Some(stdout_pipe) = tracker.child.stdout.take() {
            let mut reader = tokio::io::BufReader::new(stdout_pipe);
            let mut buffer = String::new();
            while let Ok(bytes_read) = reader.read_line(&mut buffer).await {
                if bytes_read == 0 {
                    break;
                }
                stdout.push_str(&buffer);
                buffer.clear();
            }
        }

        if let Some(stderr_pipe) = tracker.child.stderr.take() {
            let mut reader = tokio::io::BufReader::new(stderr_pipe);
            let mut buffer = String::new();
            while let Ok(bytes_read) = reader.read_line(&mut buffer).await {
                if bytes_read == 0 {
                    break;
                }
                stderr.push_str(&buffer);
                buffer.clear();
            }
        }

        // Wait for the process to complete
        let _ = tracker.child.wait().await;
        
        // Remove from running processes
        let mut processes = self.running_processes.lock().unwrap();
        processes.remove(&pid);

        (stdout, stderr)
    }
}

#[async_trait]
impl ProcessRunner for TokioProcessRunner {
    async fn start_process(&self, request: ProcessStartRequest) -> Result<ProcessInfo, act_core::error::CoreError> {
        info!("Starting process: {} with args: {:?}", request.command, request.args);

        let mut cmd = Command::new(&request.command);
        
        // Set arguments
        cmd.args(&request.args);
        
        // Set working directory
        cmd.current_dir(&request.working_directory);
        
        // Set environment variables
        for (key, value) in &request.environment_variables {
            cmd.env(key, value);
        }
        
        // Configure stdout/stderr capture
        cmd.stdout(Stdio::piped())
           .stderr(Stdio::piped())
           .stdin(Stdio::null());
        
// Start the process
        let child = cmd.spawn()
            .map_err(|e| {
                error!("Failed to start process {}: {}", request.command, e);
                act_core::error::CoreError::Process(format!("Failed to start process: {}", e))
            })?;
        
        let pid = child.id().map(|id| id as i32)
            .ok_or_else(|| act_core::error::CoreError::Process("Failed to get process ID".to_string()))?;
        
        // Store the process handle with tracking information
        {
            let mut processes = self.running_processes.lock().unwrap();
            processes.insert(pid, ProcessTracker {
                child,
                start_time: SystemTime::now(),
                command: request.command.clone(),
                working_dir: request.working_directory.clone(),
            });
        }
        
        info!("Process started with PID: {}", pid);
        
        Ok(ProcessInfo {
            pid,
            status: "Running".to_string(),
            start_time: SystemTime::now(),
            exit_code: None,
            stdout: None,
            stderr: None,
        })
    }

    async fn stop_process(&self, pid: i32) -> Result<(), act_core::error::CoreError> {
        info!("Stopping process with PID: {}", pid);
        
        let tracker = {
            let mut processes = self.running_processes.lock().unwrap();
            processes.remove(&pid)
        };
        
        if let Some(mut tracker) = tracker {
            // Try to kill the process gracefully first
            if let Err(e) = tracker.child.kill().await {
                warn!("Failed to kill process {}: {}", pid, e);
                return Err(act_core::error::CoreError::Process(format!("Failed to kill process: {}", e)));
            }
            
            info!("Process {} stopped successfully", pid);
            Ok(())
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn get_process_status(&self, pid: i32) -> Result<ProcessInfo, act_core::error::CoreError> {
        // For process status checking, we need to temporarily remove the process from the map
        // to get mutable access for try_wait(), then put it back if still running
        let tracker = {
            let mut processes = self.running_processes.lock().unwrap();
            processes.remove(&pid)
        };
        
        if let Some(mut tracker) = tracker {
            let start_time = tracker.start_time; // Clone before moving
            
            let status_info = match tracker.child.try_wait() {
                Ok(None) => {
                    // Process is still running, put it back
                    let mut processes = self.running_processes.lock().unwrap();
                    processes.insert(pid, tracker);
                    
                    ProcessInfo {
                        pid,
                        status: "Running".to_string(),
                        start_time,
                        exit_code: None,
                        stdout: None,
                        stderr: None,
                    }
                }
                Ok(Some(exit_status)) => {
                    // Process has completed
                    let exit_code = exit_status.code();
                    ProcessInfo {
                        pid,
                        status: if exit_code == Some(0) { "Completed".to_string() } else { "Failed".to_string() },
                        start_time,
                        exit_code,
                        stdout: None,
                        stderr: None,
                    }
                }
                Err(_e) => {
                    // Error checking process status, put it back
                    let mut processes = self.running_processes.lock().unwrap();
                    processes.insert(pid, tracker);
                    
                    ProcessInfo {
                        pid,
                        status: "Unknown".to_string(),
                        start_time,
                        exit_code: None,
                        stdout: None,
                        stderr: None,
                    }
                }
            };
            
            Ok(status_info)
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn get_process_output(&self, pid: i32) -> Result<(String, String), act_core::error::CoreError> {
        let tracker = {
            let mut processes = self.running_processes.lock().unwrap();
            processes.remove(&pid)
        };
        
        if let Some(tracker) = tracker {
            let (stdout, stderr) = self.capture_output(tracker, pid).await;
            Ok((stdout, stderr))
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn is_process_running(&self, pid: i32) -> Result<bool, act_core::error::CoreError> {
        // For process running check, we need to temporarily remove the process from the map
        let tracker = {
            let mut processes = self.running_processes.lock().unwrap();
            processes.remove(&pid)
        };
        
        if let Some(mut tracker) = tracker {
            let is_running = match tracker.child.try_wait() {
                Ok(None) => {
                    // Process is still running, put it back
                    let mut processes = self.running_processes.lock().unwrap();
                    processes.insert(pid, tracker);
                    true
                }
                Ok(Some(_)) => {
                    // Process has completed
                    false
                }
                Err(_e) => {
                    // Error checking process status, put it back
                    let mut processes = self.running_processes.lock().unwrap();
                    processes.insert(pid, tracker);
                    false
                }
            };
            
            Ok(is_running)
        } else {
            Ok(false) // Process not found
        }
    }
}

impl Default for TokioProcessRunner {
    fn default() -> Self {
        Self::new()
    }
}