const fs = require('fs');
const path = require('path');

// Mock dependencies before requiring the service
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    log: jest.fn(),
    filename: 'test.log',
    level: 'info',
    format: null
  }));
});
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
        primary: '#007acc',
        success: '#16825d',
        error: '#f14c4c'
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
        primary: '#0969da',
        success: '#1a7f37',
        error: '#cf222e'
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

    it('should reload themes when themes is null', () => {
      ThemeService.themes = null;
      jest.spyOn(ThemeService, 'loadThemes');

      const result = ThemeService.getAllThemes();

      expect(ThemeService.loadThemes).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should reload themes when themes.themes is null', () => {
      ThemeService.themes = { themes: null };
      jest.spyOn(ThemeService, 'loadThemes');

      const result = ThemeService.getAllThemes();

      expect(ThemeService.loadThemes).toHaveBeenCalled();
      expect(result.success).toBe(true);
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

    it('should validate theme ID input', () => {
      expect(ThemeService.getThemeById('')).toEqual({
        success: false,
        error: 'Theme ID must be a non-empty string'
      });
      
      expect(ThemeService.getThemeById(null)).toEqual({
        success: false,
        error: 'Theme ID must be a non-empty string'
      });
      
      expect(ThemeService.getThemeById(123)).toEqual({
        success: false,
        error: 'Theme ID must be a non-empty string'
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

    it('should reload themes when themes is null in getThemeById', () => {
      ThemeService.themes = null;
      jest.spyOn(ThemeService, 'loadThemes');

      const result = ThemeService.getThemeById('vscode-dark');

      expect(ThemeService.loadThemes).toHaveBeenCalled();
      expect(result.success).toBe(true);
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

    it('should fail validation for invalid theme type', () => {
      const invalidTheme = {
        id: 'test-theme',
        name: 'Test Theme',
        type: 'invalid-type', // Invalid type
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

      const result = ThemeService.validateTheme(invalidTheme);

      expect(result).toEqual({
        valid: false,
        error: 'Theme type must be either "light" or "dark"'
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

    it('should validate theme type input', () => {
      expect(ThemeService.getThemesByType('')).toEqual({
        success: false,
        error: 'Theme type must be a non-empty string'
      });
      
      expect(ThemeService.getThemesByType(null)).toEqual({
        success: false,
        error: 'Theme type must be a non-empty string'
      });
      
      expect(ThemeService.getThemesByType(123)).toEqual({
        success: false,
        error: 'Theme type must be a non-empty string'
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

  describe('Error Handling', () => {
    it('should handle file read errors in loadThemes', () => {
      // Mock fs.readFileSync to throw an error
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      // Create a new instance to trigger loadThemes
      const testService = new (require('../../src/services/theme.service').constructor)();

      expect(testService.themes).toEqual({ themes: [] });
      expect(logger.error).toHaveBeenCalledWith('Failed to load themes:', expect.any(Error));
    });

    it('should handle getAllThemes failure in getThemesByType', () => {
      // Mock getAllThemes to return failure
      jest.spyOn(ThemeService, 'getAllThemes').mockReturnValue({
        success: false,
        error: 'Failed to load themes'
      });

      const result = ThemeService.getThemesByType('dark');

      expect(result).toEqual({
        success: false,
        error: 'Failed to load themes'
      });
    });
  });
});