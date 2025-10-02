use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{interval, Duration, MissedTickBehavior};
use tracing::{debug, error, info, warn};

use act_core::{
    events::{
        create_process_status_changed_event, EventPublisher, ProcessEvent, ProcessStopReason,
        ProcessStoppedEvent,
    },
    models::{ProcessStatus, UserProcess},
    repository::{ProcessRepository, ProcessRunner},
    security::{
        ProcessSecurityAuditEntry, RiskLevel, SecurityAction, SecurityAuditLogger, SecurityResult,
    },
    CoreError, Result,
};

/// Process recovery configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessRecoveryConfig {
    /// How often to check for orphaned processes (seconds)
    pub health_check_interval: u64,
    /// How long to wait before considering a process orphaned (seconds)
    pub orphan_timeout: u64,
    /// Maximum number of recovery attempts per process
    pub max_recovery_attempts: usize,
    /// Whether to enable automatic process adoption
    pub enable_process_adoption: bool,
    /// Whether to persist process state to disk
    pub enable_state_persistence: bool,
    /// Directory for persisting process state
    pub state_persistence_dir: Option<String>,
}

impl Default for ProcessRecoveryConfig {
    fn default() -> Self {
        Self {
            health_check_interval: 30, // 30 seconds
            orphan_timeout: 300,       // 5 minutes
            max_recovery_attempts: 3,
            enable_process_adoption: true,
            enable_state_persistence: true,
            state_persistence_dir: Some("/tmp/act-process-recovery".to_string()),
        }
    }
}

/// Persistent process state information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedProcessState {
    pub process_id: String,
    pub user_id: String,
    pub pid: i32,
    pub command: String,
    pub args: Vec<String>,
    pub working_directory: String,
    pub environment_variables: HashMap<String, String>,
    pub start_time: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub recovery_attempts: usize,
    pub server_instance_id: String,
}

/// Process recovery statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessRecoveryStats {
    pub total_processes_monitored: usize,
    pub orphaned_processes_found: usize,
    pub processes_recovered: usize,
    pub processes_terminated: usize,
    pub recovery_failures: usize,
    pub last_health_check: DateTime<Utc>,
}

/// Process recovery service for handling server restarts and process adoption
#[derive(Clone)]
pub struct ProcessRecoveryService {
    process_repository: Arc<dyn ProcessRepository>,
    process_runner: Arc<dyn ProcessRunner>,
    event_publisher: Arc<dyn EventPublisher>,
    security_audit_logger: Arc<dyn SecurityAuditLogger>,
    config: ProcessRecoveryConfig,
    server_instance_id: String,
    stats: Arc<tokio::sync::Mutex<ProcessRecoveryStats>>,
}

impl ProcessRecoveryService {
    pub fn new(
        process_repository: Arc<dyn ProcessRepository>,
        process_runner: Arc<dyn ProcessRunner>,
        event_publisher: Arc<dyn EventPublisher>,
        security_audit_logger: Arc<dyn SecurityAuditLogger>,
        config: ProcessRecoveryConfig,
    ) -> Self {
        let server_instance_id = uuid::Uuid::new_v4().to_string();

        Self {
            process_repository,
            process_runner,
            event_publisher,
            security_audit_logger,
            config,
            server_instance_id,
            stats: Arc::new(tokio::sync::Mutex::new(ProcessRecoveryStats {
                total_processes_monitored: 0,
                orphaned_processes_found: 0,
                processes_recovered: 0,
                processes_terminated: 0,
                recovery_failures: 0,
                last_health_check: Utc::now(),
            })),
        }
    }

    /// Start the process recovery service
    pub async fn start(&self) -> Result<()> {
        info!(
            "Starting process recovery service with instance ID: {}",
            self.server_instance_id
        );

        // Perform initial recovery on startup
        if let Err(e) = self.perform_startup_recovery().await {
            error!("Failed to perform startup recovery: {}", e);
        }

        // Start periodic health checks
        self.start_health_check_loop().await;

        Ok(())
    }

    /// Perform process recovery on server startup
    async fn perform_startup_recovery(&self) -> Result<()> {
        info!("Performing startup process recovery...");

        // Get all processes that were running when the server shut down
        let all_processes = self.get_all_processes().await?;
        let mut recovery_count = 0;
        let mut termination_count = 0;

        for process in all_processes {
            if matches!(
                process.status,
                ProcessStatus::Running | ProcessStatus::Starting | ProcessStatus::Restarting
            ) {
                match self.recover_process(&process).await {
                    Ok(RecoveryResult::Recovered) => {
                        recovery_count += 1;
                        info!(
                            "Successfully recovered process: {} (PID: {:?})",
                            process.name, process.pid
                        );
                    }
                    Ok(RecoveryResult::Terminated) => {
                        termination_count += 1;
                        info!(
                            "Terminated orphaned process: {} (PID: {:?})",
                            process.name, process.pid
                        );
                    }
                    Ok(RecoveryResult::AlreadyTerminated) => {
                        debug!(
                            "Process already terminated: {} (PID: {:?})",
                            process.name, process.pid
                        );
                    }
                    Err(e) => {
                        warn!("Failed to recover process {}: {}", process.name, e);
                        self.update_stats(|stats| stats.recovery_failures += 1)
                            .await;
                    }
                }
            }
        }

        info!(
            "Startup recovery completed: {} processes recovered, {} terminated",
            recovery_count, termination_count
        );

        Ok(())
    }

