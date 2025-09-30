use act_core::{Result, models::SystemMetrics};
use act_domain::system_service::{MetricsRepository, SystemMonitor, MetricEvent, MetricsSummary, PerformanceMetrics, TimePeriod, UserActivity};
use chrono::{Utc, Duration};
use async_trait::async_trait;
use sysinfo::{System, Disks, Networks};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Real implementation of MetricsRepository that stores metrics in memory
/// In a production environment, this would be replaced with a database-backed implementation
pub struct InMemoryMetricsRepository {
    events: Arc<RwLock<Vec<MetricEvent>>>,
    performance_metrics: Arc<RwLock<Vec<PerformanceMetrics>>>,
}

impl InMemoryMetricsRepository {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            events: Arc::new(RwLock::new(Vec::new())),
            performance_metrics: Arc::new(RwLock::new(Vec::new())),
        }
    }

    async fn cleanup_old_events(&self, days_to_keep: i32) -> usize {
        let cutoff_time = Utc::now() - Duration::days(days_to_keep as i64);
        let mut events = self.events.write().await;
        let initial_len = events.len();
        events.retain(|event| event.timestamp > cutoff_time);
        initial_len - events.len()
    }

    async fn cleanup_old_performance_metrics(&self, days_to_keep: i32) -> usize {
        let cutoff_time = Utc::now() - Duration::days(days_to_keep as i64);
        let mut metrics = self.performance_metrics.write().await;
        let initial_len = metrics.len();
        metrics.retain(|metric| metric.timestamp > cutoff_time);
        initial_len - metrics.len()
    }
}

#[async_trait]
impl MetricsRepository for InMemoryMetricsRepository {
    async fn record_event(&self, event: MetricEvent) -> Result<String> {
        let mut events = self.events.write().await;
        events.push(event.clone());
        // info!("Recorded metric event: {} - {}", event.event_type, event.event_name);
        Ok(event.id)
    }

    async fn record_performance_metrics(&self, metrics: PerformanceMetrics) -> Result<()> {
        let mut perf_metrics = self.performance_metrics.write().await;
        perf_metrics.push(metrics.clone());
        // info!("Recorded performance metrics at {}", metrics.timestamp);
        Ok(())
    }

    async fn get_metrics_summary(&self, time_period: TimePeriod) -> Result<MetricsSummary> {
        let events = self.events.read().await;
        let _perf_metrics = self.performance_metrics.read().await;

        // Filter events within the time period
        let period_events: Vec<&MetricEvent> = events
            .iter()
            .filter(|event| event.timestamp >= time_period.start_time && event.timestamp <= time_period.end_time)
            .collect();

        // Calculate summary statistics
        let total_sessions = period_events
            .iter()
            .filter(|event| event.event_type == "session" && event.event_name == "create")
            .count() as u64;

        let active_sessions = period_events
            .iter()
            .filter(|event| {
                event.event_type == "session" && 
                (event.event_name == "create" || event.event_name == "resume")
            })
            .count() as u64;

        let total_commands = period_events
            .iter()
            .filter(|event| event.event_type == "command")
            .count() as u64;

        // Calculate average session duration
        let session_durations: Vec<i64> = period_events
            .iter()
            .filter(|event| event.event_type == "session" && event.duration_ms.is_some())
            .map(|event| event.duration_ms.unwrap())
            .collect();

        let average_session_duration = if session_durations.is_empty() {
            0.0
        } else {
            session_durations.iter().sum::<i64>() as f64 / session_durations.len() as f64
        };

        // Calculate most used commands
        let mut command_counts: HashMap<String, (u64, f64)> = HashMap::new();
        for event in period_events.iter().filter(|e| e.event_type == "command") {
            if let Some(command) = event.properties.get("command") {
                if let Some(command_str) = command.as_str() {
                    let count = command_counts.entry(command_str.to_string()).or_insert((0, 0.0));
                    count.0 += 1;
                    if let Some(duration) = event.duration_ms {
                        count.1 = (count.1 * (count.0 - 1) as f64 + duration as f64) / count.0 as f64;
                    }
                }
            }
        }

        let most_used_commands: Vec<act_domain::system_service::CommandUsage> = command_counts
            .into_iter()
            .map(|(command, (count, avg_duration))| act_domain::system_service::CommandUsage {
                command,
                count,
                average_duration_ms: avg_duration,
            })
            .collect();

        // Calculate error rate
        let error_commands = period_events
            .iter()
            .filter(|event| {
                event.event_type == "command" &&
                event.properties.get("exit_code").is_some_and(|code| {
                    code.as_i64().is_some_and(|c| c != 0)
                })
            })
            .count() as u64;

        let error_rate = if total_commands > 0 {
            (error_commands as f64 / total_commands as f64) * 100.0
        } else {
            0.0
        };

        // Find peak concurrent sessions
        let peak_concurrent_sessions = period_events
            .iter()
            .filter(|event| event.event_type == "session" && event.event_name == "create")
            .count() as u64;

        Ok(MetricsSummary {
            total_sessions,
            active_sessions,
            total_commands,
            average_session_duration,
            most_used_commands,
            error_rate,
            peak_concurrent_sessions,
            time_period,
        })
    }

