-- Rollback task synchronization tables
-- This migration removes support for storing and syncing Microsoft To Do tasks locally

-- Drop triggers first
DROP TRIGGER IF EXISTS update_task_sync_metadata_updated_at;
DROP TRIGGER IF EXISTS update_microsoft_tasks_updated_at;

-- Drop indexes
DROP INDEX IF EXISTS idx_task_sync_metadata_next_sync;
DROP INDEX IF EXISTS idx_microsoft_tasks_modified;
DROP INDEX IF EXISTS idx_microsoft_tasks_sync_status;
DROP INDEX IF EXISTS idx_microsoft_tasks_status;
DROP INDEX IF EXISTS idx_microsoft_tasks_list;
DROP INDEX IF EXISTS idx_microsoft_tasks_workspace;

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS task_sync_metadata;
DROP TABLE IF EXISTS microsoft_tasks;