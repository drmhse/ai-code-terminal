use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{
    accept_async, accept_hdr_async,
    tungstenite::{protocol::WebSocketConfig, Message, Result as WsResult},
};
use futures_util::{SinkExt, StreamExt};
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error, debug};

use act_core::{
    events::{ProcessEvent, DomainEvent, EventPublisher, InMemoryEventPublisher},
    auth::AuthenticatedUser,
};

/// WebSocket connection identifier
pub type ConnectionId = String;

/// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    // Client to server messages
    Subscribe { channels: Vec<String> },
    Unsubscribe { channels: Vec<String> },
    Ping { timestamp: i64 },

    // Server to client messages
    ProcessEvent { event: ProcessEventMessage },
    Pong { timestamp: i64 },
    Error { message: String },
    Connected { connection_id: String },
    Subscribed { channels: Vec<String> },
    Unsubscribed { channels: Vec<String> },
}

/// Simplified process event message for WebSocket transmission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessEventMessage {
    pub event_type: String,
    pub user_id: String,
    pub process_id: Option<String>,
    pub process_name: Option<String>,
    pub status: Option<String>,
    pub pid: Option<i32>,
    pub timestamp: String,
    pub data: serde_json::Value,
}

impl From<ProcessEvent> for ProcessEventMessage {
    fn from(event: ProcessEvent) -> Self {
        let event_type = event.event_type().to_string();
        let user_id = event.user_id().to_string();
        let timestamp = event.timestamp().to_rfc3339();

        match event {
            ProcessEvent::ProcessCreated(e) => ProcessEventMessage {
                event_type,
                user_id,
                process_id: Some(e.process_id.clone()),
                process_name: Some(e.process_name.clone()),
                status: None,
                pid: None,
                timestamp,
                data: serde_json::to_value(e).unwrap_or_default(),
            },
            ProcessEvent::ProcessStarted(e) => ProcessEventMessage {
                event_type,
                user_id,
                process_id: Some(e.process_id.clone()),
                process_name: Some(e.process_name.clone()),
                status: None,
                pid: Some(e.pid),
                timestamp,
                data: serde_json::to_value(e).unwrap_or_default(),
            },
            ProcessEvent::ProcessStopped(e) => ProcessEventMessage {
                event_type,
                user_id,
                process_id: Some(e.process_id.clone()),
                process_name: Some(e.process_name.clone()),
                status: None,
                pid: e.pid,
                timestamp,
                data: serde_json::to_value(e).unwrap_or_default(),
            },
            ProcessEvent::ProcessStatusChanged(e) => ProcessEventMessage {
                event_type,
                user_id,
                process_id: Some(e.process_id.clone()),
                process_name: Some(e.process_name.clone()),
                status: Some(format!("{:?}", e.new_status)),
                pid: None,
                timestamp,
                data: serde_json::to_value(e).unwrap_or_default(),
            },
            ProcessEvent::ProcessOutputReceived(e) => ProcessEventMessage {
                event_type,
                user_id,
                process_id: Some(e.process_id.clone()),
                process_name: None,
                status: None,
                pid: None,
                timestamp,
                data: serde_json::to_value(e).unwrap_or_default(),
            },
            _ => ProcessEventMessage {
                event_type,
                user_id,
                process_id: None,
                process_name: None,
                status: None,
                pid: None,
                timestamp,
                data: serde_json::to_value(&event).unwrap_or_default(),
            },
        }
    }
}

/// WebSocket connection information
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    pub id: ConnectionId,
    pub user_id: String,
    pub subscribed_channels: Vec<String>,
    pub connected_at: chrono::DateTime<chrono::Utc>,
}

/// WebSocket manager for handling connections and broadcasting events
#[derive(Clone)]
pub struct WebSocketManager {
    connections: Arc<RwLock<HashMap<ConnectionId, ConnectionInfo>>>,
    senders: Arc<RwLock<HashMap<ConnectionId, tokio::sync::mpsc::UnboundedSender<WebSocketMessage>>>>,
    event_publisher: Arc<InMemoryEventPublisher>,
}

impl WebSocketManager {
    pub fn new(event_publisher: Arc<InMemoryEventPublisher>) -> Self {
        let manager = Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            senders: Arc::new(RwLock::new(HashMap::new())),
            event_publisher,
        };

