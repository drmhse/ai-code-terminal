-- Fix UNIQUE constraint on github_repo to allow multiple users to clone the same repository
-- The original constraint was globally unique, but it should be unique per owner

-- First, remove the existing UNIQUE constraint by recreating the table without it
CREATE TABLE workspaces_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    github_repo TEXT NOT NULL,           -- Remove UNIQUE constraint
    github_url TEXT NOT NULL,
    local_path TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    last_sync_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Columns added in later migrations
    description TEXT,
    path TEXT NOT NULL DEFAULT '/workspace',
    owner_id TEXT,
    git_commit TEXT,
    is_git_repo BOOLEAN NOT NULL DEFAULT 0,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    settings TEXT DEFAULT '{}',
    git_url TEXT,
    git_branch TEXT
);

-- Copy data from old table
INSERT INTO workspaces_new 
SELECT id, name, github_repo, github_url, local_path, is_active, last_sync_at, created_at, updated_at,
       description, path, owner_id, git_commit, is_git_repo, last_accessed, settings, git_url, git_branch
FROM workspaces;

-- Drop old table and rename new one
DROP TABLE workspaces;
ALTER TABLE workspaces_new RENAME TO workspaces;

-- Add a compound UNIQUE constraint on github_repo + owner_id
-- This allows the same repo to be cloned by different users, but prevents one user from cloning the same repo twice
CREATE UNIQUE INDEX idx_workspaces_github_repo_owner ON workspaces(github_repo, owner_id) WHERE owner_id IS NOT NULL;

-- Recreate all the indexes that were lost when we dropped the table
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_last_accessed ON workspaces(last_accessed);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_git_repo ON workspaces(is_git_repo);
CREATE INDEX IF NOT EXISTS idx_workspaces_git_url ON workspaces(git_url);
CREATE INDEX IF NOT EXISTS idx_workspaces_git_branch ON workspaces(git_branch);