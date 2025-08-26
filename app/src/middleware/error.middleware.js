// Global error handling middleware

function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);
  
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
  if (process.env.NODE_ENV === 'production' && status === 500) {
    message = 'Internal server error';
  } else if (process.env.NODE_ENV !== 'production') {
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