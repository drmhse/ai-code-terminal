---
title: "Rust Performance Tuning"
description: "Advanced performance optimization for the Rust backend"
weight: 16
layout: "docs"
---

# Rust Performance Tuning

Optimize your Rust backend deployment for maximum performance and efficiency. This guide covers advanced tuning techniques, monitoring strategies, and performance optimization best practices.

## Performance Fundamentals

### Key Performance Indicators

**Memory Usage**
- **Target**: <100MB idle memory
- **Per Session**: <3MB additional memory
- **Growth Rate**: Linear scaling with user count

**Throughput Metrics**
- **HTTP Requests**: 8,000-12,000 RPS
- **WebSocket Messages**: 15,000-25,000 MPS
- **Concurrent Connections**: 10,000+ connections

**Latency Targets**
- **P50**: <5ms
- **P95**: <15ms
- **P99**: <30ms

## System Configuration

### Kernel Tuning

```bash
# Add to /etc/sysctl.conf
# Network optimization
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 2000000

# File descriptor limits
fs.file-max = 1000000
fs.inotify.max_user_watches = 524288

# Memory management
vm.swappiness = 10
vm.vfs_cache_pressure = 50
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2
```

### Process Limits

```bash
# Add to /etc/security/limits.conf
act soft nofile 65536
act hard nofile 65536
act soft nproc 32768
act hard nproc 32768
act soft memlock unlimited
act hard memlock unlimited
```

## Runtime Configuration

### Tokio Runtime Tuning

```bash
# Worker thread configuration
export TOKIO_WORKER_THREADS=8

# Global task queue
export TOKIO_GLOBAL_QUEUE_INTERVAL=61

# Blocking thread pool
export TOKIO_BLOCKING_THREADS=512
```

### Database Optimization

```bash
# SQLite performance settings
export SQLITE_PRAGMA_JOURNAL_MODE=WAL
export SQLITE_PRAGMA_SYNCHRONOUS=NORMAL
export SQLITE_PRAGMA_CACHE_SIZE=10000
export SQLITE_PRAGMA_TEMP_STORE=MEMORY
export SQLITE_PRAGMA_MMAP_SIZE=268435456
```

### Connection Pool Settings

```bash
# Database connection pool
export ACT_DATABASE_MAX_CONNECTIONS=20
export ACT_DATABASE_MIN_CONNECTIONS=5
export ACT_DATABASE_ACQUIRE_TIMEOUT=3
export ACT_DATABASE_IDLE_TIMEOUT=300
export ACT_DATABASE_MAX_LIFETIME=1800
```

## Memory Optimization

### Allocation Strategies

```rust
// Use arena allocation for session data
use bumpalo::Bump;

pub struct SessionArena {
    arena: Bump,
    sessions: Vec<SessionData>,
}

impl SessionArena {
    pub fn new_session(&mut self) -> &mut SessionData {
        self.arena.alloc(SessionData::new())
    }
}
```

### Buffer Management

```rust
// Reuse buffers for terminal data
pub struct BufferPool {
    buffers: Slab<BytesMut>,
    max_size: usize,
}

impl BufferPool {
    pub fn get_buffer(&mut self) -> BytesMut {
        if let Some(idx) = self.buffers.vacant_entry() {
            let mut buffer = BytesMut::with_capacity(8192);
            idx.insert(buffer);
        }
        // Return buffer from pool
    }
}
```

### String Optimization

```rust
// Use SmallVec for small strings
use smallvec::SmallVec;

pub type CommandBuffer = SmallVec<[u8; 128]>;

pub fn process_command(cmd: CommandBuffer) -> Result<()> {
    // Efficient handling of small commands
    // No heap allocation for commands < 128 bytes
}
```

## Network Optimization

### HTTP/2 Configuration

```rust
// Configure HTTP/2 for better performance
let http2 = Http2Config::default()
    .max_frame_size(1024 * 1024)
    .max_header_list_size(16 * 1024)
    .max_concurrent_streams(1000)
    .initial_window_size(1024 * 1024)
    .initial_connection_window_size(10 * 1024 * 1024);
```

### WebSocket Optimization

```rust
// Optimize WebSocket message handling
pub struct WebSocketConfig {
    pub max_message_size: usize,
    pub max_frame_size: usize,
    pub write_buffer_size: usize,
    pub nodelay: bool,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            max_message_size: 64 * 1024,  // 64KB messages
            max_frame_size: 16 * 1024,     // 16KB frames
            write_buffer_size: 128 * 1024, // 128KB buffer
            nodelay: true,                 // Disable Nagle's algorithm
        }
    }
}
```

### TCP Optimization

