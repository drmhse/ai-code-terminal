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
        <ArrowRightOnRectangleIcon class="h-5 w-5" />
        Login with GitHub
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'

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