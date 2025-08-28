// Mock console methods
const originalConsole = { ...console };

describe('Environment Configuration', () => {
  let environment;
  let mockProcessExit;
  let originalEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Mock console methods
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
    
    // Mock process.exit
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    
    // Clear require cache and get fresh module
    delete require.cache[require.resolve('../../src/config/environment')];
    environment = require('../../src/config/environment');
  });

  afterEach(() => {
    // Restore console
    Object.assign(console, originalConsole);
    mockProcessExit.mockRestore();
    // Restore environment
    process.env = originalEnv;
    // Clear require cache
    delete require.cache[require.resolve('../../src/config/environment')];
  });

  describe('Default Values', () => {
    beforeEach(() => {
      // Clear all environment variables to test defaults
      process.env = {};
    });

    it('should use fallback JWT secret', () => {
      expect(environment.JWT_SECRET).toBe('fallback-secret-change-in-production');
    });

    it('should default to development environment', () => {
      expect(environment.NODE_ENV).toBe('development');
    });

    it('should default to port 3014', () => {
      expect(environment.PORT).toBe(3014);
    });

    it('should default to SQLite database URL', () => {
      expect(environment.DATABASE_URL).toBe('file:./data/database.db');
    });

    it('should default workspace cleanup days to 30', () => {
      expect(environment.WORKSPACE_CLEANUP_DAYS).toBe(30);
    });

    it('should default log level to debug in development', () => {
      expect(environment.LOG_LEVEL).toBe('debug');
    });

    it('should default log configuration', () => {
      expect(environment.LOG_MAX_SIZE).toBe('20m');
      expect(environment.LOG_MAX_FILES).toBe('30d');
      expect(environment.LOG_COMPRESS).toBe(true);
    });
  });

  describe('Environment Variable Reading', () => {
    beforeEach(() => {
      // Set environment variables directly
      process.env.JWT_SECRET = 'custom-jwt-secret-with-enough-characters';
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
      process.env.GITHUB_CLIENT_ID = 'github-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'https://app.com/auth/callback';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.WORKSPACE_CLEANUP_DAYS = '60';
      process.env.FRONTEND_URL = 'https://frontend.com';
      process.env.ALLOWED_ORIGINS = 'https://origin1.com,https://origin2.com';
      process.env.LOG_LEVEL = 'warn';
      process.env.LOG_MAX_SIZE = '50m';
      process.env.LOG_MAX_FILES = '60d';
      process.env.LOG_COMPRESS = 'false';
    });


    it('should read JWT secret from environment', () => {
      expect(environment.JWT_SECRET).toBe('custom-jwt-secret-with-enough-characters');
    });

    it('should read Node environment', () => {
      expect(environment.NODE_ENV).toBe('production');
    });

    it('should parse port as integer', () => {
      expect(environment.PORT).toBe(8080);
    });

    it('should read database URL', () => {
      expect(environment.DATABASE_URL).toBe('postgresql://user:pass@host:5432/db');
    });

    it('should read GitHub configuration', () => {
      expect(environment.GITHUB_CLIENT_ID).toBe('github-client-id');
      expect(environment.GITHUB_CLIENT_SECRET).toBe('github-client-secret');
      expect(environment.GITHUB_CALLBACK_URL).toBe('https://app.com/auth/callback');
    });

    it('should read tenant username', () => {
      expect(environment.TENANT_GITHUB_USERNAME).toBe('test-user');
    });

    it('should parse workspace cleanup days as integer', () => {
      expect(environment.WORKSPACE_CLEANUP_DAYS).toBe(60);
    });

    it('should read optional configuration', () => {
      expect(environment.FRONTEND_URL).toBe('https://frontend.com');
      expect(environment.ALLOWED_ORIGINS).toBe('https://origin1.com,https://origin2.com');
    });

    it('should read logging configuration', () => {
      expect(environment.LOG_LEVEL).toBe('warn');
      expect(environment.LOG_MAX_SIZE).toBe('50m');
      expect(environment.LOG_MAX_FILES).toBe('60d');
      expect(environment.LOG_COMPRESS).toBe(false);
    });
  });

  describe('Production Log Level Default', () => {
    beforeEach(() => {
      // Set production environment without LOG_LEVEL
      process.env = { NODE_ENV: 'production' };
    });

    it('should default to info log level in production', () => {
      expect(environment.LOG_LEVEL).toBe('info');
    });
  });

  describe('Validation', () => {

    it('should pass validation with all required variables', () => {
      // Set all required environment variables
      process.env.JWT_SECRET = 'a-very-long-jwt-secret-that-is-secure';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'github-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'https://app.com/auth/callback';
      
      environment.validate();

      expect(console.log).toHaveBeenCalledWith(
        'Environment validated: test mode on port 3001 for tenant: test-user'
      );
    });

    it('should warn about fallback JWT secret in production', () => {
      // Set production environment with required variables but no JWT_SECRET
      delete process.env.JWT_SECRET; // Remove Jest setup value
      process.env.NODE_ENV = 'production';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'github-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'https://app.com/auth/callback';

      environment.validate();

      expect(console.error).toHaveBeenCalledWith(
        'WARNING: Using fallback JWT secret in production! Set JWT_SECRET environment variable.'
      );
    });

    it('should warn about short JWT secret', () => {
      // Set environment with short JWT secret
      process.env.JWT_SECRET = 'short';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'github-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'https://app.com/auth/callback';

      environment.validate();

      expect(console.warn).toHaveBeenCalledWith(
        'JWT_SECRET should be at least 32 characters for production use'
      );
    });

    it('should exit if TENANT_GITHUB_USERNAME is missing', () => {
      // Set environment without TENANT_GITHUB_USERNAME
      process.env = {
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
        GITHUB_CALLBACK_URL: 'https://app.com/auth/callback'
      };

      environment.validate();

      expect(console.error).toHaveBeenCalledWith(
        'ERROR: TENANT_GITHUB_USERNAME is required for single-tenant mode'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit if GitHub OAuth credentials are missing', () => {
      // Set environment without GitHub client ID
      process.env = {
        TENANT_GITHUB_USERNAME: 'test-user',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
        GITHUB_CALLBACK_URL: 'https://app.com/auth/callback'
      };

      environment.validate();

      expect(console.error).toHaveBeenCalledWith(
        'ERROR: GitHub OAuth credentials (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET) are required'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit if GitHub callback URL is missing', () => {
      // Set environment without GitHub callback URL
      process.env = {
        TENANT_GITHUB_USERNAME: 'test-user',
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret'
      };

      environment.validate();

      expect(console.error).toHaveBeenCalledWith(
        'ERROR: GITHUB_CALLBACK_URL is required for OAuth flow'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Module Structure', () => {
    beforeEach(() => {
      // Set minimal required environment variables
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'client-id';
      process.env.GITHUB_CLIENT_SECRET = 'client-secret';
      process.env.GITHUB_CALLBACK_URL = 'https://app.com/callback';
    });

    it('should export all required properties', () => {
      const requiredProps = [
        'JWT_SECRET', 'NODE_ENV', 'PORT', 'DATABASE_URL',
        'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL',
        'TENANT_GITHUB_USERNAME', 'WORKSPACE_CLEANUP_DAYS',
        'FRONTEND_URL', 'ALLOWED_ORIGINS',
        'LOG_LEVEL', 'LOG_MAX_SIZE', 'LOG_MAX_FILES', 'LOG_COMPRESS'
      ];

      requiredProps.forEach(prop => {
        expect(environment).toHaveProperty(prop);
      });
    });

    it('should export validate function', () => {
      expect(typeof environment.validate).toBe('function');
    });
  });
});