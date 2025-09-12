use act_core::{Result, models::SystemMetrics};
use act_domain::system_service::SystemMonitor;
use async_trait::async_trait;
use chrono::Utc;
use sysinfo::System;
use std::path::Path;
use std::fs;
use tracing::{debug, warn};

pub struct RealSystemMonitor {
    system: System,
}

impl RealSystemMonitor {
    pub fn new() -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        debug!("Initialized real system monitor");
        Self { system }
    }

    fn refresh_system(&mut self) {
        self.system.refresh_all();
        debug!("Refreshed system metrics");
    }

    fn get_disk_usage_for_path(&self, path: &Path) -> Result<(u64, u64)> {
        match path.metadata() {
            Ok(metadata) => {
                // Get disk usage for the filesystem containing this path
                match fs::metadata(path) {
                    Ok(_) => {
                        // Use sysinfo to get disk information
                        if let Some(disk) = self.system.disks().iter()
                            .find(|disk| path.starts_with(disk.mount_point())) {
                            let total_space = disk.total_space();
                            let available_space = disk.available_space();
                            let used_space = total_space.saturating_sub(available_space);
                            return Ok((used_space, total_space));
                        }
                    }
                    Err(e) => {
                        warn!("Failed to get metadata for path {:?}: {}", path, e);
                    }
                }
            }
            Err(e) => {
                warn!("Failed to get metadata for path {:?}: {}", path, e);
            }
        }

        // Fallback to current directory
        if let Ok(current_dir) = std::env::current_dir() {
            if let Some(disk) = self.system.disks().iter()
                .find(|disk| current_dir.starts_with(disk.mount_point())) {
                let total_space = disk.total_space();
                let available_space = disk.available_space();
                let used_space = total_space.saturating_sub(available_space);
                return Ok((used_space, total_space));
            }
        }

        // Ultimate fallback - use first available disk
        if let Some(disk) = self.system.disks().first() {
            let total_space = disk.total_space();
            let available_space = disk.available_space();
            let used_space = total_space.saturating_sub(available_space);
            return Ok((used_space, total_space));
        }

        Err(act_core::CoreError::System("No disk information available".to_string()))
    }

    fn get_network_stats(&self) -> (u64, u64) {
        // Try to get network statistics from system
        let mut total_rx = 0u64;
        let mut total_tx = 0u64;

        for network in self.system.networks().values() {
            total_rx = total_rx.saturating_add(network.received());
            total_tx = total_tx.saturating_add(network.transmitted());
        }

        debug!("Network stats - RX: {} bytes, TX: {} bytes", total_rx, total_tx);
        (total_rx, total_tx)
    }

    fn get_active_process_count(&self) -> u32 {
        let active_count = self.system.processes().len() as u32;
        debug!("Active process count: {}", active_count);
        active_count
    }
}

#[async_trait]
impl SystemMonitor for RealSystemMonitor {
    async fn get_system_metrics(&self) -> Result<SystemMetrics> {
        let mut system = System::new_all();
        system.refresh_all();
        
        let cpu_usage = system.global_cpu_usage() as f64;
        let total_memory = system.total_memory();
        let used_memory = system.used_memory();
        let memory_usage_percent = if total_memory > 0 {
            (used_memory as f64 / total_memory as f64) * 100.0
        } else {
            0.0
        };
        
        // Get real disk usage
        let (used_disk_space, total_disk_space) = self.get_disk_usage_for_path(&std::env::current_dir()
            .unwrap_or_else(|_| Path::new(".").to_path_buf()))?;
        
        let disk_usage_percent = if total_disk_space > 0 {
            (used_disk_space as f64 / total_disk_space as f64) * 100.0
        } else {
            0.0
        };
        
        // Get network stats
        let (network_rx, network_tx) = self.get_network_stats();
        
        // Count total processes
        let active_processes = self.get_active_process_count();
        
        let metrics = SystemMetrics {
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
            active_sessions: 0, // This will be set by the session service
            active_processes,
        };

        debug!("System metrics collected: CPU {:.1}%, Memory {:.1}%, Disk {:.1}%, {} processes", 
               cpu_usage, memory_usage_percent, disk_usage_percent, active_processes);

        Ok(metrics)
    }

    async fn get_cpu_usage(&self) -> Result<f64> {
        let mut system = System::new_all();
        system.refresh_cpu_all();
        let usage = system.global_cpu_usage() as f64;
        debug!("Current CPU usage: {:.1}%", usage);
        Ok(usage)
    }

    async fn get_memory_usage(&self) -> Result<f64> {
        let mut system = System::new_all();
        system.refresh_memory();
        let total = system.total_memory();
        let used = system.used_memory();
        let usage = if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 };
        debug!("Current memory usage: {:.1}%", usage);
        Ok(usage)
    }

    async fn get_disk_usage(&self) -> Result<f64> {
        let (used, total) = self.get_disk_usage_for_path(&std::env::current_dir()
            .unwrap_or_else(|_| Path::new(".").to_path_buf()))?;
        
        let usage = if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 };
        debug!("Current disk usage: {:.1}%", usage);
        Ok(usage)
    }

    async fn get_network_stats(&self) -> Result<(u64, u64)> {
        let (rx, tx) = self.get_network_stats();
        debug!("Current network stats - RX: {} bytes, TX: {} bytes", rx, tx);
        Ok((rx, tx))
    }
}