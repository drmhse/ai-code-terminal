<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { useTheme } from './composables/useTheme'

const authStore = useAuthStore()
const { initialize: initializeTheme, reinitializeForUser } = useTheme()

onMounted(async () => {
  // First initialize auth
  await authStore.checkAuthStatus()

  // Then initialize theme system (will load user's saved theme if authenticated)
  try {
    await initializeTheme(authStore.isAuthenticated)
  } catch (error) {
    console.warn('Theme initialization failed, using default theme:', error)
  }
})

// Watch for authentication status changes to reinitialize theme with user preferences
watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated, wasAuthenticated) => {
    // If user just logged in, reinitialize theme to load their preferences
    if (isAuthenticated && !wasAuthenticated) {
      try {
        console.log('🔄 User authenticated, reinitializing theme with user preferences')
        await reinitializeForUser()
      } catch (error) {
        console.warn('Failed to load user theme preferences:', error)
      }
    }
  }
)
</script>

<style scoped>
/* No global styles here - everything is self-contained in components */
</style>