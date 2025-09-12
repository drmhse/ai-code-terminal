<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="login-container">
    <div class="login-card">
      <h1>AI Code Terminal</h1>
      <p>Self-hosted development environment with god-mode terminal access</p>
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      <a :href="githubAuthUrl" class="btn btn-github">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        Login with GitHub
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const errorMessage = ref<string>('')
const authStore = useAuthStore()

const githubAuthUrl = computed(() => authStore.getGitHubAuthUrl())

// Check for error messages in URL params (redirected from failed auth)
const urlParams = new URLSearchParams(window.location.search)
if (urlParams.get('error')) {
  errorMessage.value = 'Authentication failed. Please try again.'
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: 20px;
}

.login-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 48px 40px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 8px 32px var(--shadow);
}

.login-card h1 {
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.login-card p {
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.5;
  margin-bottom: 32px;
}

.btn-github {
  width: 100%;
  justify-content: center;
  font-size: 16px;
  padding: 12px 24px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-github:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.error-message {
  margin-bottom: 24px;
  text-align: left;
}

@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
    margin: 0 16px;
  }
  
  .login-card h1 {
    font-size: 28px;
  }
  
  .login-card p {
    font-size: 14px;
  }
}
</style>