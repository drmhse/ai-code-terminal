-- Migration to simplify layout schema and remove legacy fields
-- Since there are no existing users, we can safely drop old columns

-- Drop indexes that reference columns we're about to remove
DROP INDEX IF EXISTS idx_terminal_layouts_format_version;

-- Remove old configuration column (legacy flat structure)
ALTER TABLE terminal_layouts DROP COLUMN configuration;

-- Remove format_version column (no longer needed)
ALTER TABLE terminal_layouts DROP COLUMN format_version;

-- Make tree_structure NOT NULL since it's now required
-- First update any NULL values to a default empty layout
UPDATE terminal_layouts
SET tree_structure = '{"root":{"id":"default","type":"terminal","size":100,"tabs":[],"activeTabId":null,"isActive":true},"activeNodeId":"default"}'
WHERE tree_structure IS NULL;

-- Now make it NOT NULL
-- Note: SQLite doesn't support ALTER COLUMN, so we need to recreate the table
CREATE TABLE terminal_layouts_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    layout_type TEXT NOT NULL DEFAULT 'hierarchical',
    tree_structure TEXT NOT NULL, -- JSON string of hierarchical layout (required)
    is_default BOOLEAN NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL,
    user_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO terminal_layouts_new (id, name, layout_type, tree_structure, is_default, workspace_id, user_id, created_at, updated_at)
SELECT id, name, layout_type, tree_structure, is_default, workspace_id, user_id, created_at, updated_at
FROM terminal_layouts;

-- Drop old table and rename new one
DROP TABLE terminal_layouts;
ALTER TABLE terminal_layouts_new RENAME TO terminal_layouts;

-- Recreate indexes
CREATE INDEX idx_terminal_layouts_workspace_default ON terminal_layouts(workspace_id, is_default);