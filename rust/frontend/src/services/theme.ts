import type { Theme, ThemePreference } from '@/types/theme'
import { themes, getThemeById, getSystemPreferredTheme, getDefaultTheme } from '@/data/themes'
import { apiService } from './api'

/**
 * Comprehensive theme service for AI Code Terminal
 * Handles theme application, persistence, and system integration
 */
class ThemeService {
  private currentTheme: Theme | null = null
  private themePreference: ThemePreference | null = null
  private systemMediaQuery: MediaQueryList | null = null
  private cssRoot: HTMLElement | null = null

  constructor() {
    this.cssRoot = document.documentElement
    this.setupSystemThemeListener()
  }

  /**
   * Initialize theme system
   * Loads user preferences and applies appropriate theme
   */
  async initialize(): Promise<void> {
    try {
      // Load user preferences from backend
      await this.loadUserPreferences()
      
      // Apply theme based on preferences
      if (this.themePreference) {
        if (this.themePreference.autoSwitch) {
          // Follow system preference
          const systemTheme = getSystemPreferredTheme()
          await this.applyTheme(systemTheme, false) // Don't persist system switches
        } else {
          // Use user's selected theme
          const selectedTheme = getThemeById(this.themePreference.themeId)
          if (selectedTheme) {
            await this.applyTheme(selectedTheme, false)
          } else {
            // Fallback to default if selected theme not found
            const defaultTheme = getDefaultTheme()
            await this.applyTheme(defaultTheme, true)
          }
        }
      } else {
        // No preferences found, use system preference
        const systemTheme = getSystemPreferredTheme()
        await this.applyTheme(systemTheme, true)
      }
    } catch (error) {
      console.error('Failed to initialize theme system:', error)
      // Fallback to default theme
      const defaultTheme = getDefaultTheme()
      await this.applyTheme(defaultTheme, false)
    }
  }

  /**
   * Get all available themes
   */
  getAvailableThemes(): Theme[] {
    return [...themes]
  }

  /**
   * Get currently active theme
   */
  getCurrentTheme(): Theme | null {
    return this.currentTheme
  }

  /**
   * Get current theme preferences
   */
  getThemePreferences(): ThemePreference | null {
    return this.themePreference ? { ...this.themePreference } : null
  }

  /**
   * Apply a theme
   * @param theme Theme to apply
   * @param persist Whether to save this as user preference
   */
  async applyTheme(theme: Theme, persist: boolean = true): Promise<void> {
    if (!theme || !this.cssRoot) {
      throw new Error('Invalid theme or CSS root not available')
    }

    try {
      // Apply theme colors to CSS custom properties
      this.applyCSSVariables(theme)
      
      // Update current theme reference
      this.currentTheme = theme
      
      // Update body class for theme-specific styling
      this.updateBodyClass(theme)
      
      // Persist preferences if requested
      if (persist) {
        await this.saveUserPreferences({
          themeId: theme.id,
          autoSwitch: false
        })
      }

      // Emit theme change event for components that need to respond
      this.emitThemeChangeEvent(theme)
      
      console.log(`Applied theme: ${theme.name} (${theme.id})`)
    } catch (error) {
      console.error('Failed to apply theme:', error)
      throw error
    }
  }

  /**
   * Switch to a specific theme by ID
   */
  async switchToTheme(themeId: string): Promise<void> {
    const theme = getThemeById(themeId)
    if (!theme) {
      throw new Error(`Theme with ID '${themeId}' not found`)
    }
    
    await this.applyTheme(theme, true)
  }

  /**
   * Toggle between light and dark themes
   */
  async toggleThemeCategory(): Promise<void> {
    if (!this.currentTheme) {
      await this.initialize()
      return
    }

    const currentCategory = this.currentTheme.category
    const newCategory = currentCategory === 'dark' ? 'light' : 'dark'
    
    // Find a theme in the opposite category
    const oppositeThemes = themes.filter(t => t.category === newCategory)
    if (oppositeThemes.length === 0) {
      throw new Error(`No ${newCategory} themes available`)
    }

    // Prefer GitHub themes for category switching
    const preferredTheme = oppositeThemes.find(t => t.id.includes('github')) || oppositeThemes[0]
    await this.applyTheme(preferredTheme, true)
  }

