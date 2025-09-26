<template>
  <div class="app-layout">
    <!-- Top Navigation Bar -->
    <TopNavBar />

    <!-- Main Content Area - Dynamic grid with draggable splitters -->
    <div
      class="main-area"
      :style="{ gridTemplateColumns: dynamicGridColumns }"
      :class="{ 'with-editor': showEditor }"
    >
      <!-- Left Sidebar -->
      <Sidebar />

      <!-- Sidebar ↔ Editor/Terminal Splitter -->
      <VerticalSplitter
        :index="0"
        @resize="handleSidebarResize"
        class="sidebar-splitter"
      />

      <!-- File Editor (Adjacent to Sidebar) -->
      <FileEditor v-if="showEditor" :docked="true" class="adjacent-editor" />

      <!-- Editor ↔ Terminal Splitter (only when editor is visible) -->
      <VerticalSplitter
        v-if="showEditor"
        :index="1"
        @resize="handleEditorResize"
        class="editor-splitter"
      />

      <!-- Terminal Panes Area -->
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
import { computed, onMounted, watch } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useFileStore } from '@/stores/file'
import { useAuthStore } from '@/stores/auth'
import { useLayoutPreferences } from '@/composables/useLayoutPreferences'
import TopNavBar from './layout/TopNavBar.vue'
import Sidebar from './layout/Sidebar.vue'
import TerminalPanes from './layout/TerminalPanes-tree.vue'
import BottomStatusBar from './layout/BottomStatusBar.vue'
import BackgroundTasksDrawer from './layout/BackgroundTasksDrawer.vue'
import FileEditor from './FileEditor.vue'
import VerticalSplitter from './layout/VerticalSplitter.vue'

const uiStore = useUIStore()
const fileStore = useFileStore()
const authStore = useAuthStore()
const layoutPrefs = useLayoutPreferences()

// Background tasks drawer visibility
const showBackgroundTasksDrawer = computed(() => uiStore.showBackgroundTasks)

// Show editor when files are open
const showEditor = computed(() => fileStore.showEditor)

// Dynamic grid columns based on layout preferences and editor state
const dynamicGridColumns = computed(() => {
  if (!showEditor.value) {
    // Two-column layout: Sidebar + Splitter + Terminal
    return `${layoutPrefs.sidebarWidth.value}px 4px 1fr`
  }

  // Three-column layout: Sidebar + Splitter + Editor + Splitter + Terminal
  return `${layoutPrefs.sidebarWidth.value}px 4px ${layoutPrefs.editorWidth.value}px 4px 1fr`
})

// Resize handlers with constraints
const handleSidebarResize = async ({ delta }: { index: number, delta: number }) => {
  await layoutPrefs.updateSidebarWidth(layoutPrefs.sidebarWidth.value + delta)
}

const handleEditorResize = async ({ delta }: { index: number, delta: number }) => {
  await layoutPrefs.updateEditorWidth(layoutPrefs.editorWidth.value + delta)
}

const closeBackgroundTasks = () => {
  uiStore.setShowBackgroundTasks(false)
}

// Initialize layout preferences
onMounted(async () => {
  await layoutPrefs.initialize(authStore.isAuthenticated)
})

// Watch for authentication status changes to reinitialize with user preferences
watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated, wasAuthenticated) => {
    // If user just logged in, reinitialize layout with their backend preferences
    if (isAuthenticated && !wasAuthenticated) {
      await layoutPrefs.reinitializeForUser()
    }
    // If user logged out, we keep localStorage preferences but don't sync to backend
  }
)
</script>

<style scoped>
.app-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
  width: 100%;
  background: var(--color-bg-primary);
  overflow: hidden;
  font-family: var(--font-family-sans);
  color: var(--color-text-primary);
}

.main-area {
  display: grid;
  /* Dynamic grid columns are set via :style binding */
  overflow: hidden;
  min-height: 0;
  transition: grid-template-columns 0.2s ease;
  align-items: stretch; /* Ensure all grid items stretch to full height */
}

.terminal-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-primary);
  min-height: 0;
  width: 100%;
  height: 100%;
}

.adjacent-editor {
  width: 100%;
  height: 100%;
  min-width: 0; /* Allow shrinking */
  overflow: hidden;
  /* Borders handled by splitters now */
}

/* Splitter-specific styling */
.sidebar-splitter,
.editor-splitter {
  /* Additional styling for specific splitters if needed */
  background: var(--color-border-primary);
}

/* Mobile: disable splitters, use stacked layout */
@media (max-width: 768px) {
  .main-area {
    /* Override dynamic grid for mobile - single column with rows */
    grid-template-columns: 1fr !important;
    grid-template-rows: 0.6fr 0.4fr;
    position: relative;
  }

  /* Hide splitters on mobile */
  .sidebar-splitter,
  .editor-splitter {
    display: none !important;
  }

  .adjacent-editor {
    /* Stack editor below terminal on mobile */
    grid-row: 2;
    border-top: 1px solid var(--color-border-primary);
  }

  .terminal-area {
    /* Terminal takes first row */
    grid-row: 1;
  }
}

/* Tablet: ensure minimum constraints are respected */
@media (max-width: 1024px) and (min-width: 769px) {
  /* Tablet-specific adjustments handled by constraints in the composable */
}
</style>