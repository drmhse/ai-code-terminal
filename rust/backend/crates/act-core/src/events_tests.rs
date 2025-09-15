#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{UserProcess, ProcessStatus};
    use crate::repository::{ProcessOutputChunk, OutputStreamType, ProcessResourceUsage};
    use std::collections::HashMap;
    use tokio::time::{sleep, Duration};

    fn create_test_process() -> UserProcess {
        UserProcess {
            id: "test-process-1".to_string(),
            name: "Test Process".to_string(),
            pid: Some(12345),
            command: "echo".to_string(),
            args: Some(vec!["hello".to_string()]),
            working_directory: "/tmp".to_string(),
            environment_variables: Some(HashMap::new()),
            status: ProcessStatus::Running,
            exit_code: None,
            start_time: chrono::Utc::now(),
            end_time: None,
            cpu_usage: 10.5,
            memory_usage: 1024 * 1024,
            restart_count: 0,
            max_restarts: 3,
            auto_restart: true,
            user_id: "user-123".to_string(),
            workspace_id: Some("workspace-456".to_string()),
            session_id: Some("session-789".to_string()),
            tags: Some(vec!["test".to_string()]),
            data: Some(serde_json::Value::Null),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_process_created_event_creation() {
        let process = create_test_process();
        let correlation_id = Some("corr-123".to_string());

        let event = create_process_created_event("user-123", &process, correlation_id.clone());

        if let ProcessEvent::ProcessCreated(created_event) = event {
            assert_eq!(created_event.user_id, "user-123");
            assert_eq!(created_event.process_id, "test-process-1");
            assert_eq!(created_event.process_name, "Test Process");
            assert_eq!(created_event.command, "echo");
            assert_eq!(created_event.workspace_id, Some("workspace-456".to_string()));
            assert_eq!(created_event.session_id, Some("session-789".to_string()));
            assert_eq!(created_event.correlation_id, correlation_id);
            assert!(!created_event.event_id.is_empty());
        } else {
            panic!("Expected ProcessCreated event");
        }
    }

    #[test]
    fn test_process_started_event_creation() {
        let process = create_test_process();
        let pid = 12345;
        let correlation_id = Some("corr-456".to_string());

        let event = create_process_started_event("user-123", &process, pid, correlation_id.clone());

        if let ProcessEvent::ProcessStarted(started_event) = event {
            assert_eq!(started_event.user_id, "user-123");
            assert_eq!(started_event.process_id, "test-process-1");
            assert_eq!(started_event.process_name, "Test Process");
            assert_eq!(started_event.pid, pid);
            assert_eq!(started_event.correlation_id, correlation_id);
            assert!(!started_event.event_id.is_empty());
        } else {
            panic!("Expected ProcessStarted event");
        }
    }

    #[test]
    fn test_process_status_changed_event_creation() {
        let process = create_test_process();
        let old_status = ProcessStatus::Starting;
        let new_status = ProcessStatus::Running;
        let resource_usage = Some(ProcessResourceUsage {
            cpu_percent: 25.0,
            memory_bytes: 2048,
            runtime_seconds: 120,
            file_descriptors: 15,
        });
        let correlation_id = Some("corr-789".to_string());

        let event = create_process_status_changed_event(
            "user-123",
            &process,
            old_status.clone(),
            new_status.clone(),
            resource_usage.clone(),
            correlation_id.clone(),
        );

        if let ProcessEvent::ProcessStatusChanged(status_event) = event {
            assert_eq!(status_event.user_id, "user-123");
            assert_eq!(status_event.process_id, "test-process-1");
            assert_eq!(status_event.process_name, "Test Process");
            assert_eq!(status_event.old_status, old_status);
            assert_eq!(status_event.new_status, new_status);
            assert_eq!(status_event.resource_usage, resource_usage);
            assert_eq!(status_event.correlation_id, correlation_id);
            assert!(!status_event.event_id.is_empty());
        } else {
            panic!("Expected ProcessStatusChanged event");
        }
    }

    #[test]
    fn test_process_output_received_event_creation() {
        let output_chunk = ProcessOutputChunk {
            timestamp: chrono::Utc::now(),
            stream: OutputStreamType::Stdout,
            content: "Hello, World!".to_string(),
            sequence: 1,
        };
        let correlation_id = Some("corr-output".to_string());

        let event = create_process_output_received_event(
            "user-123",
            "process-456",
            output_chunk.clone(),
            correlation_id.clone(),
        );

        if let ProcessEvent::ProcessOutputReceived(output_event) = event {
            assert_eq!(output_event.user_id, "user-123");
            assert_eq!(output_event.process_id, "process-456");
            assert_eq!(output_event.output_chunk.content, "Hello, World!");
            assert_eq!(output_event.output_chunk.sequence, 1);
            assert!(matches!(output_event.output_chunk.stream, OutputStreamType::Stdout));
            assert_eq!(output_event.correlation_id, correlation_id);
            assert!(!output_event.event_id.is_empty());
        } else {
            panic!("Expected ProcessOutputReceived event");
        }
    }

    #[test]
    fn test_domain_event_trait_implementation() {
        let process = create_test_process();
        let event = create_process_created_event("user-123", &process, None);

        // Test DomainEvent trait methods
        assert!(!event.event_id().is_empty());
        assert_eq!(event.event_type(), "ProcessCreated");
        assert_eq!(event.user_id(), "user-123");
        assert!(event.correlation_id().is_none());

        let timestamp = event.timestamp();
        assert!(timestamp <= chrono::Utc::now());
    }

    #[tokio::test]
    async fn test_in_memory_event_publisher() {
        let publisher = InMemoryEventPublisher::new(10);
        let mut receiver = publisher.subscribe();

        let process = create_test_process();
        let event1 = create_process_created_event("user-123", &process, None);
        let event2 = create_process_started_event("user-123", &process, 12345, None);

        // Publish events
        publisher.publish(event1.clone()).await.unwrap();
        publisher.publish(event2.clone()).await.unwrap();

        // Receive events
        let received1 = receiver.recv().await.unwrap();
        let received2 = receiver.recv().await.unwrap();

        // Verify events are received in order
        assert!(matches!(received1, ProcessEvent::ProcessCreated(_)));
        assert!(matches!(received2, ProcessEvent::ProcessStarted(_)));

        if let ProcessEvent::ProcessCreated(created) = received1 {
            assert_eq!(created.process_name, "Test Process");
        }

        if let ProcessEvent::ProcessStarted(started) = received2 {
            assert_eq!(started.pid, 12345);
        }
    }

    #[tokio::test]
    async fn test_event_publisher_batch() {
        let publisher = InMemoryEventPublisher::new(10);
        let mut receiver = publisher.subscribe();

        let process = create_test_process();
        let events = vec![
            create_process_created_event("user-123", &process, None),
            create_process_started_event("user-123", &process, 12345, None),
            create_process_status_changed_event(
                "user-123",
                &process,
                ProcessStatus::Starting,
                ProcessStatus::Running,
                None,
                None,
            ),
        ];

        // Publish batch
        publisher.publish_batch(events.clone()).await.unwrap();

        // Receive all events
        let mut received_events = Vec::new();
        for _ in 0..3 {
            received_events.push(receiver.recv().await.unwrap());
        }

        // Verify all events were received
        assert_eq!(received_events.len(), 3);
        assert!(matches!(received_events[0], ProcessEvent::ProcessCreated(_)));
        assert!(matches!(received_events[1], ProcessEvent::ProcessStarted(_)));
        assert!(matches!(received_events[2], ProcessEvent::ProcessStatusChanged(_)));
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let publisher = InMemoryEventPublisher::new(10);
        let mut receiver1 = publisher.subscribe();
        let mut receiver2 = publisher.subscribe();

        let process = create_test_process();
        let event = create_process_created_event("user-123", &process, None);

        // Publish event
        publisher.publish(event.clone()).await.unwrap();

        // Both subscribers should receive the event
        let received1 = receiver1.recv().await.unwrap();
        let received2 = receiver2.recv().await.unwrap();

        assert!(matches!(received1, ProcessEvent::ProcessCreated(_)));
        assert!(matches!(received2, ProcessEvent::ProcessCreated(_)));

        // Events should be identical
        if let (ProcessEvent::ProcessCreated(e1), ProcessEvent::ProcessCreated(e2)) = (received1, received2) {
            assert_eq!(e1.event_id, e2.event_id);
            assert_eq!(e1.process_name, e2.process_name);
        }
    }

    #[tokio::test]
    async fn test_event_publisher_capacity() {
        // Create publisher with small capacity
        let publisher = InMemoryEventPublisher::new(2);
        let mut receiver = publisher.subscribe();

        let process = create_test_process();

        // Publish more events than capacity
        for i in 0..5 {
            let event = create_process_created_event(&format!("user-{}", i), &process, None);
            let result = publisher.publish(event).await;

            if i < 2 {
                assert!(result.is_ok());
            }
            // Later events might be dropped due to capacity
        }

        // Receive available events
        let mut received_count = 0;
        while let Ok(_) = tokio::time::timeout(Duration::from_millis(100), receiver.recv()).await {
            received_count += 1;
            if received_count >= 2 {
                break;
            }
        }

        // Should have received at least some events
        assert!(received_count > 0);
    }

    #[test]
    fn test_process_event_serialization() {
        let process = create_test_process();
        let event = create_process_created_event("user-123", &process, Some("corr-123".to_string()));

        // Test that events can be serialized and deserialized
        let serialized = serde_json::to_string(&event).unwrap();
        assert!(!serialized.is_empty());

        let deserialized: ProcessEvent = serde_json::from_str(&serialized).unwrap();

        if let (ProcessEvent::ProcessCreated(original), ProcessEvent::ProcessCreated(restored)) =
            (event, deserialized) {
            assert_eq!(original.event_id, restored.event_id);
            assert_eq!(original.user_id, restored.user_id);
            assert_eq!(original.process_name, restored.process_name);
            assert_eq!(original.correlation_id, restored.correlation_id);
        }
    }

    #[test]
    fn test_resource_limit_exceeded_event() {
        let event = ProcessEvent::ProcessResourceLimitExceeded(ProcessResourceLimitExceededEvent {
            event_id: "event-123".to_string(),
            timestamp: chrono::Utc::now(),
            user_id: "user-123".to_string(),
            process_id: "proc-456".to_string(),
            process_name: "Heavy Process".to_string(),
            pid: 12345,
            limit_type: ResourceLimitType::Memory,
            current_usage: ProcessResourceUsage {
                cpu_percent: 50.0,
                memory_bytes: 2 * 1024 * 1024 * 1024, // 2GB
                runtime_seconds: 3600,
                file_descriptors: 1000,
            },
            action_taken: LimitAction::Throttle,
            correlation_id: Some("limit-check".to_string()),
        });

        assert_eq!(event.event_type(), "ProcessResourceLimitExceeded");
        assert_eq!(event.user_id(), "user-123");

        if let ProcessEvent::ProcessResourceLimitExceeded(limit_event) = event {
            assert_eq!(limit_event.process_name, "Heavy Process");
            assert!(matches!(limit_event.limit_type, ResourceLimitType::Memory));
            assert!(matches!(limit_event.action_taken, LimitAction::Throttle));
            assert_eq!(limit_event.current_usage.memory_bytes, 2 * 1024 * 1024 * 1024);
        }
    }

    #[test]
    fn test_process_stop_reason_serialization() {
        let reasons = vec![
            ProcessStopReason::UserRequested,
            ProcessStopReason::ProcessTerminated,
            ProcessStopReason::ResourceLimitExceeded,
            ProcessStopReason::Timeout,
            ProcessStopReason::Error("Custom error message".to_string()),
        ];

        for reason in reasons {
            let serialized = serde_json::to_string(&reason).unwrap();
            let deserialized: ProcessStopReason = serde_json::from_str(&serialized).unwrap();

            match (&reason, &deserialized) {
                (ProcessStopReason::Error(orig), ProcessStopReason::Error(deser)) => {
                    assert_eq!(orig, deser);
                }
                _ => {
                    assert!(std::mem::discriminant(&reason) == std::mem::discriminant(&deserialized));
                }
            }
        }
    }

    #[tokio::test]
    async fn test_event_ordering() {
        let publisher = InMemoryEventPublisher::new(100);
        let mut receiver = publisher.subscribe();

        let process = create_test_process();
        let start_time = chrono::Utc::now();

        // Publish events with slight delays to ensure ordering
        let events = vec![
            create_process_created_event("user-123", &process, Some("op-1".to_string())),
            create_process_started_event("user-123", &process, 12345, Some("op-1".to_string())),
            create_process_status_changed_event(
                "user-123",
                &process,
                ProcessStatus::Starting,
                ProcessStatus::Running,
                None,
                Some("op-1".to_string()),
            ),
        ];

        for event in events {
            publisher.publish(event).await.unwrap();
            tokio::time::sleep(Duration::from_millis(1)).await;
        }

        // Receive events and verify timestamps are in order
        let mut received_events = Vec::new();
        for _ in 0..3 {
            received_events.push(receiver.recv().await.unwrap());
        }

        // Verify timestamp ordering
        for i in 1..received_events.len() {
            assert!(
                received_events[i-1].timestamp() <= received_events[i].timestamp(),
                "Events not in timestamp order"
            );
        }

        // Verify correlation IDs are consistent
        for event in &received_events {
            assert_eq!(event.correlation_id(), Some("op-1".to_string()));
        }
    }
}