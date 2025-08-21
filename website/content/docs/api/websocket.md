---
title: "WebSocket Events"
description: "Complete WebSocket event reference for real-time terminal and workspace communication"
weight: 20
layout: "docs"
---

# WebSocket Events

AI Code Terminal uses Socket.IO for real-time bidirectional communication between the client and server, enabling instant terminal I/O, workspace updates, and system notifications.

## Connection Setup

### Client Connection

```javascript
// Connect with JWT authentication
const socket = io('/', {
  auth: {
    token: localStorage.getItem('jwt_token')
  },
  transports: ['websocket', 'polling']
});

// Connection event handlers
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

### Server Authentication

The server validates JWT tokens for all WebSocket connections:

```javascript
// Server-side authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication failed'));
    }
    
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  });
});
```

## Terminal Events

### Terminal Creation and Management

#### `create-terminal`

Creates a new terminal session in a workspace.

**Client → Server:**
```javascript
socket.emit('create-terminal', {
  workspaceId: 'clp123abc',
  shell: 'bash', // optional: 'bash', 'zsh', 'fish'
  cols: 80,      // terminal columns
  rows: 24       // terminal rows
});
```

**Server → Client Response:**
```javascript
socket.on('terminal-created', (data) => {
  console.log('Terminal created:', data);
  // data: {
  //   sessionId: 'session_uuid',
  //   workspaceId: 'clp123abc',
  //   shell: 'bash',
  //   pid: 12345
  // }
});
```

#### `terminal-input`

Sends user input to the terminal session.

**Client → Server:**
```javascript
socket.emit('terminal-input', {
  sessionId: 'session_uuid',
  data: 'ls -la\r'  // Command with carriage return
});
```

#### `terminal-output`

Receives terminal output from the server.

**Server → Client:**
```javascript
socket.on('terminal-output', (data) => {
  // Write output to xterm.js terminal
  terminal.write(data.output);
  
  // data: {
  //   sessionId: 'session_uuid',
  //   output: 'total 48\ndrwxr-xr-x 12 user user 4096 Jan 10 15:30 .\n...',
  //   timestamp: '2024-01-10T15:30:00.000Z'
  // }
});
```

#### `terminal-resize`

Resizes the terminal session.

**Client → Server:**
```javascript
socket.emit('terminal-resize', {
  sessionId: 'session_uuid',
  cols: 120,
  rows: 30
});
```

#### `kill-terminal`

Terminates a terminal session.

**Client → Server:**
```javascript
socket.emit('kill-terminal', {
  sessionId: 'session_uuid'
});
```

**Server → Client Response:**
```javascript
socket.on('terminal-killed', (data) => {
  console.log('Terminal terminated:', data.sessionId);
});
```

### Terminal Session Events

#### `session-status`

Provides real-time session status updates.

**Server → Client:**
```javascript
socket.on('session-status', (data) => {
  // data: {
  //   sessionId: 'session_uuid',
  //   status: 'active' | 'inactive' | 'terminated',
  //   pid: 12345,
  //   workspaceId: 'clp123abc',
  //   lastActivity: '2024-01-10T15:30:00.000Z'
  // }
});
```

#### `process-exit`

Notifies when a process exits in the terminal.

**Server → Client:**
```javascript
socket.on('process-exit', (data) => {
  // data: {
  //   sessionId: 'session_uuid',
  //   pid: 12345,
  //   exitCode: 0,
  //   signal: null
  // }
});
```

## Workspace Events

### Workspace Management

#### `create-workspace`

Creates a new workspace by cloning a repository.

**Client → Server:**
```javascript
socket.emit('create-workspace', {
  name: 'my-project',
  githubRepo: 'octocat/my-project',
  githubUrl: 'https://github.com/octocat/my-project',
  branch: 'main' // optional
});
```

**Server → Client Progress:**
```javascript
socket.on('workspace-progress', (data) => {
  // data: {
  //   step: 'cloning' | 'configuring' | 'completed',
  //   progress: 45, // percentage
  //   message: 'Cloning repository...'
  // }
});
```

**Server → Client Completion:**
```javascript
socket.on('workspace-created', (data) => {
  // data: {
  //   workspace: {
  //     id: 'clp789ghi',
  //     name: 'my-project',
  //     localPath: '/app/workspaces/my-project',
  //     githubRepo: 'octocat/my-project'
  //   }
  // }
});
```

#### `clone-workspace`

Clones an existing repository to a new workspace.

**Client → Server:**
```javascript
socket.emit('clone-workspace', {
  repositoryId: 123456,
  name: 'custom-workspace-name', // optional
  branch: 'develop' // optional
});
```

#### `delete-workspace`

Deletes a workspace and all its data.

**Client → Server:**
```javascript
socket.emit('delete-workspace', {
  workspaceId: 'clp123abc'
});
```

**Server → Client Response:**
```javascript
socket.on('workspace-deleted', (data) => {
  // data: {
  //   workspaceId: 'clp123abc',
  //   success: true
  // }
});
```

#### `sync-workspace`

Synchronizes workspace with remote repository.

**Client → Server:**
```javascript
socket.emit('sync-workspace', {
  workspaceId: 'clp123abc',
  operation: 'pull' // 'pull', 'fetch', 'push'
});
```

**Server → Client Response:**
```javascript
socket.on('workspace-synced', (data) => {
  // data: {
  //   workspaceId: 'clp123abc',
  //   operation: 'pull',
  //   changes: {
  //     added: 2,
  //     modified: 5,
  //     deleted: 1
  //   },
  //   success: true
  // }
});
```

### Workspace Status Updates

#### `workspace-status`

Real-time workspace status information.

**Server → Client:**
```javascript
socket.on('workspace-status', (data) => {
  // data: {
  //   workspaceId: 'clp123abc',
  //   git: {
  //     branch: 'main',
  //     ahead: 2,
  //     behind: 0,
  //     modified: 3,
  //     staged: 1,
  //     untracked: 2
  //   },
  //   processes: [
  //     { pid: 12345, command: 'npm run dev', status: 'running' }
  //   ],
  //   lastActivity: '2024-01-10T15:30:00.000Z'
  // }
});
```

#### `get-workspace-status`

Request current workspace status.

**Client → Server:**
```javascript
socket.emit('get-workspace-status', {
  workspaceId: 'clp123abc'
});
```

### File System Events

#### `file-changed`

Notifies of file system changes in workspace.

**Server → Client:**
```javascript
socket.on('file-changed', (data) => {
  // data: {
  //   workspaceId: 'clp123abc',
  //   path: 'src/components/Header.tsx',
  //   type: 'modified' | 'created' | 'deleted',
  //   timestamp: '2024-01-10T15:30:00.000Z'
  // }
});
```

## GitHub Integration Events

### Repository Management

#### `get-repositories`

Fetch GitHub repositories for the authenticated user.

**Client → Server:**
```javascript
socket.emit('get-repositories', {
  page: 1,
  per_page: 30,
  sort: 'updated'
});
```

**Server → Client Response:**
```javascript
socket.on('repositories-loaded', (data) => {
  // data: {
  //   repositories: [...],
  //   total_count: 25,
  //   page: 1,
  //   has_next: false
  // }
});
```

#### `repository-selected`

Notifies when a repository is selected for workspace creation.

**Client → Server:**
```javascript
socket.emit('repository-selected', {
  repositoryId: 123456,
  action: 'create-workspace' | 'view-details'
});
```

## System Events

### Health and Monitoring

#### `system-stats`

Request current system statistics.

**Client → Server:**
```javascript
socket.emit('system-stats');
```

**Server → Client Response:**
```javascript
socket.on('system-stats', (data) => {
  // data: {
  //   memory: { used: '256 MB', total: '4 GB', percentage: 6.4 },
  //   cpu: { usage: 15 },
  //   activeConnections: 3,
  //   activeSessions: 2,
  //   uptime: 86400
  // }
});
```

#### `health-check`

Periodic health check events.

**Server → Client:**
```javascript
socket.on('health-status', (data) => {
  // data: {
  //   status: 'healthy' | 'degraded' | 'unhealthy',
  //   services: {
  //     database: 'operational',
  //     github_api: 'operational',
  //     file_system: 'operational'
  //   },
  //   timestamp: '2024-01-10T15:30:00.000Z'
  // }
});
```

## Error Handling Events

### Error Notifications

#### `error`

General error event for WebSocket operations.

**Server → Client:**
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // error: {
  //   code: 'WORKSPACE_NOT_FOUND',
  //   message: 'Workspace not found',
  //   details: 'Workspace clp123abc does not exist',
  //   timestamp: '2024-01-10T15:30:00.000Z'
  // }
});
```

