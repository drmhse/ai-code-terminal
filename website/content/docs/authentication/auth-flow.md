---
title: "Authentication Flow"
description: "Complete GitHub OAuth 2.0 authentication flow with single-tenant validation"
weight: 10
layout: "docs"
---

# Authentication Flow

AI Code Terminal implements a secure GitHub OAuth 2.0 authentication flow with single-tenant validation and JWT-based session management.

## Overview

The authentication system provides:

- **GitHub OAuth 2.0** - Standard OAuth flow with GitHub
- **Single-Tenant Validation** - Only authorized user can access
- **JWT Sessions** - Stateless session management
- **Token Refresh** - Automatic token renewal
- **Secure Storage** - Encrypted token storage

## Complete Authentication Flow

### Step 1: Initial Access

When a user visits the application:

```
User Browser → AI Code Terminal
GET /

Response:
- If authenticated: Main application
- If not authenticated: Login page
```

### Step 2: OAuth Initiation

User clicks "Login with GitHub":

```
1. Generate CSRF state token
2. Build GitHub OAuth URL
3. Redirect to GitHub
```

**OAuth URL Structure:**
```
https://github.com/login/oauth/authorize
  ?client_id={GITHUB_CLIENT_ID}
  &redirect_uri={GITHUB_CALLBACK_URL}
  &scope=read:user user:email repo
  &state={CSRF_TOKEN}
```

### Step 3: GitHub Authorization

At GitHub's authorization server:

```
1. User sees application permission request
2. User authorizes the application
3. GitHub redirects back with authorization code
```

**Callback URL:**
```
GET /auth/github/callback
  ?code={AUTHORIZATION_CODE}
  &state={CSRF_TOKEN}
```

### Step 4: Token Exchange

Server exchanges code for access token:

```javascript
// Token exchange request
const response = await fetch('https://github.com/login/oauth/access_token', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code: authorizationCode,
    redirect_uri: process.env.GITHUB_CALLBACK_URL
  })
});
```

**Response:**
```json
{
  "access_token": "gho_xxxx",
  "token_type": "bearer",
  "scope": "read:user,user:email,repo",
  "expires_in": 28800,
  "refresh_token": "ghr_xxxx"
}
```

### Step 5: User Validation

Retrieve GitHub user information:

```javascript
// Get user profile
const userResponse = await octokit.rest.users.getAuthenticated();
const user = userResponse.data;

// Single-tenant validation
if (user.login !== process.env.TENANT_GITHUB_USERNAME) {
  throw new Error('Access denied: unauthorized user');
}
```

### Step 6: JWT Creation

Create JWT token for session management:

```javascript
const jwtPayload = {
  userId: user.id,
  username: user.login,
  email: user.email,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
};

const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET);
```

### Step 7: Token Storage

Store OAuth tokens securely:

```javascript
// Encrypt OAuth tokens
const encryptedAccessToken = encrypt(accessToken);
const encryptedRefreshToken = encrypt(refreshToken);

// Store in database
await prisma.settings.upsert({
  where: { id: 'singleton' },
  update: {
    githubToken: encryptedAccessToken,
    githubRefreshToken: encryptedRefreshToken,
    githubTokenExpiresAt: new Date(Date.now() + (expiresIn * 1000))
  },
  create: {
    id: 'singleton',
    githubToken: encryptedAccessToken,
    githubRefreshToken: encryptedRefreshToken,
    githubTokenExpiresAt: new Date(Date.now() + (expiresIn * 1000))
  }
});
```

### Step 8: Session Establishment

Return JWT to client:

```javascript
// Set HTTP-only cookie (optional)
res.cookie('jwt', jwtToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// Also return in response for localStorage storage
res.json({
  success: true,
  token: jwtToken,
  user: {
    id: user.id,
    username: user.login,
    email: user.email,
    avatar_url: user.avatar_url
  }
});
```

## Authentication Middleware

### JWT Validation

Every protected request validates the JWT:

```javascript
// JWT validation middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  });
};
```

### Socket.IO Authentication

WebSocket connections also require authentication:

```javascript
// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Invalid authentication token'));
    }
    
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  });
});
```

## Token Refresh Flow

### Automatic Token Refresh

When OAuth tokens expire, automatic refresh is attempted:

```javascript
const refreshGitHubToken = async () => {
  const settings = await prisma.settings.findUnique({
    where: { id: 'singleton' }
  });

  if (!settings.githubRefreshToken) {
    throw new Error('No refresh token available');
  }

  const refreshToken = decrypt(settings.githubRefreshToken);
  
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const tokenData = await response.json();
  
  // Store new tokens
  await updateStoredTokens(tokenData);
  
  return tokenData.access_token;
};
```

### Re-authentication Flow

When refresh fails, user must re-authenticate:

