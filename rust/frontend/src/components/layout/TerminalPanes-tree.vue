<template>
  <div class="terminal-panes-container">
    <!-- Welcome Screen -->
    <div v-if="!workspaceStore.selectedWorkspace" class="welcome-screen">
      <h2>Welcome to AI Code Terminal</h2>
      <p>
        Select a workspace from the sidebar or clone a repository to get started.<br/>
        Once connected, you'll have full terminal access to your repositories.
      </p>
      <button @click="showRepositoriesModal = true" class="btn btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="6" y1="3" x2="6" y2="21"></line>
          <line x1="18" y1="3" x2="18" y2="21"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        Clone Your First Repository
      </button>
    </div>

    <!-- Session Reconnection Screen -->
    <div v-else-if="showSessionReconnect" class="session-reconnect">
      <h2>Restore Terminal Sessions</h2>
      <p>
        We found {{ persistentSessions.length }} persistent terminal session(s) for this workspace.<br/>
        Would you like to restore them or start fresh?
      </p>

      <div class="sessions-list">
        <div v-for="session in persistentSessions" :key="session.id" class="session-item">
          <div class="session-info">
            <span class="session-name">{{ session.session_name || 'Terminal Session' }}</span>
            <span class="session-status">{{ session.status }}</span>
            <span class="session-time">{{ new Date(session.created_at).toLocaleString() }}</span>
          </div>
          <button @click="reconnectToSession(session)" class="btn btn-primary">
            Reconnect
          </button>
        </div>
      </div>

      <div class="session-actions">
        <button @click="createNewSession" class="btn btn-secondary">
          Start Fresh Terminal
        </button>
      </div>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <!-- Quick Command FAB -->
        <button
          @click="uiStore.openQuickCommandOverlay"
          class="fab fab-secondary"
          title="Quick command (Ctrl+K)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
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
import type { Session } from '@/types'
import type { SplitDirection, PaneNode } from '@/types/pane-tree'
import { getAllTerminalNodes } from '@/utils/pane-tree'

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

const showRepositoriesModal = ref(false)
const isConnected = ref(false)
const persistentSessions = ref<Session[]>([])
const showSessionReconnect = ref(false)
const creatingTerminal = ref(false)

// Computed for UI state
const canShowCloseButtons = computed(() => {
  if (!terminalStore.layout) return false
  const terminalNodes = getAllTerminalNodes(terminalStore.layout.root as PaneNode)
  return terminalNodes.length > 1
})

// Session management
const loadPersistentSessions = async () => {
  if (!workspaceStore.selectedWorkspace || !workspaceStore.selectedWorkspace.id) return

  try {
    console.log('🔄 Loading persistent sessions for workspace:', workspaceStore.selectedWorkspace.id)
    const sessions = await apiService.getSessions(workspaceStore.selectedWorkspace.id)
    const activeSessions = sessions.filter(session =>
      session.status === 'active' || session.status === 'disconnected'
    )

    console.log(`Found ${activeSessions.length} persistent sessions`)

    // Try to restore the saved pane structure first
    if (activeSessions.length > 0) {
      console.log('🔄 Attempting to restore pane structure for sessions')
      const restored = await restorePaneStructureFromSessions(activeSessions)

      if (restored) {
        console.log('✅ Pane structure restored successfully')

        // Establish WebSocket connections for all restored sessions
        const connectPromises = activeSessions.map(async (session, index) => {
          await new Promise(resolve => setTimeout(resolve, index * 100))

          try {
            if (socketService.isConnected) {
              socketService.createTerminal(workspaceStore.selectedWorkspace.id, session.id)
            }
            return { success: true, sessionId: session.id }
          } catch (error) {
            console.error(`Failed to connect session ${session.id}:`, error)
            return { success: false, sessionId: session.id, error }
          }
        })

        const results = await Promise.allSettled(connectPromises)
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
        console.log(`🔌 Connected ${successful}/${activeSessions.length} sessions to WebSocket`)
      } else {
        console.log('⚠️ Could not restore pane structure, falling back to individual reconnection')
        showSessionReconnect.value = true
      }
    }

    persistentSessions.value = activeSessions
  } catch (error) {
    console.error('Failed to load persistent sessions:', error)
  }
}

