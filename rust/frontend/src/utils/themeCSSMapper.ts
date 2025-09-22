/**
 * Modern Theme CSS Mapper
 * Maps comprehensive theme objects to CSS custom properties
 * Replaces legacy theme compatibility approach with full design token system
 */

import type { Theme } from '@/types/theme'

/**
 * Applies a theme to CSS custom properties using the comprehensive design token system
 * @param theme The theme object to apply
 * @param root The root element (defaults to document.documentElement)
 */
export function applyThemeToCSS(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (!theme || !root) {
    console.error('Invalid theme or root element provided to applyThemeToCSS')
    return
  }

  const style = root.style

  // ===== BACKGROUND COLORS =====
  style.setProperty('--color-bg-primary', theme.colors.background.primary)
  style.setProperty('--color-bg-secondary', theme.colors.background.secondary)
  style.setProperty('--color-bg-tertiary', theme.colors.background.tertiary)
  style.setProperty('--color-bg-quaternary', theme.colors.background.quaternary)
  style.setProperty('--color-bg-overlay', theme.colors.background.overlay)

  // ===== TEXT COLORS =====
  style.setProperty('--color-text-primary', theme.colors.text.primary)
  style.setProperty('--color-text-secondary', theme.colors.text.secondary)
  style.setProperty('--color-text-tertiary', theme.colors.text.tertiary)
  style.setProperty('--color-text-disabled', theme.colors.text.disabled)
  style.setProperty('--color-text-inverse', theme.colors.text.inverse)

  // ===== BORDER COLORS =====
  style.setProperty('--color-border-primary', theme.colors.border.primary)
  style.setProperty('--color-border-secondary', theme.colors.border.secondary)
  style.setProperty('--color-border-focus', theme.colors.border.focus)
  style.setProperty('--color-border-hover', theme.colors.border.hover)

  // ===== INTERACTIVE COLORS =====
  style.setProperty('--color-interactive-primary', theme.colors.interactive.primary)
  style.setProperty('--color-interactive-primary-hover', theme.colors.interactive.primaryHover)
  style.setProperty('--color-interactive-primary-active', theme.colors.interactive.primaryActive)
  style.setProperty('--color-interactive-primary-disabled', theme.colors.interactive.primaryDisabled)
  style.setProperty('--color-interactive-secondary', theme.colors.interactive.secondary)
  style.setProperty('--color-interactive-secondary-hover', theme.colors.interactive.secondaryHover)
  style.setProperty('--color-interactive-tertiary', theme.colors.interactive.tertiary)
  style.setProperty('--color-interactive-tertiary-hover', theme.colors.interactive.tertiaryHover)
  style.setProperty('--color-interactive-link', theme.colors.interactive.link)
  style.setProperty('--color-interactive-link-hover', theme.colors.interactive.linkHover)
  style.setProperty('--color-interactive-link-visited', theme.colors.interactive.linkVisited)

  // ===== SEMANTIC COLORS =====
  style.setProperty('--color-semantic-success', theme.colors.semantic.success)
  style.setProperty('--color-semantic-success-bg', theme.colors.semantic.successBg)
  style.setProperty('--color-semantic-success-border', theme.colors.semantic.successBorder)
  style.setProperty('--color-semantic-warning', theme.colors.semantic.warning)
  style.setProperty('--color-semantic-warning-bg', theme.colors.semantic.warningBg)
  style.setProperty('--color-semantic-warning-border', theme.colors.semantic.warningBorder)
  style.setProperty('--color-semantic-error', theme.colors.semantic.error)
  style.setProperty('--color-semantic-error-bg', theme.colors.semantic.errorBg)
  style.setProperty('--color-semantic-error-border', theme.colors.semantic.errorBorder)
  style.setProperty('--color-semantic-info', theme.colors.semantic.info)
  style.setProperty('--color-semantic-info-bg', theme.colors.semantic.infoBg)
  style.setProperty('--color-semantic-info-border', theme.colors.semantic.infoBorder)

  // ===== SIDEBAR COLORS =====
  style.setProperty('--color-sidebar-background', theme.colors.sidebar.background)
  style.setProperty('--color-sidebar-text', theme.colors.sidebar.text)
  style.setProperty('--color-sidebar-text-secondary', theme.colors.sidebar.textSecondary)
  style.setProperty('--color-sidebar-border', theme.colors.sidebar.border)
  style.setProperty('--color-sidebar-item-hover', theme.colors.sidebar.itemHover)
  style.setProperty('--color-sidebar-item-hover-text', theme.colors.sidebar.itemHoverText)
  style.setProperty('--color-sidebar-item-active', theme.colors.sidebar.itemActive)
  style.setProperty('--color-sidebar-item-active-text', theme.colors.sidebar.itemActiveText)
  style.setProperty('--color-sidebar-item-active-border', theme.colors.sidebar.itemActiveBorder)

  // ===== EDITOR COLORS =====
  style.setProperty('--color-editor-background', theme.colors.editor.background)
  style.setProperty('--color-editor-gutter', theme.colors.editor.gutter)
  style.setProperty('--color-editor-gutter-text', theme.colors.editor.gutterText)
  style.setProperty('--color-editor-selection', theme.colors.editor.selection)
  style.setProperty('--color-editor-selection-inactive', theme.colors.editor.selectionInactive)
  style.setProperty('--color-editor-cursor', theme.colors.editor.cursor)
  style.setProperty('--color-editor-current-line', theme.colors.editor.currentLine)
  style.setProperty('--color-editor-matching-bracket', theme.colors.editor.matchingBracket)
  style.setProperty('--color-editor-find-match', theme.colors.editor.findMatch)
  style.setProperty('--color-editor-find-match-active', theme.colors.editor.findMatchActive)

  // ===== INPUT COLORS =====
  style.setProperty('--color-input-background', theme.colors.input.background)
  style.setProperty('--color-input-background-focus', theme.colors.input.backgroundFocus)
  style.setProperty('--color-input-text', theme.colors.input.text)
  style.setProperty('--color-input-placeholder', theme.colors.input.placeholder)
  style.setProperty('--color-input-border', theme.colors.input.border)
  style.setProperty('--color-input-border-focus', theme.colors.input.borderFocus)
  style.setProperty('--color-input-border-error', theme.colors.input.borderError)

  // ===== SCROLLBAR COLORS =====
  style.setProperty('--color-scrollbar-track', theme.colors.scrollbar.track)
  style.setProperty('--color-scrollbar-thumb', theme.colors.scrollbar.thumb)
  style.setProperty('--color-scrollbar-thumb-hover', theme.colors.scrollbar.thumbHover)

  // ===== TOOLTIP COLORS =====
  style.setProperty('--color-tooltip-background', theme.colors.tooltip.background)
  style.setProperty('--color-tooltip-text', theme.colors.tooltip.text)
  style.setProperty('--color-tooltip-border', theme.colors.tooltip.border)

  // ===== TERMINAL COLORS =====
  style.setProperty('--color-terminal-background', theme.terminal.background)
  style.setProperty('--color-terminal-foreground', theme.terminal.foreground)
  style.setProperty('--color-terminal-cursor', theme.terminal.cursor)
  style.setProperty('--color-terminal-selection', theme.terminal.selection)

  // ===== THEME CATEGORY DATA ATTRIBUTE =====
  // Set data attribute for theme category-specific CSS overrides
  root.setAttribute('data-theme-category', theme.category)
  root.setAttribute('data-theme-id', theme.id)

  // ===== LEGACY COMPATIBILITY =====
  // Keep some legacy variables for backwards compatibility during transition
  style.setProperty('--bg-primary', theme.colors.background.primary)
  style.setProperty('--bg-secondary', theme.colors.background.secondary)
  style.setProperty('--bg-tertiary', theme.colors.background.tertiary)
  style.setProperty('--text-primary', theme.colors.text.primary)
  style.setProperty('--text-secondary', theme.colors.text.secondary)
  style.setProperty('--text-muted', theme.colors.text.tertiary)
  style.setProperty('--primary', theme.colors.interactive.primary)
  style.setProperty('--primary-hover', theme.colors.interactive.primaryHover)
  style.setProperty('--success', theme.colors.semantic.success)
  style.setProperty('--warning', theme.colors.semantic.warning)
  style.setProperty('--error', theme.colors.semantic.error)
  style.setProperty('--info', theme.colors.semantic.info)
  style.setProperty('--border-color', theme.colors.border.primary)
  style.setProperty('--border-focus', theme.colors.border.focus)
  style.setProperty('--terminal-bg', theme.terminal.background)
  style.setProperty('--terminal-text', theme.terminal.foreground)

  console.log(`✅ Applied theme CSS variables: ${theme.name} (${theme.id})`)
}

