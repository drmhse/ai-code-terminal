const ThemeService = require('../services/theme.service');
const logger = require('../utils/logger');

class ThemeController {
  /**
   * Get all available themes
   */
  async getAllThemes(req, res) {
    try {
      const { type } = req.query;
      
      let result;
      if (type && ['light', 'dark'].includes(type)) {
        result = ThemeService.getThemesByType(type);
      } else {
        result = ThemeService.getAllThemes();
      }

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }

      // Set cache headers for themes (cache for 1 hour)
      res.set({
        'Cache-Control': 'public, max-age=3600',
        'ETag': `"themes-${result.count}-${Date.now().toString(36)}"`
      });

      res.json({
        success: true,
        themes: result.themes,
        count: result.count,
        ...(type && { type })
      });

    } catch (error) {
      logger.error('Failed to get themes:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching themes'
      });
    }
  }

  /**
   * Get a specific theme by ID
   */
  async getThemeById(req, res) {
    try {
      const { themeId } = req.params;
      
      if (!themeId) {
        return res.status(400).json({
          success: false,
          error: 'Theme ID is required'
        });
      }

      const result = ThemeService.getThemeById(themeId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=3600',
        'ETag': `"theme-${themeId}-${Date.now().toString(36)}"`
      });

      res.json({
        success: true,
        theme: result.theme
      });

    } catch (error) {
      logger.error('Failed to get theme by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching theme'
      });
    }
  }

  /**
   * Get the default theme
   */
  async getDefaultTheme(req, res) {
    try {
      const result = ThemeService.getDefaultTheme();

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }

      res.set({
        'Cache-Control': 'public, max-age=3600'
      });

      res.json({
        success: true,
        theme: result.theme
      });

    } catch (error) {
      logger.error('Failed to get default theme:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching default theme'
      });
    }
  }

  /**
   * Reload themes (development only)
   */
  async reloadThemes(req, res) {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: 'Theme reloading is not available in production'
        });
      }

      const result = ThemeService.reloadThemes();
      
      res.json({
        success: true,
        message: 'Themes reloaded successfully',
        themes: result.themes,
        count: result.count
      });

    } catch (error) {
      logger.error('Failed to reload themes:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while reloading themes'
      });
    }
  }
}

module.exports = new ThemeController();