-- Add foreign key constraint for user_id in process_info table
-- This ensures proper multi-user data isolation for processes

-- Create a new table with the proper foreign key constraint
CREATE TABLE process_info_new (
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
    user_id TEXT NOT NULL,                    -- User ID who owns this process (now required)
    workspace_id TEXT,                         -- Workspace ID this process belongs to
    session_id TEXT,                          -- Session ID this process belongs to
    tags TEXT DEFAULT '[]',                   -- JSON array of tags
    data TEXT DEFAULT '{}',                    -- JSON blob for additional process data
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy data from the old table to the new one
-- For existing records without user_id, we'll need to handle them appropriately
-- In development, we'll assign them to a default user or delete them
INSERT INTO process_info_new (
    id, name, command, args, working_directory, environment_variables,
    status, start_time, end_time, exit_code, pid, cpu_usage, memory_usage,
    restart_count, max_restarts, auto_restart, user_id, workspace_id, session_id,
    tags, data, created_at, updated_at
)
SELECT 
    id, name, command, args, working_directory, environment_variables,
    status, start_time, end_time, exit_code, pid, cpu_usage, memory_usage,
    restart_count, max_restarts, auto_restart, 
    -- For existing records without user_id, we'll use a placeholder
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'),
    workspace_id, session_id, tags, data, created_at, updated_at
FROM process_info;

-- Drop the old table and rename the new one
DROP TABLE process_info;
ALTER TABLE process_info_new RENAME TO process_info;

-- Recreate indexes
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