#### `terminal-error`

Terminal-specific errors.

**Server → Client:**
```javascript
socket.on('terminal-error', (error) => {
  // error: {
  //   sessionId: 'session_uuid',
  //   code: 'SPAWN_FAILED',
  //   message: 'Failed to spawn terminal process',
  //   details: 'Shell executable not found'
  // }
});
```

#### `workspace-error`

Workspace operation errors.

**Server → Client:**
```javascript
socket.on('workspace-error', (error) => {
  // error: {
  //   workspaceId: 'clp123abc',
  //   operation: 'clone',
  //   code: 'GIT_CLONE_FAILED',
  //   message: 'Repository clone failed',
  //   details: 'Authentication failed for private repository'
  // }
});
```

## Authentication Events

### Session Management

#### `auth-required`

Notifies client that authentication is required.

**Server → Client:**
```javascript
socket.on('auth-required', () => {
  // Redirect user to login
  window.location.href = '/login';
});
```

#### `session-expired`

Notifies when the session has expired.

**Server → Client:**
```javascript
socket.on('session-expired', (data) => {
  // data: {
  //   message: 'Session expired, please login again',
  //   expiredAt: '2024-01-10T15:30:00.000Z'
  // }
  
  // Clear local storage and redirect
  localStorage.removeItem('jwt_token');
  window.location.href = '/login';
});
```

