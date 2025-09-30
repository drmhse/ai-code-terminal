-- Add task synchronization tables
-- This migration adds support for storing and syncing Microsoft To Do tasks locally

-- Table to store cached tasks from Microsoft To Do
CREATE TABLE microsoft_tasks (
    id TEXT PRIMARY KEY,                               -- Microsoft task ID
    workspace_id TEXT NOT NULL,                        -- Associated workspace
    microsoft_list_id TEXT NOT NULL,                    -- Microsoft To Do list ID
    title TEXT NOT NULL,                                -- Task title
    body_content TEXT,                                  -- Task description/notes
    content_type TEXT DEFAULT 'text',                   -- Content type (text, html)
    status TEXT NOT NULL DEFAULT 'notStarted',         -- Task status (notStarted, inProgress, completed, etc.)
    importance TEXT DEFAULT 'normal',                   -- Task priority (low, normal, high)
    is_reminder_on BOOLEAN DEFAULT FALSE,               -- Whether reminder is set
    reminder_date_time INTEGER,                         -- Reminder timestamp (unix epoch)
    created_date_time INTEGER,                           -- Creation timestamp from Microsoft
    due_date_time INTEGER,                              -- Due date timestamp (unix epoch)
    completed_date_time INTEGER,                         -- Completion timestamp (unix epoch)
    last_modified_date_time INTEGER NOT NULL,          -- Last modified timestamp from Microsoft
    sync_status TEXT NOT NULL DEFAULT 'synced',        -- sync status (synced, pending_create, pending_update, pending_delete)
    local_last_modified INTEGER NOT NULL DEFAULT (unixepoch()), -- Local modification timestamp
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(microsoft_list_id) REFERENCES workspace_todo_mappings(microsoft_list_id) ON DELETE CASCADE
);

-- Table to track synchronization metadata and conflicts
CREATE TABLE task_sync_metadata (
    workspace_id TEXT PRIMARY KEY,                      -- Workspace being synced
    microsoft_list_id TEXT NOT NULL,                    -- Corresponding Microsoft list
    last_sync_timestamp INTEGER NOT NULL DEFAULT 0,     -- Last successful sync timestamp
    sync_version TEXT NOT NULL DEFAULT '1.0',         -- Sync version for migrations
    sync_errors INTEGER NOT NULL DEFAULT 0,             -- Consecutive sync error count
    last_sync_error TEXT,                               -- Last sync error message
    next_sync_attempt INTEGER,                         -- Next scheduled sync attempt
    sync_interval_seconds INTEGER NOT NULL DEFAULT 300, -- Sync interval (5 minutes default)
    is_sync_enabled BOOLEAN DEFAULT TRUE,              -- Whether sync is enabled for this workspace
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(microsoft_list_id) REFERENCES workspace_todo_mappings(microsoft_list_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_microsoft_tasks_workspace ON microsoft_tasks(workspace_id);
CREATE INDEX idx_microsoft_tasks_list ON microsoft_tasks(microsoft_list_id);
CREATE INDEX idx_microsoft_tasks_status ON microsoft_tasks(status);
CREATE INDEX idx_microsoft_tasks_sync_status ON microsoft_tasks(sync_status);
CREATE INDEX idx_microsoft_tasks_modified ON microsoft_tasks(last_modified_date_time);
CREATE INDEX idx_task_sync_metadata_next_sync ON task_sync_metadata(next_sync_attempt);

-- Triggers to update timestamps
CREATE TRIGGER update_microsoft_tasks_updated_at
    AFTER UPDATE ON microsoft_tasks
    FOR EACH ROW
BEGIN
    UPDATE microsoft_tasks SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_task_sync_metadata_updated_at
    AFTER UPDATE ON task_sync_metadata
    FOR EACH ROW
BEGIN
    UPDATE task_sync_metadata SET updated_at = unixepoch() WHERE workspace_id = NEW.workspace_id;
END;