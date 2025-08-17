// Mock dependencies
jest.mock('../../src/config/database', () => {
  const actualDatabase = jest.requireActual('../../src/config/database');
  return {
    ...actualDatabase, // Keep actual implementation for non-mocked methods
    prisma: {
      settings: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
    },
  };
});
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/encryption', () => ({
  encryptToken: jest.fn().mockImplementation((token) => token ? `encrypted_${token}` : null),
  decryptToken: jest.fn().mockImplementation((encryptedToken) => {
    if (!encryptedToken) return null;
    return encryptedToken.replace('encrypted_', '');
  })
}));

const { prisma } = require('../../src/config/database');
const logger = require('../../src/utils/logger');
const encryption = require('../../src/utils/encryption');

describe('SettingsService', () => {
  let SettingsService;

  beforeEach(() => {
    SettingsService = require('../../src/services/settings.service');
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return settings when they exist', async () => {
      const mockSettings = {
        id: 'singleton',
        githubToken: 'encrypted_token',
        theme: JSON.stringify({ theme: 'dark' }),
        githubRefreshToken: null
      };
      
      prisma.settings.findUnique.mockResolvedValue(mockSettings);
      
      const result = await SettingsService.getSettings();
      
      expect(prisma.settings.findUnique).toHaveBeenCalledWith({
        where: { id: 'singleton' }
      });
      
      expect(result).toEqual({
        ...mockSettings,
        githubToken: 'token' // Decrypted token
      });
    });

    it('should create settings when they do not exist', async () => {
      prisma.settings.findUnique.mockResolvedValue(null);
      prisma.settings.create.mockResolvedValue({ id: 'singleton' });
      
      const result = await SettingsService.getSettings();
      
      expect(prisma.settings.findUnique).toHaveBeenCalledWith({
        where: { id: 'singleton' }
      });
      
      expect(prisma.settings.create).toHaveBeenCalledWith({
        data: { id: 'singleton' }
      });
      
      expect(result).toEqual({
        id: 'singleton',
        githubToken: null,
        githubRefreshToken: null
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.settings.findUnique.mockRejectedValue(error);
      
      await expect(SettingsService.getSettings()).rejects.toThrow('Failed to get settings');
      expect(logger.error).toHaveBeenCalledWith('Failed to get settings:', error);
    });
  });

  describe('updateGithubTokens', () => {
    it('should update GitHub tokens when settings exist', async () => {
      const accessToken = 'new-access-token';
      const refreshToken = 'new-refresh-token';
      const expiresAt = new Date(Date.now() + 3600000);
      
      prisma.settings.upsert.mockResolvedValue({
        id: 'singleton',
        githubToken: 'encrypted_new-access-token',
        githubRefreshToken: 'encrypted_new-refresh-token',
        githubTokenExpiresAt: expiresAt
      });
      
      await SettingsService.updateGithubTokens(accessToken, refreshToken, expiresAt);
      
      expect(prisma.settings.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: expect.objectContaining({
          id: 'singleton',
          githubToken: expect.any(String),
          githubRefreshToken: expect.any(String),
          githubTokenExpiresAt: expiresAt
        }),
        update: expect.objectContaining({
          githubToken: expect.any(String),
          githubRefreshToken: expect.any(String),
          githubTokenExpiresAt: expiresAt
        })
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.settings.upsert.mockRejectedValue(error);
      
      await expect(SettingsService.updateGithubTokens('token', 'refresh', new Date()))
        .rejects.toThrow('Failed to update GitHub tokens');
      expect(logger.error).toHaveBeenCalledWith('Failed to update GitHub tokens:', error);
    });
  });

  describe('getTheme', () => {
    it('should return parsed theme when it exists', async () => {
      const mockTheme = {
        name: 'VS Code Dark',
        type: 'dark',
        colors: {
          primary: '#1e1e1e',
          secondary: '#252526', 
          tertiary: '#2d2d30',
          sidebar: '#181818',
          border: '#3c3c3c',
          textPrimary: '#cccccc',
          textSecondary: '#969696',
          textMuted: '#6a6a6a',
          accentBlue: '#007acc',
          accentGreen: '#16825d',
          accentRed: '#f14c4c',
          terminalBg: '#1e1e1e'
        },
        terminal: {
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#cccccc',
          selection: '#264f78',
          black: '#000000',
          red: '#f14c4c',
          green: '#16825d',
          yellow: '#ff8c00',
          blue: '#007acc',
          magenta: '#c678dd',
          cyan: '#56b6c2',
          white: '#cccccc',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#16825d',
          brightYellow: '#ff8c00',
          brightBlue: '#007acc',
          brightMagenta: '#c678dd',
          brightCyan: '#56b6c2',
          brightWhite: '#ffffff'
        }
      };
      prisma.settings.findUnique.mockResolvedValue({
        id: 'singleton',
        theme: JSON.stringify(mockTheme)
      });
      
      const result = await SettingsService.getTheme();
      
      expect(result).toEqual(mockTheme);
    });

    it('should return default theme when no theme is set', async () => {
      prisma.settings.findUnique.mockResolvedValue({
        id: 'singleton',
        theme: null
      });
      
      const result = await SettingsService.getTheme();
      
      expect(result).toHaveProperty('name', 'VS Code Dark');
      expect(result).toHaveProperty('type', 'dark');
    });

    it('should return default theme when settings do not exist', async () => {
      prisma.settings.findUnique.mockResolvedValue(null);
      prisma.settings.create.mockResolvedValue({ id: 'singleton' });
      
      const result = await SettingsService.getTheme();
      
      expect(result).toHaveProperty('name', 'VS Code Dark');
      expect(result).toHaveProperty('type', 'dark');
    });

    it('should return default theme when theme parsing fails', async () => {
      prisma.settings.findUnique.mockResolvedValue({
        id: 'singleton',
        theme: 'invalid-json'
      });
      
      const result = await SettingsService.getTheme();
      
      expect(result).toHaveProperty('name', 'VS Code Dark');
      expect(result).toHaveProperty('type', 'dark');
    });
  });

  describe('updateTheme', () => {
    it('should update theme when settings exist', async () => {
      const newTheme = { theme: 'light', fontSize: 16 };
      
      prisma.settings.upsert.mockResolvedValue({
        id: 'singleton',
        theme: JSON.stringify(newTheme)
      });
      
      await SettingsService.updateTheme(newTheme);
      
      expect(prisma.settings.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: expect.objectContaining({
          id: 'singleton',
          theme: JSON.stringify(newTheme)
        }),
        update: expect.objectContaining({
          theme: JSON.stringify(newTheme)
        })
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.settings.upsert.mockRejectedValue(error);
      
      await expect(SettingsService.updateTheme({ theme: 'dark' }))
        .rejects.toThrow('Failed to update theme preferences');
      expect(logger.error).toHaveBeenCalledWith('Failed to update theme:', error);
    });
  });

  describe('updateGithubToken (legacy)', () => {
    it('should update GitHub token successfully', async () => {
      const token = 'github-token-123';
      
      prisma.settings.upsert.mockResolvedValue({
        id: 'singleton',
        githubToken: 'encrypted_github-token-123'
      });
      
      const result = await SettingsService.updateGithubToken(token);
      
      expect(prisma.settings.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: expect.objectContaining({
          id: 'singleton',
          githubToken: 'encrypted_github-token-123'
        }),
        update: expect.objectContaining({
          githubToken: 'encrypted_github-token-123'
        })
      });
      
      expect(result.githubToken).toBe(token);
      expect(logger.info).toHaveBeenCalledWith('GitHub token updated');
    });

    it('should handle null token', async () => {
      prisma.settings.upsert.mockResolvedValue({
        id: 'singleton',
        githubToken: null
      });
      
      const result = await SettingsService.updateGithubToken(null);
      
      expect(result.githubToken).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.settings.upsert.mockRejectedValue(error);
      
      await expect(SettingsService.updateGithubToken('token'))
        .rejects.toThrow('Failed to update GitHub token');
      expect(logger.error).toHaveBeenCalledWith('Failed to update GitHub token:', error);
    });
  });

  describe('getRawSettings', () => {
    it('should return raw settings with encrypted tokens', async () => {
      const mockRawSettings = {
        id: 'singleton',
        githubToken: 'encrypted_token',
        githubRefreshToken: 'encrypted_refresh_token',
        githubTokenExpiresAt: new Date()
      };
      
      prisma.settings.findUnique.mockResolvedValue(mockRawSettings);
      
      const result = await SettingsService.getRawSettings();
      
      expect(prisma.settings.findUnique).toHaveBeenCalledWith({
        where: { id: 'singleton' }
      });
      
      expect(result).toEqual(mockRawSettings);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.settings.findUnique.mockRejectedValue(error);
      
      await expect(SettingsService.getRawSettings()).rejects.toThrow('Failed to get raw settings');
      expect(logger.error).toHaveBeenCalledWith('Failed to get raw settings:', error);
    });
  });

  describe('clearGithubTokens', () => {
    it('should clear GitHub tokens successfully', async () => {
      prisma.settings.upsert.mockResolvedValue({
        id: 'singleton',
        githubToken: null,
        githubRefreshToken: null,
        githubTokenExpiresAt: null
      });
      
      await SettingsService.clearGithubTokens();
      
      expect(prisma.settings.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: expect.objectContaining({
          id: 'singleton',
          githubToken: null,
          githubRefreshToken: null,
          githubTokenExpiresAt: null
        }),
        update: expect.objectContaining({
          githubToken: null,
          githubRefreshToken: null,
          githubTokenExpiresAt: null
        })
      });
      
      expect(logger.info).toHaveBeenCalledWith('Cleared GitHub tokens from database');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.settings.upsert.mockRejectedValue(error);
      
      await expect(SettingsService.clearGithubTokens()).rejects.toThrow('Failed to clear GitHub tokens');
      expect(logger.error).toHaveBeenCalledWith('Failed to clear GitHub tokens from database:', error);
    });
  });

  describe('getGithubToken', () => {
    it('should return GitHub token when it exists', async () => {
      // Mock getSettings to return decrypted settings
      const mockSettings = {
        id: 'singleton',
        githubToken: 'decrypted-token'
      };
      
      jest.spyOn(SettingsService, 'getSettings').mockResolvedValue(mockSettings);
      
      const result = await SettingsService.getGithubToken();
      
      expect(result).toBe('decrypted-token');
    });

    it('should return null when no token exists', async () => {
      const mockSettings = {
        id: 'singleton',
        githubToken: null
      };
      
      jest.spyOn(SettingsService, 'getSettings').mockResolvedValue(mockSettings);
      
      const result = await SettingsService.getGithubToken();
      
      expect(result).toBeNull();
    });

    it('should return null when getSettings fails', async () => {
      const error = new Error('Settings error');
      jest.spyOn(SettingsService, 'getSettings').mockRejectedValue(error);
      
      const result = await SettingsService.getGithubToken();
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to get GitHub token:', error);
    });
  });
});