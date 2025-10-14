use std::sync::{Arc, Mutex};
use std::process::{Command, Child, Stdio};
use std::path::PathBuf;
use std::env;
use tauri::{Manager, State, Emitter};
use tauri_plugin_deep_link::DeepLinkExt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct BackendStatus {
    running: bool,
    port: u16,
    pid: Option<u32>,
}

#[derive(Debug, Default)]
struct BackendState {
    process: Arc<Mutex<Option<Child>>>,
    config: Arc<Mutex<Option<BackendConfig>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackendConfig {
    port: u16,
    data_dir: PathBuf,
    workspace_dir: PathBuf,
}

// Note: Dynamic port allocation removed - desktop mode uses fixed port 3001
// GitHub OAuth doesn't support custom URL schemes, requires http/https loopback URLs

impl Default for BackendConfig {
    fn default() -> Self {
        let mut data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        data_dir.push("ai-coding-terminal");
        data_dir.push("data");

        let mut workspace_dir = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
        workspace_dir.push("ai-coding-terminal-workspaces");

        // Desktop mode: Use fixed port 3001 for GitHub OAuth compatibility
        // GitHub OAuth doesn't support custom URL schemes, only http/https loopback URLs
        let port = 3001;

        println!("🔧 Desktop mode: Using fixed port {} for OAuth compatibility", port);

        Self {
            port,
            data_dir,
            workspace_dir,
        }
    }
}

#[tauri::command]
async fn start_backend(state: State<'_, BackendState>) -> Result<BackendStatus, String> {
    let config = BackendConfig::default();

    // Store config immediately so frontend can get the port even before backend starts
    {
        let mut config_guard = state.config.lock().unwrap();
        if config_guard.is_none() {
            *config_guard = Some(config.clone());
        }
    }

    // Check if backend is already running
    {
        let process_guard = state.process.lock().unwrap();
        if process_guard.is_some() {
            return Ok(BackendStatus {
                running: true,
                port: config.port,
                pid: None,
            });
        }
    }

    // Create data directories
    std::fs::create_dir_all(&config.data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    std::fs::create_dir_all(&config.workspace_dir)
        .map_err(|e| format!("Failed to create workspace directory: {}", e))?;

    // Set up environment variables for backend
    let mut envs = std::env::vars().collect::<std::collections::HashMap<_, _>>();
    envs.insert("ACT_SERVER_PORT".to_string(), config.port.to_string());
    envs.insert("ACT_SERVER_HOST".to_string(), "127.0.0.1".to_string());
    envs.insert("ACT_DATABASE_URL".to_string(), format!("sqlite:{}/act.db", config.data_dir.display()));
    envs.insert("ACT_WORKSPACE_ROOT_PATH".to_string(), config.workspace_dir.display().to_string());

    envs.insert("ACT_CORS_ALLOWED_ORIGINS".to_string(), "*".to_string());

    // Generate a secure JWT secret for desktop app
    envs.insert("ACT_AUTH_JWT_SECRET".to_string(), uuid::Uuid::new_v4().to_string());

    // Configure OAuth redirect URIs
    // GitHub OAuth doesn't support custom URL schemes - use http://127.0.0.1 with fixed port
    envs.insert("ACT_AUTH_GITHUB_REDIRECT_URL".to_string(), format!("http://127.0.0.1:{}/api/v1/auth/github/callback", config.port));

    // Microsoft OAuth: Use custom URL scheme (Microsoft supports it)
    envs.insert("MICROSOFT_REDIRECT_URI".to_string(), "act://auth/microsoft/callback".to_string());

    // Launch backend server
    let backend_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../backend")
        .canonicalize()
        .map_err(|e| format!("Failed to resolve backend path: {}", e))?;

    let child = Command::new("cargo")
        .current_dir(&backend_path)
        .args(&["run", "--bin", "act-server"])
        .envs(&envs)
        .stdout(Stdio::inherit())  // Show backend output in terminal
        .stderr(Stdio::inherit())  // Show backend errors in terminal
        .spawn()
        .map_err(|e| format!("Failed to start backend: {}", e))?;

    let pid = child.id();
    println!("📦 Backend process spawned with PID: {}", pid);
    println!("🔌 Backend will listen on port: {}", config.port);

    // Store the process
    {
        let mut process_guard = state.process.lock().unwrap();
        *process_guard = Some(child);
    }

    // Wait for server to compile and start (cargo run takes time in dev mode)
    println!("⏳ Waiting 5 seconds for backend to start...");
    tokio::time::sleep(tokio::time::Duration::from_millis(5000)).await;

    // Check if process is still running
    {
        let mut process_guard = state.process.lock().unwrap();
        if let Some(ref mut child) = *process_guard {
            match child.try_wait() {
                Ok(Some(status)) => {
                    return Err(format!("Backend process exited unexpectedly with status: {}", status));
                }
                Ok(None) => {
                    println!("✅ Backend process is running");
                }
                Err(e) => {
                    return Err(format!("Failed to check backend process status: {}", e));
                }
            }
        }
    }

    Ok(BackendStatus {
        running: true,
        port: config.port,
        pid: Some(pid),
    })
}

#[tauri::command]
async fn stop_backend(state: State<'_, BackendState>) -> Result<bool, String> {
    let mut process_guard = state.process.lock().unwrap();
    if let Some(mut child) = process_guard.take() {
        match child.kill() {
            Ok(_) => {
                let _ = child.wait();
                Ok(true)
            }
            Err(e) => Err(format!("Failed to stop backend: {}", e)),
        }
    } else {
        Ok(false) // Backend wasn't running
    }
}

#[tauri::command]
async fn get_backend_status(state: State<'_, BackendState>) -> Result<BackendStatus, String> {
    let config_guard = state.config.lock().unwrap();
    let process_guard = state.process.lock().unwrap();

    let running = process_guard.is_some();
    let port = config_guard.as_ref().map(|c| c.port).unwrap_or(3001);
    let pid = process_guard.as_ref().and_then(|p| Some(p.id()));

    Ok(BackendStatus {
        running,
        port,
        pid,
    })
}

#[tauri::command]
async fn get_backend_config(state: State<'_, BackendState>) -> Result<BackendConfig, String> {
    let config_guard = state.config.lock().unwrap();
    match config_guard.as_ref() {
        Some(config) => Ok(config.clone()),
        None => Ok(BackendConfig::default()),
    }
}

#[tauri::command]
async fn get_backend_port(state: State<'_, BackendState>) -> Result<u16, String> {
    let config_guard = state.config.lock().unwrap();
    match config_guard.as_ref() {
        Some(config) => Ok(config.port),
        None => {
            // If backend hasn't started yet, find what port would be used
            Ok(BackendConfig::default().port)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize backend state with config immediately
    let backend_state = BackendState {
        process: Arc::new(Mutex::new(None)),
        config: Arc::new(Mutex::new(Some(BackendConfig::default()))),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(backend_state)
        .invoke_handler(tauri::generate_handler![
            start_backend,
            stop_backend,
            get_backend_status,
            get_backend_config,
            get_backend_port
        ])
        .setup(|app| {
            // Register deep link handler for OAuth callbacks
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                println!("🔗 Deep link received: {:?}", urls);

                // Parse each URL and emit to frontend
                for url in urls {
                    let url_str = url.to_string();
                    println!("🔗 Processing URL: {}", url_str);

                    // Emit to frontend
                    if let Err(e) = app_handle.emit("oauth-callback", url_str) {
                        eprintln!("❌ Failed to emit OAuth callback event: {}", e);
                    }
                }
            });

            // Auto-start backend when app launches
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                println!("🚀 Starting backend server...");

                if let Err(e) = start_backend(app_handle.state()).await {
                    eprintln!("❌ Failed to auto-start backend: {}", e);
                } else {
                    println!("✅ Backend server started successfully");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
