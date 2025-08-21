---
title: "Token Management"
description: "Comprehensive token lifecycle management including JWT and OAuth token handling"
weight: 30
layout: "docs"
---

# Token Management

AI Code Terminal implements comprehensive token management for both JWT session tokens and GitHub OAuth tokens, ensuring secure authentication and seamless user experience.

## Token Types Overview

### JWT Session Tokens

**Purpose:** Client-side session management  
**Lifetime:** 7 days (configurable)  
**Storage:** Client localStorage + optional HttpOnly cookies  
**Scope:** Application authentication and authorization

### GitHub OAuth Access Tokens

**Purpose:** GitHub API access  
**Lifetime:** 8 hours (GitHub default)  
**Storage:** Encrypted in server database  
**Scope:** GitHub repository and user data access

### GitHub OAuth Refresh Tokens

**Purpose:** Automatic access token renewal  
**Lifetime:** 6 months (GitHub default)  
**Storage:** Encrypted in server database  
**Scope:** Token refresh operations

## JWT Token Lifecycle

### Token Creation

JWT tokens are created after successful OAuth authentication:

```javascript
const createJWTToken = (user, githubToken) => {
  const payload = {
    // User identification
    userId: user.id,
    username: user.login,
    email: user.email,
    avatarUrl: user.avatar_url,
    
    // Token metadata
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    iss: 'ai-code-terminal',
    aud: 'terminal-user',
    
    // Additional claims
    role: 'user',
    permissions: ['workspace:create', 'workspace:delete', 'terminal:access'],
    sessionId: crypto.randomUUID()
  };

  const options = {
    algorithm: 'HS256',
    header: {
      typ: 'JWT',
      alg: 'HS256'
    }
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
};
```

### Token Storage

Multiple storage strategies for different use cases:

```javascript
// Client-side storage options
const storeJWTToken = (token) => {
  // Primary storage: localStorage for SPA functionality
  localStorage.setItem('jwt_token', token);
  
  // Secondary storage: sessionStorage for tab-specific sessions
  sessionStorage.setItem('jwt_backup', token);
  
  // Optional: HttpOnly cookie for additional security
  // Set by server, not accessible to JavaScript
};
```

### Token Validation

Comprehensive token validation on each request:

```javascript
const validateJWTToken = (token) => {
  try {
    // Verify signature and basic claims
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'ai-code-terminal',
      audience: 'terminal-user',
      clockTolerance: 30 // 30 seconds
    });
    
    // Additional validation
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is expired
    if (decoded.exp <= now) {
      throw new Error('Token expired');
    }
    
    // Check if token was issued in the future (clock skew protection)
    if (decoded.iat > now + 60) {
      throw new Error('Token issued in future');
    }
    
    // Validate required claims
    if (!decoded.userId || !decoded.username) {
      throw new Error('Missing required claims');
    }
    
    // Check tenant validation
    if (decoded.username !== process.env.TENANT_GITHUB_USERNAME) {
      throw new Error('Unauthorized tenant user');
    }
    
    return decoded;
    
  } catch (error) {
    throw new Error(`Token validation failed: ${error.message}`);
  }
};
```

### Token Refresh Strategy

JWT tokens cannot be refreshed (by design), requiring OAuth re-authentication:

```javascript
const handleJWTExpiration = async (expiredToken) => {
  try {
    // Attempt to use refresh token for GitHub OAuth
    const newGitHubTokens = await refreshGitHubTokens();
    
    // Create new JWT with fresh GitHub tokens
    const userInfo = await getGitHubUserInfo(newGitHubTokens.access_token);
    const newJWT = createJWTToken(userInfo, newGitHubTokens.access_token);
    
    return newJWT;
    
  } catch (error) {
    // Refresh failed, require full re-authentication
    throw new Error('Re-authentication required');
  }
};
```

## OAuth Token Lifecycle

### Access Token Management

GitHub OAuth access tokens have limited lifetime and require careful management:

