<template>
  <div class="auth-callback-container">
    <div class="callback-card">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <h2>{{ loadingMessage }}</h2>
        <p>{{ loadingSubtext }}</p>
      </div>

      <div v-else-if="error" class="error-state">
        <div class="error-icon">
          <XCircleIcon class="icon-2xl" />
        </div>
        <h2>Authentication Failed</h2>
        <p>{{ error }}</p>
        <router-link to="/login" class="btn btn-primary">
          Try Again
        </router-link>
      </div>

      <div v-else class="success-state">
        <div class="success-icon">
          <CheckCircleIcon class="icon-2xl" />
        </div>
        <h2>{{ successMessage }}</h2>
        <p>Redirecting to dashboard...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { XCircleIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref<string>('')
const loadingMessage = ref('Completing Authentication...')
const loadingSubtext = ref('Please wait while we log you in.')
const successMessage = ref('Authentication Successful')

/**
 * OAuth Callback Handler
 *
 * This component handles callbacks from the SSO service for both:
 * 1. Initial sign-in: Receives JWT tokens and establishes session
 * 2. Identity linking: Confirms provider account has been linked
 *
 * Query Parameters:
 * - Sign-in flow:
 *   ?access_token=xxx&refresh_token=xxx
 * - Linking flow:
 *   ?status=success&provider=microsoft&action=link
 * - Error flow:
 *   ?error={message}[&action=link]
 */
onMounted(async () => {
  try {
    const accessToken = route.query.access_token as string
    const refreshToken = route.query.refresh_token as string
    const errorParam = route.query.error as string
    const action = route.query.action as string
    const status = route.query.status as string
    const provider = route.query.provider as string

    // Check if this is an error response
    if (errorParam) {
      throw new Error(errorParam || 'Authentication was cancelled or failed')
    }

    // Check if this is an identity linking callback
    if (action === 'link' && status === 'success') {
      // Identity linking completed successfully
      loadingMessage.value = 'Account Linked Successfully'
      loadingSubtext.value = `Your ${provider} account has been connected.`
      successMessage.value = `${provider.charAt(0).toUpperCase() + provider.slice(1)} Account Linked`
      loading.value = false
      setTimeout(() => {
        // TODO: Show success notification/toast
        console.log(`Successfully linked ${provider} account`)
        router.push('/dashboard')
      }, 1500)
      return
    }

    // Otherwise, this is a normal sign-in flow
    if (!accessToken || !refreshToken) {
      throw new Error('No tokens received from authentication server')
    }

    await authStore.setToken(accessToken, refreshToken)

    setTimeout(() => {
      loading.value = false
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-interactive-primary);
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: var(--transition-base);
  margin-top: 8px;
  cursor: pointer;
}

.btn:hover {
  background: var(--color-interactive-primary-hover);
  border-color: var(--color-interactive-primary-hover);
}

.btn-primary {
  background: var(--color-interactive-primary);
  border-color: var(--color-interactive-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover {
  background: var(--color-interactive-primary-hover);
  border-color: var(--color-interactive-primary-hover);
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