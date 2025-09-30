-- Add OAuth state management table
-- This migration moves OAuth PKCE state from in-memory cache to persistent storage

-- Table to store OAuth PKCE verifiers and state tokens
CREATE TABLE oauth_states (
    state TEXT PRIMARY KEY,                     -- OAuth state parameter (CSRF token)
    user_id TEXT NOT NULL,                      -- User ID who initiated the OAuth flow
    code_verifier TEXT NOT NULL,                -- PKCE code verifier
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,                -- Expiration timestamp (10 minutes from creation)
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for cleanup of expired states
CREATE INDEX idx_oauth_states_expires_at ON oauth_states(expires_at);
CREATE INDEX idx_oauth_states_user_id ON oauth_states(user_id);