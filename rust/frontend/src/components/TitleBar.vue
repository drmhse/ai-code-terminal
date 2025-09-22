<template>
  <div class="title-bar">
    <button v-if="isMobile" @click="toggleSidebar" class="mobile-toggle">
      <Bars3Icon class="h-4 w-4" />
    </button>
    <h1>AI Code Terminal</h1>
    <div class="controls">
      <button @click="uiStore.openThemeModal()" class="theme-button">
        <SunIcon class="h-4 w-4" />
        <span v-if="!isMobile">{{ currentTheme?.name || 'Dark' }}</span>
      </button>
      <div class="user-info">{{ authStore.user?.login || 'Developer' }}</div>
      <button @click="logout" class="logout-button" title="Logout">
        <ArrowRightOnRectangleIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import { useTheme } from '../composables/useTheme'
import { Bars3Icon, SunIcon, ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()
const { currentTheme } = useTheme()

// Mobile detection with responsive handling
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)

// Update window width on resize
onMounted(() => {
  const handleResize = () => {
    windowWidth.value = window.innerWidth
  }
  
  window.addEventListener('resize', handleResize)
  
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })
})

const toggleSidebar = () => {
  uiStore.toggleSidebar()
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
    padding: 10px 16px;
    border-radius: 0 0 12px 12px;
  }
  
  .title-bar h1 {
    font-size: 15px;
    font-weight: 700;
  }
  
  .user-info {
    display: none;
  }
  
  .controls {
    gap: 8px;
  }
  
  .theme-button {
    padding: 8px;
    border-radius: 6px;
  }
  
  .theme-button span {
    display: none;
  }
  
  .logout-button {
    padding: 8px;
  }
}
</style>