---
title: "Terminal Access"
description: "Full shell access through your browser with real-time I/O"
weight: 10
layout: "docs"
---

# Terminal Access

AI Code Terminal provides full shell access through your browser with real-time I/O powered by xterm.js and node-pty.

## Core Capabilities

- **Full shell access:** Login shells (bash, zsh, fish) with complete environment setup
- **Real-time I/O:** Instant bidirectional communication via WebSockets
- **256-color support:** Full color terminal with xterm-256color
- **Terminal resizing:** Dynamic resize handling that adapts to window changes
- **Session persistence:** Terminal sessions survive browser refreshes
- **Process isolation:** Each workspace gets isolated shell processes
- **History management:** Command history preserved across sessions

## Terminal Technology Stack

- **Frontend:** xterm.js for terminal emulation
- **Backend:** node-pty for PTY process management
- **Communication:** Socket.IO for real-time WebSocket communication
- **Process Management:** Isolated shell processes per workspace

## Supported Operations

```bash
# Development Tools
npm install && npm run dev
git clone https://github.com/user/repo.git
docker build -t myapp .
python -m venv venv && source venv/bin/activate

# System Commands
ls -la --color=auto
htop
ps aux | grep node
tail -f /var/log/app.log

# File Operations  
vim config.json
nano README.md
find . -name "*.js" -type f

# Claude Integration
claude login
claude chat "Help me debug this function"
claude apply changes.patch

# Git Operations (with OAuth integration)
git status
git commit -m "Update feature"
git push origin main
```

## Terminal Controls

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+C` | Interrupt | Send SIGINT to current process |
| `Ctrl+D` | EOF | Send EOF signal |
| `Ctrl+L` | Clear | Clear terminal screen |
| `↑/↓` | History | Navigate command history |
| `Tab` | Complete | Auto-complete commands and paths |

## Advanced Session Management

Terminal sessions feature sophisticated persistence and sharing capabilities:

### Session Persistence
- **Persistent History:** All terminal output stored to disk with 5000-line memory buffer
- **Session Resurrection:** Terminal sessions survive server restarts and browser disconnects
- **History Replay:** New connections automatically replay recent session history
- **Cross-Device Access:** Sessions accessible from multiple devices simultaneously

### Room-Based Communication
- **Workspace Isolation:** Each workspace gets its own Socket.IO room
- **Multi-Client Support:** Multiple browser tabs/devices can connect to the same session
- **Real-time Synchronization:** All connected clients see output in real-time
- **Conflict-Free Sharing:** Shared sessions prevent output bleeding between workspaces

### Process Management
- **Intelligent Session Tracking:** Maps Socket.IO connections to PTY processes
- **Graceful Cleanup:** Automatic cleanup of zombie processes every 5 minutes
- **Resource Monitoring:** Process health checks and automatic recovery
- **Session Lifecycle:** Complete tracking from creation to termination

### Advanced Features

#### Persistent Session History
```javascript
// History storage structure
/home/claude/.terminal_history/
├── workspace-id-1.log    # Base64 encoded terminal output
├── workspace-id-2.log    # Timestamped entries
└── workspace-id-3.log    # Automatic cleanup of old entries
```

#### RingBuffer Implementation
- **Memory Management:** In-memory circular buffer for fast access
- **Disk Persistence:** Automatic background writes to disk storage
- **Configurable Capacity:** 5000-line default capacity per session
- **Performance Optimized:** Non-blocking I/O for terminal responsiveness

#### Environment Variables
Each terminal session includes:
- Full system environment inheritance
- Workspace-specific PATH modifications
- Claude Code integration variables
- Custom prompt configuration (PS1)
- Development tool paths (`/home/claude/.local/bin`)

#### Working Directory Management
- **Automatic Navigation:** Sessions start in workspace root directory
- **Path Persistence:** Working directory maintained across reconnections
- **Workspace Isolation:** Each workspace maintains independent working state

#### Shell Integration
Advanced shell features supported:
- **Login Shell:** Bash with `--login` flag for proper initialization
- **Job Control:** Full support for background/foreground processes
- **Signal Handling:** Proper SIGINT, SIGTERM, SIGKILL propagation
- **Terminal Resize:** Dynamic resize handling with PTY process updates
- **Color Support:** Full 256-color terminal with xterm-256color

#### Git Integration
- **OAuth Credential Helper:** Automatic GitHub authentication using stored tokens
- **Repository Management:** Built-in Git operations with credential management
- **Authentication Fixing:** Automatic repair of Git authentication issues

### Performance Optimizations

#### WebSocket Communication
- **Low Latency:** Optimized Socket.IO configuration for minimal delay
- **Connection Pooling:** Efficient connection management per workspace
- **Bandwidth Optimization:** Compressed data transmission
- **Error Recovery:** Automatic reconnection with session restoration

#### Resource Management
- **Memory Efficient:** Ring buffer prevents memory leaks
- **Disk Usage:** Automatic cleanup of old session logs
- **Process Limits:** Controlled resource usage per terminal session
- **Health Monitoring:** Continuous process health checks

#### Concurrent Access
- **Thread Safety:** Safe multi-client access to shared sessions
- **Race Condition Prevention:** Proper synchronization of terminal I/O
- **State Consistency:** Guaranteed consistent view across all clients