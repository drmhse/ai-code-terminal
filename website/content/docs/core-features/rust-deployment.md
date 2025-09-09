---
title: "Rust Deployment Guide"
description: "Production deployment strategies for the Rust backend"
weight: 76
layout: "docs"
---

# Rust Deployment Guide

Comprehensive deployment strategies for the Rust backend in production environments, covering containerization, orchestration, monitoring, and scaling considerations.

## Deployment Overview

### Deployment Targets

1. **Single Server**: Simple deployment for small teams
2. **Containerized**: Docker-based deployment for consistency
3. **Orchestrated**: Kubernetes for large-scale deployments
4. **Serverless**: Edge deployment for global distribution

### Deployment Requirements

- **Rust 1.70+**: Stable toolchain for compilation
- **OpenSSL**: Development libraries for crypto operations
- **SQLite 3.35+**: Database engine
- **Systemd**: Service management (Linux)
- **Docker**: Container runtime (optional)

## Single Server Deployment

### System Preparation

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install system dependencies
sudo apt-get install -y build-essential pkg-config libssl-dev sqlite3

# Create application user
sudo useradd -r -s /bin/false -m -d /opt/act act
```

### Application Deployment

```bash
# Clone repository
git clone https://github.com/drmhse/ai-code-terminal.git
cd ai-code-terminal/rust/backend

# Build release binary
cargo build --release --target x86_64-unknown-linux-gnu

# Create application directory
sudo mkdir -p /opt/act/{data,workspaces,logs,config}

# Copy binary and files
sudo cp target/x86_64-unknown-linux-gnu/release/act-server /opt/act/
sudo cp -r ../migrations /opt/act/
sudo chown -R act:act /opt/act
```

### Configuration Setup

```bash
# Create environment file
sudo tee /opt/act/.env > /dev/null << EOF
# Server Configuration
ACT_SERVER_HOST=0.0.0.0
ACT_SERVER_PORT=3001

# Database Configuration
ACT_DATABASE_URL=sqlite:/opt/act/data/act.db
ACT_DATABASE_MAX_CONNECTIONS=20

# Authentication Configuration
ACT_AUTH_JWT_SECRET=$(openssl rand -hex 64)
ACT_AUTH_GITHUB_CLIENT_ID=your-github-client-id
ACT_AUTH_GITHUB_CLIENT_SECRET=your-github-client-secret
ACT_AUTH_GITHUB_REDIRECT_URL=https://your-domain.com/auth/callback
ACT_AUTH_TENANT_GITHUB_USERNAME=your-github-username

# CORS Configuration
ACT_CORS_ALLOWED_ORIGINS=https://your-domain.com
ACT_CORS_ALLOWED_HEADERS=content-type,authorization,x-requested-with

# Logging Configuration
RUST_LOG=act_server=info,tower_http=info
EOF

# Set permissions
sudo chmod 600 /opt/act/.env
sudo chown act:act /opt/act/.env
```

### Systemd Service

```bash
# Create systemd service
sudo tee /etc/systemd/system/act-server.service > /dev/null << EOF
[Unit]
Description=AI Code Terminal Rust Server
After=network.target

[Service]
Type=simple
User=act
Group=act
WorkingDirectory=/opt/act
EnvironmentFile=/opt/act/.env
ExecStart=/opt/act/act-server
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/act/data
ReadWritePaths=/opt/act/workspaces
ReadWritePaths=/opt/act/logs

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768
MemoryMax=2G
MemorySwapMax=4G

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable act-server
sudo systemctl start act-server
```

### Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt-get install -y nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/act-server > /dev/null << EOF
upstream act_backend {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Client configuration
    client_max_body_size 10M;
    client_body_timeout 30s;
    client_header_timeout 30s;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Proxy configuration
    location / {
        proxy_pass http://act_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # Static files (if any)
    location /static/ {
        alias /opt/act/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/act-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Containerized Deployment

### Dockerfile

```dockerfile
# Multi-stage build for optimized image size
FROM rust:1.70-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy source files
COPY . .

# Build release binary
RUN cargo build --release --target x86_64-unknown-linux-musl

# Runtime image
FROM debian:bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates sqlite3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -s /bin/false -m -d /app act

# Copy binary from builder
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/act-server /usr/local/bin/

# Copy migrations
COPY --from=builder /app/migrations /app/migrations

# Create directories
RUN mkdir -p /app/{data,workspaces,logs} && chown -R act:act /app

# Switch to non-root user
USER act

