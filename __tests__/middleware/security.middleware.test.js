const crypto = require('crypto');
const {
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
} = require('../../src/middleware/security.middleware');

// Mock crypto
jest.mock('crypto');

describe('Security Middleware', () => {
  let req, res, next, app;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      method: 'POST',
      path: '/api/test',
      headers: {},
      body: {},
      query: {},
      user: { userId: 'test-user-123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    next = jest.fn();
    app = {
      set: jest.fn()
    };
    
    jest.clearAllMocks();
    
    // Mock crypto.randomBytes
    crypto.randomBytes.mockReturnValue({
      toString: jest.fn().mockReturnValue('mock-csrf-token-hex')
    });
  });

  describe('createRateLimiter', () => {
    it('should allow requests within rate limit', () => {
      const rateLimiter = createRateLimiter(60000, 5, 'test');
      
      rateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should block requests when rate limit exceeded', () => {
      const rateLimiter = createRateLimiter(60000, 1, 'test-limit');
      
      // First request should pass
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Second request should be blocked
      rateLimiter(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        message: 'Rate limit exceeded for test-limit operations',
        retryAfter: 60
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should skip rate limiting in test environment when disabled', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalDisableFlag = process.env.DISABLE_RATE_LIMITING;
      
      process.env.NODE_ENV = 'test';
      process.env.DISABLE_RATE_LIMITING = 'true';
      
      const rateLimiter = createRateLimiter(60000, 0, 'test-skip');
      
      rateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
      process.env.DISABLE_RATE_LIMITING = originalDisableFlag;
    });
  });

  describe('securityHeaders', () => {
    it('should set basic security headers', () => {
      securityHeaders(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(next).toHaveBeenCalled();
    });

    it('should set HSTS header in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      securityHeaders(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      expect(next).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize malicious script tags from body', () => {
      req.body = {
        message: '<script>alert("xss")</script>Hello',
        data: 'javascript:alert("xss")',
        event: 'onclick=alert("xss")'
      };
      
      sanitizeInput(req, res, next);
      
      expect(req.body.message).toBe('Hello');
      expect(req.body.data).toBe('alert("xss")');
      expect(req.body.event).toBe('alert("xss")');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      req.query = {
        search: '<script>alert("xss")</script>Safe search',
        param: 'javascript:malicious()'
      };
      
      sanitizeInput(req, res, next);
      
      expect(req.query.search).toBe('Safe search');
      expect(req.query.param).toBe('malicious()');
      expect(next).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      req.body = {
        user: {
          name: '<script>evil</script>John',
          profile: {
            bio: 'javascript:hack()'
          }
        }
      };
      
      sanitizeInput(req, res, next);
      
      expect(req.body.user.name).toBe('John');
      expect(req.body.user.profile.bio).toBe('hack()');
      expect(next).toHaveBeenCalled();
    });

    it('should handle non-string values', () => {
      req.body = {
        count: 42,
        active: true,
        data: null
      };
      
      sanitizeInput(req, res, next);
      
      expect(req.body.count).toBe(42);
      expect(req.body.active).toBe(true);
      expect(req.body.data).toBe(null);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('setupTrustProxy', () => {
    it('should set trust proxy in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      setupTrustProxy(app);
      
      expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not set trust proxy in development', () => {
      setupTrustProxy(app);
      
      expect(app.set).not.toHaveBeenCalled();
    });
  });

  describe('createCSRFToken', () => {
    it('should skip CSRF for GET requests', () => {
      req.method = 'GET';
      
      createCSRFToken(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
    });

    it('should skip CSRF for health endpoints', () => {
      req.path = '/health/status';
      
      createCSRFToken(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
    });

    it('should generate CSRF token for authenticated users', () => {
      createCSRFToken(req, res, next);
      
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', 'mock-csrf-token-hex');
      expect(req.csrfToken).toBe('mock-csrf-token-hex');
      expect(next).toHaveBeenCalled();
    });

    it('should not generate CSRF token for unauthenticated requests', () => {
      req.user = null;
      
      createCSRFToken(req, res, next);
      
      expect(res.setHeader).not.toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateCSRFToken', () => {
    it('should skip CSRF validation for GET requests', () => {
      req.method = 'GET';
      
      validateCSRFToken(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should skip CSRF validation for health endpoints', () => {
      req.path = '/health/check';
      
      validateCSRFToken(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should skip CSRF validation for auth endpoints', () => {
      req.path = '/api/auth/login';
      
      validateCSRFToken(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should skip CSRF validation in test environment when disabled', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalDisableFlag = process.env.DISABLE_CSRF;
      
      process.env.NODE_ENV = 'test';
      process.env.DISABLE_CSRF = 'true';
      
      validateCSRFToken(req, res, next);
      
      expect(next).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
      process.env.DISABLE_CSRF = originalDisableFlag;
    });

    it('should return 403 when CSRF token is missing', () => {
      validateCSRFToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token missing' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when CSRF token is invalid', () => {
      req.headers['x-csrf-token'] = 'invalid-token';
      
      validateCSRFToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid CSRF token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('pre-configured rate limiters', () => {
    it('should have authRateLimit configured', () => {
      expect(typeof authRateLimit).toBe('function');
    });

    it('should have githubRateLimit configured', () => {
      expect(typeof githubRateLimit).toBe('function');
    });

    it('should have workspaceRateLimit configured', () => {
      expect(typeof workspaceRateLimit).toBe('function');
    });

    it('should have generalRateLimit configured', () => {
      expect(typeof generalRateLimit).toBe('function');
    });
  });
});