        // Start event listener
        manager.start_event_listener();

        manager
    }

    /// Start listening for domain events and broadcast them to WebSocket clients
    fn start_event_listener(&self) {
        let mut receiver = self.event_publisher.subscribe();
        let manager = self.clone();

        tokio::spawn(async move {
            while let Ok(event) = receiver.recv().await {
                manager.broadcast_process_event(event).await;
            }
        });
    }

    /// Handle new WebSocket connection
    pub async fn handle_connection(
        &self,
        stream: tokio::net::TcpStream,
        user: AuthenticatedUser,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let ws_stream = accept_async(stream).await?;
        let connection_id = Uuid::new_v4().to_string();

        let connection_info = ConnectionInfo {
            id: connection_id.clone(),
            user_id: user.user_id.clone(),
            subscribed_channels: vec!["process".to_string()], // Default subscription
            connected_at: chrono::Utc::now(),
        };

        info!("New WebSocket connection: {} for user {}", connection_id, user.user_id);

        // Store connection info
        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_id.clone(), connection_info);
        }

        // Handle the connection
        self.handle_websocket_connection(ws_stream, connection_id, user).await?;

        Ok(())
    }

    /// Handle WebSocket connection lifecycle
    async fn handle_websocket_connection(
        &self,
        ws_stream: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
        connection_id: ConnectionId,
        user: AuthenticatedUser,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

        // Store sender for broadcasting
        {
            let mut senders = self.senders.write().await;
            senders.insert(connection_id.clone(), tx);
        }

        // Send connection confirmation
        let connected_msg = WebSocketMessage::Connected {
            connection_id: connection_id.clone(),
        };
        if let Ok(msg_text) = serde_json::to_string(&connected_msg) {
            let _ = ws_sender.send(Message::Text(msg_text)).await;
        }

        let manager = self.clone();
        let connection_id_clone = connection_id.clone();

        // Spawn task to handle outgoing messages
        let outgoing_task = tokio::spawn(async move {
            while let Some(message) = rx.recv().await {
                if let Ok(msg_text) = serde_json::to_string(&message) {
                    if ws_sender.send(Message::Text(msg_text)).await.is_err() {
                        break;
                    }
                }
            }
        });

        // Handle incoming messages
        while let Some(msg) = ws_receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Err(e) = self.handle_websocket_message(&connection_id, &user, &text).await {
                        warn!("Error handling WebSocket message: {}", e);
                    }
                }
                Ok(Message::Close(_)) => {
                    info!("WebSocket connection closed: {}", connection_id);
                    break;
                }
                Ok(Message::Ping(payload)) => {
                    // Send pong response
                    let pong_msg = WebSocketMessage::Pong {
                        timestamp: chrono::Utc::now().timestamp(),
                    };
                    if let Ok(msg_text) = serde_json::to_string(&pong_msg) {
                        let _ = manager.send_to_connection(&connection_id, pong_msg).await;
                    }
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                _ => {} // Ignore other message types
            }
        }

        // Cleanup
        outgoing_task.abort();
        self.cleanup_connection(&connection_id_clone).await;

        Ok(())
    }

    /// Handle incoming WebSocket message
    async fn handle_websocket_message(
        &self,
        connection_id: &ConnectionId,
        user: &AuthenticatedUser,
        message: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let parsed_message: WebSocketMessage = serde_json::from_str(message)?;

        match parsed_message {
            WebSocketMessage::Subscribe { channels } => {
                self.handle_subscribe(connection_id, channels).await?;
            }
            WebSocketMessage::Unsubscribe { channels } => {
                self.handle_unsubscribe(connection_id, channels).await?;
            }
            WebSocketMessage::Ping { timestamp } => {
                let pong_msg = WebSocketMessage::Pong { timestamp };
                self.send_to_connection(connection_id, pong_msg).await?;
            }
            _ => {
                warn!("Unexpected message type from client: {:?}", parsed_message);
            }
        }

        Ok(())
    }

    /// Handle channel subscription
    async fn handle_subscribe(
        &self,
        connection_id: &ConnectionId,
        channels: Vec<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        {
            let mut connections = self.connections.write().await;
            if let Some(conn) = connections.get_mut(connection_id) {
                for channel in &channels {
                    if !conn.subscribed_channels.contains(channel) {
                        conn.subscribed_channels.push(channel.clone());
                    }
                }
            }
        }

        let response = WebSocketMessage::Subscribed { channels };
        self.send_to_connection(connection_id, response).await?;

        Ok(())
    }

    /// Handle channel unsubscription
    async fn handle_unsubscribe(
        &self,
        connection_id: &ConnectionId,
        channels: Vec<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        {
            let mut connections = self.connections.write().await;
            if let Some(conn) = connections.get_mut(connection_id) {
                conn.subscribed_channels.retain(|ch| !channels.contains(ch));
            }
        }

        let response = WebSocketMessage::Unsubscribed { channels };
        self.send_to_connection(connection_id, response).await?;

        Ok(())
    }

    /// Send message to specific connection
    async fn send_to_connection(
        &self,
        connection_id: &ConnectionId,
        message: WebSocketMessage,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let senders = self.senders.read().await;
        if let Some(sender) = senders.get(connection_id) {
            sender.send(message)?;
        }
        Ok(())
    }

    /// Broadcast process event to all interested connections
    async fn broadcast_process_event(&self, event: ProcessEvent) {
        let event_message = ProcessEventMessage::from(event.clone());
        let user_id = event.user_id();

        let ws_message = WebSocketMessage::ProcessEvent {
            event: event_message
        };

        let connections = self.connections.read().await;
        let senders = self.senders.read().await;

        for (connection_id, connection) in connections.iter() {
            // Only send to connections for the same user and subscribed to process events
            if connection.user_id == user_id &&
               connection.subscribed_channels.contains(&"process".to_string()) {
                if let Some(sender) = senders.get(connection_id) {
                    if sender.send(ws_message.clone()).is_err() {
                        debug!("Failed to send message to connection {}", connection_id);
                    }
                }
            }
        }
    }

    /// Cleanup connection on disconnect
    async fn cleanup_connection(&self, connection_id: &ConnectionId) {
        {
            let mut connections = self.connections.write().await;
            connections.remove(connection_id);
        }

        {
            let mut senders = self.senders.write().await;
            senders.remove(connection_id);
        }

        info!("Cleaned up WebSocket connection: {}", connection_id);
    }

    /// Get connection statistics
    pub async fn get_connection_stats(&self) -> ConnectionStats {
        let connections = self.connections.read().await;
        let total_connections = connections.len();
        let user_connections: HashMap<String, usize> = connections
            .values()
            .fold(HashMap::new(), |mut acc, conn| {
                *acc.entry(conn.user_id.clone()).or_insert(0) += 1;
                acc
            });

        ConnectionStats {
            total_connections,
            user_connections,
        }
    }
}

