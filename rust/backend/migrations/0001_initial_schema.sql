-- AI Code Terminal - Consolidated Initial Schema
-- Version: 1.0
-- Date: 2025-09-20

-- =============================================================================
--  Users & Authentication
-- =============================================================================

-- Stores core user information, linked to their GitHub identity.
CREATE TABLE users (
    id TEXT PRIMARY KEY,                            -- Internal unique UUID for the user
    github_id TEXT NOT NULL UNIQUE,                 -- GitHub's unique user ID
    username TEXT NOT NULL,                         -- GitHub username
    email TEXT,
    avatar_url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Stores user-specific settings, including sensitive tokens and preferences.
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,
    github_token TEXT,                              -- Encrypted GitHub OAuth access token
    github_refresh_token TEXT,                      -- Encrypted GitHub OAuth refresh token
    github_token_expires_at DATETIME,
    theme TEXT,                                     -- JSON string of user's ThemePreference
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);


-- =============================================================================
--  Workspaces & Layouts
-- =============================================================================

-- Defines a workspace, which is a sandboxed directory on the server.
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    github_repo TEXT,                           -- Format: "owner/repo", can be NULL for empty workspaces
    github_url TEXT,                            -- Full Git URL, can be NULL
    local_path TEXT NOT NULL UNIQUE,            -- Absolute path on the server's file system
    is_active BOOLEAN NOT NULL DEFAULT 1,
    last_sync_at DATETIME,                      -- Last synchronization timestamp
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- A user cannot clone the same repository twice.
CREATE UNIQUE INDEX idx_workspaces_user_repo ON workspaces(user_id, github_repo) WHERE github_repo IS NOT NULL;
CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);


-- Stores user-defined terminal pane layouts for each workspace.
CREATE TABLE terminal_layouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    layout_type TEXT NOT NULL DEFAULT 'hierarchical',
    -- The entire state of the pane tree, including tabs and their buffers, is stored here.
    -- This is the key to session continuity on reload.
    tree_structure TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_layouts_user_workspace ON terminal_layouts(user_id, workspace_id);


-- =============================================================================
--  Background Tasks & Metrics (Formerly user_processes)
-- =============================================================================

-- Stores the DEFINITION of long-running tasks, not their live state.
CREATE TABLE background_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    args TEXT DEFAULT '[]',                     -- JSON array of arguments
    working_directory TEXT NOT NULL,
    auto_restart BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_tasks_user_workspace ON background_tasks(user_id, workspace_id);


-- Stores analytics events for system monitoring and usage tracking.
CREATE TABLE metric_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    event_type TEXT NOT NULL,               -- e.g., 'command', 'session', 'workspace'
    event_name TEXT NOT NULL,               -- e.g., 'execute', 'create'
    properties TEXT DEFAULT '{}',           -- JSON blob for event-specific data
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_metric_events_timestamp ON metric_events(timestamp);
CREATE INDEX idx_metric_events_type_name ON metric_events(event_type, event_name);