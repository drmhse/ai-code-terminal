use act_core::repository::{
    ProcessRunner, ProcessStartRequest, ProcessInfo, ProcessResourceUsage,
    ProcessOutputChunk, ProcessOutputQuery, OutputStreamType, ProcessResourceLimits
};
use async_trait::async_trait;
use std::collections::HashMap;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::{mpsc, Mutex, RwLock};
use std::process::Stdio;
use tracing::{info, warn, error};
use std::sync::Arc;
use std::time::{SystemTime, Duration};
use chrono::Utc;
use sysinfo::{System, Pid};

/// Process tracking information with enhanced monitoring
#[derive(Debug, Clone)]
struct ProcessTracker {
    child: Arc<Mutex<tokio::process::Child>>,
    start_time: SystemTime,
    /// Command used to start the process - preserved for debugging and future process info display
    #[allow(dead_code)]
    command: String,
    /// Working directory when the process was started - preserved for debugging and future process info display
    #[allow(dead_code)]
    working_dir: String,
    resource_limits: Option<ProcessResourceLimits>,
    stdout_buffer: Arc<RwLock<CircularBuffer<ProcessOutputChunk>>>,
    stderr_buffer: Arc<RwLock<CircularBuffer<ProcessOutputChunk>>>,
    output_subscribers: Arc<Mutex<Vec<mpsc::Sender<ProcessOutputChunk>>>>,
    sequence_counter: Arc<Mutex<u64>>,
    total_stdout_size: Arc<Mutex<u64>>,
    total_stderr_size: Arc<Mutex<u64>>,
}

/// Circular buffer for process output with size limits
#[derive(Debug)]
struct CircularBuffer<T> {
    buffer: Vec<T>,
    capacity: usize,
    start: usize,
    len: usize,
}

impl<T: Clone> CircularBuffer<T> {
    fn new(capacity: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(capacity),
            capacity,
            start: 0,
            len: 0,
        }
    }

    fn push(&mut self, item: T) {
        if self.buffer.len() < self.capacity {
            self.buffer.push(item);
            self.len += 1;
        } else {
            self.buffer[self.start] = item;
            self.start = (self.start + 1) % self.capacity;
        }
    }

    fn iter(&self) -> impl Iterator<Item = &T> {
        if self.len == 0 {
            return Box::new(std::iter::empty()) as Box<dyn Iterator<Item = &T>>;
        }

        if self.buffer.len() < self.capacity {
            Box::new(self.buffer.iter())
        } else {
            let (left, right) = self.buffer.split_at(self.start);
            Box::new(right.iter().chain(left.iter()))
        }
    }

    fn get_recent(&self, count: usize) -> Vec<T> {
        let mut items: Vec<T> = self.iter().cloned().collect();
        items.reverse();
        items.into_iter().take(count).collect::<Vec<_>>().into_iter().rev().collect()
    }
}

/// Enhanced process runner implementation using tokio::process
#[derive(Clone)]
pub struct TokioProcessRunner {
    running_processes: Arc<Mutex<HashMap<i32, ProcessTracker>>>,
    system_monitor: Arc<Mutex<System>>,
    default_buffer_size: usize,
    max_output_size: u64,
}

impl TokioProcessRunner {
    pub fn new() -> Self {
        Self {
            running_processes: Arc::new(Mutex::new(HashMap::new())),
            system_monitor: Arc::new(Mutex::new(System::new_all())),
            default_buffer_size: 1000,
            max_output_size: 10 * 1024 * 1024, // 10MB
        }
    }

    pub fn with_config(buffer_size: usize, max_output_size: u64) -> Self {
        Self {
            running_processes: Arc::new(Mutex::new(HashMap::new())),
            system_monitor: Arc::new(Mutex::new(System::new_all())),
            default_buffer_size: buffer_size,
            max_output_size,
        }
    }

