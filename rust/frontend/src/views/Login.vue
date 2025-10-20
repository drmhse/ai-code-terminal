<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="login-container">
    <div class="background-gradient"></div>
    <div class="login-card">
      <div class="logo-section">
        <div class="logo-icon">
          <CommandLineIcon class="icon" />
        </div>
        <h1>AI Code Terminal</h1>
        <p>Self-hosted development environment with god-mode terminal access</p>
      </div>

      <div v-if="errorMessage" class="error-message">
        <ExclamationCircleIcon class="error-icon" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- SSO Provider Buttons -->
      <div class="provider-buttons">
        <button @click="loginWithProvider('github')" class="btn-provider btn-github" :disabled="isLoggingIn">
          <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span>Continue with GitHub</span>
        </button>

        <button @click="loginWithProvider('microsoft')" class="btn-provider btn-microsoft" :disabled="isLoggingIn">
          <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.4 0H0v11.4h11.4V0zm12.6 0H12.6v11.4H24V0zM11.4 12.6H0V24h11.4V12.6zm12.6 0H12.6V24H24V12.6z"/>
          </svg>
          <span>Continue with Microsoft</span>
        </button>

        <button @click="loginWithProvider('google')" class="btn-provider btn-google" :disabled="isLoggingIn">
          <svg class="provider-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>

      <!-- Device Flow for Desktop App -->
      <div v-if="isTauriApp" class="device-flow">
        <div class="divider">
          <span>OR</span>
        </div>
        <button @click="startDeviceAuth" class="btn-device" :disabled="isLoggingIn">
          <DevicePhoneMobileIcon class="device-icon" />
          <span>Use Device Code</span>
        </button>
      </div>

      <div class="footer-text">
        By continuing, you agree to our Terms of Service
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { CommandLineIcon, ExclamationCircleIcon, DevicePhoneMobileIcon } from '@heroicons/vue/24/outline'
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
  position: relative;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  padding: var(--space-5);
  overflow: hidden;
}

.background-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    ellipse at top,
    rgba(56, 139, 255, 0.15) 0%,
    transparent 50%
  );
  pointer-events: none;
  z-index: 0;
}

.login-card {
  position: relative;
  z-index: 1;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-12) var(--space-10);
  max-width: 440px;
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-xl);
  backdrop-filter: blur(10px);
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.logo-section {
  margin-bottom: var(--space-8);
}

.logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin: 0 auto var(--space-4);
  background: linear-gradient(135deg, var(--color-interactive-primary), var(--color-interactive-primary-hover));
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 16px rgba(56, 139, 255, 0.25);
}

.logo-icon .icon {
  width: 2rem;
  height: 2rem;
  color: white;
}

.login-card h1 {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-3);
  color: var(--color-text-primary);
  letter-spacing: -0.5px;
}

.login-card p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  margin: 0;
  max-width: 320px;
  margin: 0 auto;
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
  gap: var(--space-3);
  width: 100%;
  height: 3rem;
  padding: 0 var(--space-6);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: all var(--transition-smooth);
  cursor: pointer;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.btn-provider:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-provider::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 100%);
  opacity: 0;
  transition: opacity var(--transition-smooth);
}

.btn-provider:hover::before {
  opacity: 1;
}

.btn-github {
  background: linear-gradient(135deg, #24292e 0%, #1a1e22 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(36, 41, 46, 0.3);
}

.btn-github:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(36, 41, 46, 0.4);
}

.btn-github:active:not(:disabled) {
  transform: translateY(0);
}

.btn-microsoft {
  background: linear-gradient(135deg, #0078d4 0%, #0063b1 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 120, 212, 0.3);
}

.btn-microsoft:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 120, 212, 0.4);
}

.btn-microsoft:active:not(:disabled) {
  transform: translateY(0);
}

.btn-google {
  background: white;
  color: #3c4043;
  border: 1px solid #dadce0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn-google:hover:not(:disabled) {
  background: #f8f9fa;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.btn-google:active:not(:disabled) {
  transform: translateY(0);
}

.provider-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.device-flow {
  margin-top: var(--space-6);
}

.divider {
  position: relative;
  text-align: center;
  margin: var(--space-6) 0 var(--space-4);
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
  padding: 0 var(--space-4);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
}

.btn-device {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  height: 2.75rem;
  padding: 0 var(--space-6);
  background: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-smooth);
}

.btn-device:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  border-color: var(--color-interactive-primary);
  color: var(--color-interactive-primary);
  transform: translateY(-1px);
}

.btn-device:active:not(:disabled) {
  transform: translateY(0);
}

.btn-device:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.device-icon {
  width: 1rem;
  height: 1rem;
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  padding: var(--space-3) var(--space-4);
  background: var(--color-semantic-error-bg);
  border: 1px solid var(--color-semantic-error-border);
  border-radius: var(--radius-lg);
  color: var(--color-semantic-error);
  font-size: var(--font-size-sm);
  text-align: left;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.error-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.footer-text {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border-primary);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

@media (max-width: 480px) {
  .login-card {
    padding: var(--space-8) var(--space-6);
    margin: 0 var(--space-4);
  }

  .logo-icon {
    width: 3.5rem;
    height: 3.5rem;
  }

  .logo-icon .icon {
    width: 1.75rem;
    height: 1.75rem;
  }

  .login-card h1 {
    font-size: var(--font-size-3xl);
  }

  .login-card p {
    font-size: var(--font-size-sm);
  }

  .btn-provider {
    height: 2.75rem;
    font-size: var(--font-size-sm);
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-card,
  .error-message,
  .btn-provider,
  .btn-device {
    animation: none;
    transition: none;
  }
}
</style>