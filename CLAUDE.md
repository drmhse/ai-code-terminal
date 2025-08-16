# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready, single-tenant development environment with god-mode shell access through the browser. The application provides a secure, self-hostable terminal interface for a single authorized GitHub user to work directly in their repositories.

**Current Status**: Single-tenant terminal system with real-time shell access

**Key Features**:
- **God-mode terminal access**: Full bash/shell access in browser
- **Single-tenant authentication**: GitHub OAuth for one authorized user
- **Direct Claude integration**: User runs `claude login` directly in terminal
- **Repository workspace management**: Clone and work in GitHub repositories
- **Real-time terminal I/O**: Powered by xterm.js + node-pty
- **Security hardening**: Containerized with resource limits
- **Minimal database**: Only workspace and session tracking
- **Self-hostable**: Complete Docker deployment

## Development Commands

```bash
# Development with auto-restart
npm run dev

# Production start
npm start

# Docker commands
npm run docker:build
npm run docker:run

# Manual Docker operations
docker-compose up -d
docker-compose down
```

## Environment Setup

Copy `env.example` to `.env` and configure:
- `JWT_SECRET`: Must be at least 32 characters in production
- `NODE_ENV`: Set to `production` for production deployments
- `PORT`: Server port (defaults to 3014)
- `GITHUB_CLIENT_ID`: GitHub OAuth application client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth application client secret
- `GITHUB_CALLBACK_URL`: OAuth callback URL (e.g., http://localhost:3014/auth/github/callback)
- `TENANT_GITHUB_USERNAME`: **REQUIRED** - The authorized GitHub username for single-tenant access
- `DATABASE_URL`: SQLite database path (file:./data/database.db)
- `MAX_WORKSPACES_PER_USER`: Limit workspaces per user (default: 10)
- `WORKSPACE_CLEANUP_DAYS`: Auto-cleanup inactive workspaces (default: 30)

## Architecture

### Core Components

**Server Architecture**
- Express.js HTTP server with Socket.IO for real-time terminal communication
- Single-tenant GitHub OAuth authentication with JWT tokens
- Terminal session management with node-pty for shell access
- Direct shell spawning in isolated workspace directories

**Database Management (Prisma + SQLite)**
- Minimal database schema for single-tenant operation
- Settings table for GitHub OAuth token (encrypted) and preferences
- Workspace table for repository clones and management
- Session table for terminal session tracking
- Single authorized user validation via TENANT_GITHUB_USERNAME

**Workspace Management**
- GitHub repository cloning and management
- Isolated workspace directories in secure containers
- Full shell access within workspace boundaries
- Real-time terminal I/O via xterm.js + node-pty

**Terminal Sessions (Shell Service)**
- node-pty based shell process management
- One active shell session per socket connection
- Terminal resize and input/output handling
- Process isolation and resource limits

**Web Interface (EJS Templates + Vue.js)**
- Server-rendered EJS templates with Vue.js for interactivity
- Modular template structure for maintainability
- Real-time terminal communication via Socket.IO + xterm.js
- Two-panel layout: workspace sidebar + terminal panel
- Repository browsing and cloning interface

### Data Storage

```
data/
└── database.db         # SQLite database (Prisma)

views/                  # EJS template system
├── layout.ejs         # Main HTML layout
└── partials/          # Modular components
    ├── head.ejs       # Meta tags, CDN links
    ├── styles.ejs     # CSS styling and themes
    ├── login.ejs      # GitHub authentication
    ├── sidebar.ejs    # Workspace management
    ├── editor-panel.ejs # Terminal interface
    ├── modals.ejs     # Repository selection
    └── scripts.ejs    # Vue.js application logic

workspaces/
├── {repo-name-1}/      # Git repository clone (no user subdirs)
│   ├── .git/
│   ├── CLAUDE.md       # Auto-generated Claude instructions
│   └── [project files]
└── {repo-name-2}/      # Another repository
    └── [project files]

prisma/
├── schema.prisma       # Simplified database schema
└── migrations/         # Database migrations
```

### Process Architecture

The server spawns shell processes via node-pty with these characteristics:
- Each socket connection gets its own isolated shell process (bash/zsh/powershell)
- Processes run in workspace directories with limited permissions
- Resource limits enforced via Docker and ulimit
- Graceful process termination on socket disconnect
- Real-time bidirectional terminal I/O via xterm.js and Socket.IO
- Session persistence and tracking in database

### Authentication Flow

1. User clicks "Login with GitHub" on EJS-rendered landing page
2. GitHub OAuth authorization for the authorized tenant user
3. Server validates user against TENANT_GITHUB_USERNAME
4. JWT token generated and redirected back to main application
5. JWT token stored in localStorage for session management
6. Socket.IO connection authenticated with JWT
7. User browses GitHub repositories via Vue.js interface
8. Repository selection → workspace creation → terminal session
9. User runs `claude login` directly in terminal for Claude access

## Security Considerations

- JWT tokens with configurable expiration (default 7 days)
- Single-tenant access enforced via TENANT_GITHUB_USERNAME validation
- GitHub OAuth tokens encrypted in database using AES-256-CBC
- No server-side Claude token storage (user manages directly via terminal)
- Workspace isolation within secure Docker containers
- Repository access validated through GitHub API
- CORS configured for production/development environments
- Docker runs as non-root user with resource limits
- Read-only root filesystem with writable tmpfs volumes
- Process isolation and resource limits (ulimit)
- Shell processes jailed to workspace directories
- Terminal sessions tracked and managed securely
- Input validation and sanitization on all endpoints
- Comprehensive error handling and logging

## Docker Deployment

The application includes:
- Security-hardened Dockerfile with resource limits
- Docker Compose configuration with read-only filesystem
- node-pty dependencies for terminal functionality
- Persistent volumes for SQLite database, workspaces, and user home
- Git and SSH tools for repository operations
- Prisma CLI for database operations
- System dependencies and build tools for compilation
- Resource limits and tmpfs mounts for security

## Testing Approach

No specific test framework is configured yet. When adding tests:
- Set up Jest or Mocha for unit testing
- Create separate test database configuration
- Test GitHub OAuth integration thoroughly
- Test workspace isolation and security
- Test terminal session management with node-pty
- Test Shell service process management
- Add integration tests for end-to-end terminal workflows
- Test database operations and migrations
- Test Socket.IO real-time communication
- Test Docker containerization and security

## Current Implementation Notes

- Package name: `claude-code-terminal` (v2.0.0)
- Main server entry: `server.js`
- Database: SQLite with Prisma ORM
- Frontend: EJS templates with Vue.js 3 + xterm.js for terminal interface
- Real-time communication: Socket.IO for terminal I/O
- Process management: node-pty for shell sessions
- Authentication: GitHub OAuth with single-tenant restriction
- Containerization: Docker with security hardening

- make sure you think as you continue making changes and NEVER EVER run the servers if not asked.