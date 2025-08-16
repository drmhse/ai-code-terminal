// Directory initialization utility

const fs = require('fs').promises;
const { PATHS } = require('../config/constants');
const logger = require('./logger');

async function initializeDirectories() {
  try {
    await fs.mkdir(PATHS.DATA_DIR, { recursive: true });
    await fs.mkdir(PATHS.SESSIONS_DIR, { recursive: true });
    await fs.mkdir(PATHS.WORKSPACES_DIR, { recursive: true });
    logger.info('Data directories initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize directories:', error);
    throw error;
  }
}

module.exports = {
  initializeDirectories
};