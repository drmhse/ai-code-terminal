// Mock dependencies
jest.mock('@octokit/rest');
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/environment', () => ({
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback',
  JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-very-long'
}));
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('test-random-bytes'))
}));

const { Octokit } = require('@octokit/rest');
const { prisma } = require('../../src/config/database');
const logger = require('../../src/utils/logger');
const crypto = require('crypto');

describe('GitHubService', () => {
  let GitHubService;

  beforeEach(() => {
    // Set environment variables
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
    process.env.GITHUB_CALLBACK_URL = 'http://localhost:3001/auth/github/callback';
    
    // Reset modules to ensure fresh mock states
    jest.resetModules();
    
    // Set up mocks
    prisma.settings = {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn()
    };
    
    prisma.user = {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    };
    
    GitHubService = require('../../src/services/github.service');
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when GitHub is configured', () => {
      const result = GitHubService.isConfigured();
      expect(result).toBe(true);
    });

    it('should return false when GitHub client ID is missing', () => {
      // Mock the environment configuration to return undefined for GITHUB_CLIENT_ID
      jest.doMock('../../src/config/environment', () => ({
        GITHUB_CLIENT_ID: undefined,
        GITHUB_CLIENT_SECRET: 'test-client-secret',
        GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback',
        JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-very-long'
      }));
      
      // Reset modules to get fresh GitHubService with new environment
      jest.resetModules();
      const GitHubServiceWithMissingId = require('../../src/services/github.service');
      
      const result = GitHubServiceWithMissingId.isConfigured();
      expect(result).toBe(false);
      
      // Restore the original mock
      jest.doMock('../../src/config/environment', () => ({
        GITHUB_CLIENT_ID: 'test-client-id',
        GITHUB_CLIENT_SECRET: 'test-client-secret',
        GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback',
        JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-very-long'
      }));
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL', () => {
      // Mock crypto.randomBytes
      crypto.randomBytes.mockReturnValue(Buffer.from('test-random-bytes'));
      
      const url = GitHubService.getAuthorizationUrl('user-id');
      
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fgithub%2Fcallback');
      expect(url).toContain('scope=user%3Aemail+repo+read%3Aorg');
      expect(url).toContain('state='); // Should contain state parameter
      expect(url).toContain('response_type=code');
    });

    it('should throw error when not configured', () => {
      // Mock the environment configuration to have missing values
      jest.doMock('../../src/config/environment', () => ({
        GITHUB_CLIENT_ID: undefined,
        GITHUB_CLIENT_SECRET: undefined,
        GITHUB_CALLBACK_URL: undefined,
        JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-very-long'
      }));
      
      // Reset modules to get fresh GitHubService with new environment
      jest.resetModules();
      const UnconfiguredGitHubService = require('../../src/services/github.service');
      
      expect(() => UnconfiguredGitHubService.getAuthorizationUrl('user-id'))
        .toThrow('GitHub OAuth is not configured');
        
      // Restore the original mock
      jest.doMock('../../src/config/environment', () => ({
        GITHUB_CLIENT_ID: 'test-client-id',
        GITHUB_CLIENT_SECRET: 'test-client-secret',
        GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback',
        JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-very-long'
      }));
    });
  });

  describe('generateState', () => {
    it('should generate valid state parameter', () => {
      const userId = 'test-user-123';
      const state = GitHubService.generateState(userId);
      
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
      
      // Should be base64 encoded
      const decoded = Buffer.from(state, 'base64').toString();
      const parsed = JSON.parse(decoded);
      
      expect(parsed).toHaveProperty('userId', userId);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('random');
    });
  });

  describe('verifyState', () => {
    it('should verify valid state and return userId', () => {
      const userId = 'test-user-123';
      const state = GitHubService.generateState(userId);
      
      const result = GitHubService.verifyState(state);
      expect(result).toBe(userId);
    });

    it('should return null for expired state', () => {
      const userId = 'test-user-123';
      
      // Create an expired state (older than 10 minutes)
      const expiredTimestamp = Date.now() - (11 * 60 * 1000);
      const payload = JSON.stringify({
        userId,
        timestamp: expiredTimestamp,
        random: 'test-random'
      });
      const expiredState = Buffer.from(payload).toString('base64');
      
      const result = GitHubService.verifyState(expiredState);
      expect(result).toBeNull();
    });

    it('should return null for invalid state format', () => {
      const invalidState = 'invalid-base64-!@#$%';
      const result = GitHubService.verifyState(invalidState);
      expect(result).toBeNull();
    });
  });

  describe('getUserInfo', () => {
    it('should get user information successfully', async () => {
      const mockUser = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://github.com/avatar.png',
        html_url: 'https://github.com/testuser',
        company: 'Test Company',
        location: 'Test City',
        public_repos: 10,
        followers: 5,
        following: 3
      };

      const mockEmails = [
        { email: 'test@example.com', primary: true },
        { email: 'other@example.com', primary: false }
      ];

      const mockOctokit = {
        rest: {
          users: {
            getAuthenticated: jest.fn().mockResolvedValue({ data: mockUser }),
            listEmailsForAuthenticatedUser: jest.fn().mockResolvedValue({ data: mockEmails })
          }
        }
      };

      // Clear previous mocks and set up fresh mock
      jest.clearAllMocks();
      Octokit.mockClear();
      Octokit.mockImplementation(() => mockOctokit);

      const result = await GitHubService.getUserInfo('test-token');

      expect(Octokit).toHaveBeenCalledWith({
        auth: 'test-token',
        userAgent: 'claude-code-web-interface'
      });
      expect(result).toEqual({
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://github.com/avatar.png',
        html_url: 'https://github.com/testuser',
        company: 'Test Company',
        location: 'Test City',
        public_repos: 10,
        followers: 5,
        following: 3
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockOctokit = {
        rest: {
          users: {
            getAuthenticated: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      };

      Octokit.mockImplementation(() => mockOctokit);

      await expect(GitHubService.getUserInfo('invalid-token'))
        .rejects.toThrow('Failed to retrieve GitHub user information');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      const mockOctokit = {
        rest: {
          users: {
            getAuthenticated: jest.fn().mockResolvedValue({ data: { id: 123 } })
          }
        }
      };

      Octokit.mockImplementation(() => mockOctokit);

      const result = await GitHubService.validateToken('valid-token');
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const mockOctokit = {
        rest: {
          users: {
            getAuthenticated: jest.fn().mockRejectedValue(new Error('Unauthorized'))
          }
        }
      };

      // Clear previous mocks first
      jest.clearAllMocks();
      Octokit.mockImplementation(() => mockOctokit);

      const result = await GitHubService.validateToken('invalid-token');
      expect(result).toBe(false);
    });
  });

  describe('parseLinkHeader', () => {
    it('should parse Link header with all pagination links', () => {
      const linkHeader = '<https://api.github.com/repos?page=2>; rel="next", <https://api.github.com/repos?page=1>; rel="prev", <https://api.github.com/repos?page=1>; rel="first", <https://api.github.com/repos?page=10>; rel="last"';
      
      const result = GitHubService.parseLinkHeader(linkHeader);
      
      expect(result).toEqual({
        hasNext: true,
        hasPrev: true,
        nextUrl: 'https://api.github.com/repos?page=2',
        prevUrl: 'https://api.github.com/repos?page=1',
        firstUrl: 'https://api.github.com/repos?page=1',
        lastUrl: 'https://api.github.com/repos?page=10'
      });
    });

    it('should handle empty Link header', () => {
      const result = GitHubService.parseLinkHeader('');
      
      expect(result).toEqual({
        hasNext: false,
        hasPrev: false,
        nextUrl: null,
        prevUrl: null,
        firstUrl: null,
        lastUrl: null
      });
    });

    it('should handle null Link header', () => {
      const result = GitHubService.parseLinkHeader(null);
      
      expect(result).toEqual({
        hasNext: false,
        hasPrev: false,
        nextUrl: null,
        prevUrl: null,
        firstUrl: null,
        lastUrl: null
      });
    });
  });

  describe('encryptToken', () => {
    it('should encrypt token successfully', () => {
      const token = 'github-token-123';
      const encrypted = GitHubService.encryptToken(token);
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':'); // Should have IV:encrypted format
      expect(encrypted.split(':').length).toBe(2);
    });
  });

  describe('decryptToken', () => {
    it('should decrypt token successfully', () => {
      const originalToken = 'github-token-123';
      const encrypted = GitHubService.encryptToken(originalToken);
      const decrypted = GitHubService.decryptToken(encrypted);
      
      expect(decrypted).toBe(originalToken);
    });

    it('should throw error for invalid token format', () => {
      expect(() => GitHubService.decryptToken('invalid-format'))
        .toThrow('Failed to decrypt token');
    });
  });

  describe('getUserRepositories', () => {
    it('should get user repositories with pagination', async () => {
      const mockRepos = [
        {
          id: 1,
          name: 'test-repo',
          full_name: 'user/test-repo',
          owner: { login: 'user', avatar_url: 'avatar.png' },
          description: 'Test repository',
          html_url: 'https://github.com/user/test-repo',
          clone_url: 'https://github.com/user/test-repo.git',
          ssh_url: 'git@github.com:user/test-repo.git',
          private: false,
          fork: false,
          language: 'JavaScript',
          stargazers_count: 5,
          forks_count: 2,
          updated_at: '2023-01-01T00:00:00Z',
          pushed_at: '2023-01-01T00:00:00Z',
          size: 1024,
          default_branch: 'main'
        }
      ];

      const mockResponse = {
        data: mockRepos,
        headers: {
          link: '<https://api.github.com/repos?page=2>; rel="next"'
        }
      };

      const mockOctokit = {
        rest: {
          repos: {
            listForAuthenticatedUser: jest.fn().mockResolvedValue(mockResponse)
          }
        }
      };

      // Mock getOctokit to return our mock
      jest.spyOn(GitHubService, 'getOctokit').mockResolvedValue(mockOctokit);

      const result = await GitHubService.getUserRepositories({ page: 1 });

      expect(result.repositories).toHaveLength(1);
      expect(result.repositories[0]).toEqual({
        id: 1,
        name: 'test-repo',
        full_name: 'user/test-repo',
        owner: { login: 'user', avatar_url: 'avatar.png' },
        description: 'Test repository',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        ssh_url: 'git@github.com:user/test-repo.git',
        private: false,
        fork: false,
        language: 'JavaScript',
        stargazers_count: 5,
        forks_count: 2,
        updated_at: '2023-01-01T00:00:00Z',
        pushed_at: '2023-01-01T00:00:00Z',
        size: 1024,
        default_branch: 'main'
      });

      expect(result.pagination).toEqual({
        page: 1,
        per_page: 100,
        has_next: true,
        has_prev: false,
        total_count: 1,
        next_url: 'https://api.github.com/repos?page=2',
        prev_url: null
      });
    });
  });

  describe('getRepositoryInfo', () => {
    it('should get specific repository information', async () => {
      const mockRepo = {
        id: 1,
        name: 'test-repo',
        full_name: 'user/test-repo',
        owner: { login: 'user', avatar_url: 'avatar.png' },
        description: 'Test repository',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        ssh_url: 'git@github.com:user/test-repo.git',
        private: false,
        fork: false,
        language: 'JavaScript',
        stargazers_count: 5,
        forks_count: 2,
        updated_at: '2023-01-01T00:00:00Z',
        pushed_at: '2023-01-01T00:00:00Z',
        size: 1024,
        default_branch: 'main',
        permissions: { admin: true, push: true, pull: true }
      };

      const mockOctokit = {
        rest: {
          repos: {
            get: jest.fn().mockResolvedValue({ data: mockRepo })
          }
        }
      };

      jest.spyOn(GitHubService, 'getOctokit').mockResolvedValue(mockOctokit);

      const result = await GitHubService.getRepositoryInfo('user', 'test-repo');

      expect(result).toEqual({
        id: 1,
        name: 'test-repo',
        full_name: 'user/test-repo',
        owner: { login: 'user', avatar_url: 'avatar.png' },
        description: 'Test repository',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        ssh_url: 'git@github.com:user/test-repo.git',
        private: false,
        fork: false,
        language: 'JavaScript',
        stargazers_count: 5,
        forks_count: 2,
        updated_at: '2023-01-01T00:00:00Z',
        pushed_at: '2023-01-01T00:00:00Z',
        size: 1024,
        default_branch: 'main',
        permissions: { admin: true, push: true, pull: true }
      });
    });
  });

  describe('storeUserToken', () => {
    it('should store encrypted user token', async () => {
      const userId = 'user-123';
      const accessToken = 'github-token';
      const userInfo = {
        id: 12345,
        email: 'test@example.com'
      };

      const mockUpdatedUser = {
        id: userId,
        username: 'testuser',
        githubId: '12345',
        githubToken: 'encrypted-token',
        email: 'test@example.com'
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await GitHubService.storeUserToken(userId, accessToken, userInfo);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          githubId: '12345',
          githubToken: expect.any(String),
          email: 'test@example.com'
        }
      });
      expect(result).toEqual(mockUpdatedUser);
    });
  });

  describe('getUserToken', () => {
    it('should get and decrypt user token', async () => {
      const userId = 'user-123';
      const originalToken = 'github-token-123';
      const encryptedToken = GitHubService.encryptToken(originalToken);

      prisma.user.findUnique.mockResolvedValue({
        githubToken: encryptedToken
      });

      const result = await GitHubService.getUserToken(userId);

      expect(result).toBe(originalToken);
    });

    it('should return null when user has no token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await GitHubService.getUserToken('user-123');

      expect(result).toBeNull();
    });
  });
});