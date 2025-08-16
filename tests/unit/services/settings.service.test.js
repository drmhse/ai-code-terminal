import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../mocks/prisma.js';
import { mockPrismaClient } from '../../mocks/prisma.js';

// Mock encryption utility
const mockEncryption = {
  encryptToken: vi.fn(),
  decryptToken: vi.fn(),
};
vi.mock('@/utils/encryption', () => ({ default: mockEncryption }));

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SettingsService', () => {
  let SettingsServiceClass;
  let settingsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock encryption functions
    mockEncryption.encryptToken.mockImplementation((token) => `encrypted_${token}`);
    mockEncryption.decryptToken.mockImplementation((token) => token.replace('encrypted_', ''));

    // Import after mocks are set up and create fresh instance
    const module = await import('@/services/settings.service.js');
    SettingsServiceClass = module.default.constructor;
    settingsService = new SettingsServiceClass();
  });

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      const mockSettings = {
        id: 'singleton',
        githubToken: 'encrypted_token123',
        theme: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.settings.findUnique.mockResolvedValue(mockSettings);

      const result = await settingsService.getSettings();

      expect(mockPrismaClient.settings.findUnique).toHaveBeenCalledWith({
        where: { id: 'singleton' },
      });
      expect(result).toEqual({
        ...mockSettings,
        githubToken: 'token123', // decrypted
      });
    });

    it('should create default settings if none exist', async () => {
      const newSettings = {
        id: 'singleton',
        githubToken: null,
        theme: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.settings.findUnique.mockResolvedValue(null);
      mockPrismaClient.settings.create.mockResolvedValue(newSettings);

      const result = await settingsService.getSettings();

      expect(mockPrismaClient.settings.create).toHaveBeenCalledWith({
        data: { id: 'singleton' },
      });
      expect(result).toEqual(newSettings);
    });

    it('should handle database errors', async () => {
      mockPrismaClient.settings.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(settingsService.getSettings()).rejects.toThrow('Failed to get settings');
    });
  });

  describe('updateGithubToken', () => {
    it('should update GitHub token successfully', async () => {
      const token = 'gho_test_token';
      const updatedSettings = {
        id: 'singleton',
        githubToken: 'encrypted_gho_test_token',
        theme: null,
      };

      mockPrismaClient.settings.upsert.mockResolvedValue(updatedSettings);

      const result = await settingsService.updateGithubToken(token);

      expect(mockEncryption.encryptToken).toHaveBeenCalledWith(token);
      expect(mockPrismaClient.settings.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          githubToken: 'encrypted_gho_test_token',
        },
        update: {
          githubToken: 'encrypted_gho_test_token',
        },
      });
      expect(result.githubToken).toBe('gho_test_token'); // decrypted
    });

    it('should handle null token', async () => {
      const updatedSettings = {
        id: 'singleton',
        githubToken: null,
        theme: null,
      };

      mockPrismaClient.settings.upsert.mockResolvedValue(updatedSettings);

      const result = await settingsService.updateGithubToken(null);

      expect(mockEncryption.encryptToken).not.toHaveBeenCalled();
      expect(mockPrismaClient.settings.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          githubToken: null,
        },
        update: {
          githubToken: null,
        },
      });
      expect(result.githubToken).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPrismaClient.settings.upsert.mockRejectedValue(new Error('Database error'));

      await expect(settingsService.updateGithubToken('token')).rejects.toThrow(
        'Failed to update GitHub token'
      );
    });
  });

  describe('getGithubToken', () => {
    it('should return GitHub token', async () => {
      const mockSettings = {
        id: 'singleton',
        githubToken: 'decrypted_token',
        theme: null,
      };

      vi.spyOn(settingsService, 'getSettings').mockResolvedValue(mockSettings);

      const result = await settingsService.getGithubToken();

      expect(result).toBe('decrypted_token');
    });

    it('should return null on error', async () => {
      vi.spyOn(settingsService, 'getSettings').mockRejectedValue(new Error('Error'));

      const result = await settingsService.getGithubToken();

      expect(result).toBeNull();
    });
  });

  describe('updateTheme', () => {
    it('should update theme preferences successfully', async () => {
      const themeData = {
        name: 'Custom Dark',
        type: 'dark',
        colors: { primary: '#000000' },
      };

      const updatedSettings = {
        id: 'singleton',
        githubToken: null,
        theme: JSON.stringify(themeData),
      };

      mockPrismaClient.settings.upsert.mockResolvedValue(updatedSettings);

      const result = await settingsService.updateTheme(themeData);

      expect(mockPrismaClient.settings.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          theme: JSON.stringify(themeData),
        },
        update: {
          theme: JSON.stringify(themeData),
        },
      });
      expect(result.theme).toBe(JSON.stringify(themeData));
    });

    it('should handle database errors', async () => {
      mockPrismaClient.settings.upsert.mockRejectedValue(new Error('Database error'));

      await expect(settingsService.updateTheme({})).rejects.toThrow(
        'Failed to update theme preferences'
      );
    });
  });

  describe('getTheme', () => {
    it('should return parsed theme when it exists', async () => {
      const themeData = {
        name: 'Custom Dark',
        type: 'dark',
        colors: { primary: '#000000' },
      };

      const mockSettings = {
        id: 'singleton',
        githubToken: null,
        theme: JSON.stringify(themeData),
      };

      vi.spyOn(settingsService, 'getSettings').mockResolvedValue(mockSettings);

      const result = await settingsService.getTheme();

      expect(result).toEqual(themeData);
    });

    it('should return default theme when no theme is set', async () => {
      const mockSettings = {
        id: 'singleton',
        githubToken: null,
        theme: null,
      };

      vi.spyOn(settingsService, 'getSettings').mockResolvedValue(mockSettings);

      const result = await settingsService.getTheme();

      expect(result.name).toBe('VS Code Dark');
      expect(result.type).toBe('dark');
      expect(result.colors).toBeDefined();
      expect(result.terminal).toBeDefined();
    });

    it('should return default theme on error', async () => {
      vi.spyOn(settingsService, 'getSettings').mockRejectedValue(new Error('Error'));

      const result = await settingsService.getTheme();

      expect(result.name).toBe('VS Code Dark');
    });

    it('should handle JSON parse error and return default theme', async () => {
      const mockSettings = {
        id: 'singleton',
        githubToken: null,
        theme: 'invalid-json',
      };

      vi.spyOn(settingsService, 'getSettings').mockResolvedValue(mockSettings);

      const result = await settingsService.getTheme();

      expect(result.name).toBe('VS Code Dark');
    });
  });

  describe('_getDefaultTheme', () => {
    it('should return complete default theme object', () => {
      const defaultTheme = settingsService._getDefaultTheme();

      expect(defaultTheme).toEqual({
        name: 'VS Code Dark',
        type: 'dark',
        colors: expect.objectContaining({
          primary: '#1e1e1e',
          secondary: '#252526',
          textPrimary: '#cccccc',
        }),
        terminal: expect.objectContaining({
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#cccccc',
        }),
      });
    });
  });

  describe('_decryptTokens', () => {
    it('should decrypt GitHub token if present', () => {
      const settings = {
        id: 'singleton',
        githubToken: 'encrypted_token',
        theme: null,
      };

      const result = settingsService._decryptTokens(settings);

      expect(mockEncryption.decryptToken).toHaveBeenCalledWith('encrypted_token');
      expect(result.githubToken).toBe('token'); // decrypted
    });

    it('should handle null settings', () => {
      const result = settingsService._decryptTokens(null);
      expect(result).toBeNull();
    });

    it('should handle null GitHub token', () => {
      const settings = {
        id: 'singleton',
        githubToken: null,
        theme: null,
      };

      const result = settingsService._decryptTokens(settings);

      expect(mockEncryption.decryptToken).not.toHaveBeenCalled();
      expect(result.githubToken).toBeNull();
    });
  });
});