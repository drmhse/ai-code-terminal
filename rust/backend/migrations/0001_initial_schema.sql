-- Initial schema migration from Prisma schema
-- Converted from SQLite Prisma schema to raw SQL

-- Single-user system: minimal global settings
CREATE TABLE settings (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    github_token TEXT,                  -- Encrypted GitHub OAuth access token
    github_refresh_token TEXT,          -- Encrypted GitHub OAuth refresh token
    github_token_expires_at DATETIME,   -- The expiration date of the current access token
    theme TEXT,                         -- Theme preference JSON
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workspace management
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,                -- Using CUID-like IDs
    name TEXT NOT NULL,
    github_repo TEXT NOT NULL UNIQUE,   -- Format: "owner/repo" - unique across system
    github_url TEXT NOT NULL,           -- Full GitHub repository URL
    local_path TEXT NOT NULL,           -- Local filesystem path
    is_active BOOLEAN NOT NULL DEFAULT 1,
    last_sync_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Terminal layout management
CREATE TABLE terminal_layouts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                 -- Layout name (e.g., "Development", "Debugging")
    layout_type TEXT NOT NULL DEFAULT 'tabs', -- tabs, horizontal-split, vertical-split, grid
    configuration TEXT NOT NULL,       -- JSON configuration for layout structure
    is_default BOOLEAN NOT NULL DEFAULT 0,    -- Whether this is the default layout
    workspace_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Terminal sessions
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    shell_pid INTEGER,                  -- Process ID of the shell session
    socket_id TEXT,                     -- Current Socket.IO connection ID
    status TEXT NOT NULL DEFAULT 'active', -- active, paused, terminated
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    
    -- Session identification and multiplexing
    session_name TEXT NOT NULL DEFAULT 'Terminal', -- Display name for the session/tab
    session_type TEXT NOT NULL DEFAULT 'terminal', -- terminal, split, tmux
    is_default_session BOOLEAN NOT NULL DEFAULT 0, -- Whether this is the default session for the workspace
    
    -- Session state persistence
    current_working_dir TEXT,           -- Current working directory of the shell
    environment_vars TEXT,              -- JSON string of environment variables
    shell_history TEXT,                 -- JSON array of recent shell commands
    terminal_size TEXT,                 -- JSON object with terminal dimensions {cols, rows}
    last_command TEXT,                  -- Last executed command
    session_timeout INTEGER,            -- Timeout in minutes for idle sessions
    recovery_token TEXT,                -- Unique token for session recovery
    
    -- Recovery metadata
    can_recover BOOLEAN NOT NULL DEFAULT 1,         -- Whether this session can be recovered
    max_idle_time INTEGER NOT NULL DEFAULT 1440,    -- Max idle time in minutes (24 hours)
    auto_cleanup BOOLEAN NOT NULL DEFAULT 1,        -- Whether to auto-cleanup on timeout
    
    -- Layout positioning
    layout_id TEXT,                     -- Reference to terminal layout
    
    -- Foreign keys
    workspace_id TEXT,
    
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
    FOREIGN KEY (layout_id) REFERENCES terminal_layouts(id) ON DELETE SET NULL
);

-- User processes
CREATE TABLE user_processes (
    id TEXT PRIMARY KEY,
    pid INTEGER NOT NULL,               -- Process ID
    command TEXT NOT NULL,              -- Command that was executed
    args TEXT,                          -- Command arguments (JSON array)
    cwd TEXT NOT NULL,                  -- Working directory when process was started
    status TEXT NOT NULL DEFAULT 'running', -- running, stopped, crashed, killed
    exit_code INTEGER,                  -- Exit code when process ends
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Last time process was verified alive
    auto_restart BOOLEAN NOT NULL DEFAULT 0,               -- Whether to restart if process dies
    restart_count INTEGER NOT NULL DEFAULT 0,              -- Number of times process has been restarted
    
    -- Foreign keys
    session_id TEXT,
    workspace_id TEXT,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- Rate limiting
CREATE TABLE rate_limits (
    id TEXT PRIMARY KEY,
    client_ip TEXT NOT NULL,            -- Client IP address
    key_prefix TEXT NOT NULL,           -- Rate limit category (auth, github, workspace, general)
    request_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- When the request was made
    expires_at DATETIME NOT NULL       -- When this entry expires
);

-- CSRF tokens
CREATE TABLE csrf_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,         -- The CSRF token
    user_id TEXT NOT NULL,              -- User ID this token belongs to
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL        -- When this token expires
);

-- Create indexes for performance
CREATE INDEX idx_terminal_layouts_workspace_default ON terminal_layouts(workspace_id, is_default);
CREATE INDEX idx_sessions_recovery_token ON sessions(recovery_token);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity_at);
CREATE INDEX idx_sessions_workspace_default ON sessions(workspace_id, is_default_session);
CREATE INDEX idx_user_processes_pid ON user_processes(pid);
CREATE INDEX idx_user_processes_status ON user_processes(status);
CREATE INDEX idx_user_processes_session ON user_processes(session_id);
CREATE INDEX idx_user_processes_workspace ON user_processes(workspace_id);
CREATE INDEX idx_rate_limits_client_key ON rate_limits(client_ip, key_prefix);
CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);
CREATE INDEX idx_csrf_tokens_token ON csrf_tokens(token);
CREATE INDEX idx_csrf_tokens_expires ON csrf_tokens(expires_at);