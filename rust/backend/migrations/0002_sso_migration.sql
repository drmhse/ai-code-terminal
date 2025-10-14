-- SSO Migration
-- Transforms the application from direct GitHub OAuth to external SSO service
-- Version: 1.0
-- Date: 2025-10-04

-- =============================================================================
--  SSO Configuration & Sessions
-- =============================================================================

-- Stores SSO service configuration (typically one row)
CREATE TABLE sso_config (
    id TEXT PRIMARY KEY,
    sso_base_url TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret_encrypted BLOB NOT NULL,
    org_slug TEXT NOT NULL,
    service_slug TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Stores SSO session information for authenticated users
CREATE TABLE sso_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sso_token TEXT NOT NULL,            -- The JWT from SSO
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
--  Users Table Modifications
-- =============================================================================

-- Add new SSO-related columns to users table
ALTER TABLE users ADD COLUMN sso_user_id TEXT;  -- Maps to SSO's user.id

-- Create index for SSO user ID lookups
CREATE INDEX idx_users_sso_user_id ON users(sso_user_id);

-- Note: We keep github_id for backward compatibility during migration
-- It will be deprecated but not removed to preserve data integrity

-- =============================================================================
--  User Settings Table Modifications
-- =============================================================================

-- Add default provider column to user_settings
ALTER TABLE user_settings ADD COLUMN default_provider TEXT;  -- 'github', 'microsoft', 'google'

-- Note: We keep github_token, github_refresh_token, github_token_expires_at
-- for backward compatibility during migration. These will be deprecated
-- in favor of SSO tokens stored in sso_sessions table.

-- =============================================================================
--  Triggers for SSO Tables
-- =============================================================================

-- Trigger to update sso_config.updated_at
CREATE TRIGGER update_sso_config_updated_at
    AFTER UPDATE ON sso_config
    FOR EACH ROW
BEGIN
    UPDATE sso_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
