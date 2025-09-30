-- Improve sync error handling with better tracking and recovery mechanisms
-- This migration adds support for tracking successful syncs and managing error thresholds

-- Add last_successful_sync timestamp to track when sync last completed without errors
ALTER TABLE task_sync_metadata ADD COLUMN last_successful_sync INTEGER;

-- Add max_sync_errors threshold (default 10) before auto-disabling
ALTER TABLE task_sync_metadata ADD COLUMN max_sync_errors INTEGER NOT NULL DEFAULT 10;

-- Update existing records to set last_successful_sync to last_sync_timestamp if no current errors
UPDATE task_sync_metadata
SET last_successful_sync = last_sync_timestamp
WHERE sync_errors = 0 AND last_sync_timestamp > 0;

-- Create index for querying workspaces that need recovery
CREATE INDEX idx_task_sync_metadata_error_state ON task_sync_metadata(sync_errors, is_sync_enabled);