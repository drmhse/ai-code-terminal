---
title: "API Endpoints"
description: "Complete REST API reference with authentication, workspaces, and system endpoints"
weight: 10
layout: "docs"
---

# API Endpoints

AI Code Terminal provides a comprehensive REST API for authentication, workspace management, system monitoring, and theme configuration.

## Base URL and Versioning

**Base URL:** `http://localhost:3014/api`  
**API Version:** v1 (implicit)  
**Content-Type:** `application/json`

## Authentication

All API endpoints (except health checks) require authentication via JWT Bearer token:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Authentication Endpoints

### Start GitHub OAuth Flow

**`GET /api/github/auth`**

Initiates GitHub OAuth authentication flow. Redirects to GitHub authorization page.

**Response:** `302 Redirect` to GitHub OAuth authorization URL

**Example:**
```bash
curl -X GET http://localhost:3014/api/github/auth
# Redirects to: https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&scope=user:email+repo&state=...
```

### OAuth Callback Handler

**`GET /auth/github/callback`**

Handles GitHub OAuth callback and creates JWT session. Redirects to main page with token.

**Parameters:**
- `code` (query) - Authorization code from GitHub
- `state` (query) - CSRF protection state parameter

**Response:** `302 Redirect` to `/?token=<jwt_token>` on success or `/?error=<error>` on failure

### Check Authentication Status

**`GET /api/auth/status`**

Returns current GitHub authentication status and user information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "authorized": true,
  "userInfo": {
    "login": "octocat",
    "id": 12345,
    "avatar_url": "https://avatars.githubusercontent.com/u/12345?v=4",
    "name": "The Octocat",
    "email": "octocat@github.com"
  },
  "githubConfigured": true
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:3014/api/auth/status
```

### Logout

**`POST /api/auth/logout`**

Revokes GitHub tokens and clears authentication.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## GitHub Integration Endpoints

### Get User Repositories

**`GET /api/github/repositories`**

Retrieves GitHub repositories for the authenticated user with pagination support.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional) - Page number for pagination (default: 1)
- `per_page` (optional) - Results per page (default: 30, max: 100)
- `sort` (optional) - Sort order: `updated`, `created`, `pushed` (default: `updated`)
- `type` (optional) - Repository type: `all`, `owner`, `member` (default: `all`)

**Response:**
```json
{
  "success": true,
  "repositories": [
    {
      "id": 123456,
      "name": "my-project",
      "full_name": "octocat/my-project",
      "description": "This is a sample project",
      "private": false,
      "clone_url": "https://github.com/octocat/my-project.git",
      "ssh_url": "git@github.com:octocat/my-project.git",
      "html_url": "https://github.com/octocat/my-project",
      "default_branch": "main",
      "language": "JavaScript",
      "size": 108,
      "stargazers_count": 42,
      "forks_count": 10,
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-10T15:30:00Z",
      "pushed_at": "2024-01-10T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 30,
    "has_more": false
  }
}
```

**Error Response:**
```json
{
  "error": "Re-authentication required",
  "message": "GitHub token expired, please re-authenticate"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3014/api/github/repositories?page=1&per_page=10&sort=updated"
```

## Workspace Management Endpoints

### List Workspaces

**`GET /api/workspaces`**

Returns all workspaces for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `include_inactive` (optional) - Include inactive workspaces (default: false)

**Response:**
```json
{
  "success": true,
  "workspaces": [
    {
      "id": "clp123abc",
      "name": "my-react-app",
      "githubRepo": "octocat/my-react-app", 
      "githubUrl": "https://github.com/octocat/my-react-app",
      "localPath": "/app/workspaces/my-react-app",
      "isActive": true,
      "lastSyncAt": "2024-01-10T15:30:00.000Z",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-10T15:30:00.000Z",
      "sessions": [
        {
          "id": "clp456def",
          "status": "active",
          "lastActivityAt": "2024-01-10T15:30:00.000Z"
        }
      ]
    }
  ],
  "count": 3
}
```

### Create Workspace

**`POST /api/workspaces`**

Creates a new workspace from a GitHub repository.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "githubRepo": "octocat/my-new-project",
  "githubUrl": "https://github.com/octocat/my-new-project"
}
```

**Response:**
```json
{
  "success": true,
  "workspace": {
    "id": "clp789ghi",
    "name": "my-new-project",
    "githubRepo": "octocat/my-new-project",
    "githubUrl": "https://github.com/octocat/my-new-project",
    "localPath": "/app/workspaces/my-new-project",
    "isActive": true,
    "createdAt": "2024-01-10T16:00:00.000Z"
  },
  "message": "Workspace created successfully"
}
```

**Error Response:**
```json
{
  "error": "Workspace already exists",
  "message": "A workspace with this repository already exists"
}
```

### Delete Workspace

**`DELETE /api/workspaces/:workspaceId`**

Deletes a workspace and optionally removes the files.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `workspaceId` - The workspace ID to delete

**Query Parameters:**
- `delete_files` (optional) - Whether to delete workspace files (default: false)

**Response:**
```json
{
  "success": true,
  "message": "Workspace deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE \
     -H "Authorization: Bearer <token>" \
     "http://localhost:3014/api/workspaces/clp123abc?delete_files=true"
```

## System Information Endpoints

### Health Check (Basic)

**`GET /health`**

Basic health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-10T15:30:00.000Z",
  "uptime": 3600,
  "version": "2.0.0"
}
```

### Health Check (Detailed)

**`GET /health/detailed`**

Detailed health information (no authentication required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-10T15:30:00.000Z",
  "uptime": 3600,
  "version": "2.0.0",
  "system": {
    "memory": {
      "used": "256 MB",
      "total": "4 GB",
      "percentage": 6.4
    },
    "cpu": {
      "usage": 15.2
    },
    "disk": {
      "used": "2.1 GB", 
      "available": "58 GB",
      "percentage": 3.5
    }
  },
  "database": {
    "status": "connected",
    "size": "1.2 MB"
  },
  "services": {
    "github_api": "operational",
    "websocket": "operational"
  }
}
```

### API Information

**`GET /api`**

Returns API information and available endpoints.

**Response:**
```json
{
  "name": "AI Code Terminal API",
  "version": "2.0.0",
  "status": "running",
  "endpoints": {
    "health": "/health",
    "auth": "/api/github/auth",
    "stats": "/api/stats"
  }
}
```

### System Statistics

**`GET /api/stats`**

Returns system usage statistics and resource monitoring (requires authentication).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "system": {
    "uptime": 86400,
    "memory": {
      "used": 268435456,
      "total": 4294967296,
      "percentage": 6.25
    },
    "cpu": {
      "usage": 8.5
    },
    "processes": {
      "active_sessions": 2,
      "total_processes": 15
    }
  },
  "database": {
    "status": "healthy",
    "size": "1245184",
    "connection_count": 1
  },
  "workspaces": {
    "total": 3,
    "active": 2
  }
}
```

## Theme Management Endpoints

### Get Current Theme

**`GET /api/theme`**

Returns the current user theme preferences.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "theme": {
    "name": "VS Code Dark",
    "type": "dark",
    "colors": {
      "primary": "#1e1e1e",
      "secondary": "#252526",
      "tertiary": "#2d2d30",
      "sidebar": "#181818",
      "border": "#3c3c3c",
      "textPrimary": "#cccccc",
      "textSecondary": "#969696"
    }
  }
}
```

