-- AI Code Terminal - Complete Initial Schema
-- Version: 1.0
-- Date: 2025-10-01
-- Consolidates all database tables with corrected foreign key constraints

-- =============================================================================
--  Users & Authentication
-- =============================================================================

-- Stores core user information, linked to their SSO identity.
CREATE TABLE users (
    id TEXT PRIMARY KEY,                            -- Internal unique UUID for the user
    sso_user_id TEXT UNIQUE,                        -- SSO's unique user ID (sub claim)
    username TEXT,                                  -- Username (derived from SSO)
    email TEXT,                                     -- Email (derived from SSO)
    avatar_url TEXT,                                -- Avatar URL (derived from SSO)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_sso_user_id ON users(sso_user_id);

-- Stores user-specific settings, including sensitive tokens and preferences.
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,
    theme TEXT,                                     -- JSON string of user's ThemePreference
    current_workspace_id TEXT,                      -- Current workspace preference
    layout_preferences TEXT,                        -- JSON storage for layout preferences
    default_provider TEXT,                          -- User's primary login provider from SSO (github, microsoft, google)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(current_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_current_workspace ON user_settings(current_workspace_id);
CREATE INDEX idx_user_settings_layout_preferences ON user_settings(user_id) WHERE layout_preferences IS NOT NULL;
CREATE INDEX idx_user_settings_default_provider ON user_settings(default_provider) WHERE default_provider IS NOT NULL;

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
--  Background Tasks & Metrics
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

-- =============================================================================
--  Microsoft To Do Integration
-- =============================================================================

-- TIMESTAMP SCHEMA DESIGN DECISION:
--
-- This schema uses a dual timestamp approach:
-- 1. DATETIME format for user-facing tables (users, workspaces, etc.)
--    - More human-readable in SQL queries and debugging
--    - Standard format for application data
--
-- 2. INTEGER (Unix epoch) format for Microsoft sync tables
--    - Direct compatibility with Microsoft Graph API timestamps
--    - Eliminates conversion overhead in sync operations
--    - Precise millisecond accuracy for conflict resolution
--    - Easier arithmetic for expiry calculations
--
-- All DATETIME ↔ Unix epoch conversions are handled in the repository layer
-- and are covered by integration tests.

-- Stores encrypted Microsoft OAuth tokens for To Do API access
-- Each user can have one Microsoft account linked for To Do integration
CREATE TABLE user_microsoft_auth (
    user_id TEXT PRIMARY KEY,                          -- Links to users.id
    access_token_encrypted BLOB NOT NULL,              -- AES-256-GCM encrypted access token
    refresh_token_encrypted BLOB NOT NULL,             -- AES-256-GCM encrypted refresh token
    token_expires_at INTEGER NOT NULL,                 -- Unix timestamp when access token expires
    microsoft_user_id TEXT,                            -- Microsoft's unique user ID
    microsoft_email TEXT,                              -- User's Microsoft email address
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), -- When auth was first established
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()), -- Last token refresh timestamp
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for efficient token expiry checks during refresh operations
CREATE INDEX idx_microsoft_auth_expires ON user_microsoft_auth(token_expires_at);

-- Maps workspaces to their corresponding Microsoft To Do lists
-- Each workspace gets its own dedicated To Do list for organization
CREATE TABLE workspace_todo_mappings (
    workspace_id TEXT PRIMARY KEY,                     -- Links to workspaces.id
    microsoft_list_id TEXT NOT NULL,                   -- Microsoft To Do list ID from Graph API
    list_name TEXT NOT NULL,                           -- Display name of the list (usually workspace name)
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Index for efficient list lookups by Microsoft list ID
CREATE INDEX idx_workspace_todo_list_id ON workspace_todo_mappings(microsoft_list_id);

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
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    -- Removed: FOREIGN KEY(microsoft_list_id) REFERENCES workspace_todo_mappings(microsoft_list_id) ON DELETE CASCADE
);

