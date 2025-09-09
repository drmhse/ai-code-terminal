import { defineStore } from 'pinia'
import { ref, computed, readonly, onMounted, onUnmounted } from 'vue'
import type { User } from '@/types'
import { apiService } from '@/services/api'
import { socketService } from '@/services/socket'

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


export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // Enhanced authentication state from original app
  const username = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)
  
  // System stats
  const stats = ref<AppStats | null>(null)
  const statsListener = ref<((event: Event) => void) | null>(null)

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
        console.error('Failed to parse stored user:', error)
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
    if (!token.value) return

    loading.value = true
    try {
      const userData = await apiService.getCurrentUser()
      user.value = userData
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      logout()
    } finally {
      loading.value = false
    }
  }

  const connectWebSocket = async () => {
    if (!isAuthenticated.value) return

    try {
      await socketService.connect()
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    username.value = null
    error.value = null
    errorMessage.value = null
    
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
    // Frontend generates GitHub OAuth URL with redirect to frontend callback
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
    const redirectUri = `${window.location.origin}/auth/callback`
    const state = crypto.randomUUID()
    localStorage.setItem('oauth_state', state)
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email repo read:org&state=${state}`
  }

  const checkAuthStatus = async () => {
    // Initialize from localStorage first
    initializeAuth()
    
    // If we have a token, validate it and establish connections
    if (token.value && user.value) {
      try {
        // Validate token by fetching current user
        await fetchCurrentUser()
        await connectWebSocket()
        
        // Initialize app after successful authentication
        if (user.value) {
          username.value = user.value.login || null
          await initializeApp()
        }
      } catch (error) {
        console.error('Auth validation failed on reload:', error)
        // Token is invalid, clear it
        logout()
      }
    }
  }

  const setToken = async (authToken: string) => {
    token.value = authToken
    localStorage.setItem('jwt_token', authToken)
    await fetchCurrentUser()
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
    const existingToken = localStorage.getItem('jwt_token')
    if (!existingToken) {
      throw new Error('No authentication token found')
    }
    
    loading.value = true
    error.value = null
    
    try {
      await fetchCurrentUser()
      await connectWebSocket()
      
      if (user.value) {
        username.value = user.value.login || null
        await initializeApp()
      }
      
      return user.value
    } catch (err) {
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
    
    try {
      // Set up WebSocket stats subscription
      setupStatsSubscription()
      
      // Subscribe to WebSocket stats (every 5 seconds)
      socketService.subscribeToStats(5)
      
    } catch (err) {
      console.error('Failed to initialize app:', err)
      throw err
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
    
    // Register listener for WebSocket stats events
    window.addEventListener('stats:data', statsListener.value)
    
    // Also listen for WebSocket auth errors
    window.addEventListener('websocket:auth_error', (event: Event) => {
      const customEvent = event as CustomEvent
      const error = customEvent.detail
      console.warn('WebSocket authentication error received:', error)
      
      // Only logout if JWT is actually invalid/expired
      if (error.code === 'JWT_EXPIRED' || error.code === 'JWT_INVALID') {
        console.log('JWT token is invalid, logging out')
        logout()
      }
    })
  }

  // Keep loadStats for backward compatibility but make it a no-op
  const loadStats = async () => {
    // This function is kept for compatibility but stats now come via WebSocket
    console.debug('loadStats called - stats now streamed via WebSocket')
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
    
    // Enhanced actions
    clearError,
    tryInitializeApp,
    initializeApp,
    loadStats,
  }
})