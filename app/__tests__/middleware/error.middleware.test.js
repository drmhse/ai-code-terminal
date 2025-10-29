// Mock logger before requiring error middleware
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const { errorHandler, notFoundHandler, asyncHandler } = require('../../src/middleware/error.middleware');
const logger = require('../../src/utils/logger');

describe('Error Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      path: '/test-path',
      method: 'GET',
      url: '/test-path',
      get: jest.fn((header) => {
        if (header === 'User-Agent') return 'test-user-agent';
        return null;
      }),
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle generic errors with 500 status', () => {
      const error = new Error('Generic error');

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Unhandled HTTP error', error, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        stack: error.stack
      });
    });

    it('should handle ValidationError with 400 status', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        stack: error.stack
      });
    });

    it('should handle UnauthorizedError with 401 status', () => {
      const error = new Error('Unauthorized access');
      error.name = 'UnauthorizedError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        stack: error.stack
      });
    });

    it('should handle ForbiddenError with 403 status', () => {
      const error = new Error('Forbidden access');
      error.name = 'ForbiddenError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        stack: error.stack
      });
    });

    it('should handle NotFoundError with 404 status', () => {
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not found',
        stack: error.stack
      });
    });

    it('should hide stack trace in production for 500 errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Reset modules to reload the environment config with new values
      jest.resetModules();
      const { errorHandler: errorHandlerReloaded } = require('../../src/middleware/error.middleware');
      
      const error = new Error('Generic error');

      errorHandlerReloaded(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should show custom error message in production for non-500 errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Reset modules to reload the environment config with new values
      jest.resetModules();
      const { errorHandler: errorHandlerReloaded } = require('../../src/middleware/error.middleware');
      
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandlerReloaded(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed'
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with path and method information', () => {
      notFoundHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not found',
        path: '/test-path',
        method: 'GET'
      });
    });
  });

  describe('asyncHandler', () => {
    it('should call the function and next on success', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(mockFn);

      await wrappedFn(req, res, next);

      expect(mockFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when promise rejects', async () => {
      const error = new Error('Async error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(mockFn);

      await wrappedFn(req, res, next);

      expect(mockFn).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle synchronous functions', () => {
      const mockFn = jest.fn().mockReturnValue('sync result');
      const wrappedFn = asyncHandler(mockFn);

      wrappedFn(req, res, next);

      expect(mockFn).toHaveBeenCalledWith(req, res, next);
    });

  });
});