use act_domain::session_service::{SessionWebSocketManager, OutputForwarder};
use act_core::pty::PtyEvent;

#[tokio::test]
async fn test_session_websocket_manager() {
    let manager = SessionWebSocketManager::new();
    
    // Test registering a connection
    let session_id = "test-session-1".to_string();
    let mut rx1 = manager.register_connection(session_id.clone()).await;
    
    // Test forwarding output
    let test_output = "Hello, World!".to_string();
    manager.forward_to_websockets(&session_id, test_output.clone()).await;
    
    // Verify output was received
    let received = rx1.recv().await.unwrap();
    assert_eq!(received, test_output);
    
    // Test multiple connections
    let mut rx2 = manager.register_connection(session_id.clone()).await;
    let test_output2 = "Second message".to_string();
    manager.forward_to_websockets(&session_id, test_output2.clone()).await;
    
    // Both connections should receive the message
    assert_eq!(rx1.recv().await.unwrap(), test_output2);
    assert_eq!(rx2.recv().await.unwrap(), test_output2);
    
    // Test connection cleanup
    drop(rx1);
    drop(rx2);
    
    // Give some time for cleanup
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Trigger a forwarding to force cleanup
    manager.forward_to_websockets(&session_id, "cleanup trigger".to_string()).await;
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    
    assert!(!manager.has_connections(&session_id).await);
}

#[tokio::test]
async fn test_output_forwarder() {
    let session_id = "test-session-2".to_string();
    let (forwarder, mut rx) = OutputForwarder::new(session_id.clone());
    
    // Test forwarding output event
    let test_data = b"Test output data";
    forwarder.forward_event(PtyEvent::Output(test_data.to_vec())).unwrap();
    
    // Verify event was received
    if let Some(PtyEvent::Output(data)) = rx.recv().await {
        assert_eq!(data, test_data);
    } else {
        panic!("Expected Output event");
    }
    
    // Test forwarding error event
    let error_msg = "Test error".to_string();
    forwarder.forward_event(PtyEvent::Error(error_msg.clone())).unwrap();
    
    if let Some(PtyEvent::Error(msg)) = rx.recv().await {
        assert_eq!(msg, error_msg);
    } else {
        panic!("Expected Error event");
    }
    
    // Test forwarding close event
    forwarder.forward_event(PtyEvent::Closed).unwrap();
    
    if let Some(PtyEvent::Closed) = rx.recv().await {
        // Success
    } else {
        panic!("Expected Closed event");
    }
}

#[tokio::test]
async fn test_session_lifecycle() {
    // This test would require mocking the repository and PTY service
    // For now, we'll test the basic structure
    
    let session_id = "test-session-3".to_string();
    let manager = SessionWebSocketManager::new();
    
    // Simulate session lifecycle
    let mut rx = manager.register_connection(session_id.clone()).await;
    
    // Simulate session output
    manager.forward_to_websockets(&session_id, "Welcome to terminal".to_string()).await;
    assert_eq!(rx.recv().await.unwrap(), "Welcome to terminal");
    
    // Simulate session termination
    manager.forward_to_websockets(&session_id, "Session terminated".to_string()).await;
    assert_eq!(rx.recv().await.unwrap(), "Session terminated");
    
    // Clean up
    drop(rx);
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Trigger a forwarding to force cleanup
    manager.forward_to_websockets(&session_id, "cleanup trigger".to_string()).await;
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    
    assert!(!manager.has_connections(&session_id).await);
}