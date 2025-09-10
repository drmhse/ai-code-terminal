-- Create a new 'users' table to store user information
CREATE TABLE users (
    id TEXT PRIMARY KEY,                            -- A unique UUID for our internal system
    github_id TEXT NOT NULL UNIQUE,                 -- The user's unique ID from GitHub
    username TEXT NOT NULL,                         -- The user's GitHub username
    email TEXT,
    avatar_url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create a 'user_settings' table to replace the singleton 'settings' table
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,
    github_token TEXT,                              -- Encrypted GitHub OAuth access token
    github_refresh_token TEXT,                      -- Encrypted GitHub OAuth refresh token
    github_token_expires_at DATETIME,               -- Expiration date of the access token
    theme TEXT,                                     -- User's theme preference JSON
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add 'user_id' foreign key to the 'workspaces' table
ALTER TABLE workspaces ADD COLUMN user_id TEXT;
-- Note: We are not adding NOT NULL yet to handle existing data. A separate data migration script would be needed for a live system.

-- Add 'user_id' foreign key to the 'sessions' table
ALTER TABLE sessions ADD COLUMN user_id TEXT;

-- Add 'user_id' foreign key to the 'terminal_layouts' table
ALTER TABLE terminal_layouts ADD COLUMN user_id TEXT;

-- Add 'user_id' foreign key to the 'user_theme_preferences' table (or modify it)
-- This table is now redundant with user_settings. For simplicity, we'll plan to merge its data and drop it.
-- For now, let's add the user_id to ensure consistency if we keep it temporarily.
ALTER TABLE user_theme_preferences ADD COLUMN owner_id TEXT; -- Renaming to owner_id to match workspace, will be user_id FK

-- Drop the old singleton 'settings' table
DROP TABLE settings;