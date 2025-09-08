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
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import Sidebar from './Sidebar.vue'
import TerminalPanel from './TerminalPanel.vue'

const uiStore = useUIStore()
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

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
}
</style>