  /**
   * Enable/disable automatic system theme switching
   */
  async setAutoSwitch(enabled: boolean): Promise<void> {
    try {
      const preferences: ThemePreference = {
        themeId: this.currentTheme?.id || getDefaultTheme().id,
        autoSwitch: enabled
      }

      if (enabled) {
        // Switch to system-preferred theme immediately
        const systemTheme = getSystemPreferredTheme()
        await this.applyTheme(systemTheme, false)
        preferences.themeId = systemTheme.id
      }

      await this.saveUserPreferences(preferences)
    } catch (error) {
      console.error('Failed to set auto switch preference:', error)
      throw error
    }
  }

  /**
   * Apply theme colors to CSS custom properties
   */
  private applyCSSVariables(theme: Theme): void {
    if (!this.cssRoot) return

    const { colors, terminal, syntax } = theme

    // Apply background colors
    this.cssRoot.style.setProperty('--bg-primary', colors.background.primary)
    this.cssRoot.style.setProperty('--bg-secondary', colors.background.secondary)
    this.cssRoot.style.setProperty('--bg-tertiary', colors.background.tertiary)
    this.cssRoot.style.setProperty('--bg-quaternary', colors.background.quaternary)
    this.cssRoot.style.setProperty('--bg-overlay', colors.background.overlay)

    // Apply text colors
    this.cssRoot.style.setProperty('--text-primary', colors.text.primary)
    this.cssRoot.style.setProperty('--text-secondary', colors.text.secondary)
    this.cssRoot.style.setProperty('--text-tertiary', colors.text.tertiary)
    this.cssRoot.style.setProperty('--text-disabled', colors.text.disabled)
    this.cssRoot.style.setProperty('--text-inverse', colors.text.inverse)

    // Apply border colors
    this.cssRoot.style.setProperty('--border-primary', colors.border.primary)
    this.cssRoot.style.setProperty('--border-secondary', colors.border.secondary)
    this.cssRoot.style.setProperty('--border-focus', colors.border.focus)
    this.cssRoot.style.setProperty('--border-hover', colors.border.hover)

    // Apply interactive colors
    this.cssRoot.style.setProperty('--interactive-primary', colors.interactive.primary)
    this.cssRoot.style.setProperty('--interactive-primary-hover', colors.interactive.primaryHover)
    this.cssRoot.style.setProperty('--interactive-primary-active', colors.interactive.primaryActive)
    this.cssRoot.style.setProperty('--interactive-primary-disabled', colors.interactive.primaryDisabled)
    this.cssRoot.style.setProperty('--interactive-secondary', colors.interactive.secondary)
    this.cssRoot.style.setProperty('--interactive-secondary-hover', colors.interactive.secondaryHover)
    this.cssRoot.style.setProperty('--interactive-tertiary', colors.interactive.tertiary)
    this.cssRoot.style.setProperty('--interactive-tertiary-hover', colors.interactive.tertiaryHover)
    this.cssRoot.style.setProperty('--interactive-link', colors.interactive.link)
    this.cssRoot.style.setProperty('--interactive-link-hover', colors.interactive.linkHover)
    this.cssRoot.style.setProperty('--interactive-link-visited', colors.interactive.linkVisited)

    // Apply semantic colors
    this.cssRoot.style.setProperty('--semantic-success', colors.semantic.success)
    this.cssRoot.style.setProperty('--semantic-success-bg', colors.semantic.successBg)
    this.cssRoot.style.setProperty('--semantic-success-border', colors.semantic.successBorder)
    this.cssRoot.style.setProperty('--semantic-warning', colors.semantic.warning)
    this.cssRoot.style.setProperty('--semantic-warning-bg', colors.semantic.warningBg)
    this.cssRoot.style.setProperty('--semantic-warning-border', colors.semantic.warningBorder)
    this.cssRoot.style.setProperty('--semantic-error', colors.semantic.error)
    this.cssRoot.style.setProperty('--semantic-error-bg', colors.semantic.errorBg)
    this.cssRoot.style.setProperty('--semantic-error-border', colors.semantic.errorBorder)
    this.cssRoot.style.setProperty('--semantic-info', colors.semantic.info)
    this.cssRoot.style.setProperty('--semantic-info-bg', colors.semantic.infoBg)
    this.cssRoot.style.setProperty('--semantic-info-border', colors.semantic.infoBorder)

    // Apply sidebar colors
    this.cssRoot.style.setProperty('--sidebar-background', colors.sidebar.background)
    this.cssRoot.style.setProperty('--sidebar-text', colors.sidebar.text)
    this.cssRoot.style.setProperty('--sidebar-text-secondary', colors.sidebar.textSecondary)
    this.cssRoot.style.setProperty('--sidebar-border', colors.sidebar.border)
    this.cssRoot.style.setProperty('--sidebar-item-hover', colors.sidebar.itemHover)
    this.cssRoot.style.setProperty('--sidebar-item-active', colors.sidebar.itemActive)
    this.cssRoot.style.setProperty('--sidebar-item-active-border', colors.sidebar.itemActiveBorder)

    // Apply editor colors
    this.cssRoot.style.setProperty('--editor-background', colors.editor.background)
    this.cssRoot.style.setProperty('--editor-gutter', colors.editor.gutter)
    this.cssRoot.style.setProperty('--editor-gutter-text', colors.editor.gutterText)
    this.cssRoot.style.setProperty('--editor-selection', colors.editor.selection)
    this.cssRoot.style.setProperty('--editor-selection-inactive', colors.editor.selectionInactive)
    this.cssRoot.style.setProperty('--editor-cursor', colors.editor.cursor)
    this.cssRoot.style.setProperty('--editor-current-line', colors.editor.currentLine)
    this.cssRoot.style.setProperty('--editor-matching-bracket', colors.editor.matchingBracket)
    this.cssRoot.style.setProperty('--editor-find-match', colors.editor.findMatch)
    this.cssRoot.style.setProperty('--editor-find-match-active', colors.editor.findMatchActive)

    // Apply input colors
    this.cssRoot.style.setProperty('--input-background', colors.input.background)
    this.cssRoot.style.setProperty('--input-background-focus', colors.input.backgroundFocus)
    this.cssRoot.style.setProperty('--input-text', colors.input.text)
    this.cssRoot.style.setProperty('--input-placeholder', colors.input.placeholder)
    this.cssRoot.style.setProperty('--input-border', colors.input.border)
    this.cssRoot.style.setProperty('--input-border-focus', colors.input.borderFocus)
    this.cssRoot.style.setProperty('--input-border-error', colors.input.borderError)

    // Apply scrollbar colors
    this.cssRoot.style.setProperty('--scrollbar-track', colors.scrollbar.track)
    this.cssRoot.style.setProperty('--scrollbar-thumb', colors.scrollbar.thumb)
    this.cssRoot.style.setProperty('--scrollbar-thumb-hover', colors.scrollbar.thumbHover)

    // Apply tooltip colors
    this.cssRoot.style.setProperty('--tooltip-background', colors.tooltip.background)
    this.cssRoot.style.setProperty('--tooltip-text', colors.tooltip.text)
    this.cssRoot.style.setProperty('--tooltip-border', colors.tooltip.border)

    // Apply terminal colors
    this.cssRoot.style.setProperty('--terminal-background', terminal.background)
    this.cssRoot.style.setProperty('--terminal-foreground', terminal.foreground)
    this.cssRoot.style.setProperty('--terminal-cursor', terminal.cursor)
    this.cssRoot.style.setProperty('--terminal-selection', terminal.selection)

    // Apply ANSI terminal colors
    this.cssRoot.style.setProperty('--terminal-black', terminal.black)
    this.cssRoot.style.setProperty('--terminal-red', terminal.red)
    this.cssRoot.style.setProperty('--terminal-green', terminal.green)
    this.cssRoot.style.setProperty('--terminal-yellow', terminal.yellow)
    this.cssRoot.style.setProperty('--terminal-blue', terminal.blue)
    this.cssRoot.style.setProperty('--terminal-magenta', terminal.magenta)
    this.cssRoot.style.setProperty('--terminal-cyan', terminal.cyan)
    this.cssRoot.style.setProperty('--terminal-white', terminal.white)
    this.cssRoot.style.setProperty('--terminal-bright-black', terminal.brightBlack)
    this.cssRoot.style.setProperty('--terminal-bright-red', terminal.brightRed)
    this.cssRoot.style.setProperty('--terminal-bright-green', terminal.brightGreen)
    this.cssRoot.style.setProperty('--terminal-bright-yellow', terminal.brightYellow)
    this.cssRoot.style.setProperty('--terminal-bright-blue', terminal.brightBlue)
    this.cssRoot.style.setProperty('--terminal-bright-magenta', terminal.brightMagenta)
    this.cssRoot.style.setProperty('--terminal-bright-cyan', terminal.brightCyan)
    this.cssRoot.style.setProperty('--terminal-bright-white', terminal.brightWhite)

    // Apply syntax highlighting colors
    this.cssRoot.style.setProperty('--syntax-keyword', syntax.keyword)
    this.cssRoot.style.setProperty('--syntax-string', syntax.string)
    this.cssRoot.style.setProperty('--syntax-comment', syntax.comment)
    this.cssRoot.style.setProperty('--syntax-number', syntax.number)
    this.cssRoot.style.setProperty('--syntax-function', syntax.function)
    this.cssRoot.style.setProperty('--syntax-variable', syntax.variable)
    this.cssRoot.style.setProperty('--syntax-type', syntax.type)
    this.cssRoot.style.setProperty('--syntax-operator', syntax.operator)
    this.cssRoot.style.setProperty('--syntax-bracket', syntax.bracket)
    this.cssRoot.style.setProperty('--syntax-tag', syntax.tag)
    this.cssRoot.style.setProperty('--syntax-attribute', syntax.attribute)
    this.cssRoot.style.setProperty('--syntax-constant', syntax.constant)
    this.cssRoot.style.setProperty('--syntax-error', syntax.error)
    this.cssRoot.style.setProperty('--syntax-warning', syntax.warning)
  }

