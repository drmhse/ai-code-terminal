---
title: "GitHub OAuth Setup"
description: "Complete guide to setting up GitHub OAuth authentication"
weight: 40
layout: "docs"
---

# GitHub OAuth Setup

Before using AI Code Terminal, you must create a GitHub OAuth application to enable authentication. This guide walks you through the complete setup process.

## Create OAuth Application

### Step 1: Navigate to GitHub Settings

1. Go to [GitHub.com](https://github.com)
2. Click your profile picture → **Settings**
3. Scroll down to **Developer settings**
4. Click **OAuth Apps**
5. Click **New OAuth App**

### Step 2: Configure Application Settings

Fill in the application form with these values:

| Field | Value | Description |
|-------|-------|-------------|
| **Application name** | `AI Code Terminal` | Display name for your application |
| **Homepage URL** | `http://localhost:3014` | Your application's main URL |
| **Application description** | `Browser-based terminal for development` | Optional description |
| **Authorization callback URL** | `http://localhost:3014/auth/github/callback` | OAuth redirect endpoint |

### Step 3: Generate Client Secret

After creating the app:

1. Click **Generate a new client secret**
2. Copy both the **Client ID** and **Client Secret**
3. Store them securely - you'll need them for configuration

⚠️ **Important:** The client secret is only shown once. Make sure to copy it immediately.

## Production Configuration

For production deployment, update the URLs to match your domain:

### Production URLs
- **Homepage URL:** `https://your-domain.com`
- **Authorization callback URL:** `https://your-domain.com/auth/github/callback`

### Multiple Environments

You can create separate OAuth apps for different environments:

- **Development:** `http://localhost:3014`
- **Staging:** `https://staging.your-domain.com`  
- **Production:** `https://your-domain.com`

## OAuth Scopes

The application requests these GitHub permissions:

### Required Scopes
- **`read:user`** - Access to profile information
- **`user:email`** - Access to email addresses
- **`repo`** - Access to public and private repositories

### Why These Scopes?

- **Profile Info:** Needed for user identification and single-tenant validation
- **Email Access:** Required for Git configuration in workspaces
- **Repository Access:** Essential for cloning and managing your repositories

## Security Considerations

### Client Secret Protection
- Never commit client secrets to version control
- Use environment variables for configuration
- Rotate secrets regularly in production
- Use different secrets for different environments

### Callback URL Validation
GitHub validates callback URLs for security:
- Must match exactly what's configured
- HTTPS required in production
- No wildcards allowed

## Testing OAuth Setup

After configuration, test the OAuth flow:

1. Start your application
2. Navigate to `http://localhost:3014`
3. Click "Login with GitHub"
4. You should be redirected to GitHub
5. After authorization, you'll be redirected back

### Troubleshooting OAuth Issues

**"redirect_uri_mismatch" Error**
- Verify callback URL matches exactly
- Check for trailing slashes
- Ensure HTTP vs HTTPS matches

**"invalid_client" Error**
- Verify client ID is correct
- Check client secret is properly set
- Ensure OAuth app is not suspended

**Authorization Failed**
- Verify your GitHub username matches `TENANT_GITHUB_USERNAME`
- Check that the OAuth app is active
- Ensure you have the required permissions

## Environment Configuration

Add your OAuth credentials to `.env`:

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:3014/auth/github/callback

# Single-tenant configuration
TENANT_GITHUB_USERNAME=your-github-username
```

## Next Steps

- **[Configuration](/docs/getting-started/configuration/):** Complete environment setup
- **[Terminal Access](/docs/core-features/terminal-access/):** Start using the terminal
- **[Authentication Flow](/docs/authentication/auth-flow/):** Understand the login process