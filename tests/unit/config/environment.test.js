import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Configuration', () => {
  let originalEnv;
  let originalConsole;

  beforeEach(() => {
    // Store original environment and console
    originalEnv = { ...process.env };
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };

    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();

    // Clear modules cache to ensure fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment and console
    process.env = originalEnv;
    Object.assign(console, originalConsole);
  });

  describe('default values', () => {
    it('should provide default values when environment variables are not set', async () => {
      // Clear relevant environment variables
      delete process.env.JWT_SECRET;
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.DATABASE_URL;

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      expect(config.JWT_SECRET).toBe('fallback-secret-change-in-production');
      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(3000);
      expect(config.DATABASE_URL).toBe('file:./data/database.db');
      expect(config.MAX_WORKSPACES_PER_USER).toBe(10);
      expect(config.WORKSPACE_CLEANUP_DAYS).toBe(30);
    });

    it('should use environment variables when provided', async () => {
      process.env.JWT_SECRET = 'custom-jwt-secret';
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.DATABASE_URL = 'file:./custom.db';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'http://localhost:8080/auth/callback';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.MAX_WORKSPACES_PER_USER = '20';
      process.env.WORKSPACE_CLEANUP_DAYS = '60';

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      expect(config.JWT_SECRET).toBe('custom-jwt-secret');
      expect(config.NODE_ENV).toBe('production');
      expect(config.PORT).toBe(8080);
      expect(config.DATABASE_URL).toBe('file:./custom.db');
      expect(config.GITHUB_CLIENT_ID).toBe('test-client-id');
      expect(config.GITHUB_CLIENT_SECRET).toBe('test-client-secret');
      expect(config.GITHUB_CALLBACK_URL).toBe('http://localhost:8080/auth/callback');
      expect(config.TENANT_GITHUB_USERNAME).toBe('test-user');
      expect(config.MAX_WORKSPACES_PER_USER).toBe(20);
      expect(config.WORKSPACE_CLEANUP_DAYS).toBe(60);
    });
  });

  describe('validation method', () => {
    it('should warn about fallback JWT secret in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'fallback-secret-change-in-production';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/auth/callback';

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      config.validate();

      expect(console.error).toHaveBeenCalledWith(
        'WARNING: Using fallback JWT secret in production! Set JWT_SECRET environment variable.'
      );
    });

    it('should warn about short JWT secret', async () => {
      process.env.JWT_SECRET = 'short';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/auth/callback';

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      config.validate();

      expect(console.warn).toHaveBeenCalledWith(
        'JWT_SECRET should be at least 32 characters for production use'
      );
    });

    it('should exit when TENANT_GITHUB_USERNAME is not provided', async () => {
      delete process.env.TENANT_GITHUB_USERNAME;
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/auth/callback';

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      config.validate();

      expect(console.error).toHaveBeenCalledWith(
        'ERROR: TENANT_GITHUB_USERNAME is required for single-tenant mode'
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should exit when GitHub OAuth credentials are missing', async () => {
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      config.validate();

      expect(console.error).toHaveBeenCalledWith(
        'ERROR: GitHub OAuth credentials (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET) are required'
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should exit when GITHUB_CALLBACK_URL is missing', async () => {
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      delete process.env.GITHUB_CALLBACK_URL;

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      config.validate();

      expect(console.error).toHaveBeenCalledWith(
        'ERROR: GITHUB_CALLBACK_URL is required for OAuth flow'
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should log success message when all validations pass', async () => {
      process.env.JWT_SECRET = 'a-very-long-jwt-secret-that-is-definitely-more-than-32-characters';
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/auth/callback';

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      config.validate();

      expect(console.log).toHaveBeenCalledWith(
        'Environment validated: development mode on port 3000 for tenant: test-user'
      );
    });
  });

  describe('port parsing', () => {
    it('should parse PORT as integer', async () => {
      process.env.PORT = '5000';

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      expect(config.PORT).toBe(5000);
      expect(typeof config.PORT).toBe('number');
    });

    it('should handle invalid PORT values', async () => {
      process.env.PORT = 'invalid';

      const environment = await import('@/config/environment.js');
      const config = environment.default;

      expect(config.PORT).toBe(3000); // Should fall back to default
    });
  });
});