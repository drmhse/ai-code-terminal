// Security middleware for rate limiting and input sanitization
// Database-backed rate limiting and CSRF protection

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function createRateLimiter(windowMs = 15 * 60 * 1000, maxRequests = 100, keyPrefix = 'general') {
  return async function rateLimitMiddleware(req, res, next) {
    // Skip rate limiting in test environment if disabled
    if (process.env.NODE_ENV === 'test' && process.env.DISABLE_RATE_LIMITING === 'true') {
      return next();
    }

    try {
      const clientIp = req.ip || req.connection.remoteAddress;
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      
      // Clean up expired entries for this client/prefix
      await prisma.rateLimit.deleteMany({
        where: {
          clientIp,
          keyPrefix,
          expiresAt: { lt: now }
        }
      });
      
      // Count valid requests in the time window
      const validRequests = await prisma.rateLimit.count({
        where: {
          clientIp,
          keyPrefix,
          requestTime: { gte: windowStart }
        }
      });
      
      if (validRequests >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded for ${keyPrefix} operations`,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      // Record this request
      await prisma.rateLimit.create({
        data: {
          clientIp,
          keyPrefix,
          requestTime: now,
          expiresAt: new Date(now.getTime() + windowMs)
        }
      });
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - validRequests - 1));
      res.setHeader('X-RateLimit-Reset', Math.ceil((now.getTime() + windowMs) / 1000));
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open in case of database error
      next();
    }
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

async function createCSRFToken(req, res, next) {
  // Skip CSRF for GET requests and API endpoints that don't need it
  if (req.method === 'GET' || req.path.startsWith('/health')) {
    return next();
  }

  try {
    // Generate CSRF token for authenticated requests
    if (req.user) {
      const token = generateCSRFToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
      
      // Store token in database
      await prisma.csrfToken.create({
        data: {
          token,
          userId: req.user.userId,
          expiresAt
        }
      });

      // Periodic cleanup (10% chance)
      if (Math.random() < 0.1) {
        await prisma.csrfToken.deleteMany({
          where: {
            expiresAt: { lt: now }
          }
        });
      }

      res.setHeader('X-CSRF-Token', token);
      req.csrfToken = token;
    }

    next();
  } catch (error) {
    console.error('CSRF token creation error:', error);
    next();
  }
}

async function validateCSRFToken(req, res, next) {
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

  try {
    // Check for CSRF token in header or body
    const token = req.headers['x-csrf-token'] || req.body.csrfToken;
    
    if (!token) {
      return res.status(403).json({ error: 'CSRF token missing' });
    }

    const now = new Date();
    
    // Find and validate token
    const validToken = await prisma.csrfToken.findFirst({
      where: {
        token,
        userId: req.user?.userId,
        expiresAt: { gt: now }
      }
    });

    if (!validToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    // Remove used token (one-time use)
    await prisma.csrfToken.delete({
      where: {
        id: validToken.id
      }
    });

    next();
  } catch (error) {
    console.error('CSRF token validation error:', error);
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }
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