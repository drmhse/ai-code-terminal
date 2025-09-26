-- Add layout preferences to user settings
-- Date: 2025-01-15
-- Purpose: Enable draggable layout splitters with persistent user preferences

-- Add layout_preferences column to store sidebar/editor width preferences as JSON
ALTER TABLE user_settings
ADD COLUMN layout_preferences TEXT; -- JSON storage following theme column pattern

-- Index for performance (though not strictly necessary for JSON column)
CREATE INDEX idx_user_settings_layout_preferences ON user_settings(user_id)
WHERE layout_preferences IS NOT NULL;

-- Note: The field is nullable by design - NULL values will use default LayoutPreferences
-- This allows backward compatibility and graceful defaults via serde(default)
-- JSON structure: {"sidebar_width": 250, "editor_width": 400, "version": "1.0"}