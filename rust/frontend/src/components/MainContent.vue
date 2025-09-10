<template>
  <div class="main-content">
    <!-- Mobile overlay for sidebar -->
    <div 
      v-if="uiStore.isMobile" 
      class="mobile-overlay" 
      :class="{ active: uiStore.sidebarOpen }" 
      @click="uiStore.closeSidebar"
    ></div>

    <Sidebar />
    <TerminalPanel />
    <BackgroundTasks v-if="showBackgroundTasks" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import Sidebar from './Sidebar.vue'
import TerminalPanel from './TerminalPanel.vue'
import BackgroundTasks from './BackgroundTasks.vue'

const uiStore = useUIStore()
const workspaceStore = useWorkspaceStore()

// Only show background tasks when a workspace is selected and not on mobile
const showBackgroundTasks = computed(() => {
  return workspaceStore.selectedWorkspace && !uiStore.isMobile
})
</script>

<style scoped>
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
}

.mobile-overlay.active {
  opacity: 1;
  visibility: visible;
}

@media (min-width: 769px) {
  .main-content {
    /* Three-panel layout: Sidebar (300px) | Terminal (flex) | Background Tasks (320px) */
    display: grid;
    grid-template-columns: 300px 1fr 320px;
  }
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
}
</style>