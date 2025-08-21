---
title: "Installation"
description: "Comprehensive installation guide for all deployment methods"
weight: 30
layout: "docs"
---

# Installation

Multiple installation methods are available depending on your needs and environment.

## System Requirements

- **Node.js:** Version 18.x or higher
- **Docker:** Latest stable version  
- **Docker Compose:** v2.0 or higher
- **Git:** For repository management
- **GitHub Account:** For OAuth authentication

## Installation Methods

### Method 1: Docker (Recommended)

The easiest way to get started:

```bash
# Clone the repository
git clone https://github.com/your-username/ai-coding-terminal.git
cd ai-coding-terminal

# Copy environment file
cp env.example .env

# Build and run with Docker
npm run docker:build
npm run docker:run
```

### Method 2: Local Development

For development or local testing:

```bash
# Install dependencies
npm install

# Set up environment
cp env.example .env

# Initialize database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

### Method 3: Docker Compose

For production-like deployment:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Post-Installation Verification

After installation, verify everything is working:

```bash
# Check health endpoint
curl http://localhost:3014/health

# Check detailed health
curl http://localhost:3014/health/detailed
```

You should see a JSON response indicating the service is healthy.

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Change port in .env file
PORT=3015
```

**Permission Denied**
```bash
# Fix Docker permissions
sudo chown -R $USER:$USER /path/to/ai-coding-terminal
```

**Database Issues**
```bash
# Reset database
npx prisma db push --force-reset
```

## Next Steps

- **[GitHub OAuth Setup](/docs/getting-started/github-oauth/):** Configure authentication
- **[Configuration](/docs/getting-started/configuration/):** Environment variables
- **[Terminal Access](/docs/core-features/terminal-access/):** Start using the terminal