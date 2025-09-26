import { ref, computed } from 'vue'
import type { LayoutPreferences, UserPreferences } from '@/types/layout'
import { LAYOUT_CONSTRAINTS, DEFAULT_LAYOUT_PREFERENCES, clampWidth } from '@/types/layout'
import { apiService } from '@/services/api'
import { logger } from '@/utils/logger'

// SINGLETON STATE - shared across all component instances (following theme pattern)
const preferences = ref<LayoutPreferences>(DEFAULT_LAYOUT_PREFERENCES)
const isInitialized = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
let initializationPromise: Promise<void> | null = null

// Debounced save to prevent excessive API calls during drag operations
let saveTimeout: number | null = null

/**
 * Layout preferences composable following exact theme store pattern
 * Provides localStorage + API persistence with singleton state
 */
export function useLayoutPreferences() {

  // Computed properties for easy access
  const sidebarWidth = computed(() => preferences.value.sidebarWidth)
  const editorWidth = computed(() => preferences.value.editorWidth)
  const version = computed(() => preferences.value.version)

  // Constraints for validation
  const constraints = computed(() => LAYOUT_CONSTRAINTS)

  // Update methods with validation and persistence
  const updateSidebarWidth = async (width: number): Promise<void> => {
    const clampedWidth = clampWidth(width, 'sidebar')
    preferences.value.sidebarWidth = clampedWidth

    // Immediate localStorage update
    saveToLocalStorage()

    // Debounced API sync (following theme pattern)
    debouncedApiSync()
  }

  const updateEditorWidth = async (width: number): Promise<void> => {
    const clampedWidth = clampWidth(width, 'editor')
    preferences.value.editorWidth = clampedWidth

    // Immediate localStorage update
    saveToLocalStorage()

    // Debounced API sync (following theme pattern)
    debouncedApiSync()
  }

  // Save to localStorage immediately for instant UX
  const saveToLocalStorage = (): void => {
    try {
      localStorage.setItem('layout-preferences', JSON.stringify(preferences.value))
    } catch (error) {
      logger.error('Failed to save layout preferences to localStorage:', error)
    }
  }

  // Load from localStorage
  const loadFromLocalStorage = (): LayoutPreferences | null => {
    try {
      const stored = localStorage.getItem('layout-preferences')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Validate and clamp values from localStorage
        return {
          sidebarWidth: clampWidth(parsed.sidebarWidth || DEFAULT_LAYOUT_PREFERENCES.sidebarWidth, 'sidebar'),
          editorWidth: clampWidth(parsed.editorWidth || DEFAULT_LAYOUT_PREFERENCES.editorWidth, 'editor'),
          version: parsed.version || DEFAULT_LAYOUT_PREFERENCES.version
        }
      }
    } catch (error) {
      logger.error('Failed to load layout preferences from localStorage:', error)
    }
    return null
  }

  // Debounced API sync to prevent excessive calls during dragging
  const debouncedApiSync = (): void => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    saveTimeout = window.setTimeout(async () => {
      await syncToApi()
      saveTimeout = null
    }, 500) // 500ms debounce like theme store
  }

  // Sync to backend API
  const syncToApi = async (): Promise<void> => {
    try {
      // Get current user preferences to preserve workspace setting
      const currentPrefs = await apiService.getUserPreferences()

      const userPreferences: UserPreferences = {
        currentWorkspaceId: currentPrefs?.currentWorkspaceId || null,
        layoutPreferences: preferences.value
      }

      await apiService.updateUserPreferences(userPreferences)
      logger.log('✅ Layout preferences synced to backend')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to sync layout preferences'
      logger.error('❌ Failed to sync layout preferences to backend:', err)
    }
  }

  // Initialize preferences (following theme store pattern)
  const initialize = async (isAuthenticated: boolean = false): Promise<void> => {
    if (isInitialized.value) {
      return
    }

    // If already initializing, wait for that promise
    if (initializationPromise) {
      return initializationPromise
    }

    // Create initialization promise
    initializationPromise = (async () => {
      isLoading.value = true
      error.value = null

      try {
        if (isAuthenticated) {
          // Load from backend for authenticated users
          const userPrefs = await apiService.getUserPreferences()
          if (userPrefs?.layoutPreferences) {
            preferences.value = {
              sidebarWidth: clampWidth(userPrefs.layoutPreferences.sidebarWidth, 'sidebar'),
              editorWidth: clampWidth(userPrefs.layoutPreferences.editorWidth, 'editor'),
              version: userPrefs.layoutPreferences.version
            }
            logger.log('✅ Layout preferences loaded from backend')
          } else {
            // Fallback to localStorage
            const localPrefs = loadFromLocalStorage()
            if (localPrefs) {
              preferences.value = localPrefs
              logger.log('✅ Layout preferences loaded from localStorage (backend had none)')
            }
          }
        } else {
          // Load from localStorage for unauthenticated users
          const localPrefs = loadFromLocalStorage()
          if (localPrefs) {
            preferences.value = localPrefs
            logger.log('✅ Layout preferences loaded from localStorage')
          }
        }

        // Always save to localStorage for consistency
        saveToLocalStorage()

        isInitialized.value = true
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to initialize layout preferences'
        logger.error('❌ Failed to initialize layout preferences:', err)
      } finally {
        isLoading.value = false
      }
    })()

    return initializationPromise
  }

  // Reset for new user (following theme pattern)
  const reinitializeForUser = async (): Promise<void> => {
    isInitialized.value = false
    initializationPromise = null
    await initialize(true)
  }

  // Manually sync preferences (useful for force saves)
  const forceSync = async (): Promise<void> => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
    await syncToApi()
  }

  return {
    // State
    preferences: computed(() => preferences.value),
    sidebarWidth,
    editorWidth,
    version,
    constraints,
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),

    // Actions
    updateSidebarWidth,
    updateEditorWidth,
    initialize,
    reinitializeForUser,
    forceSync
  }
}