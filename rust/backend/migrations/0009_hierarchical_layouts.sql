-- Migration to support hierarchical terminal layouts
-- Adds support for tree-based pane structures like native IDEs

-- Add new layout type for hierarchical layouts
-- layout_type now supports: 'tabs', 'horizontal-split', 'vertical-split', 'grid', 'hierarchical'

-- Add new column to store the tree structure
ALTER TABLE terminal_layouts ADD COLUMN tree_structure TEXT;

-- Add version column to track layout format version
ALTER TABLE terminal_layouts ADD COLUMN format_version INTEGER NOT NULL DEFAULT 1;

-- Update existing layouts to version 1 (flat structure)
UPDATE terminal_layouts SET format_version = 1 WHERE format_version IS NULL;

-- Add index for performance
CREATE INDEX idx_terminal_layouts_format_version ON terminal_layouts(format_version);

-- Migration function to convert flat layouts to hierarchical
-- This will be handled in the application code when layouts are loaded