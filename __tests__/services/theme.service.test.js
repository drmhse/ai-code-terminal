const fs = require('fs');
const path = require('path');

// Mock dependencies before requiring the service
jest.mock('fs');
jest.mock('../../src/utils/logger');

const logger = require('../../src/utils/logger');

// Set up initial file mock before requiring the service
const mockThemesData = {
  themes: [
    {
      id: 'vscode-dark',
      name: 'VS Code Dark',
      type: 'dark',
      description: 'Official VS Code dark theme',
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
        accentRed: '#f14c4c'
      }
    },
    {
      id: 'github-light',
      name: 'GitHub Light',
      type: 'light',
      description: 'GitHub inspired light theme',
      colors: {
        primary: '#ffffff',
        secondary: '#f6f8fa',
        tertiary: '#f1f3f4',
        sidebar: '#ffffff',
        border: '#d0d7de',
        textPrimary: '#24292f',
        textSecondary: '#656d76',
        textMuted: '#8c959f',
        accentBlue: '#0969da',
        accentGreen: '#1a7f37',
        accentRed: '#cf222e'
      }
    }
  ]
};

// Mock the file read to return our test data
fs.readFileSync.mockReturnValue(JSON.stringify(mockThemesData));

// Now require the service after mocks are set up
const ThemeService = require('../../src/services/theme.service');

describe('ThemeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Manually set test data for the already-loaded service
    ThemeService.themes = mockThemesData;
  });

  describe('getAllThemes', () => {
    it('should return all themes successfully', () => {
      const result = ThemeService.getAllThemes();

      expect(result).toEqual({
        success: true,
        themes: mockThemesData.themes,
        count: 2
      });
    });

    it('should handle empty themes array', () => {
      ThemeService.themes = { themes: [] };

      const result = ThemeService.getAllThemes();

      expect(result).toEqual({
        success: true,
        themes: [],
        count: 0
      });
    });
  });

  describe('getThemeById', () => {
    it('should return theme by ID when found', () => {
      const result = ThemeService.getThemeById('vscode-dark');

      expect(result).toEqual({
        success: true,
        theme: mockThemesData.themes[0]
      });
    });

    it('should return error when theme not found', () => {
      const result = ThemeService.getThemeById('nonexistent');

      expect(result).toEqual({
        success: false,
        error: "Theme with ID 'nonexistent' not found"
      });
    });

    it('should handle missing themes gracefully', () => {
      ThemeService.themes = { themes: [] };

      const result = ThemeService.getThemeById('vscode-dark');

      expect(result).toEqual({
        success: false,
        error: "Theme with ID 'vscode-dark' not found"
      });
    });
  });

  describe('getDefaultTheme', () => {
    it('should return vscode-dark theme as default', () => {
      const result = ThemeService.getDefaultTheme();

      expect(result).toEqual({
        success: true,
        theme: mockThemesData.themes[0]
      });
    });

    it('should return fallback theme when vscode-dark is not found', () => {
      // Mock themes without vscode-dark
      const themesWithoutDefault = {
        themes: [mockThemesData.themes[1]] // Only github-light
      };
      ThemeService.themes = themesWithoutDefault;

      const result = ThemeService.getDefaultTheme();

      expect(result.success).toBe(true);
      expect(result.theme.id).toBe('fallback');
      expect(result.theme.name).toBe('VS Code Dark');
      expect(result.theme.type).toBe('dark');
    });
  });

  describe('validateTheme', () => {
    const validTheme = {
      id: 'test-theme',
      name: 'Test Theme',
      type: 'dark',
      colors: {
        primary: '#000000',
        secondary: '#111111',
        tertiary: '#222222',
        sidebar: '#333333',
        border: '#444444',
        textPrimary: '#ffffff',
        textSecondary: '#cccccc',
        textMuted: '#999999',
        accentBlue: '#007acc',
        accentGreen: '#16825d',
        accentRed: '#f14c4c'
      }
    };

    it('should validate a complete theme successfully', () => {
      const result = ThemeService.validateTheme(validTheme);

      expect(result).toEqual({ valid: true });
    });

    it('should fail validation when missing required field', () => {
      const invalidTheme = { ...validTheme };
      delete invalidTheme.id;

      const result = ThemeService.validateTheme(invalidTheme);

      expect(result).toEqual({
        valid: false,
        error: 'Missing required field: id'
      });
    });

    it('should fail validation when missing required color', () => {
      const invalidTheme = { ...validTheme };
      delete invalidTheme.colors.primary;

      const result = ThemeService.validateTheme(invalidTheme);

      expect(result).toEqual({
        valid: false,
        error: 'Missing required color: primary'
      });
    });

  });

  describe('reloadThemes', () => {
    it('should return current themes', () => {
      const result = ThemeService.reloadThemes();

      expect(result).toEqual({
        success: true,
        themes: mockThemesData.themes,
        count: 2
      });
    });
  });

  describe('getThemesByType', () => {
    it('should return only dark themes', () => {
      const result = ThemeService.getThemesByType('dark');

      expect(result).toEqual({
        success: true,
        themes: [mockThemesData.themes[0]],
        count: 1,
        type: 'dark'
      });
    });

    it('should return only light themes', () => {
      const result = ThemeService.getThemesByType('light');

      expect(result).toEqual({
        success: true,
        themes: [mockThemesData.themes[1]],
        count: 1,
        type: 'light'
      });
    });

    it('should return empty array for non-existent type', () => {
      const result = ThemeService.getThemesByType('nonexistent');

      expect(result).toEqual({
        success: true,
        themes: [],
        count: 0,
        type: 'nonexistent'
      });
    });

    it('should handle empty themes array', () => {
      ThemeService.themes = { themes: [] };

      const result = ThemeService.getThemesByType('dark');

      expect(result).toEqual({
        success: true,
        themes: [],
        count: 0,
        type: 'dark'
      });
    });
  });
});