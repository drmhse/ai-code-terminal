/**
 * Theme Compatibility Layer
 * Transforms current complex theme structure to match the original ../app system
 */

import type { Theme } from '@/types/theme'
import type { EditorThemeData } from '@/types/editor'

export interface LegacyTheme {
  id: string
  name: string
  type: 'light' | 'dark'
  description?: string
  colors: {
    // Background hierarchy (original names)
    primary: string
    secondary: string
    tertiary: string
    sidebar: string

    // New semantic names with fallbacks
    bgPrimary: string
    bgSecondary: string
    bgTertiary: string
    bgSidebar: string

    // Text hierarchy
    textPrimary: string
    textSecondary: string
    textMuted: string

    // Border & UI elements
    border: string

    // Semantic ACTION colors (not background colors!)
    actionPrimary: string
    actionPrimaryHover?: string
    actionSuccess: string
    actionSuccessHover?: string
    actionError: string
    actionErrorHover?: string
    actionWarning: string
    actionWarningHover?: string
    actionInfo: string
    actionInfoHover?: string

    // Component specific
    terminalBg: string

    // Sidebar specific
    sidebarItemHover: string
    sidebarItemHoverText: string
    sidebarItemActive: string
    sidebarItemActiveText: string
    sidebarItemActiveBorder: string
  }
  terminal: {
    background: string
    foreground: string
    cursor: string
    selection: string
    ansiBlack: string
    ansiRed: string
    ansiGreen: string
    ansiYellow: string
    ansiBlue: string
    ansiMagenta: string
    ansiCyan: string
    ansiWhite: string
    ansiBrightBlack: string
    ansiBrightRed: string
    ansiBrightGreen: string
    ansiBrightYellow: string
    ansiBrightBlue: string
    ansiBrightMagenta: string
    ansiBrightCyan: string
    ansiBrightWhite: string
  }
}

/**
 * Transform current theme to legacy format expected by original system
 */
export function transformToLegacyTheme(theme: Theme): LegacyTheme {
  const { colors, terminal } = theme

  return {
    id: theme.id,
    name: theme.name,
    type: theme.category === 'light' ? 'light' : 'dark',
    description: theme.description,
    colors: {
      // Background hierarchy - map complex structure to simple names
      primary: colors.background.primary,
      secondary: colors.background.secondary,
      tertiary: colors.background.tertiary,
      sidebar: colors.sidebar.background,

      // New semantic names (same values)
      bgPrimary: colors.background.primary,
      bgSecondary: colors.background.secondary,
      bgTertiary: colors.background.tertiary,
      bgSidebar: colors.sidebar.background,

      // Text hierarchy
      textPrimary: colors.text.primary,
      textSecondary: colors.text.secondary,
      textMuted: colors.text.tertiary,

      // Border & UI
      border: colors.border.primary,

      // Semantic ACTION colors (distinct from backgrounds!)
      actionPrimary: colors.interactive.primary,
      actionPrimaryHover: colors.interactive.primaryHover,
      actionSuccess: colors.semantic.success,
      actionSuccessHover: colors.semantic.success, // Use same color if no hover defined
      actionError: colors.semantic.error,
      actionErrorHover: colors.semantic.error,
      actionWarning: colors.semantic.warning,
      actionWarningHover: colors.semantic.warning,
      actionInfo: colors.semantic.info,
      actionInfoHover: colors.semantic.info,

      // Component specific
      terminalBg: terminal.background,

      // Sidebar specific
      sidebarItemHover: colors.sidebar.itemHover,
      sidebarItemHoverText: colors.sidebar.itemHoverText,
      sidebarItemActive: colors.sidebar.itemActive,
      sidebarItemActiveText: colors.sidebar.itemActiveText,
      sidebarItemActiveBorder: colors.sidebar.itemActiveBorder
    },
    terminal: {
      background: terminal.background,
      foreground: terminal.foreground,
      cursor: terminal.cursor,
      selection: terminal.selection,
      ansiBlack: terminal.black,
      ansiRed: terminal.red,
      ansiGreen: terminal.green,
      ansiYellow: terminal.yellow,
      ansiBlue: terminal.blue,
      ansiMagenta: terminal.magenta,
      ansiCyan: terminal.cyan,
      ansiWhite: terminal.white,
      ansiBrightBlack: terminal.brightBlack,
      ansiBrightRed: terminal.brightRed,
      ansiBrightGreen: terminal.brightGreen,
      ansiBrightYellow: terminal.brightYellow,
      ansiBrightBlue: terminal.brightBlue,
      ansiBrightMagenta: terminal.brightMagenta,
      ansiBrightCyan: terminal.brightCyan,
      ansiBrightWhite: terminal.brightWhite
    }
  }
}