```rust
// Configure TCP socket options
pub fn configure_tcp_socket(socket: &TcpStream) -> Result<()> {
    socket.set_nodelay(true)?;           // Disable Nagle's algorithm
    socket.set_reuse_address(true)?;     // Allow address reuse
    socket.set_reuse_port(true)?;        // Allow port reuse
    socket.set_linger(Some(Duration::from_secs(0)))?; // Don't linger on close
    
    // Set buffer sizes
    socket.set_send_buffer_size(256 * 1024)?;  // 256KB send buffer
    socket.set_recv_buffer_size(256 * 1024)?;  // 256KB recv buffer
    
    Ok(())
}
```

## Database Performance

### Query Optimization

```rust
// Use prepared statements for performance
pub async fn get_user_sessions(pool: &SqlitePool, user_id: &str) -> Result<Vec<Session>> {
    let sessions = sqlx::query_as!(
        Session,
        "SELECT * FROM sessions WHERE user_id = ?1 AND status = 'active' ORDER BY last_activity_at DESC",
        user_id
    )
    .fetch_all(pool)
    .await?;
    
    Ok(sessions)
}
```

### Batch Operations

```rust
// Batch insert for better performance
pub async fn batch_insert_metrics(
    pool: &SqlitePool,
    metrics: Vec<Metric>,
) -> Result<()> {
    let mut tx = pool.begin().await?;
    
    for metric in metrics {
        sqlx::query!(
            "INSERT INTO metrics (session_id, metric_type, value, timestamp) VALUES (?, ?, ?, ?)",
            metric.session_id,
            metric.metric_type,
            metric.value,
            metric.timestamp
        )
        .execute(&mut *tx)
        .await?;
    }
    
    tx.commit().await?;
    Ok(())
}
```

### Index Optimization

```sql
-- Optimize indexes for common queries
CREATE INDEX idx_sessions_user_active ON sessions(user_id, status, last_activity_at);
CREATE INDEX idx_sessions_workspace_status ON sessions(workspace_id, status);
CREATE INDEX idx_metrics_session_time ON metrics(session_id, timestamp);
CREATE INDEX idx_processes_session ON user_processes(session_id, status);
```

## Terminal Performance

### PTY Optimization

```rust
// Optimize PTY operations
pub struct PtyConfig {
    pub buffer_size: usize,
    pub flush_interval: Duration,
    pub compression_enabled: bool,
}

impl PtyConfig {
    pub fn optimized() -> Self {
        Self {
            buffer_size: 64 * 1024,  // 64KB buffer
            flush_interval: Duration::from_millis(10),
            compression_enabled: true,
        }
    }
}
```

### Session Management

```rust
// Efficient session cleanup
pub async fn cleanup_expired_sessions(pool: &SqlitePool) -> Result<u64> {
    let result = sqlx::query!(
        "DELETE FROM sessions WHERE status = 'terminated' AND ended_at < datetime('now', '-1 hour')"
    )
    .execute(pool)
    .await?;
    
    Ok(result.rows_affected())
}
```

## Monitoring and Metrics

### Performance Metrics

```rust
#[derive(Debug, Serialize)]
pub struct PerformanceMetrics {
    pub active_connections: u64,
    pub messages_per_second: f64,
    pub average_latency_ms: f64,
    pub memory_usage_mb: f64,
    pub cpu_usage_percent: f64,
    pub database_connections: u32,
    pub active_sessions: u64,
    pub error_rate: f64,
}

impl PerformanceMetrics {
    pub async fn collect() -> Self {
        // Collect system metrics
        let memory_usage = get_memory_usage();
        let cpu_usage = get_cpu_usage();
        let active_connections = get_active_connections();
        
        Self {
            active_connections,
            messages_per_second: calculate_message_rate(),
            average_latency_ms: calculate_average_latency(),
            memory_usage_mb: memory_usage as f64 / 1024.0 / 1024.0,
            cpu_usage_percent: cpu_usage,
            database_connections: get_db_connection_count(),
            active_sessions: get_active_session_count(),
            error_rate: calculate_error_rate(),
        }
    }
}
```

### Real-time Monitoring

```rust
// Performance monitoring service
pub struct MonitoringService {
    metrics: Arc<RwLock<PerformanceMetrics>>,
    alert_thresholds: AlertThresholds,
}

impl MonitoringService {
    pub async fn monitor_performance(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        
        loop {
            interval.tick().await;
            
            let metrics = PerformanceMetrics::collect().await;
            *self.metrics.write().await = metrics.clone();
            
            // Check for performance issues
            self.check_performance_thresholds(&metrics).await;
        }
    }
    
    async fn check_performance_thresholds(&self, metrics: &PerformanceMetrics) {
        if metrics.memory_usage_mb > 500.0 {
            warn!("High memory usage: {} MB", metrics.memory_usage_mb);
        }
        
        if metrics.cpu_usage_percent > 80.0 {
            warn!("High CPU usage: {}%", metrics.cpu_usage_percent);
        }
        
        if metrics.average_latency_ms > 50.0 {
            warn!("High latency: {} ms", metrics.average_latency_ms);
        }
    }
}
```

