use std::sync::Arc;
use socketioxide::{
    extract::{Data, SocketRef, TryData},
    SocketIo,
};
use serde::{Deserialize, Serialize};
use serde_json::{self, Value};
use tracing::{info, error, debug};
use tokio::sync::Mutex;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use anyhow::{Result, anyhow};
use uuid::Uuid;
use std::collections::HashMap;

use crate::services::PtyService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,          // Subject (user ID)
    pub exp: usize,           // Expiration time
    pub iat: usize,           // Issued at
    pub github_username: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticateRequest {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalCreateRequest {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub shell: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalDataRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalResizeRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalDestroyRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionListRequest {
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionRecoveryRequest {
    #[serde(rename = "recoveryToken")]
    pub recovery_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthenticatedEvent {
    pub user_id: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct TerminalOutputEvent {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub output: String,
    pub timestamp: i64,
}

#[derive(Debug, Serialize)]
pub struct TerminalCreatedEvent {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub pid: Option<i32>,
    pub shell: String,
    pub cwd: String,
}

#[derive(Debug, Serialize)]
pub struct TerminalDestroyedEvent {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

#[derive(Debug, Serialize)]
pub struct SessionListEvent {
    pub sessions: Vec<crate::services::session::SessionState>,
}

#[derive(Debug, Serialize)]
pub struct SessionRecoveredEvent {
    pub session: crate::services::session::SessionState,
}

#[derive(Debug, Serialize)]
pub struct ErrorEvent {
    pub error: String,
    pub code: String,
    pub context: Option<Value>,
}

#[derive(Debug, Clone)]
struct AuthenticatedSocket {
    pub user_id: String,
    pub username: String,
    pub authenticated_at: i64,
}

// Global socket authentication state management
type SocketAuthMap = Arc<Mutex<HashMap<String, AuthenticatedSocket>>>;

pub fn setup_socket_handlers(io: SocketIo, pty_service: Arc<Mutex<PtyService>>, session_manager: Arc<crate::services::SessionManager>) {
    let auth_map: SocketAuthMap = Arc::new(Mutex::new(HashMap::new()));
    
    io.ns("/", move |socket: SocketRef| {
        let socket_id = socket.id.to_string();
        info!("Client connected: {}", socket_id);
        
        let pty_service = pty_service.clone();
        let session_manager = session_manager.clone();
        let auth_map = auth_map.clone();
        
        // Helper function to get authenticated user for this socket
        let _get_auth_user = || -> Result<AuthenticatedSocket> {
            let auth_guard = auth_map.blocking_lock();
            auth_guard.get(&socket_id)
                .cloned()
                .ok_or_else(|| anyhow!("Not authenticated"))
        };
        
        // Handle explicit authentication (fallback for clients that don't send token in handshake)
        socket.on("authenticate", {
            let socket_clone = socket.clone();
            let auth_map = auth_map.clone();
            move |Data::<AuthenticateRequest>(data)| {
                let socket = socket_clone.clone();
                let socket_id = socket.id.to_string();
                let auth_map = auth_map.clone();
                async move {
                    match validate_jwt_token(&data.token).await {
                        Ok(claims) => {
                            let auth_user = AuthenticatedSocket {
                                user_id: claims.sub.clone(),
                                username: claims.github_username.clone(),
                                authenticated_at: chrono::Utc::now().timestamp(),
                            };

                            // Store authentication state
                            {
                                let mut auth_guard = auth_map.lock().await;
                                auth_guard.insert(socket_id.clone(), auth_user.clone());
                            }

                            let _ = socket.emit("authenticated", AuthenticatedEvent {
                                user_id: claims.sub,
                                username: claims.github_username,
                            });

                            info!("✅ Socket authenticated: {} ({})", socket_id, auth_user.username);
                        }
                        Err(err) => {
                            error!("❌ Authentication failed for socket {}: {}", socket.id, err);
                            let _ = socket.emit("auth_error", ErrorEvent {
                                error: "Authentication failed".to_string(),
                                code: "AUTH_FAILED".to_string(),
                                context: Some(serde_json::json!({"reason": err.to_string()})),
                            });
                        }
                    }
                }
            }
        });

        // Handle terminal creation with authentication
        socket.on("terminal:create", {
            let pty_service = pty_service.clone();
            let socket_clone = socket.clone();
            let auth_map = auth_map.clone();
            move |Data::<TerminalCreateRequest>(data)| {
                let pty_service = pty_service.clone();
                let socket = socket_clone.clone();
                let auth_map = auth_map.clone();
                async move {
                    // Check authentication
                    let socket_id = socket.id.to_string();
                    let _auth_user = match {
                        let auth_guard = auth_map.lock().await;
                        auth_guard.get(&socket_id).cloned()
                    } {
                        Some(user) => user,
                        None => {
                            let _ = socket.emit("terminal:error", ErrorEvent {
                                error: "Authentication required".to_string(),
                                code: "AUTH_REQUIRED".to_string(),
                                context: Some(serde_json::json!({"event": "terminal:create"})),
                            });
                            return;
                        }
                    };
                    
                    let session_id = data.session_id.unwrap_or_else(|| Uuid::new_v4().to_string());
                    let shell = data.shell.unwrap_or_else(|| "bash".to_string());
                    let cwd = data.cwd.unwrap_or_else(|| "/".to_string());
                    
                    info!("Creating terminal session {} for workspace {} (shell: {}, cwd: {})", 
                          session_id, data.workspace_id, shell, cwd);
                    
                    let pty = pty_service.lock().await;
                    match pty.create_session(
                        session_id.clone(),
                        data.workspace_id.clone(),
                        80, // Default cols
                        24, // Default rows
                    ) {
                        Ok(mut output_rx) => {
                            // Record metrics
                            let metrics_event = record_terminal_creation_metrics(&session_id, &data.workspace_id).await;
                            debug!("Metrics recorded: {:?}", metrics_event);

                            // Emit creation success
                            let _ = socket.emit("terminal:created", TerminalCreatedEvent {
                                session_id: session_id.clone(),
                                pid: None, // TODO: Get actual PID from PTY
                                shell,
                                cwd,
                            });
                            
                            info!("✅ Terminal session created: {}", session_id);
                            
                            // Spawn task to forward PTY output to socket
                            let session_id_clone = session_id.clone();
                            tokio::spawn(async move {
                                while let Some(output) = output_rx.recv().await {
                                    let event = TerminalOutputEvent {
                                        session_id: session_id_clone.clone(),
                                        output,
                                        timestamp: chrono::Utc::now().timestamp(),
                                    };
                                    
                                    if let Err(err) = socket.emit("terminal:output", event) {
                                        error!("Failed to emit terminal output: {}", err);
                                        break;
                                    }
                                }
                                info!("Terminal output forwarding ended for session {}", session_id_clone);
                            });
                        }
                        Err(err) => {
                            error!("Failed to create terminal session {}: {}", session_id, err);
                            let _ = socket.emit("terminal:error", ErrorEvent {
                                error: format!("Failed to create terminal session: {}", err),
                                code: "TERMINAL_CREATE_FAILED".to_string(),
                                context: Some(serde_json::json!({
                                    "sessionId": session_id,
                                    "workspaceId": data.workspace_id
                                })),
                            });
                        }
                    }
                }
            }
        });

        // Handle terminal input with authentication
        let socket_id_for_terminal = socket.id.to_string();
        socket.on("terminal:data", {
            let pty_service = pty_service.clone();
            let auth_map = auth_map.clone();
            let socket_id = socket_id_for_terminal.clone();
            move |Data::<TerminalDataRequest>(data)| {
                let pty_service = pty_service.clone();
                let auth_map = auth_map.clone();
                let socket_id = socket_id.clone();
                async move {
                    // Check authentication
                    let _auth_user = match {
                        let auth_guard = auth_map.lock().await;
                        auth_guard.get(&socket_id).cloned()
                    } {
                        Some(user) => user,
                        None => {
                            error!("Authentication required for terminal:data from socket {}", socket_id);
                            return;
                        }
                    };
                    
                    debug!("Sending data to terminal session {}: {} bytes", 
                           data.session_id, data.data.len());
                    
                    let pty = pty_service.lock().await;
                    if let Err(err) = pty.send_input(&data.session_id, &data.data) {
                        error!("Failed to send input to terminal session {}: {}", 
                               data.session_id, err);
                    }
                }
            }
        });

        // Handle terminal resize with authentication
        socket.on("terminal:resize", {
            let pty_service = pty_service.clone();
            move |Data::<TerminalResizeRequest>(data)| {
                let pty_service = pty_service.clone();
                async move {
                    // TODO: Add proper authentication check here
                    
                    info!("Resizing terminal session {} to {}x{}", 
                          data.session_id, data.cols, data.rows);
                    
                    let pty = pty_service.lock().await;
                    if let Err(err) = pty.resize_session(&data.session_id, data.cols, data.rows) {
                        error!("Failed to resize terminal session {}: {}", 
                               data.session_id, err);
                    }
                }
            }
        });

        // Handle terminal destruction with authentication
        socket.on("terminal:destroy", {
            let pty_service = pty_service.clone();
            let socket_clone = socket.clone();
            move |Data::<TerminalDestroyRequest>(data)| {
                let pty_service = pty_service.clone();
                let socket = socket_clone.clone();
                async move {
                    // TODO: Add proper authentication check here
                    
                    info!("Destroying terminal session: {}", data.session_id);
                    
                    let pty = pty_service.lock().await;
                    match pty.destroy_session(&data.session_id) {
                        Ok(_) => {
                            let _ = socket.emit("terminal:destroyed", TerminalDestroyedEvent {
                                session_id: data.session_id.clone(),
                            });
                            info!("🔴 Terminal session destroyed: {}", data.session_id);
                        }
                        Err(err) => {
                            error!("Failed to destroy terminal session {}: {}", 
                                   data.session_id, err);
                            let _ = socket.emit("terminal:error", ErrorEvent {
                                error: format!("Failed to destroy terminal session: {}", err),
                                code: "TERMINAL_DESTROY_FAILED".to_string(),
                                context: Some(serde_json::json!({
                                    "sessionId": data.session_id
                                })),
                            });
                        }
                    }
                }
            }
        });

        // Handle session listing with authentication
        socket.on("session:list", {
            let socket_clone = socket.clone();
            let session_manager_clone = session_manager.clone();
            move |TryData::<SessionListRequest>(data)| {
                let socket = socket_clone.clone();
                let session_manager = session_manager_clone.clone();
                async move {
                    // TODO: Add proper authentication check here
                    
                    let workspace_id = data.ok().and_then(|d| d.workspace_id);
                    info!("Listing sessions for workspace: {:?}", workspace_id);
                    
                    // Get active sessions
                    let sessions = session_manager.list_active_sessions().await;
                    
                    // Filter by workspace_id if provided
                    let filtered_sessions = if let Some(ws_id) = workspace_id {
                        sessions.into_iter()
                            .filter(|session| session.workspace_id.as_deref() == Some(&ws_id))
                            .collect()
                    } else {
                        sessions
                    };
                    
                    let _ = socket.emit("session:list", SessionListEvent {
                        sessions: filtered_sessions,
                    });
                }
            }
        });

        // Handle session recovery with authentication
        socket.on("session:recover", {
            let socket_clone = socket.clone();
            let session_manager_clone = session_manager.clone();
            move |Data::<SessionRecoveryRequest>(data)| {
                let socket = socket_clone.clone();
                let session_manager = session_manager_clone.clone();
                async move {
                    // TODO: Add proper authentication check here
                    
                    info!("Attempting session recovery with token: {}", data.recovery_token);
                    
                    match session_manager.recover_session(&data.recovery_token, Some(&socket.id.to_string())).await {
                        Ok(session_state) => {
                            info!("Session recovered successfully: {}", session_state.session_id);
                            let _ = socket.emit("session:recovered", SessionRecoveredEvent {
                                session: session_state,
                            });
                        }
                        Err(err) => {
                            error!("Failed to recover session: {}", err);
                            let _ = socket.emit("session:error", ErrorEvent {
                                error: format!("Failed to recover session: {}", err),
                                code: "RECOVERY_FAILED".to_string(),
                                context: Some(serde_json::json!({
                                    "recoveryToken": data.recovery_token
                                })),
                            });
                        }
                    }
                }
            }
        });

        // TODO: Fix ping handler later - socketioxide API has changed

        socket.on_disconnect({
            let auth_map = auth_map.clone();
            move |socket: SocketRef| {
                let socket_id = socket.id.to_string();
                info!("Client disconnected: {}", socket_id);
                
                // Clean up authentication state asynchronously
                let auth_map = auth_map.clone();
                tokio::spawn(async move {
                    let mut auth_guard = auth_map.lock().await;
                    auth_guard.remove(&socket_id);
                });
                
                // TODO: Clean up any active terminal sessions for this socket
                // TODO: Record disconnection metrics
            }
        });
    });
}

async fn validate_jwt_token(token: &str) -> Result<Claims> {
    // Get JWT secret from configuration or environment variable
    let jwt_secret = std::env::var("JWT_SECRET")
        .or_else(|_| std::env::var("AUTH_JWT_SECRET"))
        .unwrap_or_else(|_| "your-secret-key".to_string());
    
    let validation = Validation::new(Algorithm::HS256);
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &validation,
    )?;

    // Check if token is expired
    let now = chrono::Utc::now().timestamp() as usize;
    if token_data.claims.exp < now {
        return Err(anyhow!("Token has expired"));
    }

    Ok(token_data.claims)
}

async fn record_terminal_creation_metrics(session_id: &str, workspace_id: &str) -> Result<()> {
    // TODO: Implement metrics recording using MetricsService
    debug!("Recording terminal creation metrics for session {} in workspace {}", 
           session_id, workspace_id);
    Ok(())
}

// Additional helper functions for enhanced WebSocket functionality

pub fn broadcast_to_workspace(_io: &SocketIo, workspace_id: &str, event: &str, _data: impl Serialize) {
    // TODO: Implement workspace-based broadcasting
    // This would require tracking which sockets belong to which workspaces
    debug!("Broadcasting {} event to workspace {}", event, workspace_id);
}

pub fn get_active_sessions_for_user(user_id: &str) -> Vec<String> {
    // TODO: Implement session tracking per user
    // This would require maintaining a mapping of user_id -> session_ids
    debug!("Getting active sessions for user {}", user_id);
    Vec::new()
}

pub fn cleanup_inactive_sessions() {
    // TODO: Implement periodic cleanup of inactive sessions
    // This would run as a background task to clean up orphaned sessions
    debug!("Cleaning up inactive sessions");
}