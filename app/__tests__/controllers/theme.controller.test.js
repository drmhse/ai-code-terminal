const ThemeController = require('../../src/controllers/theme.controller');

// Mock dependencies
jest.mock('../../src/services/theme.service');
jest.mock('../../src/utils/logger');

const ThemeService = require('../../src/services/theme.service');
const logger = require('../../src/utils/logger');

describe('ThemeController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn()
    };
    
    jest.clearAllMocks();
  });

  describe('getAllThemes', () => {
    const mockThemes = [
      { id: 'theme1', name: 'Theme 1', type: 'dark' },
      { id: 'theme2', name: 'Theme 2', type: 'light' }
    ];

    it('should return all themes when no type filter is provided', async () => {
      const mockResult = {
        success: true,
        themes: mockThemes,
        count: 2
      };
      ThemeService.getAllThemes.mockReturnValue(mockResult);

      await ThemeController.getAllThemes(req, res);

      expect(ThemeService.getAllThemes).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'Cache-Control': 'public, max-age=3600',
        'ETag': expect.stringMatching(/^"themes-2-[a-z0-9]+"$/)
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        themes: mockThemes,
        count: 2
      });
    });

    it('should return themes filtered by type', async () => {
      req.query.type = 'dark';
      const mockResult = {
        success: true,
        themes: [mockThemes[0]],
        count: 1
      };
      ThemeService.getThemesByType.mockReturnValue(mockResult);

      await ThemeController.getAllThemes(req, res);

      expect(ThemeService.getThemesByType).toHaveBeenCalledWith('dark');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        themes: [mockThemes[0]],
        count: 1,
        type: 'dark'
      });
    });

    it('should return themes filtered by light type', async () => {
      req.query.type = 'light';
      const mockResult = {
        success: true,
        themes: [mockThemes[1]],
        count: 1
      };
      ThemeService.getThemesByType.mockReturnValue(mockResult);

      await ThemeController.getAllThemes(req, res);

      expect(ThemeService.getThemesByType).toHaveBeenCalledWith('light');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        themes: [mockThemes[1]],
        count: 1,
        type: 'light'
      });
    });

    it('should ignore invalid type filters and return all themes', async () => {
      req.query.type = 'invalid';
      const mockResult = {
        success: true,
        themes: mockThemes,
        count: 2
      };
      ThemeService.getAllThemes.mockReturnValue(mockResult);

      await ThemeController.getAllThemes(req, res);

      expect(ThemeService.getAllThemes).toHaveBeenCalled();
      expect(ThemeService.getThemesByType).not.toHaveBeenCalled();
    });

    it('should return 404 when service returns error', async () => {
      const mockResult = {
        success: false,
        error: 'No themes found'
      };
      ThemeService.getAllThemes.mockReturnValue(mockResult);

      await ThemeController.getAllThemes(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No themes found'
      });
    });

    it('should handle service exceptions', async () => {
      const error = new Error('Service error');
      ThemeService.getAllThemes.mockImplementation(() => {
        throw error;
      });

      await ThemeController.getAllThemes(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get themes:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error while fetching themes'
      });
    });
  });

  describe('getThemeById', () => {
    const mockTheme = { id: 'theme1', name: 'Theme 1', type: 'dark' };

    it('should return theme by ID', async () => {
      req.params.themeId = 'theme1';
      const mockResult = {
        success: true,
        theme: mockTheme
      };
      ThemeService.getThemeById.mockReturnValue(mockResult);

      await ThemeController.getThemeById(req, res);

      expect(ThemeService.getThemeById).toHaveBeenCalledWith('theme1');
      expect(res.set).toHaveBeenCalledWith({
        'Cache-Control': 'public, max-age=3600',
        'ETag': expect.stringMatching(/^"theme-theme1-[a-z0-9]+"$/)
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        theme: mockTheme
      });
    });

    it('should return 400 when theme ID is missing', async () => {
      req.params = {};

      await ThemeController.getThemeById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Theme ID is required'
      });
    });

    it('should return 404 when theme is not found', async () => {
      req.params.themeId = 'nonexistent';
      const mockResult = {
        success: false,
        error: 'Theme not found'
      };
      ThemeService.getThemeById.mockReturnValue(mockResult);

      await ThemeController.getThemeById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Theme not found'
      });
    });

    it('should handle service exceptions', async () => {
      req.params.themeId = 'theme1';
      const error = new Error('Service error');
      ThemeService.getThemeById.mockImplementation(() => {
        throw error;
      });

      await ThemeController.getThemeById(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get theme by ID:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error while fetching theme'
      });
    });
  });

  describe('getDefaultTheme', () => {
    const mockDefaultTheme = { id: 'default', name: 'Default Theme', type: 'dark' };

    it('should return default theme', async () => {
      const mockResult = {
        success: true,
        theme: mockDefaultTheme
      };
      ThemeService.getDefaultTheme.mockReturnValue(mockResult);

      await ThemeController.getDefaultTheme(req, res);

      expect(ThemeService.getDefaultTheme).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'Cache-Control': 'public, max-age=3600'
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        theme: mockDefaultTheme
      });
    });

    it('should return 404 when default theme is not found', async () => {
      const mockResult = {
        success: false,
        error: 'Default theme not found'
      };
      ThemeService.getDefaultTheme.mockReturnValue(mockResult);

      await ThemeController.getDefaultTheme(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Default theme not found'
      });
    });

    it('should handle service exceptions', async () => {
      const error = new Error('Service error');
      ThemeService.getDefaultTheme.mockImplementation(() => {
        throw error;
      });

      await ThemeController.getDefaultTheme(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to get default theme:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error while fetching default theme'
      });
    });
  });

  describe('reloadThemes', () => {
    const mockThemes = [
      { id: 'theme1', name: 'Theme 1' },
      { id: 'theme2', name: 'Theme 2' }
    ];

    it('should reload themes in development environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const mockResult = {
        success: true,
        themes: mockThemes,
        count: 2
      };
      ThemeService.reloadThemes.mockReturnValue(mockResult);

      await ThemeController.reloadThemes(req, res);

      expect(ThemeService.reloadThemes).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Themes reloaded successfully',
        themes: mockThemes,
        count: 2
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should return 403 in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Reset modules to reload the environment config with new values
      jest.resetModules();
      const ThemeControllerReloaded = require('../../src/controllers/theme.controller');

      await ThemeControllerReloaded.reloadThemes(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Theme reloading is not available in production'
      });
      expect(ThemeService.reloadThemes).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle service exceptions', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Service error');
      ThemeService.reloadThemes.mockImplementation(() => {
        throw error;
      });

      await ThemeController.reloadThemes(req, res);

      expect(logger.error).toHaveBeenCalledWith('Failed to reload themes:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error while reloading themes'
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});