## Load Testing

### Benchmark Configuration

```rust
// Load testing configuration
pub struct LoadTestConfig {
    pub concurrent_users: u32,
    pub duration: Duration,
    pub ramp_up_time: Duration,
    pub think_time: Duration,
}

impl LoadTestConfig {
    pub fn realistic() -> Self {
        Self {
            concurrent_users: 1000,
            duration: Duration::from_secs(300),
            ramp_up_time: Duration::from_secs(60),
            think_time: Duration::from_millis(100),
        }
    }
}
```

### Performance Testing

```rust
// Terminal load test
pub async fn terminal_load_test(config: LoadTestConfig) -> Result<TestResults> {
    let mut handles = Vec::new();
    let start_time = Instant::now();
    
    for i in 0..config.concurrent_users {
        let handle = tokio::spawn(async move {
            let mut client = TerminalClient::new().await?;
            
            // Simulate user session
            client.connect().await?;
            client.create_terminal().await?;
            
            // Send commands with think time
            for _ in 0..100 {
                client.send_command("ls -la").await?;
                tokio::time::sleep(config.think_time).await;
            }
            
            client.disconnect().await?;
            Ok::<(), Error>(())
        });
        
        handles.push(handle);
        
        // Ramp up users
        tokio::time::sleep(config.ramp_up_time / config.concurrent_users).await;
    }
    
    // Wait for all tests to complete
    for handle in handles {
        handle.await??;
    }
    
    let duration = start_time.elapsed();
    Ok(TestResults { duration })
}
```

## Production Tuning

### Resource Allocation

```bash
# Docker resource limits
docker run -d \
  --name act-server \
  --memory=1g \
  --memory-swap=2g \
  --cpus=2.0 \
  --pids-limit=1000 \
  -p 3001:3001 \
  act-server-rust
```

### Systemd Service Tuning

```ini
# /etc/systemd/system/act-server.service
[Unit]
Description=AI Code Terminal Rust Server
After=network.target

[Service]
Type=simple
User=act
WorkingDirectory=/opt/act
EnvironmentFile=/opt/act/.env
ExecStart=/opt/act/rust/backend/target/release/act-server
Restart=always
RestartSec=10

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768
MemoryMax=1G
MemorySwapMax=2G
CPUQuota=200%

# Performance tuning
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/act/data
ReadWritePaths=/opt/act/workspaces

[Install]
WantedBy=multi-user.target
```

### Reverse Proxy Optimization

```nginx
# Nginx configuration for performance
upstream act_backend {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # HTTP/2 support
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Performance optimizations
    client_max_body_size 10M;
    client_body_timeout 30s;
    client_header_timeout 30s;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Connection handling
    location / {
        proxy_pass http://act_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
}
```

## Performance Monitoring

### Prometheus Integration

```rust
// Prometheus metrics
use prometheus::{Counter, Histogram, Gauge};

lazy_static! {
    static ref HTTP_REQUESTS_TOTAL: Counter = Counter::new(
        "act_http_requests_total",
        "Total HTTP requests"
    ).unwrap();
    
    static ref HTTP_REQUEST_DURATION: Histogram = Histogram::new(
        "act_http_request_duration_seconds",
        "HTTP request duration"
    ).unwrap();
    
    static ref ACTIVE_CONNECTIONS: Gauge = Gauge::new(
        "act_active_connections",
        "Active connections"
    ).unwrap();
    
    static ref MEMORY_USAGE: Gauge = Gauge::new(
        "act_memory_usage_bytes",
        "Memory usage in bytes"
    ).unwrap();
}
```

### Grafana Dashboard

Create a Grafana dashboard with these panels:

1. **System Resources**
   - CPU usage percentage
   - Memory usage (absolute and percentage)
   - Disk I/O operations
   - Network traffic

2. **Application Metrics**
   - Active connections
   - Request rate (RPS)
   - Response latency (P50, P95, P99)
   - Error rate percentage

3. **Database Performance**
   - Connection pool usage
   - Query execution time
   - Transaction rate
   - Cache hit ratio

4. **Terminal Metrics**
   - Active sessions
   - Terminal operations per second
   - Session duration distribution
   - PTY process count

This comprehensive performance tuning guide will help you optimize your Rust backend deployment for maximum performance, efficiency, and scalability in production environments.