/// WebSocket connection statistics
#[derive(Debug, Serialize)]
pub struct ConnectionStats {
    pub total_connections: usize,
    pub user_connections: HashMap<String, usize>,
}

/// WebSocket upgrade handler for HTTP requests
pub async fn handle_websocket_upgrade(
    mut req: hyper::Request<hyper::Body>,
    user: AuthenticatedUser,
    websocket_manager: Arc<WebSocketManager>,
) -> Result<hyper::Response<hyper::Body>, hyper::Error> {
    use hyper::{Response, StatusCode};

    // Check if it's a WebSocket upgrade request
    let is_upgrade = req.headers()
        .get(hyper::header::CONNECTION)
        .and_then(|h| h.to_str().ok())
        .map(|h| h.to_lowercase().contains("upgrade"))
        .unwrap_or(false);

    let is_websocket = req.headers()
        .get(hyper::header::UPGRADE)
        .and_then(|h| h.to_str().ok())
        .map(|h| h.to_lowercase() == "websocket")
        .unwrap_or(false);

    if !is_upgrade || !is_websocket {
        return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body("Not a WebSocket upgrade request".into())
            .unwrap());
    }

    // For real implementation, you would need to handle the HTTP upgrade
    // This is a simplified version - in practice you'd use a framework like axum
    Ok(Response::builder()
        .status(StatusCode::SWITCHING_PROTOCOLS)
        .header(hyper::header::CONNECTION, "upgrade")
        .header(hyper::header::UPGRADE, "websocket")
        .body("Switching to WebSocket".into())
        .unwrap())
}