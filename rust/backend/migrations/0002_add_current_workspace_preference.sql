-- Add current workspace preference to user settings
-- Date: 2025-09-21
-- Purpose: Enable multi-device workspace persistence

-- Add current_workspace_id to user_settings table
ALTER TABLE user_settings
ADD COLUMN current_workspace_id TEXT
REFERENCES workspaces(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_user_settings_current_workspace ON user_settings(current_workspace_id);

-- Note: The field is nullable by design - users may not have any workspaces
-- When a workspace is deleted, the preference is automatically set to NULL