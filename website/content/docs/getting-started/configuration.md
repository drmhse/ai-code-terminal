---
title: "Configuration"
description: "Complete environment configuration guide with all available options"
weight: 50
layout: "docs"
---

# Configuration

Configure your AI Code Terminal instance using environment variables. This guide covers all available configuration options and best practices.

## Environment File Setup

Copy the example environment file and customize it:

```bash
cp env.example .env
```

## Required Environment Variables

These variables must be configured before the application will start:

### GitHub OAuth Configuration

```bash
# GitHub OAuth Application Credentials
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# OAuth callback URL (must match GitHub app settings)
GITHUB_CALLBACK_URL=http://localhost:3014/auth/github/callback
```

### Security Configuration

```bash
# JWT token signing secret (minimum 32 characters for production)
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long

# Single authorized GitHub username (only this user can access)
TENANT_GITHUB_USERNAME=your-github-username
```

## Optional Environment Variables

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3014` | HTTP server port |
| `NODE_ENV` | `development` | Environment mode (development/production) |
| `HOST` | `0.0.0.0` | Server bind address |

```bash
# Server settings
PORT=3014
NODE_ENV=development
HOST=0.0.0.0
```

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./data/database.db` | SQLite database file path |

```bash
# Database
DATABASE_URL=file:./data/database.db
```

### Workspace Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE_CLEANUP_DAYS` | `30` | Days before inactive workspace cleanup |

```bash
# Workspace limits
WORKSPACE_CLEANUP_DAYS=30
```

### CORS Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | - | Separate frontend deployment URL |
| `ALLOWED_ORIGINS` | - | Additional CORS origins (comma-separated) |

```bash
# CORS settings
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |
| `LOG_MAX_SIZE` | `20m` | Maximum size per log file |
| `LOG_MAX_FILES` | `30d` | Maximum age of log files |
| `LOG_COMPRESS` | `true` | Compress rotated log files |

```bash
# Logging settings
LOG_LEVEL=info
LOG_MAX_SIZE=20m
LOG_MAX_FILES=30d
LOG_COMPRESS=true
```

## Complete Configuration Example

Here's a complete `.env` file example:

```bash
#########################################
# AI Code Terminal Configuration
#########################################

# Required - GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:3014/auth/github/callback

# Required - Security & Single-Tenant
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
TENANT_GITHUB_USERNAME=your-github-username

# Optional - Server
PORT=3014
NODE_ENV=production

# Optional - Database
DATABASE_URL=file:./data/database.db

# Optional - Workspace Management
WORKSPACE_CLEANUP_DAYS=30

# Optional - CORS
FRONTEND_URL=http://localhost:8080
ALLOWED_ORIGINS=https://deploy-preview-123--your-app.netlify.app

# Optional - Logging
LOG_LEVEL=info
LOG_MAX_SIZE=20m
LOG_MAX_FILES=30d
LOG_COMPRESS=true
```

## Environment-Specific Configuration

### Development Environment

```bash
NODE_ENV=development
PORT=3014
LOG_LEVEL=debug
GITHUB_CALLBACK_URL=http://localhost:3014/auth/github/callback
```

### Production Environment

```bash
NODE_ENV=production
PORT=3014
LOG_LEVEL=warn
GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback
JWT_SECRET=production-secure-secret-at-least-32-characters
```

### Docker Environment

When running in Docker, some paths may need adjustment:

```bash
# Docker-specific paths
DATABASE_URL=file:./data/database.db
WORKSPACE_ROOT=/app/workspaces
```

## Configuration Validation

The application validates configuration on startup:

### JWT Secret Validation
- Must be at least 32 characters in production
- Should use cryptographically secure random values
- Different secrets for different environments

### GitHub OAuth Validation
- Client ID and secret must be provided
- Callback URL must match GitHub app configuration
- Tenant username must be a valid GitHub username

### Generate Secure Values

Generate secure JWT secrets:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64

# Using uuidgen (macOS/Linux)
uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]'
```

## Configuration Best Practices

### Security Best Practices
1. **Never commit `.env` files** to version control
2. **Use different secrets** for different environments
3. **Rotate secrets regularly** in production
4. **Use strong, random values** for JWT secrets
5. **Restrict CORS origins** in production

### Environment Management
1. **Use separate `.env` files** for different environments
2. **Document all variables** and their purposes
3. **Validate configuration** before deployment
4. **Use environment variable injection** in CI/CD
5. **Monitor configuration changes** in production

### Docker Configuration
1. **Use environment variables** instead of build-time configuration
2. **Mount configuration files** as volumes when possible
3. **Use Docker secrets** for sensitive values
4. **Separate configuration** from application code

## Troubleshooting Configuration

### Common Configuration Issues

**Application Won't Start**
- Check all required variables are set
- Verify JWT secret length (32+ characters in production)
- Ensure GitHub OAuth credentials are correct

**Authentication Fails**
- Verify `TENANT_GITHUB_USERNAME` matches your GitHub username exactly
- Check GitHub OAuth callback URL matches configuration
- Ensure GitHub OAuth app is active and not suspended

**Database Issues**
- Check `DATABASE_URL` path is writable
- Ensure parent directories exist
- Verify SQLite file permissions

### Environment Validation

The application provides detailed error messages for configuration issues. Check the startup logs for specific validation failures.

## Next Steps

- **[Terminal Multiplexing](/docs/core-features/terminal-multiplexing/):** Start using the terminal interface
- **[GitHub Integration](/docs/core-features/github-integration/):** Set up repository access
- **[Docker Deployment](/docs/deployment/docker/):** Deploy to production