    /// Start monitoring process output streams
    async fn start_output_monitoring(
        &self,
        pid: i32,
    ) {
        let processes = self.running_processes.lock().await;
        let tracker = processes.get(&pid);
        if tracker.is_none() {
            return;
        }
        let tracker = tracker.unwrap();

        let stdout_buffer = tracker.stdout_buffer.clone();
        let stderr_buffer = tracker.stderr_buffer.clone();
        let subscribers = tracker.output_subscribers.clone();
        let sequence_counter = tracker.sequence_counter.clone();
        let total_stdout_size = tracker.total_stdout_size.clone();
        let total_stderr_size = tracker.total_stderr_size.clone();
        let max_size = self.max_output_size;

        // Monitor stdout
        if let Some(stdout) = tracker.child.lock().await.stdout.take() {
            let stdout_buffer_clone = stdout_buffer.clone();
            let subscribers_clone = subscribers.clone();
            let sequence_counter_clone = sequence_counter.clone();
            let total_size_clone = total_stdout_size.clone();

            tokio::spawn(async move {
                let mut reader = BufReader::new(stdout);
                let mut line = String::new();

                while let Ok(bytes_read) = reader.read_line(&mut line).await {
                    if bytes_read == 0 {
                        break;
                    }

                    let mut total_size = total_size_clone.lock().await;
                    if *total_size + bytes_read as u64 > max_size {
                        warn!("Stdout size limit exceeded for process {}", pid);
                        break;
                    }
                    *total_size += bytes_read as u64;
                    drop(total_size);

                    let sequence = {
                        let mut counter = sequence_counter_clone.lock().await;
                        *counter += 1;
                        *counter
                    };

                    let chunk = ProcessOutputChunk {
                        timestamp: Utc::now(),
                        stream: OutputStreamType::Stdout,
                        content: line.clone(),
                        sequence,
                    };

                    // Add to buffer
                    {
                        let mut buffer = stdout_buffer_clone.write().await;
                        buffer.push(chunk.clone());
                    }

                    // Notify subscribers
                    {
                        let mut subs = subscribers_clone.lock().await;
                        subs.retain(|sender| {
                            if let Err(e) = sender.try_send(chunk.clone()) {
                                warn!("Failed to send to subscriber: {}", e);
                                false
                            } else {
                                true
                            }
                        });
                    }

                    line.clear();
                }
            });
        }

        // Monitor stderr
        if let Some(stderr) = tracker.child.lock().await.stderr.take() {
            let stderr_buffer_clone = stderr_buffer.clone();
            let subscribers_clone = subscribers.clone();
            let sequence_counter_clone = sequence_counter.clone();
            let total_size_clone = total_stderr_size.clone();

            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr);
                let mut line = String::new();

                while let Ok(bytes_read) = reader.read_line(&mut line).await {
                    if bytes_read == 0 {
                        break;
                    }

                    let mut total_size = total_size_clone.lock().await;
                    if *total_size + bytes_read as u64 > max_size {
                        warn!("Stderr size limit exceeded for process {}", pid);
                        break;
                    }
                    *total_size += bytes_read as u64;
                    drop(total_size);

                    let sequence = {
                        let mut counter = sequence_counter_clone.lock().await;
                        *counter += 1;
                        *counter
                    };

                    let chunk = ProcessOutputChunk {
                        timestamp: Utc::now(),
                        stream: OutputStreamType::Stderr,
                        content: line.clone(),
                        sequence,
                    };

                    // Add to buffer
                    {
                        let mut buffer = stderr_buffer_clone.write().await;
                        buffer.push(chunk.clone());
                    }

                    // Notify subscribers
                    {
                        let mut subs = subscribers_clone.lock().await;
                        subs.retain(|sender| {
                            if let Err(e) = sender.try_send(chunk.clone()) {
                                warn!("Failed to send to subscriber: {}", e);
                                false
                            } else {
                                true
                            }
                        });
                    }

                    line.clear();
                }
            });
        }

        // Wait for the process to complete and clean up
        let running_processes = self.running_processes.clone();
        let child_clone = tracker.child.clone();
        tokio::spawn(async move {
            let _ = child_clone.lock().await.wait().await;
            let mut processes = running_processes.lock().await;
            processes.remove(&pid);
            info!("Process {} monitoring completed", pid);
        });
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

        let start_time = SystemTime::now();

        // Create enhanced process tracker
        let buffer_size = request.output_config
            .as_ref()
            .and_then(|config| config.buffer_lines)
            .unwrap_or(self.default_buffer_size);

        let tracker = ProcessTracker {
            child: Arc::new(Mutex::new(child)),
            start_time,
            command: request.command.clone(),
            working_dir: request.working_directory.clone(),
            resource_limits: request.resource_limits.clone(),
            stdout_buffer: Arc::new(RwLock::new(CircularBuffer::new(buffer_size))),
            stderr_buffer: Arc::new(RwLock::new(CircularBuffer::new(buffer_size))),
            output_subscribers: Arc::new(Mutex::new(Vec::new())),
            sequence_counter: Arc::new(Mutex::new(0)),
            total_stdout_size: Arc::new(Mutex::new(0)),
            total_stderr_size: Arc::new(Mutex::new(0)),
        };

        // Store the process handle
        {
            let mut processes = self.running_processes.lock().await;
            processes.insert(pid, tracker);
        }

        // Start output monitoring
        self.start_output_monitoring(pid).await;

        info!("Process started with PID: {}", pid);

        Ok(ProcessInfo {
            pid,
            status: "Running".to_string(),
            start_time,
            exit_code: None,
            resource_usage: None,
        })
    }

    async fn stop_process(&self, pid: i32) -> Result<(), act_core::error::CoreError> {
        info!("Stopping process with PID: {}", pid);

        let tracker = {
            let mut processes = self.running_processes.lock().await;
            processes.remove(&pid)
        };

        if let Some(tracker) = tracker {
            // Try graceful termination first (SIGTERM)
            #[cfg(unix)]
            {
                use nix::sys::signal::{self, Signal};
                use nix::unistd::Pid as NixPid;

                if let Err(e) = signal::kill(NixPid::from_raw(pid), Signal::SIGTERM) {
                    warn!("Failed to send SIGTERM to process {}: {}", pid, e);
                }

                // Wait a bit for graceful shutdown
                tokio::time::sleep(Duration::from_secs(5)).await;

                // Check if process is still running
match tracker.child.lock().await.try_wait() {
                    Ok(Some(_)) => {
                        info!("Process {} terminated gracefully", pid);
                        return Ok(());
                    }
                    Ok(None) => {
                        info!("Process {} did not terminate gracefully, sending SIGKILL", pid);
                    }
                    Err(e) => {
                        warn!("Error checking process {} status: {}", pid, e);
                    }
                }
            }

            // Force kill if graceful termination failed
            if let Err(e) = tracker.child.lock().await.kill().await {
                warn!("Failed to kill process {}: {}", pid, e);
                return Err(act_core::error::CoreError::Process(format!("Failed to kill process: {}", e)));
            }

            info!("Process {} stopped successfully", pid);
            Ok(())
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn force_kill_process(&self, pid: i32) -> Result<(), act_core::error::CoreError> {
        info!("Force killing process with PID: {}", pid);

        let tracker = {
            let mut processes = self.running_processes.lock().await;
            processes.remove(&pid)
        };

        if let Some(tracker) = tracker {
            if let Err(e) = tracker.child.lock().await.kill().await {
                warn!("Failed to force kill process {}: {}", pid, e);
                return Err(act_core::error::CoreError::Process(format!("Failed to force kill process: {}", e)));
            }

            info!("Process {} force killed successfully", pid);
            Ok(())
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn get_process_status(&self, pid: i32) -> Result<ProcessInfo, act_core::error::CoreError> {
        let tracker = {
            let mut processes = self.running_processes.lock().await;
            processes.remove(&pid)
        };

        if let Some(tracker) = tracker {
            let start_time = tracker.start_time;
            let resource_usage = self.get_resource_usage(pid).await.ok();

            let child_arc = tracker.child.clone();
            let status_info = match child_arc.lock().await.try_wait() {
                Ok(None) => {
                    // Process is still running, put it back
                    let mut processes = self.running_processes.lock().await;
                    processes.insert(pid, tracker);

                    ProcessInfo {
                        pid,
                        status: "Running".to_string(),
                        start_time,
                        exit_code: None,
                        resource_usage,
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
                        resource_usage,
                    }
                }
                Err(_e) => {
                    // Error checking process status, put it back
                    let mut processes = self.running_processes.lock().await;
                    processes.insert(pid, tracker);

                    ProcessInfo {
                        pid,
                        status: "Unknown".to_string(),
                        start_time,
                        exit_code: None,
                        resource_usage,
                    }
                }
            };

            Ok(status_info)
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn get_process_output_stream(&self, pid: i32, query: ProcessOutputQuery) -> Result<Vec<ProcessOutputChunk>, act_core::error::CoreError> {
        let processes = self.running_processes.lock().await;
        let tracker = processes.get(&pid)
            .ok_or_else(|| act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))?;

        let mut results = Vec::new();

        // Get stdout chunks
        if query.stream_filter.is_none() || matches!(query.stream_filter, Some(OutputStreamType::Stdout)) {
            let stdout_buffer = tracker.stdout_buffer.read().await;
            let mut stdout_chunks: Vec<_> = stdout_buffer
                .iter()
                .filter(|chunk| {
                    query.since_sequence.map_or(true, |seq| chunk.sequence > seq)
                })
                .cloned()
                .collect();
            results.append(&mut stdout_chunks);
        }

        // Get stderr chunks
        if query.stream_filter.is_none() || matches!(query.stream_filter, Some(OutputStreamType::Stderr)) {
            let stderr_buffer = tracker.stderr_buffer.read().await;
            let mut stderr_chunks: Vec<_> = stderr_buffer
                .iter()
                .filter(|chunk| {
                    query.since_sequence.map_or(true, |seq| chunk.sequence > seq)
                })
                .cloned()
                .collect();
            results.append(&mut stderr_chunks);
        }

        // Sort by sequence number and apply limit
        results.sort_by_key(|chunk| chunk.sequence);
        if let Some(limit) = query.limit {
            results.truncate(limit);
        }

        Ok(results)
    }

    async fn get_latest_output(&self, pid: i32, lines: Option<usize>) -> Result<(String, String), act_core::error::CoreError> {
        let processes = self.running_processes.lock().await;
        let tracker = processes.get(&pid)
            .ok_or_else(|| act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))?;

        let line_limit = lines.unwrap_or(100);

        let stdout = {
            let stdout_buffer = tracker.stdout_buffer.read().await;
            stdout_buffer
                .get_recent(line_limit)
                .into_iter()
                .map(|chunk| chunk.content.clone())
                .collect::<String>()
        };

        let stderr = {
            let stderr_buffer = tracker.stderr_buffer.read().await;
            stderr_buffer
                .get_recent(line_limit)
                .into_iter()
                .map(|chunk| chunk.content.clone())
                .collect::<String>()
        };

        Ok((stdout, stderr))
    }

    async fn is_process_running(&self, pid: i32) -> Result<bool, act_core::error::CoreError> {
        let tracker = {
            let mut processes = self.running_processes.lock().await;
            processes.remove(&pid)
        };

        if let Some(tracker) = tracker {
            let child_arc = tracker.child.clone();
            let is_running = match child_arc.lock().await.try_wait() {
                Ok(None) => {
                    // Process is still running, put it back
                    let mut processes = self.running_processes.lock().await;
                    processes.insert(pid, tracker);
                    true
                }
                Ok(Some(_)) => {
                    // Process has completed
                    false
                }
                Err(_e) => {
                    // Error checking process status, put it back
                    let mut processes = self.running_processes.lock().await;
                    processes.insert(pid, tracker);
                    false
                }
            };

            Ok(is_running)
        } else {
            Ok(false) // Process not found
        }
    }

    async fn get_resource_usage(&self, pid: i32) -> Result<ProcessResourceUsage, act_core::error::CoreError> {
        let mut system = self.system_monitor.lock().await;
        system.refresh_process(Pid::from(pid as usize));

        if let Some(process) = system.process(Pid::from(pid as usize)) {
            Ok(ProcessResourceUsage {
                cpu_percent: process.cpu_usage(),
                memory_bytes: process.memory(),
                runtime_seconds: process.run_time(),
                file_descriptors: 0, // Not easily available through sysinfo
            })
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found in system", pid)))
        }
    }

    async fn subscribe_to_output(&self, pid: i32) -> Result<mpsc::Receiver<ProcessOutputChunk>, act_core::error::CoreError> {
        let processes = self.running_processes.lock().await;
        let tracker = processes.get(&pid)
            .ok_or_else(|| act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))?;

        let (sender, receiver) = mpsc::channel(100);
        let mut subscribers = tracker.output_subscribers.lock().await;
        subscribers.push(sender);

        Ok(receiver)
    }

    async fn set_resource_limits(&self, pid: i32, limits: ProcessResourceLimits) -> Result<(), act_core::error::CoreError> {
        let mut processes = self.running_processes.lock().await;
        if let Some(tracker) = processes.get_mut(&pid) {
            tracker.resource_limits = Some(limits);
            info!("Updated resource limits for process {}", pid);
            Ok(())
        } else {
            Err(act_core::error::CoreError::NotFound(format!("Process with PID {} not found", pid)))
        }
    }

    async fn cleanup_process_resources(&self, pid: i32) -> Result<(), act_core::error::CoreError> {
        let mut processes = self.running_processes.lock().await;
        if let Some(tracker) = processes.remove(&pid) {
            // Kill the process if still running
            let _ = tracker.child.lock().await.kill().await;

            // Clear output buffers
            {
                let mut stdout_buffer = tracker.stdout_buffer.write().await;
                *stdout_buffer = CircularBuffer::new(1);
            }
            {
                let mut stderr_buffer = tracker.stderr_buffer.write().await;
                *stderr_buffer = CircularBuffer::new(1);
            }

            // Clear subscribers
            {
                let mut subscribers = tracker.output_subscribers.lock().await;
                subscribers.clear();
            }

            info!("Cleaned up resources for process {}", pid);
            Ok(())
        } else {
            Ok(()) // Process already cleaned up
        }
    }
}

impl Default for TokioProcessRunner {
    fn default() -> Self {
        Self::new()
    }
}