    async fn get_user_activity(&self, user_id: &str, _days: i32) -> Result<UserActivity> {
        let events = self.events.read().await;
        
        let user_events: Vec<&MetricEvent> = events
            .iter()
            .filter(|event| event.user_id.as_ref().is_some_and(|uid| uid == user_id))
            .collect();

        let session_count = user_events
            .iter()
            .filter(|event| event.event_type == "session" && event.event_name == "create")
            .count() as u64;

        let total_duration_ms: i64 = user_events
            .iter()
            .filter(|event| event.event_type == "session" && event.duration_ms.is_some())
            .map(|event| event.duration_ms.unwrap())
            .sum();

        let command_count = user_events
            .iter()
            .filter(|event| event.event_type == "command")
            .count() as u64;

        let last_active = user_events
            .iter()
            .map(|event| event.timestamp)
            .max()
            .unwrap_or_else(Utc::now);

        // Calculate favorite commands
        let mut command_counts: HashMap<String, u64> = HashMap::new();
        for event in user_events.iter().filter(|e| e.event_type == "command") {
            if let Some(command) = event.properties.get("command") {
                if let Some(command_str) = command.as_str() {
                    *command_counts.entry(command_str.to_string()).or_insert(0) += 1;
                }
            }
        }

        let favorite_commands: Vec<String> = command_counts
            .into_iter()
            .filter(|(_, count)| *count > 1) // Only commands used more than once
            .map(|(command, _)| command)
            .collect();

        let repositories_accessed = user_events
            .iter()
            .filter(|event| event.properties.contains_key("workspace_id"))
            .count() as u64;

        Ok(UserActivity {
            user_id: user_id.to_string(),
            session_count,
            total_duration_ms,
            command_count,
            last_active,
            favorite_commands,
            repositories_accessed,
        })
    }

    async fn get_performance_metrics(&self, time_period: TimePeriod) -> Result<Vec<PerformanceMetrics>> {
        let metrics = self.performance_metrics.read().await;
        
        let filtered_metrics: Vec<PerformanceMetrics> = metrics
            .iter()
            .filter(|metric| metric.timestamp >= time_period.start_time && metric.timestamp <= time_period.end_time)
            .cloned()
            .collect();

        Ok(filtered_metrics)
    }

    async fn cleanup_old_metrics(&self, days_to_keep: i32) -> Result<u64> {
        let events_cleaned = self.cleanup_old_events(days_to_keep).await;
        let metrics_cleaned = self.cleanup_old_performance_metrics(days_to_keep).await;
        
        // info!("Cleaned up {} old events and {} old performance metrics", events_cleaned, metrics_cleaned);
        Ok((events_cleaned + metrics_cleaned) as u64)
    }

    async fn export_metrics(&self, time_period: TimePeriod, format: &str) -> Result<String> {
        let events = self.events.read().await;
        let perf_metrics = self.performance_metrics.read().await;

        let period_events: Vec<&MetricEvent> = events
            .iter()
            .filter(|event| event.timestamp >= time_period.start_time && event.timestamp <= time_period.end_time)
            .collect();

        let period_perf_metrics: Vec<&PerformanceMetrics> = perf_metrics
            .iter()
            .filter(|metric| metric.timestamp >= time_period.start_time && metric.timestamp <= time_period.end_time)
            .collect();

        match format.to_lowercase().as_str() {
            "json" => {
                let export_data = serde_json::json!({
                    "time_period": time_period,
                    "events": period_events,
                    "performance_metrics": period_perf_metrics,
                    "exported_at": Utc::now()
                });
                Ok(serde_json::to_string_pretty(&export_data)?)
            }
            "csv" => {
                let mut csv_output = String::new();
                csv_output.push_str("timestamp,event_type,event_name,user_id,session_id,duration_ms\n");
                
                for event in period_events {
                    csv_output.push_str(&format!(
                        "{},{},{},{},{},{}\n",
                        event.timestamp,
                        event.event_type,
                        event.event_name,
                        event.user_id.as_deref().unwrap_or(""),
                        event.session_id.as_deref().unwrap_or(""),
                        event.duration_ms.unwrap_or(0)
                    ));
                }
                
                Ok(csv_output)
            }
            _ => Err(act_core::CoreError::Validation(format!("Unsupported export format: {}", format))),
        }
    }
}

