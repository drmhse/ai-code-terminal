import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Theme, ThemePreference } from '@/types/theme'
import { themeService } from '@/services/theme'
import { apiService } from '@/services/api'

/**
 * Theme composable for components to interact with the theme system
 * Provides reactive theme state and theme management functions
 */
export function useTheme() {
  // Reactive state
  const currentTheme = ref<Theme | null>(null)
  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
      
      // Persist theme preference to backend
      const preferences = themeService.getThemePreferences()
      if (preferences) {
        await apiService.saveTheme(preferences)
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

  // Initialize theme system
  const initialize = async (): Promise<void> => {
    if (isInitialized.value) return
    
    isLoading.value = true
    error.value = null
    
    try {
      // First, try to load saved theme preferences from backend
      try {
        const savedPreferences = await apiService.getCurrentTheme()
        if (savedPreferences) {
          // Apply saved preferences to local theme service
          if (savedPreferences.themeId) {
            await themeService.switchToTheme(savedPreferences.themeId)
          }
          if (savedPreferences.autoSwitch !== undefined) {
            await themeService.setAutoSwitch(savedPreferences.autoSwitch)
          }
        }
      } catch (backendError) {
        console.warn('Failed to load theme preferences from backend, using defaults:', backendError)
        // Fall back to local initialization
        await themeService.initialize()
      }
      
      currentTheme.value = themeService.getCurrentTheme()
      isInitialized.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize theme system'
      console.error('Theme initialization failed:', err)
      
      // Still set as initialized to prevent infinite retry
      isInitialized.value = true
    } finally {
      isLoading.value = false
    }
  }

  // Listen for theme changes from other sources
  const handleThemeChange = (event: CustomEvent) => {
    currentTheme.value = event.detail.theme
  }

  // Lifecycle
  onMounted(() => {
    // Initialize theme system
    initialize()
    
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
    getThemePreferences,
    
    // Utilities
    getThemeById,
    getCSSVariable,
  }
}