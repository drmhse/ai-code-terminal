// Security middleware for rate limiting and input sanitization
// Future: Can be enhanced with libraries like express-rate-limit and helmet

const crypto = require('crypto');
const rateLimit = new Map(); // In-memory rate limiting (Future: Redis-based)
const csrfTokens = new Map(); // In-memory CSRF tokens (Future: Redis-based)

function createRateLimiter(windowMs = 15 * 60 * 1000, maxRequests = 100, keyPrefix = 'general') {
  return function rateLimitMiddleware(req, res, next) {
    // Skip rate limiting in test environment if disabled
    if (process.env.NODE_ENV === 'test' && process.env.DISABLE_RATE_LIMITING === 'true') {
      return next();
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    const key = `${keyPrefix}:${clientIp}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    if (!rateLimit.has(key)) {
      rateLimit.set(key, []);
    }
    
    const requests = rateLimit.get(key);
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded for ${keyPrefix} operations`,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    validRequests.push(now);
    rateLimit.set(key, validRequests);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - validRequests.length));
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
    
    next();
  };
}

// Specific rate limiters for different operations
const authRateLimit = createRateLimiter(15 * 60 * 1000, 5, 'auth'); // 5 auth attempts per 15 minutes
const githubRateLimit = createRateLimiter(60 * 1000, 30, 'github'); // 30 GitHub API calls per minute
const workspaceRateLimit = createRateLimiter(5 * 60 * 1000, 10, 'workspace'); // 10 workspace ops per 5 minutes
const generalRateLimit = createRateLimiter(15 * 60 * 1000, 100, 'general'); // 100 requests per 15 minutes

// Basic security headers
function securityHeaders(req, res, next) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

// Input sanitization
function sanitizeInput(req, res, next) {
  // Basic input sanitization
  function sanitize(obj) {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    } else if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  }
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  next();
}

// Trust proxy settings for production
function setupTrustProxy(app) {
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
}

// CSRF Protection
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createCSRFToken(req, res, next) {
  // Skip CSRF for GET requests and API endpoints that don't need it
  if (req.method === 'GET' || req.path.startsWith('/health')) {
    return next();
  }

  // Generate CSRF token for authenticated requests
  if (req.user) {
    const token = generateCSRFToken();
    const key = `${req.user.userId}_${Date.now()}`;
    
    // Store token with expiration (15 minutes)
    csrfTokens.set(key, {
      token,
      userId: req.user.userId,
      expires: Date.now() + 15 * 60 * 1000
    });

    // Clean up expired tokens periodically
    if (Math.random() < 0.1) { // 10% chance to clean up
      const now = Date.now();
      for (const [k, v] of csrfTokens.entries()) {
        if (v.expires < now) {
          csrfTokens.delete(k);
        }
      }
    }

    res.setHeader('X-CSRF-Token', token);
    req.csrfToken = token;
  }

  next();
}

function validateCSRFToken(req, res, next) {
  // Skip CSRF validation for GET requests, health checks, and auth endpoints
  if (req.method === 'GET' || 
      req.path.startsWith('/health') || 
      req.path.startsWith('/api/auth/login') || 
      req.path.startsWith('/api/auth/register') ||
      req.path.startsWith('/api/auth/refresh')) {
    return next();
  }

  // Skip CSRF in test environment if disabled
  if (process.env.NODE_ENV === 'test' && process.env.DISABLE_CSRF === 'true') {
    return next();
  }

  // Check for CSRF token in header or body
  const token = req.headers['x-csrf-token'] || req.body.csrfToken;
  
  if (!token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  // Find and validate token
  let validToken = false;
  const now = Date.now();
  
  for (const [key, value] of csrfTokens.entries()) {
    if (value.token === token && 
        value.userId === req.user?.userId && 
        value.expires > now) {
      validToken = true;
      // Remove used token (one-time use)
      csrfTokens.delete(key);
      break;
    }
  }

  if (!validToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

module.exports = {
  createRateLimiter,
  authRateLimit,
  githubRateLimit,
  workspaceRateLimit,
  generalRateLimit,
  securityHeaders,
  sanitizeInput,
  setupTrustProxy,
  createCSRFToken,
  validateCSRFToken
};