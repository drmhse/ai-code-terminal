import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should load environment configuration', async () => {
      // Set up environment
      process.env.JWT_SECRET = 'test-jwt-secret-key-32-chars-long';
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3001';

      const environment = await import('../src/config/environment.js');
      const config = environment.default;

      expect(config.JWT_SECRET).toBe('test-jwt-secret-key-32-chars-long');
      expect(config.NODE_ENV).toBe('test');
      expect(config.PORT).toBe(3001);
    });

    it('should provide constants', async () => {
      const constants = await import('../src/config/constants.js');
      
      expect(constants.default).toBeDefined();
      expect(constants.default.HTTP_STATUS).toBeDefined();
      expect(constants.default.HTTP_STATUS.OK).toBe(200);
      expect(constants.default.HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(constants.default.HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(constants.default.HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('Utilities', () => {
    it('should provide validation utilities', async () => {
      const validation = await import('../src/utils/validation.js');
      const validator = validation.default;
      
      expect(validator.isValidEmail).toBeDefined();
      expect(validator.isValidUsername).toBeDefined();
      expect(validator.isValidRepoUrl).toBeDefined();
      expect(validator.sanitizeInput).toBeDefined();
      
      // Test some basic validation
      expect(validator.isValidEmail('test@example.com')).toBe(true);
      expect(validator.isValidEmail('invalid-email')).toBe(false);
      
      expect(validator.isValidUsername('validuser')).toBe(true);
      expect(validator.isValidUsername('')).toBe(false);
      
      expect(validator.isValidRepoUrl('https://github.com/owner/repo')).toBe(true);
      expect(validator.isValidRepoUrl('invalid')).toBe(false);
    });

    it('should provide logger utilities', async () => {
      const logger = await import('../src/utils/logger.js');
      
      expect(logger.default).toBeDefined();
      expect(logger.default.info).toBeDefined();
      expect(logger.default.error).toBeDefined();
      expect(logger.default.warn).toBeDefined();
      expect(logger.default.debug).toBeDefined();
    });

    it('should provide process utilities', async () => {
      const processUtils = await import('../src/utils/process.js');
      
      expect(processUtils.gracefulShutdown).toBeDefined();
      expect(processUtils.handleSignals).toBeDefined();
    });
  });

  describe('Middleware', () => {
    it('should provide authentication middleware', async () => {
      const authMiddleware = await import('../src/middleware/auth.middleware.js');
      
      expect(authMiddleware.authenticateToken).toBeDefined();
      expect(authMiddleware.authenticateSocket).toBeDefined();
      expect(typeof authMiddleware.authenticateToken).toBe('function');
      expect(typeof authMiddleware.authenticateSocket).toBe('function');
    });

    it('should provide error middleware', async () => {
      const errorMiddleware = await import('../src/middleware/error.middleware.js');
      
      expect(errorMiddleware.errorHandler).toBeDefined();
      expect(errorMiddleware.notFoundHandler).toBeDefined();
      expect(typeof errorMiddleware.errorHandler).toBe('function');
      expect(typeof errorMiddleware.notFoundHandler).toBe('function');
    });

    it('should provide security middleware', async () => {
      const securityMiddleware = await import('../src/middleware/security.middleware.js');
      
      expect(securityMiddleware.rateLimiter).toBeDefined();
      expect(securityMiddleware.securityHeaders).toBeDefined();
    });

    it('should provide validation middleware', async () => {
      const validationMiddleware = await import('../src/middleware/validation.middleware.js');
      
      expect(validationMiddleware.validateGitHubCallback).toBeDefined();
      expect(validationMiddleware.validateRepositoryRequest).toBeDefined();
      expect(validationMiddleware.validateWorkspaceRequest).toBeDefined();
    });
  });

  describe('Services Structure', () => {
    it('should provide GitHub service', async () => {
      const githubService = await import('../src/services/github.service.js');
      
      expect(githubService.default).toBeDefined();
      expect(githubService.default.isConfigured).toBeDefined();
      expect(githubService.default.generateState).toBeDefined();
      expect(githubService.default.verifyState).toBeDefined();
    });

    it('should provide settings service', async () => {
      const settingsService = await import('../src/services/settings.service.js');
      
      expect(settingsService.default).toBeDefined();
      expect(settingsService.default._getDefaultTheme).toBeDefined();
    });

    it('should provide shell service', async () => {
      const shellService = await import('../src/services/shell.service.js');
      
      expect(shellService.default).toBeDefined();
      expect(shellService.default.activeSessions).toBeDefined();
      expect(shellService.default.socketToWorkspace).toBeDefined();
    });

    it('should provide workspace service', async () => {
      const workspaceService = await import('../src/services/workspace.service.js');
      
      expect(workspaceService.default).toBeDefined();
      expect(workspaceService.default.validateRepositoryName).toBeDefined();
      expect(workspaceService.default.generateLocalPath).toBeDefined();
    });
  });

  describe('Controllers Structure', () => {
    it('should provide GitHub controller', async () => {
      const githubController = await import('../src/controllers/github.controller.js');
      
      expect(githubController.initiateAuth).toBeDefined();
      expect(githubController.handleCallback).toBeDefined();
      expect(githubController.getRepositories).toBeDefined();
      expect(githubController.getAuthStatus).toBeDefined();
    });

    it('should provide health controller', async () => {
      const healthController = await import('../src/controllers/health.controller.js');
      
      expect(healthController.healthCheck).toBeDefined();
      expect(healthController.detailedHealth).toBeDefined();
    });
  });

  describe('Socket Structure', () => {
    it('should provide socket authentication', async () => {
      const socketAuth = await import('../src/socket/auth.socket.js');
      
      expect(socketAuth.authenticateSocket).toBeDefined();
    });

    it('should provide socket handler', async () => {
      const socketHandler = await import('../src/socket/socket.handler.js');
      
      expect(socketHandler.default).toBeDefined();
    });
  });

  describe('App Structure', () => {
    it('should create Express app', async () => {
      const app = await import('../src/app.js');
      
      expect(app.default).toBeDefined();
      expect(typeof app.default).toBe('function'); // Express app is a function
    });
  });

  describe('Basic Functionality Tests', () => {
    it('should handle repository URL validation', async () => {
      const validation = await import('../src/utils/validation.js');
      const validator = validation.default;
      
      // Valid repository URLs
      expect(validator.isValidRepoUrl('https://github.com/owner/repo')).toBe(true);
      expect(validator.isValidRepoUrl('https://github.com/github-user/my-repo')).toBe(true);
      expect(validator.isValidRepoUrl('https://github.com/org123/project-name')).toBe(true);
      
      // Invalid repository URLs
      expect(validator.isValidRepoUrl('invalid')).toBe(false);
      expect(validator.isValidRepoUrl('http://example.com')).toBe(false);
      expect(validator.isValidRepoUrl('')).toBe(false);
    });

    it('should handle email validation', async () => {
      const validation = await import('../src/utils/validation.js');
      const validator = validation.default;
      
      // Valid emails
      expect(validator.isValidEmail('test@example.com')).toBe(true);
      expect(validator.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(validator.isValidEmail('user+tag@example.org')).toBe(true);
      
      // Invalid emails
      expect(validator.isValidEmail('invalid-email')).toBe(false);
      expect(validator.isValidEmail('test@')).toBe(false);
      expect(validator.isValidEmail('@example.com')).toBe(false);
      expect(validator.isValidEmail('')).toBe(false);
    });

    it('should handle input sanitization', async () => {
      const validation = await import('../src/utils/validation.js');
      const validator = validation.default;
      
      expect(validator.sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(validator.sanitizeInput('normal text')).toBe('normal text');
      expect(validator.sanitizeInput('')).toBe('');
    });

    it('should handle username validation', async () => {
      const validation = await import('../src/utils/validation.js');
      const validator = validation.default;
      
      // Valid usernames
      expect(validator.isValidUsername('validuser')).toBe(true);
      expect(validator.isValidUsername('user_name')).toBe(true);
      expect(validator.isValidUsername('user123')).toBe(true);
      
      // Invalid usernames
      expect(validator.isValidUsername('')).toBe(false);
      expect(validator.isValidUsername('a')).toBe(false); // Too short
      expect(validator.isValidUsername('user name')).toBe(false); // Space
      expect(validator.isValidUsername('-username')).toBe(false); // Starts with dash
    });
  });

  describe('Error Handling', () => {
    it('should provide error middleware functions', async () => {
      const errorMiddleware = await import('../src/middleware/error.middleware.js');
      
      // Test that error handler is a proper middleware function
      expect(errorMiddleware.errorHandler.length).toBe(4); // Error middleware has 4 params
      expect(errorMiddleware.notFoundHandler.length).toBe(3); // Regular middleware has 3 params
    });
  });

  describe('Security', () => {
    it('should provide security middleware', async () => {
      const securityMiddleware = await import('../src/middleware/security.middleware.js');
      
      expect(securityMiddleware.rateLimiter).toBeDefined();
      expect(securityMiddleware.securityHeaders).toBeDefined();
    });

    it('should provide encryption utilities', async () => {
      const encryption = await import('../src/utils/encryption.js');
      
      expect(encryption.default.encryptToken).toBeDefined();
      expect(encryption.default.decryptToken).toBeDefined();
      expect(typeof encryption.default.encryptToken).toBe('function');
      expect(typeof encryption.default.decryptToken).toBe('function');
    });
  });
});