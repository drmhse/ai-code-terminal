import { describe, it, expect, beforeEach } from 'vitest';

describe('Application Integration Tests', () => {
  describe('App Module', () => {
    it('should load the Express application', async () => {
      const app = await import('../../src/app.js');
      
      expect(app.default).toBeDefined();
      // Express app should have listen, use, get, post methods
      expect(app.default.listen).toBeDefined();
      expect(app.default.use).toBeDefined();
      expect(app.default.get).toBeDefined();
      expect(app.default.post).toBeDefined();
    });
  });

  describe('Constants Module', () => {
    it('should provide HTTP status constants', async () => {
      const constants = await import('../../src/config/constants.js');
      
      expect(constants.default).toBeDefined();
      expect(constants.default.HTTP_STATUS).toBeDefined();
      
      const status = constants.default.HTTP_STATUS;
      expect(status.OK).toBe(200);
      expect(status.CREATED).toBe(201);
      expect(status.BAD_REQUEST).toBe(400);
      expect(status.UNAUTHORIZED).toBe(401);
      expect(status.FORBIDDEN).toBe(403);
      expect(status.NOT_FOUND).toBe(404);
      expect(status.INTERNAL_SERVER_ERROR).toBe(500);
    });

    it('should provide WebSocket events', async () => {
      const constants = await import('../../src/config/constants.js');
      
      expect(constants.default.WEBSOCKET_EVENTS).toBeDefined();
      
      const events = constants.default.WEBSOCKET_EVENTS;
      expect(events.CONNECTION).toBeDefined();
      expect(events.DISCONNECT).toBeDefined();
      expect(events.TERMINAL_INPUT).toBeDefined();
      expect(events.TERMINAL_OUTPUT).toBeDefined();
      expect(events.TERMINAL_RESIZE).toBeDefined();
    });

    it('should provide terminal constants', async () => {
      const constants = await import('../../src/config/constants.js');
      
      expect(constants.default.TERMINAL).toBeDefined();
      
      const terminal = constants.default.TERMINAL;
      expect(terminal.DEFAULT_COLS).toBeDefined();
      expect(terminal.DEFAULT_ROWS).toBeDefined();
      expect(terminal.MAX_BUFFER_SIZE).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should provide CORS configuration', async () => {
      const corsConfig = await import('../../src/config/cors.js');
      
      expect(corsConfig.default).toBeDefined();
      expect(corsConfig.default.origin).toBeDefined();
      expect(corsConfig.default.credentials).toBeDefined();
      expect(corsConfig.default.methods).toBeDefined();
      expect(corsConfig.default.allowedHeaders).toBeDefined();
    });
  });

  describe('Logger Module', () => {
    it('should provide logger with all log levels', async () => {
      const logger = await import('../../src/utils/logger.js');
      
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

  describe('Process Utilities', () => {
    it('should provide process management functions', async () => {
      const processUtils = await import('../../src/utils/process.js');
      
      expect(processUtils.gracefulShutdown).toBeDefined();
      expect(processUtils.handleSignals).toBeDefined();
      expect(processUtils.setupGracefulShutdown).toBeDefined();
      
      expect(typeof processUtils.gracefulShutdown).toBe('function');
      expect(typeof processUtils.handleSignals).toBe('function');
      expect(typeof processUtils.setupGracefulShutdown).toBe('function');
    });
  });

  describe('Error Middleware', () => {
    it('should provide comprehensive error handling', async () => {
      const errorMiddleware = await import('../../src/middleware/error.middleware.js');
      
      expect(errorMiddleware.errorHandler).toBeDefined();
      expect(errorMiddleware.notFoundHandler).toBeDefined();
      expect(errorMiddleware.asyncErrorHandler).toBeDefined();
      
      expect(typeof errorMiddleware.errorHandler).toBe('function');
      expect(typeof errorMiddleware.notFoundHandler).toBe('function');
      expect(typeof errorMiddleware.asyncErrorHandler).toBe('function');
      
      // Error handler should have 4 parameters (err, req, res, next)
      expect(errorMiddleware.errorHandler.length).toBe(4);
      // Not found handler should have 3 parameters (req, res, next)
      expect(errorMiddleware.notFoundHandler.length).toBe(3);
    });
  });

  describe('Security Middleware', () => {
    it('should provide security middleware functions', async () => {
      const securityMiddleware = await import('../../src/middleware/security.middleware.js');
      
      expect(securityMiddleware.rateLimiter).toBeDefined();
      expect(securityMiddleware.securityHeaders).toBeDefined();
      expect(securityMiddleware.csrfProtection).toBeDefined();
    });
  });

  describe('Validation Middleware', () => {
    it('should provide validation middleware functions', async () => {
      const validationMiddleware = await import('../../src/middleware/validation.middleware.js');
      
      expect(validationMiddleware.validateGitHubCallback).toBeDefined();
      expect(validationMiddleware.validateRepositoryRequest).toBeDefined();
      expect(validationMiddleware.validateWorkspaceRequest).toBeDefined();
      expect(validationMiddleware.validateTerminalInput).toBeDefined();
    });
  });

  describe('Service Structure', () => {
    it('should provide all core services', async () => {
      // GitHub Service
      const githubService = await import('../../src/services/github.service.js');
      expect(githubService.default).toBeDefined();
      expect(githubService.default.isConfigured).toBeDefined();
      
      // Settings Service
      const settingsService = await import('../../src/services/settings.service.js');
      expect(settingsService.default).toBeDefined();
      
      // Shell Service
      const shellService = await import('../../src/services/shell.service.js');
      expect(shellService.default).toBeDefined();
      expect(shellService.default.activeSessions).toBeDefined();
      
      // Workspace Service
      const workspaceService = await import('../../src/services/workspace.service.js');
      expect(workspaceService.default).toBeDefined();
    });
  });

  describe('Controller Structure', () => {
    it('should provide all controllers', async () => {
      // GitHub Controller
      const githubController = await import('../../src/controllers/github.controller.js');
      expect(githubController.initiateAuth).toBeDefined();
      expect(githubController.handleCallback).toBeDefined();
      expect(githubController.getRepositories).toBeDefined();
      
      // Health Controller
      const healthController = await import('../../src/controllers/health.controller.js');
      expect(healthController.healthCheck).toBeDefined();
      expect(healthController.detailedHealth).toBeDefined();
    });
  });

  describe('Socket Infrastructure', () => {
    it('should provide socket authentication and handlers', async () => {
      // Socket Auth
      const socketAuth = await import('../../src/socket/auth.socket.js');
      expect(socketAuth.authenticateSocket).toBeDefined();
      
      // Socket Handler
      const socketHandler = await import('../../src/socket/socket.handler.js');
      expect(socketHandler.default).toBeDefined();
    });
  });

  describe('Database Configuration', () => {
    it('should provide database utilities', async () => {
      const database = await import('../../src/config/database.js');
      
      expect(database.prisma).toBeDefined();
      expect(database.testConnection).toBeDefined();
      expect(database.initializeDatabase).toBeDefined();
    });
  });

  describe('Initialization Module', () => {
    it('should provide initialization functions', async () => {
      const init = await import('../../src/utils/init.js');
      
      expect(init.initializeApp).toBeDefined();
      expect(init.setupEnvironment).toBeDefined();
      
      expect(typeof init.initializeApp).toBe('function');
      expect(typeof init.setupEnvironment).toBe('function');
    });
  });
});