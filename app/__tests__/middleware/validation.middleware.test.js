const {
  validateGitHubCallback,
  validateRepositoryQuery,
  validateWorkspaceCreation,
  validateWorkspaceId,
  validateJSON
} = require('../../src/middleware/validation.middleware');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: {},
      body: {},
      params: {},
      method: 'POST'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('validateGitHubCallback', () => {
    it('should pass validation when code is provided', () => {
      req.query = { code: 'auth-code-123', state: 'state-123' };
      
      validateGitHubCallback(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when code is missing', () => {
      req.query = { state: 'state-123' };
      
      validateGitHubCallback(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid callback',
        message: 'Missing authorization code'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when code is empty string', () => {
      req.query = { code: '', state: 'state-123' };
      
      validateGitHubCallback(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid callback',
        message: 'Missing authorization code'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateRepositoryQuery', () => {
    it('should pass validation with valid parameters', () => {
      req.query = { page: '1', per_page: '50' };
      
      validateRepositoryQuery(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass validation with no parameters', () => {
      req.query = {};
      
      validateRepositoryQuery(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid page number', () => {
      req.query = { page: 'invalid' };
      
      validateRepositoryQuery(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid page number' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for page number less than 1', () => {
      req.query = { page: '0' };
      
      validateRepositoryQuery(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid page number' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid per_page value', () => {
      req.query = { per_page: 'invalid' };
      
      validateRepositoryQuery(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid per_page value (1-100)' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for per_page less than 1', () => {
      req.query = { per_page: '0' };
      
      validateRepositoryQuery(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid per_page value (1-100)' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for per_page greater than 100', () => {
      req.query = { per_page: '101' };
      
      validateRepositoryQuery(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid per_page value (1-100)' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateWorkspaceCreation', () => {
    it('should pass validation with valid workspace data', () => {
      req.body = {
        githubRepo: 'owner/repo',
        githubUrl: 'https://github.com/owner/repo.git'
      };
      
      validateWorkspaceCreation(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when githubRepo is missing', () => {
      req.body = {
        githubUrl: 'https://github.com/owner/repo.git'
      };
      
      validateWorkspaceCreation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required fields',
        message: 'githubRepo and githubUrl are required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when githubUrl is missing', () => {
      req.body = {
        githubRepo: 'owner/repo'
      };
      
      validateWorkspaceCreation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required fields',
        message: 'githubRepo and githubUrl are required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when githubRepo is not a string', () => {
      req.body = {
        githubRepo: 123,
        githubUrl: 'https://github.com/owner/repo.git'
      };
      
      validateWorkspaceCreation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'githubRepo and githubUrl must be strings'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when githubUrl is not a string', () => {
      req.body = {
        githubRepo: 'owner/repo',
        githubUrl: 123
      };
      
      validateWorkspaceCreation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'githubRepo and githubUrl must be strings'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid repository format', () => {
      req.body = {
        githubRepo: 'invalid-repo-format',
        githubUrl: 'https://github.com/owner/repo.git'
      };
      
      validateWorkspaceCreation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid repository format',
        message: 'Repository must be in format: owner/repo'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid GitHub URL', () => {
      req.body = {
        githubRepo: 'owner/repo',
        githubUrl: 'invalid-url'
      };
      
      validateWorkspaceCreation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid GitHub URL format'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept repository names with dots and hyphens', () => {
      req.body = {
        githubRepo: 'my-org/my-repo.js',
        githubUrl: 'https://github.com/my-org/my-repo.js.git'
      };
      
      validateWorkspaceCreation(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validateWorkspaceId', () => {
    it('should pass validation with valid workspace ID', () => {
      req.params = { workspaceId: 'workspace-123' };
      
      validateWorkspaceId(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when workspace ID is missing', () => {
      req.params = {};
      
      validateWorkspaceId(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Valid workspace ID required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when workspace ID is not a string', () => {
      req.params = { workspaceId: 123 };
      
      validateWorkspaceId(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Valid workspace ID required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when workspace ID is empty string', () => {
      req.params = { workspaceId: '' };
      
      validateWorkspaceId(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Valid workspace ID required'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateJSON', () => {
    it('should pass validation for GET requests', () => {
      req.method = 'GET';
      req.body = undefined;
      
      validateJSON(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass validation for POST with valid JSON body', () => {
      req.method = 'POST';
      req.body = { key: 'value' };
      
      validateJSON(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass validation for PUT with valid JSON body', () => {
      req.method = 'PUT';
      req.body = { key: 'value' };
      
      validateJSON(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 for POST with invalid JSON body', () => {
      req.method = 'POST';
      req.body = null;
      
      validateJSON(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid JSON body'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for POST with non-object body', () => {
      req.method = 'POST';
      req.body = 'string-body';
      
      validateJSON(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid JSON body'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for PUT with invalid JSON body', () => {
      req.method = 'PUT';
      req.body = undefined;
      
      validateJSON(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid JSON body'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});