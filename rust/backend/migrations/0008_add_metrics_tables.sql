-- Add metrics tables for persistent system and user analytics
-- This enables tracking of system usage, performance, and user activity

-- Metric events table for tracking all system events
CREATE TABLE metric_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,                          -- User ID who triggered the event (nullable for system events)
    session_id TEXT,                       -- Session ID if event is session-specific
    event_type TEXT NOT NULL,              -- Category: command, session, workspace, system, error
    event_name TEXT NOT NULL,              -- Specific event name: execute, create, update, delete, etc.
    properties TEXT DEFAULT '{}',          -- JSON object with event-specific properties
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,                   -- Event duration in milliseconds (for performance tracking)
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Performance metrics table for system health monitoring
CREATE TABLE performance_metrics (
    id TEXT PRIMARY KEY,
    cpu_usage_percent REAL NOT NULL,       -- CPU usage percentage
    memory_usage_percent REAL NOT NULL,    -- Memory usage percentage  
    disk_usage_percent REAL NOT NULL,     -- Disk usage percentage
    active_connections INTEGER NOT NULL,   -- Number of active connections/sessions
    request_rate REAL DEFAULT 0.0,         -- Requests per second
    response_time_ms REAL DEFAULT 0.0,     -- Average response time in milliseconds
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_metric_events_user ON metric_events(user_id);
CREATE INDEX idx_metric_events_session ON metric_events(session_id);
CREATE INDEX idx_metric_events_type ON metric_events(event_type);
CREATE INDEX idx_metric_events_name ON metric_events(event_name);
CREATE INDEX idx_metric_events_timestamp ON metric_events(timestamp);

CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp);

-- Create index for recent events (last 30 days)
CREATE INDEX idx_metric_events_recent ON metric_events(timestamp) 
WHERE timestamp >= datetime('now', '-30 days');

-- Create index for recent performance metrics (last 7 days)
CREATE INDEX idx_performance_metrics_recent ON performance_metrics(timestamp) 
WHERE timestamp >= datetime('now', '-7 days');