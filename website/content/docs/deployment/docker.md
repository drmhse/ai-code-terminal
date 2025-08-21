---
title: "Docker Deployment"
description: "Complete Docker deployment guide with security hardening and production configuration"
weight: 10
layout: "docs"
---

# Docker Deployment

AI Code Terminal is designed for containerized deployment with Docker. This guide covers production Docker deployment with security hardening, volume management, and orchestration.

## Docker Architecture

### Container Design

The application uses a security-hardened Docker container with:

- **Base Image:** Node.js 20 Alpine Linux
- **Non-root User:** Runs as `claude` user (UID 1001)
- **Read-only Root Filesystem:** Enhanced security
- **Resource Limits:** Memory and CPU constraints
- **Health Checks:** Built-in health monitoring

### Security Features

- **Minimal Attack Surface:** Alpine Linux base
- **No New Privileges:** Prevents privilege escalation
- **Dropped Capabilities:** Minimal required capabilities
- **Non-root Execution:** All processes run as non-root user
- **Temporary File Systems:** Writable areas in tmpfs

## Dockerfile Overview

### Multi-stage Build

**`Dockerfile`:**

```dockerfile
# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    openssh-client

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    sqlite \
    curl \
    dumb-init && \
    # Install Claude Code globally
    npm install -g @anthropic/claude-code && \
    npm cache clean --force

# Create non-root user
RUN adduser -D -s /bin/bash -u 1001 claude

# Set working directory
WORKDIR /app

# Copy application files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY . .

# Create necessary directories
RUN mkdir -p data workspaces && \
    chown -R claude:claude /app

# Copy initialization script
COPY init.sh /usr/local/bin/init.sh
RUN chmod +x /usr/local/bin/init.sh

# Switch to non-root user
USER claude

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3014/health || exit 1

# Expose port
EXPOSE 3014

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/usr/local/bin/init.sh"]
```

### Initialization Script

**`init.sh`:**

```bash
#!/bin/bash
set -e

# Ensure proper permissions
echo "Setting up permissions..."
chmod -R 755 /app/workspaces 2>/dev/null || true
chmod 644 /app/data/database.db 2>/dev/null || true

# Initialize database if needed
if [ ! -f "/app/data/database.db" ]; then
    echo "Initializing database..."
    cd /app && npx prisma db push --schema=./prisma/schema.prisma
fi

# Start the application
echo "Starting AI Code Terminal..."
cd /app && node server.js
```

## Docker Compose Configuration

### Production Compose File

**`docker-compose.yml`:**

```yaml
version: '3.8'

services:
  ai-code-terminal:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: ai-code-terminal
    restart: unless-stopped
    
    # Security settings
    security_opt:
      - no-new-privileges:true
    read_only: true
    cap_drop:
      - ALL
    cap_add:
      - SETUID
      - SETGID
    
    # Resource limits
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 1G
          cpus: '0.5'
    
    # Environment variables
    environment:
      - NODE_ENV=production
      - PORT=3014
    
    env_file:
      - .env
    
    # Port mapping
    ports:
      - "3014:3014"
    
    # Volume mounts
    volumes:
      # Persistent data
      - claude_data:/app/data
      - claude_workspaces:/app/workspaces
      - claude_home:/home/claude
      
      # Writable temporary directories
      - type: tmpfs
        target: /tmp
        tmpfs:
          size: 100M
      - type: tmpfs
        target: /app/logs
        tmpfs:
          size: 50M
    
    # Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3014/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    
    # Logging configuration
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

# Named volumes for persistence
volumes:
  claude_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data
  
  claude_workspaces:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./workspaces
  
  claude_home:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./home

networks:
  default:
    driver: bridge
```

### Development Compose Override

**`docker-compose.override.yml`:**

```yaml
version: '3.8'

services:
  ai-code-terminal:
    # Development overrides
    environment:
      - NODE_ENV=development
      - DEBUG=ai-code-terminal:*
    
    # Development volume mounts
    volumes:
      - .:/app
      - /app/node_modules
      - claude_data_dev:/app/data
      - claude_workspaces_dev:/app/workspaces
    
    # Development port (optional)
    ports:
      - "3015:3014"
    
    # Disable read-only for development
    read_only: false
    
    # Development command
    command: ["npm", "run", "dev"]

volumes:
  claude_data_dev:
  claude_workspaces_dev:
```

## Building and Running

### Build Commands

```bash
# Build production image
docker build -t ai-code-terminal:latest .

# Build with specific tag
docker build -t ai-code-terminal:v2.0.0 .

# Build with build args
docker build \
  --build-arg NODE_VERSION=20 \
  -t ai-code-terminal:latest .
```

