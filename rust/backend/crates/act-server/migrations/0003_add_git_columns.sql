-- Add missing git columns to workspaces table
ALTER TABLE workspaces ADD COLUMN git_url TEXT;
ALTER TABLE workspaces ADD COLUMN git_branch TEXT;

-- Create indexes for new workspace git columns  
CREATE INDEX IF NOT EXISTS idx_workspaces_git_url ON workspaces(git_url);
CREATE INDEX IF NOT EXISTS idx_workspaces_git_branch ON workspaces(git_branch);