/**
 * Remove theme-specific CSS custom properties
 * Used when cleaning up or resetting themes
 */
export function removeThemeCSS(root: HTMLElement = document.documentElement): void {
  const style = root.style

  // List of all theme-related CSS custom properties
  const themeProperties = [
    // Background colors
    '--color-bg-primary', '--color-bg-secondary', '--color-bg-tertiary', '--color-bg-quaternary', '--color-bg-overlay',

    // Text colors
    '--color-text-primary', '--color-text-secondary', '--color-text-tertiary', '--color-text-disabled', '--color-text-inverse',

    // Border colors
    '--color-border-primary', '--color-border-secondary', '--color-border-focus', '--color-border-hover',

    // Interactive colors
    '--color-interactive-primary', '--color-interactive-primary-hover', '--color-interactive-primary-active',
    '--color-interactive-primary-disabled', '--color-interactive-secondary', '--color-interactive-secondary-hover',
    '--color-interactive-tertiary', '--color-interactive-tertiary-hover', '--color-interactive-link',
    '--color-interactive-link-hover', '--color-interactive-link-visited',

    // Semantic colors
    '--color-semantic-success', '--color-semantic-success-bg', '--color-semantic-success-border',
    '--color-semantic-warning', '--color-semantic-warning-bg', '--color-semantic-warning-border',
    '--color-semantic-error', '--color-semantic-error-bg', '--color-semantic-error-border',
    '--color-semantic-info', '--color-semantic-info-bg', '--color-semantic-info-border',

    // Sidebar colors
    '--color-sidebar-background', '--color-sidebar-text', '--color-sidebar-text-secondary',
    '--color-sidebar-border', '--color-sidebar-item-hover', '--color-sidebar-item-hover-text',
    '--color-sidebar-item-active', '--color-sidebar-item-active-text', '--color-sidebar-item-active-border',

    // Editor colors
    '--color-editor-background', '--color-editor-gutter', '--color-editor-gutter-text',
    '--color-editor-selection', '--color-editor-selection-inactive', '--color-editor-cursor',
    '--color-editor-current-line', '--color-editor-matching-bracket', '--color-editor-find-match',
    '--color-editor-find-match-active',

    // Input colors
    '--color-input-background', '--color-input-background-focus', '--color-input-text',
    '--color-input-placeholder', '--color-input-border', '--color-input-border-focus', '--color-input-border-error',

    // Scrollbar colors
    '--color-scrollbar-track', '--color-scrollbar-thumb', '--color-scrollbar-thumb-hover',

    // Tooltip colors
    '--color-tooltip-background', '--color-tooltip-text', '--color-tooltip-border',

    // Terminal colors
    '--color-terminal-background', '--color-terminal-foreground', '--color-terminal-cursor', '--color-terminal-selection',

    // Legacy compatibility variables
    '--bg-primary', '--bg-secondary', '--bg-tertiary', '--text-primary', '--text-secondary', '--text-muted',
    '--primary', '--primary-hover', '--success', '--warning', '--error', '--info', '--border-color',
    '--border-focus', '--terminal-bg', '--terminal-text'
  ]

  // Remove all theme properties
  themeProperties.forEach(property => {
    style.removeProperty(property)
  })

  // Remove theme data attributes
  root.removeAttribute('data-theme-category')
  root.removeAttribute('data-theme-id')
}

