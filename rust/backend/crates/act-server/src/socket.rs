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

use crate::services::{PtyService, GitHubService, SettingsService};
use crate::AppState;

// Authentication error types for better error handling
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("JWT token has expired")]
    JwtExpired,
    #[error("Invalid JWT token")]
    JwtInvalid,
    #[error("GitHub token not found in database")]
    GitHubTokenMissing,
    #[error("GitHub token has expired")]
    GitHubTokenExpired,
    #[error("GitHub token is invalid")]
    GitHubTokenInvalid,
    #[error("Failed to refresh GitHub token")]
    GitHubTokenRefreshFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,          // Subject (user ID)
    pub username: String,     // GitHub username (matches auth route)
    pub exp: usize,           // Expiration time
    pub iat: usize,           // Issued at
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

#[derive(Debug, Serialize, Deserialize)]
pub struct StatsSubscribeRequest {
    pub interval: Option<u64>, // in seconds, default 5
}

#[derive(Debug, Serialize)]
pub struct StatsEvent {
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub memory_total: u64,
    pub memory_percentage: f32,
    pub disk_usage: u64,
    pub disk_total: u64,
    pub disk_percentage: f32,
    pub active_sessions: u64,
    pub uptime_seconds: u64,
    pub load_average: Option<f32>,
    pub timestamp: i64,
}

#[derive(Debug, Clone)]
struct AuthenticatedSocket {
    pub user_id: String,
    pub username: String,
    pub authenticated_at: i64,
}

#[derive(Debug, Clone)]
struct StatsSubscription {
    pub socket_id: String,
    pub interval: u64,
    pub last_sent: Option<i64>,
}

// Global socket authentication state management
type SocketAuthMap = Arc<Mutex<HashMap<String, AuthenticatedSocket>>>;
type StatsSubscriptionsMap = Arc<Mutex<HashMap<String, StatsSubscription>>>;

// Helper function to classify auth errors for better error messages
fn classify_auth_error(error: &anyhow::Error) -> (&'static str, &'static str) {
    let error_str = error.to_string();
    
    if error_str.contains("GitHub token not found") || error_str.contains("GitHubTokenMissing") {
        ("GITHUB_TOKEN_MISSING", "GitHub session expired. Please re-authenticate.")
    } else if error_str.contains("GitHub token expired") || error_str.contains("GitHubTokenExpired") {
        ("GITHUB_TOKEN_EXPIRED", "GitHub token expired. Please re-authenticate.")
    } else if error_str.contains("Invalid GitHub token") || error_str.contains("GitHubTokenInvalid") {
        ("GITHUB_TOKEN_INVALID", "Invalid GitHub token. Please re-authenticate.")
    } else if error_str.contains("JWT token has expired") || error_str.contains("JwtExpired") {
        ("JWT_EXPIRED", "Session expired. Please log in again.")
    } else if error_str.contains("Invalid JWT token") || error_str.contains("JwtInvalid") {
        ("JWT_INVALID", "Invalid authentication token.")
    } else {
        ("AUTH_FAILED", "Authentication failed")
    }
}

// Helper function to get authenticated user for this socket with GitHub token validation
async fn get_auth_user_with_validation(
    socket_id: String, 
    auth_map: SocketAuthMap, 
    app_state: AppState
) -> Result<AuthenticatedSocket> {
    // First check if socket is authenticated in memory
    let auth_guard = auth_map.lock().await;
    let auth_user = auth_guard.get(&socket_id)
        .cloned()
        .ok_or_else(|| anyhow!("Socket not authenticated"))?;
    drop(auth_guard);
    
    // Re-validate GitHub token to ensure it's still valid
    let settings_service = SettingsService::new(app_state.db.clone());
    let github_service = GitHubService::new(std::sync::Arc::new(app_state.config.clone()))
        .map_err(|_| anyhow!("Failed to initialize GitHub service"))?;
    
    // Check if GitHub token still exists and is valid
    match settings_service.get_github_token(&github_service).await {
        Ok(Some(github_token)) => {
            // Validate token with GitHub API
            if github_service.validate_token(&github_token).await {
                Ok(auth_user)
            } else {
                // Try to refresh if validation fails
                if let Ok(Some(refresh_token)) = settings_service.get_github_refresh_token(&github_service).await {
                    match github_service.refresh_access_token(&refresh_token).await {
                        Ok(new_token_result) => {
                            // Update tokens in database
                            settings_service.update_github_tokens(
                                &github_service,
                                Some(&new_token_result.access_token),
                                new_token_result.refresh_token.as_deref(),
                                Some(new_token_result.expires_at),
                            ).await?;
                            info!("Successfully refreshed GitHub token for user {}", auth_user.user_id);
                            Ok(auth_user)
                        }
                        Err(_) => Err(anyhow!(AuthError::GitHubTokenExpired))
                    }
                } else {
                    Err(anyhow!(AuthError::GitHubTokenExpired))
                }
            }
        }
        Ok(None) => Err(anyhow!(AuthError::GitHubTokenMissing)),
        Err(_) => Err(anyhow!(AuthError::GitHubTokenMissing))
    }
}

