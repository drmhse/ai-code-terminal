import { ref, computed, readonly } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTerminalStore } from '@/stores/terminal'
import { useFileStore } from '@/stores/file'
import { useUIStore } from '@/stores/ui'
import { socketService } from '@/services/socket'

/**
 * Core application initialization and management composable
 * Migrated from the original Vue 2 mounted() and initializeApp() methods
 */
export function useAppCore() {
  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceStore()
  const terminalStore = useTerminalStore()
  const fileStore = useFileStore()
  const uiStore = useUIStore()

  const initializing = ref(false)
  const initializationError = ref<string | null>(null)

  // Core application initialization (migrated from mounted() method)
  const initializeApp = async () => {
    if (initializing.value) {
      console.log('⚠️ Application already initializing, skipping...')
      return false
    }
    
    initializing.value = true
    initializationError.value = null

    try {
      console.log('🚀 Initializing AI Code Terminal...')

      // 1. Check mobile state and set up viewport listeners
      uiStore.checkMobile()
      window.addEventListener('resize', uiStore.checkMobile)
      window.addEventListener('resize', terminalStore.updateViewportWidth)

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
        localStorage.setItem('jwt_token', token)
        window.history.replaceState({}, document.title, '/')
      }

      // 3. Try to initialize authentication
      const existingToken = localStorage.getItem('jwt_token')
      if (existingToken) {
        try {
          await authStore.tryInitializeApp()
          console.log('✅ Authentication successful')
        } catch (err) {
          console.warn('⚠️ Authentication failed, user needs to log in')
          initializationError.value = err instanceof Error ? err.message : 'Authentication failed'
          return false
        }
      } else {
        console.log('ℹ️ No authentication token found, user needs to log in')
        return false
      }

      // 4. Theme system is automatically initialized by useTheme composable
      console.log('✅ Theme system initialized')

      // 5. Load workspaces and repositories
      const ownerId = authStore.user?.id || authStore.user?.login
      console.log('🔄 Loading workspaces for user:', ownerId, 'User object:', authStore.user)
      try {
        await workspaceStore.fetchWorkspaces(ownerId)
        console.log('✅ Workspaces loaded successfully:', workspaceStore.workspaces.length, 'workspaces found')
        console.log('Workspaces data:', workspaceStore.workspaces)
      } catch (wsError) {
        console.error('❌ Failed to load workspaces:', wsError)
        // Don't fail initialization if workspace loading fails - this allows manual debugging
        console.error('Workspace error details:', {
          error: wsError,
          ownerId,
          user: authStore.user,
          hasToken: !!localStorage.getItem('jwt_token')
        })
      }

      // 6. Initialize terminal system
      terminalStore.updateLayoutRecommendations()
      console.log('✅ Terminal system initialized')

      // 7. Set up keyboard event handlers
      setupGlobalKeyboardHandlers()
      console.log('✅ Keyboard handlers set up')

      // 8. Initialize WebSocket connection if not already connected
      if (!socketService.isConnected) {
        try {
          await authStore.connectWebSocket()
          console.log('✅ WebSocket connected')
        } catch (wsError) {
          console.warn('⚠️ WebSocket connection failed, but continuing initialization:', wsError)
          // Don't fail initialization if WebSocket fails
        }
      } else {
        console.log('✅ WebSocket already connected')
      }

      console.log('🎉 Application initialization complete')
      return true

    } catch (err) {
      console.error('❌ Application initialization failed:', err)
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
        workspaceStore.closeRepositoriesModal()
        workspaceStore.closeDeleteModal()
        fileStore.closeFilePreviewModal()
        fileStore.closeContextMenu()
        uiStore.closeMobileInput()
      }

      // File explorer keyboard navigation
      if (workspaceStore.selectedWorkspace && 
          !fileStore.fileExplorerCollapsed &&
          !workspaceStore.showRepositoriesModal && 
          !uiStore.showThemeModal &&
          !workspaceStore.showDeleteModal && 
          !fileStore.showFilePreviewModal &&
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
      console.error('Failed to initialize app:', err)
      initializationError.value = err instanceof Error ? err.message : 'Failed to initialize app'
      return false
    }
  }

  // Load application statistics (migrated from loadStats method)
  const loadStats = async () => {
    try {
      await authStore.loadStats()
    } catch (err) {
      console.error('Failed to load stats:', err)
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
      console.error('Logout failed:', err)
      // Force logout even if API call fails
      authStore.logout()
      window.location.reload()
    }
  }

  // Clean up resources when component unmounts
  const cleanup = () => {
    window.removeEventListener('resize', uiStore.checkMobile)
    window.removeEventListener('resize', terminalStore.updateViewportWidth)
    
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