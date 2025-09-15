<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useTheme } from './composables/useTheme'

const authStore = useAuthStore()
const { initialize: initializeTheme } = useTheme()

onMounted(async () => {
  // First initialize auth
  await authStore.checkAuthStatus()

  // Then initialize theme system (will load user's saved theme if authenticated)
  try {
    await initializeTheme()
  } catch (error) {
    console.warn('Theme initialization failed, using default theme:', error)
  }
})
</script>

<style scoped>
/* No global styles here - everything is self-contained in components */
</style>