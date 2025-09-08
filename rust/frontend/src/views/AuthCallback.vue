<template>
  <div class="auth-callback-container">
    <div class="callback-card">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <h2>Completing Authentication...</h2>
        <p>Please wait while we log you in.</p>
      </div>
      
      <div v-else-if="error" class="error-state">
        <div class="error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <h2>Authentication Failed</h2>
        <p>{{ error }}</p>
        <button @click="goToLogin" class="btn btn-primary">
          Try Again
        </button>
      </div>
      
      <div v-else class="success-state">
        <div class="success-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22,4 12,14.01 9,11.01"></polyline>
          </svg>
        </div>
        <h2>Authentication Successful</h2>
        <p>Redirecting to dashboard...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref<string>('')

const goToLogin = () => {
  router.push('/login')
}

onMounted(async () => {
  try {
    // Get GitHub OAuth callback parameters
    const code = route.query.code as string
    const state = route.query.state as string
    const errorParam = route.query.error as string

    if (errorParam) {
      throw new Error('Authentication was cancelled or failed')
    }

    if (!code) {
      throw new Error('Invalid authentication response: missing authorization code')
    }

    // Validate state parameter for security
    if (state) {
      const storedState = localStorage.getItem('oauth_state')
      if (!storedState || storedState !== state) {
        throw new Error('Invalid state parameter')
      }
      localStorage.removeItem('oauth_state')
    }

    // Send code and state to backend to exchange for token
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
    const url = state 
      ? `${apiBaseUrl}/api/v1/auth/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      : `${apiBaseUrl}/api/v1/auth/github/callback?code=${encodeURIComponent(code)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to exchange authentication code')
    }

    const data = await response.json()
    
    if (!data.success || !data.access_token) {
      throw new Error(data.message || 'No access token received from server')
    }

    // Set token in auth store
    await authStore.setToken(data.access_token)

    // Store user info if available
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user))
    }

    // Short delay for better UX
    setTimeout(() => {
      loading.value = false
      // Redirect to dashboard after a brief success message
      setTimeout(() => {
        router.push('/dashboard')
      }, 1000)
    }, 500)
    
  } catch (err) {
    loading.value = false
    error.value = err instanceof Error ? err.message : 'An unexpected error occurred'
  }
})
</script>

<style scoped>
.auth-callback-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: 20px;
}

.callback-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 48px 40px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 8px 32px var(--shadow);
}

.loading-state,
.error-state,
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  color: var(--error);
}

.success-icon {
  color: var(--success);
}

.callback-card h2 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.callback-card p {
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.5;
  margin: 0;
}

.error-state p {
  color: var(--error);
}

.btn {
  margin-top: 8px;
}

@media (max-width: 480px) {
  .callback-card {
    padding: 32px 24px;
    margin: 0 16px;
  }
  
  .callback-card h2 {
    font-size: 20px;
  }
  
  .callback-card p {
    font-size: 14px;
  }
}
</style>