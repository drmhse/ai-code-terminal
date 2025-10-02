use act_core::{
    events::{
        create_process_created_event, create_process_started_event,
        create_process_status_changed_event, EventPublisher,
    },
    models::{ProcessStatus, UserProcess},
    repository::{
        CreateProcessRequest, ProcessOutputConfig, ProcessRepository, ProcessResourceLimits,
        ProcessRunner, ProcessStartRequest,
    },
    security::{
        ProcessSecurityAuditEntry, ProcessSecurityValidator, RiskLevel, SecurityAction,
        SecurityAuditLogger, SecurityResult,
    },
    CoreError, Result,
};
use chrono::Utc;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

#[derive(Clone)]
pub struct ProcessService {
    process_repository: Arc<dyn ProcessRepository>,
    process_runner: Arc<dyn ProcessRunner>,
    event_publisher: Arc<dyn EventPublisher>,
    security_validator: Arc<ProcessSecurityValidator>,
    security_audit_logger: Arc<dyn SecurityAuditLogger>,
}

impl ProcessService {
    pub fn new(
        process_repository: Arc<dyn ProcessRepository>,
        process_runner: Arc<dyn ProcessRunner>,
        event_publisher: Arc<dyn EventPublisher>,
        security_validator: Arc<ProcessSecurityValidator>,
        security_audit_logger: Arc<dyn SecurityAuditLogger>,
    ) -> Self {
        Self {
            process_repository,
            process_runner,
            event_publisher,
            security_validator,
            security_audit_logger,
        }
    }

    pub async fn create_process(
        &self,
        user_id: &str,
        request: CreateProcessRequest,
    ) -> Result<UserProcess> {
        info!("Creating process '{}' for user {}", request.name, user_id);

        // Security validation
        let args = request.args.clone().unwrap_or_default();
        let env_vars = request.environment_variables.clone().unwrap_or_default();

        // If workspace_root is provided, use workspace-aware validation
        let validation_result = if let Some(ref workspace_root_str) = request.workspace_root {
            let workspace_root = std::path::Path::new(workspace_root_str);
            info!(
                "Validating process with workspace jail: {}",
                workspace_root.display()
            );

            self.security_validator
                .validate_process_request_with_workspace(
                    &request.command,
                    &args,
                    &request.working_directory,
                    &env_vars,
                    workspace_root,
                )
        } else {
            // No workspace specified, use standard validation
            self.security_validator.validate_process_request(
                &request.command,
                &args,
                &request.working_directory,
                &env_vars,
            )
        };

        // Log security audit entry
        let audit_entry = ProcessSecurityAuditEntry {
            timestamp: Utc::now(),
            user_id: user_id.to_string(),
            process_id: None,
            command: request.command.clone(),
            args: args.clone(),
            working_directory: request.working_directory.clone(),
            action: SecurityAction::ProcessCreate,
            result: if validation_result.is_ok() {
                SecurityResult::Allowed
            } else {
                SecurityResult::Blocked
            },
            reason: validation_result.as_ref().err().map(|e| e.to_string()),
            risk_level: RiskLevel::Medium,
        };
        self.security_audit_logger.log_security_event(audit_entry);

        // Fail if validation failed
        validation_result?;

        let mut process = self
            .process_repository
            .create(user_id, request.clone())
            .await?;

        // Publish process created event
        let created_event = create_process_created_event(
            user_id, &process, None, // correlation_id
        );
        if let Err(e) = self.event_publisher.publish(created_event).await {
            warn!("Failed to publish process created event: {}", e);
        }

        // Start the process with enhanced configuration
        let start_request = ProcessStartRequest {
            command: process.command.clone(),
            args: process.args.clone().unwrap_or_default(),
            working_directory: process.working_directory.clone(),
            environment_variables: process.environment_variables.clone().unwrap_or_default(),
            resource_limits: Some(ProcessResourceLimits {
                max_memory_bytes: Some(1024 * 1024 * 1024), // 1GB default
                max_cpu_percent: Some(80.0),                // 80% CPU max
                max_runtime_seconds: Some(3600),            // 1 hour default
                max_file_descriptors: Some(1024),
            }),
            output_config: Some(ProcessOutputConfig {
                max_stdout_size: Some(10 * 1024 * 1024), // 10MB
                max_stderr_size: Some(10 * 1024 * 1024), // 10MB
                buffer_lines: Some(1000),
                output_retention_seconds: Some(3600), // 1 hour
            }),
        };

        match self.process_runner.start_process(start_request).await {
            Ok(process_info) => {
                // Update the process with the PID and running status
                let pid = Some(process_info.pid);
                self.process_repository
                    .update_status(user_id, &process.id, "Running", None)
                    .await?;

                // Update the process object with the PID
                process.pid = pid;
                let old_status = process.status.clone();
                process.status = ProcessStatus::Running;

                info!(
                    "Process '{}' started with PID {}",
                    process.name, process_info.pid
                );

                // Publish process started event
                let started_event = create_process_started_event(
                    user_id,
                    &process,
                    process_info.pid,
                    None, // correlation_id
                );
                if let Err(e) = self.event_publisher.publish(started_event).await {
                    warn!("Failed to publish process started event: {}", e);
                }

                // Publish status change event
                let status_changed_event = create_process_status_changed_event(
                    user_id,
                    &process,
                    old_status,
                    ProcessStatus::Running,
                    process_info.resource_usage,
                    None, // correlation_id
                );
                if let Err(e) = self.event_publisher.publish(status_changed_event).await {
                    warn!("Failed to publish process status changed event: {}", e);
                }

                // Start monitoring the process
                let service_clone = self.clone();
                let process_id = process.id.clone();
                let user_id = user_id.to_string();
                tokio::spawn(async move {
                    service_clone
                        .monitor_process(&user_id, &process_id, process_info.pid)
                        .await;
                });
            }
            Err(e) => {
                // Mark the process as failed
                self.process_repository
                    .update_status(user_id, &process.id, "Failed", None)
                    .await?;
                let old_status = process.status.clone();
                process.status = ProcessStatus::Failed;
                error!("Failed to start process '{}': {}", process.name, e);

                // Publish status change event
                let status_changed_event = create_process_status_changed_event(
                    user_id,
                    &process,
                    old_status,
                    ProcessStatus::Failed,
                    None, // resource_usage
                    None, // correlation_id
                );
                if let Err(event_err) = self.event_publisher.publish(status_changed_event).await {
                    warn!(
                        "Failed to publish process status changed event: {}",
                        event_err
                    );
                }

                return Err(e);
            }
        }

        Ok(process)
    }

