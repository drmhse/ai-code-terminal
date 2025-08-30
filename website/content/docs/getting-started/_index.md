---
title: "Getting Started"
description: "Deploy your AI-native development environment in minutes. Complete setup guide for VPS and local deployments."
weight: 10
layout: "docs"
---

# Getting Started

This guide will walk you through setting up a self-hosted, single-tenant AI development environment. Choose between VPS deployment for production use or local deployment with tunneling for development.

## Prerequisites

- Server with Docker (VPS deployment) or local machine with Docker
- GitHub account for OAuth authentication
- Domain name (optional but recommended for VPS deployment)

## Deployment Options

### VPS Deployment

Recommended for production use and team access. Requires a server with 1GB+ RAM.

**Recommended providers:**
- DigitalOcean ($6/month)
- Linode ($5/month)
- Vultr ($6/month)

### Local with Tunneling

Perfect for development and personal use. Works with Cloudflare Tunnel, ngrok, or similar services.

## Step 1: GitHub OAuth Setup

Create a GitHub OAuth application to secure access to your environment.

1. Navigate to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**

![GitHub OAuth App Registration](/images/create_a_ne_oauth_app.png)
*Register your application with GitHub*

3. Fill in the application details:
   - **Application name**: AI Code Terminal
   - **Homepage URL**: Your deployment URL
   - **Authorization callback URL**: `https://yourdomain.com/auth/github/callback`

4. Click **Register application**

![OAuth App Configuration](/images/generate_client_secret.png)
*Your OAuth application has been created*

5. Generate a new client secret and copy both the Client ID and Client Secret

![Copy OAuth Credentials](/images/copy_the_client_id_and_secret.png)
*Copy your Client ID and Client Secret for configuration*

Keep these credentials secure. You'll need them for the next step.

## Step 2: Server Setup

### VPS Deployment

SSH into your server and run the following commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker (includes Docker Compose)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Clone the repository
git clone https://github.com/drmhse/ai-code-terminal.git
cd ai-code-terminal
```

### Local Deployment

```bash
# Clone the repository
git clone https://github.com/drmhse/ai-code-terminal.git
cd ai-code-terminal
```

## Step 3: Configuration

Copy the environment template and configure your settings:

```bash
cp env.example .env
nano .env
```

Edit the following required variables in your `.env` file:

```bash
# Security (Required)
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
NODE_ENV=production
PORT=3014

# Database
DATABASE_URL=file:./data/database.db

# GitHub OAuth & Single-Tenant Configuration (Required - from Step 1)
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_CALLBACK_URL=https://yourdomain.com/auth/github/callback
TENANT_GITHUB_USERNAME=your-github-username

# Workspace Management
WORKSPACE_CLEANUP_DAYS=30
```

Replace the placeholder values with your actual credentials:
- `your-github-username`: Your GitHub username (ensures only you can access)
- `your-github-oauth-client-id`: Client ID from Step 1
- `your-github-oauth-client-secret`: Client Secret from Step 1
- Update the callback URL to match your deployment URL

## Step 4: Launch the Application

Start the services using Docker Compose:

```bash
docker-compose up -d
```

Check that everything is running correctly:

```bash
docker-compose logs -f
```

Your application will be available at:
- **VPS**: `https://yourdomain.com:3014`
- **Local**: `http://localhost:3014`

## Step 5: Tunneling Setup (Local Only)

If you're running locally, expose your application using a tunnel service.

### Cloudflare Tunnel (Recommended)

```bash
# Install cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create ai-terminal

# Configure tunnel
echo "url: http://localhost:3014
tunnel: ai-terminal
credentials-file: ~/.cloudflared/ai-terminal.json" > ~/.cloudflared/config.yml

# Route domain to tunnel
cloudflared tunnel route dns ai-terminal yourdomain.com

# Start tunnel
cloudflared tunnel run ai-terminal
```

### ngrok Alternative

```bash
# Install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Add auth token (get from ngrok dashboard)
ngrok config add-authtoken YOUR_NGROK_TOKEN

# Expose application
ngrok http 3014
```

Update your GitHub OAuth callback URL with the tunnel URL.

## Step 6: First Login

1. Navigate to your application URL
2. Click **Login with GitHub**
3. Authorize the application

You'll be redirected to the terminal interface.

## Step 7: Using the Terminal

### Clone a Repository

Click the **+** button in the workspace sidebar to clone a repository:

![Repository Browser](/images/repository_search_and_list.png)
*Browse and clone your GitHub repositories*

### Terminal Interface

Once a repository is cloned, you'll have full terminal access with multiple pane support:

![Multiple Panes Support](/images/multiple-panes-support.png)
*Work with multiple terminals simultaneously using tabs and split panes*

![AI Terminal Interface](/images/claude_code_in_action.png)
*Full terminal access within your browser*

### Customize Theme

Access theme settings to personalize your environment:

![Theme Selection](/images/choose_favorite_theme.png)
*Choose from multiple terminal themes*

## Step 8: AI Integration

Claude Code is pre-installed in the Docker environment. Simply authenticate when you first use it:

```bash
# Authenticate with Claude (first time only)
claude

```

---

Your AI-native development environment is now ready for use.