---
title: "GitHub Integration"
description: "Seamless GitHub authentication, repository management, and Git operations"
weight: 30
layout: "docs"
---

# GitHub Integration

AI Code Terminal provides seamless integration with GitHub for authentication, repository browsing, and automated Git operations with OAuth credential management.

## Authentication Integration

### OAuth Flow

The GitHub integration handles the complete OAuth 2.0 flow:

1. **Authorization Request** - User clicks "Login with GitHub"
2. **GitHub Authorization** - User authorizes the application
3. **Token Exchange** - Application receives access token
4. **User Validation** - Validates against `TENANT_GITHUB_USERNAME`
5. **Session Creation** - Creates authenticated session with JWT

### Single-Tenant Security

The application enforces single-tenant access:
- Only the configured `TENANT_GITHUB_USERNAME` can access
- All other GitHub users are denied access
- Provides secure, personal development environment

## Repository Management

### Repository Discovery

Browse all your GitHub repositories through the integrated interface:

- **All Repositories** - Public, private, and organization repos
- **Search & Filter** - Find repositories quickly
- **Repository Info** - Description, language, last update
- **Permission Awareness** - Only shows accessible repositories

### Repository Selection

When selecting a repository for workspace creation:

```javascript
// Repository information includes:
{
  "name": "my-project",
  "full_name": "username/my-project", 
  "description": "Project description",
  "private": true,
  "clone_url": "https://github.com/username/my-project.git",
  "default_branch": "main",
  "language": "JavaScript",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

## Git Credential Management

### OAuth Credential Helper

AI Code Terminal includes a custom Git credential helper that automatically provides OAuth tokens for GitHub operations:

**Location:** `/scripts/git-credential-oauth`

```bash
#!/usr/bin/env node

// Provides OAuth tokens to Git operations
// Reads from application database
// Handles token refresh automatically
```

### Automatic Git Configuration

Each workspace is automatically configured with:

```bash
# Credential helper setup
git config credential.helper 'oauth'
git config credential.https://github.com.helper 'oauth'

# User information from GitHub profile
git config user.name "Your GitHub Name"
git config user.email "your@github-email.com"
```

### Supported Git Operations

All standard Git operations work seamlessly:

```bash
# Clone (handled automatically by workspace creation)
git clone https://github.com/username/repo.git

# Fetch and pull
git fetch origin
git pull origin main

# Push operations
git push origin feature-branch
git push origin main

# Remote management
git remote -v
git remote add upstream https://github.com/upstream/repo.git
```

## Token Management

### Automatic Token Refresh

The system handles OAuth token lifecycle automatically:

- **Expiration Detection** - Monitors token expiration
- **Refresh Process** - Uses refresh tokens when available
- **Re-authentication** - Prompts for re-auth when needed
- **Error Handling** - Graceful handling of token failures

### Token Security

OAuth tokens are securely managed:

- **Encryption** - Tokens encrypted at rest using AES-256-CBC
- **Memory Protection** - Tokens cleared from memory after use
- **Database Security** - Secure token storage in SQLite database
- **Network Security** - HTTPS-only token transmission

## API Integration

### GitHub REST API

The application uses the GitHub REST API v4 for:

- **User Information** - Profile data and email addresses
- **Repository Listing** - All accessible repositories
- **Repository Details** - Metadata and permissions
- **Organization Access** - Organization repositories

### API Rate Limiting

Respectful API usage with:

- **Rate Limit Headers** - Monitors GitHub rate limits
- **Caching** - Caches repository data to reduce API calls
- **Retry Logic** - Handles rate limit exceeded scenarios
- **Pagination** - Handles large repository lists efficiently

### Example API Usage

```javascript
// Repository listing with pagination
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: userToken
});

const repositories = await octokit.paginate(
  octokit.rest.repos.listForAuthenticatedUser,
  {
    visibility: 'all',
    sort: 'updated',
    per_page: 100
  }
);
```

## Webhook Support

### Repository Events

The application can be configured to receive GitHub webhooks for:

- **Push Events** - Automatic workspace synchronization
- **Pull Request Events** - Workspace updates for PR changes
- **Issue Events** - Notifications and workspace context
- **Release Events** - Version management integration

### Webhook Configuration

To set up webhooks (optional):

1. Go to your repository settings
2. Click "Webhooks" → "Add webhook"
3. Set URL to `https://your-domain.com/api/webhooks/github`
4. Select events: `push`, `pull_request`, `issues`
5. Set content type to `application/json`

## Advanced Git Features

### Multiple Remote Support

Each workspace supports multiple Git remotes:

```bash
# Add upstream remote for forks
git remote add upstream https://github.com/original/repo.git

# Fetch from all remotes
git fetch --all

# Push to different remotes
git push origin feature
git push upstream main
```

### Branch Management

Integrated branch operations:

- **Branch Creation** - Create and switch to new branches
- **Branch Switching** - Change branches with workspace context
- **Remote Tracking** - Automatic upstream branch setup
- **Merge Operations** - Handle merges and conflicts

### Git Hooks Integration

Support for Git hooks in workspaces:

- **Pre-commit Hooks** - Code formatting and linting
- **Pre-push Hooks** - Testing and validation
- **Post-merge Hooks** - Dependency updates
- **Custom Hooks** - Project-specific automation

## Troubleshooting GitHub Integration

### Authentication Issues

**"Authentication failed" Error**
- Verify GitHub OAuth credentials are correct
- Check that OAuth app is active (not suspended)
- Ensure callback URL matches exactly

**"Access denied" Error**
- Verify your GitHub username matches `TENANT_GITHUB_USERNAME`
- Check that you have access to the repository
- Ensure OAuth app has required permissions

### Repository Access Issues

**"Repository not found" Error**
- Verify repository exists and you have access
- Check if repository is private and token has repo scope
- Ensure repository hasn't been renamed or transferred

### Git Operation Failures

**"Authentication failed" during Git operations**
- Check OAuth token hasn't expired
- Verify credential helper is properly configured
- Ensure network connectivity to GitHub

**"Permission denied" during push operations**
- Verify you have write access to the repository
- Check if branch is protected
- Ensure you're pushing to correct remote/branch

## Security Considerations

### OAuth Scope Minimization

The application requests only necessary scopes:
- `read:user` - Basic profile information
- `user:email` - Email addresses for Git configuration
- `repo` - Repository access (both public and private)

### Token Security Best Practices

- Tokens are encrypted at rest
- Regular token rotation in production
- Secure token transmission (HTTPS only)
- Automatic token cleanup on logout

### Network Security

- All GitHub API calls use HTTPS
- Certificate validation enforced
- No token logging or debugging output
- Secure session management

## Next Steps

- **[Workspace Management](/docs/core-features/workspace-management/):** Learn about workspace features
- **[Authentication Flow](/docs/authentication/auth-flow/):** Understand the security model
- **[API Endpoints](/docs/api/endpoints/):** Explore the API interface