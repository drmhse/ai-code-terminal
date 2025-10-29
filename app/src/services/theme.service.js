const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const ThemeGenerator = require('../utils/theme-generator');

class ThemeService {
  constructor() {
    this.themes = null;
    this.loadThemes();
  }

  /**
   * Load themes from palette system only
   */
  loadThemes() {
    try {
      // Generate all themes from palettes - no legacy support
      this.themes = { themes: ThemeGenerator.generateAllThemes() };
      
      logger.info(`Generated ${this.themes.themes.length} themes from semantic palettes`);
      
    } catch (error) {
      logger.error('Failed to generate themes from palettes:', error);
      this.themes = { themes: [] };
    }
  }

  /**
   * Get all available themes
   */
  getAllThemes() {
    if (!this.themes || !this.themes.themes) {
      this.loadThemes();
    }
    
    return {
      success: true,
      themes: this.themes.themes,
      count: this.themes.themes.length
    };
  }

  /**
   * Get a specific theme by ID
   */
  getThemeById(themeId) {
    if (!themeId || typeof themeId !== 'string') {
      return {
        success: false,
        error: 'Theme ID must be a non-empty string'
      };
    }

    if (!this.themes || !this.themes.themes) {
      this.loadThemes();
    }

    const theme = this.themes.themes.find(t => t.id === themeId);
    
    if (!theme) {
      return {
        success: false,
        error: `Theme with ID '${themeId}' not found`
      };
    }

    return {
      success: true,
      theme
    };
  }

  /**
   * Get default theme (VS Code Dark)
   */
  getDefaultTheme() {
    const result = this.getThemeById('vscode-dark');
    
    if (!result.success) {
      // Fallback if default theme is missing
      return {
        success: true,
        theme: {
          id: 'fallback',
          name: 'VS Code Dark',
          type: 'dark',
          description: 'Fallback theme',
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
            accentBlueHover: '#1177bb',
            accentGreen: '#16825d',
            accentGreenHover: '#1a9854',
            accentRed: '#f14c4c',
            accentRedHover: '#e03e3e',
            accentOrange: '#ff8c00',
            accentPurple: '#c678dd',
            terminalBg: '#1e1e1e'
          }
        }
      };
    }

    return result;
  }

  /**
   * Validate theme structure
   */
  validateTheme(theme) {
    const requiredFields = [
      'id', 'name', 'type', 'colors'
    ];

    const requiredColors = [
      'primary', 'secondary', 'tertiary', 'sidebar', 'border',
      'textPrimary', 'textSecondary', 'textMuted',
      'accentBlue', 'accentGreen', 'accentRed'
    ];

    // Check required top-level fields
    for (const field of requiredFields) {
      if (!theme[field]) {
        return {
          valid: false,
          error: `Missing required field: ${field}`
        };
      }
    }

    // Check required colors
    for (const color of requiredColors) {
      if (!theme.colors[color]) {
        return {
          valid: false,
          error: `Missing required color: ${color}`
        };
      }
    }

    // Validate theme type
    if (!['light', 'dark'].includes(theme.type)) {
      return {
        valid: false,
        error: 'Theme type must be either "light" or "dark"'
      };
    }

    return { valid: true };
  }

  /**
   * Generate a custom theme from a palette
   * @param {string} paletteId - ID of the palette to use
   * @param {Object} overrides - Optional color overrides
   * @returns {Object} Generated theme or error
   */
  generateThemeFromPalette(paletteId, overrides = {}) {
    try {
      const theme = ThemeGenerator.generateTheme(paletteId, overrides);
      const validation = this.validateTheme(theme);
      
      if (!validation.valid) {
        return {
          success: false,
          error: `Generated theme validation failed: ${validation.error}`
        };
      }
      
      return {
        success: true,
        theme
      };
    } catch (error) {
      logger.error('Failed to generate theme from palette:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available color palettes
   * @returns {Array} List of available palette IDs
   */
  getAvailablePalettes() {
    return ThemeGenerator.getAvailablePalettes();
  }

  /**
   * Reload themes from file (useful for development)
   */
  reloadThemes() {
    this.loadThemes();
    return this.getAllThemes();
  }

  /**
   * Get themes filtered by type
   */
  getThemesByType(type) {
    if (!type || typeof type !== 'string') {
      return {
        success: false,
        error: 'Theme type must be a non-empty string'
      };
    }

    const allThemes = this.getAllThemes();
    
    if (!allThemes.success) {
      return allThemes;
    }

    const filteredThemes = allThemes.themes.filter(theme => theme.type === type);
    
    return {
      success: true,
      themes: filteredThemes,
      count: filteredThemes.length,
      type
    };
  }
}

module.exports = new ThemeService();