    /// Start the periodic health check loop
    async fn start_health_check_loop(&self) {
        let service = self.clone();
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(service.config.health_check_interval));
            interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

            loop {
                interval.tick().await;

                if let Err(e) = service.perform_health_check().await {
                    error!("Health check failed: {}", e);
                }
            }
        });
    }

    /// Perform periodic health check
    async fn perform_health_check(&self) -> Result<()> {
        debug!("Performing process health check...");

        let running_processes = self.get_running_processes().await?;
        let mut stats_update = ProcessRecoveryStats {
            total_processes_monitored: running_processes.len(),
            orphaned_processes_found: 0,
            processes_recovered: 0,
            processes_terminated: 0,
            recovery_failures: 0,
            last_health_check: Utc::now(),
        };

        for process in running_processes {
            if let Some(pid) = process.pid {
                match self.check_process_health(&process, pid).await {
                    Ok(HealthStatus::Healthy) => {
                        // Process is healthy, continue monitoring
                        debug!("Process {} (PID: {}) is healthy", process.name, pid);
                    }
                    Ok(HealthStatus::Orphaned) => {
                        stats_update.orphaned_processes_found += 1;
                        match self.handle_orphaned_process(&process, pid).await {
                            Ok(RecoveryResult::Recovered) => {
                                stats_update.processes_recovered += 1;
                                info!(
                                    "Recovered orphaned process: {} (PID: {})",
                                    process.name, pid
                                );
                            }
                            Ok(RecoveryResult::Terminated) => {
                                stats_update.processes_terminated += 1;
                                info!(
                                    "Terminated orphaned process: {} (PID: {})",
                                    process.name, pid
                                );
                            }
                            Ok(RecoveryResult::AlreadyTerminated) => {
                                // Process was already cleaned up
                                debug!("Orphaned process already terminated: {}", process.name);
                            }
                            Err(e) => {
                                stats_update.recovery_failures += 1;
                                warn!("Failed to handle orphaned process {}: {}", process.name, e);
                            }
                        }
                    }
                    Ok(HealthStatus::Terminated) => {
                        // Process has terminated, update database
                        self.handle_terminated_process(&process).await?;
                    }
                    Err(e) => {
                        warn!("Failed to check health of process {}: {}", process.name, e);
                        stats_update.recovery_failures += 1;
                    }
                }
            }
        }

        self.update_stats_with_values(stats_update).await;

        debug!("Health check completed successfully");
        Ok(())
    }

    /// Check the health status of a process
    async fn check_process_health(&self, process: &UserProcess, pid: i32) -> Result<HealthStatus> {
        // First check if the process is still running
        let is_running = self.process_runner.is_process_running(pid).await?;

        if !is_running {
            return Ok(HealthStatus::Terminated);
        }

        // Check if this is an orphaned process (started by a different server instance)
        if let Some(persisted_state) = self.load_persisted_state(&process.id).await? {
            if persisted_state.server_instance_id != self.server_instance_id {
                let orphan_age = Utc::now().signed_duration_since(persisted_state.last_seen);
                if orphan_age.num_seconds() > self.config.orphan_timeout as i64 {
                    return Ok(HealthStatus::Orphaned);
                }
            }
        }

        // Update last seen timestamp
        self.update_last_seen(&process.id).await?;

        Ok(HealthStatus::Healthy)
    }

    /// Handle an orphaned process
    async fn handle_orphaned_process(
        &self,
        process: &UserProcess,
        pid: i32,
    ) -> Result<RecoveryResult> {
        warn!("Handling orphaned process: {} (PID: {})", process.name, pid);

        // Log security audit entry
        self.log_security_audit(
            process,
            SecurityAction::ProcessStart,
            SecurityResult::Warning,
        )
        .await;

        if self.config.enable_process_adoption {
            // Try to adopt the orphaned process
            match self.adopt_process(process, pid).await {
                Ok(_) => {
                    info!("Successfully adopted orphaned process: {}", process.name);
                    return Ok(RecoveryResult::Recovered);
                }
                Err(e) => {
                    warn!("Failed to adopt orphaned process {}: {}", process.name, e);
                }
            }
        }

        // If adoption failed or is disabled, terminate the orphaned process
        match self.terminate_orphaned_process(process, pid).await {
            Ok(_) => Ok(RecoveryResult::Terminated),
            Err(e) => {
                error!(
                    "Failed to terminate orphaned process {}: {}",
                    process.name, e
                );
                Err(e)
            }
        }
    }

    /// Adopt an orphaned process
    async fn adopt_process(&self, process: &UserProcess, pid: i32) -> Result<()> {
        info!("Adopting orphaned process: {} (PID: {})", process.name, pid);

        // Update the process state to indicate it's now managed by this server instance
        self.save_persisted_state(&PersistedProcessState {
            process_id: process.id.clone(),
            user_id: process.user_id.clone(),
            pid,
            command: process.command.clone(),
            args: process.args.clone().unwrap_or_default(),
            working_directory: process.working_directory.clone(),
            environment_variables: process.environment_variables.clone().unwrap_or_default(),
            start_time: process.start_time,
            last_seen: Utc::now(),
            recovery_attempts: 0,
            server_instance_id: self.server_instance_id.clone(),
        })
        .await?;

        // Get current resource usage
        let resource_usage = self.process_runner.get_resource_usage(pid).await.ok();

        // Publish status change event
        let status_changed_event = create_process_status_changed_event(
            &process.user_id,
            process,
            process.status.clone(),
            ProcessStatus::Running,
            resource_usage,
            Some(format!("adoption-{}", self.server_instance_id)),
        );

        if let Err(e) = self.event_publisher.publish(status_changed_event).await {
            warn!(
                "Failed to publish adoption event for process {}: {}",
                process.name, e
            );
        }

        Ok(())
    }

    /// Terminate an orphaned process
    async fn terminate_orphaned_process(&self, process: &UserProcess, pid: i32) -> Result<()> {
        info!(
            "Terminating orphaned process: {} (PID: {})",
            process.name, pid
        );

        // Try to stop the process gracefully
        if let Err(e) = self.process_runner.stop_process(pid).await {
            warn!(
                "Failed to stop orphaned process gracefully, force killing: {}",
                e
            );
            self.process_runner.force_kill_process(pid).await?;
        }

        // Update process status in database
        self.process_repository
            .update_status(&process.user_id, &process.id, "Terminated", None)
            .await?;

        // Clean up persisted state
        self.remove_persisted_state(&process.id).await?;

        // Publish stopped event
        let stopped_event = ProcessEvent::ProcessStopped(ProcessStoppedEvent {
            event_id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            user_id: process.user_id.clone(),
            process_id: process.id.clone(),
            process_name: process.name.clone(),
            pid: Some(pid),
            exit_code: None,
            reason: ProcessStopReason::Error(
                "Orphaned process terminated by recovery service".to_string(),
            ),
            correlation_id: Some(format!("orphan-cleanup-{}", self.server_instance_id)),
        });

        if let Err(e) = self.event_publisher.publish(stopped_event).await {
            warn!(
                "Failed to publish termination event for process {}: {}",
                process.name, e
            );
        }

        Ok(())
    }

    /// Handle a terminated process
    async fn handle_terminated_process(&self, process: &UserProcess) -> Result<()> {
        debug!("Handling terminated process: {}", process.name);

        // Update process status in database
        self.process_repository
            .update_status(&process.user_id, &process.id, "Terminated", None)
            .await?;

        // Clean up persisted state
        self.remove_persisted_state(&process.id).await?;

        Ok(())
    }

    /// Recover a specific process
    async fn recover_process(&self, process: &UserProcess) -> Result<RecoveryResult> {
        if let Some(pid) = process.pid {
            // Check if the process is still running
            match self.process_runner.is_process_running(pid).await {
                Ok(true) => {
                    // Process is running, try to adopt it
                    self.adopt_process(process, pid).await?;
                    Ok(RecoveryResult::Recovered)
                }
                Ok(false) => {
                    // Process is not running, update status
                    self.handle_terminated_process(process).await?;
                    Ok(RecoveryResult::AlreadyTerminated)
                }
                Err(e) => {
                    warn!(
                        "Failed to check if process {} is running: {}",
                        process.name, e
                    );
                    Err(e)
                }
            }
        } else {
            // Process has no PID, mark as failed
            self.process_repository
                .update_status(&process.user_id, &process.id, "Failed", None)
                .await?;
            Ok(RecoveryResult::AlreadyTerminated)
        }
    }

    /// Get all processes from the database
    async fn get_all_processes(&self) -> Result<Vec<UserProcess>> {
        self.process_repository.list_all_processes().await
    }

    /// Get all running processes from the database
    async fn get_running_processes(&self) -> Result<Vec<UserProcess>> {
        self.process_repository.list_all_running_processes().await
    }

    /// Save persisted process state
    async fn save_persisted_state(&self, state: &PersistedProcessState) -> Result<()> {
        if !self.config.enable_state_persistence {
            return Ok(());
        }

        let state_dir = self.config.state_persistence_dir.as_ref().ok_or_else(|| {
            CoreError::Configuration("State persistence directory not configured".to_string())
        })?;

        // Ensure state directory exists
        tokio::fs::create_dir_all(state_dir)
            .await
            .map_err(|e| CoreError::Io(format!("Failed to create state directory: {}", e)))?;

        let state_file = format!("{}/{}.json", state_dir, state.process_id);
        let state_json = serde_json::to_string_pretty(state).map_err(|e| {
            CoreError::Serialization(format!("Failed to serialize process state: {}", e))
        })?;

        tokio::fs::write(&state_file, state_json)
            .await
            .map_err(|e| CoreError::Io(format!("Failed to write state file: {}", e)))?;

        debug!("Saved persisted state for process: {}", state.process_id);
        Ok(())
    }

    /// Load persisted process state
    async fn load_persisted_state(
        &self,
        process_id: &str,
    ) -> Result<Option<PersistedProcessState>> {
        if !self.config.enable_state_persistence {
            return Ok(None);
        }

        let state_dir = self.config.state_persistence_dir.as_ref().ok_or_else(|| {
            CoreError::Configuration("State persistence directory not configured".to_string())
        })?;

        let state_file = format!("{}/{}.json", state_dir, process_id);

        match tokio::fs::read_to_string(&state_file).await {
            Ok(state_json) => {
                let state = serde_json::from_str(&state_json).map_err(|e| {
                    CoreError::Serialization(format!("Failed to deserialize process state: {}", e))
                })?;
                Ok(Some(state))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(CoreError::Io(format!("Failed to read state file: {}", e))),
        }
    }

    /// Remove persisted process state
    async fn remove_persisted_state(&self, process_id: &str) -> Result<()> {
        if !self.config.enable_state_persistence {
            return Ok(());
        }

        let state_dir = self.config.state_persistence_dir.as_ref().ok_or_else(|| {
            CoreError::Configuration("State persistence directory not configured".to_string())
        })?;

        let state_file = format!("{}/{}.json", state_dir, process_id);

        match tokio::fs::remove_file(&state_file).await {
            Ok(_) => {
                debug!("Removed persisted state for process: {}", process_id);
                Ok(())
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()), // Already removed
            Err(e) => {
                warn!(
                    "Failed to remove state file for process {}: {}",
                    process_id, e
                );
                Ok(()) // Don't fail the operation if we can't clean up the state file
            }
        }
    }

    /// Update last seen timestamp for a process
    async fn update_last_seen(&self, process_id: &str) -> Result<()> {
        if let Some(mut state) = self.load_persisted_state(process_id).await? {
            state.last_seen = Utc::now();
            self.save_persisted_state(&state).await?;
        }
        Ok(())
    }

    /// Log security audit entry
    async fn log_security_audit(
        &self,
        process: &UserProcess,
        action: SecurityAction,
        result: SecurityResult,
    ) {
        let audit_entry = ProcessSecurityAuditEntry {
            timestamp: Utc::now(),
            user_id: process.user_id.clone(),
            process_id: Some(process.id.clone()),
            command: process.command.clone(),
            args: process.args.clone().unwrap_or_default(),
            working_directory: process.working_directory.clone(),
            action,
            result,
            reason: Some("Process recovery operation".to_string()),
            risk_level: RiskLevel::Medium,
        };

        self.security_audit_logger.log_security_event(audit_entry);
    }

    /// Update recovery statistics
    async fn update_stats<F>(&self, update_fn: F)
    where
        F: FnOnce(&mut ProcessRecoveryStats),
    {
        let mut stats = self.stats.lock().await;
        update_fn(&mut stats);
    }

    async fn update_stats_with_values(&self, new_stats: ProcessRecoveryStats) {
        let mut stats = self.stats.lock().await;
        stats.total_processes_monitored = new_stats.total_processes_monitored;
        stats.orphaned_processes_found += new_stats.orphaned_processes_found;
        stats.processes_recovered += new_stats.processes_recovered;
        stats.processes_terminated += new_stats.processes_terminated;
        stats.recovery_failures += new_stats.recovery_failures;
        stats.last_health_check = new_stats.last_health_check;
    }

    /// Get current recovery statistics
    pub async fn get_recovery_stats(&self) -> ProcessRecoveryStats {
        self.stats.lock().await.clone()
    }
}

#[derive(Debug, Clone, PartialEq)]
enum HealthStatus {
    Healthy,
    Orphaned,
    Terminated,
}

#[derive(Debug, Clone, PartialEq)]
enum RecoveryResult {
    Recovered,
    Terminated,
    AlreadyTerminated,
}
