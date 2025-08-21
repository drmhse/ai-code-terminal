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

Initiates GitHub OAuth authentication flow.

**Response:**
```json
{
  "url": "https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&scope=read:user+user:email+repo&state=..."
}
```

**Example:**
```bash
curl -X GET http://localhost:3014/api/github/auth
```

### OAuth Callback Handler

**`GET /auth/github/callback`**

Handles GitHub OAuth callback and creates JWT session.

**Parameters:**
- `code` (query) - Authorization code from GitHub
- `state` (query) - CSRF protection state parameter

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 12345,
    "username": "octocat",
    "email": "octocat@github.com",
    "avatar_url": "https://github.com/images/error/octocat_happy.gif"
  }
}
```

### Check Authentication Status

**`GET /api/auth/status`**

Returns current authentication status and user information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "id": 12345,
    "username": "octocat",
    "email": "octocat@github.com",
    "avatar_url": "https://github.com/images/error/octocat_happy.gif"
  },
  "tokenExpiry": "2024-01-15T10:30:00.000Z"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:3014/api/auth/status
```

### Logout

**`POST /api/auth/logout`**

Revokes GitHub tokens and invalidates session.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "revokeGitHubToken": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

## GitHub Integration Endpoints

### Get User Repositories

**`GET /api/github/repositories`**

Retrieves all accessible GitHub repositories for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional) - Page number for pagination (default: 1)
- `per_page` (optional) - Results per page (default: 30, max: 100)
- `sort` (optional) - Sort order: `created`, `updated`, `pushed`, `full_name` (default: `updated`)
- `direction` (optional) - Sort direction: `asc`, `desc` (default: `desc`)

**Response:**
```json
{
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
  "total_count": 25,
  "page": 1,
  "per_page": 30,
  "has_next": false
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

**Response:**
```json
{
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
  "total": 3,
  "active": 1
}
```

### Create Workspace

**`POST /api/workspaces`**

Creates a new workspace by cloning a GitHub repository.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "my-new-project",
  "githubRepo": "octocat/my-new-project",
  "githubUrl": "https://github.com/octocat/my-new-project",
  "description": "My new project workspace"
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
  "message": "Workspace created and repository cloned successfully"
}
```

**Error Response:**
```json
{
  "error": "Workspace creation failed",
  "details": "Repository clone failed: authentication required",
  "code": "CLONE_FAILED"
}
```

### Delete Workspace

**`DELETE /api/workspaces/:workspaceId`**

Deletes a workspace and all associated data.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `workspaceId` - The workspace ID to delete

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
     http://localhost:3014/api/workspaces/clp123abc
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
  "uptime": 3600
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
  "system": {
    "memory": {
      "used": "256 MB",
      "total": "4 GB",
      "usage": "6.4%"
    },
    "cpu": {
      "usage": "15%"
    },
    "disk": {
      "used": "2.1 GB", 
      "available": "58 GB",
      "usage": "3.5%"
    }
  },
  "database": {
    "status": "connected",
    "tables": 3,
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
  "description": "REST API for terminal workspace management",
  "endpoints": {
    "authentication": [
      "GET /api/github/auth",
      "GET /auth/github/callback", 
      "GET /api/auth/status",
      "POST /api/auth/logout"
    ],
    "workspaces": [
      "GET /api/workspaces",
      "POST /api/workspaces",
      "DELETE /api/workspaces/:id"
    ],
    "github": [
      "GET /api/github/repositories"
    ],
    "system": [
      "GET /health",
      "GET /health/detailed",
      "GET /api/stats"
    ]
  }
}
```

### System Statistics

**`GET /api/stats`**

Returns system usage statistics (requires authentication).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "workspaces": {
    "total": 5,
    "active": 2,
    "inactive": 3
  },
  "sessions": {
    "active": 2,
    "total_today": 8
  },
  "system": {
    "uptime": 86400,
    "memory_usage": "15%",
    "cpu_usage": "8%",
    "active_connections": 2
  },
  "github": {
    "api_calls_today": 145,
    "rate_limit_remaining": 4855
  }
}
```

