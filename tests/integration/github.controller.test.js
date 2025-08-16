import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import '../mocks/prisma.js';
import { mockPrismaClient } from '../mocks/prisma.js';
import { mockGitHubUser, mockGitHubRepository, mockGitHubToken } from '../fixtures/github-user.js';

// Mock services
const mockGitHubService = {
  isConfigured: vi.fn(() => true),
  getAuthorizationUrl: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  getUserRepositories: vi.fn(),
  getRepositoryInfo: vi.fn(),
  validateToken: vi.fn(),
};

const mockWorkspaceService = {
  createWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  listWorkspaces: vi.fn(),
  deleteWorkspace: vi.fn(),
  cloneRepository: vi.fn(),
  syncWithGitHub: vi.fn(),
};

const mockSettingsService = {
  getGithubToken: vi.fn(),
  updateGithubToken: vi.fn(),
  getTheme: vi.fn(),
  updateTheme: vi.fn(),
};

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-jwt-token'),
  },
}));

// Mock environment
vi.mock('@/config/environment', () => ({
  default: {
    TENANT_GITHUB_USERNAME: 'test-user',
    JWT_SECRET: 'test-secret',
  },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/github.service', () => ({ default: mockGitHubService }));
vi.mock('@/services/workspace.service', () => ({ default: mockWorkspaceService }));
vi.mock('@/services/settings.service', () => ({ default: mockSettingsService }));

describe('GitHub Controller Integration Tests', () => {
  let app;
  let GitHubController;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import controller after mocks
    const controllerModule = await import('@/controllers/github.controller.js');
    GitHubController = controllerModule.default;

    // Create express app for testing
    app = express();
    app.use(express.json());
    
    // Setup routes
    app.get('/auth/github', GitHubController.startAuthorization.bind(GitHubController));
    app.get('/auth/github/callback', GitHubController.handleCallback.bind(GitHubController));
    app.get('/api/github/repositories', GitHubController.getRepositories.bind(GitHubController));
    app.get('/api/github/repository/:owner/:repo', GitHubController.getRepository.bind(GitHubController));
    app.post('/api/github/workspace', GitHubController.createWorkspace.bind(GitHubController));
    app.post('/api/github/workspace/:workspaceId/clone', GitHubController.cloneRepository.bind(GitHubController));
    app.get('/api/github/workspaces', GitHubController.getWorkspaces.bind(GitHubController));
    app.delete('/api/github/workspace/:workspaceId', GitHubController.deleteWorkspace.bind(GitHubController));
    app.post('/api/github/workspace/:workspaceId/sync', GitHubController.syncWorkspace.bind(GitHubController));
    app.get('/api/github/auth/status', GitHubController.getAuthStatus.bind(GitHubController));
    app.get('/api/theme', GitHubController.getTheme.bind(GitHubController));
    app.put('/api/theme', GitHubController.updateTheme.bind(GitHubController));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /auth/github', () => {
    it('should redirect to GitHub OAuth URL', async () => {
      mockGitHubService.getAuthorizationUrl.mockReturnValue('https://github.com/login/oauth/authorize?client_id=test');

      const response = await request(app)
        .get('/auth/github')
        .expect(302);

      expect(response.headers.location).toBe('https://github.com/login/oauth/authorize?client_id=test');
      expect(mockGitHubService.getAuthorizationUrl).toHaveBeenCalledWith('single-tenant');
    });

    it('should return 503 when GitHub is not configured', async () => {
      mockGitHubService.isConfigured.mockReturnValue(false);

      await request(app)
        .get('/auth/github')
        .expect(503);
    });
  });

  describe('GET /auth/github/callback', () => {
    it('should handle successful OAuth callback', async () => {
      const mockTokenResult = {
        accessToken: mockGitHubToken,
        user: mockGitHubUser,
      };

      mockGitHubService.exchangeCodeForToken.mockResolvedValue(mockTokenResult);
      mockGitHubService.getUserInfo.mockResolvedValue(mockGitHubUser);
      mockSettingsService.updateGithubToken.mockResolvedValue();

      const response = await request(app)
        .get('/auth/github/callback')
        .query({
          code: 'test-code',
          state: 'test-state',
        })
        .expect(302);

      expect(response.headers.location).toContain('token=mock-jwt-token');
      expect(mockGitHubService.exchangeCodeForToken).toHaveBeenCalledWith('test-code', 'test-state');
      expect(mockSettingsService.updateGithubToken).toHaveBeenCalledWith(mockGitHubToken);
    });

    it('should handle unauthorized user', async () => {
      const unauthorizedUser = { ...mockGitHubUser, login: 'unauthorized-user' };
      const mockTokenResult = {
        accessToken: mockGitHubToken,
        user: unauthorizedUser,
      };

      mockGitHubService.exchangeCodeForToken.mockResolvedValue(mockTokenResult);
      mockGitHubService.getUserInfo.mockResolvedValue(unauthorizedUser);

      const response = await request(app)
        .get('/auth/github/callback')
        .query({
          code: 'test-code',
          state: 'test-state',
        })
        .expect(302);

      expect(response.headers.location).toContain('error=Unauthorized%20user');
    });

    it('should handle missing callback parameters', async () => {
      await request(app)
        .get('/auth/github/callback')
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Invalid callback parameters');
        });
    });

    it('should handle OAuth errors', async () => {
      const response = await request(app)
        .get('/auth/github/callback')
        .query({
          error: 'access_denied',
        })
        .expect(302);

      expect(response.headers.location).toContain('error=access_denied');
    });
  });

  describe('GET /api/github/repositories', () => {
    it('should return user repositories', async () => {
      mockSettingsService.getGithubToken.mockResolvedValue(mockGitHubToken);
      mockGitHubService.validateToken.mockResolvedValue(true);
      mockGitHubService.getUserRepositories.mockResolvedValue([mockGitHubRepository]);

      await request(app)
        .get('/api/github/repositories')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.repositories).toHaveLength(1);
          expect(res.body.repositories[0]).toEqual(mockGitHubRepository);
        });
    });

    it('should handle missing GitHub token', async () => {
      mockSettingsService.getGithubToken.mockResolvedValue(null);

      await request(app)
        .get('/api/github/repositories')
        .expect(401)
        .expect((res) => {
          expect(res.body.error).toBe('GitHub token not found');
        });
    });

    it('should handle expired GitHub token', async () => {
      mockSettingsService.getGithubToken.mockResolvedValue(mockGitHubToken);
      mockGitHubService.validateToken.mockResolvedValue(false);

      await request(app)
        .get('/api/github/repositories')
        .expect(401)
        .expect((res) => {
          expect(res.body.error).toBe('GitHub token expired');
        });
    });
  });

  describe('GET /api/github/repository/:owner/:repo', () => {
    it('should return specific repository info', async () => {
      mockSettingsService.getGithubToken.mockResolvedValue(mockGitHubToken);
      mockGitHubService.getRepositoryInfo.mockResolvedValue(mockGitHubRepository);

      await request(app)
        .get('/api/github/repository/test-user/test-repo')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.repository).toEqual(mockGitHubRepository);
        });

      expect(mockGitHubService.getRepositoryInfo).toHaveBeenCalledWith(
        mockGitHubToken,
        'test-user',
        'test-repo'
      );
    });

    it('should handle missing parameters', async () => {
      await request(app)
        .get('/api/github/repository/test-user/')
        .expect(404); // Express returns 404 for missing route parameters
    });
  });

  describe('POST /api/github/workspace', () => {
    it('should create workspace successfully', async () => {
      const mockWorkspace = {
        id: 'workspace-id',
        name: 'test-repo',
        githubRepo: 'test-user/test-repo',
      };

      mockWorkspaceService.createWorkspace.mockResolvedValue(mockWorkspace);

      await request(app)
        .post('/api/github/workspace')
        .send({
          githubRepo: 'test-user/test-repo',
          githubUrl: 'https://github.com/test-user/test-repo.git',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.workspace).toEqual(mockWorkspace);
        });
    });

    it('should handle invalid repository format', async () => {
      await request(app)
        .post('/api/github/workspace')
        .send({
          githubRepo: 'invalid-format',
          githubUrl: 'https://github.com/invalid-format.git',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Invalid repository format');
        });
    });

    it('should handle missing parameters', async () => {
      await request(app)
        .post('/api/github/workspace')
        .send({
          githubRepo: 'test-user/test-repo',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Invalid parameters');
        });
    });

    it('should handle workspace already exists error', async () => {
      mockWorkspaceService.createWorkspace.mockRejectedValue(
        new Error('Workspace already exists')
      );

      await request(app)
        .post('/api/github/workspace')
        .send({
          githubRepo: 'test-user/test-repo',
          githubUrl: 'https://github.com/test-user/test-repo.git',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.error).toBe('Workspace already exists');
        });
    });
  });

  describe('GET /api/github/workspaces', () => {
    it('should return list of workspaces', async () => {
      const mockWorkspaces = [
        { id: 'ws1', name: 'repo1' },
        { id: 'ws2', name: 'repo2' },
      ];

      mockWorkspaceService.listWorkspaces.mockResolvedValue(mockWorkspaces);

      await request(app)
        .get('/api/github/workspaces')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.workspaces).toEqual(mockWorkspaces);
          expect(res.body.count).toBe(2);
        });
    });

    it('should include inactive workspaces when requested', async () => {
      mockWorkspaceService.listWorkspaces.mockResolvedValue([]);

      await request(app)
        .get('/api/github/workspaces')
        .query({ include_inactive: 'true' })
        .expect(200);

      expect(mockWorkspaceService.listWorkspaces).toHaveBeenCalledWith(true);
    });
  });

  describe('GET /api/github/auth/status', () => {
    it('should return auth status with user info', async () => {
      mockSettingsService.getGithubToken.mockResolvedValue(mockGitHubToken);
      mockGitHubService.validateToken.mockResolvedValue(true);
      mockGitHubService.getUserInfo.mockResolvedValue(mockGitHubUser);

      await request(app)
        .get('/api/github/auth/status')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.authorized).toBe(true);
          expect(res.body.userInfo).toEqual(mockGitHubUser);
          expect(res.body.githubConfigured).toBe(true);
        });
    });

    it('should return unauthorized when no token', async () => {
      mockSettingsService.getGithubToken.mockResolvedValue(null);

      await request(app)
        .get('/api/github/auth/status')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.authorized).toBe(false);
          expect(res.body.userInfo).toBeNull();
        });
    });

    it('should handle expired token', async () => {
      mockSettingsService.getGithubToken.mockResolvedValue(mockGitHubToken);
      mockGitHubService.validateToken.mockResolvedValue(false);

      await request(app)
        .get('/api/github/auth/status')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.authorized).toBe(false);
          expect(res.body.message).toContain('expired');
        });
    });
  });

  describe('GET /api/theme', () => {
    it('should return theme preferences', async () => {
      const mockTheme = {
        name: 'Dark Theme',
        colors: { primary: '#000000' },
      };

      mockSettingsService.getTheme.mockResolvedValue(mockTheme);

      await request(app)
        .get('/api/theme')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.theme).toEqual(mockTheme);
        });
    });
  });

  describe('PUT /api/theme', () => {
    it('should update theme preferences', async () => {
      const themeData = {
        name: 'Custom Theme',
        colors: { primary: '#ffffff' },
      };

      mockSettingsService.updateTheme.mockResolvedValue();

      await request(app)
        .put('/api/theme')
        .send({ theme: themeData })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toContain('updated successfully');
        });

      expect(mockSettingsService.updateTheme).toHaveBeenCalledWith(themeData);
    });

    it('should handle invalid theme data', async () => {
      await request(app)
        .put('/api/theme')
        .send({ theme: 'invalid' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Invalid theme data');
        });
    });

    it('should handle missing theme data', async () => {
      await request(app)
        .put('/api/theme')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Invalid theme data');
        });
    });
  });
});