### Running Containers

```bash
# Run with Docker Compose (recommended)
docker-compose up -d

# Run single container
docker run -d \
  --name ai-code-terminal \
  --restart unless-stopped \
  -p 3014:3014 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/workspaces:/app/workspaces \
  ai-code-terminal:latest

# Run in development mode
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

### Container Management

```bash
# View logs
docker-compose logs -f

# Restart container
docker-compose restart

# Stop and remove
docker-compose down

# Update and restart
docker-compose pull && docker-compose up -d

# Execute commands in container
docker-compose exec ai-code-terminal bash

# View container stats
docker stats ai-code-terminal
```

## Volume Management

### Persistent Volumes

#### Database Volume

```bash
# Create data directory
mkdir -p ./data
chmod 755 ./data

# Initialize database
docker-compose exec ai-code-terminal npx prisma db push
```

#### Workspace Volume

```bash
# Create workspaces directory
mkdir -p ./workspaces
chmod 755 ./workspaces

# Set proper ownership (if needed)
sudo chown -R 1001:1001 ./workspaces
```

#### Home Directory Volume

```bash
# Create home directory for claude user
mkdir -p ./home
chmod 755 ./home
```

### Volume Backup

```bash
#!/bin/bash
# backup-volumes.sh

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
cp ./data/database.db "$BACKUP_DIR/"

# Backup workspaces
tar -czf "$BACKUP_DIR/workspaces.tar.gz" ./workspaces

# Backup home directory
tar -czf "$BACKUP_DIR/home.tar.gz" ./home

echo "Backup created: $BACKUP_DIR"
```

### Volume Restoration

```bash
#!/bin/bash
# restore-volumes.sh

BACKUP_DIR=$1

if [ -z "$BACKUP_DIR" ]; then
    echo "Usage: $0 <backup_directory>"
    exit 1
fi

# Stop container
docker-compose down

# Restore database
cp "$BACKUP_DIR/database.db" ./data/

# Restore workspaces
tar -xzf "$BACKUP_DIR/workspaces.tar.gz"

# Restore home directory
tar -xzf "$BACKUP_DIR/home.tar.gz"

# Start container
docker-compose up -d

echo "Restore completed from: $BACKUP_DIR"
```

## Environment Configuration

### Production Environment

**`.env.production`:**

```bash
# Production Configuration
NODE_ENV=production
PORT=3014

# Security
JWT_SECRET=production-jwt-secret-minimum-32-characters-cryptographically-secure
TENANT_GITHUB_USERNAME=your-production-github-username

# GitHub OAuth (Production App)
GITHUB_CLIENT_ID=your_production_client_id
GITHUB_CLIENT_SECRET=your_production_client_secret
GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback

# Database
DATABASE_URL=file:/app/data/database.db

# Workspace Configuration
MAX_WORKSPACES_PER_USER=10
WORKSPACE_CLEANUP_DAYS=30

# Logging
LOG_LEVEL=warn
LOG_FORMAT=combined

# CORS (if using separate frontend)
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Health Check
HEALTH_CHECK_INTERVAL=30000
```

### Environment Validation

The container includes environment validation:

```bash
# Check required variables are set
docker-compose exec ai-code-terminal node -e "
const required = ['JWT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'TENANT_GITHUB_USERNAME'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('Missing required environment variables:', missing);
  process.exit(1);
}
console.log('Environment validation passed');
"
```

## Security Hardening

### Container Security

```yaml
# Additional security options in docker-compose.yml
services:
  ai-code-terminal:
    # Security options
    security_opt:
      - no-new-privileges:true
      - seccomp:unconfined  # Only if needed for terminal functionality
    
    # AppArmor/SELinux profiles (if available)
    security_opt:
      - apparmor:docker-default
    
    # User namespace remapping
    userns_mode: host
    
    # PID namespace
    pid: "container:name"
    
    # Network security
    networks:
      - ai_code_network
```

### Network Security

```yaml
# Create custom network
networks:
  ai_code_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
          gateway: 172.20.0.1
    driver_opts:
      com.docker.network.bridge.enable_icc: "false"
      com.docker.network.bridge.enable_ip_masquerade: "true"
```

### Secrets Management

```yaml
# Using Docker secrets (Docker Swarm)
services:
  ai-code-terminal:
    secrets:
      - jwt_secret
      - github_client_secret
    environment:
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - GITHUB_CLIENT_SECRET_FILE=/run/secrets/github_client_secret

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  github_client_secret:
    file: ./secrets/github_client_secret.txt