/**
 * Apply theme using the original system's CSS variable mapping
 * This matches exactly what the ../app system expected
 */
export function applyLegacyTheme(theme: LegacyTheme): void {
  const root = document.documentElement
  const colors = theme.colors

  // Background Colors - Use new semantic names with fallbacks (exactly like original)
  root.style.setProperty('--bg-primary', colors.bgPrimary || colors.primary)
  root.style.setProperty('--bg-secondary', colors.bgSecondary || colors.secondary)
  root.style.setProperty('--bg-tertiary', colors.bgTertiary || colors.tertiary)
  root.style.setProperty('--bg-sidebar', colors.bgSidebar || colors.sidebar)

  // Text Colors
  root.style.setProperty('--text-primary', colors.textPrimary)
  root.style.setProperty('--text-secondary', colors.textSecondary)
  root.style.setProperty('--text-muted', colors.textMuted)

  // Border & Divider Colors
  root.style.setProperty('--border-color', colors.border || colors.textMuted)

  // Semantic Action Colors - Use distinct action colors! (exactly like original)
  root.style.setProperty('--primary', colors.actionPrimary || colors.primary)
  root.style.setProperty('--primary-hover', colors.actionPrimaryHover || colors.actionPrimary || colors.primary)
  root.style.setProperty('--success', colors.actionSuccess)
  root.style.setProperty('--success-hover', colors.actionSuccessHover || colors.actionSuccess)
  root.style.setProperty('--error', colors.actionError)
  root.style.setProperty('--error-hover', colors.actionErrorHover || colors.actionError)
  root.style.setProperty('--warning', colors.actionWarning || colors.actionPrimary || colors.primary)
  root.style.setProperty('--info', colors.actionInfo || colors.actionPrimary || colors.primary)

  // Component-specific Variables (exactly like original)
  root.style.setProperty('--button-bg', colors.actionPrimary || colors.primary)
  root.style.setProperty('--button-hover', colors.actionPrimaryHover || colors.actionPrimary || colors.primary)
  root.style.setProperty('--button-secondary-bg', colors.tertiary)
  root.style.setProperty('--button-secondary-hover', colors.secondary)
  root.style.setProperty('--input-bg', colors.tertiary)
  root.style.setProperty('--terminal-bg', colors.terminalBg || colors.primary)

  // Interactive States (exactly like original)
  root.style.setProperty('--sidebar-item-hover-bg', colors.sidebarItemHover || colors.bgSecondary || colors.secondary)
  root.style.setProperty('--sidebar-item-selected-bg', colors.sidebarItemActive || colors.actionPrimary || colors.primary)
  root.style.setProperty('--sidebar-item-bg', colors.bgSecondary || colors.secondary)

  // Sidebar specific states using theme-defined colors
  root.style.setProperty('--sidebar-item-hover', colors.sidebarItemHover || colors.bgSecondary || colors.secondary)
  root.style.setProperty('--sidebar-item-hover-text', colors.sidebarItemHoverText || colors.textPrimary)
  root.style.setProperty('--sidebar-item-active', colors.sidebarItemActive || colors.actionPrimary || colors.primary)
  root.style.setProperty('--sidebar-item-active-text', colors.sidebarItemActiveText || colors.textPrimary)
  root.style.setProperty('--sidebar-item-active-border', colors.sidebarItemActiveBorder || colors.sidebarItemActive || colors.actionPrimary || colors.primary)

  // Focus and interactive states
  root.style.setProperty('--border-focus', colors.actionPrimary || colors.primary)
  root.style.setProperty('--button-hover', colors.actionPrimaryHover || colors.actionPrimary || colors.primary)

  // Enhanced Variables for Comprehensive Theming (exactly like original)
  root.style.setProperty('--scrollbar-slider', colors.textMuted + '66')
  root.style.setProperty('--scrollbar-slider-hover', colors.textSecondary + 'b3')
  root.style.setProperty('--modal-backdrop', 'rgba(0, 0, 0, 0.6)')

  // Additional sidebar theming variables
  root.style.setProperty('--sidebar-background', colors.bgSidebar || colors.sidebar)
  root.style.setProperty('--sidebar-text', colors.textPrimary)
  root.style.setProperty('--sidebar-text-secondary', colors.textSecondary)
  root.style.setProperty('--sidebar-border', colors.border || colors.textMuted)
}

