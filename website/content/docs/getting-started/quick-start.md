---
title: "Quick Start"
description: "Get AI Code Terminal running in minutes"
weight: 20
layout: "docs"
---

# Quick Start

Get AI Code Terminal up and running in just a few minutes with Docker.

## Prerequisites

Before starting, ensure you have:
- Docker and Docker Compose installed
- A GitHub account
- GitHub OAuth application credentials

## Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-username/ai-coding-terminal.git
cd ai-coding-terminal/app

# Copy environment template
cp env.example .env
```

## Step 2: Configure Environment

Edit your `.env` file with the required values:

```bash
# Required - GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
TENANT_GITHUB_USERNAME=your-github-username

# Required - Security
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters
```

## Step 3: Start the Application

Using Docker Compose (recommended):

```bash
# Start all services
docker-compose up -d
```

Alternative Docker commands:

```bash
# Build and run with Docker
npm run docker:build
npm run docker:run
```

## Step 4: Access Your Terminal

1. Open your browser to `http://localhost:3014`
2. Click "Login with GitHub"
3. Authorize the application
4. Browse your repositories and start coding!

## Verification

Check that everything is working:

```bash
# Health check
curl http://localhost:3014/health

# Should return: {"status":"healthy","timestamp":"..."}
```

## Next Steps

- **[Installation Guide](/docs/getting-started/installation/):** Detailed installation options
- **[GitHub OAuth Setup](/docs/getting-started/github-oauth/):** Complete OAuth configuration
- **[Configuration](/docs/getting-started/configuration/):** All environment variables explained
- **[Terminal Access](/docs/core-features/terminal-access/):** Using the terminal interface