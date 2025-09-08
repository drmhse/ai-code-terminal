-- Add missing user_theme_preferences table
CREATE TABLE IF NOT EXISTS user_theme_preferences (
    user_id TEXT PRIMARY KEY,
    theme_id TEXT NOT NULL DEFAULT 'vscode-dark',
    auto_switch BOOLEAN NOT NULL DEFAULT 1,
    system_override BOOLEAN NOT NULL DEFAULT 0,
    customizations TEXT DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to workspaces table
ALTER TABLE workspaces ADD COLUMN description TEXT;
ALTER TABLE workspaces ADD COLUMN path TEXT NOT NULL DEFAULT '/workspace';
ALTER TABLE workspaces ADD COLUMN owner_id TEXT;
ALTER TABLE workspaces ADD COLUMN git_commit TEXT;
ALTER TABLE workspaces ADD COLUMN is_git_repo BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE workspaces ADD COLUMN settings TEXT DEFAULT '{}';

-- Create indexes for the new user_theme_preferences table
CREATE INDEX IF NOT EXISTS idx_user_theme_preferences_theme ON user_theme_preferences(theme_id);
CREATE INDEX IF NOT EXISTS idx_user_theme_preferences_updated ON user_theme_preferences(updated_at);

-- Create indexes for new workspace columns  
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_last_accessed ON workspaces(last_accessed);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_git_repo ON workspaces(is_git_repo);