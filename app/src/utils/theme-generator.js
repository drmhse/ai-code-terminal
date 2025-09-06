const fs = require('fs');
const path = require('path');

class ThemeGenerator {
  constructor() {
    this.palettesPath = path.join(__dirname, '../data/color-palettes.json');
    this.palettes = null;
    this.loadPalettes();
  }

  loadPalettes() {
    try {
      const palettesData = fs.readFileSync(this.palettesPath, 'utf8');
      this.palettes = JSON.parse(palettesData);
    } catch (error) {
      console.error('Failed to load color palettes:', error);
      this.palettes = { palettes: {} };
    }
  }

  /**
   * Generate a theme from a color palette
   * @param {string} paletteId - The ID of the palette to use
   * @param {Object} overrides - Optional overrides for specific colors
   * @returns {Object} Complete theme object
   */
  generateTheme(paletteId, overrides = {}) {
    const palette = this.palettes.palettes[paletteId];
    if (!palette) {
      throw new Error(`Palette ${paletteId} not found`);
    }

    const { base, accent } = palette;
    
    // Map semantic roles to theme structure
    const theme = {
      id: paletteId,
      name: palette.name,
      type: palette.type,
      description: `${palette.name} theme with cohesive color harmony`,
      colors: {
        // Background hierarchy - NO collision!
        bgPrimary: base.lightest,
        bgSecondary: base.lighter, 
        bgTertiary: base.light,
        bgSidebar: base.lighter,
        
        // Legacy background names for compatibility during transition
        primary: base.lightest,
        secondary: base.lighter, 
        tertiary: base.light,
        sidebar: base.lighter,
        
        // Text hierarchy  
        textPrimary: base.darkest,
        textSecondary: base.darker,
        textMuted: base.dark,
        
        // UI elements
        border: base.medium,
        
        // Semantic ACTION colors - distinct from background!
        actionPrimary: accent.primary,
        actionPrimaryHover: accent.primaryHover,
        actionSuccess: accent.success,
        actionSuccessHover: this.lighten(accent.success, 0.1),
        actionError: accent.error,
        actionErrorHover: this.lighten(accent.error, 0.1), 
        actionWarning: accent.warning,
        actionWarningHover: this.lighten(accent.warning, 0.1),
        actionInfo: accent.info,
        actionInfoHover: this.lighten(accent.info, 0.1),
        
        terminalBg: base.lightest
      },
      terminal: this.generateTerminalColors(base, accent, palette.type)
    };

    // For dark themes, invert the hierarchy
    if (palette.type === 'dark') {
      // Background colors
      theme.colors.bgPrimary = base.darkest;
      theme.colors.bgSecondary = base.darker;
      theme.colors.bgTertiary = base.dark; 
      theme.colors.bgSidebar = base.darker;
      
      // Legacy compatibility during transition
      theme.colors.primary = base.darkest;
      theme.colors.secondary = base.darker;
      theme.colors.tertiary = base.dark; 
      theme.colors.sidebar = base.darker;
      
      // Text colors (inverted)
      theme.colors.textPrimary = base.lightest;
      theme.colors.textSecondary = base.lighter;
      theme.colors.textMuted = base.light;
      theme.colors.terminalBg = base.darkest;
      
      // ACTION colors stay the same regardless of theme type!
      // These are semantic and shouldn't change based on light/dark
    }

    // Apply any overrides
    if (overrides.colors) {
      Object.assign(theme.colors, overrides.colors);
    }
    if (overrides.terminal) {
      Object.assign(theme.terminal, overrides.terminal);
    }

    return theme;
  }

  /**
   * Generate terminal colors from palette
   * @param {Object} base - Base color scale
   * @param {Object} accent - Accent colors
   * @param {string} themeType - 'light' or 'dark'
   * @returns {Object} Terminal color configuration
   */
  generateTerminalColors(base, accent, themeType) {
    // For light themes, use light terminal with dark text
    // For dark themes, use dark terminal with light text
    const isLight = themeType === 'light';
    
    return {
      background: isLight ? base.lightest : base.darkest,
      foreground: isLight ? base.darkest : base.lightest,
      cursor: accent.primary,
      selection: isLight ? base.lighter : base.dark,
      
      // ANSI colors - adjust black/white for light themes, keep others semantic
      ansiBlack: isLight ? base.darkest : base.darkest,
      ansiRed: accent.error,
      ansiGreen: accent.success,
      ansiYellow: accent.warning,
      ansiBlue: accent.primary,
      ansiMagenta: accent.info,
      ansiCyan: this.blend(accent.primary, accent.info, 0.5),
      ansiWhite: isLight ? base.light : base.lightest,
      
      // Bright variants
      ansiBrightBlack: isLight ? base.dark : base.medium,
      ansiBrightRed: this.lighten(accent.error, 0.1),
      ansiBrightGreen: this.lighten(accent.success, 0.1),
      ansiBrightYellow: this.lighten(accent.warning, 0.1),
      ansiBrightBlue: accent.primaryHover,
      ansiBrightMagenta: this.lighten(accent.info, 0.1),
      ansiBrightCyan: this.lighten(this.blend(accent.primary, accent.info, 0.5), 0.1),
      ansiBrightWhite: isLight ? base.lightest : '#ffffff'
    };
  }

  /**
   * Lighten a hex color by a percentage
   * @param {string} hex - Hex color code
   * @param {number} percent - Percentage to lighten (0-1)
   * @returns {string} Lightened hex color
   */
  lighten(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  /**
   * Blend two hex colors
   * @param {string} color1 - First hex color
   * @param {string} color2 - Second hex color  
   * @param {number} ratio - Blend ratio (0-1, 0 = color1, 1 = color2)
   * @returns {string} Blended hex color
   */
  blend(color1, color2, ratio) {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    
    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
    
    return '#' + r.toString(16).padStart(2, '0') + 
                 g.toString(16).padStart(2, '0') + 
                 b.toString(16).padStart(2, '0');
  }

  /**
   * Generate all themes from palettes
   * @returns {Array} Array of generated theme objects
   */
  generateAllThemes() {
    const themes = [];
    
    for (const [paletteId, palette] of Object.entries(this.palettes.palettes)) {
      try {
        const theme = this.generateTheme(paletteId);
        themes.push(theme);
      } catch (error) {
        console.error(`Failed to generate theme for ${paletteId}:`, error);
      }
    }
    
    return themes;
  }

  /**
   * Get available palette IDs
   * @returns {Array} Array of palette IDs
   */
  getAvailablePalettes() {
    return Object.keys(this.palettes.palettes);
  }
}

module.exports = new ThemeGenerator();