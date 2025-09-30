-- Rollback sync error handling improvements

-- Drop the index
DROP INDEX IF EXISTS idx_task_sync_metadata_error_state;

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- Create temporary table without the new columns
CREATE TABLE task_sync_metadata_backup (
    workspace_id TEXT PRIMARY KEY,
    microsoft_list_id TEXT NOT NULL,
    last_sync_timestamp INTEGER NOT NULL DEFAULT 0,
    sync_version TEXT NOT NULL DEFAULT '1.0',
    sync_errors INTEGER NOT NULL DEFAULT 0,
    last_sync_error TEXT,
    next_sync_attempt INTEGER,
    sync_interval_seconds INTEGER NOT NULL DEFAULT 300,
    is_sync_enabled BOOLEAN DEFAULT TRUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(microsoft_list_id) REFERENCES workspace_todo_mappings(microsoft_list_id) ON DELETE CASCADE
);

-- Copy data from original table (excluding new columns)
INSERT INTO task_sync_metadata_backup
SELECT workspace_id, microsoft_list_id, last_sync_timestamp, sync_version,
       sync_errors, last_sync_error, next_sync_attempt, sync_interval_seconds,
       is_sync_enabled, created_at, updated_at
FROM task_sync_metadata;

-- Drop original table
DROP TABLE task_sync_metadata;

-- Rename backup to original name
ALTER TABLE task_sync_metadata_backup RENAME TO task_sync_metadata;

-- Recreate the original trigger
CREATE TRIGGER update_task_sync_metadata_updated_at
    AFTER UPDATE ON task_sync_metadata
    FOR EACH ROW
BEGIN
    UPDATE task_sync_metadata SET updated_at = unixepoch() WHERE workspace_id = NEW.workspace_id;
END;