  /**
   * Update body class for theme-specific styles
   */
  private updateBodyClass(theme: Theme): void {
    // Remove existing theme classes
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim()
    
    // Add new theme class
    document.body.classList.add(`theme-${theme.category}`)
    document.body.classList.add(`theme-${theme.id}`)
  }

  /**
   * Emit theme change event
   */
  private emitThemeChangeEvent(theme: Theme): void {
    const event = new CustomEvent('themeChanged', { 
      detail: { theme } 
    })
    window.dispatchEvent(event)
  }

  /**
   * Setup system theme change listener
   */
  private setupSystemThemeListener(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }

    this.systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleSystemThemeChange = async () => {
      // Only respond if user has auto-switch enabled
      if (this.themePreference?.autoSwitch) {
        const systemTheme = getSystemPreferredTheme()
        await this.applyTheme(systemTheme, false) // Don't persist system changes
      }
    }

    this.systemMediaQuery.addEventListener('change', handleSystemThemeChange)
  }

  /**
   * Load user theme preferences from backend
   */
  private async loadUserPreferences(): Promise<void> {
    try {
      const preferences = await apiService.getCurrentTheme()
      this.themePreference = preferences
    } catch (error) {
      console.warn('Failed to load theme preferences:', error)
      // Set default preferences
      this.themePreference = {
        themeId: getDefaultTheme().id,
        autoSwitch: true
      }
    }
  }

  /**
   * Save user theme preferences to backend
   */
  private async saveUserPreferences(preferences: ThemePreference): Promise<void> {
    try {
      await apiService.saveTheme(preferences)
      this.themePreference = { ...preferences }
    } catch (error) {
      console.error('Failed to save theme preferences:', error)
      throw error
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.systemMediaQuery) {
      this.systemMediaQuery.removeEventListener('change', () => {})
    }
  }
}

// Export singleton instance
export const themeService = new ThemeService()

// Export for testing/advanced usage
export { ThemeService }