#### `force-logout`

Server-initiated logout (emergency or security reasons).

**Server → Client:**
```javascript
socket.on('force-logout', (data) => {
  // data: {
  //   reason: 'Security incident detected',
  //   message: 'You have been logged out for security reasons'
  // }
  
  // Immediate logout
  localStorage.removeItem('jwt_token');
  window.location.href = '/login';
});
```

## Room Management

WebSocket connections are organized into rooms for efficient message distribution:

### Room Types

- **User Room:** `user_${userId}` - User-specific notifications
- **Workspace Room:** `workspace_${workspaceId}` - Workspace-specific events  
- **Session Room:** `session_${sessionId}` - Terminal session events

### Joining Rooms

**Client → Server:**
```javascript
socket.emit('join-workspace', {
  workspaceId: 'clp123abc'
});
```

**Server → Client Confirmation:**
```javascript
socket.on('joined-workspace', (data) => {
  // data: {
  //   workspaceId: 'clp123abc',
  //   room: 'workspace_clp123abc'
  // }
});
```

## Event Flow Examples

### Complete Terminal Session Flow

```javascript
// 1. Create terminal
socket.emit('create-terminal', {
  workspaceId: 'clp123abc',
  cols: 80,
  rows: 24
});

// 2. Terminal created confirmation
socket.on('terminal-created', (data) => {
  const sessionId = data.sessionId;
  
  // 3. Send command
  socket.emit('terminal-input', {
    sessionId: sessionId,
    data: 'npm install\r'
  });
});

// 4. Receive output
socket.on('terminal-output', (data) => {
  terminal.write(data.output);
});

// 5. Monitor process completion
socket.on('process-exit', (data) => {
  if (data.exitCode === 0) {
    console.log('Command completed successfully');
  } else {
    console.log('Command failed with exit code:', data.exitCode);
  }
});
```

