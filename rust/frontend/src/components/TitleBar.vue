<template>
  <div class="title-bar">
    <button v-if="isMobile" @click="toggleSidebar" class="mobile-toggle">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>
    <h1>AI Code Terminal</h1>
    <div class="controls">
      <button @click="showThemeModal = true" class="theme-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <span v-if="!isMobile">{{ currentTheme.name || 'Dark' }}</span>
      </button>
      <div class="user-info">{{ authStore.user?.login || 'Developer' }}</div>
      <button @click="logout" class="logout-button" title="Logout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 21 1-7-1-7h1c2.5 0 5-1.5 7-4.5V21l-7-2.5"></path>
          <path d="M9 9h7l-3-3m3 3l-3 3"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const showThemeModal = ref(false)
const currentTheme = ref({ name: 'Dark' })

// Mobile detection - basic implementation
const isMobile = computed(() => {
  return window.innerWidth < 768
})

const toggleSidebar = () => {
  // Emit event or use global state for sidebar toggle
  console.log('Toggle sidebar')
}

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  min-height: 48px;
  flex-shrink: 0;
}

.mobile-toggle {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 4px;
  margin-right: 12px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.mobile-toggle:hover {
  background: var(--bg-tertiary);
}

.title-bar h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  flex: 1;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s ease;
}

.theme-button:hover {
  background: var(--button-hover);
}

.user-info {
  color: var(--text-secondary);
  font-size: 13px;
  padding: 6px 10px;
}

.logout-button {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.logout-button:hover {
  background: var(--bg-tertiary);
  color: var(--error);
}

@media (max-width: 768px) {
  .title-bar {
    padding: 8px 12px;
  }
  
  .title-bar h1 {
    font-size: 14px;
  }
  
  .user-info {
    display: none;
  }
}
</style>