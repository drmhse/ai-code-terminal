<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="login-container">
    <div class="login-card">
      <h1>AI Code Terminal</h1>
      <p>Self-hosted development environment with god-mode terminal access</p>
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      <a :href="githubAuthUrl" class="btn-github">
        <ArrowRightIcon class="btn-github-icon" />
        Login with GitHub
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { ArrowRightIcon } from '@heroicons/vue/24/outline'

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

.btn-github {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  height: var(--button-height-base); /* Fix: Add explicit height */
  padding: 0 var(--space-6); /* Fix: Remove vertical padding since height is set */
  background: var(--color-interactive-primary);
  color: white;
  border: none;
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: var(--transition-base);
  cursor: pointer;
  box-sizing: border-box; /* Ensure consistent box model */
}

.btn-github:hover {
  background: var(--color-interactive-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-github-icon {
  width: 1rem;   /* 16px - fits well in 40px button */
  height: 1rem;  /* 16px - maintains aspect ratio */
  flex-shrink: 0; /* Prevent icon from shrinking */
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