    pub async fn get_process(&self, user_id: &str, process_id: &str) -> Result<UserProcess> {
        self.process_repository.get_by_id(user_id, process_id).await
    }

    pub async fn list_user_processes(&self, user_id: &str) -> Result<Vec<UserProcess>> {
        self.process_repository.list_for_user(user_id).await
    }

    pub async fn list_workspace_processes(
        &self,
        user_id: &str,
        workspace_id: &str,
    ) -> Result<Vec<UserProcess>> {
        self.process_repository
            .list_for_workspace(user_id, &workspace_id.to_string())
            .await
    }

    pub async fn list_session_processes(
        &self,
        user_id: &str,
        session_id: &str,
    ) -> Result<Vec<UserProcess>> {
        self.process_repository
            .list_for_session(user_id, session_id)
            .await
    }

    pub async fn stop_process(&self, user_id: &str, process_id: &str) -> Result<()> {
        info!("Stopping process {} for user {}", process_id, user_id);

        let process = self
            .process_repository
            .get_by_id(user_id, process_id)
            .await?;

        if let Some(pid) = process.pid {
            self.process_runner.stop_process(pid).await?;
            self.process_repository
                .update_status(user_id, process_id, "Stopped", None)
                .await?;
        } else {
            return Err(CoreError::Process("Process is not running".to_string()));
        }

        Ok(())
    }

    pub async fn restart_process(&self, user_id: &str, process_id: &str) -> Result<UserProcess> {
        info!("Restarting process {} for user {}", process_id, user_id);

        // Stop the process first
        if let Err(e) = self.stop_process(user_id, process_id).await {
            warn!("Failed to stop process {} for restart: {}", process_id, e);
        }

        // Get the process details
        let process = self
            .process_repository
            .get_by_id(user_id, process_id)
            .await?;

        // Create a new start request
        let start_request = ProcessStartRequest {
            command: process.command.clone(),
            args: process.args.clone().unwrap_or_default(),
            working_directory: process.working_directory.clone(),
            environment_variables: process.environment_variables.clone().unwrap_or_default(),
            resource_limits: None,
            output_config: None,
        };

        // Start the process
        match self.process_runner.start_process(start_request).await {
            Ok(process_info) => {
                // Update the process with the new PID and status
                self.process_repository
                    .update_status(user_id, process_id, "Running", None)
                    .await?;

                // Increment restart count
                let restart_count = self
                    .process_repository
                    .increment_restart_count(user_id, process_id)
                    .await?;

                // Get the updated process
                let mut updated_process = self
                    .process_repository
                    .get_by_id(user_id, process_id)
                    .await?;
                updated_process.pid = Some(process_info.pid);
                updated_process.status = ProcessStatus::Running;
                updated_process.restart_count = restart_count;

                info!(
                    "Process '{}' restarted with PID {}",
                    updated_process.name, process_info.pid
                );

                // Start monitoring the process
                let service_clone = self.clone();
                let process_id = process_id.to_string();
                let user_id = user_id.to_string();
                tokio::spawn(async move {
                    service_clone
                        .monitor_process(&user_id, &process_id, process_info.pid)
                        .await;
                });

                Ok(updated_process)
            }
            Err(e) => {
                self.process_repository
                    .update_status(user_id, process_id, "Failed", None)
                    .await?;
                error!("Failed to restart process '{}': {}", process.name, e);
                Err(e)
            }
        }
    }