### Workspace Creation with Progress

```javascript
// 1. Start workspace creation
socket.emit('create-workspace', {
  name: 'my-project',
  githubRepo: 'octocat/my-project',
  githubUrl: 'https://github.com/octocat/my-project'
});

// 2. Monitor progress
socket.on('workspace-progress', (data) => {
  updateProgressBar(data.progress);
  showStatusMessage(data.message);
});

// 3. Handle completion
socket.on('workspace-created', (data) => {
  const workspace = data.workspace;
  
  // 4. Automatically create terminal
  socket.emit('create-terminal', {
    workspaceId: workspace.id,
    cols: 120,
    rows: 30
  });
});

// 5. Handle errors
socket.on('workspace-error', (error) => {
  showErrorMessage(error.message);
  hideProgressBar();
});
```

## Client Libraries and Helpers

### TypeScript Definitions

```typescript
interface SocketEvents {
  // Terminal events
  'create-terminal': (data: CreateTerminalRequest) => void;
  'terminal-created': (data: TerminalCreatedResponse) => void;
  'terminal-input': (data: TerminalInputData) => void;
  'terminal-output': (data: TerminalOutputData) => void;
  'terminal-resize': (data: TerminalResizeData) => void;
  'kill-terminal': (data: KillTerminalRequest) => void;
  'terminal-killed': (data: TerminalKilledResponse) => void;
  
  // Workspace events
  'create-workspace': (data: CreateWorkspaceRequest) => void;
  'workspace-created': (data: WorkspaceCreatedResponse) => void;
  'workspace-progress': (data: WorkspaceProgressData) => void;
  'workspace-status': (data: WorkspaceStatusData) => void;
  'delete-workspace': (data: DeleteWorkspaceRequest) => void;
  'workspace-deleted': (data: WorkspaceDeletedResponse) => void;
  
  // System events
  'system-stats': () => void;
  'health-status': (data: HealthStatusData) => void;
  'error': (error: SocketError) => void;
}

// Usage with typed socket
const socket: Socket<SocketEvents> = io('/');
```

### React Hook Example

```typescript
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (token: string | null) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (token) {
      socketRef.current = io('/', {
        auth: { token },
        transports: ['websocket', 'polling']
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Socket connected');
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token]);

  return socketRef.current;
};
```

### Vue.js Composable

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';

export const useSocket = (token: Ref<string | null>) => {
  const socket = ref<Socket | null>(null);
  const connected = ref(false);

  onMounted(() => {
    if (token.value) {
      socket.value = io('/', {
        auth: { token: token.value },
        transports: ['websocket', 'polling']
      });

      socket.value.on('connect', () => {
        connected.value = true;
      });

      socket.value.on('disconnect', () => {
        connected.value = false;
      });
    }
  });

  onUnmounted(() => {
    socket.value?.disconnect();
  });

  return {
    socket: readonly(socket),
    connected: readonly(connected)
  };
};
```

## Performance Considerations

### Connection Optimization

- **Connection Pooling:** Reuse existing connections
- **Transport Selection:** WebSocket preferred, with fallbacks
- **Heartbeat Configuration:** Optimized ping/pong intervals
- **Compression:** Enable compression for large messages

### Message Optimization

- **Batching:** Combine multiple small messages
- **Throttling:** Limit high-frequency events (terminal output)
- **Selective Updates:** Only send changed data
- **Binary Data:** Use binary transport for large payloads

## Next Steps

- **[Database Schema](/docs/database/schema/):** Data models and relationships
- **[Development Setup](/docs/development/setup/):** Development environment
- **[Production Setup](/docs/deployment/production/):** Production deployment