### Update Theme

**`POST /api/theme`**

Updates the user's theme preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "theme": {
    "name": "VS Code Light",
    "type": "light",
    "colors": {
      "primary": "#ffffff",
      "secondary": "#f3f3f3",
      "textPrimary": "#333333"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Theme preferences updated successfully"
}
```

### Get Available Themes

**`GET /api/themes`**

Returns all available predefined themes.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "themes": [
    {
      "id": "vs-code-dark",
      "name": "VS Code Dark",
      "type": "dark",
      "description": "Dark theme inspired by VS Code"
    },
    {
      "id": "github-light", 
      "name": "GitHub Light",
      "type": "light",
      "description": "Light theme inspired by GitHub"
    },
    {
      "id": "monokai",
      "name": "Monokai",
      "type": "dark", 
      "description": "Popular Monokai color scheme"
    }
  ]
}
```

### Get Specific Theme

**`GET /api/themes/:themeId`**

Returns detailed configuration for a specific theme.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "vs-code-dark",
  "name": "VS Code Dark",
  "type": "dark",
  "description": "Dark theme inspired by VS Code editor",
  "colors": {
    "primary": "#1e1e1e",
    "secondary": "#252526",
    "tertiary": "#2d2d30",
    "sidebar": "#181818",
    "border": "#3c3c3c",
    "textPrimary": "#cccccc",
    "textSecondary": "#969696",
    "success": "#4caf50",
    "warning": "#ff9800",
    "error": "#f44336"
  },
  "terminal": {
    "background": "#1e1e1e",
    "foreground": "#d4d4d4",
    "cursor": "#007acc",
    "selection": "#264f78"
  }
}
```

### Reload Themes (Development)

**`POST /api/themes/reload`**

Reloads themes from configuration files (development endpoint).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Themes reloaded successfully",
  "count": 8
}
```

