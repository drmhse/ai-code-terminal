import { ref, computed, readonly } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTerminalTreeStore } from '@/stores/terminal-tree'
import { useFileStore } from '@/stores/file'
import { useUIStore } from '@/stores/ui'
import { socketService } from '@/services/socket'
import { logger } from '@/utils/logger'
import { authStorage } from '@/utils/auth-storage'

/**
 * Core application initialization and management composable
 * Migrated from the original Vue 2 mounted() and initializeApp() methods
 */
export function useAppCore() {
  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceStore()
  const terminalTreeStore = useTerminalTreeStore()
  const fileStore = useFileStore()
  const uiStore = useUIStore()

  const initializing = ref(false)
  const initializationError = ref<string | null>(null)

  // Core application initialization (migrated from mounted() method)
  const initializeApp = async () => {
    if (initializing.value) {
      logger.log('⚠️ Application already initializing, skipping...')
      return false
    }
    
    initializing.value = true
    initializationError.value = null

    try {
      logger.log('🚀 Initializing AI Code Terminal...')

      // 1. Check mobile state and set up viewport listeners
      uiStore.checkMobile()
      window.addEventListener('resize', uiStore.checkMobile)

      // 2. Check for authentication token in URL parameters
      const urlParams = new URLSearchParams(window.location.search)
      const token = urlParams.get('token')
      const error = urlParams.get('error')

      if (error) {
        initializationError.value = decodeURIComponent(error)
        window.history.replaceState({}, document.title, '/')
        return false
      }

      if (token) {
        authStorage.setToken(token)
        window.history.replaceState({}, document.title, '/')
      }

      // 3. Try to initialize authentication
      const existingToken = authStorage.getToken()
      if (existingToken) {
        try {
          await authStore.tryInitializeApp()
          logger.log('✅ Authentication successful')
        } catch (err) {
          logger.warn('⚠️ Authentication failed, user needs to log in')
          initializationError.value = err instanceof Error ? err.message : 'Authentication failed'
          return false
        }
      } else {
        logger.log('ℹ️ No authentication token found, user needs to log in')
        return false
      }

      // 4. Theme system is automatically initialized by useTheme composable
      logger.log('✅ Theme system initialized')

      // 5. Load workspaces and repositories
      logger.log('🔄 Loading workspaces for user:', authStore.user)
      try {
        await workspaceStore.fetchWorkspaces()
        logger.log('✅ Workspaces loaded successfully:', workspaceStore.workspaces.length, 'workspaces found')
        logger.log('Workspaces data:', workspaceStore.workspaces)
      } catch (wsError) {
        logger.error('❌ Failed to load workspaces:', wsError)
        // Don't fail initialization if workspace loading fails - this allows manual debugging
        logger.error('Workspace error details:', {
          error: wsError,
          user: authStore.user,
          hasToken: authStorage.hasToken()
        })
      }

      // 6. Initialize terminal system
      terminalTreeStore.initialize()
      logger.log('✅ Terminal system initialized')

      // 7. Set up keyboard event handlers
      setupGlobalKeyboardHandlers()
      logger.log('✅ Keyboard handlers set up')

      // 8. Initialize WebSocket connection if not already connected
      if (!socketService.isConnected) {
        try {
          await authStore.connectWebSocket()
          logger.log('✅ WebSocket connected')
        } catch (wsError) {
          logger.warn('⚠️ WebSocket connection failed, but continuing initialization:', wsError)
          // Don't fail initialization if WebSocket fails
        }
      } else {
        logger.log('✅ WebSocket already connected')
      }

      // 9. Restore sessions for current workspace if available
      if (socketService.isConnected && workspaceStore.currentWorkspace) {
        try {
          logger.log('🔄 Attempting to restore sessions for current workspace:', workspaceStore.currentWorkspace.id)
          // This will trigger session discovery and restoration in the workspace switch logic
          await workspaceStore.switchWorkspace(workspaceStore.currentWorkspace)
          logger.log('✅ Session restoration completed')
        } catch (sessionError) {
          logger.warn('⚠️ Session restoration failed, but continuing initialization:', sessionError)
          // Don't fail initialization if session restoration fails
        }
      } else {
        logger.log('ℹ️ Skipping session restoration: WebSocket not connected or no current workspace')
      }

      logger.log('🎉 Application initialization complete')
      return true

    } catch (err) {
      logger.error('❌ Application initialization failed:', err)
      initializationError.value = err instanceof Error ? err.message : 'Initialization failed'
      return false
    } finally {
      initializing.value = false
    }
  }

  // Set up global keyboard event handlers (migrated from mounted() method)
  const setupGlobalKeyboardHandlers = () => {
    document.addEventListener('keydown', (e) => {
      // Close modals on Escape key
      if (e.key === 'Escape') {
        uiStore.closeThemeModal()
        uiStore.closeRepositoriesModal()
        uiStore.closeDeleteModal()
        fileStore.closeContextMenu()
        uiStore.closeMobileInput()
      }

      // File explorer keyboard navigation
      if (workspaceStore.selectedWorkspace && 
          !fileStore.fileExplorerCollapsed &&
          !uiStore.showRepositoriesModal &&
          !uiStore.showThemeModal &&
          !uiStore.showDeleteModal && 
          !document.querySelector('input:focus') &&
          !isTerminalFocused()) {

        fileStore.handleFileNavigationKeys(e)
      }
    })
  }

  // Check if terminal is currently focused
  const isTerminalFocused = (): boolean => {
    const activeElement = document.activeElement
    if (!activeElement) return false
    
    // Check if active element is within terminal component
    return activeElement.closest('.terminal-container') !== null ||
           activeElement.closest('.xterm-screen') !== null ||
           activeElement.classList.contains('xterm-helper-textarea')
  }

  // Try to initialize app with error handling (migrated from tryInitializeApp method)
  const tryInitializeApp = async () => {
    try {
      const success = await initializeApp()
      return success
    } catch (err) {
      logger.error('Failed to initialize app:', err)
      initializationError.value = err instanceof Error ? err.message : 'Failed to initialize app'
      return false
    }
  }

  // Load application statistics (migrated from loadStats method)
  const loadStats = async () => {
    try {
      await authStore.loadStats()
    } catch (err) {
      logger.error('Failed to load stats:', err)
      // Don't throw here as stats are not critical
    }
  }

  // Handle application logout (migrated from logout method)
  const logout = async () => {
    try {
      await authStore.logout()
      // Redirect to login page or reload
      window.location.reload()
    } catch (err) {
      logger.error('Logout failed:', err)
      // Force logout even if API call fails
      authStore.logout()
      window.location.reload()
    }
  }

  // Clean up resources when component unmounts
  const cleanup = () => {
    window.removeEventListener('resize', uiStore.checkMobile)
    
    // Stop any polling intervals
    if (authStore.stats) {
      // Stats polling is handled in auth store
    }
    
    // Disconnect WebSocket
    socketService.disconnect()
  }

  // Computed properties
  const isAppReady = computed(() => 
    authStore.isAuthenticated && 
    !initializing.value && 
    !initializationError.value
  )

  const appStatus = computed(() => {
    if (initializing.value) return 'initializing'
    if (initializationError.value) return 'error'
    if (!authStore.isAuthenticated) return 'unauthenticated'
    return 'ready'
  })

  const canUseApp = computed(() => 
    authStore.isAuthenticated && appStatus.value === 'ready'
  )

  return {
    // State
    initializing: readonly(initializing),
    initializationError: readonly(initializationError),
    
    // Computed
    isAppReady,
    appStatus,
    canUseApp,
    
    // Methods
    initializeApp,
    tryInitializeApp,
    loadStats,
    logout,
    cleanup,
    setupGlobalKeyboardHandlers,
    isTerminalFocused
  }
}