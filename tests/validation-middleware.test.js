import { describe, it, expect, beforeEach } from 'vitest';

describe('Validation Middleware', () => {
  let validationMiddleware;
  let mockReq, mockRes, mockNext;

  beforeEach(async () => {
    // Import after mocks are set up
    const module = await import('@/middleware/validation.middleware.js');
    validationMiddleware = module.default;

    mockReq = {
      query: {},
      params: {},
      body: {},
      method: 'GET',
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();

    vi.clearAllMocks();
  });

  describe('validateGitHubCallback', () => {
    it('should call next when code is present', () => {
      mockReq.query.code = 'test-code';

      validationMiddleware.validateGitHubCallback(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return 400 when code is missing', () => {
      validationMiddleware.validateGitHubCallback(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid callback',
        message: 'Missing authorization code'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateRepositoryQuery', () => {
    it('should call next when no query parameters are provided', () => {
      validationMiddleware.validateRepositoryQuery(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should call next when valid page parameter is provided', () => {
      mockReq.query.page = '2';

      validationMiddleware.validateRepositoryQuery(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return 400 when page is not a number', () => {
      mockReq.query.page = 'invalid';

      validationMiddleware.validateRepositoryQuery(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid page number' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when page is less than 1', () => {
      mockReq.query.page = '0';

      validationMiddleware.validateRepositoryQuery(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid page number' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when valid per_page parameter is provided', () => {
      mockReq.query.per_page = '50';

      validationMiddleware.validateRepositoryQuery(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return 400 when per_page is not a number', () => {
      mockReq.query.per_page = 'invalid';

      validationMiddleware.validateRepositoryQuery(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid per_page value (1-100)' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when per_page is less than 1', () => {
      mockReq.query.per_page = '0';

      validationMiddleware.validateRepositoryQuery(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid per_page value (1-100)' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when per_page is greater than 100', () => {
      mockReq.query.per_page = '101';

      validationMiddleware.validateRepositoryQuery(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid per_page value (1-100)' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateWorkspaceCreation', () => {
    beforeEach(() => {
      mockReq.method = 'POST';
      mockReq.body = {};
    });

    it('should call next when valid githubRepo and githubUrl are provided', () => {
      mockReq.body.githubRepo = 'user/repo';
      mockReq.body.githubUrl = 'https://github.com/user/repo';

      validationMiddleware.validateWorkspaceCreation(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return 400 when githubRepo is missing', () => {
      mockReq.body.githubUrl = 'https://github.com/user/repo';

      validationMiddleware.validateWorkspaceCreation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required fields',
        message: 'githubRepo and githubUrl are required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when githubUrl is missing', () => {
      mockReq.body.githubRepo = 'user/repo';

      validationMiddleware.validateWorkspaceCreation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required fields',
        message: 'githubRepo and githubUrl are required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when githubRepo is not a string', () => {
      mockReq.body.githubRepo = 123;
      mockReq.body.githubUrl = 'https://github.com/user/repo';

      validationMiddleware.validateWorkspaceCreation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'githubRepo and githubUrl must be strings'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when githubUrl is not a string', () => {
      mockReq.body.githubRepo = 'user/repo';
      mockReq.body.githubUrl = 123;

      validationMiddleware.validateWorkspaceCreation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'githubRepo and githubUrl must be strings'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when githubRepo format is invalid', () => {
      mockReq.body.githubRepo = 'invalid-format';
      mockReq.body.githubUrl = 'https://github.com/user/repo';

      validationMiddleware.validateWorkspaceCreation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid repository format',
        message: 'Repository must be in format: owner/repo'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when githubUrl is invalid', () => {
      mockReq.body.githubRepo = 'user/repo';
      mockReq.body.githubUrl = 'invalid-url';

      validationMiddleware.validateWorkspaceCreation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid GitHub URL format'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateWorkspaceId', () => {
    it('should call next when valid workspaceId is provided', () => {
      mockReq.params.workspaceId = 'valid-workspace-id';

      validationMiddleware.validateWorkspaceId(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return 400 when workspaceId is missing', () => {
      validationMiddleware.validateWorkspaceId(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Valid workspace ID required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when workspaceId is not a string', () => {
      mockReq.params.workspaceId = 123;

      validationMiddleware.validateWorkspaceId(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Valid workspace ID required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateJSON', () => {
    it('should call next for GET requests', () => {
      mockReq.method = 'GET';

      validationMiddleware.validateJSON(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should call next for POST requests with valid body', () => {
      mockReq.method = 'POST';
      mockReq.body = { test: 'data' };

      validationMiddleware.validateJSON(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should call next for PUT requests with valid body', () => {
      mockReq.method = 'PUT';
      mockReq.body = { test: 'data' };

      validationMiddleware.validateJSON(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return 400 for POST requests with missing body', () => {
      mockReq.method = 'POST';
      mockReq.body = null;

      validationMiddleware.validateJSON(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid JSON body'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for PUT requests with missing body', () => {
      mockReq.method = 'PUT';
      mockReq.body = null;

      validationMiddleware.validateJSON(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid JSON body'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for POST requests with non-object body', () => {
      mockReq.method = 'POST';
      mockReq.body = 'invalid-body';

      validationMiddleware.validateJSON(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid JSON body'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});