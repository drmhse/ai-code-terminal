// Load environment variables first
require('dotenv').config();

const { initializeApp, gracefulShutdown } = require('./src/app');
const environment = require('./src/config/environment');
const logger = require('./src/utils/logger');
const processUtil = require('./src/utils/process');

async function startServer() {
  try {
    // Initialize the application
    const { app } = await initializeApp();
    
    // Start the server
    const PORT = environment.PORT;
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT} in ${environment.NODE_ENV} mode`);
    });

    // Setup graceful shutdown
    setupGracefulShutdown(app);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout. Forcing exit.');
      process.exit(1);
    }, 30000); // 30 second timeout

    try {
      // 1. Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // 2. Kill all terminal sessions properly
      const shellService = require('./src/services/shell.service');
      await shellService.killAllSessions();
      logger.info('All terminal sessions terminated');

      // 3. Cleanup other processes
      await processUtil.killAllProcesses();
      logger.info('All background processes terminated');

      // 4. Close database connections
      await gracefulShutdown();
      logger.info('Database connections closed');

      // 5. Cleanup shell service resources
      shellService.cleanup();
      logger.info('Shell service cleanup complete');
      
      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
  
  // Setup process utility graceful shutdown
  processUtil.setupGracefulShutdown();
}

// Start the server
startServer();