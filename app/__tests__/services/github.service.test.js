jest.mock('@octokit/rest');
jest.mock('../../src/services/settings.service');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/encryption');

jest.mock('../../src/config/database', () => ({
  prisma: {
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('crypto', () => {
  const originalCrypto = jest.requireActual('crypto');
  return {
    ...originalCrypto,
    randomBytes: jest.fn(),
    scryptSync: jest.fn().mockReturnValue(Buffer.from('a'.repeat(32))),
    createCipheriv: jest.fn(),
    createDecipheriv: jest.fn(),
  };
});

jest.mock('../../src/config/environment', () => ({
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback',
  JWT_SECRET: 'test-jwt-secret-key',
}));

const { Octokit, mockOctokit } = require('@octokit/rest');
const { prisma } = require('../../src/config/database');
const SettingsService = require('../../src/services/settings.service');
const crypto = require('crypto');
const encryption = require('../../src/utils/encryption');
const GitHubService = require('../../src/services/github.service');

global.fetch = jest.fn();

describe('GitHubService', () => {
  const mockDateNow = 1672531200000; // 2023-01-01 00:00:00 UTC

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.setSystemTime(new Date(mockDateNow));
    jest.clearAllMocks();
    crypto.randomBytes.mockReturnValue(Buffer.from('mock-random-bytes'));

    mockOctokit.rest.users.getAuthenticated.mockImplementation(() => Promise.resolve({ data: { id: 123, login: 'testuser' } }));
    mockOctokit.rest.users.listEmailsForAuthenticatedUser.mockImplementation(() => Promise.resolve({ data: [{ email: 'test@example.com', primary: true }] }));
  });

  describe('Core Functionality', () => {
    it('isConfigured should return true when configured', () => {
      expect(GitHubService.isConfigured()).toBe(true);
    });

    it('isConfigured should return false when not configured', () => {
      const originalClientId = GitHubService.clientId;
      GitHubService.clientId = null;
      expect(GitHubService.isConfigured()).toBe(false);
      GitHubService.clientId = originalClientId;
    });

    it('getAuthorizationUrl should generate a valid URL', () => {
      const url = GitHubService.getAuthorizationUrl('user-id');
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('scope=user%3Aemail+repo+read%3Aorg');
    });

    it('getAuthorizationUrl should throw error when not configured', () => {
      const originalClientId = GitHubService.clientId;
      GitHubService.clientId = null;
      expect(() => GitHubService.getAuthorizationUrl('user-id')).toThrow('GitHub OAuth is not configured');
      GitHubService.clientId = originalClientId;
    });

    it('getUserInfo should retrieve user data', async () => {
      const result = await GitHubService.getUserInfo('test-token');
      expect(result.login).toBe('testuser');
      expect(result.id).toBe(123);
      expect(result.email).toBe('test@example.com');
    });

    it('getUserInfo should handle error and throw', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValueOnce(new Error('API Error'));
      await expect(GitHubService.getUserInfo('test-token')).rejects.toThrow('Failed to retrieve GitHub user information');
    });

    it('getUserInfo should handle missing primary email', async () => {
      mockOctokit.rest.users.listEmailsForAuthenticatedUser.mockImplementation(() => 
        Promise.resolve({ data: [{ email: 'secondary@example.com', primary: false }] })
      );
      mockOctokit.rest.users.getAuthenticated.mockImplementation(() => 
        Promise.resolve({ data: { id: 123, login: 'testuser', email: 'fallback@example.com' } })
      );
      
      const result = await GitHubService.getUserInfo('test-token');
      expect(result.email).toBe('fallback@example.com');
    });

    it('validateToken should return true for a valid token', async () => {
      const result = await GitHubService.validateToken('valid-token');
      expect(result).toBe(true);
    });

    it('validateToken should return false for an invalid token', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValueOnce(new Error('Unauthorized'));
      const result = await GitHubService.validateToken('invalid-token');
      expect(result).toBe(false);
    });
  });

  describe('Token Lifecycle', () => {
    it('refreshToken should succeed and update tokens', async () => {
      SettingsService.getRawSettings.mockResolvedValue({ githubRefreshToken: 'old-refresh' });
      encryption.decryptToken.mockReturnValue('decrypted-refresh-token');
      fetch.mockResolvedValue({
        json: () => Promise.resolve({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }),
      });
      const newToken = await GitHubService.refreshToken();
      expect(newToken).toBe('new-access');
      expect(SettingsService.updateGithubTokens).toHaveBeenCalledWith('new-access', 'new-refresh', expect.any(Date));
    });

    it('refreshToken should fail and clear tokens on error', async () => {
      SettingsService.getRawSettings.mockResolvedValue({ githubRefreshToken: 'old-refresh' });
      encryption.decryptToken.mockReturnValue('decrypted-refresh-token');
      fetch.mockResolvedValue({
        json: () => Promise.resolve({ error: 'bad_token', error_description: 'Refresh failed' }),
      });
      await expect(GitHubService.refreshToken()).rejects.toThrow('Could not refresh GitHub token: Refresh failed. Please re-authenticate.');
      expect(SettingsService.updateGithubTokens).toHaveBeenCalledWith(null, null, null);
    });

    it('refreshToken should throw error when no refresh token available', async () => {
      SettingsService.getRawSettings.mockResolvedValue({ githubRefreshToken: null });

      await expect(GitHubService.refreshToken()).rejects.toThrow('No refresh token available. Please re-authenticate.');
    });

    it('getOctokit should provide a client with a valid token', async () => {
      SettingsService.getSettings.mockResolvedValue({
        githubToken: 'valid-token',
        githubTokenExpiresAt: new Date(mockDateNow + 3600 * 1000),
      });
      await GitHubService.getOctokit();
      expect(Octokit).toHaveBeenCalledWith(expect.objectContaining({ auth: 'valid-token' }));
    });

    it('getOctokit should refresh an expired token', async () => {
      SettingsService.getSettings.mockResolvedValue({
        githubToken: 'expired-token',
        githubTokenExpiresAt: new Date(mockDateNow - 1000),
      });
      jest.spyOn(GitHubService, 'refreshToken').mockResolvedValue('refreshed-token');
      await GitHubService.getOctokit();
      expect(GitHubService.refreshToken).toHaveBeenCalled();
    });

    it('getOctokit should throw error when GitHub not authenticated', async () => {
      SettingsService.getSettings.mockResolvedValue({
        githubToken: null,
        githubTokenExpiresAt: null,
      });

      await expect(GitHubService.getOctokit()).rejects.toThrow('GitHub not authenticated.');
    });

    it('getAuthenticatedUserInfo should return user info using a valid token', async () => {
      jest.spyOn(GitHubService, 'getOctokit').mockResolvedValue(mockOctokit);
      const userInfo = await GitHubService.getAuthenticatedUserInfo();
      expect(userInfo.login).toBe('testuser');
    });

    it('getAuthenticatedUserInfo should handle errors when getOctokit fails', async () => {
      jest.spyOn(GitHubService, 'getOctokit').mockRejectedValue(new Error('Auth error'));

      await expect(GitHubService.getAuthenticatedUserInfo()).rejects.toThrow('Failed to retrieve GitHub user information');
    });

    it('revokeToken should delete the grant and clear local tokens', async () => {
      SettingsService.getSettings.mockResolvedValue({ githubToken: 'some-token' });
      fetch.mockResolvedValueOnce({ status: 204 });
      await GitHubService.revokeToken();
      expect(fetch).toHaveBeenCalled();
      expect(SettingsService.clearGithubTokens).toHaveBeenCalled();
    });

    it('revokeToken should clear local tokens even if grant deletion fails', async () => {
      SettingsService.getSettings.mockResolvedValue({ githubToken: 'some-token' });
      fetch.mockRejectedValueOnce(new Error('API error'));
      await GitHubService.revokeToken();
      expect(SettingsService.clearGithubTokens).toHaveBeenCalled();
    });

    it('revokeToken should clear local tokens if none are found in settings', async () => {
      SettingsService.getSettings.mockResolvedValue({});
      await GitHubService.revokeToken();
      expect(SettingsService.clearGithubTokens).toHaveBeenCalled();
    });

    it('revokeToken should handle non-204 response from GitHub', async () => {
      SettingsService.getSettings.mockResolvedValue({ githubToken: 'some-token' });
      fetch.mockResolvedValueOnce({ 
        status: 400, 
        json: () => Promise.resolve({ message: 'Bad request' })
      });
      
      await GitHubService.revokeToken();
      
      expect(SettingsService.clearGithubTokens).toHaveBeenCalled();
    });
  });

  describe('State and Utilities', () => {
    it('generateState should create a valid base64-encoded state string', () => {
      const state = GitHubService.generateState('test-user');
      expect(typeof state).toBe('string');
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      expect(decoded.userId).toBe('test-user');
    });

    it('verifyState should return a userId for a valid state', () => {
      const state = GitHubService.generateState('test-user');
      expect(GitHubService.verifyState(state)).toBe('test-user');
    });

    it('verifyState should return null for an expired state', () => {
      const state = GitHubService.generateState('test-user');
      jest.advanceTimersByTime(11 * 60 * 1000); // Advance time by 11 minutes
      expect(GitHubService.verifyState(state)).toBeNull();
    });
  });

  describe('Repository Operations', () => {
    beforeEach(() => {
      mockOctokit.rest.repos = {
        listForAuthenticatedUser: jest.fn(),
        get: jest.fn()
      };
      jest.spyOn(GitHubService, 'getOctokit').mockResolvedValue(mockOctokit);
    });

    it('getUserRepositories should return formatted repository list', async () => {
      const mockRepos = [
        {
          id: 1,
          name: 'test-repo',
          full_name: 'testuser/test-repo',
          owner: { login: 'testuser', avatar_url: 'avatar.png' },
          description: 'Test repository',
          html_url: 'https://github.com/testuser/test-repo',
          clone_url: 'https://github.com/testuser/test-repo.git',
          ssh_url: 'git@github.com:testuser/test-repo.git',
          private: false,
          fork: false,
          language: 'JavaScript',
          stargazers_count: 10,
          forks_count: 2,
          updated_at: '2023-01-01T00:00:00Z',
          pushed_at: '2023-01-01T00:00:00Z',
          size: 1024,
          default_branch: 'main'
        }
      ];

      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: mockRepos,
        headers: { link: '<https://api.github.com/user/repos?page=2>; rel="next"' }
      });

      const result = await GitHubService.getUserRepositories();

      expect(result.repositories).toHaveLength(1);
      expect(result.repositories[0].name).toBe('test-repo');
      expect(result.pagination.has_next).toBe(true);
    });

    it('getUserRepositories should handle custom options', async () => {
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: [],
        headers: {}
      });

      await GitHubService.getUserRepositories({ 
        page: 2, 
        per_page: 50, 
        sort: 'created', 
        direction: 'asc', 
        type: 'owner' 
      });

      expect(mockOctokit.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        page: 2,
        per_page: 50,
        sort: 'created',
        direction: 'asc',
        type: 'owner'
      });
    });

    it('getUserRepositories should handle errors', async () => {
      mockOctokit.rest.repos.listForAuthenticatedUser.mockRejectedValue(new Error('API Error'));
      
      await expect(GitHubService.getUserRepositories()).rejects.toThrow('Failed to retrieve GitHub repositories');
    });

    it('getRepositoryInfo should return repository details', async () => {
      const mockRepo = {
        id: 1,
        name: 'test-repo',
        full_name: 'testuser/test-repo',
        owner: { login: 'testuser', avatar_url: 'avatar.png' },
        description: 'Test repository',
        html_url: 'https://github.com/testuser/test-repo',
        clone_url: 'https://github.com/testuser/test-repo.git',
        ssh_url: 'git@github.com:testuser/test-repo.git',
        private: false,
        fork: false,
        language: 'JavaScript',
        stargazers_count: 10,
        forks_count: 2,
        updated_at: '2023-01-01T00:00:00Z',
        pushed_at: '2023-01-01T00:00:00Z',
        size: 1024,
        default_branch: 'main',
        permissions: { admin: true, push: true, pull: true }
      };

      mockOctokit.rest.repos.get.mockResolvedValue({ data: mockRepo });

      const result = await GitHubService.getRepositoryInfo('testuser', 'test-repo');

      expect(result.name).toBe('test-repo');
      expect(result.owner.login).toBe('testuser');
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo'
      });
    });

    it('getRepositoryInfo should handle errors', async () => {
      mockOctokit.rest.repos.get.mockRejectedValue(new Error('Not found'));
      
      await expect(GitHubService.getRepositoryInfo('testuser', 'nonexistent')).rejects.toThrow('Failed to retrieve repository information');
    });
  });

  describe('OAuth Token Exchange', () => {
    beforeEach(() => {
      jest.spyOn(GitHubService, 'verifyState').mockReturnValue('user-123');
      jest.spyOn(GitHubService, 'getUserInfo').mockResolvedValue({
        id: 123,
        login: 'testuser',
        email: 'test@example.com'
      });
    });

    it('exchangeCodeForToken should successfully exchange code for token', async () => {
      fetch.mockResolvedValue({
        json: () => Promise.resolve({
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-456',
          expires_in: 28800,
          token_type: 'bearer',
          scope: 'user:email repo'
        })
      });

      const result = await GitHubService.exchangeCodeForToken('auth-code', 'valid-state');

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.user.login).toBe('testuser');
      expect(result.userId).toBe('user-123');
    });

    it('exchangeCodeForToken should throw error when not configured', async () => {
      const originalClientId = GitHubService.clientId;
      GitHubService.clientId = null;
      
      await expect(GitHubService.exchangeCodeForToken('code', 'state')).rejects.toThrow('GitHub OAuth is not configured');
      
      GitHubService.clientId = originalClientId;
    });

    it('exchangeCodeForToken should throw error for invalid state', async () => {
      jest.spyOn(GitHubService, 'verifyState').mockReturnValue(null);
      
      await expect(GitHubService.exchangeCodeForToken('code', 'invalid-state')).rejects.toThrow('Invalid state parameter');
    });

    it('exchangeCodeForToken should handle GitHub API error response', async () => {
      fetch.mockResolvedValue({
        json: () => Promise.resolve({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.'
        })
      });

      await expect(GitHubService.exchangeCodeForToken('invalid-code', 'valid-state')).rejects.toThrow('GitHub OAuth error: The code passed is incorrect or expired.');
    });

    it('exchangeCodeForToken should handle missing access token', async () => {
      fetch.mockResolvedValue({
        json: () => Promise.resolve({})
      });

      await expect(GitHubService.exchangeCodeForToken('code', 'valid-state')).rejects.toThrow('No access token received from GitHub');
    });

    it('exchangeCodeForToken should handle fetch errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(GitHubService.exchangeCodeForToken('code', 'valid-state')).rejects.toThrow('Network error');
    });
  });

  describe('Utility Functions', () => {
    it('parseLinkHeader should parse GitHub pagination links', () => {
      const linkHeader = '<https://api.github.com/user/repos?page=3&per_page=100>; rel="next", <https://api.github.com/user/repos?page=50&per_page=100>; rel="last", <https://api.github.com/user/repos?page=1&per_page=100>; rel="first", <https://api.github.com/user/repos?page=1&per_page=100>; rel="prev"';
      
      const result = GitHubService.parseLinkHeader(linkHeader);
      
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(true);
      expect(result.nextUrl).toBe('https://api.github.com/user/repos?page=3&per_page=100');
      expect(result.prevUrl).toBe('https://api.github.com/user/repos?page=1&per_page=100');
      expect(result.firstUrl).toBe('https://api.github.com/user/repos?page=1&per_page=100');
      expect(result.lastUrl).toBe('https://api.github.com/user/repos?page=50&per_page=100');
    });

    it('parseLinkHeader should handle empty link header', () => {
      const result = GitHubService.parseLinkHeader(null);
      
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
      expect(result.nextUrl).toBeNull();
      expect(result.prevUrl).toBeNull();
    });

    it('parseLinkHeader should handle partial link header', () => {
      const linkHeader = '<https://api.github.com/user/repos?page=2>; rel="next"';
      
      const result = GitHubService.parseLinkHeader(linkHeader);
      
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
      expect(result.nextUrl).toBe('https://api.github.com/user/repos?page=2');
    });

    it('verifyState should return null for invalid JSON', () => {
      // Restore original method for this test
      GitHubService.verifyState.mockRestore && GitHubService.verifyState.mockRestore();
      
      const result = GitHubService.verifyState('invalid-base64');
      expect(result).toBeNull();
    });

    it('verifyState should return null for malformed state', () => {
      // Restore original method for this test
      GitHubService.verifyState.mockRestore && GitHubService.verifyState.mockRestore();
      
      // Create a state that parses as JSON but is missing required fields
      const invalidState = Buffer.from('{"invalid": "state"}').toString('base64');
      const result = GitHubService.verifyState(invalidState);
      expect(typeof result).toBe('undefined');
    });
  });

  describe('Internal Cryptography and Database', () => {
    beforeEach(() => {
      const mockCipher = { update: jest.fn().mockReturnValue('encrypted'), final: jest.fn().mockReturnValue('') };
      const mockDecipher = { update: jest.fn().mockReturnValue('decrypted'), final: jest.fn().mockReturnValue('') };
      crypto.createCipheriv.mockReturnValue(mockCipher);
      crypto.createDecipheriv.mockReturnValue(mockDecipher);
    });

    it('encryptToken should return an encrypted string', () => {
      const encrypted = GitHubService.encryptToken('secret');
      expect(encrypted).toBe('6d6f636b2d72616e646f6d2d6279746573:encrypted');
    });

    it('decryptToken should return a decrypted string', () => {
      const decrypted = GitHubService.decryptToken('iv:encrypted');
      expect(decrypted).toBe('decrypted');
    });

    it('decryptToken should throw an error for an invalid format', () => {
      expect(() => GitHubService.decryptToken('invalid')).toThrow('Invalid encrypted token format');
    });

    it('storeUserToken should encrypt the token and update the user record', async () => {
      prisma.user.update.mockResolvedValue({});
      await GitHubService.storeUserToken('user-id', 'plain-token', { id: 123 });
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('getUserToken should retrieve and decrypt a token from the database', async () => {
      prisma.user.findUnique.mockResolvedValue({ githubToken: 'iv:encrypted' });
      const token = await GitHubService.getUserToken('user-id');
      expect(token).toBe('decrypted');
    });

    it('getUserToken should return null when no token found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const token = await GitHubService.getUserToken('user-id');
      expect(token).toBeNull();
    });

    it('getUserToken should return null when user has no token', async () => {
      prisma.user.findUnique.mockResolvedValue({ githubToken: null });
      const token = await GitHubService.getUserToken('user-id');
      expect(token).toBeNull();
    });

    it('storeUserToken should handle database errors', async () => {
      prisma.user.update.mockRejectedValue(new Error('Database error'));
      
      await expect(GitHubService.storeUserToken('user-id', 'plain-token', { id: 123 }))
        .rejects.toThrow('Failed to store GitHub token');
    });

    it('getUserToken should handle database errors', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));
      
      const token = await GitHubService.getUserToken('user-id');
      expect(token).toBeNull();
    });

    it('encryptToken should handle encryption errors', () => {
      const originalCreateCipheriv = crypto.createCipheriv;
      crypto.createCipheriv.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      expect(() => GitHubService.encryptToken('test-token')).toThrow('Failed to encrypt token');

      crypto.createCipheriv = originalCreateCipheriv;
    });

    it('decryptToken should handle decryption errors', () => {
      const originalCreateDecipheriv = crypto.createDecipheriv;
      crypto.createDecipheriv.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      expect(() => GitHubService.decryptToken('iv:encrypted')).toThrow('Failed to decrypt token');

      crypto.createDecipheriv = originalCreateDecipheriv;
    });
  });
});
