-- Microsoft To Do Integration - Auth & Token Storage
-- Version: 1.0
-- Date: 2025-09-28

-- =============================================================================
--  Microsoft Authentication & Token Storage
-- =============================================================================

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

-- =============================================================================
--  Workspace To Do List Mapping
-- =============================================================================

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