<template>
  <div class="app-layout">
    <!-- Top Navigation Bar -->
    <TopNavBar />

    <!-- Main Content Area -->
    <div class="main-area">
      <!-- Left Sidebar -->
      <Sidebar />

      <!-- Content Area (Terminal + Editor) -->
      <div class="content-area">
        <!-- Terminal Panes -->
        <div class="terminal-area" :class="{ 'with-editor': showEditor }">
          <TerminalPanes />
        </div>

        <!-- File Editor (Docked) -->
        <FileEditor v-if="showEditor" :docked="true" class="docked-editor" />
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
import { useFileStore } from '@/stores/file'
import TopNavBar from './layout/TopNavBar.vue'
import Sidebar from './layout/Sidebar.vue'
import TerminalPanes from './layout/TerminalPanes-tree.vue'
import BottomStatusBar from './layout/BottomStatusBar.vue'
import BackgroundTasksDrawer from './layout/BackgroundTasksDrawer.vue'
import FileEditor from './FileEditor.vue'

const uiStore = useUIStore()
const workspaceStore = useWorkspaceStore()
const fileStore = useFileStore()

// Background tasks drawer visibility
const showBackgroundTasksDrawer = computed(() => uiStore.showBackgroundTasks)

// Show editor when files are open
const showEditor = computed(() => fileStore.showEditor)

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

.content-area {
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.terminal-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  min-height: 0;
  flex: 1;
  transition: flex 0.3s ease;
}

.terminal-area.with-editor {
  flex: 0.6; /* 60% of space when editor is open */
}

.docked-editor {
  flex: 0.4; /* 40% of space for editor */
  min-width: 400px;
  max-width: 60%;
  border-left: 1px solid var(--border-color);
}

/* Mobile: stack vertically, sidebar becomes overlay */
@media (max-width: 768px) {
  .main-area {
    grid-template-columns: 1fr;
    position: relative;
  }

  .content-area {
    flex-direction: column;
  }

  .terminal-area.with-editor {
    flex: 0.5;
  }

  .docked-editor {
    flex: 0.5;
    min-width: auto;
    max-width: none;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }
}
</style>