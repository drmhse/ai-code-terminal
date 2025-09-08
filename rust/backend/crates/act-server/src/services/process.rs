use act_core::Database;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tokio::time::{Duration, Instant};
use tracing::{error, info, warn, debug};
use uuid::Uuid;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub working_directory: String,
    pub environment_variables: HashMap<String, String>,
    pub pid: Option<u32>,
    pub status: ProcessStatus,
    pub start_time: i64,
    pub end_time: Option<i64>,
    pub exit_code: Option<i32>,
    pub cpu_usage: f64,
    pub memory_usage: u64, // in bytes
    pub restart_count: u32,
    pub max_restarts: u32,
    pub auto_restart: bool,
    pub user_id: Option<String>,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProcessStatus {
    Starting,
    Running,
    Stopped,
    Failed,
    Crashed,
    Restarting,
    Terminated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMetrics {
    pub process_id: String,
    pub timestamp: i64,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_peak: u64,
    pub io_read: u64,
    pub io_write: u64,
    pub open_files: u32,
    pub threads: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessLogEntry {
    pub process_id: String,
    pub timestamp: i64,
    pub level: String,
    pub message: String,
    pub stream: String, // "stdout" or "stderr"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub working_directory: String,
    pub environment_variables: HashMap<String, String>,
    pub auto_restart: bool,
    pub max_restarts: u32,
    pub restart_delay_ms: u64,
    pub resource_limits: ResourceLimits,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: Option<u64>,
    pub max_cpu_percent: Option<f64>,
    pub max_execution_time_seconds: Option<u64>,
    pub max_open_files: Option<u32>,
}

struct ManagedProcess {
    info: ProcessInfo,
    child: Option<Child>,
    last_check: Instant,
    restart_attempts: u32,
    config: ProcessConfig,
}

pub struct ProcessSupervisor {
    db: Database,
    processes: Arc<RwLock<HashMap<String, Arc<Mutex<ManagedProcess>>>>>,
    metrics_history: Arc<RwLock<HashMap<String, Vec<ProcessMetrics>>>>,
    monitoring_interval: Duration,
}

impl ProcessSupervisor {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            processes: Arc::new(RwLock::new(HashMap::new())),
            metrics_history: Arc::new(RwLock::new(HashMap::new())),
            monitoring_interval: Duration::from_secs(5),
        }
    }

    pub async fn start_process(
        &self,
        config: ProcessConfig,
        user_id: Option<String>,
        workspace_id: Option<String>,
        session_id: Option<String>,
    ) -> Result<String> {
        let process_id = Uuid::new_v4().to_string();
        let start_time = chrono::Utc::now().timestamp();

        info!("Starting process: {} ({})", config.name, process_id);

        let mut process_info = ProcessInfo {
            id: process_id.clone(),
            name: config.name.clone(),
            command: config.command.clone(),
            args: config.args.clone(),
            working_directory: config.working_directory.clone(),
            environment_variables: config.environment_variables.clone(),
            pid: None,
            status: ProcessStatus::Starting,
            start_time,
            end_time: None,
            exit_code: None,
            cpu_usage: 0.0,
            memory_usage: 0,
            restart_count: 0,
            max_restarts: config.max_restarts,
            auto_restart: config.auto_restart,
            user_id,
            workspace_id,
            session_id,
            tags: config.tags.clone(),
        };

        // Start the actual process
        match self.spawn_process(&config).await {
            Ok(child) => {
                process_info.pid = Some(child.id());
                process_info.status = ProcessStatus::Running;
                
                let managed_process = ManagedProcess {
                    info: process_info.clone(),
                    child: Some(child),
                    last_check: Instant::now(),
                    restart_attempts: 0,
                    config: config.clone(),
                };

                // Store in memory
                self.processes.write().await.insert(
                    process_id.clone(),
                    Arc::new(Mutex::new(managed_process))
                );

                // Persist to database
                self.save_process_info(&process_info).await?;

                info!("Process started successfully: {} (PID: {:?})", process_id, process_info.pid);
                Ok(process_id)
            }
            Err(e) => {
                process_info.status = ProcessStatus::Failed;
                process_info.end_time = Some(chrono::Utc::now().timestamp());
                
                error!("Failed to start process {}: {}", process_id, e);
                Err(e)
            }
        }
    }

    pub async fn stop_process(&self, process_id: &str) -> Result<()> {
        info!("Stopping process: {}", process_id);

        let processes = self.processes.read().await;
        if let Some(managed_process) = processes.get(process_id) {
            let mut process = managed_process.lock().await;
            
            if let Some(mut child) = process.child.take() {
                // Try graceful shutdown first
                if let Err(e) = child.kill() {
                    warn!("Failed to kill process {}: {}", process_id, e);
                }
                
                if let Ok(status) = child.wait() {
                    process.info.exit_code = status.code();
                    process.info.status = ProcessStatus::Terminated;
                } else {
                    process.info.status = ProcessStatus::Failed;
                }
            } else {
                process.info.status = ProcessStatus::Stopped;
            }
            
            process.info.end_time = Some(chrono::Utc::now().timestamp());
            
            // Update in database
            self.save_process_info(&process.info).await?;
            
            info!("Process stopped: {}", process_id);
            Ok(())
        } else {
            Err(anyhow!("Process not found: {}", process_id))
        }
    }

    pub async fn restart_process(&self, process_id: &str) -> Result<()> {
        info!("Restarting process: {}", process_id);

        let processes = self.processes.read().await;
        if let Some(managed_process) = processes.get(process_id) {
            let mut process = managed_process.lock().await;
            
            // Stop current process
            if let Some(mut child) = process.child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
            
            process.info.restart_count += 1;
            process.info.status = ProcessStatus::Restarting;
            
            // Check restart limits
            if process.info.restart_count > process.info.max_restarts {
                process.info.status = ProcessStatus::Failed;
                process.info.end_time = Some(chrono::Utc::now().timestamp());
                return Err(anyhow!("Maximum restart attempts exceeded for process {}", process_id));
            }
            
            // Wait for restart delay
            tokio::time::sleep(Duration::from_millis(process.config.restart_delay_ms)).await;
            
            // Start new process
            match self.spawn_process(&process.config).await {
                Ok(child) => {
                    process.info.pid = Some(child.id());
                    process.info.status = ProcessStatus::Running;
                    process.child = Some(child);
                    
                    self.save_process_info(&process.info).await?;
                    info!("Process restarted successfully: {}", process_id);
                    Ok(())
                }
                Err(e) => {
                    process.info.status = ProcessStatus::Failed;
                    process.info.end_time = Some(chrono::Utc::now().timestamp());
                    
                    error!("Failed to restart process {}: {}", process_id, e);
                    Err(e)
                }
            }
        } else {
            Err(anyhow!("Process not found: {}", process_id))
        }
    }

    pub async fn get_process_info(&self, process_id: &str) -> Result<Option<ProcessInfo>> {
        let processes = self.processes.read().await;
        if let Some(managed_process) = processes.get(process_id) {
            let process = managed_process.lock().await;
            Ok(Some(process.info.clone()))
        } else {
            // Try to load from database
            self.load_process_info(process_id).await
        }
    }

    pub async fn list_processes(
        &self,
        user_id: Option<&str>,
        workspace_id: Option<&str>,
        status: Option<ProcessStatus>,
    ) -> Result<Vec<ProcessInfo>> {
        let processes = self.processes.read().await;
        let mut result = Vec::new();

        for managed_process in processes.values() {
            let process = managed_process.lock().await;
            let info = &process.info;
            
            // Apply filters
            if let Some(uid) = user_id {
                if info.user_id.as_deref() != Some(uid) {
                    continue;
                }
            }
            
            if let Some(wid) = workspace_id {
                if info.workspace_id.as_deref() != Some(wid) {
                    continue;
                }
            }
            
            if let Some(s) = &status {
                if &info.status != s {
                    continue;
                }
            }
            
            result.push(info.clone());
        }

        Ok(result)
    }

    pub async fn get_process_metrics(
        &self,
        process_id: &str,
        limit: Option<usize>,
    ) -> Result<Vec<ProcessMetrics>> {
        let metrics = self.metrics_history.read().await;
        if let Some(process_metrics) = metrics.get(process_id) {
            let limit = limit.unwrap_or(100);
            let start = if process_metrics.len() > limit {
                process_metrics.len() - limit
            } else {
                0
            };
            Ok(process_metrics[start..].to_vec())
        } else {
            // Load from database
            self.load_process_metrics(process_id, limit).await
        }
    }

    pub async fn start_monitoring(&self) {
        info!("Starting process monitoring loop");
        let processes = self.processes.clone();
        let metrics_history = self.metrics_history.clone();
        let _db = self.db.clone();
        let interval = self.monitoring_interval;

        tokio::spawn(async move {
            let mut monitoring_interval = tokio::time::interval(interval);
            
            loop {
                monitoring_interval.tick().await;
                
                let processes_guard = processes.read().await;
                for (process_id, managed_process) in processes_guard.iter() {
                    let mut process = managed_process.lock().await;
                    
                    // Check if process is still running
                    if let Some(child) = &mut process.child {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                // Process has ended
                                process.info.exit_code = status.code();
                                process.info.end_time = Some(chrono::Utc::now().timestamp());
                                
                                if status.success() {
                                    process.info.status = ProcessStatus::Stopped;
                                } else {
                                    process.info.status = ProcessStatus::Crashed;
                                }
                                
                                info!("Process {} ended with status: {:?}", process_id, status);
                                
                                // Handle auto-restart
                                if process.config.auto_restart && 
                                   process.info.restart_count < process.info.max_restarts {
                                    // Will be handled by the restart logic
                                    process.info.status = ProcessStatus::Restarting;
                                }
                            }
                            Ok(None) => {
                                // Process still running, collect metrics
                                if let Some(pid) = process.info.pid {
                                    if let Ok(metrics) = collect_process_metrics(process_id, pid).await {
                                        process.info.cpu_usage = metrics.cpu_usage;
                                        process.info.memory_usage = metrics.memory_usage;
                                        
                                        // Store metrics
                                        let mut metrics_guard = metrics_history.write().await;
                                        let process_metrics = metrics_guard.entry(process_id.clone()).or_insert_with(Vec::new);
                                        process_metrics.push(metrics);
                                        
                                        // Keep only last 1000 metrics entries
                                        if process_metrics.len() > 1000 {
                                            process_metrics.drain(0..100);
                                        }
                                    }
                                }
                            }
                            Err(_) => {
                                // Error checking process status
                                process.info.status = ProcessStatus::Failed;
                                process.info.end_time = Some(chrono::Utc::now().timestamp());
                            }
                        }
                        
                        process.last_check = Instant::now();
                    }
                }
                
                // Clean up finished processes periodically
                if processes_guard.len() > 1000 {
                    debug!("Cleaning up finished processes");
                    // TODO: Implement cleanup logic
                }
            }
        });
    }

    async fn spawn_process(&self, config: &ProcessConfig) -> Result<Child> {
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .current_dir(&config.working_directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Set environment variables
        for (key, value) in &config.environment_variables {
            cmd.env(key, value);
        }

        cmd.spawn()
            .map_err(|e| anyhow!("Failed to spawn process: {}", e))
    }

    async fn save_process_info(&self, info: &ProcessInfo) -> Result<()> {
        let info_json = serde_json::to_string(info)?;
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO process_info
            (id, name, command, pid, status, start_time, end_time, exit_code,
             cpu_usage, memory_usage, restart_count, user_id, workspace_id, 
             session_id, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&info.id)
        .bind(&info.name)
        .bind(&info.command)
        .bind(info.pid.map(|p| p as i64))
        .bind(format!("{:?}", info.status))
        .bind(info.start_time)
        .bind(info.end_time)
        .bind(info.exit_code)
        .bind(info.cpu_usage)
        .bind(info.memory_usage as i64)
        .bind(info.restart_count as i64)
        .bind(&info.user_id)
        .bind(&info.workspace_id)
        .bind(&info.session_id)
        .bind(&info_json)
        .execute(self.db.pool())
        .await?;

        Ok(())
    }

    async fn load_process_info(&self, process_id: &str) -> Result<Option<ProcessInfo>> {
        let row = sqlx::query(
            "SELECT data FROM process_info WHERE id = ?"
        )
        .bind(process_id)
        .fetch_optional(self.db.pool())
        .await?;

        if let Some(row) = row {
            let info_json: String = row.get("data");
            let info: ProcessInfo = serde_json::from_str(&info_json)?;
            Ok(Some(info))
        } else {
            Ok(None)
        }
    }

    async fn load_process_metrics(&self, process_id: &str, limit: Option<usize>) -> Result<Vec<ProcessMetrics>> {
        let limit = limit.unwrap_or(100) as i64;
        
        let rows = sqlx::query(
            r#"
            SELECT timestamp, cpu_usage, memory_usage, memory_peak, io_read, io_write, 
                   open_files, threads
            FROM process_metrics 
            WHERE process_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
            "#
        )
        .bind(process_id)
        .bind(limit)
        .fetch_all(self.db.pool())
        .await?;

        let mut metrics = Vec::new();
        for row in rows {
            metrics.push(ProcessMetrics {
                process_id: process_id.to_string(),
                timestamp: row.get("timestamp"),
                cpu_usage: row.get("cpu_usage"),
                memory_usage: row.get::<i64, _>("memory_usage") as u64,
                memory_peak: row.get::<i64, _>("memory_peak") as u64,
                io_read: row.get::<i64, _>("io_read") as u64,
                io_write: row.get::<i64, _>("io_write") as u64,
                open_files: row.get::<i64, _>("open_files") as u32,
                threads: row.get::<i64, _>("threads") as u32,
            });
        }

        Ok(metrics)
    }
}

async fn collect_process_metrics(process_id: &str, _pid: u32) -> Result<ProcessMetrics> {
    // Simplified metrics collection - in a real implementation, this would
    // use system APIs or libraries like sysinfo to collect actual metrics
    let timestamp = chrono::Utc::now().timestamp();
    
    // Mock metrics for now - replace with actual system calls
    Ok(ProcessMetrics {
        process_id: process_id.to_string(),
        timestamp,
        cpu_usage: 0.0, // Would use actual CPU usage calculation
        memory_usage: 0, // Would read from /proc/[pid]/stat or similar
        memory_peak: 0,
        io_read: 0,
        io_write: 0,
        open_files: 0,
        threads: 1,
    })
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_memory_mb: None,
            max_cpu_percent: None,
            max_execution_time_seconds: None,
            max_open_files: None,
        }
    }
}