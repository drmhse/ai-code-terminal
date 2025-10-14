import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { User } from '@/types'
import { socketService } from '@/services/socket'
import { apiService } from '@/services/api'
import { ConnectionState } from '@/types/socket'
import { logger } from '@/utils/logger'

export interface AppStats {
  system: {
    cpu: number
    memory: number
    disk: number
    uptime: number
  }
  sessions: {
    active: number
    total: number
  }
  workspaces: {
    count: number
  }
}


export interface Subscription {
  plan: string
  features: string[]
  status: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Enhanced authentication state from original app
  const username = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)

  // SSO-specific state
  const subscription = ref<Subscription | null>(null)

  // System stats
  const stats = ref<AppStats | null>(null)
  const statsListener = ref<((event: Event) => void) | null>(null)

  // Initialization state
  const isAppInitialized = ref(false)
  const isInitializing = ref(false)
  const isFetchingUser = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const hasStats = computed(() => !!stats.value)
  const systemLoad = computed(() => {
    if (!stats.value) return 0
    return (stats.value.system.cpu + stats.value.system.memory) / 2
  })

  const initializeAuth = () => {
    const storedToken = localStorage.getItem('jwt_token')
    const storedUser = localStorage.getItem('user')

    if (storedToken && storedUser) {
      token.value = storedToken
      try {
        user.value = JSON.parse(storedUser)
      } catch (error) {
        logger.error('Failed to parse stored user:', error)
        logout()
      }
    }
  }

  const setAuthData = (authToken: string, userData: User) => {
    token.value = authToken
    user.value = userData
    localStorage.setItem('jwt_token', authToken)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const fetchCurrentUser = async () => {
    if (!token.value) {
      throw new Error('No token available')
    }

    // Prevent concurrent API calls
    if (isFetchingUser.value) {
      logger.log('⚠️ Already fetching user, skipping duplicate call')
      return user.value
    }

    // Skip if user data is already fresh and valid
    if (user.value && !loading.value) {
      logger.log('✅ User data already available, skipping API call')
      return user.value
    }

    isFetchingUser.value = true
    loading.value = true
    
    try {
      logger.log('🔍 Fetching current user data...')
      const userData = await apiService.getCurrentUser()
      user.value = userData
      username.value = userData.login || null
      localStorage.setItem('user', JSON.stringify(userData))
      logger.log('✅ User data fetched successfully')
      return userData
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch user'
      throw err
    } finally {
      loading.value = false
      isFetchingUser.value = false
    }
  }

  const connectWebSocket = async () => {
    if (!isAuthenticated.value) return
    
    // Skip if already connected or connecting
    if (socketService.isConnected) {
      logger.log('✅ WebSocket already connected')
      return
    }

    try {
      await socketService.connect()
      logger.log('WebSocket connection established')
    } catch (error) {
      logger.error('Failed to connect WebSocket:', error)
      // Don't throw here - allow the app to continue even if WebSocket fails
      // The app will retry connection later
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    username.value = null
    error.value = null
    errorMessage.value = null
    
    // Reset initialization state
    isAppInitialized.value = false
    isInitializing.value = false
    isFetchingUser.value = false
    
    // Unsubscribe from WebSocket stats and clean up listener
    if (statsListener.value) {
      window.removeEventListener('stats:data', statsListener.value)
      statsListener.value = null
    }
    socketService.unsubscribeFromStats()
    stats.value = null
    
    localStorage.removeItem('jwt_token')
    localStorage.removeItem('user')
    socketService.disconnect()
  }

  const getGitHubAuthUrl = () => {
    // Frontend generates GitHub OAuth URL with environment-aware redirect URI
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID

    // Check if we're in Tauri desktop app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isTauriApp = !!(window as any).__TAURI__

    // GitHub OAuth doesn't support custom URL schemes
    // Desktop mode: Use fixed port 3001 with loopback URL (GitHub supports this)
    // Web mode: Use current origin
    const redirectUri = isTauriApp
      ? 'http://127.0.0.1:3001/api/v1/auth/github/callback'
      : `${window.location.origin}/auth/callback`

    const state = crypto.randomUUID()
    localStorage.setItem('oauth_state', state)

    console.log(`[Auth] Generating GitHub OAuth URL`)
    console.log(`  Mode: ${isTauriApp ? 'Desktop (Tauri)' : 'Web (Browser)'}`)
    console.log(`  Redirect URI: ${redirectUri}`)

    const fullUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email repo read:org&state=${state}`
    console.log(`  Full OAuth URL: ${fullUrl}`)

    return fullUrl
  }

  // SSO Authentication Methods
  const getSsoAuthUrl = (provider: 'github' | 'microsoft' | 'google') => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
    return `${apiBaseUrl}/api/v1/auth/${provider}/start`
  }

  const startDeviceFlow = async () => {
    try {
      const response = await apiService.startDeviceFlow()
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start device flow'
      throw err
    }
  }

  const pollDeviceToken = async (deviceCode: string) => {
    try {
      const response = await apiService.pollDeviceToken(deviceCode)
      if (response.access_token) {
        await setToken(response.access_token)
      }
      return response
    } catch (err) {
      // Don't set error for pending states
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      if (!errorMsg.includes('pending')) {
        error.value = errorMsg
      }
      throw err
    }
  }

  const fetchSubscription = async () => {
    if (!token.value) return

    try {
      const sub = await apiService.getSubscription()
      subscription.value = sub
    } catch (err) {
      logger.error('Failed to fetch subscription:', err)
      // Don't throw - subscription is optional
    }
  }

  const checkAuthStatus = async () => {
    // Initialize from localStorage first
    initializeAuth()
    
    // If we have a token, validate it and establish connections
    if (token.value) {
      try {
        // Only fetch user data if we don't have it or if it's stale
        if (!user.value) {
          await fetchCurrentUser()
        } else {
          logger.log('✅ User data already available from localStorage')
        }
        
        await connectWebSocket()
        
        // Initialize app after successful authentication
        if (user.value) {
          username.value = user.value.login || null
          await initializeApp()
        }
      } catch (error) {
        logger.error('Auth validation failed on reload:', error)
        // Token is invalid, clear it
        logout()
      }
    }
  }

  const setToken = async (authToken: string) => {
    token.value = authToken
    localStorage.setItem('jwt_token', authToken)
    await fetchCurrentUser()
    await fetchSubscription()  // Fetch subscription info for SSO
    await connectWebSocket()

    // Initialize app after authentication
    if (user.value) {
      username.value = user.value.login || null
      await initializeApp()
    }
  }
  
  const clearError = () => {
    error.value = null
    errorMessage.value = null
  }
  
  const tryInitializeApp = async () => {
    // Check if we're already authenticated
    if (isAuthenticated.value && !loading.value) {
      logger.log('✅ Already authenticated, skipping initialization')
      return user.value
    }
    
    const existingToken = localStorage.getItem('jwt_token')
    if (!existingToken) {
      throw new Error('No authentication token found')
    }
    
    loading.value = true
    error.value = null
    
    try {
      // Only fetch user if we don't have valid user data
      if (!user.value) {
        await fetchCurrentUser()
      }
      
      await connectWebSocket()
      
      if (user.value) {
        username.value = user.value.login || null
        await initializeApp()
      }
      
      return user.value
    } catch (err) {
      logger.error('Authentication initialization failed:', err)
      // Token is invalid, clear it
      logout()
      error.value = err instanceof Error ? err.message : 'Authentication failed'
      errorMessage.value = error.value
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const initializeApp = async () => {
    if (!isAuthenticated.value) {
      throw new Error('User not authenticated')
    }

    // Prevent multiple initializations
    if (isAppInitialized.value || isInitializing.value) {
      logger.log('⚠️ App already initialized or initializing, skipping...')
      return
    }

    isInitializing.value = true

    try {
      // Set up WebSocket stats subscription
      setupStatsSubscription()

      // Subscribe to WebSocket stats (every 5 seconds)
      socketService.subscribeToStats(5)

      // Re-initialize theme system with user preferences
      // Note: This will be called from App.vue for logged-in users

      isAppInitialized.value = true
      logger.log('✅ Auth store app initialization complete')

    } catch (err) {
      logger.error('Failed to initialize app:', err)
      throw err
    } finally {
      isInitializing.value = false
    }
  }
  
  const setupStatsSubscription = () => {
    // Clean up existing listener
    if (statsListener.value) {
      window.removeEventListener('stats:data', statsListener.value)
    }
    
    // Create new listener
    statsListener.value = (event: Event) => {
      const customEvent = event as CustomEvent
      const statsData = customEvent.detail
      
      // Transform backend stats format to frontend AppStats format
      if (statsData) {
        stats.value = {
          system: {
            cpu: statsData.cpu_usage || 0,
            memory: statsData.memory_percentage || 0,
            disk: statsData.disk_percentage || 0,
            uptime: statsData.uptime_seconds || 0,
          },
          sessions: {
            active: statsData.active_sessions || 0,
            total: statsData.active_sessions || 0, // Using active as total for now
          },
          workspaces: {
            count: 0, // This would need to be added to backend stats if needed
          }
        }
      }
    }
    
    if (socketService) {
      socketService.subscribe('stats:data', (event) => {
        if (statsListener.value) {
          statsListener.value({ detail: event } as CustomEvent<unknown>)
        }
      })

      socketService.subscribe('websocket:auth_error', (error) => {
        logger.warn('WebSocket authentication error received:', error)

        if (error.code === 'JWT_EXPIRED' || error.code === 'JWT_INVALID') {
          logger.log('JWT token is invalid, logging out')
          logout()
        }
      })

      socketService.subscribe('websocket:reconnection_failed', (event) => {
        logger.warn('WebSocket reconnection failed, redirecting to login:', event)
        logout()
        // Navigate to login using window.location to avoid router dependency
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      })

      // Handle WebSocket connection errors
      socketService.connectionState$.subscribe((state) => {
        if (state === ConnectionState.ERROR) {
          logger.warn('WebSocket connection failed, checking authentication')
          // Don't immediately logout, let the user retry
        }
      })
    }
  }

  // Keep loadStats for backward compatibility but make it a no-op
  const loadStats = async () => {
    // This function is kept for compatibility but stats now come via WebSocket
    logger.debug('loadStats called - stats now streamed via WebSocket')
  }

  return {
    // Original state
    user: readonly(user),
    token: readonly(token),
    loading: readonly(loading),
    isAuthenticated,

    // Enhanced state
    error: readonly(error),
    username: readonly(username),
    errorMessage: readonly(errorMessage),
    stats: readonly(stats),
    subscription: readonly(subscription),
    isAppInitialized: readonly(isAppInitialized),
    isInitializing: readonly(isInitializing),
    isFetchingUser: readonly(isFetchingUser),

    // Computed
    hasStats,
    systemLoad,

    // Original actions
    initializeAuth,
    checkAuthStatus,
    setAuthData,
    setToken,
    fetchCurrentUser,
    connectWebSocket,
    logout,
    getGitHubAuthUrl,

    // SSO actions
    getSsoAuthUrl,
    startDeviceFlow,
    pollDeviceToken,
    fetchSubscription,

    // Enhanced actions
    clearError,
    tryInitializeApp,
    initializeApp,
    loadStats,
  }
})