-- Table to track synchronization metadata and conflicts
CREATE TABLE task_sync_metadata (
    workspace_id TEXT PRIMARY KEY,                      -- Workspace being synced
    microsoft_list_id TEXT NOT NULL,                    -- Corresponding Microsoft list
    last_sync_timestamp INTEGER NOT NULL DEFAULT 0,     -- Last successful sync timestamp
    last_successful_sync INTEGER DEFAULT 0,             -- Last successful sync timestamp
    sync_version TEXT NOT NULL DEFAULT '1.0',         -- Sync version for migrations
    sync_errors INTEGER NOT NULL DEFAULT 0,             -- Consecutive sync error count
    max_sync_errors INTEGER NOT NULL DEFAULT 10,         -- Maximum consecutive errors before auto-disabling
    sync_error_details TEXT NOT NULL DEFAULT '[]',      -- JSON array of sync error details
    last_sync_error TEXT,                               -- Last sync error message
    next_sync_attempt INTEGER,                         -- Next scheduled sync attempt
    sync_interval_seconds INTEGER NOT NULL DEFAULT 300, -- Sync interval (5 minutes default)
    is_sync_enabled BOOLEAN DEFAULT TRUE,              -- Whether sync is enabled for this workspace
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    -- Removed: FOREIGN KEY(microsoft_list_id) REFERENCES workspace_todo_mappings(microsoft_list_id) ON DELETE CASCADE
);

-- Indexes for task sync performance
CREATE INDEX idx_microsoft_tasks_workspace ON microsoft_tasks(workspace_id);
CREATE INDEX idx_microsoft_tasks_list ON microsoft_tasks(microsoft_list_id);
CREATE INDEX idx_microsoft_tasks_status ON microsoft_tasks(status);
CREATE INDEX idx_microsoft_tasks_sync_status ON microsoft_tasks(sync_status);
CREATE INDEX idx_microsoft_tasks_modified ON microsoft_tasks(last_modified_date_time);
CREATE INDEX idx_task_sync_metadata_next_sync ON task_sync_metadata(next_sync_attempt);
CREATE INDEX idx_task_sync_metadata_error_state ON task_sync_metadata(sync_errors, is_sync_enabled);

-- =============================================================================
--  SSO Session Management
-- =============================================================================

-- Stores SSO session information for authenticated users
CREATE TABLE sso_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sso_token_hash TEXT NOT NULL,       -- Hash of the token for lookup
    provider TEXT NOT NULL,              -- 'github', 'microsoft', 'google'
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sso_sessions_user_id ON sso_sessions(user_id);
CREATE INDEX idx_sso_sessions_expires_at ON sso_sessions(expires_at);
CREATE INDEX idx_sso_sessions_token_hash ON sso_sessions(sso_token_hash);


-- =============================================================================
--  Triggers for Timestamp Management
-- =============================================================================

-- Trigger to update users.updated_at
CREATE TRIGGER update_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update user_settings.updated_at
CREATE TRIGGER update_user_settings_updated_at
    AFTER UPDATE ON user_settings
    FOR EACH ROW
BEGIN
    UPDATE user_settings SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

-- Trigger to update workspaces.updated_at
CREATE TRIGGER update_workspaces_updated_at
    AFTER UPDATE ON workspaces
    FOR EACH ROW
BEGIN
    UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update terminal_layouts.updated_at
CREATE TRIGGER update_terminal_layouts_updated_at
    AFTER UPDATE ON terminal_layouts
    FOR EACH ROW
BEGIN
    UPDATE terminal_layouts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update background_tasks.updated_at
CREATE TRIGGER update_background_tasks_updated_at
    AFTER UPDATE ON background_tasks
    FOR EACH ROW
BEGIN
    UPDATE background_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update user_microsoft_auth.updated_at
CREATE TRIGGER update_user_microsoft_auth_updated_at
    AFTER UPDATE ON user_microsoft_auth
    FOR EACH ROW
BEGIN
    UPDATE user_microsoft_auth SET updated_at = unixepoch() WHERE user_id = NEW.user_id;
END;

-- Trigger to update workspace_todo_mappings.updated_at
CREATE TRIGGER update_workspace_todo_mappings_updated_at
    AFTER UPDATE ON workspace_todo_mappings
    FOR EACH ROW
BEGIN
    UPDATE workspace_todo_mappings SET updated_at = unixepoch() WHERE workspace_id = NEW.workspace_id;
END;

-- Trigger to update microsoft_tasks.updated_at
CREATE TRIGGER update_microsoft_tasks_updated_at
    AFTER UPDATE ON microsoft_tasks
    FOR EACH ROW
BEGIN
    UPDATE microsoft_tasks SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Trigger to update task_sync_metadata.updated_at
CREATE TRIGGER update_task_sync_metadata_updated_at
    AFTER UPDATE ON task_sync_metadata
    FOR EACH ROW
BEGIN
    UPDATE task_sync_metadata SET updated_at = unixepoch() WHERE workspace_id = NEW.workspace_id;
END;