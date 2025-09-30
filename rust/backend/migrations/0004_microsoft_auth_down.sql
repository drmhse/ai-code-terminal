-- Rollback Microsoft To Do Integration - Auth & Token Storage
-- Version: 1.0
-- Date: 2025-09-30

-- Drop indexes first
DROP INDEX IF EXISTS idx_workspace_todo_list_id;
DROP INDEX IF EXISTS idx_microsoft_auth_expires;

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS workspace_todo_mappings;
DROP TABLE IF EXISTS user_microsoft_auth;