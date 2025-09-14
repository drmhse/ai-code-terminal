<template>
  <div class="terminal-panel">
    <!-- Terminal Container (Full Space Utilization) -->
    <div
      class="terminal-container"
      :class="`layout-${terminalStore.currentLayout}`"
      :style="{
        'grid-template-columns': terminalStore.gridTemplateColumns,
        'grid-template-rows': terminalStore.gridTemplateRows
      }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <TerminalPane
        v-for="pane in terminalStore.panes"
        :key="pane.id"
        :pane="pane as any"
        :is-active="pane.id === terminalStore.activePane"
        :workspace-path="workspaceStore.selectedWorkspace?.path"
        :can-split="terminalStore.panes.length < 4"
        :show-close-button="terminalStore.panes.length > 1"
        @focus="handleTerminalFocus"
        @close="closeTerminal(pane.id)"
        @split="handleSplit"
        @data="(data: string) => handleTerminalData(pane.id, data)"
        @resize="(cols: number, rows: number) => handleTerminalResize(pane.id, cols, rows)"
        @move-tab-to-pane="handleMoveTabToPane"
      />
    </div>

    <!-- Floating Action Button for Quick Actions -->
    <div class="floating-actions">
      <button
        @click="createNewTerminal"
        class="fab fab-primary"
        title="New terminal"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useTerminalStore } from '../stores/terminal'
import { useUIStore } from '../stores/ui'
import TerminalPane from './TerminalPane.vue'
import type { LayoutType } from '../types/layout'

const workspaceStore = useWorkspaceStore()
const terminalStore = useTerminalStore()
const uiStore = useUIStore()

// Touch gesture handling for mobile
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchEndX = ref(0)
const touchEndY = ref(0)
const minSwipeDistance = 50
const maxVerticalDistance = 100

// Create new terminal session
const creatingTerminal = ref(false)

const createNewTerminal = async () => {
  if (creatingTerminal.value) return
  if (workspaceStore.selectedWorkspace) {
    creatingTerminal.value = true
    try {
      await terminalStore.createTerminal(workspaceStore.selectedWorkspace.id)
    } finally {
      creatingTerminal.value = false
    }
  }
}

// Terminal event handlers
const handleTerminalData = (paneId: string, data: string) => {
  terminalStore.sendInput(paneId, data)
}

const handleTerminalResize = (paneId: string, cols: number, rows: number) => {
  terminalStore.resizePane(paneId, cols, rows)
}

const handleTerminalFocus = (paneId: string) => {
  terminalStore.setActivePane(paneId)
}

const handleMoveTabToPane = (payload: { sourcePaneId: string, targetPaneId: string, tabId: string, targetIndex: number }) => {
  terminalStore.moveTabBetweenPanes(
    payload.sourcePaneId,
    payload.targetPaneId,
    payload.tabId,
    payload.targetIndex
  )
  terminalStore.setActivePane(payload.targetPaneId)
}

const handleSplit = async (direction: 'horizontal' | 'vertical') => {
  if (!workspaceStore.selectedWorkspace) return

  const currentLayout = terminalStore.currentLayout
  let newLayout: typeof currentLayout = currentLayout

  if (currentLayout === 'single') {
    newLayout = direction === 'horizontal' ? 'horizontal-split' : 'vertical-split'
  } else if (currentLayout === 'horizontal-split' && direction === 'vertical') {
    newLayout = 'grid-2x2'
  } else if (currentLayout === 'vertical-split' && direction === 'horizontal') {
    newLayout = 'grid-2x2'
  }

  if (newLayout !== currentLayout) {
    await terminalStore.setLayout(newLayout)
  }

  await createNewTerminal()
}

const closeTerminal = async (paneId: string) => {
  await terminalStore.closeTerminal(paneId)
}

// Touch gesture handling for mobile navigation
const handleTouchStart = (event: TouchEvent) => {
  if (!uiStore.isMobile || terminalStore.panes.length <= 1) return
  touchStartX.value = event.touches[0].clientX
  touchStartY.value = event.touches[0].clientY
}

const handleTouchMove = (event: TouchEvent) => {
  if (!uiStore.isMobile || terminalStore.panes.length <= 1) return
  touchEndX.value = event.touches[0].clientX
  touchEndY.value = event.touches[0].clientY
}

const handleTouchEnd = () => {
  if (!uiStore.isMobile || terminalStore.panes.length <= 1) return

  const deltaX = touchEndX.value - touchStartX.value
  const deltaY = Math.abs(touchEndY.value - touchStartY.value)

  if (Math.abs(deltaX) > minSwipeDistance && deltaY < maxVerticalDistance) {
    const currentIndex = terminalStore.panes.findIndex(pane => pane.id === terminalStore.activePane)
    if (currentIndex !== -1) {
      let nextIndex
      if (deltaX > 0) {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : terminalStore.panes.length - 1
      } else {
        nextIndex = currentIndex < terminalStore.panes.length - 1 ? currentIndex + 1 : 0
      }
      const nextPane = terminalStore.panes[nextIndex]
      if (nextPane) {
        terminalStore.setActivePane(nextPane.id)
      }
    }
  }
}

onMounted(() => {
  terminalStore.initialize()
})

onUnmounted(() => {
  terminalStore.cleanup()
})
</script>

<style scoped>
.terminal-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  position: relative;
}

.terminal-container {
  flex: 1;
  display: grid;
  gap: 4px;
  padding: 8px;
  overflow: hidden;
  min-height: 0;
}

.terminal-container.layout-single {
  gap: 0;
  padding: 4px;
}

.floating-actions {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 10;
}

.fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.fab-primary {
  background: var(--primary);
  color: white;
}

.fab-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
  .floating-actions {
    bottom: 16px;
    right: 16px;
  }

  .fab {
    width: 48px;
    height: 48px;
  }
}
</style>
