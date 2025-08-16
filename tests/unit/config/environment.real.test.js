import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Configuration - Real Implementation', () => {
  let originalEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Clear modules cache to ensure fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('default values', () => {
    it('should provide default values when environment variables are not set', async () => {
      // Clear relevant environment variables
      delete process.env.JWT_SECRET;
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.DATABASE_URL;

      const environment = await import('../../../src/config/environment.js');
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

      const environment = await import('../../../src/config/environment.js');
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
    it('should not crash when calling validate with valid config', async () => {
      process.env.JWT_SECRET = 'a-very-long-jwt-secret-that-is-definitely-more-than-32-characters';
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';
      process.env.TENANT_GITHUB_USERNAME = 'test-user';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/auth/callback';

      const environment = await import('../../../src/config/environment.js');
      const config = environment.default;

      // Mock console to avoid output during tests
      const originalConsole = global.console;
      global.console = {
        ...console,
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      };

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

      // Should not throw or exit
      expect(() => config.validate()).not.toThrow();
      expect(mockExit).not.toHaveBeenCalled();

      // Restore
      global.console = originalConsole;
      mockExit.mockRestore();
    });
  });

  describe('port parsing', () => {
    it('should parse PORT as integer', async () => {
      process.env.PORT = '5000';

      const environment = await import('../../../src/config/environment.js');
      const config = environment.default;

      expect(config.PORT).toBe(5000);
      expect(typeof config.PORT).toBe('number');
    });

    it('should handle invalid PORT values', async () => {
      process.env.PORT = 'invalid';

      const environment = await import('../../../src/config/environment.js');
      const config = environment.default;

      expect(config.PORT).toBe(3000); // Should fall back to default
    });
  });

  describe('configuration properties', () => {
    it('should have all required properties', async () => {
      const environment = await import('../../../src/config/environment.js');
      const config = environment.default;

      expect(config).toHaveProperty('JWT_SECRET');
      expect(config).toHaveProperty('NODE_ENV');
      expect(config).toHaveProperty('PORT');
      expect(config).toHaveProperty('DATABASE_URL');
      expect(config).toHaveProperty('GITHUB_CLIENT_ID');
      expect(config).toHaveProperty('GITHUB_CLIENT_SECRET');
      expect(config).toHaveProperty('GITHUB_CALLBACK_URL');
      expect(config).toHaveProperty('TENANT_GITHUB_USERNAME');
      expect(config).toHaveProperty('MAX_WORKSPACES_PER_USER');
      expect(config).toHaveProperty('WORKSPACE_CLEANUP_DAYS');
      expect(config).toHaveProperty('validate');
    });

    it('should have validate as a function', async () => {
      const environment = await import('../../../src/config/environment.js');
      const config = environment.default;

      expect(typeof config.validate).toBe('function');
    });
  });
});