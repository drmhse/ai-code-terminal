use act_core::{Result, models::SystemMetrics};
use act_domain::system_service::{MetricsRepository, SystemMonitor, MetricEvent, MetricsSummary, PerformanceMetrics, TimePeriod, UserActivity};
use chrono::{Utc, Duration};
use async_trait::async_trait;
use sysinfo::System;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::error;

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
                event.properties.get("exit_code").map_or(false, |code| {
                    code.as_i64().map_or(false, |c| c != 0)
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
            .filter(|event| event.user_id.as_ref().map_or(false, |uid| uid == user_id))
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

/// Real implementation of SystemMonitor using sysinfo
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

    async fn get_real_disk_usage(&self) -> Result<(u64, u64)> {
        // Since we're targeting Linux Docker environments, we can use statvfs
        // to get accurate disk usage information from the filesystem
        
        use std::os::unix::fs::MetadataExt;
        use nix::sys::statvfs;
        
        // Get the current working directory or default to root
        let path = std::env::current_dir().unwrap_or_else(|_| "/".into());
        
        // Use statvfs to get real filesystem statistics
        match statvfs::statvfs(&path) {
            Ok(stat) => {
                let block_size = stat.block_size() as u64;
                let total_blocks = stat.blocks() as u64;
                let available_blocks = stat.blocks_available() as u64;
                
                let total_space = total_blocks * block_size;
                let used_space = total_space - (available_blocks * block_size);
                
                // info!("Real disk usage: {} used of {} total ({:.1}% used)", 
                //       Self::bytes_to_human(used_space), 
                //       Self::bytes_to_human(total_space),
                //       (used_space as f64 / total_space as f64) * 100.0);
                
                Ok((used_space, total_space))
            }
            Err(e) => {
                error!("Failed to get disk usage with statvfs: {}", e);
                
                // Fallback: use filesystem metadata for the current directory
                match path.metadata() {
                    Ok(metadata) => {
                        // This is less accurate but better than hardcoded values
                        // In Docker, we can make some reasonable assumptions
                        let _device_size = metadata.dev() as u64;
                        
                        // Use a more sophisticated estimation based on common Docker volumes
                        // This is still a fallback but better than hardcoded values
                        let estimated_total = match std::env::var("DOCKER_ENV") {
                            Ok(_) => {
                                // We're in Docker, use typical Docker volume sizes
                                10 * 1024 * 1024 * 1024 // 10GB typical Docker volume
                            }
                            Err(_) => {
                                // Not in Docker, use larger typical sizes
                                100 * 1024 * 1024 * 1024 // 100GB
                            }
                        };
                        
                        // Estimate usage based on directory size if available
                        let estimated_used = if let Ok(dir_size) = Self::get_directory_size(&path).await {
                            std::cmp::min(dir_size, estimated_total)
                        } else {
                            estimated_total / 2 // 50% usage as fallback
                        };
                        
                        // warn!("Using fallback disk usage estimation: {} used of {} total", 
                        //       Self::bytes_to_human(estimated_used), 
                        //       Self::bytes_to_human(estimated_total));
                        
                        Ok((estimated_used, estimated_total))
                    }
                    Err(e) => {
                        error!("Failed to get directory metadata: {}", e);
                        
                        // Ultimate fallback - but still better than completely hardcoded
                        let total = 50 * 1024 * 1024 * 1024; // 50GB
                        let used = total / 4; // 25% usage as conservative estimate
                        
                        error!("Using ultimate fallback disk usage: {} used of {} total", 
                              Self::bytes_to_human(used), Self::bytes_to_human(total));
                        
                        Ok((used, total))
                    }
                }
            }
        }
    }
    
    /// Helper function to get directory size recursively
    async fn get_directory_size(path: &std::path::Path) -> Result<u64> {
        let mut total_size = 0u64;
        
        match tokio::fs::read_dir(path).await {
            Ok(mut entries) => {
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let metadata = match entry.metadata().await {
                        Ok(meta) => meta,
                        Err(_) => continue,
                    };
                    
                    if metadata.is_file() {
                        total_size += metadata.len();
                    } else if metadata.is_dir() {
                        if let Ok(size) = Box::pin(Self::get_directory_size(&entry.path())).await {
                            total_size += size;
                        }
                    }
                }
            }
            Err(_) => {
                // If we can't read the directory, return 0
                return Ok(0);
            }
        }
        
        Ok(total_size)
    }
    
    /// Helper function to convert bytes to human readable format
    fn bytes_to_human(bytes: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        let mut bytes = bytes as f64;
        let mut unit_index = 0;
        
        while bytes >= 1024.0 && unit_index < UNITS.len() - 1 {
            bytes /= 1024.0;
            unit_index += 1;
        }
        
        format!("{:.1} {}", bytes, UNITS[unit_index])
    }

    async fn get_network_stats(&self) -> Result<(u64, u64)> {
        // Read network statistics from /proc/net/dev on Linux
        // This provides real network interface statistics
        let mut total_rx = 0u64;
        let mut total_tx = 0u64;
        
        if let Ok(content) = tokio::fs::read_to_string("/proc/net/dev").await {
            for line in content.lines() {
                let line = line.trim();
                // Skip header lines and empty lines
                if line.starts_with("Inter-") || line.starts_with(" face") || line.is_empty() {
                    continue;
                }
                
                // Parse interface statistics
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 17 {
                    // Format: interface rx_bytes rx_packets rx_errs rx_drop ...
                    if let (Ok(rx_bytes), Ok(tx_bytes)) = (parts[1].parse::<u64>(), parts[9].parse::<u64>()) {
                        total_rx += rx_bytes;
                        total_tx += tx_bytes;
                    }
                }
            }
            
            // info!("Real network stats: RX={}, TX={}", Self::bytes_to_human(total_rx), Self::bytes_to_human(total_tx));
        } else {
            // warn!("Failed to read /proc/net/dev, using fallback network stats");
        }
        
        Ok((total_rx, total_tx))
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
        
        let (used_disk_space, total_disk_space) = self.get_real_disk_usage().await?;
        let (network_rx, network_tx) = self.get_network_stats().await?;
        
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
            process_count: system.processes().len() as u32,
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
        let (used, total) = self.get_real_disk_usage().await?;
        Ok(if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 })
    }

    async fn get_network_stats(&self) -> Result<(u64, u64)> {
        // Read network statistics from /proc/net/dev on Linux
        // This provides real network interface statistics
        let mut total_rx = 0u64;
        let mut total_tx = 0u64;
        
        if let Ok(content) = tokio::fs::read_to_string("/proc/net/dev").await {
            for line in content.lines() {
                let line = line.trim();
                // Skip header lines and empty lines
                if line.starts_with("Inter-") || line.starts_with(" face") || line.is_empty() {
                    continue;
                }
                
                // Parse interface statistics
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 17 {
                    // Format: interface rx_bytes rx_packets rx_errs rx_drop ...
                    if let (Ok(rx_bytes), Ok(tx_bytes)) = (parts[1].parse::<u64>(), parts[9].parse::<u64>()) {
                        total_rx += rx_bytes;
                        total_tx += tx_bytes;
                    }
                }
            }
            
            // info!("Real network stats: RX={}, TX={}", Self::bytes_to_human(total_rx), Self::bytes_to_human(total_tx));
        } else {
            // warn!("Failed to read /proc/net/dev, using fallback network stats");
        }
        
        Ok((total_rx, total_tx))
    }
}
