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

## Session Management

Terminal sessions are automatically managed:

- **Auto-creation:** New session created when entering workspace
- **Persistence:** Sessions survive browser refreshes and reconnections
- **Isolation:** Each workspace has its own independent shell
- **Cleanup:** Inactive sessions automatically terminated after timeout
- **Multi-connection:** Multiple browser tabs can connect to same session

## Advanced Features

### Environment Variables
Each terminal session inherits the full system environment plus workspace-specific variables.

### Working Directory
Terminal sessions automatically start in the workspace root directory.

### Shell Integration
The terminal works with any POSIX-compatible shell and supports:
- Command completion
- History search
- Job control
- Signal handling

### Performance
- Low-latency I/O via optimized WebSocket communication
- Efficient PTY process management
- Minimal resource usage per session