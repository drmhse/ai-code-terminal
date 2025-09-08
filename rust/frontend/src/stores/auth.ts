import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
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
  const statsInterval = ref<number | null>(null)

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
    
    // Stop stats polling
    if (statsInterval.value) {
      clearInterval(statsInterval.value)
      statsInterval.value = null
    }
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

  const checkAuthStatus = () => {
    initializeAuth()
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
      // Load initial stats
      await loadStats()
      
      // Start stats polling (every 5 seconds)
      if (statsInterval.value) {
        clearInterval(statsInterval.value)
      }
      
      statsInterval.value = setInterval(async () => {
        try {
          await loadStats()
        } catch (err) {
          console.error('Failed to poll stats:', err)
        }
      }, 5000)
      
    } catch (err) {
      console.error('Failed to initialize app:', err)
      throw err
    }
  }
  
  const loadStats = async () => {
    try {
      const statsData = await apiService.getSystemStats()
      stats.value = statsData
    } catch (err) {
      console.error('Failed to load stats:', err)
      // Don't throw here to avoid breaking the polling
    }
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