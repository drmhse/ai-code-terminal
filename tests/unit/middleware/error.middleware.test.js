import { describe, it, expect, beforeEach } from 'vitest';

describe('Error Middleware', () => {
  let errorMiddleware;
  let mockReq, mockRes, mockNext;

  beforeEach(async () => {
    // Import after mocks are set up
    const module = await import('@/middleware/error.middleware.js');
    errorMiddleware = module.default;

    mockReq = {
      path: '/test',
      method: 'GET',
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();

    vi.clearAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle generic errors with 500 status', () => {
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      const error = new Error('Generic error');

      errorMiddleware.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle ValidationError with 400 status', () => {
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorMiddleware.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Validation failed' });
    });

    it('should handle UnauthorizedError with 401 status', () => {
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      const error = new Error('Not authorized');
      error.name = 'UnauthorizedError';

      errorMiddleware.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle ForbiddenError with 403 status', () => {
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      const error = new Error('Access forbidden');
      error.name = 'ForbiddenError';

      errorMiddleware.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should handle NotFoundError with 404 status', () => {
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';

      errorMiddleware.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('should include stack trace in development environment', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Development error');

      errorMiddleware.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        stack: expect.any(String)
      });
    });

    it('should not include stack trace in production environment', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Production error');

      errorMiddleware.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with error details', () => {
      errorMiddleware.notFoundHandler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not found',
        path: '/test',
        method: 'GET'
      });
    });
  });

  describe('asyncHandler', () => {
    it('should wrap async functions and call next with errors', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Async error'));
      const wrappedFn = errorMiddleware.asyncHandler(asyncFn);
      
      await wrappedFn(mockReq, mockRes, mockNext);
      
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should wrap async functions and not call next when successful', async () => {
      const asyncFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = errorMiddleware.asyncHandler(asyncFn);
      
      await wrappedFn(mockReq, mockRes, mockNext);
      
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});