/**
 * Get primary color RGB values for alpha blending
 * Useful for creating semi-transparent versions of the primary color
 */
export function getPrimaryColorRGB(theme: Theme): string {
  const primary = theme.colors.interactive.primary

  // Simple hex to RGB conversion (supports 3 and 6 digit hex)
  const hex = primary.replace('#', '')

  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return `${r}, ${g}, ${b}`
  } else if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `${r}, ${g}, ${b}`
  }

  // Fallback to Atlassian blue
  return '56, 139, 255'
}

/**
 * Apply theme-specific component styles
 * For advanced theme customizations beyond color tokens
 */
export function applyThemeComponentStyles(theme: Theme, root: HTMLElement = document.documentElement): void {
  const style = root.style

  // Apply theme-specific settings if available
  if (theme.settings) {
    if (theme.settings.fontFamily) {
      style.setProperty('--font-family-theme', theme.settings.fontFamily)
    }

    if (theme.settings.fontSize) {
      style.setProperty('--font-size-theme', `${theme.settings.fontSize}px`)
    }

    if (theme.settings.lineHeight) {
      style.setProperty('--line-height-theme', theme.settings.lineHeight.toString())
    }

    if (theme.settings.borderRadius) {
      style.setProperty('--radius-theme', `${theme.settings.borderRadius}px`)
    }
  }

  // Set primary color RGB for alpha blending
  const primaryRGB = getPrimaryColorRGB(theme)
  style.setProperty('--primary-rgb', primaryRGB)
}