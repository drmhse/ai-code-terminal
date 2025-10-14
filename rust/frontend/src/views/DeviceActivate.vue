<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="device-activate-container">
    <div class="activate-card">
      <h1>Device Activation</h1>
      <p>To complete authentication, enter this code on your device:</p>

      <div class="user-code-display">
        <div class="user-code">{{ userCode }}</div>
        <button @click="copyUserCode" class="btn-copy" :class="{ copied: isCopied }">
          {{ isCopied ? 'Copied!' : 'Copy Code' }}
        </button>
      </div>

      <div class="verification-url">
        <p>Or visit:</p>
        <a :href="verificationUrl" target="_blank" class="verification-link">
          {{ verificationUrl }}
        </a>
      </div>

      <div class="polling-status" :class="statusClass">
        <div class="status-icon">
          <LoadingIcon v-if="isPolling" class="spin" />
          <CheckIcon v-else-if="isSuccess" />
          <ExclamationIcon v-else-if="isError" />
        </div>
        <p>{{ pollingMessage }}</p>
      </div>

      <div class="actions">
        <button @click="cancelActivation" class="btn-cancel">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  ArrowPathIcon as LoadingIcon,
  CheckIcon,
  ExclamationTriangleIcon as ExclamationIcon
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const deviceCode = ref(route.query.device_code as string)
const userCode = ref(route.query.user_code as string)
const verificationUrl = ref(route.query.verification_uri as string || 'http://localhost:3000/activate')
const pollingMessage = ref('Waiting for authorization...')
const isPolling = ref(true)
const isSuccess = ref(false)
const isError = ref(false)
const isCopied = ref(false)

let pollInterval: number | null = null

const statusClass = computed(() => {
  if (isSuccess.value) return 'status-success'
  if (isError.value) return 'status-error'
  return 'status-polling'
})

const copyUserCode = async () => {
  try {
    await navigator.clipboard.writeText(userCode.value)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const cancelActivation = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
  router.push('/login')
}

onMounted(() => {
  // Validate required params
  if (!deviceCode.value || !userCode.value) {
    pollingMessage.value = 'Invalid device code. Please try again.'
    isError.value = true
    isPolling.value = false
    return
  }

  // Start polling for token
  pollInterval = setInterval(async () => {
    try {
      const response = await authStore.pollDeviceToken(deviceCode.value)

      if (response.access_token) {
        pollingMessage.value = 'Authorization successful! Redirecting...'
        isPolling.value = false
        isSuccess.value = true

        if (pollInterval) {
          clearInterval(pollInterval)
        }

        // Fetch subscription and redirect
        await authStore.fetchSubscription()

        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      }
    } catch (err) {
      const errorMsg = (err as Error).message || String(err)

      if (errorMsg.includes('authorization_pending')) {
        // Still waiting - this is normal
        return
      } else if (errorMsg.includes('expired_token')) {
        pollingMessage.value = 'Code expired. Please try again.'
        isPolling.value = false
        isError.value = true
        if (pollInterval) {
          clearInterval(pollInterval)
        }
      } else {
        pollingMessage.value = 'Authentication failed. Please try again.'
        isPolling.value = false
        isError.value = true
        if (pollInterval) {
          clearInterval(pollInterval)
        }
      }
    }
  }, 5000) // Poll every 5 seconds
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script>

<style scoped>
.device-activate-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  padding: var(--space-5);
}

.activate-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-12) var(--space-10);
  max-width: 500px;
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-xl);
}

.activate-card h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
  color: var(--color-text-primary);
}

.activate-card p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  margin-bottom: var(--space-6);
}

.user-code-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: var(--space-6) 0;
}

.user-code {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  font-family: 'Courier New', monospace;
  letter-spacing: 0.3em;
  color: var(--color-interactive-primary);
  background: var(--color-bg-tertiary);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  border: 2px solid var(--color-border-primary);
}

.btn-copy {
  padding: var(--space-2) var(--space-4);
  background: var(--color-interactive-primary);
  color: white;
  border: none;
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: var(--transition-base);
}

.btn-copy:hover {
  background: var(--color-interactive-primary-hover);
}

.btn-copy.copied {
  background: var(--color-semantic-success);
}

.verification-url {
  margin: var(--space-6) 0;
  padding: var(--space-4);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-base);
}

.verification-url p {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-sm);
}

.verification-link {
  color: var(--color-interactive-primary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  word-break: break-all;
}

.verification-link:hover {
  text-decoration: underline;
}

.polling-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin: var(--space-8) 0;
  padding: var(--space-4);
  border-radius: var(--radius-base);
}

.status-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon svg {
  width: 100%;
  height: 100%;
}

.status-polling {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.status-success {
  background: var(--color-semantic-success-bg);
  color: var(--color-semantic-success);
}

.status-error {
  background: var(--color-semantic-error-bg);
  color: var(--color-semantic-error);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.actions {
  margin-top: var(--space-6);
}

.btn-cancel {
  padding: var(--space-2) var(--space-6);
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: var(--transition-base);
}

.btn-cancel:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

@media (max-width: 480px) {
  .activate-card {
    padding: var(--space-8) var(--space-6);
  }

  .user-code {
    font-size: var(--font-size-3xl);
    letter-spacing: 0.2em;
  }
}
</style>
