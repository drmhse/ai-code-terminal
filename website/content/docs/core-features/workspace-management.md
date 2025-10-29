---
title: "Workspace Management"
description: "Isolated environments for each GitHub repository with automatic setup"
weight: 20
layout: "docs"
---

# Workspace Management

Workspaces provide isolated environments for each GitHub repository, complete with automatic cloning, Git integration, and persistent terminal sessions.

## Workspace Lifecycle

### 1. Repository Selection

Browse and select repositories from your GitHub account:
- Click **"Browse Repositories"** in the sidebar
- View all accessible repositories (public and private)
- Search and filter repositories
- Select repository to clone

### 2. Automatic Cloning

Repository is automatically cloned with OAuth authentication:
- HTTPS clone with OAuth credential helper
- Automatic Git configuration setup
- SSH key support for advanced users
- Workspace directory creation

### 3. Environment Setup

Each workspace gets:
- Isolated terminal session
- Auto-generated `CLAUDE.md` with project context
- Working directory set to repository root
- Git credential helper configured

## Workspace Structure

```
workspaces/
├── my-react-app/           # Repository workspace
│   ├── .git/              # Git repository data
│   ├── CLAUDE.md          # Auto-generated AI context
│   ├── package.json       # Project dependencies
│   ├── src/               # Source code
│   └── README.md          # Project documentation
│
├── python-api/            # Another workspace  
│   ├── .git/
│   ├── CLAUDE.md
│   ├── requirements.txt
│   ├── app/
│   └── tests/
│
└── docker-project/        # Third workspace
    ├── .git/
    ├── CLAUDE.md  
    ├── Dockerfile
    ├── docker-compose.yml
    └── src/
```

## Workspace Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| **Create** | UI + WebSocket | Clone repository and setup workspace |
| **Switch** | Sidebar selection | Change active workspace and terminal session |
| **Sync** | Git operations | Pull latest changes from remote |
| **Status** | Real-time updates | View Git status, branch, and changes |
| **Delete** | UI confirmation | Remove workspace and all data |

## Resource Management

- **Maximum workspaces:** Configurable per user (default: 10)
- **Storage limits:** Enforced by Docker container limits
- **Auto-cleanup:** Inactive workspaces removed after 30 days
- **Session limits:** One active terminal session per workspace
- **Process isolation:** Each workspace runs in separate directory

## CLAUDE.md Auto-Generation

Each workspace automatically gets a `CLAUDE.md` file containing:

```markdown
# Auto-generated content includes:
- Project overview and description
- Technology stack detection  
- File structure analysis
- Development setup instructions
- Common commands and workflows
- Integration guidelines
```

## Git Integration

### OAuth Credential Helper

Automatic Git authentication using your GitHub OAuth token:
- No need to manage SSH keys
- Seamless push/pull operations
- Token refresh handling

### Git Configuration

Each workspace is automatically configured with:
```bash
# Credential helper setup
git config credential.helper store
git config credential.https://github.com.helper oauth

# User information from GitHub profile
git config user.name "Your Name"
git config user.email "your@email.com"
```

## Advanced Features

### Workspace Templates

Create custom workspace templates for different project types:
- Pre-configured development environments
- Custom toolchain setup
- Project-specific configurations

### Backup and Restore

Workspaces can be backed up and restored:
- Export workspace to archive
- Import workspace from backup
- Sync with cloud storage

### Multi-Branch Support

Each workspace supports multiple Git branches:
- Branch switching preserves terminal state
- Branch-specific terminal sessions
- Automatic branch detection and display