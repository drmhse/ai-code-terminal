<template>
  <div class="terminal-panes-container">
    <!-- Welcome Screen -->
    <div v-if="!workspaceStore.selectedWorkspace" class="welcome-screen">
      <h2>Welcome to AI Code Terminal</h2>
      <p>
        Select a workspace from the sidebar or clone a repository to get started.<br/>
        Once connected, you'll have full terminal access to your repositories.
      </p>
      <button @click="uiStore.openRepositoriesModal" class="btn btn-primary">
        <FolderPlusIcon class="h-4 w-4" />
        Clone Your First Repository
      </button>
    </div>


    <!-- Hierarchical Terminal Panes -->
    <template v-else>
      <div class="terminal-tree-container" v-if="terminalStore.layout">
        <!-- Render the root of the pane tree -->
        <PaneTreeNode
          :node="terminalStore.layout.root as PaneNode"
          :is-active="false"
          :active-node-id="terminalStore.layout.activeNodeId"
          :workspace-path="workspaceStore.selectedWorkspace?.path"
          :theme="terminalTheme"
          :show-close-button="canShowCloseButtons"
          @focus="handleTerminalFocus"
          @split="handleSplit"
          @data="handleTerminalData"
          @resize="handleTerminalResize"
          @move-tab-to-pane="handleMoveTabToPane"
          @close-pane="handleClosePane"
        />
      </div>

      <!-- No Layout State -->
      <div v-else class="no-terminals">
        <div class="no-terminals-content">
          <h3>No Terminal Sessions</h3>
          <p>Create your first terminal to get started</p>
          <button @click="createNewTerminal" class="btn btn-primary">
            <ComputerDesktopIcon class="h-4 w-4" />
            Create Terminal
          </button>
        </div>
      </div>

      <!-- Floating Action Button for Quick Actions -->
      <div class="floating-actions">
        <button
          @click="createNewTerminal"
          class="fab fab-primary"
          title="New terminal"
        >
          <PlusIcon class="h-5 w-5" />
        </button>

        <!-- Quick Command FAB -->
        <button
          @click="uiStore.openQuickCommandOverlay"
          class="fab fab-secondary"
          title="Quick command (Ctrl+K)"
        >
          <CheckCircleIcon class="h-5 w-5" />
        </button>
      </div>
    </template>

    <!-- Quick Command Overlay -->
    <QuickCommandOverlay />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTerminalTreeStore } from '@/stores/terminal-tree'
