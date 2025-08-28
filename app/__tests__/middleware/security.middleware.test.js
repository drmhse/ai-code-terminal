// Mock crypto
jest.mock('crypto');

// Mock Prisma - must be before requiring the middleware
const mockPrismaInstance = {
  rateLimit: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({})
  },
  csrfToken: {
    create: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 })
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance)
}));

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

describe('Security Middleware', () => {
  let req, res, next, app, mockPrisma;

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
    
    mockPrisma = mockPrismaInstance;
    
    jest.clearAllMocks();
    
    // Reset Prisma mocks to default values after clearing other mocks
    mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.rateLimit.count.mockResolvedValue(0);
    mockPrisma.rateLimit.create.mockResolvedValue({});
    mockPrisma.csrfToken.create.mockResolvedValue({});
    mockPrisma.csrfToken.findFirst.mockResolvedValue(null);
    mockPrisma.csrfToken.delete.mockResolvedValue({});
    mockPrisma.csrfToken.deleteMany.mockResolvedValue({ count: 0 });
    
    // Mock crypto.randomBytes
    crypto.randomBytes.mockReturnValue({
      toString: jest.fn().mockReturnValue('mock-csrf-token-hex')
    });
  });

  describe('createRateLimiter', () => {
    it('should allow requests within rate limit', async () => {
      const rateLimiter = createRateLimiter(60000, 5, 'test');
      
      await rateLimiter(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should block requests when rate limit exceeded', async () => {
      const rateLimiter = createRateLimiter(60000, 1, 'test-limit');
      
      // Mock count to return 1 (at limit)
      mockPrisma.rateLimit.count.mockResolvedValue(1);
      
      await rateLimiter(req, res, next);
      
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
      
      // Reset modules to reload the environment config with new values
      jest.resetModules();
      const { securityHeaders: securityHeadersReloaded } = require('../../src/middleware/security.middleware');
      
      securityHeadersReloaded(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
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
      
      // Reset modules to reload the environment config with new values
      jest.resetModules();
      const { setupTrustProxy: setupTrustProxyReloaded } = require('../../src/middleware/security.middleware');
      
      setupTrustProxyReloaded(app);
      
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

    it('should generate CSRF token for authenticated users', async () => {
      await createCSRFToken(req, res, next);
      
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

    it('should return 403 when CSRF token is invalid', async () => {
      req.headers['x-csrf-token'] = 'invalid-token';
      
      // Mock the findFirst to return null (invalid token)
      mockPrisma.csrfToken.findFirst.mockResolvedValue(null);
      
      await validateCSRFToken(req, res, next);
      
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