const GitHubController = require('../../src/controllers/github.controller');

// Mock services
jest.mock('../../src/services/github.service');
jest.mock('../../src/services/workspace.service');
jest.mock('../../src/services/settings.service');
jest.mock('../../src/utils/logger');
jest.mock('jsonwebtoken');
jest.mock('../../src/config/environment', () => ({
  ...jest.requireActual('../../src/config/environment'),
  TENANT_GITHUB_USERNAME: 'testuser',
  JWT_SECRET: 'test-secret',
  PORT: '3001'
}));

const GitHubService = require('../../src/services/github.service');
const WorkspaceService = require('../../src/services/workspace.service');
const SettingsService = require('../../src/services/settings.service');
const jwt = require('jsonwebtoken');
const environment = require('../../src/config/environment');
const logger = require('../../src/utils/logger');

describe('GitHubController', () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn(),
      send: jest.fn()
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('startAuthorization', () => {
    it('should redirect to GitHub auth URL when configured', async () => {
      GitHubService.isConfigured.mockReturnValue(true);
      GitHubService.getAuthorizationUrl.mockReturnValue('https://github.com/auth');

      await GitHubController.startAuthorization(req, res);

      expect(GitHubService.isConfigured).toHaveBeenCalled();
      expect(GitHubService.getAuthorizationUrl).toHaveBeenCalledWith('single-tenant');
      expect(res.redirect).toHaveBeenCalledWith('https://github.com/auth');
    });

    it('should return 503 when GitHub is not configured', async () => {
      GitHubService.isConfigured.mockReturnValue(false);

      await GitHubController.startAuthorization(req, res);

      expect(GitHubService.isConfigured).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.send).toHaveBeenCalledWith('GitHub OAuth is not configured. Please check your environment variables.');
    });

    it('should handle errors during authorization start', async () => {
      GitHubService.isConfigured.mockReturnValue(true);
      GitHubService.getAuthorizationUrl.mockImplementation(() => {
        throw new Error('Test error');
      });

      await GitHubController.startAuthorization(req, res);

      expect(logger.error).toHaveBeenCalledWith('GitHub authorization start failed:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('GitHub authorization failed: Test error');
    });
  });

  describe('handleCallback', () => {
    it('should redirect with error when OAuth error occurs', async () => {
      req.query = { error: 'access_denied' };

      await GitHubController.handleCallback(req, res);

      expect(logger.warn).toHaveBeenCalledWith('GitHub OAuth error:', 'access_denied');
      expect(res.redirect).toHaveBeenCalledWith('/?error=access_denied');
    });

    it('should return 400 for missing code or state', async () => {
      req.query = { code: 'test-code' }; // missing state

      await GitHubController.handleCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid callback parameters',
        message: 'Missing code or state parameter'
      });
    });

    it('should successfully handle callback and redirect with token', async () => {
      req.query = { code: 'test-code', state: 'test-state' };
      
      GitHubService.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        user: { login: 'testuser' }
      });
      
      SettingsService.updateGithubTokens.mockResolvedValue();
      jwt.sign.mockReturnValue('jwt-token');

      await GitHubController.handleCallback(req, res);

      expect(GitHubService.exchangeCodeForToken).toHaveBeenCalledWith('test-code', 'test-state');
      expect(SettingsService.updateGithubTokens).toHaveBeenCalledWith('access-token', 'refresh-token', expect.any(Date));
      expect(jwt.sign).toHaveBeenCalledWith(
        { authorized: true, username: 'testuser' },
        'test-secret',
        { expiresIn: '7d' }
      );
      expect(res.redirect).toHaveBeenCalledWith('/?token=jwt-token');
    });

    it('should redirect with error for unauthorized user', async () => {
      req.query = { code: 'test-code', state: 'test-state' };
      
      GitHubService.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        user: { login: 'unauthorized-user' }
      });

      await GitHubController.handleCallback(req, res);

      expect(logger.warn).toHaveBeenCalledWith('Unauthorized GitHub user attempted login: unauthorized-user');
      expect(res.redirect).toHaveBeenCalledWith('/?error=Unauthorized%20user');
    });

    it('should handle errors during callback processing', async () => {
      req.query = { code: 'test-code', state: 'test-state' };
      
      GitHubService.exchangeCodeForToken.mockRejectedValue(new Error('Token exchange failed'));

      await GitHubController.handleCallback(req, res);

      expect(logger.error).toHaveBeenCalledWith('GitHub OAuth callback failed:', expect.any(Error));
      expect(res.redirect).toHaveBeenCalledWith('/?error=Token%20exchange%20failed');
    });
  });

  describe('getRepositories', () => {
    it('should return repositories successfully', async () => {
      req.query = { page: '1', per_page: '30', sort: 'updated', type: 'all' };
      
      GitHubService.getUserRepositories.mockResolvedValue([
        { id: 1, name: 'repo1' },
        { id: 2, name: 'repo2' }
      ]);

      await GitHubController.getRepositories(req, res);

      expect(GitHubService.getUserRepositories).toHaveBeenCalledWith({
        page: 1,
        per_page: 30,
        sort: 'updated',
        type: 'all'
      });
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        repositories: [
          { id: 1, name: 'repo1' },
          { id: 2, name: 'repo2' }
        ],
        pagination: {
          page: 1,
          per_page: 30,
          has_more: false
        }
      });
    });

    it('should handle re-authentication errors', async () => {
      req.query = {};
      
      GitHubService.getUserRepositories.mockRejectedValue(new Error('Please re-authenticate'));

      await GitHubController.getRepositories(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Re-authentication required',
        message: 'Please re-authenticate'
      });
    });

    it('should handle general errors', async () => {
      req.query = {};
      
      GitHubService.getUserRepositories.mockRejectedValue(new Error('API error'));

      await GitHubController.getRepositories(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get repositories:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get repositories',
        message: 'API error'
      });
    });
  });

  describe('createWorkspace', () => {
    it('should create workspace successfully', async () => {
      req.body = { githubRepo: 'owner/repo', githubUrl: 'https://github.com/owner/repo' };
      
      WorkspaceService.createWorkspace.mockResolvedValue({
        id: 'workspace-id',
        name: 'repo'
      });

      await GitHubController.createWorkspace(req, res);

      expect(WorkspaceService.createWorkspace).toHaveBeenCalledWith('owner/repo', 'https://github.com/owner/repo');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        workspace: {
          id: 'workspace-id',
          name: 'repo'
        },
        message: 'Workspace created successfully'
      });
    });

    it('should return 400 for missing parameters', async () => {
      req.body = { githubRepo: 'owner/repo' }; // missing githubUrl

      await GitHubController.createWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid parameters',
        message: 'githubRepo and githubUrl are required'
      });
    });

    it('should return 400 for invalid repository format', async () => {
      req.body = { githubRepo: 'invalid-format', githubUrl: 'https://github.com/owner/repo' };

      await GitHubController.createWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid repository format',
        message: 'Repository must be in format: owner/repo'
      });
    });

    it('should handle workspace already exists error', async () => {
      req.body = { githubRepo: 'owner/repo', githubUrl: 'https://github.com/owner/repo' };
      
      WorkspaceService.createWorkspace.mockRejectedValue(new Error('Workspace already exists'));

      await GitHubController.createWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workspace already exists',
        message: 'Workspace already exists'
      });
    });

    it('should handle workspace limit reached error', async () => {
      req.body = { githubRepo: 'owner/repo', githubUrl: 'https://github.com/owner/repo' };
      
      WorkspaceService.createWorkspace.mockRejectedValue(new Error('Maximum workspace limit reached'));

      await GitHubController.createWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workspace limit reached',
        message: 'Maximum workspace limit reached'
      });
    });

    it('should handle general errors', async () => {
      req.body = { githubRepo: 'owner/repo', githubUrl: 'https://github.com/owner/repo' };
      
      WorkspaceService.createWorkspace.mockRejectedValue(new Error('API error'));

      await GitHubController.createWorkspace(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to create workspace:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to create workspace',
        message: 'API error'
      });
    });
  });

  describe('getWorkspaces', () => {
    it('should return workspaces successfully', async () => {
      req.query = { include_inactive: 'false' };
      
      WorkspaceService.listWorkspaces.mockResolvedValue([
        { id: 'workspace1', name: 'repo1', isActive: true },
        { id: 'workspace2', name: 'repo2', isActive: false }
      ]);

      await GitHubController.getWorkspaces(req, res);

      expect(WorkspaceService.listWorkspaces).toHaveBeenCalledWith(false);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        workspaces: [
          { id: 'workspace1', name: 'repo1', isActive: true },
          { id: 'workspace2', name: 'repo2', isActive: false }
        ],
        count: 2
      });
    });

    it('should handle errors', async () => {
      req.query = {};
      
      WorkspaceService.listWorkspaces.mockRejectedValue(new Error('Database error'));

      await GitHubController.getWorkspaces(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get workspaces:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get workspaces',
        message: 'Database error'
      });
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace successfully', async () => {
      req.params = { workspaceId: 'workspace-id' };
      req.query = { delete_files: 'false' };
      
      WorkspaceService.getWorkspace.mockResolvedValue({ id: 'workspace-id' });
      WorkspaceService.deleteWorkspace.mockResolvedValue();

      await GitHubController.deleteWorkspace(req, res);

      expect(WorkspaceService.getWorkspace).toHaveBeenCalledWith('workspace-id');
      expect(WorkspaceService.deleteWorkspace).toHaveBeenCalledWith('workspace-id', false);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Workspace deleted successfully'
      });
    });

    it('should return 400 for missing workspace ID', async () => {
      req.params = {}; // missing workspaceId
      req.query = {};

      await GitHubController.deleteWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid parameters',
        message: 'Workspace ID is required'
      });
    });

    it('should return 404 for non-existent workspace', async () => {
      req.params = { workspaceId: 'non-existent' };
      req.query = {};
      
      WorkspaceService.getWorkspace.mockResolvedValue(null);

      await GitHubController.deleteWorkspace(req, res);

      expect(WorkspaceService.getWorkspace).toHaveBeenCalledWith('non-existent');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workspace not found',
        message: 'Workspace not found'
      });
    });

    it('should handle errors', async () => {
      req.params = { workspaceId: 'workspace-id' };
      req.query = {};
      
      WorkspaceService.getWorkspace.mockResolvedValue({ id: 'workspace-id' });
      WorkspaceService.deleteWorkspace.mockRejectedValue(new Error('Deletion error'));

      await GitHubController.deleteWorkspace(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to delete workspace:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to delete workspace',
        message: 'Deletion error'
      });
    });
  });

  describe('getRepository', () => {
    it('should get repository information successfully', async () => {
      req.params = { owner: 'testuser', repo: 'test-repo' };
      
      GitHubService.getRepositoryInfo.mockResolvedValue({
        id: 123,
        name: 'test-repo',
        owner: { login: 'testuser' }
      });

      await GitHubController.getRepository(req, res);

      expect(GitHubService.getRepositoryInfo).toHaveBeenCalledWith('testuser', 'test-repo');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        repository: {
          id: 123,
          name: 'test-repo',
          owner: { login: 'testuser' }
        }
      });
    });

    it('should return 400 for missing parameters', async () => {
      req.params = { owner: 'testuser' }; // missing repo

      await GitHubController.getRepository(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid parameters',
        message: 'Owner and repo parameters are required'
      });
    });

    it('should handle re-authentication errors', async () => {
      req.params = { owner: 'testuser', repo: 'test-repo' };
      
      GitHubService.getRepositoryInfo.mockRejectedValue(new Error('Please re-authenticate'));

      await GitHubController.getRepository(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Re-authentication required',
        message: 'Please re-authenticate'
      });
    });

    it('should handle general errors', async () => {
      req.params = { owner: 'testuser', repo: 'test-repo' };
      
      GitHubService.getRepositoryInfo.mockRejectedValue(new Error('API error'));

      await GitHubController.getRepository(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get repository info:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get repository information',
        message: 'API error'
      });
    });
  });

  describe('cloneRepository', () => {
    it('should clone repository successfully', async () => {
      req.params = { workspaceId: 'workspace-id' };
      
      WorkspaceService.getWorkspace.mockResolvedValue({ id: 'workspace-id' });
      WorkspaceService.cloneRepository.mockResolvedValue({
        id: 'workspace-id',
        lastSyncAt: new Date()
      });

      await GitHubController.cloneRepository(req, res);

      expect(WorkspaceService.getWorkspace).toHaveBeenCalledWith('workspace-id');
      expect(WorkspaceService.cloneRepository).toHaveBeenCalledWith('workspace-id');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        workspace: {
          id: 'workspace-id',
          lastSyncAt: expect.any(Date)
        },
        message: 'Repository cloned successfully'
      });
    });

    it('should return 400 for missing workspace ID', async () => {
      req.params = {}; // missing workspaceId

      await GitHubController.cloneRepository(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid parameters',
        message: 'Workspace ID is required'
      });
    });

    it('should return 404 for non-existent workspace', async () => {
      req.params = { workspaceId: 'non-existent' };
      
      WorkspaceService.getWorkspace.mockResolvedValue(null);

      await GitHubController.cloneRepository(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workspace not found',
        message: 'Workspace not found'
      });
    });

    it('should handle errors', async () => {
      req.params = { workspaceId: 'workspace-id' };
      
      WorkspaceService.getWorkspace.mockResolvedValue({ id: 'workspace-id' });
      WorkspaceService.cloneRepository.mockRejectedValue(new Error('Clone failed'));

      await GitHubController.cloneRepository(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to clone repository:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to clone repository',
        message: 'Clone failed'
      });
    });
  });

  describe('syncWorkspace', () => {
    it('should sync workspace successfully', async () => {
      req.params = { workspaceId: 'workspace-id' };
      
      WorkspaceService.getWorkspace.mockResolvedValue({ id: 'workspace-id' });
      WorkspaceService.syncWithGitHub.mockResolvedValue({
        id: 'workspace-id',
        lastSyncAt: new Date()
      });

      await GitHubController.syncWorkspace(req, res);

      expect(WorkspaceService.getWorkspace).toHaveBeenCalledWith('workspace-id');
      expect(WorkspaceService.syncWithGitHub).toHaveBeenCalledWith('workspace-id');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        workspace: {
          id: 'workspace-id',
          lastSyncAt: expect.any(Date)
        },
        message: 'Workspace synced successfully'
      });
    });

    it('should return 400 for missing workspace ID', async () => {
      req.params = {}; // missing workspaceId

      await GitHubController.syncWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid parameters',
        message: 'Workspace ID is required'
      });
    });

    it('should return 404 for non-existent workspace', async () => {
      req.params = { workspaceId: 'non-existent' };
      
      WorkspaceService.getWorkspace.mockResolvedValue(null);

      await GitHubController.syncWorkspace(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workspace not found',
        message: 'Workspace not found'
      });
    });

    it('should handle errors', async () => {
      req.params = { workspaceId: 'workspace-id' };
      
      WorkspaceService.getWorkspace.mockResolvedValue({ id: 'workspace-id' });
      WorkspaceService.syncWithGitHub.mockRejectedValue(new Error('Sync failed'));

      await GitHubController.syncWorkspace(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to sync workspace:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to sync workspace',
        message: 'Sync failed'
      });
    });
  });

  describe('getAuthStatus', () => {
    it('should return unauthorized status when no tokens exist', async () => {
      SettingsService.getSettings.mockResolvedValue({});

      await GitHubController.getAuthStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        authorized: false,
        userInfo: null,
        githubConfigured: expect.any(Boolean)
      });
    });

    it('should return authorized status with user info', async () => {
      SettingsService.getSettings.mockResolvedValue({
        githubToken: 'token',
        githubTokenExpiresAt: new Date()
      });
      
      GitHubService.getAuthenticatedUserInfo.mockResolvedValue({
        login: 'testuser',
        id: 123
      });

      await GitHubController.getAuthStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        authorized: true,
        userInfo: {
          login: 'testuser',
          id: 123
        },
        githubConfigured: expect.any(Boolean)
      });
    });

    it('should handle token expiration', async () => {
      SettingsService.getSettings.mockResolvedValue({
        githubToken: 'expired-token',
        githubTokenExpiresAt: new Date()
      });
      
      GitHubService.getAuthenticatedUserInfo.mockRejectedValue(new Error('Please re-authenticate'));

      await GitHubController.getAuthStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        authorized: false,
        message: 'GitHub token expired, re-authorization required'
      });
    });

    it('should handle non-authentication errors when authorized', async () => {
      SettingsService.getSettings.mockResolvedValue({
        githubToken: 'valid-token',
        githubTokenExpiresAt: new Date()
      });
      
      GitHubService.getAuthenticatedUserInfo.mockRejectedValue(new Error('Unexpected API error'));

      await GitHubController.getAuthStatus(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get auth status:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get authorization status',
        message: 'Unexpected API error'
      });
    });

    it('should handle errors', async () => {
      SettingsService.getSettings.mockRejectedValue(new Error('Database error'));

      await GitHubController.getAuthStatus(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get auth status:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get authorization status',
        message: 'Database error'
      });
    });
  });

  describe('getTheme', () => {
    it('should return theme successfully', async () => {
      SettingsService.getTheme.mockResolvedValue({ theme: 'dark' });

      await GitHubController.getTheme(req, res);

      expect(SettingsService.getTheme).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        theme: { theme: 'dark' }
      });
    });

    it('should handle errors', async () => {
      SettingsService.getTheme.mockRejectedValue(new Error('Database error'));

      await GitHubController.getTheme(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get theme preferences:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get theme preferences',
        message: 'Database error'
      });
    });
  });

  describe('updateTheme', () => {
    it('should update theme successfully', async () => {
      req.body = { theme: { theme: 'light' } };
      
      SettingsService.updateTheme.mockResolvedValue();

      await GitHubController.updateTheme(req, res);

      expect(SettingsService.updateTheme).toHaveBeenCalledWith({ theme: 'light' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Theme preferences updated successfully'
      });
    });

    it('should return 400 for invalid theme data', async () => {
      req.body = {}; // missing theme

      await GitHubController.updateTheme(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid theme data',
        message: 'Theme data is required and must be an object'
      });
    });

    it('should handle errors', async () => {
      req.body = { theme: { theme: 'light' } };
      
      SettingsService.updateTheme.mockRejectedValue(new Error('Database error'));

      await GitHubController.updateTheme(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to update theme preferences:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to update theme preferences',
        message: 'Database error'
      });
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      GitHubService.revokeToken.mockResolvedValue();

      await GitHubController.logout(req, res);

      expect(GitHubService.revokeToken).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should handle errors during logout', async () => {
      GitHubService.revokeToken.mockRejectedValue(new Error('Revoke failed'));

      await GitHubController.logout(req, res);

      expect(logger.error).toHaveBeenCalledWith('Logout failed:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Logout failed',
        message: 'Revoke failed'
      });
    });
  });
});