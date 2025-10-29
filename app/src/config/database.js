// Prisma client configuration for SQLite database
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Initialize Prisma client with logging
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' }
  ]
});

// Set up logging for Prisma events
function setupEventListeners(prismaClient) {
  prismaClient.$on('query', (e) => {
    logger.debug('Prisma Query', {
      query: e.query,
      params: e.params,
      duration: e.duration,
      timestamp: e.timestamp
    });
  });

  prismaClient.$on('error', (e) => {
    logger.error('Prisma Error', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp
    });
  });

  prismaClient.$on('info', (e) => {
    logger.info('Prisma Info', {
      message: e.message,
      timestamp: e.timestamp
    });
  });

  prismaClient.$on('warn', (e) => {
    logger.warn('Prisma Warning', {
      message: e.message,
      timestamp: e.timestamp
    });
  });
}

// Initialize event listeners
setupEventListeners(prisma);

// Test database connection
async function testConnection() {
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', error);
    return false;
  }
}

// Graceful shutdown
async function disconnect() {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed successfully');
  } catch (error) {
    logger.error('Error disconnecting from database', error);
  }
}

module.exports = {
  prisma,
  testConnection,
  disconnect,
  setupEventListeners
};