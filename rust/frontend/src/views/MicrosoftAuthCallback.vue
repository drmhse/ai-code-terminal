<template>
  <div class="microsoft-auth-callback">
    <div class="callback-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Connecting to Microsoft...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <div class="error-icon">⚠️</div>
        <h2>Authentication Failed</h2>
        <p>{{ error }}</p>
        <button @click="handleRetry" class="retry-button">
          Try Again
        </button>
      </div>

      <div v-else class="success-state">
        <div class="success-icon">✅</div>
        <h2>Microsoft Connected!</h2>
        <p>Successfully connected to Microsoft To Do.</p>
        <button @click="redirectToDashboard" class="continue-button">
          Continue to Dashboard
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { microsoftAuthService } from '@/services/microsoft-auth'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    // Extract parameters from URL
    const code = route.query.code as string
    const state = route.query.state as string
    const errorParam = route.query.error as string
    const errorDescription = route.query.error_description as string

    if (errorParam) {
      error.value = errorDescription || `OAuth error: ${errorParam}`
      loading.value = false

      // If we're in a popup window, notify parent of error
      if (window.opener) {
        window.opener.postMessage({
          type: 'MICROSOFT_AUTH_ERROR',
          error: error.value
        }, window.location.origin)
        // Don't close on error, let user see the error and retry
      }
      return
    }

    if (!code || !state) {
      error.value = 'Missing authorization code or state parameter'
      loading.value = false

      // If we're in a popup window, notify parent of error
      if (window.opener) {
        window.opener.postMessage({
          type: 'MICROSOFT_AUTH_ERROR',
          error: error.value
        }, window.location.origin)
        // Don't close on error, let user see the error and retry
      }
      return
    }

    // Call backend to handle the OAuth callback
    await microsoftAuthService.handleOAuthCallback(code, state, errorParam, errorDescription)

    loading.value = false

    // If we're in a popup window, notify parent and close
    if (window.opener) {
      console.log('🔄 Notifying parent window of Microsoft auth success')
      window.opener.postMessage({ type: 'MICROSOFT_AUTH_SUCCESS' }, window.location.origin)
      // Wait a bit longer to ensure parent receives and processes the message
      setTimeout(() => {
        console.log('🔄 Closing popup window')
        window.close()
      }, 1500)
      return
    }

    // Redirect to dashboard after a short delay (fallback for non-popup)
    setTimeout(() => {
      redirectToDashboard()
    }, 2000)

  } catch (err: unknown) {
    console.error('Microsoft OAuth callback error:', err)
    let errorMessage = 'Failed to connect to Microsoft'

    if (err && typeof err === 'object') {
      const errorObj = err as Record<string, unknown>
      if (errorObj.response && typeof errorObj.response === 'object') {
        const response = errorObj.response as Record<string, unknown>
        if (response.data && typeof response.data === 'object') {
          const data = response.data as Record<string, unknown>
          if (typeof data.message === 'string') {
            errorMessage = data.message
          }
        }
      }
    } else if (typeof err === 'string') {
      errorMessage = err
    }

    error.value = errorMessage
    loading.value = false

    // If we're in a popup window, notify parent of error
    if (window.opener) {
      window.opener.postMessage({
        type: 'MICROSOFT_AUTH_ERROR',
        error: error.value
      }, window.location.origin)
      // Don't close on error, let user see the error and retry
    }
  }
})

const handleRetry = () => {
  // If we're in a popup window, close it
  if (window.opener) {
    window.close()
    return
  }
  router.push('/dashboard')
}

const redirectToDashboard = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.microsoft-auth-callback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--color-bg-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.callback-container {
  background: var(--color-bg-secondary);
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 90%;
}

.loading-state, .error-state, .success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border-secondary);
  border-top: 4px solid var(--color-interactive-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon, .success-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.5rem;
}

p {
  margin: 0.5rem 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.retry-button, .continue-button {
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 1rem;
}

.retry-button:hover, .continue-button:hover {
  background: var(--color-interactive-primary-hover);
}

.error-state .retry-button {
  background: var(--color-semantic-error);
}

.error-state .retry-button:hover {
  background: var(--color-semantic-error);
  opacity: 0.9;
}
</style>