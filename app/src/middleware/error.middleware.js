// Global error handling middleware

const logger = require('../utils/logger');
const environment = require('../config/environment');

function errorHandler(err, req, res, next) {
  // Log error with proper structured logging
  logger.error('Unhandled HTTP error', err, {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection?.remoteAddress,
    timestamp: new Date().toISOString()
  });
  
  // Default error response
  let status = 500;
  let message = 'Internal server error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    status = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    status = 404;
    message = 'Not found';
  }
  
  // Don't expose internal errors in production
  if (environment.NODE_ENV === 'production' && status === 500) {
    message = 'Internal server error';
  } else if (environment.NODE_ENV !== 'production') {
    // Include stack trace in development
    res.status(status).json({
      error: message,
      stack: err.stack
    });
    return;
  }
  
  res.status(status).json({ error: message });
}

function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
}

// Async error wrapper to catch promise rejections
function asyncHandler(fn) {
  return function(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};