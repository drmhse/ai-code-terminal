use act_core::repository::{ProcessRunner, ProcessStartRequest, ProcessInfo};
use async_trait::async_trait;
use std::collections::HashMap;
use tokio::process::Command;
use tokio::io::AsyncBufReadExt;
use std::process::Stdio;
use tracing::{info, warn, error};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

/// A process runner implementation using tokio::process
#[derive(Clone)]
pub struct TokioProcessRunner {
    running_processes: Arc<Mutex<HashMap<i32, tokio::process::Child>>>,
}

impl TokioProcessRunner {
    pub fn new() -> Self {
        Self {
            running_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn capture_output(&self, mut child: tokio::process::Child, pid: i32) -> (String, String) {
        let mut stdout = String::new();
        let mut stderr = String::new();

        if let Some(stdout_pipe) = child.stdout.take() {
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

        if let Some(stderr_pipe) = child.stderr.take() {
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
        let _ = child.wait().await;
        
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
        
        // Store the process handle
        {
            let mut processes = self.running_processes.lock().unwrap();
            processes.insert(pid, child);
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
        
        let child = {
            let mut processes = self.running_processes.lock().unwrap();
            processes.remove(&pid)
        };
        
        if let Some(mut child) = child {
            // Try to kill the process gracefully first
            if let Err(e) = child.kill().await {
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
        // For now, return a default status
        // In a real implementation, we'd need to track process state more carefully
        let processes = self.running_processes.lock().unwrap();
        
        if processes.contains_key(&pid) {
            Ok(ProcessInfo {
                pid,
                status: "Running".to_string(),
                start_time: SystemTime::now(),
                exit_code: None,
                stdout: None,
                stderr: None,
            })
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn get_process_output(&self, pid: i32) -> Result<(String, String), act_core::error::CoreError> {
        let child = {
            let mut processes = self.running_processes.lock().unwrap();
            processes.remove(&pid)
        };
        
        if let Some(child) = child {
            let (stdout, stderr) = self.capture_output(child, pid).await;
            Ok((stdout, stderr))
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn is_process_running(&self, pid: i32) -> Result<bool, act_core::error::CoreError> {
        // For now, we'll assume the process is running if it's in our map
        // In a real implementation, we'd need a more sophisticated approach
        let processes = self.running_processes.lock().unwrap();
        Ok(processes.contains_key(&pid))
    }
}