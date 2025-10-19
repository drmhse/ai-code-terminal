<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="login-container">
    <div class="login-card">
      <h1>AI Code Terminal</h1>
      <p>Self-hosted development environment with god-mode terminal access</p>
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <!-- SSO Provider Buttons -->
      <div class="provider-buttons">
        <button @click="loginWithProvider('github')" class="btn-provider btn-github" :disabled="isLoggingIn">
          <ArrowRightIcon class="provider-icon" />
          <span>Continue with GitHub</span>
        </button>

        <button @click="loginWithProvider('microsoft')" class="btn-provider btn-microsoft" :disabled="isLoggingIn">
          <ArrowRightIcon class="provider-icon" />
          <span>Continue with Microsoft</span>
        </button>

        <button @click="loginWithProvider('google')" class="btn-provider btn-google" :disabled="isLoggingIn">
          <ArrowRightIcon class="provider-icon" />
          <span>Continue with Google</span>
        </button>
      </div>

      <!-- Device Flow for Desktop App -->
      <div v-if="isTauriApp" class="device-flow">
        <div class="divider">
          <span>OR</span>
        </div>
        <button @click="startDeviceAuth" class="btn-device" :disabled="isLoggingIn">
          Use Device Code
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ArrowRightIcon } from '@heroicons/vue/24/outline'
import { isDesktopApp } from '@/utils/backendPort'

const errorMessage = ref<string>('')
const isLoggingIn = ref(false)
const authStore = useAuthStore()
const router = useRouter()
const isTauriApp = ref(isDesktopApp())

// Check for error messages in URL params (redirected from failed auth)
const urlParams = new URLSearchParams(window.location.search)
if (urlParams.get('error')) {
  errorMessage.value = 'Authentication failed. Please try again.'
}

const loginWithProvider = (provider: 'github' | 'microsoft' | 'google') => {
  if (isLoggingIn.value) return
  isLoggingIn.value = true

  const authUrl = authStore.getLoginUrl(provider)
  console.log(`[Login] Starting SSO OAuth with ${provider}`)
  window.location.href = authUrl
}

const startDeviceAuth = async () => {
  if (isLoggingIn.value) return
  isLoggingIn.value = true

  try {
    const response = await authStore.startDeviceFlow()

    // Navigate to device activation view
    router.push({
      name: 'device-activate',
      query: {
        device_code: response.device_code,
        user_code: response.user_code,
        verification_uri: response.verification_uri
      }
    })
  } catch (error) {
    console.error('Failed to start device flow:', error)
    errorMessage.value = 'Failed to start device authentication. Please try again.'
    isLoggingIn.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  padding: var(--space-5);
}

.login-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-12) var(--space-10);
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-xl);
}

.login-card h1 {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
  color: var(--color-text-primary);
  letter-spacing: -0.5px;
}

.login-card p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  margin-bottom: var(--space-8);
}

.provider-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

.btn-provider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  height: var(--button-height-base);
  padding: 0 var(--space-6);
  border: none;
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: var(--transition-base);
  cursor: pointer;
  box-sizing: border-box;
}

.btn-github {
  background: #24292e;
  color: white;
}

.btn-github:hover {
  background: #1a1e22;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-microsoft {
  background: #0078d4;
  color: white;
}

.btn-microsoft:hover {
  background: #006cc1;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-google {
  background: white;
  color: #3c4043;
  border: 1px solid #dadce0;
}

.btn-google:hover {
  background: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.provider-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.device-flow {
  margin-top: var(--space-6);
}

.divider {
  position: relative;
  text-align: center;
  margin: var(--space-4) 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--color-border-primary);
}

.divider span {
  position: relative;
  background: var(--color-bg-secondary);
  padding: 0 var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.btn-device {
  width: 100%;
  height: var(--button-height-base);
  padding: 0 var(--space-6);
  background: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: var(--transition-base);
}

.btn-device:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-interactive-primary);
}

.error-message {
  margin-bottom: var(--space-6);
  padding: var(--space-3);
  background: var(--color-semantic-error-bg);
  border: 1px solid var(--color-semantic-error-border);
  border-radius: var(--radius-base);
  color: var(--color-semantic-error);
  font-size: var(--font-size-sm);
  text-align: left;
}

@media (max-width: 480px) {
  .login-card {
    padding: var(--space-8) var(--space-6);
    margin: 0 var(--space-4);
  }

  .login-card h1 {
    font-size: var(--font-size-3xl);
  }

  .login-card p {
    font-size: var(--font-size-sm);
  }
}
</style>