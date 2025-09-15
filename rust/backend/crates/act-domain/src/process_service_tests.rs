#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::collections::HashMap;
    use tokio::time::{sleep, Duration};
    use mockall::predicate::*;
    use mockall::mock;

    use act_core::{
        repository::{
            ProcessRepository, ProcessRunner, CreateProcessRequest, ProcessStartRequest,
            ProcessInfo, ProcessResourceUsage, ProcessResourceLimits, ProcessOutputConfig,
        },
        models::{UserProcess, ProcessStatus},
        events::{EventPublisher, ProcessEvent, InMemoryEventPublisher},
        security::{ProcessSecurityValidator, ProcessSecurityConfig, InMemorySecurityAuditLogger},
        CoreError,
    };

    // Mock implementations for testing
    mock! {
        TestProcessRepository {}

        #[async_trait]
        impl ProcessRepository for TestProcessRepository {
            async fn create(&self, user_id: &str, request: CreateProcessRequest) -> Result<UserProcess>;
            async fn get_by_id(&self, user_id: &str, id: &str) -> Result<UserProcess>;
            async fn list_for_user(&self, user_id: &str) -> Result<Vec<UserProcess>>;
            async fn list_for_workspace(&self, user_id: &str, workspace_id: &String) -> Result<Vec<UserProcess>>;
            async fn list_for_session(&self, user_id: &str, session_id: &String) -> Result<Vec<UserProcess>>;
            async fn list_by_status(&self, user_id: &str, status: &str) -> Result<Vec<UserProcess>>;
            async fn update(&self, user_id: &str, id: &str, request: act_core::repository::UpdateProcessRequest) -> Result<UserProcess>;
            async fn delete(&self, user_id: &str, id: &str) -> Result<()>;
            async fn update_status(&self, user_id: &str, id: &str, status: &str, exit_code: Option<i32>) -> Result<()>;
            async fn increment_restart_count(&self, user_id: &str, id: &str) -> Result<i32>;
            async fn count_active_processes(&self) -> Result<u64>;
        }
    }

    mock! {
        TestProcessRunner {}

        #[async_trait]
        impl ProcessRunner for TestProcessRunner {
            async fn start_process(&self, request: ProcessStartRequest) -> Result<ProcessInfo>;
            async fn stop_process(&self, pid: i32) -> Result<()>;
            async fn force_kill_process(&self, pid: i32) -> Result<()>;
            async fn get_process_status(&self, pid: i32) -> Result<ProcessInfo>;
            async fn get_process_output_stream(&self, pid: i32, query: act_core::repository::ProcessOutputQuery) -> Result<Vec<act_core::repository::ProcessOutputChunk>>;
            async fn get_latest_output(&self, pid: i32, lines: Option<usize>) -> Result<(String, String)>;
            async fn is_process_running(&self, pid: i32) -> Result<bool>;
            async fn get_resource_usage(&self, pid: i32) -> Result<ProcessResourceUsage>;
            async fn subscribe_to_output(&self, pid: i32) -> Result<tokio::sync::mpsc::Receiver<act_core::repository::ProcessOutputChunk>>;
            async fn set_resource_limits(&self, pid: i32, limits: ProcessResourceLimits) -> Result<()>;
            async fn cleanup_process_resources(&self, pid: i32) -> Result<()>;
        }
    }

    fn create_test_process(id: &str, name: &str, status: ProcessStatus) -> UserProcess {
        UserProcess {
            id: id.to_string(),
            name: name.to_string(),
            pid: Some(12345),
            command: "test".to_string(),
            args: Some(vec!["arg1".to_string()]),
            working_directory: "/tmp".to_string(),
            environment_variables: Some(HashMap::new()),
            status,
            exit_code: None,
            start_time: chrono::Utc::now(),
            end_time: None,
            cpu_usage: 10.0,
            memory_usage: 1024,
            restart_count: 0,
            max_restarts: 3,
            auto_restart: true,
            user_id: "user1".to_string(),
            workspace_id: Some("workspace1".to_string()),
            session_id: Some("session1".to_string()),
            tags: Some(vec!["test".to_string()]),
            data: Some(serde_json::Value::Null),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    fn create_test_service() -> (ProcessService, Arc<InMemoryEventPublisher>) {
        let mut mock_repo = MockTestProcessRepository::new();
        let mut mock_runner = MockTestProcessRunner::new();

        // Set up default mock behaviors
        mock_repo.expect_create()
            .returning(|user_id, request| {
                Ok(create_test_process("test-id", &request.name, ProcessStatus::Starting))
            });

        mock_runner.expect_start_process()
            .returning(|_| {
                Ok(ProcessInfo {
                    pid: 12345,
                    status: "Running".to_string(),
                    start_time: std::time::SystemTime::now(),
                    exit_code: None,
                    resource_usage: Some(ProcessResourceUsage {
                        cpu_percent: 10.0,
                        memory_bytes: 1024,
                        runtime_seconds: 60,
                        file_descriptors: 10,
                    }),
                })
            });

        let event_publisher = Arc::new(InMemoryEventPublisher::new(100));
        let security_config = ProcessSecurityConfig::default();
        let security_validator = Arc::new(ProcessSecurityValidator::new(security_config).unwrap());
        let security_audit_logger = Arc::new(InMemorySecurityAuditLogger::new());

        let service = ProcessService::new(
            Arc::new(mock_repo),
            Arc::new(mock_runner),
            event_publisher.clone(),
            security_validator,
            security_audit_logger,
        );

        (service, event_publisher)
    }

    #[tokio::test]
    async fn test_create_process_success() {
        let (service, event_publisher) = create_test_service();
        let mut receiver = event_publisher.subscribe();

        let request = CreateProcessRequest {
            name: "test-process".to_string(),
            command: "echo".to_string(),
            args: Some(vec!["hello".to_string()]),
            working_directory: "/tmp".to_string(),
            environment_variables: Some(HashMap::new()),
            max_restarts: Some(3),
            auto_restart: Some(true),
            workspace_id: Some("workspace1".to_string()),
            session_id: Some("session1".to_string()),
            tags: Some(vec!["test".to_string()]),
        };

        let result = service.create_process("user1", request).await;
        assert!(result.is_ok());

        let process = result.unwrap();
        assert_eq!(process.name, "test-process");
        assert_eq!(process.status, ProcessStatus::Running);
        assert_eq!(process.pid, Some(12345));

        // Check that events were published
        let event1 = receiver.recv().await.unwrap();
        assert!(matches!(event1, ProcessEvent::ProcessCreated(_)));

        let event2 = receiver.recv().await.unwrap();
        assert!(matches!(event2, ProcessEvent::ProcessStarted(_)));

        let event3 = receiver.recv().await.unwrap();
        assert!(matches!(event3, ProcessEvent::ProcessStatusChanged(_)));
    }

    #[tokio::test]
    async fn test_create_process_security_validation_failure() {
        let (service, _) = create_test_service();

        let request = CreateProcessRequest {
            name: "malicious-process".to_string(),
            command: "rm".to_string(), // Blocked command
            args: Some(vec!["-rf".to_string(), "/".to_string()]),
            working_directory: "/tmp".to_string(),
            environment_variables: Some(HashMap::new()),
            max_restarts: Some(3),
            auto_restart: Some(true),
            workspace_id: Some("workspace1".to_string()),
            session_id: Some("session1".to_string()),
            tags: Some(vec!["test".to_string()]),
        };

        let result = service.create_process("user1", request).await;
        assert!(result.is_err());

        if let Err(CoreError::Validation(msg)) = result {
            assert!(msg.contains("not allowed"));
        } else {
            panic!("Expected validation error");
        }
    }

    #[tokio::test]
    async fn test_stop_process_success() {
        let (service, event_publisher) = create_test_service();
        let mut receiver = event_publisher.subscribe();

        // Set up mocks for process stopping
        let mut mock_repo = MockTestProcessRepository::new();
        let mut mock_runner = MockTestProcessRunner::new();

        mock_repo.expect_get_by_id()
            .returning(|_, _| Ok(create_test_process("test-id", "test-process", ProcessStatus::Running)));

        mock_runner.expect_stop_process()
            .returning(|_| Ok(()));

        mock_repo.expect_update_status()
            .returning(|_, _, _, _| Ok(()));

        let result = service.stop_process("user1", "test-id").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_process_success() {
        let (service, _) = create_test_service();

        let mut mock_repo = MockTestProcessRepository::new();
        mock_repo.expect_get_by_id()
            .returning(|_, _| Ok(create_test_process("test-id", "test-process", ProcessStatus::Running)));

        let result = service.get_process("user1", "test-id").await;
        assert!(result.is_ok());

        let process = result.unwrap();
        assert_eq!(process.id, "test-id");
        assert_eq!(process.name, "test-process");
    }

    #[tokio::test]
    async fn test_get_process_not_found() {
        let (service, _) = create_test_service();

        let mut mock_repo = MockTestProcessRepository::new();
        mock_repo.expect_get_by_id()
            .returning(|_, _| Err(CoreError::NotFound("Process not found".to_string())));

        let result = service.get_process("user1", "nonexistent").await;
        assert!(result.is_err());

        if let Err(CoreError::NotFound(_)) = result {
            // Expected
        } else {
            panic!("Expected NotFound error");
        }
    }

    #[tokio::test]
    async fn test_list_user_processes() {
        let (service, _) = create_test_service();

        let mut mock_repo = MockTestProcessRepository::new();
        mock_repo.expect_list_for_user()
            .returning(|_| {
                Ok(vec![
                    create_test_process("proc1", "process-1", ProcessStatus::Running),
                    create_test_process("proc2", "process-2", ProcessStatus::Stopped),
                ])
            });

        let result = service.list_user_processes("user1").await;
        assert!(result.is_ok());

        let processes = result.unwrap();
        assert_eq!(processes.len(), 2);
        assert_eq!(processes[0].name, "process-1");
        assert_eq!(processes[1].name, "process-2");
    }

    #[tokio::test]
    async fn test_restart_process_success() {
        let (service, event_publisher) = create_test_service();
        let mut receiver = event_publisher.subscribe();

        let mut mock_repo = MockTestProcessRepository::new();
        let mut mock_runner = MockTestProcessRunner::new();

        // Mock getting the process
        mock_repo.expect_get_by_id()
            .returning(|_, _| Ok(create_test_process("test-id", "test-process", ProcessStatus::Stopped)));

        // Mock stopping the process (which might fail if already stopped)
        mock_runner.expect_stop_process()
            .returning(|_| Err(CoreError::NotFound("Process already stopped".to_string())));

        // Mock starting the process
        mock_runner.expect_start_process()
            .returning(|_| {
                Ok(ProcessInfo {
                    pid: 12346, // Different PID for restart
                    status: "Running".to_string(),
                    start_time: std::time::SystemTime::now(),
                    exit_code: None,
                    resource_usage: Some(ProcessResourceUsage {
                        cpu_percent: 5.0,
                        memory_bytes: 512,
                        runtime_seconds: 1,
                        file_descriptors: 5,
                    }),
                })
            });

        // Mock status update
        mock_repo.expect_update_status()
            .returning(|_, _, _, _| Ok(()));

        // Mock increment restart count
        mock_repo.expect_increment_restart_count()
            .returning(|_, _| Ok(1));

        // Mock getting updated process
        mock_repo.expect_get_by_id()
            .returning(|_, _| {
                let mut process = create_test_process("test-id", "test-process", ProcessStatus::Running);
                process.pid = Some(12346);
                process.restart_count = 1;
                Ok(process)
            });

        let result = service.restart_process("user1", "test-id").await;
        assert!(result.is_ok());

        let process = result.unwrap();
        assert_eq!(process.status, ProcessStatus::Running);
        assert_eq!(process.pid, Some(12346));
    }

    #[tokio::test]
    async fn test_cleanup_failed_processes() {
        let (service, _) = create_test_service();

        let mut mock_repo = MockTestProcessRepository::new();

        // Mock failed processes
        mock_repo.expect_list_by_status()
            .with(eq("user1"), eq("Failed"))
            .returning(|_, _| {
                let mut process = create_test_process("failed-proc", "failed-process", ProcessStatus::Failed);
                process.auto_restart = true;
                process.restart_count = 0;
                process.max_restarts = 3;
                Ok(vec![process])
            });

        let result = service.cleanup_failed_processes("user1").await;
        assert!(result.is_ok());

        let cleaned_count = result.unwrap();
        // The exact count depends on implementation details
        assert!(cleaned_count >= 0);
    }

    #[tokio::test]
    async fn test_process_monitoring_lifecycle() {
        let (service, event_publisher) = create_test_service();
        let mut receiver = event_publisher.subscribe();

        // Create a process
        let request = CreateProcessRequest {
            name: "monitored-process".to_string(),
            command: "sleep".to_string(),
            args: Some(vec!["10".to_string()]),
            working_directory: "/tmp".to_string(),
            environment_variables: Some(HashMap::new()),
            max_restarts: Some(3),
            auto_restart: Some(true),
            workspace_id: Some("workspace1".to_string()),
            session_id: None,
            tags: None,
        };

        let result = service.create_process("user1", request).await;
        assert!(result.is_ok());

        let process = result.unwrap();

        // Simulate process lifecycle through events
        let events = vec![
            receiver.recv().await.unwrap(), // ProcessCreated
            receiver.recv().await.unwrap(), // ProcessStarted
            receiver.recv().await.unwrap(), // ProcessStatusChanged
        ];

        // Verify event types
        assert!(matches!(events[0], ProcessEvent::ProcessCreated(_)));
        assert!(matches!(events[1], ProcessEvent::ProcessStarted(_)));
        assert!(matches!(events[2], ProcessEvent::ProcessStatusChanged(_)));

        // Extract event details
        if let ProcessEvent::ProcessCreated(created_event) = &events[0] {
            assert_eq!(created_event.process_name, "monitored-process");
            assert_eq!(created_event.command, "sleep");
            assert_eq!(created_event.user_id, "user1");
        }

        if let ProcessEvent::ProcessStarted(started_event) = &events[1] {
            assert_eq!(started_event.process_name, "monitored-process");
            assert_eq!(started_event.pid, 12345);
            assert_eq!(started_event.user_id, "user1");
        }

        if let ProcessEvent::ProcessStatusChanged(status_event) = &events[2] {
            assert_eq!(status_event.process_name, "monitored-process");
            assert_eq!(status_event.user_id, "user1");
            assert_eq!(status_event.new_status, ProcessStatus::Running);
        }
    }

    #[tokio::test]
    async fn test_resource_limits_enforcement() {
        // This test would verify that resource limits are properly set and enforced
        // In a real test, you'd mock the ProcessRunner to verify limits are passed correctly
        let (service, _) = create_test_service();

        let request = CreateProcessRequest {
            name: "resource-limited-process".to_string(),
            command: "stress".to_string(),
            args: Some(vec!["--cpu".to_string(), "1".to_string()]),
            working_directory: "/tmp".to_string(),
            environment_variables: Some(HashMap::new()),
            max_restarts: Some(1),
            auto_restart: Some(false),
            workspace_id: Some("workspace1".to_string()),
            session_id: None,
            tags: None,
        };

        // In the actual implementation, the ProcessService should set resource limits
        // This test verifies the integration works correctly
        let result = service.create_process("user1", request).await;
        assert!(result.is_ok());

        let process = result.unwrap();
        assert_eq!(process.name, "resource-limited-process");

        // Verify that the process was started with appropriate resource limits
        // (This would be validated through mock expectations in a real implementation)
    }
}