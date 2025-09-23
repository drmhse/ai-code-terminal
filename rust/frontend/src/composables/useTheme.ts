import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Theme, ThemePreference } from '@/types/theme'
import { themeService } from '@/services/theme'
import { apiService } from '@/services/api'
import { transformToLegacyTheme } from '@/utils/themeCompat'
import { logger } from '@/utils/logger'

// SINGLETON STATE - shared across all component instances
const currentTheme = ref<Theme | null>(null)
const isInitialized = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
let initializationPromise: Promise<void> | null = null // Prevent concurrent initializations

/**
 * Theme composable for components to interact with the theme system
 * Uses singleton pattern to prevent multiple initializations
 */
export function useTheme() {

  // Computed properties
  const isDark = computed(() => currentTheme.value?.category === 'dark')
  const isLight = computed(() => currentTheme.value?.category === 'light')
  const isHighContrast = computed(() => currentTheme.value?.category === 'high-contrast')
  const themeId = computed(() => currentTheme.value?.id || 'vscode-dark')
  const themeName = computed(() => currentTheme.value?.name || 'VS Code Dark')

  // Available themes
  const availableThemes = computed(() => themeService.getAvailableThemes())
  const darkThemes = computed(() => availableThemes.value.filter(t => t.category === 'dark'))
  const lightThemes = computed(() => availableThemes.value.filter(t => t.category === 'light'))

  // Theme operations
  const switchToTheme = async (themeId: string): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      await themeService.switchToTheme(themeId)
      currentTheme.value = themeService.getCurrentTheme()

      // Persist theme preference to backend (backend expects simple format)
      const preferences = themeService.getThemePreferences()
      if (preferences) {
        await apiService.saveTheme(preferences)
      }

      // Emit theme change event for any terminal components that need to respond
      const theme = themeService.getCurrentTheme()
      if (theme) {
        const legacyTheme = transformToLegacyTheme(theme)
        const event = new CustomEvent('themeChanged', { detail: { theme: legacyTheme } })
        window.dispatchEvent(event)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to switch theme'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const toggleTheme = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    
    try {
      await themeService.toggleThemeCategory()
      currentTheme.value = themeService.getCurrentTheme()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to toggle theme'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const setAutoSwitch = async (enabled: boolean): Promise<void> => {
    isLoading.value = true
    error.value = null
    
    try {
      await themeService.setAutoSwitch(enabled)
      currentTheme.value = themeService.getCurrentTheme()
      
      // Persist theme preference to backend
      const preferences = themeService.getThemePreferences()
      if (preferences) {
        await apiService.saveTheme(preferences)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to set auto switch'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const getThemePreferences = (): ThemePreference | null => {
    return themeService.getThemePreferences()
  }

  const reinitializeForUser = async (): Promise<void> => {
    // Reset initialization state to allow re-initialization with user preferences
    isInitialized.value = false
    initializationPromise = null

    // Re-initialize with authentication
    await initialize(true)
  }

  // Initialize theme system
  const initialize = async (isAuthenticated: boolean = false): Promise<void> => {
    logger.log('🎨 Theme initialize() called, isInitialized:', isInitialized.value, 'hasPromise:', !!initializationPromise, 'isAuthenticated:', isAuthenticated)

    if (isInitialized.value) {
      logger.log('🎨 Theme already initialized, skipping')
      return
    }

    // If already initializing, wait for that promise
    if (initializationPromise) {
      logger.log('🎨 Theme initialization already in progress, waiting...')
      return initializationPromise
    }

    // Create the initialization promise
    initializationPromise = (async () => {
      isLoading.value = true
      error.value = null

      try {
        if (isAuthenticated) {
          // Load saved theme preferences from backend (single API call)
          logger.log('🎨 Making API call to get current theme...')
          const savedPreferences = await apiService.getCurrentTheme()
          logger.log('🎨 API response received:', savedPreferences)

          if (savedPreferences?.themeId) {
            // Apply saved preferences directly without additional API calls
            logger.log(`🎨 Applying saved theme: ${savedPreferences.themeId}`)
            themeService.setThemePreferences(savedPreferences)
            await themeService.switchToTheme(savedPreferences.themeId, false) // false = don't persist to backend
            if (savedPreferences.autoSwitch !== undefined) {
              themeService.setAutoSwitchLocal(savedPreferences.autoSwitch) // local only, no API call
            }
            logger.log(`✅ Applied saved theme: ${savedPreferences.themeId}`)
          } else {
            // No saved preferences, initialize with defaults (no API call)
            logger.log('🎨 No saved theme preferences found, using defaults')
            await themeService.initializeWithDefaults()
            logger.log('✅ Initialized with default theme')
          }
        } else {
          // User not authenticated, use defaults without API calls
          logger.log('🎨 User not authenticated, initializing with defaults')
          await themeService.initializeWithDefaults()
          logger.log('✅ Initialized with default theme (no auth)')
        }

        currentTheme.value = themeService.getCurrentTheme()
        isInitialized.value = true
      } catch (err) {
        logger.warn('Failed to load theme preferences from backend, using defaults:', err)
        // Fall back to local initialization without API calls
        try {
          await themeService.initializeWithDefaults()
          currentTheme.value = themeService.getCurrentTheme()
          isInitialized.value = true
          logger.log('Fallback to default theme successful')
        } catch (fallbackErr) {
          error.value = fallbackErr instanceof Error ? fallbackErr.message : 'Failed to initialize theme system'
          logger.error('Theme initialization completely failed:', fallbackErr)
          isInitialized.value = true // Prevent infinite retry
        }
      } finally {
        isLoading.value = false
        initializationPromise = null // Reset so future calls can proceed
      }
    })()

    return initializationPromise
  }

  // Listen for theme changes from other sources
  const handleThemeChange = (event: CustomEvent) => {
    currentTheme.value = event.detail.theme
  }

  // Lifecycle
  onMounted(() => {
    // Note: Do not auto-initialize here to avoid calling APIs for non-authenticated users
    // Theme initialization should be explicitly called from App.vue with authentication status

    // Listen for theme changes
    window.addEventListener('themeChanged', handleThemeChange as EventListener)
  })

  onUnmounted(() => {
    // Cleanup event listener
    window.removeEventListener('themeChanged', handleThemeChange as EventListener)
  })

  // Utility functions
  const getThemeById = (id: string): Theme | undefined => {
    return availableThemes.value.find(theme => theme.id === id)
  }

  const getCSSVariable = (property: string): string => {
    if (!currentTheme.value) return ''
    return getComputedStyle(document.documentElement).getPropertyValue(property).trim()
  }

  return {
    // State
    currentTheme: computed(() => currentTheme.value),
    isInitialized: computed(() => isInitialized.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    
    // Computed properties
    isDark,
    isLight,
    isHighContrast,
    themeId,
    themeName,
    
    // Theme collections
    availableThemes,
    darkThemes,
    lightThemes,
    
    // Actions
    switchToTheme,
    toggleTheme,
    setAutoSwitch,
    initialize,
    reinitializeForUser,
    getThemePreferences,
    
    // Utilities
    getThemeById,
    getCSSVariable,
  }
}