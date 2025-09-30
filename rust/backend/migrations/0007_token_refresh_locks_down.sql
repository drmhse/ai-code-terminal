-- Rollback token refresh locking mechanism

-- Drop index first
DROP INDEX IF EXISTS idx_token_refresh_locks_expires_at;

-- Drop table
DROP TABLE IF EXISTS token_refresh_locks;