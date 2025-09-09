---
title: "Rust Migration Guide"
description: "Step-by-step guide for migrating from Node.js to Rust backend"
weight: 73
layout: "docs"
---

# Rust Migration Guide

This comprehensive guide provides detailed instructions for migrating from the Node.js backend to the high-performance Rust implementation. Follow these steps to ensure a smooth transition with minimal downtime.

## Prerequisites

### System Requirements
- **Rust**: 1.70+ stable toolchain
- **Database**: Existing SQLite database from Node.js version
- **Dependencies**: OpenSSL development libraries
- **Memory**: Minimum 512MB RAM for Rust backend
- **Storage**: 50MB additional space for Rust binaries

### Backup Requirements
```bash
# Backup existing database
cp data/act.db data/act.db.backup.$(date +%Y%m%d_%H%M%S)

# Backup configuration files
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Backup workspace data
tar -czf workspaces_backup_$(date +%Y%m%d_%H%M%S).tar.gz workspaces/
```

## Migration Process

### Phase 1: Preparation

#### 1. Install Rust Toolchain
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Configure Rust environment
source ~/.cargo/env

# Install additional components
rustup component add clippy rustfmt
rustup target add x86_64-unknown-linux-musl
```

#### 2. Set Up Build Environment
```bash
# Install system dependencies
# Ubuntu/Debian
sudo apt-get install -y build-essential pkg-config libssl-dev

# CentOS/RHEL
sudo yum install -y gcc pkgconfig openssl-devel

# macOS
brew install openssl pkg-config
```

#### 3. Prepare Rust Project
```bash
# Navigate to Rust backend directory
cd rust/backend

# Install dependencies
cargo build --release

# Run tests to verify build
cargo test --release
```

### Phase 2: Configuration Migration

#### 1. Environment Variables
```bash
# Create new .env file for Rust backend
cat > .env << EOF
# Server Configuration
ACT_SERVER_HOST=0.0.0.0
ACT_SERVER_PORT=3001

# Database Configuration
ACT_DATABASE_URL=sqlite:./data/act.db
ACT_DATABASE_MAX_CONNECTIONS=10

# Authentication Configuration
ACT_AUTH_JWT_SECRET=$(openssl rand -hex 32)
ACT_AUTH_GITHUB_CLIENT_ID=your-github-oauth-app-client-id
ACT_AUTH_GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
ACT_AUTH_GITHUB_REDIRECT_URL=http://localhost:3001/auth/callback
ACT_AUTH_TENANT_GITHUB_USERNAME=your-github-username

# CORS Configuration
ACT_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
ACT_CORS_ALLOWED_HEADERS=content-type,authorization,x-requested-with

# Logging Configuration
RUST_LOG=act_server=info,tower_http=info
EOF
```

#### 2. Configuration Validation
```bash
# Test configuration loading
cargo run --bin act-server -- --validate-config

# Expected output:
# Configuration validation successful
# All required environment variables are present
```

### Phase 3: Database Migration

#### 1. Database Schema Validation
```bash
# Run database migrations
cargo run --bin act-server -- --migrate-database

# Verify migration success
sqlite3 data/act.db ".schema sessions" | head -5
# Should show updated schema with recovery_token and other new fields
```

#### 2. Data Compatibility Check
```bash
# Run data validation script
cargo run --bin validate-database

# Check for any data issues
sqlite3 data/act.db "SELECT COUNT(*) FROM sessions;"
sqlite3 data/act.db "SELECT COUNT(*) FROM workspaces;"
sqlite3 data/act.db "SELECT COUNT(*) FROM user_processes;"
```

### Phase 4: Deployment Strategy

#### 1. Side-by-Side Deployment
```bash
# Stop Node.js server
pm2 stop act-server

# Start Rust backend in test mode
cargo run --release -- --port 3002

# Test Rust backend with existing database
curl http://localhost:3002/health
```

#### 2. Production Deployment
```bash
# Create systemd service
sudo tee /etc/systemd/system/act-server-rust.service > /dev/null << EOF
[Unit]
Description=AI Code Terminal Rust Server
After=network.target

[Service]
Type=simple
User=act
WorkingDirectory=/opt/act
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=RUST_LOG=act_server=info
ExecStart=/opt/act/rust/backend/target/release/act-server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable act-server-rust
sudo systemctl start act-server-rust
```

### Phase 5: Verification

#### 1. Health Checks
```bash
# Check service status
sudo systemctl status act-server-rust

# Verify API endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/v1/status

# Check WebSocket connectivity
wscat -c ws://localhost:3001/socket.io/
```

#### 2. Performance Validation
```bash
# Monitor resource usage
htop
df -h

# Test terminal functionality
# Open web interface and create new terminal session
# Verify all features work correctly
```

## Configuration Reference

### Environment Variables

#### Server Configuration
```bash
# Server binding
ACT_SERVER_HOST=0.0.0.0                    # Bind address
ACT_SERVER_PORT=3001                      # Port number

# Static files (optional)
ACT_SERVER_STATIC_FILES=/path/to/static   # Static file directory
```

#### Database Configuration
```bash
# Database settings
ACT_DATABASE_URL=sqlite:./data/act.db      # Database URL
ACT_DATABASE_MAX_CONNECTIONS=10            # Max connections
```

#### Authentication Configuration
```bash
# JWT settings
ACT_AUTH_JWT_SECRET=your-secret-key       # JWT secret (min 32 chars)

