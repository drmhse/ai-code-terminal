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

    it('getAuthorizationUrl should generate a valid URL', () => {
      const url = GitHubService.getAuthorizationUrl('user-id');
      expect(url).toContain('https://github.com/login/oauth/authorize');
    });

    it('getUserInfo should retrieve user data', async () => {
      const result = await GitHubService.getUserInfo('test-token');
      expect(result.login).toBe('testuser');
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

    it('getAuthenticatedUserInfo should return user info using a valid token', async () => {
      jest.spyOn(GitHubService, 'getOctokit').mockResolvedValue(mockOctokit);
      const userInfo = await GitHubService.getAuthenticatedUserInfo();
      expect(userInfo.login).toBe('testuser');
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
  });
});