```javascript
const manageGitHubTokens = {
  // Store tokens securely
  async store(tokens) {
    const encryptedAccess = encrypt(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        githubToken: encryptedAccess.encryptedData,
        githubTokenIv: encryptedAccess.iv,
        githubRefreshToken: encryptedRefresh?.encryptedData,
        githubRefreshTokenIv: encryptedRefresh?.iv,
        githubTokenExpiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
      },
      create: {
        id: 'singleton',
        githubToken: encryptedAccess.encryptedData,
        githubTokenIv: encryptedAccess.iv,
        githubRefreshToken: encryptedRefresh?.encryptedData,
        githubRefreshTokenIv: encryptedRefresh?.iv,
        githubTokenExpiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
      }
    });
  },
  
  // Retrieve and decrypt tokens
  async retrieve() {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' }
    });
    
    if (!settings?.githubToken) {
      throw new Error('No GitHub token stored');
    }
    
    const accessToken = decrypt({
      encryptedData: settings.githubToken,
      iv: settings.githubTokenIv
    });
    
    let refreshToken = null;
    if (settings.githubRefreshToken) {
      refreshToken = decrypt({
        encryptedData: settings.githubRefreshToken,
        iv: settings.githubRefreshTokenIv
      });
    }
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: settings.githubTokenExpiresAt
    };
  },
  
  // Check if token needs refresh
  needsRefresh(expiresAt) {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const timeUntilExpiry = expiry.getTime() - now.getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    
    return timeUntilExpiry < fifteenMinutes;
  }
};
```

### Automatic Token Refresh

Automatic refresh before expiration:

```javascript
const refreshGitHubTokens = async () => {
  const currentTokens = await manageGitHubTokens.retrieve();
  
  if (!currentTokens.refresh_token) {
    throw new Error('No refresh token available');
  }
  
  if (!manageGitHubTokens.needsRefresh(currentTokens.expires_at)) {
    return currentTokens; // Still valid
  }
  
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Code-Terminal/2.0'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        refresh_token: currentTokens.refresh_token,
        grant_type: 'refresh_token'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const newTokens = await response.json();
    
    // Store new tokens
    await manageGitHubTokens.store(newTokens);
    
    return newTokens;
    
  } catch (error) {
    console.error('GitHub token refresh failed:', error);
    throw new Error('Token refresh failed, re-authentication required');
  }
};
```

### Token Revocation

Secure token revocation for logout:

```javascript
const revokeGitHubTokens = async () => {
  const tokens = await manageGitHubTokens.retrieve();
  
  try {
    // Revoke access token
    await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/token`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64')}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Terminal/2.0'
      },
      body: JSON.stringify({
        access_token: tokens.access_token
      })
    });
    
    // Clear stored tokens
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: {
        githubToken: null,
        githubTokenIv: null,
        githubRefreshToken: null,
        githubRefreshTokenIv: null,
        githubTokenExpiresAt: null
      }
    });
    
  } catch (error) {
    console.error('Token revocation failed:', error);
    // Still clear local tokens even if revocation failed
    await manageGitHubTokens.clear();
  }
};
```

## Token Security

### Encryption Implementation

Strong encryption for token storage:

```javascript
const tokenEncryption = {
  algorithm: 'aes-256-cbc',
  
  encrypt(text) {
    const key = this.deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted
    };
  },
  
  decrypt(data) {
    const key = this.deriveKey();
    const decipher = crypto.createDecipher(this.algorithm, key);
    
    let decrypted = decipher.update(data.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  },
  
  deriveKey() {
    // Derive encryption key from JWT secret
    return crypto.scryptSync(process.env.JWT_SECRET, 'ai-code-terminal-salt', 32);
  }
};
```

### Token Sanitization

Remove tokens from memory after use:

```javascript
const sanitizeTokens = (tokenObject) => {
  // Overwrite token values in memory
  Object.keys(tokenObject).forEach(key => {
    if (typeof tokenObject[key] === 'string') {
      const length = tokenObject[key].length;
      tokenObject[key] = '*'.repeat(length);
    }
  });
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
};
```

### Secure Token Transmission

Best practices for token transmission:

```javascript
// Secure headers for token transmission
const secureTokenHeaders = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'X-Content-Type-Options': 'nosniff'
};