```

## Health Monitoring

### Health Check Configuration

```dockerfile
# Enhanced health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3014/health/detailed || exit 1
```

### Monitoring Script

```bash
#!/bin/bash
# monitor-container.sh

check_health() {
    local container_name="ai-code-terminal"
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' $container_name)
    
    echo "Container health: $health_status"
    
    if [ "$health_status" != "healthy" ]; then
        echo "Container is unhealthy, checking logs..."
        docker logs --tail 50 $container_name
        
        # Optional: restart if unhealthy
        if [ "$1" = "--restart-on-unhealthy" ]; then
            echo "Restarting unhealthy container..."
            docker-compose restart
        fi
    fi
}

check_health $1
```

### Log Monitoring

```bash
#!/bin/bash
# log-monitor.sh

# Monitor application logs
docker-compose logs -f ai-code-terminal | while read line; do
    # Check for error patterns
    if echo "$line" | grep -q "ERROR\|FATAL"; then
        echo "Error detected: $line" | mail -s "AI Code Terminal Error" admin@yourdomain.com
    fi
    
    # Check for security events
    if echo "$line" | grep -q "Authentication failed\|Unauthorized access"; then
        echo "Security event: $line" >> /var/log/security.log
    fi
done
```

## Performance Optimization

### Resource Optimization

```yaml
# Optimized resource configuration
services:
  ai-code-terminal:
    deploy:
      resources:
        limits:
          memory: 2G      # Reduced from 4G
          cpus: '1.0'     # Reduced from 2.0
        reservations:
          memory: 512M    # Reduced from 1G
          cpus: '0.25'    # Reduced from 0.5
    
    # Optimize for memory usage
    environment:
      - NODE_OPTIONS=--max-old-space-size=1024
```

### Image Optimization

```dockerfile
# Multi-stage build optimizations
FROM node:20-alpine AS builder

# Install only necessary dependencies
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++

# Clean up build dependencies
RUN apk del .build-deps

# Minimize final image
FROM node:20-alpine AS production
COPY --from=builder /app/node_modules ./node_modules
RUN rm -rf /var/cache/apk/*
```

### Cache Optimization

```dockerfile
# Optimize Docker layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application code after dependencies
COPY . .
```

## Troubleshooting Docker Deployment

### Common Issues

**Container Won't Start**
```bash
# Check logs
docker-compose logs ai-code-terminal

# Check environment variables
docker-compose exec ai-code-terminal env | grep -E '^(JWT_SECRET|GITHUB_|NODE_ENV)'

# Verify permissions
docker-compose exec ai-code-terminal ls -la /app/data
```

**Database Connection Issues**
```bash
# Check database file
docker-compose exec ai-code-terminal ls -la /app/data/database.db

# Initialize database manually
docker-compose exec ai-code-terminal npx prisma db push

# Reset database (if needed)
docker-compose exec ai-code-terminal rm /app/data/database.db
docker-compose restart
```

**Permission Issues**
```bash
# Fix volume permissions
sudo chown -R 1001:1001 ./data ./workspaces ./home

# Check container user
docker-compose exec ai-code-terminal whoami
docker-compose exec ai-code-terminal id
```

**Memory Issues**
```bash
# Check container memory usage
docker stats ai-code-terminal

# Increase memory limits
# Edit docker-compose.yml and increase memory limit
docker-compose up -d
```

### Debug Mode

```yaml
# Debug configuration override
services:
  ai-code-terminal:
    environment:
      - NODE_ENV=development
      - DEBUG=*
      - LOG_LEVEL=debug
    
    # Enable interactive debugging
    stdin_open: true
    tty: true
    
    # Override entrypoint for debugging
    entrypoint: ["tail", "-f", "/dev/null"]
```

## Production Checklist

### Pre-deployment

- [ ] Environment variables configured
- [ ] GitHub OAuth app created with production URLs
- [ ] SSL/TLS certificates ready
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Log rotation setup
- [ ] Resource limits appropriate
- [ ] Security hardening applied

### Post-deployment

- [ ] Health checks passing
- [ ] Application accessible
- [ ] Authentication working
- [ ] Terminal sessions functional
- [ ] Workspace creation working
- [ ] Logs being captured
- [ ] Backups running
- [ ] Performance monitoring active

## Next Steps

- **[Production Setup](/docs/deployment/production/):** Complete production deployment guide
- **[Monitoring](/docs/deployment/monitoring/):** Production monitoring setup
- **[Troubleshooting](/docs/troubleshooting/common-issues/):** Common deployment issues