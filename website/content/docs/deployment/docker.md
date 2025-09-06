---
title: "Installation Guide"
description: "Complete installation guide using Docker for easy deployment"
weight: 10
layout: "docs"
---

# Installation Guide

Get AI Code Terminal running in just a few minutes using Docker. This guide covers everything you need for a secure, production-ready installation.

## Prerequisites

Before you begin, make sure you have:
- Docker and Docker Compose installed on your system
- A GitHub account
- About 10 minutes to complete the setup

## Step 1: Get the Code

Clone the repository and navigate to the application directory:

```bash
git clone https://github.com/drmhse/ai-code-terminal.git
cd ai-coding-terminal/app
```

## Step 2: Set Up GitHub OAuth

You'll need to create a GitHub OAuth application so AI Code Terminal can authenticate you:

### Create GitHub OAuth App

1. Go to your GitHub settings: **Settings > Developer settings > OAuth Apps**
2. Click **"New OAuth App"**
3. Fill out the form:
   - **Application name:** AI Code Terminal (or whatever you prefer)
   - **Homepage URL:** `http://localhost:3014` (or your domain)
   - **Authorization callback URL:** `http://localhost:3014/auth/github/callback`
4. Click **"Register application"**
5. Copy the **Client ID** and generate a **Client Secret**

## Step 3: Configure Environment

Copy the example environment file and add your settings:

```bash
cp env.example .env
```

Edit the `.env` file with your information:

```bash
# Required - GitHub OAuth (from Step 2)
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
TENANT_GITHUB_USERNAME=your-github-username

# Required - Security (generate a secure random string)
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long

# Optional - Server settings
PORT=3014
NODE_ENV=production
```

**Important:** Replace `your-github-username` with your actual GitHub username. Only this user will be able to access your AI Code Terminal instance.

### Generate a Secure JWT Secret

Use one of these commands to generate a secure JWT secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64
```

Copy the output and use it as your `JWT_SECRET`.

## Step 4: Start AI Code Terminal

Launch the application using Docker Compose:

```bash
docker-compose up -d
```

This will:
- Build the Docker container with all dependencies
- Set up secure, isolated volumes for your data
- Start the application on port 3014
- Configure automatic restarts

## Step 5: Access Your Terminal

1. Open your browser to `http://localhost:3014`
2. Click **"Login with GitHub"**
3. Authorize the application when GitHub prompts you
4. You'll be redirected back to AI Code Terminal

You're now ready to start coding! Browse your GitHub repositories and create your first workspace.

## Understanding Your Installation

### What Gets Created

AI Code Terminal creates several important directories:

- **`data/`** - Your database and application settings
- **`workspaces/`** - Your cloned Git repositories 
- **`home/`** - User home directory with terminal history and Claude Code configuration

These directories persist between container restarts, so you'll never lose your work.

### Your Data Stays Local

Everything runs locally on your machine:
- Your GitHub repositories are cloned to local directories
- Your database is a local SQLite file
- Your Claude Code API key (when you set one up) stays in your local container
- No data is sent to external services except for GitHub authentication and Claude API calls you initiate

## Production Deployment

### For Production Use

If you're deploying this on a server rather than locally, update your `.env` file:

```bash
# Update URLs for your domain
GITHUB_CALLBACK_URL=https://your-domain.com/auth/github/callback

# Use strong security settings
NODE_ENV=production
JWT_SECRET=your-production-secure-secret-different-from-development

# Optional: Set up log levels
LOG_LEVEL=warn
```

And update your GitHub OAuth app settings to use your production domain instead of localhost.

### SSL/HTTPS Setup

For production deployments, you'll want to put AI Code Terminal behind a reverse proxy like nginx or Caddy to handle SSL certificates. The application itself runs on HTTP internally.

## Backup Your Data

Your important data lives in these directories:

```bash
# Backup everything important
tar -czf ai-code-terminal-backup.tar.gz data/ workspaces/ home/
```

Store this backup somewhere safe. It contains:
- Your workspace repositories
- Your application settings and GitHub tokens
- Your terminal history and configurations

## Common Management Tasks

### View Logs
```bash
docker-compose logs -f
```

### Restart the Application
```bash
docker-compose restart
```

### Stop the Application
```bash
docker-compose down
```

### Update to a New Version
```bash
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

### Access the Container
```bash
docker-compose exec ai-code-terminal bash
```

## Troubleshooting

### Application Won't Start

Check the logs first:
```bash
docker-compose logs
```

Common issues:
- **Missing environment variables:** Make sure all required variables in `.env` are set
- **GitHub OAuth misconfiguration:** Verify your Client ID, Secret, and callback URL match exactly
- **Port already in use:** Change the port in `.env` and `docker-compose.yml`

### Can't Login with GitHub

- Verify your GitHub username matches `TENANT_GITHUB_USERNAME` exactly, or is included in the comma-separated list if multiple users are authorized
- Check that your OAuth callback URL matches your GitHub app settings
- Make sure your GitHub OAuth app is active and not suspended

### Workspaces Not Persisting

Your workspaces are stored in Docker volumes. If you're losing data:
- Make sure you're using `docker-compose up -d` (not just `docker run`)
- Check that the `workspaces/` directory exists and has proper permissions
- Ensure you're not accidentally removing Docker volumes

### Performance Issues

AI Code Terminal is designed to be lightweight, but if you experience slowness:
- Check available system resources (`docker stats`)
- Ensure you have adequate disk space for repositories
- Consider the size and number of workspaces you have active

## Security Notes

- Only the GitHub user specified in `TENANT_GITHUB_USERNAME` can access your instance
- All communication with GitHub uses OAuth tokens, never passwords
- Your repositories are isolated in Docker containers
- The application runs as a non-root user inside containers
- All sensitive data is encrypted in the database

This setup provides a secure, isolated development environment that you control completely. Your code, credentials, and AI interactions remain private and under your control.