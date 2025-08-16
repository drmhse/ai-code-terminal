import { describe, it, expect, vi } from 'vitest';

describe('Coverage Focused Test Suite', () => {
  describe('Environment Configuration', () => {
    it('should load and provide environment configuration', async () => {
      // Test environment loading
      process.env.JWT_SECRET = 'test-jwt-secret-key-32-chars-long';
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3001';

      const environment = await import('../src/config/environment.js');
      const config = environment.default;

      expect(config).toBeDefined();
      expect(config.JWT_SECRET).toBe('test-jwt-secret-key-32-chars-long');
      expect(config.NODE_ENV).toBe('test');
      expect(config.PORT).toBe(3001);
      expect(config.validate).toBeDefined();
      expect(typeof config.validate).toBe('function');
    });
  });

  describe('HTTP Status Constants', () => {
    it('should provide HTTP status constants', async () => {
      const constants = await import('../src/config/constants.js');
      
      expect(constants.default).toBeDefined();
      expect(constants.default.HTTP_STATUS).toBeDefined();
      
      const status = constants.default.HTTP_STATUS;
      expect(status.OK).toBe(200);
      expect(status.CREATED).toBe(201);
      expect(status.BAD_REQUEST).toBe(400);
      expect(status.UNAUTHORIZED).toBe(401);
      expect(status.NOT_FOUND).toBe(404);
      expect(status.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('Validation Utilities', () => {
    it('should provide validation functions', async () => {
      const validation = await import('../src/utils/validation.js');
      const validator = validation.default;
      
      expect(validator).toBeDefined();
      expect(validator.isValidEmail).toBeDefined();
      expect(validator.isValidUsername).toBeDefined();
      expect(validator.isValidPassword).toBeDefined();
      expect(validator.isValidRepoUrl).toBeDefined();
      expect(validator.sanitizeInput).toBeDefined();
      
      // Test email validation
      expect(validator.isValidEmail('test@example.com')).toBe(true);
      expect(validator.isValidEmail('invalid-email')).toBe(false);
      expect(validator.isValidEmail('')).toBe(false);
      
      // Test username validation
      expect(validator.isValidUsername('validuser')).toBe(true);
      expect(validator.isValidUsername('user123')).toBe(true);
      expect(validator.isValidUsername('')).toBe(false);
      expect(validator.isValidUsername('a')).toBe(false);
      
      // Test password validation
      expect(validator.isValidPassword('password123')).toBe(true);
      expect(validator.isValidPassword('123')).toBe(false);
      
      // Test repo URL validation
      expect(validator.isValidRepoUrl('https://github.com/owner/repo')).toBe(true);
      expect(validator.isValidRepoUrl('invalid')).toBe(false);
      
      // Test input sanitization
      expect(validator.sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(validator.sanitizeInput('normal text')).toBe('normal text');
    });
  });

  describe('Logger Utilities', () => {
    it('should provide logger with all levels', async () => {
      const logger = await import('../src/utils/logger.js');
      
      expect(logger.default).toBeDefined();
      expect(logger.default.info).toBeDefined();
      expect(logger.default.error).toBeDefined();
      expect(logger.default.warn).toBeDefined();
      expect(logger.default.debug).toBeDefined();
      
      expect(typeof logger.default.info).toBe('function');
      expect(typeof logger.default.error).toBe('function');
      expect(typeof logger.default.warn).toBe('function');
      expect(typeof logger.default.debug).toBe('function');
    });
  });

  describe('Encryption Utilities', () => {
    it('should provide encryption and decryption functions', async () => {
      const encryption = await import('../src/utils/encryption.js');
      
      expect(encryption.default).toBeDefined();
      expect(encryption.default.encryptToken).toBeDefined();
      expect(encryption.default.decryptToken).toBeDefined();
      
      expect(typeof encryption.default.encryptToken).toBe('function');
      expect(typeof encryption.default.decryptToken).toBe('function');
    });
  });

  describe('Process Utilities', () => {
    it('should provide process management functions', async () => {
      const processUtils = await import('../src/utils/process.js');
      
      expect(processUtils.gracefulShutdown).toBeDefined();
      expect(processUtils.handleSignals).toBeDefined();
      
      expect(typeof processUtils.gracefulShutdown).toBe('function');
      expect(typeof processUtils.handleSignals).toBe('function');
    });
  });

  describe('Authentication Middleware', () => {
    it('should provide authentication functions', async () => {
      const authMiddleware = await import('../src/middleware/auth.middleware.js');
      
      expect(authMiddleware.authenticateToken).toBeDefined();
      expect(authMiddleware.authenticateSocket).toBeDefined();
      
      expect(typeof authMiddleware.authenticateToken).toBe('function');
      expect(typeof authMiddleware.authenticateSocket).toBe('function');
      
      // Functions should have correct arity
      expect(authMiddleware.authenticateToken.length).toBe(3); // req, res, next
      expect(authMiddleware.authenticateSocket.length).toBe(2); // socket, next
    });
  });

  describe('Error Middleware', () => {
    it('should provide error handling functions', async () => {
      const errorMiddleware = await import('../src/middleware/error.middleware.js');
      
      expect(errorMiddleware.errorHandler).toBeDefined();
      expect(errorMiddleware.notFoundHandler).toBeDefined();
      
      expect(typeof errorMiddleware.errorHandler).toBe('function');
      expect(typeof errorMiddleware.notFoundHandler).toBe('function');
      
      // Error handler should have 4 parameters (err, req, res, next)
      expect(errorMiddleware.errorHandler.length).toBe(4);
      // Not found handler should have 3 parameters (req, res, next)
      expect(errorMiddleware.notFoundHandler.length).toBe(3);
    });
  });

  describe('GitHub Service', () => {
    it('should provide GitHub service methods', async () => {
      const githubService = await import('../src/services/github.service.js');
      
      expect(githubService.default).toBeDefined();
      expect(githubService.default.isConfigured).toBeDefined();
      expect(githubService.default.generateState).toBeDefined();
      expect(githubService.default.verifyState).toBeDefined();
      expect(githubService.default.encryptToken).toBeDefined();
      expect(githubService.default.decryptToken).toBeDefined();
      
      expect(typeof githubService.default.isConfigured).toBe('function');
      expect(typeof githubService.default.generateState).toBe('function');
      expect(typeof githubService.default.verifyState).toBe('function');
    });
  });

  describe('Settings Service', () => {
    it('should provide settings service methods', async () => {
      const settingsService = await import('../src/services/settings.service.js');
      
      expect(settingsService.default).toBeDefined();
      expect(settingsService.default._getDefaultTheme).toBeDefined();
      expect(settingsService.default._decryptTokens).toBeDefined();
      
      expect(typeof settingsService.default._getDefaultTheme).toBe('function');
      expect(typeof settingsService.default._decryptTokens).toBeDefined();
      
      // Test default theme
      const defaultTheme = settingsService.default._getDefaultTheme();
      expect(defaultTheme).toBeDefined();
      expect(defaultTheme.name).toBeDefined();
      expect(defaultTheme.type).toBeDefined();
      expect(defaultTheme.colors).toBeDefined();
    });
  });

  describe('Shell Service', () => {
    it('should provide shell service with session management', async () => {
      const shellService = await import('../src/services/shell.service.js');
      
      expect(shellService.default).toBeDefined();
      expect(shellService.default.activeSessions).toBeDefined();
      expect(shellService.default.socketToWorkspace).toBeDefined();
      expect(shellService.default.isProcessAlive).toBeDefined();
      expect(shellService.default.addToBuffer).toBeDefined();
      
      expect(shellService.default.activeSessions instanceof Map).toBe(true);
      expect(shellService.default.socketToWorkspace instanceof Map).toBe(true);
      expect(typeof shellService.default.isProcessAlive).toBe('function');
      expect(typeof shellService.default.addToBuffer).toBe('function');
    });
  });

  describe('Workspace Service', () => {
    it('should provide workspace service methods', async () => {
      const workspaceService = await import('../src/services/workspace.service.js');
      
      expect(workspaceService.default).toBeDefined();
      expect(workspaceService.default.validateRepositoryName).toBeDefined();
      expect(workspaceService.default.generateLocalPath).toBeDefined();
      
      expect(typeof workspaceService.default.validateRepositoryName).toBe('function');
      expect(typeof workspaceService.default.generateLocalPath).toBe('function');
    });
  });

  describe('Controllers', () => {
    it('should provide GitHub controller functions', async () => {
      const githubController = await import('../src/controllers/github.controller.js');
      
      expect(githubController.initiateAuth).toBeDefined();
      expect(githubController.handleCallback).toBeDefined();
      expect(githubController.getRepositories).toBeDefined();
      expect(githubController.getAuthStatus).toBeDefined();
      
      expect(typeof githubController.initiateAuth).toBe('function');
      expect(typeof githubController.handleCallback).toBe('function');
      expect(typeof githubController.getRepositories).toBe('function');
      expect(typeof githubController.getAuthStatus).toBe('function');
    });

    it('should provide health controller functions', async () => {
      const healthController = await import('../src/controllers/health.controller.js');
      
      expect(healthController.healthCheck).toBeDefined();
      expect(healthController.detailedHealth).toBeDefined();
      
      expect(typeof healthController.healthCheck).toBe('function');
      expect(typeof healthController.detailedHealth).toBe('function');
    });
  });

  describe('Socket Handlers', () => {
    it('should provide socket authentication', async () => {
      const socketAuth = await import('../src/socket/auth.socket.js');
      
      expect(socketAuth.authenticateSocket).toBeDefined();
      expect(typeof socketAuth.authenticateSocket).toBe('function');
    });

    it('should provide socket handler', async () => {
      const socketHandler = await import('../src/socket/socket.handler.js');
      
      expect(socketHandler.default).toBeDefined();
      expect(typeof socketHandler.default).toBe('function');
    });
  });

  describe('Application Structure', () => {
    it('should create Express application', async () => {
      const app = await import('../src/app.js');
      
      expect(app.default).toBeDefined();
      // Express app can be either function or object depending on how it's exported
      expect(['function', 'object']).toContain(typeof app.default);
    });
  });

  describe('Advanced Validation Tests', () => {
    it('should handle various validation edge cases', async () => {
      const validation = await import('../src/utils/validation.js');
      const validator = validation.default;
      
      // Test GitHub token validation
      expect(validator.isValidGitHubToken).toBeDefined();
      expect(validator.isValidGitHubToken('ghp_1234567890abcdef1234567890abcdef12345678')).toBe(true);
      expect(validator.isValidGitHubToken('github_pat_1234567890abcdef')).toBe(true);
      expect(validator.isValidGitHubToken('invalid-token')).toBe(false);
      
      // Test path validation
      expect(validator.isValidPath).toBeDefined();
      expect(validator.isValidPath('/valid/path')).toBe(true);
      expect(validator.isValidPath('path<with>invalid:chars')).toBe(false);
      
      // Test validation results
      expect(validator.validateRequest).toBeDefined();
      const validationResult = validator.validateRequest({});
      expect(validationResult).toBeDefined();
      expect(validationResult.valid).toBeDefined();
      expect(validationResult.errors).toBeDefined();
    });
  });

  describe('Security and CORS', () => {
    it('should provide CORS configuration', async () => {
      const corsConfig = await import('../src/config/cors.js');
      
      expect(corsConfig.default).toBeDefined();
      expect(corsConfig.default.origin).toBeDefined();
      expect(corsConfig.default.credentials).toBeDefined();
    });
  });
});