```javascript
// Check token expiration
const isTokenExpired = (tokenExpiresAt) => {
  return new Date() >= new Date(tokenExpiresAt);
};

// Middleware to handle expired tokens
const checkTokenExpiry = async (req, res, next) => {
  const settings = await getSettings();
  
  if (isTokenExpired(settings.githubTokenExpiresAt)) {
    try {
      await refreshGitHubToken();
    } catch (error) {
      // Refresh failed, require re-authentication
      return res.status(401).json({ 
        error: 'Token expired',
        requiresReauth: true 
      });
    }
  }
  
  next();
};
```

## Security Measures

### CSRF Protection

State parameter prevents CSRF attacks:

```javascript
// Generate and store CSRF token
const csrfToken = crypto.randomBytes(32).toString('hex');
req.session.oauthState = csrfToken;

// Validate on callback
if (req.query.state !== req.session.oauthState) {
  throw new Error('Invalid state parameter');
}
```

### JWT Security

JWT tokens include security measures:

- **Expiration** - Limited lifetime (7 days default)
- **Signature** - HMAC signature prevents tampering
- **Issuer Validation** - Verify token issuer
- **Audience Validation** - Ensure token is for this application

### Token Storage Security

OAuth tokens are protected:

- **Encryption at Rest** - AES-256-CBC encryption
- **Secure Key Management** - JWT secret from environment
- **Database Security** - SQLite with proper permissions
- **Memory Protection** - Tokens cleared after use

## Session Management

### Session Lifecycle

1. **Creation** - JWT created after successful OAuth
2. **Validation** - JWT validated on each request
3. **Refresh** - OAuth tokens refreshed automatically
4. **Expiration** - JWT expires after configured time
5. **Cleanup** - Expired sessions cleaned up automatically

### Multi-Device Support

Users can have sessions on multiple devices:

- **Independent Sessions** - Each device has its own JWT
- **Shared OAuth Tokens** - Single set of GitHub tokens
- **Synchronized State** - Changes reflect across devices
- **Individual Logout** - Can logout specific devices

### Session Security

- **HTTP-Only Cookies** - Prevent XSS access to tokens
- **Secure Transmission** - HTTPS-only in production
- **SameSite Protection** - CSRF protection
- **Token Rotation** - Regular token refresh

## Logout Flow

### Client-Initiated Logout

When user logs out:

```javascript
// Client-side logout
const logout = async () => {
  // Clear local storage
  localStorage.removeItem('jwt_token');
  
  // Call logout API
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  // Redirect to login
  window.location.href = '/';
};
```

### Server-Side Cleanup

Server performs cleanup:

```javascript
// Logout endpoint
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // Optionally revoke GitHub tokens
    if (req.body.revokeGitHubToken) {
      await revokeGitHubToken();
    }
    
    // Clear stored tokens
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: {
        githubToken: null,
        githubRefreshToken: null,
        githubTokenExpiresAt: null
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});
```

### GitHub Token Revocation

Optionally revoke GitHub tokens:

```javascript
const revokeGitHubToken = async () => {
  const settings = await getSettings();
  const accessToken = decrypt(settings.githubToken);
  
  await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/token`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64')}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      access_token: accessToken
    })
  });
};
```

## Error Handling

### Authentication Errors

Common authentication errors and handling:

| Error | Cause | Resolution |
|-------|-------|------------|
| `invalid_client` | Wrong client credentials | Verify GitHub OAuth app settings |
| `invalid_grant` | Invalid/expired auth code | Restart OAuth flow |
| `invalid_scope` | Requested scope not available | Check OAuth app permissions |
| `access_denied` | User denied authorization | User must authorize application |
| `unauthorized_user` | User not in tenant allowlist | Verify TENANT_GITHUB_USERNAME |

### Error Responses

Structured error responses:

```javascript
// Authentication error response
{
  "error": "authentication_failed",
  "error_description": "Invalid or expired access token",
  "error_code": 401,
  "requires_reauth": true
}
```

## Monitoring and Logging

### Authentication Events

Log important authentication events:

- **Login Attempts** - Successful and failed logins
- **Token Refresh** - OAuth token refresh events
- **Logout Events** - User-initiated logouts
- **Security Events** - Invalid tokens, unauthorized access

### Security Monitoring

Monitor for security issues:

- **Failed Authentication Attempts** - Potential brute force
- **Invalid Token Usage** - Potential token theft
- **Unusual Access Patterns** - Potential compromise
- **Rate Limiting Triggers** - Abuse detection

## Next Steps

- **[Security Features](/docs/authentication/security-features/):** Advanced security measures
- **[Token Management](/docs/authentication/token-management/):** Token lifecycle management
- **[API Endpoints](/docs/api/endpoints/):** API authentication requirements