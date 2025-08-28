const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Configuration
const environment = require('./config/environment');
const { LIMITS } = require('./config/constants');
const { corsConfig, socketCorsConfig } = require('./config/cors');

// Controllers
const healthController = require('./controllers/health.controller');
const githubController = require('./controllers/github.controller');
const workspaceController = require('./controllers/workspace.controller');
const themeController = require('./controllers/theme.controller');
const processController = require('./controllers/process.controller');
const filesystemController = require('./controllers/filesystem.controller');

// Middleware
const { authenticateToken } = require('./middleware/auth.middleware');
const {
  validateGitHubCallback,
  validateRepositoryQuery,
  validateWorkspaceCreation,
  validateWorkspaceId,
  validateJSON
} = require('./middleware/validation.middleware');
const {
  errorHandler,
  notFoundHandler,
  asyncHandler
} = require('./middleware/error.middleware');
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
} = require('./middleware/security.middleware');

// Socket handlers
const socketHandler = require('./socket/socket.handler');

// Services
const cleanupService = require('./services/cleanup.service');
const processSupervisorService = require('./services/process-supervisor.service');

// Utilities
const logger = require('./utils/logger');
const { initializeDirectories } = require('./utils/init');
const { testConnection, disconnect } = require('./config/database');

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure EJS templating
app.set('view engine', 'ejs');
app.set('views', './views');
// Disable view caching for development
app.set('view cache', false);

// Initialize Socket.IO with CORS configuration
const io = socketIo(server, {
  cors: socketCorsConfig
});

// Trust proxy settings for production
setupTrustProxy(app);

// HTTP request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request start
  logger.debug(`HTTP Request: ${req.method} ${req.url}`, {
    eventType: 'http_request_start',
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection?.remoteAddress
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    logger.httpRequest(req, res, duration);
    originalEnd.call(res, chunk, encoding);
  };
  
  next();
});

// Basic security middleware (keep headers, remove rate limiting for single user)
app.use(securityHeaders);
app.use(sanitizeInput);

// CORS and body parsing
app.use(cors(corsConfig));
app.use(express.json({ limit: LIMITS.REQUEST_SIZE_LIMIT }));
// Static file serving removed - frontend is now deployed separately

// Main application page
app.get('/', (req, res) => {
  res.render('layout', {
    title: 'AI Code Terminal',
    version: '2.0.0'
  });
});

// API status endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'AI Code Terminal API',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/github/auth',
      stats: '/api/stats'
    }
  });
});

// Health check endpoint (no auth required)
app.get('/health', healthController.getHealthStatus.bind(healthController));
app.get('/health/detailed', healthController.getDetailedHealth.bind(healthController));

// System stats endpoint (auth required)
app.get('/api/stats',
  authenticateToken,
  asyncHandler(healthController.getSystemStats.bind(healthController))
);

// Auth status endpoint (auth required)
app.get('/api/auth/status',
  authenticateToken,
  asyncHandler(githubController.getAuthStatus.bind(githubController))
);

// Logout endpoint (auth required)
app.post('/api/auth/logout',
  authenticateToken,
  asyncHandler(githubController.logout.bind(githubController))
);

// Theme endpoints (auth required)
app.get('/api/theme',
  authenticateToken,
  asyncHandler(githubController.getTheme.bind(githubController))
);

app.post('/api/theme',
  authenticateToken,
  validateJSON,
  asyncHandler(githubController.updateTheme.bind(githubController))
);

// Theme API routes
app.get('/api/themes',
  authenticateToken,
  asyncHandler(themeController.getAllThemes.bind(themeController))
);

app.get('/api/themes/:themeId',
  authenticateToken,
  asyncHandler(themeController.getThemeById.bind(themeController))
);

app.get('/api/themes/default',
  authenticateToken,
  asyncHandler(themeController.getDefaultTheme.bind(themeController))
);

