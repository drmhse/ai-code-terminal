use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use act_core::{models::SystemMetrics, CoreError, Result};

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::info;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricEvent {
    pub id: String,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub event_type: String,
    pub event_name: String,
    pub properties: HashMap<String, serde_json::Value>,
    pub timestamp: DateTime<Utc>,
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
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimePeriod {
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub period_type: String, // "hour", "day", "week", "month"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserActivity {
    pub user_id: String,
    pub session_count: u64,
    pub total_duration_ms: i64,
    pub command_count: u64,
    pub last_active: DateTime<Utc>,
    pub favorite_commands: Vec<String>,
    pub repositories_accessed: u64,
}

#[async_trait]
pub trait MetricsRepository: Send + Sync {
    async fn record_event(&self, event: MetricEvent) -> Result<String>;
    async fn record_performance_metrics(&self, metrics: PerformanceMetrics) -> Result<()>;
    async fn get_metrics_summary(&self, time_period: TimePeriod) -> Result<MetricsSummary>;
    async fn get_user_activity(&self, user_id: &str, days: i32) -> Result<UserActivity>;
    async fn get_performance_metrics(
        &self,
        time_period: TimePeriod,
    ) -> Result<Vec<PerformanceMetrics>>;
    async fn cleanup_old_metrics(&self, days_to_keep: i32) -> Result<u64>;
    async fn export_metrics(&self, time_period: TimePeriod, format: &str) -> Result<String>;
}

#[async_trait]
pub trait SystemMonitor: Send + Sync {
    async fn get_system_metrics(&self) -> Result<SystemMetrics>;
    async fn get_cpu_usage(&self) -> Result<f64>;
    async fn get_memory_usage(&self) -> Result<f64>;
    async fn get_disk_usage(&self) -> Result<f64>;
    async fn get_network_stats(&self) -> Result<(u64, u64)>; // (rx, tx)
}

#[derive(Debug, Clone)]
pub struct SystemServiceConfig {
    pub workspace_root: PathBuf,
    pub allow_access_to_parent_dirs: bool,
}

impl Default for SystemServiceConfig {
    fn default() -> Self {
        Self {
            workspace_root: std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("workspaces"),
            allow_access_to_parent_dirs: false,
        }
    }
}

pub struct SystemService {
    metrics_repository: Arc<dyn MetricsRepository>,
    system_monitor: Arc<dyn SystemMonitor>,
    config: SystemServiceConfig,
}

impl SystemService {
    pub fn new(
        metrics_repository: Arc<dyn MetricsRepository>,
        system_monitor: Arc<dyn SystemMonitor>,
        config: SystemServiceConfig,
    ) -> Self {
        Self {
            metrics_repository,
            system_monitor,
            config,
        }
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
        let event = MetricEvent {
            id: Uuid::new_v4().to_string(),
            user_id,
            session_id,
            event_type,
            event_name,
            properties,
            timestamp: Utc::now(),
            duration_ms,
        };

        self.metrics_repository.record_event(event).await
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
        properties.insert(
            "command".to_string(),
            serde_json::Value::String(command.clone()),
        );
        properties.insert(
            "exit_code".to_string(),
            serde_json::Value::Number(exit_code.into()),
        );

        self.record_event(
            user_id,
            session_id,
            "command".to_string(),
            "execute".to_string(),
            properties,
            Some(duration_ms),
        )
        .await
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
        )
        .await
    }

    pub async fn record_workspace_event(
        &self,
        user_id: Option<String>,
        workspace_id: String,
        event_name: String,
        properties: HashMap<String, serde_json::Value>,
    ) -> Result<String> {
        let mut extended_properties = properties;
        extended_properties.insert(
            "workspace_id".to_string(),
            serde_json::Value::String(workspace_id),
        );

        self.record_event(
            user_id,
            None,
            "workspace".to_string(),
            event_name,
            extended_properties,
            None,
        )
        .await
    }

    pub async fn get_current_system_metrics(&self) -> Result<SystemMetrics> {
        self.system_monitor.get_system_metrics().await
    }

    pub async fn record_current_performance_metrics(
        &self,
        active_sessions: u32,
        _active_processes: u32,
    ) -> Result<()> {
        let system_metrics = self.system_monitor.get_system_metrics().await?;
        let (_network_rx, _network_tx) = self.system_monitor.get_network_stats().await?;

        let memory_usage_mb = if system_metrics.memory_total_bytes > 0 {
            (system_metrics.memory_used_bytes as f64 / system_metrics.memory_total_bytes as f64)
                * 100.0
        } else {
            0.0
        };

        let disk_usage_mb = if system_metrics.disk_total_bytes > 0 {
            (system_metrics.disk_used_bytes as f64 / system_metrics.disk_total_bytes as f64) * 100.0
        } else {
            0.0
        };

        let performance_metrics = PerformanceMetrics {
            cpu_usage_percent: system_metrics.cpu_usage_percent,
            memory_usage_mb,
            disk_usage_mb,
            active_connections: active_sessions as u64,
            request_rate: 0.0,     // Would need to be tracked separately
            response_time_ms: 0.0, // Would need to be tracked separately
            timestamp: system_metrics.timestamp,
        };

        self.metrics_repository
            .record_performance_metrics(performance_metrics)
            .await
    }

    pub async fn get_metrics_summary(&self, time_period: TimePeriod) -> Result<MetricsSummary> {
        self.metrics_repository
            .get_metrics_summary(time_period)
            .await
    }

    pub async fn get_user_activity(&self, user_id: &str, days: i32) -> Result<UserActivity> {
        if days <= 0 || days > 365 {
            return Err(CoreError::Validation(
                "Days must be between 1 and 365".to_string(),
            ));
        }

        self.metrics_repository
            .get_user_activity(user_id, days)
            .await
    }

    pub async fn get_performance_metrics(
        &self,
        time_period: TimePeriod,
    ) -> Result<Vec<PerformanceMetrics>> {
        if time_period.start_time >= time_period.end_time {
            return Err(CoreError::Validation(
                "Start time must be before end time".to_string(),
            ));
        }

        self.metrics_repository
            .get_performance_metrics(time_period)
            .await
    }

    pub async fn cleanup_old_metrics(&self, days_to_keep: i32) -> Result<u64> {
        if days_to_keep <= 0 {
            return Err(CoreError::Validation(
                "Days to keep must be positive".to_string(),
            ));
        }

        let deleted_count = self
            .metrics_repository
            .cleanup_old_metrics(days_to_keep)
            .await?;

        if deleted_count > 0 {
            info!("Cleaned up {} old metric records", deleted_count);
        }

        Ok(deleted_count)
    }

    pub async fn export_metrics(&self, time_period: TimePeriod, format: &str) -> Result<String> {
        let supported_formats = ["json", "csv"];
        if !supported_formats.contains(&format.to_lowercase().as_str()) {
            return Err(CoreError::Validation(format!(
                "Unsupported format: {}. Supported: {:?}",
                format, supported_formats
            )));
        }

        if time_period.start_time >= time_period.end_time {
            return Err(CoreError::Validation(
                "Start time must be before end time".to_string(),
            ));
        }

        self.metrics_repository
            .export_metrics(time_period, format)
            .await
    }

    pub async fn get_system_health(&self) -> Result<SystemHealth> {
        let system_metrics = self.get_current_system_metrics().await?;

        let memory_usage_percent = if system_metrics.memory_total_bytes > 0 {
            (system_metrics.memory_used_bytes as f64 / system_metrics.memory_total_bytes as f64)
                * 100.0
        } else {
            0.0
        };

        let health_status =
            if system_metrics.cpu_usage_percent > 90.0 || memory_usage_percent > 90.0 {
                HealthStatus::Critical
            } else if system_metrics.cpu_usage_percent > 70.0 || memory_usage_percent > 70.0 {
                HealthStatus::Warning
            } else {
                HealthStatus::Healthy
            };

        let disk_usage_percent = if system_metrics.disk_total_bytes > 0 {
            (system_metrics.disk_used_bytes as f64 / system_metrics.disk_total_bytes as f64) * 100.0
        } else {
            0.0
        };

        Ok(SystemHealth {
            status: health_status,
            cpu_usage: system_metrics.cpu_usage_percent,
            memory_usage: memory_usage_percent,
            disk_usage: disk_usage_percent,
            active_sessions: system_metrics.active_sessions,
            active_processes: system_metrics.active_processes,
            uptime_seconds: 0, // Would need to track server start time
            last_check: Utc::now(),
        })
    }

    pub async fn generate_daily_report(&self) -> Result<DailyReport> {
        let now = Utc::now();
        let start_of_day = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();

        let time_period = TimePeriod {
            start_time: start_of_day,
            end_time: now,
            period_type: "day".to_string(),
        };

        let summary = self.get_metrics_summary(time_period.clone()).await?;
        let system_health = self.get_system_health().await?;

        Ok(DailyReport {
            date: now.date_naive(),
            metrics_summary: summary,
            system_health,
            generated_at: now,
        })
    }

    pub async fn browse_directory(
        &self,
        path: Option<&str>,
        _user_id: Option<&str>,
        workspace_id: Option<&str>,
    ) -> Result<BrowseDirectoryResponse> {
        use std::fs;

        let browse_path = match path {
            Some(p) if !p.is_empty() => PathBuf::from(p),
            _ => std::env::current_dir().map_err(|e| CoreError::FileSystem(e.to_string()))?,
        };

        // Canonicalize the path to get absolute path
        let canonical_path = browse_path
            .canonicalize()
            .map_err(|e| CoreError::FileSystem(format!("Invalid path: {}", e)))?;

        // Validate path against workspace restrictions
        if !self.config.allow_access_to_parent_dirs {
            // If workspace_id is provided, restrict to that specific workspace
            if let Some(workspace_id) = workspace_id {
                let workspace_path = self.config.workspace_root.join(workspace_id);
                let workspace_canonical = workspace_path
                    .canonicalize()
                    .unwrap_or_else(|_| workspace_path);

                if !canonical_path.starts_with(&workspace_canonical) {
                    return Err(CoreError::FileSystem(
                        format!("Access denied: path {} is not within workspace {}",
                               canonical_path.to_string_lossy(), workspace_id)
                    ));
                }
            } else {
                // If no workspace_id, restrict to workspace root
                let workspace_root_canonical = self.config.workspace_root
                    .canonicalize()
                    .unwrap_or_else(|_| self.config.workspace_root.clone());

                if !canonical_path.starts_with(&workspace_root_canonical) {
                    return Err(CoreError::FileSystem(
                        format!("Access denied: path {} is not within workspace directory. \
                                Set ALLOW_ACCESS_TO_PARENT_DIRS=true to allow parent directory access.",
                               canonical_path.to_string_lossy())
                    ));
                }
            }
        }

        // Read directory entries
        let read_dir = fs::read_dir(&canonical_path)
            .map_err(|e| CoreError::FileSystem(format!("Cannot read directory: {}", e)))?;

        let mut entries = Vec::new();
        for entry_result in read_dir {
            let entry = match entry_result {
                Ok(e) => e,
                Err(_) => continue, // Skip entries that can't be read
            };

            let path = entry.path();
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue, // Skip if we can't get metadata
            };

            let name = entry.file_name().to_string_lossy().to_string();
            let is_hidden = name.starts_with('.');
            let is_directory = metadata.is_dir();

            entries.push(DirectoryEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_directory,
                is_hidden,
            });
        }

        // Sort: directories first, then alphabetically
        entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        let parent_path = canonical_path
            .parent()
            .map(|p| p.to_string_lossy().to_string());

        Ok(BrowseDirectoryResponse {
            current_path: canonical_path.to_string_lossy().to_string(),
            parent_path,
            entries,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub status: HealthStatus,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub disk_usage: f64,
    pub active_sessions: u32,
    pub active_processes: u32,
    pub uptime_seconds: i64,
    pub last_check: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthStatus {
    Healthy,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReport {
    pub date: chrono::NaiveDate,
    pub metrics_summary: MetricsSummary,
    pub system_health: SystemHealth,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowseDirectoryResponse {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub entries: Vec<DirectoryEntry>,
}