import { useAuthStore } from '@/stores/auth'
import { useLayoutStore } from '@/stores/layout'
import { useUIStore } from '@/stores/ui'
import { useTheme } from '@/composables/useTheme'
import { getCurrentTerminalTheme } from '@/utils/themeConverter'
import { socketService } from '@/services/socket'
import { apiService } from '@/services/api'
import PaneTreeNode from './PaneTreeNode.vue'
import QuickCommandOverlay from '../QuickCommandOverlay.vue'
import type { SplitDirection, PaneNode } from '@/types/pane-tree'
import { getAllTerminalNodes, findActiveTerminalNode } from '@/utils/pane-tree'
import { FolderPlusIcon, ComputerDesktopIcon, PlusIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'

const workspaceStore = useWorkspaceStore()
const terminalStore = useTerminalTreeStore()
const authStore = useAuthStore()
const layoutStore = useLayoutStore()
const uiStore = useUIStore()
const { currentTheme } = useTheme()

// Convert current theme terminal colors to xterm.js format
const terminalTheme = computed(() => {
  if (!currentTheme.value) return undefined
  return getCurrentTerminalTheme(currentTheme.value)
})

// Removed: showRepositoriesModal now handled by UI store
const isConnected = ref(false)
const creatingTerminal = ref(false)

// Computed for UI state
const canShowCloseButtons = computed(() => {
  if (!terminalStore.layout) return false
  const terminalNodes = getAllTerminalNodes(terminalStore.layout.root as PaneNode)
  return terminalNodes.length > 1
})

// NOTE: Terminal creation is now handled entirely by the store's switchToWorkspace function
// This eliminates race conditions between component and store terminal creation

// Session management
// Use the store's isRecentSession function for consistency


// Workspace change handling - cleanup only (switching handled by workspace store)
watch(() => workspaceStore.selectedWorkspace, async (newWorkspace, oldWorkspace) => {
  console.log('🔄 Workspace changed:', newWorkspace?.name || 'none')

  if (!newWorkspace) {
    terminalStore.cleanup()
  }
  // NOTE: Terminal workspace switching is now handled by workspace store
  // to prevent race conditions and duplicate calls
})

// Event handlers

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

const handleTerminalData = (payload: { paneId: string, data: string }) => {
  terminalStore.sendInput(payload.paneId, payload.data)
}

const handleTerminalResize = (payload: { paneId: string, cols: number, rows: number }) => {
  terminalStore.resizePane(payload.paneId, payload.cols, payload.rows)
}

const handleTerminalFocus = (paneId: string) => {
  terminalStore.setActivePane(paneId)
}

const handleMoveTabToPane = (payload: { sourcePaneId: string, targetPaneId: string, tabId: string, targetIndex: number }) => {
  console.log('🔄 Moving tab between panes:', payload)

  const success = terminalStore.moveTabBetweenPanes(
    payload.sourcePaneId,
    payload.targetPaneId,
    payload.tabId,
    payload.targetIndex
  )

  if (success) {
    console.log('✅ Tab moved successfully')
  } else {
    console.error('❌ Failed to move tab')
  }
}

const handleClosePane = (paneId: string) => {
  console.log('🗑️ Closing pane:', paneId)
  terminalStore.closePane(paneId)
}

const handleSplit = (payload: { paneId: string, direction: SplitDirection }) => {
  if (!workspaceStore.selectedWorkspace) return

  console.log(`🔄 Splitting pane ${payload.paneId} ${payload.direction}`)

  const newPaneId = terminalStore.splitPane(payload.direction, payload.paneId)
  if (newPaneId && workspaceStore.selectedWorkspace) {
    // Create initial tab in the new pane
    terminalStore.createTabInPane(newPaneId, workspaceStore.selectedWorkspace.id, 'Terminal')
  }
}

// Auto-save layout structure changes (WITHOUT session data)
const layoutSignature = computed(() => {
  if (!terminalStore.layout) return ''
  const terminalNodes = getAllTerminalNodes(terminalStore.layout.root as PaneNode)
  return `${terminalNodes.length}:${terminalStore.layout.activeNodeId}`
})

watch(layoutSignature, (newSignature, oldSignature) => {
  if (newSignature && oldSignature && newSignature !== oldSignature && workspaceStore.selectedWorkspace && terminalStore.layout) {
    console.log('🔄 Layout structure changed, auto-saving to backend')

    // Save layout structure (WITHOUT session data) to backend database
    const structureOnly = terminalStore.stripSessionDataFromLayout(terminalStore.layout)
    const treeStructure = JSON.stringify(structureOnly)

    layoutStore.debouncedSaveLayout(
      `Auto-saved layout structure`,
      workspaceStore.selectedWorkspace.id,
      treeStructure,
      'hierarchical',
      false
    )
  }
})


// Initialization
const initializeSocketConnection = async () => {
  try {
    await authStore.connectWebSocket()
    isConnected.value = socketService.isConnected
    if (isConnected.value) {
      console.log('✅ WebSocket connected successfully')
    }
  } catch (error) {
    console.error('❌ Failed to connect to WebSocket:', error)
    isConnected.value = false
  }
}

onMounted(async () => {
  terminalStore.initialize()
  await initializeSocketConnection()
})

onUnmounted(() => {
  // No saving needed - layouts are ephemeral
  terminalStore.cleanup()
})
</script>

<style scoped>
.terminal-panes-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  position: relative;
}

/* Welcome Screen and Session Reconnect styles remain the same */
.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 64px 32px;
  background: radial-gradient(ellipse at center, rgba(0, 123, 204, 0.05) 0%, transparent 50%);
}

.welcome-screen h2 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-screen p {
  color: var(--text-secondary);
  font-size: 17px;
  line-height: 1.6;
  margin-bottom: 40px;
  max-width: 560px;
}


.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--button-bg);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn:hover {
  background: var(--button-hover);
}

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

/* Terminal Tree Container */
.terminal-tree-container {
  flex: 1;
  padding: 4px;
  overflow: hidden;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* No Terminals State */
.no-terminals {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 64px 32px;
}

.no-terminals-content {
  text-align: center;
}

.no-terminals-content h3 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.no-terminals-content p {
  color: var(--text-secondary);
  font-size: 16px;
  margin-bottom: 32px;
}

/* Floating Actions */
.floating-actions {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.fab-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.fab-secondary:hover {
  background: var(--bg-tertiary);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  border-color: var(--primary);
}

@media (max-width: 768px) {
  .floating-actions {
    bottom: 16px;
    right: 16px;
    gap: 12px;
  }

  .fab {
    width: 48px;
    height: 48px;
  }

  .fab svg {
    width: 18px;
    height: 18px;
  }
}
</style>