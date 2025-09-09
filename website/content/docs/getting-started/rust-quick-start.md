---
title: "Rust Quick Start"
description: "Quick start guide for deploying and using the Rust backend"
weight: 15
layout: "docs"
---

# Rust Quick Start

Get up and running with the high-performance Rust backend in minutes. This guide covers deployment, configuration, and basic usage of the new Rust implementation.

## Installation

### System Requirements

- **Rust**: 1.70+ stable toolchain
- **Memory**: 512MB minimum RAM
- **Storage**: 100MB available space
- **Database**: Existing SQLite database (optional)

### Quick Install

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Clone the repository
git clone https://github.com/drmhse/ai-code-terminal.git
cd ai-code-terminal/rust/backend

# Build the Rust backend
cargo build --release

# Run tests to verify
cargo test --release
```

## Configuration

### Environment Setup

```bash
# Create environment file
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

### GitHub OAuth Setup

1. **Create GitHub OAuth App**
   - Go to GitHub Settings → Developer Settings → OAuth Apps
   - Click "New OAuth App"
   - Set Homepage URL: `http://localhost:3001`
   - Set Authorization callback URL: `http://localhost:3001/auth/callback`
   - Note the Client ID and generate Client Secret

2. **Configure Environment**
   ```bash
   # Update your .env file with GitHub credentials
   export ACT_AUTH_GITHUB_CLIENT_ID="your-client-id"
   export ACT_AUTH_GITHUB_CLIENT_SECRET="your-client-secret"
   export ACT_AUTH_TENANT_GITHUB_USERNAME="your-github-username"
   ```

## Deployment

### Development Mode

```bash
# Start the Rust backend
cargo run --release

# Or with debug logging
RUST_LOG=act_server=debug cargo run --release
```

### Production Deployment

```bash
# Create systemd service
sudo tee /etc/systemd/system/act-server.service > /dev/null << EOF
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

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable act-server
sudo systemctl start act-server
```

### Docker Deployment

```bash
# Build Docker image
docker build -t act-server-rust .

# Run container
docker run -d \
  --name act-server \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/workspaces:/app/workspaces \
  --env-file .env \
  act-server-rust
```

## First Run

### Database Initialization

```bash
# Run database migrations
cargo run --release -- --migrate-database

# Verify database setup
sqlite3 data/act.db ".tables"
```

### Health Check

```bash
# Check server health
curl http://localhost:3001/health

# Expected response:
# {"status":"healthy","version":"1.0.0","backend":"rust","database":"connected"}
```

### Web Interface Access

Open your browser and navigate to `http://localhost:3001`. You should see the AI Code Terminal login page.

## Basic Usage

### Authentication

1. **Click "Login with GitHub"**
2. **Authorize the OAuth application**
3. **You'll be redirected back to the terminal interface**

### Creating Workspaces

```bash
# Clone a repository
git clone https://github.com/username/repository.git

# Or use the web interface to clone repositories
```

### Terminal Operations

1. **Create New Terminal**
   - Click the "+" button in the terminal tab bar
   - Select your workspace
   - Terminal opens automatically

2. **Terminal Multiplexing**
   - Use tabs for multiple terminals
   - Split panes for side-by-side views
   - Each terminal runs in its own isolated environment

3. **File Operations**
   - Use the file explorer sidebar
   - Drag and drop files
   - Right-click for context menus

### Claude Code Integration

```bash
# Login to Claude Code
claude login

# Use ACT CLI for context-aware AI interactions
act context add src/main.js
act do "Explain how this code works"
```

## Configuration Options

### Performance Tuning

```bash
# Adjust connection pool size
export ACT_DATABASE_MAX_CONNECTIONS=20

# Set worker threads
export TOKIO_WORKER_THREADS=4

# Enable database WAL mode
sqlite3 data/act.db "PRAGMA journal_mode=WAL;"
```

### Security Configuration

```bash
# Set strong JWT secret
export ACT_AUTH_JWT_SECRET=$(openssl rand -hex 64)

# Restrict CORS origins
export ACT_CORS_ALLOWED_ORIGINS="https://your-domain.com"

# Enable rate limiting
export ACT_RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

### Logging Configuration

```bash
# Debug logging
export RUST_LOG=act_server=debug,tower_http=debug,sqlx=debug

# Production logging
export RUST_LOG=act_server=info,tower_http=info

# JSON logging for structured analysis
export RUST_LOG_FORMAT=json
```

## Monitoring

### Health Endpoints

```bash
# Basic health check
curl http://localhost:3001/health

# Detailed status
curl http://localhost:3001/api/v1/status

# Performance metrics
curl http://localhost:3001/api/v1/metrics
```

### Log Management

```bash
# View logs
journalctl -u act-server -f

# Filter by component
journalctl -u act-server | grep act_server

# View error logs
journalctl -u act-server -p err
```

### Performance Monitoring

```bash
# Monitor resource usage
ps aux | grep act-server
top -p $(pgrep act-server)

# Check database performance
sqlite3 data/act.db "PRAGMA cache_status;"
sqlite3 data/act.db "PRAGMA journal_mode;"
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using port 3001
sudo lsof -i :3001
sudo netstat -tulpn | grep :3001

# Kill the process if needed
sudo kill -9 <PID>
```

#### Database Permission Issues
```bash
# Fix database permissions
chmod 644 data/act.db
chown $USER:$USER data/act.db
```

#### GitHub OAuth Issues
```bash
# Verify OAuth configuration
echo "Client ID: $ACT_AUTH_GITHUB_CLIENT_ID"
echo "Redirect URL: $ACT_AUTH_GITHUB_REDIRECT_URL"

# Check GitHub OAuth app settings
# Ensure callback URL matches exactly
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Set debug environment
export RUST_LOG=act_server=debug,tower_http=debug,sqlx=debug

# Run with debug output
cargo run --release

# Or for systemd service
sudo systemctl edit act-server
# Add:
# [Service]
# Environment=RUST_LOG=act_server=debug
```

### Performance Issues

```bash
# Monitor memory usage
ps aux | grep act-server

# Check database performance
sqlite3 data/act.db "PRAGMA cache_size;"
sqlite3 data/act.db "PRAGMA synchronous;"

# Optimize database
sqlite3 data/act.db "VACUUM;"
sqlite3 data/act.db "ANALYZE;"
```

## Migration from Node.js

If you're migrating from the Node.js version:

```bash
# Backup existing data
cp data/act.db data/act.db.backup

# Stop Node.js server
pm2 stop act-server

# Start Rust server
cargo run --release

# Verify data migration
sqlite3 data/act.db "SELECT COUNT(*) FROM sessions;"
sqlite3 data/act.db "SELECT COUNT(*) FROM workspaces;"
```

## Next Steps

### Advanced Configuration
- Set up reverse proxy with Nginx
- Configure SSL/TLS for HTTPS
- Set up monitoring and alerting
- Configure backup and recovery

### Production Deployment
- Use Docker containers
- Set up load balancing
- Configure database replication
- Implement disaster recovery

### Integration
- Set up CI/CD pipelines
- Configure automated testing
- Integrate with existing tools
- Set up logging aggregation

The Rust backend provides significant performance improvements and enhanced security while maintaining full compatibility with existing data and workflows. Follow this guide to get started quickly and explore the advanced features for production deployments.