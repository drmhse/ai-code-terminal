import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mock fs
const mockFs = {
  readFileSync: vi.fn()
};

vi.mock('fs', () => mockFs);

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('ThemeService', () => {
  let ThemeServiceClass;
  let themeService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import service after mocks
    const module = await import('@/services/theme.service.js');
    ThemeServiceClass = module.default.constructor;
  });

  describe('constructor and loadThemes', () => {
    it('should load themes from file successfully', () => {
      const mockThemesData = {
        themes: [
          {
            id: 'test-theme',
            name: 'Test Theme',
            type: 'dark',
            colors: {
              primary: '#000000'
            }
          }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));

      themeService = new ThemeServiceClass();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(__dirname, '../data/themes.json'),
        'utf8'
      );
      expect(themeService.themes).toEqual(mockThemesData);
    });

    it('should handle error when loading themes file', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      themeService = new ThemeServiceClass();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(__dirname, '../data/themes.json'),
        'utf8'
      );
      expect(themeService.themes).toEqual({ themes: [] });
    });

    it('should handle invalid JSON in themes file', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');

      themeService = new ThemeServiceClass();

      expect(themeService.themes).toEqual({ themes: [] });
    });
  });

  describe('getAllThemes', () => {
    it('should return all themes', () => {
      const mockThemesData = {
        themes: [
          { id: 'theme1', name: 'Theme 1' },
          { id: 'theme2', name: 'Theme 2' }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();

      const result = themeService.getAllThemes();

      expect(result).toEqual({
        success: true,
        themes: mockThemesData.themes,
        count: 2
      });
    });

    it('should reload themes if not loaded yet', () => {
      const mockThemesData = {
        themes: [{ id: 'theme1', name: 'Theme 1' }]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();
      themeService.themes = null; // Simulate unloaded state

      const result = themeService.getAllThemes();

      expect(result).toEqual({
        success: true,
        themes: mockThemesData.themes,
        count: 1
      });
    });
  });

  describe('getThemeById', () => {
    it('should return a theme by ID', () => {
      const mockThemesData = {
        themes: [
          { id: 'theme1', name: 'Theme 1' },
          { id: 'theme2', name: 'Theme 2' }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();

      const result = themeService.getThemeById('theme1');

      expect(result).toEqual({
        success: true,
        theme: { id: 'theme1', name: 'Theme 1' }
      });
    });

    it('should return error when theme is not found', () => {
      const mockThemesData = {
        themes: [
          { id: 'theme1', name: 'Theme 1' }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();

      const result = themeService.getThemeById('nonexistent');

      expect(result).toEqual({
        success: false,
        error: "Theme with ID 'nonexistent' not found"
      });
    });

    it('should reload themes if not loaded yet', () => {
      const mockThemesData = {
        themes: [
          { id: 'theme1', name: 'Theme 1' }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();
      themeService.themes = null; // Simulate unloaded state

      const result = themeService.getThemeById('theme1');

      expect(result).toEqual({
        success: true,
        theme: { id: 'theme1', name: 'Theme 1' }
      });
    });
  });

  describe('getDefaultTheme', () => {
    it('should return the default theme when it exists', () => {
      const mockThemesData = {
        themes: [
          { id: 'vscode-dark', name: 'VS Code Dark' }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();

      const result = themeService.getDefaultTheme();

      expect(result).toEqual({
        success: true,
        theme: { id: 'vscode-dark', name: 'VS Code Dark' }
      });
    });

    it('should return fallback theme when default theme is not found', () => {
      const mockThemesData = {
        themes: [
          { id: 'other-theme', name: 'Other Theme' }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();

      const result = themeService.getDefaultTheme();

      expect(result.success).toBe(true);
      expect(result.theme.id).toBe('fallback');
      expect(result.theme.name).toBe('VS Code Dark');
    });
  });

  describe('validateTheme', () => {
    it('should validate a correct theme', () => {
      const theme = {
        id: 'test-theme',
        name: 'Test Theme',
        type: 'dark',
        colors: {
          primary: '#000000',
          secondary: '#111111',
          tertiary: '#222222',
          sidebar: '#333333',
          border: '#444444',
          textPrimary: '#555555',
          textSecondary: '#666666',
          textMuted: '#777777',
          accentBlue: '#888888',
          accentGreen: '#999999',
          accentRed: '#aaaaaa'
        }
      };

      themeService = new ThemeServiceClass();
      const result = themeService.validateTheme(theme);

      expect(result).toEqual({ valid: true });
    });

    it('should reject theme with missing required fields', () => {
      const theme = {
        name: 'Test Theme',
        type: 'dark',
        colors: {
          primary: '#000000'
        }
      };

      themeService = new ThemeServiceClass();
      const result = themeService.validateTheme(theme);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field: id');
    });

    it('should reject theme with missing required colors', () => {
      const theme = {
        id: 'test-theme',
        name: 'Test Theme',
        type: 'dark',
        colors: {
          primary: '#000000'
        }
      };

      themeService = new ThemeServiceClass();
      const result = themeService.validateTheme(theme);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required color: secondary');
    });

    it('should reject theme with invalid type', () => {
      const theme = {
        id: 'test-theme',
        name: 'Test Theme',
        type: 'invalid',
        colors: {
          primary: '#000000',
          secondary: '#111111',
          tertiary: '#222222',
          sidebar: '#333333',
          border: '#444444',
          textPrimary: '#555555',
          textSecondary: '#666666',
          textMuted: '#777777',
          accentBlue: '#888888',
          accentGreen: '#999999',
          accentRed: '#aaaaaa'
        }
      };

      themeService = new ThemeServiceClass();
      const result = themeService.validateTheme(theme);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Theme type must be either "light" or "dark"');
    });
  });

  describe('reloadThemes', () => {
    it('should reload themes from file', () => {
      const mockThemesData = {
        themes: [
          { id: 'theme1', name: 'Theme 1' }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();

      const result = themeService.reloadThemes();

      expect(result).toEqual({
        success: true,
        themes: mockThemesData.themes,
        count: 1
      });
    });
  });

  describe('getThemesByType', () => {
    it('should return themes filtered by type', () => {
      const mockThemesData = {
        themes: [
          { id: 'dark-theme', name: 'Dark Theme', type: 'dark' },
          { id: 'light-theme', name: 'Light Theme', type: 'light' },
          { id: 'another-dark-theme', name: 'Another Dark Theme', type: 'dark' }
        ]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));
      themeService = new ThemeServiceClass();

      const result = themeService.getThemesByType('dark');

      expect(result).toEqual({
        success: true,
        themes: [
          { id: 'dark-theme', name: 'Dark Theme', type: 'dark' },
          { id: 'another-dark-theme', name: 'Another Dark Theme', type: 'dark' }
        ],
        count: 2,
        type: 'dark'
      });
    });

    it('should handle getAllThemes failure', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File error');
      });
      themeService = new ThemeServiceClass();

      const result = themeService.getThemesByType('dark');

      expect(result).toEqual({
        success: true,
        themes: [],
        count: 0,
        type: 'dark'
      });
    });
  });
});