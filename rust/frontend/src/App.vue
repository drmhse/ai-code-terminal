<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

onMounted(async () => {
  await authStore.checkAuthStatus()
})
</script>

<style scoped>
/* No global styles here - everything is self-contained in components */
</style>