# GitHub OAuth
ACT_AUTH_GITHUB_CLIENT_ID=your-client-id   # GitHub app client ID
ACT_AUTH_GITHUB_CLIENT_SECRET=your-secret # GitHub app client secret
ACT_AUTH_GITHUB_REDIRECT_URL=your-url     # OAuth redirect URL

# Tenant configuration
ACT_AUTH_TENANT_GITHUB_USERNAME=user1,user2 # Authorized usernames
```

#### Security Configuration
```bash
# CORS settings
ACT_CORS_ALLOWED_ORIGINS=http://localhost:5173  # Allowed origins
ACT_CORS_ALLOWED_HEADERS=content-type,authorization # Allowed headers

# Rate limiting
ACT_RATE_LIMIT_REQUESTS_PER_MINUTE=60       # Rate limit
ACT_RATE_LIMIT_BURST=10                   # Burst capacity
```

### Configuration File (Optional)

For complex deployments, you can use a TOML configuration file:

```toml
[server]
host = "0.0.0.0"
port = 3001
static_files = "/opt/act/static"

[database]
url = "sqlite:/opt/act/data/act.db"
max_connections = 10

[auth]
jwt_secret = "your-secret-key"
github_client_id = "your-client-id"
github_client_secret = "your-secret"
github_redirect_url = "http://localhost:3001/auth/callback"
tenant_github_usernames = ["user1", "user2"]

[cors]
allowed_origins = ["http://localhost:5173"]
allowed_headers = ["content-type", "authorization"]
```

## Troubleshooting

### Common Issues

#### 1. Database Migration Failures
```bash
# Error: "Migration failed: table already exists"
# Solution: Check if migrations already ran
sqlite3 data/act.db "SELECT name FROM sqlite_master WHERE type='table';"

# If migrations table exists, verify schema
sqlite3 data/act.db ".schema"
```

#### 2. Permission Issues
```bash
# Error: "Permission denied"
# Solution: Check file permissions
ls -la data/act.db
chmod 644 data/act.db
chown act:act data/act.db
```

#### 3. Port Conflicts
```bash
# Error: "Address already in use"
# Solution: Check what's using the port
sudo lsof -i :3001
sudo netstat -tulpn | grep :3001

# Kill conflicting process if necessary
sudo kill -9 <PID>
```

#### 4. Memory Issues
```bash
# Error: "Out of memory"
# Solution: Adjust system limits
sysctl vm.overcommit_memory=1
echo 1 > /proc/sys/vm/overcommit_memory

# Or adjust Rust memory limits
export RUST_MIN_STACK=8388608  # 8MB stack
```

### Debug Mode

Enable debug logging for troubleshooting:
```bash
# Set debug logging
export RUST_LOG=act_server=debug,tower_http=debug,sqlx=debug

# Run with debug output
cargo run --release

# Or for systemd service
sudo systemctl edit act-server-rust
# Add:
# [Service]
# Environment=RUST_LOG=act_server=debug
```

### Performance Tuning

#### 1. Database Optimization
```bash
# Enable WAL mode for better performance
sqlite3 data/act.db "PRAGMA journal_mode=WAL;"
sqlite3 data/act.db "PRAGMA synchronous=NORMAL;"
sqlite3 data/act.db "PRAGMA cache_size=10000;"
```

#### 2. Connection Pool Tuning
```bash
# Adjust connection pool size
export ACT_DATABASE_MAX_CONNECTIONS=20

# Monitor connection usage
sqlite3 data/act.db "SELECT COUNT(*) FROM sessions;"
```

#### 3. Worker Thread Configuration
```bash
# Set number of worker threads
export TOKIO_WORKER_THREADS=4

# Monitor CPU usage
top -p $(pgrep act-server)
```

## Rollback Procedure

If you need to rollback to the Node.js version:

```bash
# Stop Rust server
sudo systemctl stop act-server-rust

# Restore database from backup
cp data/act.db.backup data/act.db

# Start Node.js server
pm2 start act-server

# Verify functionality
curl http://localhost:3001/health
```

## Monitoring and Maintenance

### Health Checks

Implement health checks in your monitoring system:

```bash
# Health check endpoint
curl http://localhost:3001/health

# Detailed status
curl http://localhost:3001/api/v1/status

# Metrics endpoint
curl http://localhost:3001/api/v1/metrics
```

### Log Management

Configure log rotation:

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/act-server > /dev/null << EOF
/var/log/act-server/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 act act
}
EOF
```

### Performance Monitoring

Monitor key metrics:

```bash
# Memory usage
ps aux | grep act-server

# CPU usage
top -p $(pgrep act-server)

# Network connections
netstat -an | grep :3001

# Database performance
sqlite3 data/act.db "PRAGMA cache_status;"
```

## Advanced Configuration

### SSL/TLS Setup

For production deployments with HTTPS:

```bash
# Generate SSL certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Configure Rust server with SSL
export ACT_SERVER_SSL_CERT=/path/to/cert.pem
export ACT_SERVER_SSL_KEY=/path/to/key.pem
```

### Reverse Proxy Configuration

Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Docker Deployment

Dockerfile for Rust backend:

```dockerfile
FROM rust:1.70-slim as builder

WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/act-server /usr/local/bin/

EXPOSE 3001
CMD ["act-server"]
```

This migration guide provides a comprehensive approach to transitioning from Node.js to Rust while maintaining data integrity and minimizing service disruption. The Rust backend offers significant performance improvements and enhanced security for production deployments.