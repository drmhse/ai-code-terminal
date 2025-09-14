<template>
  <div class="app-layout">
    <!-- Top Navigation Bar -->
    <TopNavBar />

    <!-- Main Content Area -->
    <div class="main-area">
      <!-- Left Sidebar -->
      <Sidebar />

      <!-- Terminal Panes (Full Width) -->
      <div class="terminal-area">
        <TerminalPanes />
      </div>
    </div>

    <!-- Bottom Status Bar -->
    <BottomStatusBar />

    <!-- Background Tasks Drawer/Modal -->
    <BackgroundTasksDrawer
      v-if="showBackgroundTasksDrawer"
      @close="closeBackgroundTasks"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import TopNavBar from './layout/TopNavBar.vue'
import Sidebar from './layout/Sidebar.vue'
import TerminalPanes from './layout/TerminalPanes.vue'
import BottomStatusBar from './layout/BottomStatusBar.vue'
import BackgroundTasksDrawer from './layout/BackgroundTasksDrawer.vue'

const uiStore = useUIStore()
const workspaceStore = useWorkspaceStore()

// Background tasks drawer visibility
const showBackgroundTasksDrawer = computed(() => uiStore.showBackgroundTasks)

const closeBackgroundTasks = () => {
  uiStore.setShowBackgroundTasks(false)
}
</script>

<style scoped>
.app-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
  width: 100%;
  background: var(--bg-primary);
  overflow: hidden;
  font-family: var(--font-family);
  color: var(--text-primary);
}

.main-area {
  display: grid;
  grid-template-columns: auto 1fr;
  overflow: hidden;
  min-height: 0;
}

.terminal-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  min-height: 0;
}

/* Mobile: stack vertically, sidebar becomes overlay */
@media (max-width: 768px) {
  .main-area {
    grid-template-columns: 1fr;
    position: relative;
  }
}
</style>