    pub async fn delete_process(&self, user_id: &str, process_id: &str) -> Result<()> {
        info!("Deleting process {} for user {}", process_id, user_id);

        // Try to stop the process first
        if let Err(e) = self.stop_process(user_id, process_id).await {
            warn!("Failed to stop process {} for deletion: {}", process_id, e);
        }

        // Delete from repository
        self.process_repository.delete(user_id, process_id).await?;

        Ok(())
    }

    pub async fn get_process_output(
        &self,
        user_id: &str,
        process_id: &str,
    ) -> Result<(String, String)> {
        let process = self
            .process_repository
            .get_by_id(user_id, process_id)
            .await?;

        if let Some(pid) = process.pid {
            self.process_runner.get_latest_output(pid, None).await
        } else {
            Err(CoreError::Process("Process is not running".to_string()))
        }
    }

    async fn monitor_process(&self, user_id: &str, process_id: &str, pid: i32) {
        let mut retry_count = 0;
        let max_retries = 5;
        let retry_delay = Duration::from_secs(2);

        loop {
            match self.process_runner.is_process_running(pid).await {
                Ok(true) => {
                    // Process is still running, continue monitoring
                    sleep(Duration::from_secs(5)).await;
                    retry_count = 0; // Reset retry count on successful check
                }
                Ok(false) => {
                    // Process has terminated
                    info!("Process {} (PID: {}) has terminated", process_id, pid);

                    // Get the exit status
                    match self.process_runner.get_process_status(pid).await {
                        Ok(process_info) => {
                            let status = if process_info.exit_code == Some(0) {
                                "Terminated"
                            } else {
                                "Failed"
                            };

                            if let Err(e) = self
                                .process_repository
                                .update_status(user_id, process_id, status, process_info.exit_code)
                                .await
                            {
                                error!("Failed to update process status: {}", e);
                            }
                        }
                        Err(e) => {
                            error!("Failed to get process status: {}", e);
                            if let Err(e) = self
                                .process_repository
                                .update_status(user_id, process_id, "Failed", None)
                                .await
                            {
                                error!("Failed to update process status: {}", e);
                            }
                        }
                    }

                    break;
                }
                Err(e) => {
                    retry_count += 1;
                    if retry_count >= max_retries {
                        error!(
                            "Failed to monitor process {} after {} retries: {}",
                            process_id, max_retries, e
                        );
                        if let Err(e) = self
                            .process_repository
                            .update_status(user_id, process_id, "Failed", None)
                            .await
                        {
                            error!("Failed to update process status: {}", e);
                        }
                        break;
                    }
                    warn!(
                        "Failed to check process status (attempt {}/{}): {}",
                        retry_count, max_retries, e
                    );
                    sleep(retry_delay).await;
                }
            }
        }
    }

    pub async fn update_process(
        &self,
        user_id: &str,
        process_id: &str,
        request: act_core::repository::UpdateProcessRequest,
    ) -> Result<UserProcess> {
        info!("Updating process {} for user {}", process_id, user_id);

        // Get the current process to check if it's running
        let current_process = self
            .process_repository
            .get_by_id(user_id, process_id)
            .await?;

        // If the process is running, we need to handle updates carefully
        if current_process.status == act_core::models::ProcessStatus::Running {
            // For running processes, only allow certain updates
            let restricted_request = act_core::repository::UpdateProcessRequest {
                name: request.name,
                command: None,               // Cannot change command while running
                args: None,                  // Cannot change args while running
                working_directory: None,     // Cannot change working directory while running
                environment_variables: None, // Cannot change env vars while running
                max_restarts: request.max_restarts,
                auto_restart: request.auto_restart,
                tags: request.tags,
            };

            let updated_process = self
                .process_repository
                .update(user_id, process_id, restricted_request)
                .await?;
            info!(
                "Process {} updated (restricted mode for running process)",
                process_id
            );
            Ok(updated_process)
        } else {
            // For non-running processes, allow all updates
            let updated_process = self
                .process_repository
                .update(user_id, process_id, request)
                .await?;
            info!("Process {} updated successfully", process_id);
            Ok(updated_process)
        }
    }

    pub async fn cleanup_failed_processes(&self, user_id: &str) -> Result<usize> {
        let failed_processes = self
            .process_repository
            .list_by_status(user_id, "Failed")
            .await?;
        let mut cleaned_count = 0;

        for process in failed_processes {
            if process.auto_restart && process.restart_count < process.max_restarts {
                info!("Auto-restarting failed process '{}'", process.name);
                if let Err(e) = self.restart_process(user_id, &process.id).await {
                    error!("Failed to auto-restart process '{}': {}", process.name, e);
                }
            } else if !process.auto_restart {
                // Clean up non-auto-restart processes
                if let Err(e) = self.process_repository.delete(user_id, &process.id).await {
                    error!("Failed to cleanup process '{}': {}", process.name, e);
                } else {
                    cleaned_count += 1;
                }
            }
        }

        Ok(cleaned_count)
    }

    pub async fn count_active_processes(&self) -> Result<u32> {
        self.process_repository
            .count_active_processes()
            .await
            .map(|count| count as u32)
    }
}

#[cfg(test)]
mod tests {
    include!("process_service_tests.rs");
}
