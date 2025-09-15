import type { Theme, ThemePreference } from '@/types/theme'
import { themes, getThemeById, getSystemPreferredTheme, getDefaultTheme } from '@/data/themes'
import { apiService } from './api'
import { transformToLegacyTheme, applyLegacyTheme, getDefaultLegacyTheme, type LegacyTheme } from '@/utils/themeCompat'

interface ThemeApiService {
  getCurrentTheme(): Promise<ThemePreference | null>
  saveTheme(preferences: ThemePreference): Promise<void>
}

/**
 * Comprehensive theme service for AI Code Terminal
 * Handles theme application, persistence, and system integration
 */
class ThemeService {
  private currentTheme: Theme | null = null
  private apiService: ThemeApiService | null = null

  private getApiService(): ThemeApiService {
    return apiService
  }
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
  async switchToTheme(themeId: string, persist: boolean = true): Promise<void> {
    const theme = getThemeById(themeId)
    if (!theme) {
      throw new Error(`Theme with ID '${themeId}' not found`)
    }

    await this.applyTheme(theme, persist)
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
   * Apply theme colors using legacy compatibility layer
   * This ensures CSS variables match exactly what the original ../app system expected
   */
  private applyCSSVariables(theme: Theme): void {
    // Transform current theme to legacy format and apply
    const legacyTheme = transformToLegacyTheme(theme)
    applyLegacyTheme(legacyTheme)
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
      const apiService = await this.getApiService()
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
      const apiService = await this.getApiService()
      await apiService.saveTheme(preferences)
      this.themePreference = { ...preferences }
    } catch (error) {
      console.error('Failed to save theme preferences:', error)
      throw error
    }
  }

  /**
   * Set theme preferences without making API calls
   */
  setThemePreferences(preferences: ThemePreference): void {
    this.themePreference = { ...preferences }
  }

  /**
   * Set auto switch locally without API calls
   */
  setAutoSwitchLocal(autoSwitch: boolean): void {
    if (this.themePreference) {
      this.themePreference.autoSwitch = autoSwitch
    }
  }

  /**
   * Initialize with defaults without API calls
   */
  async initializeWithDefaults(): Promise<void> {
    const defaultTheme = getDefaultTheme()
    this.themePreference = {
      themeId: defaultTheme.id,
      autoSwitch: true
    }
    await this.applyTheme(defaultTheme, false) // Don't persist to backend
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