/// Simple, reliable system monitor using sysinfo crate only
pub struct RealSystemMonitor {
    system: Arc<RwLock<System>>,
}

impl RealSystemMonitor {
    pub fn new() -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        Self {
            system: Arc::new(RwLock::new(system)),
        }
    }

    async fn refresh_system(&self) {
        let mut system = self.system.write().await;
        system.refresh_all();
    }

    async fn get_disk_usage(&self) -> Result<(u64, u64)> {
        // Create a new Disks instance with refreshed data
        let disks = Disks::new_with_refreshed_list();

        // Get current working directory
        let current_path = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/"));

        // Find the disk that contains our current path
        for disk in disks.list() {
            if current_path.starts_with(disk.mount_point()) {
                let total_space = disk.total_space();
                let available_space = disk.available_space();
                let used_space = total_space.saturating_sub(available_space);
                return Ok((used_space, total_space));
            }
        }

        // Fallback: use first available disk if current path matching fails
        if let Some(disk) = disks.list().first() {
            let total_space = disk.total_space();
            let available_space = disk.available_space();
            let used_space = total_space.saturating_sub(available_space);
            return Ok((used_space, total_space));
        }

        Err(act_core::CoreError::Internal("No disk information available".to_string()))
    }

    async fn get_network_stats(&self) -> (u64, u64) {
        // Create a new Networks instance with refreshed data
        let networks = Networks::new_with_refreshed_list();

        let mut total_rx = 0u64;
        let mut total_tx = 0u64;

        for (_, network) in &networks {
            total_rx = total_rx.saturating_add(network.received());
            total_tx = total_tx.saturating_add(network.transmitted());
        }

        (total_rx, total_tx)
    }
}

#[async_trait]
impl SystemMonitor for RealSystemMonitor {
    async fn get_system_metrics(&self) -> Result<SystemMetrics> {
        self.refresh_system().await;
        let system = self.system.read().await;

        let cpu_usage = system.global_cpu_usage() as f64;
        let total_memory = system.total_memory();
        let used_memory = system.used_memory();

        // Release the read lock before calling disk operations
        drop(system);

        let (used_disk_space, total_disk_space) = self.get_disk_usage().await?;
        let (network_rx, network_tx) = self.get_network_stats().await;

        // Re-acquire the lock for process count
        let system = self.system.read().await;
        let active_processes = system.processes().len() as u32;

        Ok(SystemMetrics {
            timestamp: Utc::now(),
            cpu_usage_percent: cpu_usage,
            memory_used_bytes: used_memory,
            memory_total_bytes: total_memory,
            disk_used_bytes: used_disk_space,
            disk_total_bytes: total_disk_space,
            uptime_seconds: System::uptime(),
            load_average: System::load_average().one,
            process_count: active_processes,
            network_rx,
            network_tx,
            active_sessions: 0, // This will be set by the caller
            active_processes,
        })
    }

    async fn get_cpu_usage(&self) -> Result<f64> {
        self.refresh_system().await;
        let system = self.system.read().await;
        Ok(system.global_cpu_usage() as f64)
    }

    async fn get_memory_usage(&self) -> Result<f64> {
        self.refresh_system().await;
        let system = self.system.read().await;
        let total = system.total_memory();
        let used = system.used_memory();
        Ok(if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 })
    }

    async fn get_disk_usage(&self) -> Result<f64> {
        let (used, total) = self.get_disk_usage().await?;
        Ok(if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 })
    }

    async fn get_network_stats(&self) -> Result<(u64, u64)> {
        Ok(self.get_network_stats().await)
    }
}