const restorePaneStructureFromSessions = async (sessions: Session[]): Promise<boolean> => {
  if (!workspaceStore.selectedWorkspace) return false

  // First try to load saved layouts from database
  let savedLayout = null
  try {
    await layoutStore.fetchLayouts(workspaceStore.selectedWorkspace.id)
    const defaultLayout = layoutStore.workspaceLayouts(workspaceStore.selectedWorkspace.id)
      .find(layout => layout.is_default) || layoutStore.workspaceLayouts(workspaceStore.selectedWorkspace.id)[0]

    if (defaultLayout && defaultLayout.tree_structure) {
      try {
        savedLayout = JSON.parse(defaultLayout.tree_structure)
        console.log('📖 Loaded pane tree structure from database')
      } catch (error) {
        console.warn('Failed to parse tree structure from database layout:', error)
      }
    }
  } catch (error) {
    console.warn('Failed to fetch layouts from database:', error)
  }

  // Fallback to localStorage if no database layout found
  if (!savedLayout) {
    savedLayout = terminalStore.loadPaneStructure(workspaceStore.selectedWorkspace.id)
    if (savedLayout) {
      console.log('📖 Loaded pane tree structure from localStorage')
    }
  }

  if (!savedLayout) {
    console.log('⚠️ No saved layout found in database or localStorage')
    return false
  }

  // Create session map
  const sessionMap = new Map(sessions.map(s => [s.id, s]))

  // Validate that all sessions in the layout still exist
  const terminalNodes = getAllTerminalNodes(savedLayout.root)
  const allSessionsExist = terminalNodes.every(node =>
    node.tabs?.every(tab => sessionMap.has(tab.sessionId))
  )

  if (!allSessionsExist) {
    console.log('⚠️ Some sessions from saved layout no longer exist')
    return false
  }

  // Restore the layout using the proper store method
  terminalStore.restoreLayout(savedLayout)

  // Load session history for each tab
  for (const node of terminalNodes) {
    if (node.tabs) {
      for (const tab of node.tabs) {
        try {
          const history = await apiService.getSessionHistory(tab.sessionId)
          if (Array.isArray(history)) {
            tab.buffer = history.join('')
          } else if (typeof history === 'string') {
            tab.buffer = history
          }
        } catch (error) {
          console.warn(`Failed to load history for session ${tab.sessionId}:`, error)
        }
      }
    }
  }

  return true
}

// Workspace change handling
watch(() => workspaceStore.selectedWorkspace, async (newWorkspace, oldWorkspace) => {
  console.log('🔄 Workspace changed:', newWorkspace?.name || 'none')

  if (!newWorkspace) {
    persistentSessions.value = []
    showSessionReconnect.value = false
    terminalStore.cleanup()
  } else {
    // Save pane structure for the old workspace before switching
    if (oldWorkspace && terminalStore.layout) {
      terminalStore.savePaneStructure(oldWorkspace.id)
    }

    // Switch to new workspace
    terminalStore.switchToWorkspace(newWorkspace.id)

    const isWorkspaceSwitch = oldWorkspace && oldWorkspace.id !== newWorkspace.id
    const isInitialLoad = !oldWorkspace

    if (isWorkspaceSwitch) {
      console.log('🔄 Switching workspaces, reloading sessions')
    } else if (isInitialLoad) {
      console.log('🔄 Initial workspace load, loading sessions')
    }

    await loadPersistentSessions()

    // Always ensure we have a working terminal
    if (!terminalStore.layout) {
      console.log('No layout found, creating new terminal')
      await createNewTerminal()
    } else {
      console.log('Layout exists, checking if it has active terminals...')
      const terminalNodes = getAllTerminalNodes(terminalStore.layout.root as PaneNode)
      const hasActiveTabs = terminalNodes.some(node => node.tabs && node.tabs.length > 0)

      if (!hasActiveTabs) {
        console.log('Layout exists but no active tabs, creating new terminal')
        await createNewTerminal()
      } else {
        console.log(`Layout has ${terminalNodes.length} terminal nodes with tabs`)
      }
    }
  }
})

// Event handlers
const reconnectToSession = async (session: Session): Promise<void> => {
  if (!workspaceStore.selectedWorkspace) return

  console.log(`🔄 Reconnecting to session ${session.id}`)

  // For now, create a simple single-terminal layout
  // TODO: Implement proper session reconnection with saved layout
  terminalStore.initializeLayout(workspaceStore.selectedWorkspace.id)

  if (terminalStore.layout && socketService.isConnected) {
    socketService.createTerminal(workspaceStore.selectedWorkspace.id, session.id)
  }

  showSessionReconnect.value = false
}

const createNewSession = async () => {
  await createNewTerminal()
  showSessionReconnect.value = false
}

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
  // TODO: Implement tab moving between panes in tree structure
  console.log('Moving tab between panes:', payload)
}

const handleClosePane = (paneId: string) => {
  // TODO: Implement pane closing in tree structure
  console.log('Closing pane:', paneId)
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

// Auto-save layout changes
const layoutSignature = computed(() => {
  if (!terminalStore.layout) return ''
  const terminalNodes = getAllTerminalNodes(terminalStore.layout.root as PaneNode)
  return `${terminalNodes.length}:${terminalStore.layout.activeNodeId}`
})

watch(layoutSignature, (newSignature, oldSignature) => {
  if (newSignature && oldSignature && newSignature !== oldSignature && workspaceStore.selectedWorkspace && terminalStore.layout) {
    console.log('🔄 Layout changed, auto-saving')

    // Save to localStorage
    terminalStore.savePaneStructure(workspaceStore.selectedWorkspace.id)

    // Also save to database for persistence
    const treeStructure = JSON.stringify(terminalStore.layout)

    layoutStore.debouncedSaveLayout(
      `Auto-saved hierarchical layout`,
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
  // Save pane structure before unmounting
  if (workspaceStore.selectedWorkspace && terminalStore.layout) {
    terminalStore.savePaneStructure(workspaceStore.selectedWorkspace.id)
  }
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

.session-reconnect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 56px 32px;
}

.session-reconnect h2 {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
}

.session-reconnect p {
  color: var(--text-secondary);
  font-size: 17px;
  line-height: 1.6;
  margin-bottom: 36px;
  max-width: 640px;
}

.sessions-list {
  width: 100%;
  max-width: 600px;
  margin-bottom: 32px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
}

.session-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.session-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.session-status,
.session-time {
  font-size: 12px;
  color: var(--text-muted);
}

.session-actions {
  display: flex;
  gap: 12px;
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