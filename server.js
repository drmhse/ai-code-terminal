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
    
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Cleanup processes
    await processUtil.killAllProcesses();
    
    // Close database connection
    await gracefulShutdown();
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Setup process utility graceful shutdown
  processUtil.setupGracefulShutdown();
}

// Start the server
startServer();