## Theme Management Endpoints

### Get Current Theme

**`GET /api/theme`**

Returns the current theme configuration.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "current_theme": "dark",
  "theme_data": {
    "name": "Dark Theme",
    "colors": {
      "background": "#1a1a1a",
      "foreground": "#ffffff",
      "accent": "#007acc"
    },
    "fonts": {
      "primary": "Inter",
      "monospace": "Fira Code"
    }
  }
}
```

### Update Theme

**`POST /api/theme`**

Updates the current theme.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "theme": "light"
}
```

**Response:**
```json
{
  "success": true,
  "theme": "light",
  "message": "Theme updated successfully"
}
```

### Get Available Themes

**`GET /api/themes`**

Returns all available themes.

**Response:**
```json
{
  "themes": [
    {
      "id": "dark",
      "name": "Dark Theme",
      "description": "Default dark theme"
    },
    {
      "id": "light", 
      "name": "Light Theme",
      "description": "Clean light theme"
    }
  ]
}
```

### Get Specific Theme

**`GET /api/themes/:themeId`**

Returns detailed information about a specific theme.

**Response:**
```json
{
  "id": "dark",
  "name": "Dark Theme",
  "description": "Default dark theme optimized for extended coding sessions",
  "colors": {
    "background": "#1a1a1a",
    "surface": "#2d2d2d", 
    "primary": "#007acc",
    "secondary": "#17a2b8",
    "text": "#ffffff",
    "textSecondary": "#cccccc"
  },
  "fonts": {
    "primary": "Inter, system-ui, sans-serif",
    "monospace": "Fira Code, Consolas, monospace"
  },
  "terminal": {
    "background": "#1e1e1e",
    "foreground": "#d4d4d4",
    "cursor": "#007acc"
  }
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

## Rate Limiting

API endpoints are rate limited to prevent abuse:

### Default Limits

- **General API:** 100 requests per 15 minutes per IP
- **GitHub API Proxy:** 60 requests per hour per user
- **Workspace Operations:** 10 requests per 5 minutes per user

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1641825000
```

## Request Examples

### Complete Authentication Flow

```bash
# 1. Start OAuth flow
curl -X GET http://localhost:3014/api/github/auth

# 2. User completes OAuth on GitHub, callback handled automatically

# 3. Check authentication status
curl -H "Authorization: Bearer <token>" \
     http://localhost:3014/api/auth/status

# 4. Get repositories
curl -H "Authorization: Bearer <token>" \
     http://localhost:3014/api/github/repositories

# 5. Create workspace
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "test-project", "githubRepo": "octocat/Hello-World", "githubUrl": "https://github.com/octocat/Hello-World"}' \
     http://localhost:3014/api/workspaces
```

### JavaScript/TypeScript Usage

```typescript
class AICodeTerminalAPI {
  private baseURL = 'http://localhost:3014/api';
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
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  // Authentication
  async getAuthStatus() {
    return this.request('GET', '/auth/status');
  }

  async logout() {
    return this.request('POST', '/auth/logout');
  }

  // Repositories
  async getRepositories(page = 1, perPage = 30) {
    return this.request('GET', `/github/repositories?page=${page}&per_page=${perPage}`);
  }

  // Workspaces
  async getWorkspaces() {
    return this.request('GET', '/workspaces');
  }

  async createWorkspace(workspace: CreateWorkspaceRequest) {
    return this.request('POST', '/workspaces', workspace);
  }

  async deleteWorkspace(workspaceId: string) {
    return this.request('DELETE', `/workspaces/${workspaceId}`);
  }
}

// Usage example
const api = new AICodeTerminalAPI();
api.setToken(localStorage.getItem('jwt_token'));

try {
  const workspaces = await api.getWorkspaces();
  console.log('Workspaces:', workspaces);
} catch (error) {
  console.error('API Error:', error.message);
}
```

## Next Steps

- **[WebSocket Events](/docs/api/websocket/):** Real-time communication events
- **[Database Schema](/docs/database/schema/):** Data models and relationships
- **[Development Setup](/docs/development/setup/):** API development environment