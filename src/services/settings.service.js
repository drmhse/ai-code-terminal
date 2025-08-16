const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const encryption = require('../utils/encryption');

class SettingsService {
  /**
   * Get or create the singleton settings record
   */
  async getSettings() {
    try {
      let settings = await prisma.settings.findUnique({
        where: { id: 'singleton' }
      });

      if (!settings) {
        // Create default settings
        settings = await prisma.settings.create({
          data: { id: 'singleton' }
        });
        logger.info('Created default settings');
      }

      return this._decryptTokens(settings);
    } catch (error) {
      logger.error('Failed to get settings:', error);
      throw new Error('Failed to get settings');
    }
  }

  /**
   * Update GitHub token (legacy method - kept for backward compatibility)
   */
  async updateGithubToken(githubToken) {
    try {
      const encryptedToken = githubToken ? encryption.encryptToken(githubToken) : null;
      
      const settings = await prisma.settings.upsert({
        where: { id: 'singleton' },
        create: { 
          id: 'singleton',
          githubToken: encryptedToken 
        },
        update: { 
          githubToken: encryptedToken 
        }
      });
      
      logger.info('GitHub token updated');
      return this._decryptTokens(settings);
    } catch (error) {
      logger.error('Failed to update GitHub token:', error);
      throw new Error('Failed to update GitHub token');
    }
  }

  /**
   * Update GitHub tokens (access token, refresh token, and expiration)
   */
  async updateGithubTokens(accessToken, refreshToken, expiresAt) {
    try {
      const encryptedAccessToken = accessToken ? encryption.encryptToken(accessToken) : null;
      const encryptedRefreshToken = refreshToken ? encryption.encryptToken(refreshToken) : null;

      const settings = await prisma.settings.upsert({
        where: { id: 'singleton' },
        create: { 
          id: 'singleton',
          githubToken: encryptedAccessToken,
          githubRefreshToken: encryptedRefreshToken,
          githubTokenExpiresAt: expiresAt,
        },
        update: { 
          githubToken: encryptedAccessToken,
          githubRefreshToken: encryptedRefreshToken,
          githubTokenExpiresAt: expiresAt,
        },
      });
      
      logger.info('GitHub tokens updated');
      return this._decryptTokens(settings);
    } catch (error) {
      logger.error('Failed to update GitHub tokens:', error);
      throw new Error('Failed to update GitHub tokens');
    }
  }

  /**
   * Get raw, encrypted settings (used for refresh token operations)
   */
  async getRawSettings() {
    try {
      return await prisma.settings.findUnique({
        where: { id: 'singleton' }
      });
    } catch (error) {
      logger.error('Failed to get raw settings:', error);
      throw new Error('Failed to get raw settings');
    }
  }

  /**
   * Clear all GitHub token information from the database
   */
  async clearGithubTokens() {
    try {
      await prisma.settings.upsert({
        where: { id: 'singleton' },
        create: { 
          id: 'singleton',
          githubToken: null,
          githubRefreshToken: null,
          githubTokenExpiresAt: null,
        },
        update: {
          githubToken: null,
          githubRefreshToken: null,
          githubTokenExpiresAt: null,
        },
      });
      logger.info('Cleared GitHub tokens from database');
    } catch (error) {
      logger.error('Failed to clear GitHub tokens from database:', error);
      throw new Error('Failed to clear GitHub tokens');
    }
  }

  /**
   * Get GitHub token
   */
  async getGithubToken() {
    try {
      const settings = await this.getSettings();
      return settings.githubToken;
    } catch (error) {
      logger.error('Failed to get GitHub token:', error);
      return null;
    }
  }

  /**
   * Update theme preferences
   */
  async updateTheme(themeData) {
    try {
      const themeJson = JSON.stringify(themeData);
      
      const settings = await prisma.settings.upsert({
        where: { id: 'singleton' },
        create: { 
          id: 'singleton',
          theme: themeJson 
        },
        update: { 
          theme: themeJson 
        }
      });
      
      logger.info('Theme preferences updated');
      return this._decryptTokens(settings);
    } catch (error) {
      logger.error('Failed to update theme:', error);
      throw new Error('Failed to update theme preferences');
    }
  }

  /**
   * Get theme preferences
   */
  async getTheme() {
    try {
      const settings = await this.getSettings();
      if (settings.theme) {
        return JSON.parse(settings.theme);
      }
      return this._getDefaultTheme();
    } catch (error) {
      logger.error('Failed to get theme preferences:', error);
      return this._getDefaultTheme();
    }
  }

  /**
   * Get default theme
   */
  _getDefaultTheme() {
    return {
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
  }

  /**
   * Private helper to decrypt tokens
   */
  _decryptTokens(settings) {
    if (!settings) return null;

    return {
      ...settings,
      githubToken: settings.githubToken ? encryption.decryptToken(settings.githubToken) : null,
      githubRefreshToken: settings.githubRefreshToken ? encryption.decryptToken(settings.githubRefreshToken) : null
    };
  }
}

module.exports = new SettingsService();