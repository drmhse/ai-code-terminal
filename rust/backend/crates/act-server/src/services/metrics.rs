use act_core::Database;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;
use uuid::Uuid;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricEvent {
    pub id: String,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub event_type: String,
    pub event_name: String,
    pub properties: HashMap<String, serde_json::Value>,
    pub timestamp: i64,
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSummary {
    pub total_sessions: u64,
    pub active_sessions: u64,
    pub total_commands: u64,
    pub average_session_duration: f64,
    pub most_used_commands: Vec<CommandUsage>,
    pub error_rate: f64,
    pub peak_concurrent_sessions: u64,
    pub time_period: TimePeriod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandUsage {
    pub command: String,
    pub count: u64,
    pub average_duration_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub cpu_usage_percent: f64,
    pub memory_usage_mb: f64,
    pub disk_usage_mb: f64,
    pub active_connections: u64,
    pub request_rate: f64,
    pub response_time_ms: f64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimePeriod {
    pub start_time: i64,
    pub end_time: i64,
    pub period_type: String, // "hour", "day", "week", "month"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserActivity {
    pub user_id: String,
    pub session_count: u64,
    pub total_duration_ms: i64,
    pub command_count: u64,
    pub last_active: i64,
    pub favorite_commands: Vec<String>,
    pub repositories_accessed: u64,
}

pub struct MetricsService {
    db: Database,
}

impl MetricsService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub async fn record_event(
        &self,
        user_id: Option<String>,
        session_id: Option<String>,
        event_type: String,
        event_name: String,
        properties: HashMap<String, serde_json::Value>,
        duration_ms: Option<i64>,
    ) -> Result<String> {
        let event_id = Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().timestamp();
        let properties_json = serde_json::to_string(&properties)?;

        sqlx::query(
            r#"
            INSERT INTO metric_events 
            (id, user_id, session_id, event_type, event_name, properties, timestamp, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&event_id)
        .bind(&user_id)
        .bind(&session_id)
        .bind(&event_type)
        .bind(&event_name)
        .bind(&properties_json)
        .bind(timestamp)
        .bind(duration_ms)
        .execute(self.db.pool())
        .await?;

        Ok(event_id)
    }

    pub async fn record_command_execution(
        &self,
        user_id: Option<String>,
        session_id: Option<String>,
        command: String,
        exit_code: i32,
        duration_ms: i64,
    ) -> Result<String> {
        let mut properties = HashMap::new();
        properties.insert("command".to_string(), serde_json::Value::String(command.clone()));
        properties.insert("exit_code".to_string(), serde_json::Value::Number(exit_code.into()));

        self.record_event(
            user_id,
            session_id,
            "command".to_string(),
            "execute".to_string(),
            properties,
            Some(duration_ms),
        ).await
    }

    pub async fn record_session_event(
        &self,
        user_id: Option<String>,
        session_id: String,
        event_name: String,
        properties: HashMap<String, serde_json::Value>,
    ) -> Result<String> {
        self.record_event(
            user_id,
            Some(session_id),
            "session".to_string(),
            event_name,
            properties,
            None,
        ).await
    }

    pub async fn record_performance_metrics(&self, metrics: PerformanceMetrics) -> Result<()> {
        let metrics_json = serde_json::to_string(&metrics)?;

        sqlx::query(
            r#"
            INSERT INTO performance_metrics 
            (cpu_usage_percent, memory_usage_mb, disk_usage_mb, active_connections, 
             request_rate, response_time_ms, timestamp, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(metrics.cpu_usage_percent)
        .bind(metrics.memory_usage_mb)
        .bind(metrics.disk_usage_mb)
        .bind(metrics.active_connections as i64)
        .bind(metrics.request_rate)
        .bind(metrics.response_time_ms)
        .bind(metrics.timestamp)
        .bind(&metrics_json)
        .execute(self.db.pool())
        .await?;

        Ok(())
    }

    pub async fn get_metrics_summary(&self, time_period: TimePeriod) -> Result<MetricsSummary> {
        // Total sessions in period
        let total_sessions: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT session_id) FROM metric_events WHERE timestamp BETWEEN ? AND ? AND event_type = 'session'"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(self.db.pool())
        .await?;

        // Active sessions (sessions with activity in the last hour)
        let one_hour_ago = chrono::Utc::now().timestamp() - 3600;
        let active_sessions: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT session_id) FROM metric_events WHERE timestamp >= ? AND event_type = 'session'"
        )
        .bind(one_hour_ago)
        .fetch_one(self.db.pool())
        .await?;

        // Total commands
        let total_commands: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM metric_events WHERE timestamp BETWEEN ? AND ? AND event_type = 'command'"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(self.db.pool())
        .await?;

        // Average session duration
        let avg_duration: Option<f64> = sqlx::query_scalar(
            r#"
            SELECT AVG(duration_ms) FROM metric_events 
            WHERE timestamp BETWEEN ? AND ? 
            AND event_type = 'session' 
            AND event_name = 'end' 
            AND duration_ms IS NOT NULL
            "#
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_optional(self.db.pool())
        .await?;

        // Most used commands
        let command_rows = sqlx::query(
            r#"
            SELECT 
                JSON_EXTRACT(properties, '$.command') as command,
                COUNT(*) as count,
                AVG(duration_ms) as avg_duration
            FROM metric_events 
            WHERE timestamp BETWEEN ? AND ? 
            AND event_type = 'command'
            AND JSON_EXTRACT(properties, '$.command') IS NOT NULL
            GROUP BY JSON_EXTRACT(properties, '$.command')
            ORDER BY count DESC
            LIMIT 10
            "#
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_all(self.db.pool())
        .await?;

        let mut most_used_commands = Vec::new();
        for row in command_rows {
            let command: String = row.get("command");
            let count: i64 = row.get("count");
            let avg_duration: Option<f64> = row.get("avg_duration");

            most_used_commands.push(CommandUsage {
                command,
                count: count as u64,
                average_duration_ms: avg_duration.unwrap_or(0.0),
            });
        }

        // Error rate
        let total_events: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM metric_events WHERE timestamp BETWEEN ? AND ?"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(self.db.pool())
        .await?;

        let error_events: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM metric_events 
            WHERE timestamp BETWEEN ? AND ?
            AND (event_name = 'error' OR JSON_EXTRACT(properties, '$.exit_code') != '0')
            "#
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(self.db.pool())
        .await?;

        let error_rate = if total_events > 0 {
            (error_events as f64 / total_events as f64) * 100.0
        } else {
            0.0
        };

        // Peak concurrent sessions (simplified - actual implementation would need more complex tracking)
        let peak_concurrent: i64 = sqlx::query_scalar(
            "SELECT MAX(active_connections) FROM performance_metrics WHERE timestamp BETWEEN ? AND ?"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_optional(self.db.pool())
        .await?
        .unwrap_or(0);

        Ok(MetricsSummary {
            total_sessions: total_sessions as u64,
            active_sessions: active_sessions as u64,
            total_commands: total_commands as u64,
            average_session_duration: avg_duration.unwrap_or(0.0),
            most_used_commands,
            error_rate,
            peak_concurrent_sessions: peak_concurrent as u64,
            time_period,
        })
    }

    pub async fn get_user_activity(&self, user_id: &str, days: i32) -> Result<UserActivity> {
        let start_time = chrono::Utc::now().timestamp() - (days as i64 * 24 * 3600);

        // Session count and total duration
        let session_data: Option<(i64, Option<i64>)> = sqlx::query_as(
            r#"
            SELECT 
                COUNT(DISTINCT session_id) as session_count,
                SUM(duration_ms) as total_duration
            FROM metric_events 
            WHERE user_id = ? 
            AND timestamp >= ? 
            AND event_type = 'session'
            "#
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_optional(self.db.pool())
        .await?;

        let (session_count, total_duration) = session_data.unwrap_or((0, Some(0)));

        // Command count
        let command_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM metric_events WHERE user_id = ? AND timestamp >= ? AND event_type = 'command'"
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_one(self.db.pool())
        .await?;

        // Last active
        let last_active: i64 = sqlx::query_scalar(
            "SELECT MAX(timestamp) FROM metric_events WHERE user_id = ?"
        )
        .bind(user_id)
        .fetch_optional(self.db.pool())
        .await?
        .unwrap_or(0);

        // Favorite commands
        let favorite_rows = sqlx::query(
            r#"
            SELECT JSON_EXTRACT(properties, '$.command') as command, COUNT(*) as count
            FROM metric_events 
            WHERE user_id = ? 
            AND timestamp >= ? 
            AND event_type = 'command'
            AND JSON_EXTRACT(properties, '$.command') IS NOT NULL
            GROUP BY JSON_EXTRACT(properties, '$.command')
            ORDER BY count DESC
            LIMIT 5
            "#
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_all(self.db.pool())
        .await?;

        let favorite_commands: Vec<String> = favorite_rows
            .into_iter()
            .map(|row| row.get::<String, _>("command"))
            .collect();

        // Repositories accessed (simplified)
        let repo_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(DISTINCT JSON_EXTRACT(properties, '$.repository'))
            FROM metric_events 
            WHERE user_id = ? 
            AND timestamp >= ? 
            AND JSON_EXTRACT(properties, '$.repository') IS NOT NULL
            "#
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_optional(self.db.pool())
        .await?
        .unwrap_or(0);

        Ok(UserActivity {
            user_id: user_id.to_string(),
            session_count: session_count as u64,
            total_duration_ms: total_duration.unwrap_or(0),
            command_count: command_count as u64,
            last_active,
            favorite_commands,
            repositories_accessed: repo_count as u64,
        })
    }

    pub async fn get_performance_metrics(&self, time_period: TimePeriod) -> Result<Vec<PerformanceMetrics>> {
        let rows = sqlx::query(
            r#"
            SELECT cpu_usage_percent, memory_usage_mb, disk_usage_mb, active_connections,
                   request_rate, response_time_ms, timestamp, raw_data
            FROM performance_metrics 
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
            "#
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_all(self.db.pool())
        .await?;

        let mut metrics = Vec::new();
        for row in rows {
            metrics.push(PerformanceMetrics {
                cpu_usage_percent: row.get("cpu_usage_percent"),
                memory_usage_mb: row.get("memory_usage_mb"),
                disk_usage_mb: row.get("disk_usage_mb"),
                active_connections: row.get::<i64, _>("active_connections") as u64,
                request_rate: row.get("request_rate"),
                response_time_ms: row.get("response_time_ms"),
                timestamp: row.get("timestamp"),
            });
        }

        Ok(metrics)
    }

    pub async fn cleanup_old_metrics(&self, days_to_keep: i32) -> Result<u64> {
        let cutoff_time = chrono::Utc::now().timestamp() - (days_to_keep as i64 * 24 * 3600);

        let events_deleted = sqlx::query("DELETE FROM metric_events WHERE timestamp < ?")
            .bind(cutoff_time)
            .execute(self.db.pool())
            .await?
            .rows_affected();

        let performance_deleted = sqlx::query("DELETE FROM performance_metrics WHERE timestamp < ?")
            .bind(cutoff_time)
            .execute(self.db.pool())
            .await?
            .rows_affected();

        info!("Cleaned up {} old metric events and {} performance records", events_deleted, performance_deleted);
        Ok(events_deleted + performance_deleted)
    }

    pub async fn export_metrics(
        &self,
        time_period: TimePeriod,
        format: &str,
    ) -> Result<String> {
        let summary = self.get_metrics_summary(time_period.clone()).await?;
        let performance = self.get_performance_metrics(time_period.clone()).await?;

        match format.to_lowercase().as_str() {
            "json" => {
                let export_data = serde_json::json!({
                    "summary": summary,
                    "performance": performance,
                    "exported_at": chrono::Utc::now().timestamp(),
                    "time_period": time_period
                });
                Ok(serde_json::to_string_pretty(&export_data)?)
            },
            "csv" => {
                let mut csv_data = String::from("timestamp,event_type,event_name,user_id,session_id,duration_ms\n");
                
                let events = sqlx::query(
                    "SELECT timestamp, event_type, event_name, user_id, session_id, duration_ms FROM metric_events WHERE timestamp BETWEEN ? AND ?"
                )
                .bind(time_period.start_time)
                .bind(time_period.end_time)
                .fetch_all(self.db.pool())
                .await?;

                for row in events {
                    csv_data.push_str(&format!(
                        "{},{},{},{},{},{}\n",
                        row.get::<i64, _>("timestamp"),
                        row.get::<String, _>("event_type"),
                        row.get::<String, _>("event_name"),
                        row.get::<Option<String>, _>("user_id").unwrap_or_default(),
                        row.get::<Option<String>, _>("session_id").unwrap_or_default(),
                        row.get::<Option<i64>, _>("duration_ms").unwrap_or_default()
                    ));
                }

                Ok(csv_data)
            },
            _ => Err(anyhow::anyhow!("Unsupported export format: {}", format))
        }
    }
}