# Set working directory
WORKDIR /app

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Run application
CMD ["act-server"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  act-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - ACT_SERVER_HOST=0.0.0.0
      - ACT_SERVER_PORT=3001
      - ACT_DATABASE_URL=sqlite:/app/data/act.db
      - ACT_DATABASE_MAX_CONNECTIONS=20
      - ACT_AUTH_JWT_SECRET=${JWT_SECRET}
      - ACT_AUTH_GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - ACT_AUTH_GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - ACT_AUTH_GITHUB_REDIRECT_URL=${GITHUB_REDIRECT_URL}
      - ACT_AUTH_TENANT_GITHUB_USERNAME=${GITHUB_USERNAME}
      - ACT_CORS_ALLOWED_ORIGINS=${CORS_ORIGINS}
      - RUST_LOG=act_server=info,tower_http=info
    volumes:
      - act_data:/app/data
      - act_workspaces:/app/workspaces
      - act_logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - act-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - act-server
    restart: unless-stopped
    networks:
      - act-network

  # Optional: Redis for session storage
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - act-network

volumes:
  act_data:
  act_workspaces:
  act_logs:
  redis_data:

networks:
  act-network:
    driver: bridge
```

### Environment File

```bash
# .env
JWT_SECRET=your-super-secret-jwt-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URL=https://your-domain.com/auth/callback
GITHUB_USERNAME=your-github-username
CORS_ORIGINS=https://your-domain.com
```

## Kubernetes Deployment

### Kubernetes Manifests

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: act-server
---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: act-config
  namespace: act-server
data:
  ACT_SERVER_HOST: "0.0.0.0"
  ACT_SERVER_PORT: "3001"
  ACT_DATABASE_URL: "sqlite:/data/act.db"
  ACT_DATABASE_MAX_CONNECTIONS: "20"
  ACT_CORS_ALLOWED_ORIGINS: "https://your-domain.com"
  RUST_LOG: "act_server=info,tower_http=info"
---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: act-secrets
  namespace: act-server
type: Opaque
data:
  ACT_AUTH_JWT_SECRET: <base64-encoded-secret>
  ACT_AUTH_GITHUB_CLIENT_ID: <base64-encoded-client-id>
  ACT_AUTH_GITHUB_CLIENT_SECRET: <base64-encoded-client-secret>
  ACT_AUTH_GITHUB_REDIRECT_URL: <base64-encoded-redirect-url>
  ACT_AUTH_TENANT_GITHUB_USERNAME: <base64-encoded-username>
---
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: act-server
  namespace: act-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: act-server
  template:
    metadata:
      labels:
        app: act-server
    spec:
      containers:
      - name: act-server
        image: your-registry/act-server:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: act-config
        - secretRef:
            name: act-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: workspaces
          mountPath: /app/workspaces
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: act-data
      - name: workspaces
        persistentVolumeClaim:
          claimName: act-workspaces
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: act-service
  namespace: act-server
spec:
  selector:
    app: act-server
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP
---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: act-ingress
  namespace: act-server
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: act-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: act-service
            port:
              number: 80
---
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: act-data
  namespace: act-server
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: act-workspaces
  namespace: act-server
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: act-hpa
  namespace: act-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: act-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Monitoring and Logging

### Prometheus Configuration

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: act-server
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'act-server'
      static_configs:
      - targets: ['act-service:80']
      metrics_path: '/metrics'
      scrape_interval: 5s
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "id": null,
    "title": "AI Code Terminal Metrics",
    "tags": ["act-server"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "act_active_connections",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(act_http_requests_total[5m])",
            "legendFormat": "Requests per second"
          }
        ]
      },
      {
        "id": 3,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(act_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95 Response Time"
          }
        ]
      },
      {
        "id": 4,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "act_memory_usage_bytes",
            "legendFormat": "Memory Usage"
          }
        ]
      }
    ]
  }
}
```

### Logging Configuration

```yaml
# fluentd-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: act-server
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*act-server*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      format json
      time_format %Y-%m-%dT%H:%M:%S.%NZ
    </source>
    
    <match kubernetes.**>
      @type elasticsearch
      host elasticsearch
      port 9200
      index_name act-server-logs
      type_name _doc
    </match>
```

## Security Configuration

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: act-network-policy
  namespace: act-server
spec:
  podSelector:
    matchLabels:
      app: act-server
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443
  - to: []
    ports:
    - protocol: TCP
      port: 6379
```

### RBAC Configuration

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: act-server
  namespace: act-server
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: act-server
  namespace: act-server
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: act-server
  namespace: act-server
subjects:
- kind: ServiceAccount
  name: act-server
roleRef:
  kind: Role
  name: act-server
  apiGroup: rbac.authorization.k8s.io
```

## Backup and Recovery

### Backup Script

```bash
#!/bin/bash
# scripts/backup.sh

set -e

BACKUP_DIR="/opt/act/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/act_backup_${DATE}.tar.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Stop service
sudo systemctl stop act-server

# Create backup
tar -czf "$BACKUP_FILE" \
    -C /opt/act data \
    -C /opt/act workspaces \
    -C /opt/act config \
    -C /opt/act .env

# Start service
sudo systemctl start act-server

# Upload to cloud storage (optional)
aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/act-server/

# Clean old backups (keep last 7 days)
find "$BACKUP_DIR" -name "act_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

### Recovery Script

```bash
#!/bin/bash
# scripts/recover.sh

set -e

BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

# Stop service
sudo systemctl stop act-server

# Extract backup
tar -xzf "$BACKUP_FILE" -C /opt/act

# Fix permissions
sudo chown -R act:act /opt/act

# Start service
sudo systemctl start act-server

echo "Recovery completed from: $BACKUP_FILE"
```

This comprehensive deployment guide provides multiple deployment strategies for the Rust backend, from simple single-server deployments to complex Kubernetes orchestrations, ensuring scalability, reliability, and maintainability in production environments.