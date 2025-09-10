use std::sync::Arc;

use act_core::Result;
use act_domain::system_service::{
    MetricsRepository, MetricEvent, MetricsSummary, PerformanceMetrics, 
    TimePeriod, UserActivity, CommandUsage
};
use async_trait::async_trait;
use chrono::{DateTime, Utc, Duration};
use serde_json;
use sqlx::{Pool, Sqlite, Row};
use tracing::{debug, info};
use uuid::Uuid;

pub struct SqlxMetricsRepository {
    pool: Arc<Pool<Sqlite>>,
}

impl SqlxMetricsRepository {
    pub fn new(pool: Arc<Pool<Sqlite>>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MetricsRepository for SqlxMetricsRepository {
    async fn record_event(&self, event: MetricEvent) -> Result<String> {
        let event_id = event.id.clone();
        
        let properties_json = serde_json::to_string(&event.properties)
            .map_err(|e| act_core::CoreError::Database(format!("Failed to serialize properties: {}", e)))?;
        
        debug!("Recording metric event: {} - {}", event.event_type, event.event_name);
        
        sqlx::query(
            r#"
            INSERT INTO metric_events (
                id, user_id, session_id, event_type, event_name, 
                properties, timestamp, duration_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&event.id)
        .bind(&event.user_id)
        .bind(&event.session_id)
        .bind(&event.event_type)
        .bind(&event.event_name)
        .bind(&properties_json)
        .bind(event.timestamp)
        .bind(event.duration_ms)
        .execute(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to record metric event: {}", e)))?;
        
        Ok(event_id)
    }

    async fn record_performance_metrics(&self, metrics: PerformanceMetrics) -> Result<()> {
        debug!("Recording performance metrics: CPU {}%, Memory {}MB", 
               metrics.cpu_usage_percent, metrics.memory_usage_mb);
        
        sqlx::query(
            r#"
            INSERT INTO performance_metrics (
                id, cpu_usage_percent, memory_usage_mb, disk_usage_mb,
                active_connections, request_rate, response_time_ms, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(metrics.cpu_usage_percent)
        .bind(metrics.memory_usage_mb)
        .bind(metrics.disk_usage_mb)
        .bind(metrics.active_connections as i64)
        .bind(metrics.request_rate)
        .bind(metrics.response_time_ms)
        .bind(metrics.timestamp)
        .execute(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to record performance metrics: {}", e)))?;
        
        Ok(())
    }

    async fn get_metrics_summary(&self, time_period: TimePeriod) -> Result<MetricsSummary> {
        debug!("Getting metrics summary for period: {} to {}", 
               time_period.start_time, time_period.end_time);
        
        // Get total sessions
        let total_sessions = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(DISTINCT session_id) FROM metric_events 
             WHERE event_type = 'session' AND timestamp BETWEEN ? AND ? AND session_id IS NOT NULL"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get total sessions: {}", e)))?
        .unwrap_or(0) as u64;
        
        // Get active sessions (sessions with recent activity)
        let active_sessions = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(DISTINCT session_id) FROM metric_events 
             WHERE event_type = 'session' AND timestamp >= datetime('now', '-5 minutes') AND session_id IS NOT NULL"
        )
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get active sessions: {}", e)))?
        .unwrap_or(0) as u64;
        
        // Get total commands
        let total_commands = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(*) FROM metric_events 
             WHERE event_type = 'command' AND timestamp BETWEEN ? AND ?"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get total commands: {}", e)))?
        .unwrap_or(0) as u64;
        
        // Get average session duration
        let avg_duration = sqlx::query_scalar::<_, Option<f64>>(
            "SELECT AVG(duration_ms) FROM metric_events 
             WHERE event_type = 'session' AND event_name = 'end' 
             AND timestamp BETWEEN ? AND ? AND duration_ms IS NOT NULL"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get average session duration: {}", e)))?
        .unwrap_or(0.0);
        
        // Get most used commands
        let command_usage_rows = sqlx::query(
            "SELECT 
                json_extract(properties, '$.command') as command,
                COUNT(*) as count,
                AVG(duration_ms) as avg_duration
             FROM metric_events 
             WHERE event_type = 'command' AND timestamp BETWEEN ? AND ?
             GROUP BY json_extract(properties, '$.command')
             ORDER BY count DESC
             LIMIT 10"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get command usage: {}", e)))?;
        
        let most_used_commands = command_usage_rows.into_iter().map(|row| CommandUsage {
            command: row.get("command"),
            count: row.get::<i64, _>("count") as u64,
            average_duration_ms: row.get("avg_duration"),
        }).collect();
        
        // Get error rate
        let error_events = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(*) FROM metric_events 
             WHERE event_type = 'error' AND timestamp BETWEEN ? AND ?"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get error count: {}", e)))?
        .unwrap_or(0);
        
        let total_events = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(*) FROM metric_events 
             WHERE timestamp BETWEEN ? AND ?"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get total events: {}", e)))?
        .unwrap_or(0);
        
        let error_rate = if total_events > 0 {
            (error_events as f64 / total_events as f64) * 100.0
        } else {
            0.0
        };
        
        // Get peak concurrent sessions
        let peak_concurrent = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT MAX(session_count) FROM (
                SELECT COUNT(DISTINCT session_id) as session_count
                FROM metric_events 
                WHERE event_type = 'session' AND timestamp BETWEEN ? AND ?
                GROUP BY datetime(timestamp, '-5 minutes')
            )"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get peak concurrent sessions: {}", e)))?
        .unwrap_or(0) as u64;
        
        Ok(MetricsSummary {
            total_sessions,
            active_sessions,
            total_commands,
            average_session_duration: avg_duration,
            most_used_commands,
            error_rate,
            peak_concurrent_sessions: peak_concurrent,
            time_period,
        })
    }

    async fn get_user_activity(&self, user_id: &str, days: i32) -> Result<UserActivity> {
        let start_time = Utc::now() - Duration::days(days as i64);
        
        debug!("Getting user activity for user {} over {} days", user_id, days);
        
        // Get session count
        let session_count = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(DISTINCT session_id) FROM metric_events 
             WHERE user_id = ? AND event_type = 'session' AND timestamp >= ?"
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get user session count: {}", e)))?
        .unwrap_or(0) as u64;
        
        // Get total duration
        let total_duration = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COALESCE(SUM(duration_ms), 0) FROM metric_events 
             WHERE user_id = ? AND event_type = 'session' AND event_name = 'end' 
             AND timestamp >= ? AND duration_ms IS NOT NULL"
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get user total duration: {}", e)))?
        .unwrap_or(0);
        
        // Get command count
        let command_count = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(*) FROM metric_events 
             WHERE user_id = ? AND event_type = 'command' AND timestamp >= ?"
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get user command count: {}", e)))?
        .unwrap_or(0) as u64;
        
        // Get last active time
        let last_active = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
            "SELECT MAX(timestamp) FROM metric_events 
             WHERE user_id = ? AND timestamp >= ?"
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get user last active: {}", e)))?
        .unwrap_or_else(|| Utc::now());
        
        // Get favorite commands
        let fav_commands_rows = sqlx::query(
            "SELECT json_extract(properties, '$.command') as command
             FROM metric_events 
             WHERE user_id = ? AND event_type = 'command' AND timestamp >= ?
             GROUP BY json_extract(properties, '$.command')
             ORDER BY COUNT(*) DESC
             LIMIT 5"
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get user favorite commands: {}", e)))?;
        
        let favorite_commands = fav_commands_rows.into_iter()
            .filter_map(|row| row.get::<Option<String>, _>("command"))
            .collect();
        
        // Get repositories accessed
        let repos_accessed = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT COUNT(DISTINCT json_extract(properties, '$.workspace_id')) 
             FROM metric_events 
             WHERE user_id = ? AND event_type = 'workspace' AND timestamp >= ?"
        )
        .bind(user_id)
        .bind(start_time)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get user repositories accessed: {}", e)))?
        .unwrap_or(0) as u64;
        
        Ok(UserActivity {
            user_id: user_id.to_string(),
            session_count,
            total_duration_ms: total_duration,
            command_count,
            last_active,
            favorite_commands,
            repositories_accessed: repos_accessed,
        })
    }

    async fn get_performance_metrics(&self, time_period: TimePeriod) -> Result<Vec<PerformanceMetrics>> {
        debug!("Getting performance metrics for period: {} to {}", 
               time_period.start_time, time_period.end_time);
        
        let rows = sqlx::query(
            "SELECT cpu_usage_percent, memory_usage_percent, disk_usage_percent,
                    active_connections, request_rate, response_time_ms, timestamp
             FROM performance_metrics 
             WHERE timestamp BETWEEN ? AND ?
             ORDER BY timestamp ASC"
        )
        .bind(time_period.start_time)
        .bind(time_period.end_time)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to get performance metrics: {}", e)))?;
        
        let metrics = rows.into_iter().map(|row| PerformanceMetrics {
            cpu_usage_percent: row.get("cpu_usage_percent"),
            memory_usage_mb: row.get("memory_usage_mb"),
            disk_usage_mb: row.get("disk_usage_mb"),
            active_connections: row.get::<i64, _>("active_connections") as u64,
            request_rate: row.get("request_rate"),
            response_time_ms: row.get("response_time_ms"),
            timestamp: row.get("timestamp"),
        }).collect();
        
        Ok(metrics)
    }

    async fn cleanup_old_metrics(&self, days_to_keep: i32) -> Result<u64> {
        let cutoff_time = Utc::now() - Duration::days(days_to_keep as i64);
        
        info!("Cleaning up metrics older than {} days", days_to_keep);
        
        // Clean up old metric events
        let events_deleted = sqlx::query(
            "DELETE FROM metric_events WHERE timestamp < ?"
        )
        .bind(cutoff_time)
        .execute(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to cleanup old metric events: {}", e)))?
        .rows_affected();
        
        // Clean up old performance metrics
        let perf_deleted = sqlx::query(
            "DELETE FROM performance_metrics WHERE timestamp < ?"
        )
        .bind(cutoff_time)
        .execute(&*self.pool)
        .await
        .map_err(|e| act_core::CoreError::Database(format!("Failed to cleanup old performance metrics: {}", e)))?
        .rows_affected();
        
        let total_deleted = events_deleted + perf_deleted;
        
        if total_deleted > 0 {
            info!("Cleaned up {} old metric records ({} events, {} performance metrics)", 
                  total_deleted, events_deleted, perf_deleted);
        }
        
        Ok(total_deleted)
    }

    async fn export_metrics(&self, time_period: TimePeriod, format: &str) -> Result<String> {
        debug!("Exporting metrics in {} format for period: {} to {}", 
               format, time_period.start_time, time_period.end_time);
        
        match format.to_lowercase().as_str() {
            "json" => {
                let summary = self.get_metrics_summary(time_period.clone()).await?;
                serde_json::to_string_pretty(&summary)
                    .map_err(|e| act_core::CoreError::Database(format!("Failed to serialize metrics to JSON: {}", e)))
            },
            "csv" => {
                let mut csv_output = String::new();
                csv_output.push_str("timestamp,event_type,event_name,user_id,session_id,duration_ms\n");
                
                let rows = sqlx::query(
                    "SELECT timestamp, event_type, event_name, user_id, session_id, duration_ms
                     FROM metric_events 
                     WHERE timestamp BETWEEN ? AND ?
                     ORDER BY timestamp ASC"
                )
                .bind(time_period.start_time)
                .bind(time_period.end_time)
                .fetch_all(&*self.pool)
                .await
                .map_err(|e| act_core::CoreError::Database(format!("Failed to fetch metrics for CSV export: {}", e)))?;
                
                for row in rows {
                    let timestamp: DateTime<Utc> = row.get("timestamp");
                    let event_type: String = row.get("event_type");
                    let event_name: String = row.get("event_name");
                    let user_id: Option<String> = row.get("user_id");
                    let session_id: Option<String> = row.get("session_id");
                    let duration_ms: Option<i64> = row.get("duration_ms");
                    
                    csv_output.push_str(&format!("{},{},{},{},{},{}\n",
                        timestamp,
                        event_type,
                        event_name,
                        user_id.unwrap_or_else(|| "".to_string()),
                        session_id.unwrap_or_else(|| "".to_string()),
                        duration_ms.unwrap_or(0)
                    ));
                }
                
                Ok(csv_output)
            },
            _ => Err(act_core::CoreError::Validation(format!("Unsupported export format: {}", format)))
        }
    }
}