-- Add missing process_info table for process management
CREATE TABLE IF NOT EXISTS process_info (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    args TEXT DEFAULT '[]',                    -- JSON array of arguments
    working_directory TEXT NOT NULL,
    environment_variables TEXT DEFAULT '{}',   -- JSON object of environment variables
    pid INTEGER,                               -- Process ID
    status TEXT NOT NULL DEFAULT 'Starting',  -- Starting, Running, Stopped, Failed, Crashed, Restarting, Terminated
    start_time INTEGER NOT NULL,               -- Unix timestamp
    end_time INTEGER,                          -- Unix timestamp when process ended
    exit_code INTEGER,                        -- Exit code when process terminated
    cpu_usage REAL DEFAULT 0.0,               -- CPU usage percentage
    memory_usage INTEGER DEFAULT 0,           -- Memory usage in bytes
    restart_count INTEGER DEFAULT 0,          -- Number of times process has been restarted
    max_restarts INTEGER DEFAULT 3,           -- Maximum number of restarts allowed
    auto_restart BOOLEAN DEFAULT 1,            -- Whether to auto-restart on failure
    user_id TEXT,                             -- User ID who owns this process
    workspace_id TEXT,                         -- Workspace ID this process belongs to
    session_id TEXT,                          -- Session ID this process belongs to
    tags TEXT DEFAULT '[]',                   -- JSON array of tags
    data TEXT DEFAULT '{}',                    -- JSON blob for additional process data
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_process_info_status ON process_info(status);
CREATE INDEX IF NOT EXISTS idx_process_info_pid ON process_info(pid);
CREATE INDEX IF NOT EXISTS idx_process_info_workspace ON process_info(workspace_id);
CREATE INDEX IF NOT EXISTS idx_process_info_session ON process_info(session_id);
CREATE INDEX IF NOT EXISTS idx_process_info_user ON process_info(user_id);
CREATE INDEX IF NOT EXISTS idx_process_info_start_time ON process_info(start_time);
CREATE INDEX IF NOT EXISTS idx_process_info_created_at ON process_info(created_at);
CREATE INDEX IF NOT EXISTS idx_process_info_updated_at ON process_info(updated_at);

-- Create index for active processes (not terminated)
CREATE INDEX IF NOT EXISTS idx_process_info_active ON process_info(status) WHERE status NOT IN ('Terminated', 'Failed', 'Crashed');