## Error Responses

All API endpoints return consistent error responses:

### Standard Error Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Detailed error description",
  "timestamp": "2024-01-10T15:30:00.000Z"
}
```

### Common HTTP Status Codes

| Status | Code | Description |
|--------|------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (duplicate) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Examples

**Authentication Error:**
```json
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED",
  "details": "Valid JWT token required in Authorization header",
  "timestamp": "2024-01-10T15:30:00.000Z"
}
```

**Validation Error:**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "name": "Workspace name is required",
    "githubRepo": "Invalid GitHub repository format"
  },
  "timestamp": "2024-01-10T15:30:00.000Z"
}
```

**Rate Limit Error:**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED", 
  "details": "Too many requests. Try again in 900 seconds",
  "retry_after": 900,
  "timestamp": "2024-01-10T15:30:00.000Z"
}
```

## Error Handling

The API uses standard HTTP status codes and returns JSON error responses for failed requests.

## Request Examples

### Complete Authentication and Workspace Creation Flow

```bash
# 1. Start OAuth flow (redirects to GitHub)
curl -X GET http://localhost:3014/api/github/auth

# 2. User completes OAuth on GitHub, callback handled automatically
# User is redirected to /?token=<jwt_token>

# 3. Check authentication status
curl -H "Authorization: Bearer <token>" \
     http://localhost:3014/api/auth/status

# 4. Get user's GitHub repositories
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3014/api/github/repositories?page=1&per_page=10"

# 5. Create workspace from repository
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"githubRepo": "octocat/Hello-World", "githubUrl": "https://github.com/octocat/Hello-World"}' \
     http://localhost:3014/api/workspaces

# 6. List all workspaces
curl -H "Authorization: Bearer <token>" \
     http://localhost:3014/api/workspaces
```

### JavaScript/TypeScript Usage

```typescript
class AICodeTerminalAPI {
  private baseURL = 'http://localhost:3014';
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(method: string, endpoint: string, data?: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'API request failed');
    }

    return response.json();
  }

  // Authentication
  async getAuthStatus() {
    return this.request('GET', '/api/auth/status');
  }

  async logout() {
    return this.request('POST', '/api/auth/logout');
  }

  // GitHub Integration
  async getRepositories(page = 1, perPage = 30, sort = 'updated') {
    return this.request('GET', `/api/github/repositories?page=${page}&per_page=${perPage}&sort=${sort}`);
  }

  // Workspaces
  async getWorkspaces() {
    return this.request('GET', '/api/workspaces');
  }

  async createWorkspace(githubRepo: string, githubUrl: string) {
    return this.request('POST', '/api/workspaces', { githubRepo, githubUrl });
  }

  async deleteWorkspace(workspaceId: string, deleteFiles = false) {
    return this.request('DELETE', `/api/workspaces/${workspaceId}?delete_files=${deleteFiles}`);
  }

  // Themes
  async getThemes() {
    return this.request('GET', '/api/themes');
  }

  async getCurrentTheme() {
    return this.request('GET', '/api/theme');
  }

  async updateTheme(theme: any) {
    return this.request('POST', '/api/theme', { theme });
  }

  // System
  async getStats() {
    return this.request('GET', '/api/stats');
  }
}

// Usage example
const api = new AICodeTerminalAPI();
api.setToken(localStorage.getItem('authToken'));

try {
  // Get authentication status
  const authStatus = await api.getAuthStatus();
  console.log('Auth status:', authStatus);

  // List repositories
  const repos = await api.getRepositories(1, 10);
  console.log('Repositories:', repos.repositories);

  // Create workspace
  const workspace = await api.createWorkspace(
    'octocat/Hello-World', 
    'https://github.com/octocat/Hello-World'
  );
  console.log('Created workspace:', workspace);

} catch (error) {
  console.error('API Error:', error.message);
}
```

## Next Steps

- **[WebSocket Events](/docs/api/websocket/):** Real-time communication events
- **[Database Schema](/docs/database/schema/):** Data models and relationships
- **[Development Setup](/docs/development/setup/):** API development environment