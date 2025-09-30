-- Add token refresh locking mechanism
-- This migration adds distributed locking to prevent concurrent token refresh race conditions

-- Table to manage token refresh locks across multiple server instances
CREATE TABLE token_refresh_locks (
    user_id TEXT PRIMARY KEY,                      -- User ID being locked
    acquired_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,                   -- Lock expiration (30 seconds default)
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for cleanup of expired locks
CREATE INDEX idx_token_refresh_locks_expires_at ON token_refresh_locks(expires_at);