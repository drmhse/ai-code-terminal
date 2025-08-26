const jwt = require('jsonwebtoken');
const environment = require('../config/environment');
const settingsService = require('../services/settings.service');

async function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const user = jwt.verify(token, environment.JWT_SECRET);
    
    // Verify GitHub token still exists (GitHub is source of truth)
    const githubToken = await settingsService.getGithubToken();
    if (!githubToken) {
      return next(new Error('GitHub token not found'));
    }
    
    socket.user = user;
    next();
  } catch (err) {
    const logger = require('../utils/logger');
    logger.error('Socket authentication failed:', err.message);
    return next(new Error('Authentication error'));
  }
}

module.exports = {
  socketAuthMiddleware
};