// Development theme reload endpoint
app.post('/api/themes/reload',
  authenticateToken,
  asyncHandler(themeController.reloadThemes.bind(themeController))
);

// Single-tenant GitHub-only authentication routes (no rate limiting needed)
app.get('/api/github/auth',
  asyncHandler(githubController.startAuthorization.bind(githubController))
);

app.get('/auth/github/callback',
  validateGitHubCallback,
  asyncHandler(githubController.handleCallback.bind(githubController))
);

// No Claude token management needed - user handles via terminal

app.get('/api/github/repositories',
  authenticateToken,
  validateRepositoryQuery,
  asyncHandler(githubController.getRepositories.bind(githubController))
);

app.get('/api/workspaces',
  authenticateToken,
  asyncHandler(workspaceController.getWorkspaces.bind(workspaceController))
);

app.post('/api/workspaces',
  authenticateToken,
  validateJSON,
  validateWorkspaceCreation,
  asyncHandler(githubController.createWorkspace.bind(githubController))
);

app.delete('/api/workspaces/:workspaceId',
  authenticateToken,
  validateWorkspaceId,
  asyncHandler(githubController.deleteWorkspace.bind(githubController))
);

// Process management endpoints (auth required)
app.get('/api/processes',
  authenticateToken,
  asyncHandler(processController.getProcesses.bind(processController))
);

app.post('/api/processes',
  authenticateToken,
  validateJSON,
  asyncHandler(processController.startProcess.bind(processController))
);

app.get('/api/processes/:processId',
  authenticateToken,
  asyncHandler(processController.getProcess.bind(processController))
);

app.delete('/api/processes/:processId',
  authenticateToken,
  asyncHandler(processController.stopProcess.bind(processController))
);

// File system endpoints (auth required)
app.get('/api/workspaces/:workspaceId/files',
  authenticateToken,
  validateWorkspaceId,
  asyncHandler(filesystemController.getDirectoryContents.bind(filesystemController))
);

app.get('/api/workspaces/:workspaceId/file-content',
  authenticateToken,
  validateWorkspaceId,
  asyncHandler(filesystemController.getFileContents.bind(filesystemController))
);

app.get('/api/workspaces/:workspaceId/file-info',
  authenticateToken,
  validateWorkspaceId,
  asyncHandler(filesystemController.getFileInfo.bind(filesystemController))
);

app.post('/api/processes/:processId/restart',
  authenticateToken,
  asyncHandler(processController.restartProcess.bind(processController))
);

app.get('/api/processes/supervisor/status',
  authenticateToken,
  asyncHandler(processController.getStatus.bind(processController))
);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize Socket.IO
socketHandler.initialize(io);

// Initialize application
async function initializeApp() {
  try {
    // Validate environment
    environment.validate();

    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Initialize directories
    await initializeDirectories();

    // Start cleanup service
    logger.info('Starting cleanup service...');
    cleanupService.start();

    // Start process supervisor service
    logger.info('Starting process supervisor service...');
    await processSupervisorService.start();

    logger.info('Application initialized successfully');
    return { app: server, io };
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    throw error;
  }
}

// Graceful shutdown handler
async function gracefulShutdown() {
  logger.info('Starting graceful shutdown...');
  try {
    // Stop cleanup service
    logger.info('Stopping cleanup service...');
    cleanupService.stop();
    
    // Stop process supervisor service
    logger.info('Stopping process supervisor service...');
    await processSupervisorService.stop();
    
    await disconnect();
    logger.info('Database connection closed');
    
    // Flush logger before completing shutdown
    logger.info('Flushing log files...');
    await logger.shutdown();
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    // Ensure logger is still flushed even if there's an error
    try {
      await logger.shutdown();
    } catch (loggerError) {
      console.error('Failed to shutdown logger:', loggerError);
    }
  }
}

// Export for use in server.js
module.exports = { initializeApp, gracefulShutdown, server, io };