pub fn setup_socket_handlers(
    io: SocketIo, 
    pty_service: Arc<Mutex<PtyService>>, 
    session_manager: Arc<crate::services::SessionManager>, 
    app_state: crate::AppState
) {
    let auth_map: SocketAuthMap = Arc::new(Mutex::new(HashMap::new()));
    let stats_subscriptions: StatsSubscriptionsMap = Arc::new(Mutex::new(HashMap::new()));
    
    // Start background stats broadcasting task
    start_stats_broadcaster(io.clone(), stats_subscriptions.clone(), app_state.clone());
    
    io.ns("/", move |socket: SocketRef| {
        let socket_id = socket.id.to_string();
        info!("Client connected: {}", socket_id);
        debug!("Socket {} connected, waiting for authentication", socket_id);
        
        let pty_service = pty_service.clone();
        let session_manager = session_manager.clone();
        let auth_map = auth_map.clone();
        let stats_subscriptions = stats_subscriptions.clone();
        
        // Handle explicit authentication
        socket.on("authenticate", {
            let socket_clone = socket.clone();
            let auth_map = auth_map.clone();
            let app_state = app_state.clone();
            move |Data::<AuthenticateRequest>(data)| {
                let socket = socket_clone.clone();
                let socket_id = socket.id.to_string();
                let auth_map = auth_map.clone();
                let app_state = app_state.clone();
                async move {
                    match validate_jwt_and_github_token(&data.token, &app_state).await {
                        Ok(claims) => {
                            let auth_user = AuthenticatedSocket {
                                user_id: claims.sub.clone(),
                                username: claims.username.clone(),
                                authenticated_at: chrono::Utc::now().timestamp(),
                            };

                            // Store authentication state
                            {
                                let mut auth_guard = auth_map.lock().await;
                                auth_guard.insert(socket_id.clone(), auth_user.clone());
                            }

                            let _ = socket.emit("authenticated", AuthenticatedEvent {
                                user_id: claims.sub,
                                username: claims.username,
                            });

                            info!("✅ Socket authenticated: {} ({})", socket_id, auth_user.username);
                        }
                        Err(err) => {
                            error!("❌ Authentication failed for socket {}: {}", socket.id, err);
                            let (error_code, error_message) = classify_auth_error(&err);
                            
                            let _ = socket.emit("auth_error", ErrorEvent {
                                error: error_message.to_string(),
                                code: error_code.to_string(),
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
            let app_state = app_state.clone();
            move |Data::<TerminalCreateRequest>(data)| {
                let pty_service = pty_service.clone();
                let socket = socket_clone.clone();
                let auth_map = auth_map.clone();
                let app_state = app_state.clone();
                async move {
                    // Check authentication and validate GitHub token
                    let socket_id = socket.id.to_string();
                    let _auth_user = match get_auth_user_with_validation(socket_id.clone(), auth_map.clone(), app_state.clone()).await {
                        Ok(user) => user,
                        Err(err) => {
                            let (error_code, error_message) = classify_auth_error(&err);
                            
                            let _ = socket.emit("terminal:error", ErrorEvent {
                                error: error_message.to_string(),
                                code: error_code.to_string(),
                                context: Some(serde_json::json!({"event": "terminal:create", "reason": err.to_string()})),
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
        socket.on("terminal:data", {
            let pty_service = pty_service.clone();
            let auth_map = auth_map.clone();
            let app_state = app_state.clone();
            let socket_clone = socket.clone();
            move |Data::<TerminalDataRequest>(data)| {
                let pty_service = pty_service.clone();
                let auth_map = auth_map.clone();
                let app_state = app_state.clone();
                let socket_id = socket_clone.id.to_string();
                async move {
                    // Check authentication and validate GitHub token
                    let _auth_user = match get_auth_user_with_validation(socket_id.clone(), auth_map.clone(), app_state.clone()).await {
                        Ok(user) => user,
                        Err(err) => {
                            error!("Authentication failed for terminal:data from socket {}: {}", socket_id, err);
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
            let auth_map = auth_map.clone();
            let app_state = app_state.clone();
            let socket_clone = socket.clone();
            move |Data::<TerminalResizeRequest>(data)| {
                let pty_service = pty_service.clone();
                let auth_map = auth_map.clone();
                let app_state = app_state.clone();
                let socket_id = socket_clone.id.to_string();
                async move {
                    // Check authentication and validate GitHub token
                    let _auth_user = match get_auth_user_with_validation(socket_id.clone(), auth_map.clone(), app_state.clone()).await {
                        Ok(user) => user,
                        Err(err) => {
                            error!("Authentication failed for terminal:resize from socket {}: {}", socket_id, err);
                            return;
                        }
                    };
                    
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
            let auth_map = auth_map.clone();
            let app_state = app_state.clone();
            move |Data::<TerminalDestroyRequest>(data)| {
                let pty_service = pty_service.clone();
                let socket = socket_clone.clone();
                let auth_map = auth_map.clone();
                let app_state = app_state.clone();
                let socket_id = socket.id.to_string();
                async move {
                    // Check authentication and validate GitHub token
                    let _auth_user = match get_auth_user_with_validation(socket_id.clone(), auth_map.clone(), app_state.clone()).await {
                        Ok(user) => user,
                        Err(err) => {
                            error!("Authentication failed for terminal:destroy from socket {}: {}", socket_id, err);
                            let _ = socket.emit("terminal:error", ErrorEvent {
                                error: "Authentication required".to_string(),
                                code: "AUTH_REQUIRED".to_string(),
                                context: Some(serde_json::json!({"event": "terminal:destroy"})),
                            });
                            return;
                        }
                    };
                    
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
            let auth_map = auth_map.clone();
            let app_state = app_state.clone();
            move |TryData::<SessionListRequest>(data)| {
                let socket = socket_clone.clone();
                let session_manager = session_manager_clone.clone();
                let auth_map = auth_map.clone();
                let app_state = app_state.clone();
                async move {
                    let socket_id = socket.id.to_string();
                    
                    // Check authentication and validate GitHub token
                    let auth_user = match get_auth_user_with_validation(socket_id.clone(), auth_map.clone(), app_state.clone()).await {
                        Ok(user) => user,
                        Err(err) => {
                            let (error_code, error_message) = classify_auth_error(&err);
                            
                            let _ = socket.emit("session:error", ErrorEvent {
                                error: error_message.to_string(),
                                code: error_code.to_string(),
                                context: Some(serde_json::json!({"event": "session:list", "reason": err.to_string()})),
                            });
                            return;
                        }
                    };
                    
                    let workspace_id = data.ok().and_then(|d| d.workspace_id);
                    info!("Listing sessions for workspace: {:?} (user: {})", workspace_id, auth_user.username);
                    
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
            let auth_map = auth_map.clone();
            let app_state = app_state.clone();
            move |Data::<SessionRecoveryRequest>(data)| {
                let socket = socket_clone.clone();
                let session_manager = session_manager_clone.clone();
                let auth_map = auth_map.clone();
                let app_state = app_state.clone();
                async move {
                    let socket_id = socket.id.to_string();
                    
                    // Check authentication and validate GitHub token
                    let _auth_user = match get_auth_user_with_validation(socket_id.clone(), auth_map.clone(), app_state.clone()).await {
                        Ok(user) => user,
                        Err(err) => {
                            let (error_code, error_message) = classify_auth_error(&err);
                            
                            let _ = socket.emit("session:error", ErrorEvent {
                                error: error_message.to_string(),
                                code: error_code.to_string(),
                                context: Some(serde_json::json!({"event": "session:recover", "reason": err.to_string()})),
                            });
                            return;
                        }
                    };
                    
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

        // Handle stats subscription with authentication
        socket.on("stats:subscribe", {
            let socket_clone = socket.clone();
            let auth_map = auth_map.clone();
            let stats_subscriptions = stats_subscriptions.clone();
            let app_state = app_state.clone();
            move |TryData::<StatsSubscribeRequest>(data)| {
                let socket = socket_clone.clone();
                let auth_map = auth_map.clone();
                let stats_subscriptions = stats_subscriptions.clone();
                let app_state = app_state.clone();
                async move {
                    let socket_id = socket.id.to_string();
                    
                    // Check authentication and validate GitHub token
                    let _auth_user = match get_auth_user_with_validation(socket_id.clone(), auth_map.clone(), app_state.clone()).await {
                        Ok(user) => user,
                        Err(err) => {
                            let (error_code, error_message) = classify_auth_error(&err);
                            
                            let _ = socket.emit("stats:error", ErrorEvent {
                                error: error_message.to_string(),
                                code: error_code.to_string(),
                                context: Some(serde_json::json!({"event": "stats:subscribe", "reason": err.to_string()})),
                            });
                            return;
                        }
                    };

                    let interval = data.ok().and_then(|d| d.interval).unwrap_or(5); // Default 5 seconds
                    
                    info!("Socket {} subscribing to stats with {}s interval", socket_id, interval);
                    
                    let subscription = StatsSubscription {
                        socket_id: socket_id.clone(),
                        interval,
                        last_sent: None,
                    };
                    
                    {
                        let mut subs_guard = stats_subscriptions.lock().await;
                        subs_guard.insert(socket_id.clone(), subscription);
                    }
                    
                    let _ = socket.emit("stats:subscribed", serde_json::json!({
                        "interval": interval,
                        "message": "Successfully subscribed to system stats"
                    }));
                }
            }
        });

        // Handle stats unsubscription with authentication
        socket.on("stats:unsubscribe", {
            let socket_clone = socket.clone();
            let auth_map = auth_map.clone();
            let stats_subscriptions = stats_subscriptions.clone();
            let app_state = app_state.clone();
            move |TryData::<Value>(_data)| {
                let socket = socket_clone.clone();
                let auth_map = auth_map.clone();
                let stats_subscriptions = stats_subscriptions.clone();
                let app_state = app_state.clone();
                async move {
                    let socket_id = socket.id.to_string();
                    
                    // Check authentication and validate GitHub token
                    let _auth_user = match get_auth_user_with_validation(socket_id.clone(), auth_map.clone(), app_state.clone()).await {
                        Ok(user) => user,
                        Err(_) => return, // Silently fail for unsubscribe
                    };

                    info!("Socket {} unsubscribing from stats", socket_id);
                    
                    {
                        let mut subs_guard = stats_subscriptions.lock().await;
                        subs_guard.remove(&socket_id);
                    }
                    
                    let _ = socket.emit("stats:unsubscribed", serde_json::json!({
                        "message": "Successfully unsubscribed from system stats"
                    }));
                }
            }
        });

        socket.on_disconnect({
            let auth_map = auth_map.clone();
            let stats_subscriptions = stats_subscriptions.clone();
            move |socket: SocketRef| {
                let socket_id = socket.id.to_string();
                info!("Client disconnected: {}", socket_id);
                
                // Clean up authentication state and stats subscriptions asynchronously
                let auth_map = auth_map.clone();
                let stats_subscriptions = stats_subscriptions.clone();
                tokio::spawn(async move {
                    let mut auth_guard = auth_map.lock().await;
                    auth_guard.remove(&socket_id);
                    
                    let mut subs_guard = stats_subscriptions.lock().await;
                    subs_guard.remove(&socket_id);
                });
            }
        });
    });
}

async fn validate_jwt_token(token: &str) -> Result<Claims> {
    // Get JWT secret from configuration (must be present)
    let jwt_secret = std::env::var("ACT_AUTH_JWT_SECRET")
        .map_err(|_| anyhow!("ACT_AUTH_JWT_SECRET environment variable is required"))?;
    
    let validation = Validation::new(Algorithm::HS256);
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|_| anyhow!(AuthError::JwtInvalid))?;

    // Check if token is expired
    let now = chrono::Utc::now().timestamp() as usize;
    if token_data.claims.exp < now {
        return Err(anyhow!(AuthError::JwtExpired));
    }

    Ok(token_data.claims)
}

async fn validate_jwt_and_github_token(token: &str, app_state: &AppState) -> Result<Claims> {
    // First validate JWT
    let claims = validate_jwt_token(token).await?;
    
    // Then validate GitHub token exists and is valid
    let settings_service = SettingsService::new(app_state.db.clone());
    let github_service = GitHubService::new(std::sync::Arc::new(app_state.config.clone()))
        .map_err(|_| anyhow!(AuthError::GitHubTokenMissing))?;
    
    // Check if GitHub token exists
    let github_token = settings_service.get_github_token(&github_service).await
        .map_err(|_| anyhow!(AuthError::GitHubTokenMissing))?;
    
    let github_token = match github_token {
        Some(token) => token,
        None => return Err(anyhow!(AuthError::GitHubTokenMissing)),
    };
    
    // Check if GitHub token is expired
    let is_expired = settings_service.is_github_token_expired().await
        .map_err(|_| anyhow!(AuthError::GitHubTokenMissing))?;
    
    if is_expired {
        // Try to refresh the token
        let refresh_token = settings_service.get_github_refresh_token(&github_service).await
            .map_err(|_| anyhow!(AuthError::GitHubTokenMissing))?;
        
        if let Some(refresh_token) = refresh_token {
            match github_service.refresh_access_token(&refresh_token).await {
                Ok(new_token_result) => {
                    // Update the tokens in database
                    settings_service.update_github_tokens(
                        &github_service,
                        Some(&new_token_result.access_token),
                        new_token_result.refresh_token.as_deref(),
                        Some(new_token_result.expires_at),
                    ).await
                    .map_err(|_| anyhow!(AuthError::GitHubTokenRefreshFailed))?;
                    
                    info!("Successfully refreshed GitHub token for user {}", claims.sub);
                }
                Err(_) => {
                    return Err(anyhow!(AuthError::GitHubTokenExpired));
                }
            }
        } else {
            return Err(anyhow!(AuthError::GitHubTokenExpired));
        }
    }
    
    // Validate the GitHub token with GitHub API
    if !github_service.validate_token(&github_token).await {
        return Err(anyhow!(AuthError::GitHubTokenInvalid));
    }
    
    Ok(claims)
}

fn start_stats_broadcaster(io: SocketIo, stats_subscriptions: StatsSubscriptionsMap, app_state: crate::AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));
        
        loop {
            interval.tick().await;
            
            // Get current timestamp
            let now = chrono::Utc::now().timestamp();
            
            // Check if there are any subscriptions
            let subscriptions = {
                let subs_guard = stats_subscriptions.lock().await;
                subs_guard.clone()
            };
            
            if subscriptions.is_empty() {
                continue;
            }
            
            // Generate stats only if needed
            let stats = match generate_system_stats(&app_state).await {
                Ok(stats) => stats,
                Err(e) => {
                    error!("Failed to generate system stats: {}", e);
                    continue;
                }
            };
            
            // Send stats to subscribed clients based on their intervals
            let mut updated_subscriptions = subscriptions.clone();
            
            for (socket_id, mut subscription) in subscriptions {
                let should_send = match subscription.last_sent {
                    Some(last_sent) => now - last_sent >= subscription.interval as i64,
                    None => true,
                };
                
                if should_send {
                    // Try to emit to socket via broadcast to specific socket ID
                    let stats_json = serde_json::to_value(&stats).unwrap_or_default();
                    if let Err(_) = io.to(socket_id.clone()).emit("stats", stats_json) {
                        // Socket no longer exists, remove subscription
                        updated_subscriptions.remove(&socket_id);
                    } else {
                        subscription.last_sent = Some(now);
                        updated_subscriptions.insert(socket_id, subscription);
                    }
                }
            }
            
            // Update subscriptions with new last_sent timestamps
            {
                let mut subs_guard = stats_subscriptions.lock().await;
                *subs_guard = updated_subscriptions;
            }
        }
    });
}

async fn generate_system_stats(app_state: &crate::AppState) -> Result<StatsEvent> {
    use sysinfo::{System, Disks};
    
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Get CPU usage
    let cpu_usage = sys.global_cpu_info().cpu_usage();
    
    // Get memory usage
    let memory_total = sys.total_memory();
    let memory_usage = sys.used_memory();
    let memory_percentage = (memory_usage as f32 / memory_total as f32) * 100.0;
    
    // Get disk usage (for all disks)
    let disks = Disks::new_with_refreshed_list();
    let mut disk_total = 0;
    let mut disk_usage = 0;
    
    for disk in disks.list() {
        disk_total += disk.total_space();
        disk_usage += disk.total_space() - disk.available_space();
    }
    
    let disk_percentage = if disk_total > 0 {
        (disk_usage as f32 / disk_total as f32) * 100.0
    } else {
        0.0
    };
    
    // Get active sessions count
    let active_sessions = match sqlx::query_scalar!(
        "SELECT COUNT(*) as count FROM sessions WHERE status != 'terminated'"
    )
    .fetch_one(app_state.db.pool())
    .await
    {
        Ok(result) => result as u64,
        Err(_e) => 0,
    };
    
    // Get system uptime
    let uptime_seconds = System::uptime();
    
    // Get load average (Unix-like systems only)
    let load_average = System::load_average();
    
    Ok(StatsEvent {
        cpu_usage,
        memory_usage,
        memory_total,
        memory_percentage,
        disk_usage,
        disk_total,
        disk_percentage,
        active_sessions,
        uptime_seconds,
        load_average: Some(load_average.one as f32),
        timestamp: chrono::Utc::now().timestamp(),
    })
}