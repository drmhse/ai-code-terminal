-- Rollback OAuth state management table
-- This migration removes persistent OAuth PKCE state storage

-- Drop indexes first
DROP INDEX IF EXISTS idx_oauth_states_user_id;
DROP INDEX IF EXISTS idx_oauth_states_expires_at;

-- Drop table
DROP TABLE IF EXISTS oauth_states;