// Token response with security headers
app.post('/api/auth/token', (req, res) => {
  // Set security headers
  Object.entries(secureTokenHeaders).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
  
  // Return token with metadata
  res.json({
    access_token: jwtToken,
    token_type: 'Bearer',
    expires_in: 7 * 24 * 60 * 60, // 7 days
    scope: 'terminal:access'
  });
});
```

## Token Monitoring and Analytics

### Token Usage Tracking

Monitor token usage patterns:

```javascript
const tokenMetrics = {
  async trackTokenUsage(tokenId, action) {
    await prisma.tokenUsage.create({
      data: {
        tokenId,
        action, // 'created', 'validated', 'refreshed', 'revoked'
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
  },
  
  async getTokenStats(timeframe = '24h') {
    const since = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    return await prisma.tokenUsage.groupBy({
      by: ['action'],
      where: {
        timestamp: {
          gte: since
        }
      },
      _count: {
        action: true
      }
    });
  }
};
```

### Security Monitoring

Monitor for token-related security events:

```javascript
const securityMonitoring = {
  async checkSuspiciousActivity(userId) {
    const oneHour = new Date(Date.now() - (60 * 60 * 1000));
    
    const recentFailures = await prisma.authenticationLog.count({
      where: {
        userId,
        success: false,
        timestamp: { gte: oneHour }
      }
    });
    
    if (recentFailures > 5) {
      await this.alertSecurityTeam('Multiple failed authentications', {
        userId,
        failureCount: recentFailures,
        timeframe: '1 hour'
      });
    }
  },
  
  async detectTokenAnomaly(tokenId, currentRequest) {
    const recentUsage = await prisma.tokenUsage.findMany({
      where: { tokenId },
      orderBy: { timestamp: 'desc' },
      take: 10
    });
    
    // Check for unusual patterns
    const uniqueIPs = new Set(recentUsage.map(usage => usage.ipAddress));
    if (uniqueIPs.size > 3) {
      await this.flagSuspiciousToken(tokenId, 'Multiple IP addresses');
    }
  }
};
```

## Token Best Practices

### Development Best Practices

1. **Never Log Tokens** - Ensure tokens never appear in logs
2. **Use Environment Variables** - Store secrets in environment variables
3. **Implement Token Rotation** - Regular token refresh
4. **Validate All Claims** - Comprehensive JWT validation
5. **Monitor Token Usage** - Track and alert on anomalies

### Production Best Practices

1. **Strong Secrets** - Use cryptographically secure JWT secrets
2. **HTTPS Only** - All token transmission over HTTPS
3. **Short Lifetimes** - Minimize token lifetime
4. **Regular Rotation** - Rotate refresh tokens periodically
5. **Audit Logging** - Log all token operations

### Security Checklist

- [ ] JWT secrets are at least 32 characters
- [ ] Tokens are encrypted at rest
- [ ] Token transmission uses HTTPS
- [ ] Expired tokens are properly cleaned up
- [ ] Token revocation is implemented
- [ ] Suspicious activity is monitored
- [ ] Token lifetime is appropriate
- [ ] Refresh mechanism is secure

## Troubleshooting Token Issues

### Common Token Problems

**Token Expired Error**
```javascript
// Handle expired JWT
if (error.name === 'TokenExpiredError') {
  // Attempt refresh if possible
  try {
    const newToken = await refreshTokens();
    return { token: newToken, requiresReauth: false };
  } catch (refreshError) {
    return { token: null, requiresReauth: true };
  }
}
```

**Invalid Token Format**
```javascript
// Validate token format
const validateTokenFormat = (token) => {
  if (!token) {
    throw new Error('Token is required');
  }
  
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  return token;
};
```

**GitHub API Rate Limiting**
```javascript
// Handle GitHub API rate limits
const makeGitHubAPICall = async (endpoint, token) => {
  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (response.status === 403) {
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    if (rateLimitReset) {
      const resetTime = new Date(parseInt(rateLimitReset) * 1000);
      throw new Error(`Rate limit exceeded. Resets at ${resetTime}`);
    }
  }
  
  return response;
};
```

## Emergency Token Procedures

### Token Compromise Response

If token compromise is suspected:

```javascript
const emergencyTokenRevocation = async (reason) => {
  try {
    // Revoke all GitHub tokens
    await revokeGitHubTokens();
    
    // Clear all stored tokens
    await prisma.settings.deleteMany({});
    
    // Log security incident
    securityLogger.error('Emergency Token Revocation', {
      reason,
      timestamp: new Date().toISOString(),
      action: 'all_tokens_revoked'
    });
    
    // Force re-authentication for all clients
    io.emit('force-logout', { reason: 'Security incident' });
    
  } catch (error) {
    securityLogger.error('Emergency revocation failed', { error: error.message });
  }
};
```

### Token Recovery Procedures

Procedures for token recovery after incidents:

1. **Verify Security** - Ensure threat is eliminated
2. **Generate New Secrets** - Create new JWT secrets
3. **Clear All Tokens** - Remove all stored tokens
4. **Force Re-authentication** - Require fresh login
5. **Monitor Activity** - Watch for continued threats
6. **Document Incident** - Record details for future prevention

## Next Steps

- **[API Endpoints](/docs/api/endpoints/):** API authentication requirements
- **[WebSocket Events](/docs/api/websocket/):** Real-time authentication
- **[Database Schema](/docs/database/schema/):** Token storage implementation