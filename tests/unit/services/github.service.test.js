import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import '../../mocks/prisma.js';
import { mockPrismaClient } from '../../mocks/prisma.js';
import { mockGitHubUser, mockGitHubRepository, mockGitHubToken } from '../../fixtures/github-user.js';

// Mock fetch
global.fetch = vi.fn();

// Mock Octokit more effectively
let mockOctokitInstance;

const createMockOctokit = () => ({
  rest: {
    users: {
      getAuthenticated: vi.fn(),
      listEmailsForAuthenticated: vi.fn(),
    },
    repos: {
      listForAuthenticatedUser: vi.fn(),
      get: vi.fn(),
    },
  },
});

// Mock the Octokit constructor to return our mock instance
vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn().mockImplementation(() => {
      mockOctokitInstance = createMockOctokit();
      return mockOctokitInstance;
    })
  };
});

// Mock environment - use correct format
vi.mock('@/config/environment', () => ({
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_CALLBACK_URL: 'http://localhost:3000/auth/github/callback',
  JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only-must-be-at-least-32-chars',
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GitHubService', () => {
  let GitHubServiceClass;
  let githubService;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create fresh mock instance
    mockOctokitInstance = createMockOctokit();
    
    // Import the class and create a new instance to bypass singleton issues
    const module = await import('@/services/github.service.js');
    GitHubServiceClass = module.default.constructor;
    githubService = new GitHubServiceClass();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate valid GitHub OAuth URL', () => {
      const userId = 'test-user-id';
      const url = githubService.getAuthorizationUrl(userId);

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fgithub%2Fcallback');
      expect(url).toContain('scope=user%3Aemail+repo+read%3Aorg');
      expect(url).toContain('state=');
    });

    it('should throw error when not configured', () => {
      githubService.clientId = null;
      
      expect(() => githubService.getAuthorizationUrl('user-id')).toThrow('GitHub OAuth is not configured');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for access token successfully', async () => {
      const code = 'test-auth-code';
      const state = githubService.generateState('test-user-id');

      // Mock fetch response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          access_token: mockGitHubToken,
          token_type: 'bearer',
          scope: 'repo,user:email',
        }),
      });

      // Mock user info using the instance that will be created
      const mockUserResponse = { data: mockGitHubUser };
      const mockEmailsResponse = { data: [{ email: 'test@example.com', primary: true }] };

      // We need to mock at the module level since new Octokit instances are created
      vi.doMock('@octokit/rest', () => ({
        Octokit: vi.fn().mockImplementation(() => ({
          rest: {
            users: {
              getAuthenticated: vi.fn().mockResolvedValue(mockUserResponse),
              listEmailsForAuthenticated: vi.fn().mockResolvedValue(mockEmailsResponse),
            },
          },
        })),
      }));

      const result = await githubService.exchangeCodeForToken(code, state);

      expect(result).toEqual({
        accessToken: mockGitHubToken,
        tokenType: 'bearer',
        scope: 'repo,user:email',
        user: expect.objectContaining({
          id: mockGitHubUser.id,
          login: mockGitHubUser.login,
          email: 'test@example.com',
        }),
        userId: 'test-user-id',
      });
    });

    it('should handle GitHub OAuth error', async () => {
      const code = 'invalid-code';
      const state = githubService.generateState('test-user-id');

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        }),
      });

      await expect(githubService.exchangeCodeForToken(code, state)).rejects.toThrow(
        'GitHub OAuth error: The provided authorization grant is invalid'
      );
    });

    it('should handle invalid state parameter', async () => {
      const code = 'test-code';
      const invalidState = 'invalid-state';

      await expect(githubService.exchangeCodeForToken(code, invalidState)).rejects.toThrow(
        'Invalid state parameter'
      );
    });
  });

  describe('getUserInfo', () => {
    it('should get user information successfully', async () => {
      // Reset the mocks to clear any previous calls
      mockOctokit.rest.users.getAuthenticated.mockReset();
      mockOctokit.rest.users.listEmailsForAuthenticated.mockReset();
      
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: mockGitHubUser,
      });
      
      mockOctokit.rest.users.listEmailsForAuthenticated.mockResolvedValue({
        data: [
          { email: 'test@example.com', primary: true },
          { email: 'secondary@example.com', primary: false },
        ],
      });

      const userInfo = await githubService.getUserInfo(mockGitHubToken);

      expect(userInfo).toEqual({
        id: mockGitHubUser.id,
        login: mockGitHubUser.login,
        name: mockGitHubUser.name,
        email: 'test@example.com',
        avatar_url: mockGitHubUser.avatar_url,
        html_url: mockGitHubUser.html_url,
        company: mockGitHubUser.company,
        location: mockGitHubUser.location,
        public_repos: mockGitHubUser.public_repos,
        followers: mockGitHubUser.followers,
        following: mockGitHubUser.following,
      });
    });

    it('should handle API error', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(new Error('API Error'));

      await expect(githubService.getUserInfo(mockGitHubToken)).rejects.toThrow(
        'Failed to retrieve GitHub user information'
      );
    });
  });

  describe('getUserRepositories', () => {
    it('should get user repositories successfully', async () => {
      // Reset the mocks
      mockOctokit.rest.repos.listForAuthenticatedUser.mockReset();
      
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: [mockGitHubRepository],
      });

      const repos = await githubService.getUserRepositories(mockGitHubToken);

      expect(repos).toHaveLength(1);
      expect(repos[0]).toEqual({
        id: mockGitHubRepository.id,
        name: mockGitHubRepository.name,
        full_name: mockGitHubRepository.full_name,
        owner: {
          login: mockGitHubRepository.owner.login,
          avatar_url: mockGitHubRepository.owner.avatar_url,
        },
        description: mockGitHubRepository.description,
        html_url: mockGitHubRepository.html_url,
        clone_url: mockGitHubRepository.clone_url,
        ssh_url: mockGitHubRepository.ssh_url,
        private: mockGitHubRepository.private,
        fork: mockGitHubRepository.fork,
        language: mockGitHubRepository.language,
        stargazers_count: mockGitHubRepository.stargazers_count,
        forks_count: mockGitHubRepository.forks_count,
        updated_at: mockGitHubRepository.updated_at,
        pushed_at: mockGitHubRepository.pushed_at,
        size: mockGitHubRepository.size,
        default_branch: mockGitHubRepository.default_branch,
      });
    });

    it('should handle API error', async () => {
      mockOctokit.rest.repos.listForAuthenticatedUser.mockRejectedValue(new Error('API Error'));

      await expect(githubService.getUserRepositories(mockGitHubToken)).rejects.toThrow(
        'Failed to retrieve GitHub repositories'
      );
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      // Reset the mocks
      mockOctokit.rest.users.getAuthenticated.mockReset();
      
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: mockGitHubUser,
      });

      const isValid = await githubService.validateToken(mockGitHubToken);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(new Error('Unauthorized'));

      const isValid = await githubService.validateToken('invalid-token');
      expect(isValid).toBe(false);
    });
  });

  describe('generateState and verifyState', () => {
    it('should generate and verify state correctly', () => {
      const userId = 'test-user-id';
      const state = githubService.generateState(userId);

      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);

      const verifiedUserId = githubService.verifyState(state);
      expect(verifiedUserId).toBe(userId);
    });

    it('should return null for expired state', () => {
      const userId = 'test-user-id';
      const expiredTimestamp = Date.now() - (11 * 60 * 1000); // 11 minutes ago
      const expiredPayload = JSON.stringify({
        userId,
        timestamp: expiredTimestamp,
        random: 'test',
      });
      const expiredState = Buffer.from(expiredPayload).toString('base64');

      const verifiedUserId = githubService.verifyState(expiredState);
      expect(verifiedUserId).toBeNull();
    });

    it('should return null for invalid state format', () => {
      const invalidState = 'invalid-base64-state';
      const verifiedUserId = githubService.verifyState(invalidState);
      expect(verifiedUserId).toBeNull();
    });
  });

  describe('token encryption/decryption', () => {
    it('should encrypt and decrypt token correctly', () => {
      const originalToken = 'gho_test_token_123456789';
      
      const encrypted = githubService.encryptToken(originalToken);
      expect(encrypted).not.toBe(originalToken);
      expect(encrypted).toContain(':');

      const decrypted = githubService.decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('should throw error for invalid encrypted token format', () => {
      expect(() => githubService.decryptToken('invalid-format')).toThrow(
        'Failed to decrypt token'
      );
    });
  });

  describe('isConfigured', () => {
    it('should return true when properly configured', () => {
      expect(githubService.isConfigured()).toBe(true);
    });

    it('should return false when missing configuration', () => {
      githubService.clientId = null;
      expect(githubService.isConfigured()).toBe(false);
    });
  });
});