/**
 * Get default theme in legacy format (matches original getDefaultTheme)
 */
export function getDefaultLegacyTheme(): LegacyTheme {
  return {
    id: 'vscode-dark',
    name: 'VS Code Dark',
    type: 'dark',
    description: 'The classic VS Code dark theme with native styling',
    colors: {
      // Background colors
      bgPrimary: '#1e1e1e',
      bgSecondary: '#252526',
      bgTertiary: '#2d2d30',
      bgSidebar: '#181818',

      // Legacy compatibility
      primary: '#1e1e1e',
      secondary: '#252526',
      tertiary: '#2d2d30',
      sidebar: '#181818',

      // Text colors
      border: '#3c3c3c',
      textPrimary: '#cccccc',
      textSecondary: '#969696',
      textMuted: '#6a6a6a',

      // Action colors (semantic)
      actionPrimary: '#007acc',
      actionPrimaryHover: '#1177bb',
      actionSuccess: '#16825d',
      actionError: '#f14c4c',
      actionWarning: '#ff8c00',
      actionInfo: '#c678dd',

      terminalBg: '#1e1e1e',

      // Sidebar specific
      sidebarItemHover: '#2d2d30',
      sidebarItemHoverText: '#cccccc',
      sidebarItemActive: '#007acc',
      sidebarItemActiveText: '#ffffff',
      sidebarItemActiveBorder: '#007acc'
    },
    terminal: {
      background: '#1e1e1e',
      foreground: '#cccccc',
      cursor: '#cccccc',
      selection: '#264f78',
      ansiBlack: '#000000',
      ansiRed: '#f14c4c',
      ansiGreen: '#16825d',
      ansiYellow: '#ff8c00',
      ansiBlue: '#007acc',
      ansiMagenta: '#c678dd',
      ansiCyan: '#56b6c2',
      ansiWhite: '#cccccc',
      ansiBrightBlack: '#666666',
      ansiBrightRed: '#f14c4c',
      ansiBrightGreen: '#16825d',
      ansiBrightYellow: '#ff8c00',
      ansiBrightBlue: '#007acc',
      ansiBrightMagenta: '#c678dd',
      ansiBrightCyan: '#56b6c2',
      ansiBrightWhite: '#ffffff'
    }
  }
}

/**
 * Convert LegacyTheme to EditorThemeData for CodeMirror integration
 */
export function legacyToEditorTheme(legacyTheme: LegacyTheme): EditorThemeData {
  const colors = legacyTheme.colors

  return {
    type: legacyTheme.type,
    colors: {
      primary: colors.primary,
      secondary: colors.secondary,
      tertiary: colors.tertiary,
      sidebar: colors.sidebar,
      border: colors.border,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      accentBlue: colors.actionPrimary,
      accentBlueHover: colors.actionPrimaryHover,
      accentGreen: colors.actionSuccess,
      accentGreenHover: colors.actionSuccess,
      accentRed: colors.actionError,
      accentRedHover: colors.actionError,
      accentOrange: colors.actionWarning,
      accentPurple: colors.actionInfo,
      terminalBg: colors.terminalBg
    }
  }
}