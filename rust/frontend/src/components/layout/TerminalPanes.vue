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

    <!-- Terminal Panes (Full Space Utilization) -->
    <template v-else>
      <div
        class="terminal-grid"
        :class="`layout-${terminalStore.currentLayout}`"
        :style="{
          'grid-template-columns': terminalStore.gridTemplateColumns,
          'grid-template-rows': terminalStore.gridTemplateRows
        }"
      >
        <TerminalPane
          v-for="pane in terminalStore.panes"
          :key="pane.id"
          :pane="pane as any"
          :is-active="pane.id === terminalStore.activePane"
          :workspace-path="workspaceStore.selectedWorkspace?.path"
          :can-split="terminalStore.panes.length < 4"
          :show-close-button="terminalStore.panes.length > 1"
          :theme="terminalTheme"
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
import { useTerminalStore } from '@/stores/terminal'
import { useAuthStore } from '@/stores/auth'
import { useLayoutStore } from '@/stores/layout'
import { useUIStore } from '@/stores/ui'
import { useTheme } from '@/composables/useTheme'
import { getCurrentTerminalTheme } from '@/utils/themeConverter'
import { socketService } from '@/services/socket'
import { apiService } from '@/services/api'
import TerminalPane from '../TerminalPane.vue'
import QuickCommandOverlay from '../QuickCommandOverlay.vue'
import type { Session } from '@/types'
import type { LayoutType } from '@/types/layout'

const workspaceStore = useWorkspaceStore()
const terminalStore = useTerminalStore()
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

const loadPersistentSessions = async () => {
  if (!workspaceStore.selectedWorkspace || !workspaceStore.selectedWorkspace.id) return

  try {
    console.log('🔄 Loading persistent sessions for workspace:', workspaceStore.selectedWorkspace.id)
    const sessions = await apiService.getSessions(workspaceStore.selectedWorkspace.id)
    const activeSessions = sessions.filter(session =>
      session.status === 'active' || session.status === 'disconnected'
    )

    console.log(`Found ${activeSessions.length} persistent sessions`)

    // Automatically reconnect to all persistent sessions with robust error handling
    if (activeSessions.length > 0) {
      const reconnectionPromises = activeSessions.map(async (session, index) => {
        // Stagger reconnections to prevent layout conflicts
        await new Promise(resolve => setTimeout(resolve, index * 150))

        try {
          await reconnectToSession(session)
          return { success: true, sessionId: session.id }
        } catch (error) {
          console.error(`Failed to reconnect session ${session.id}:`, error)
          return { success: false, sessionId: session.id, error }
        }
      })

      const results = await Promise.allSettled(reconnectionPromises)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
      const failed = results.length - successful

      if (successful > 0) {
        console.log(`✅ Successfully reconnected ${successful}/${activeSessions.length} sessions`)
      }
      if (failed > 0) {
        console.warn(`⚠️ Failed to reconnect ${failed}/${activeSessions.length} sessions`)
      }
    }

    persistentSessions.value = activeSessions
  } catch (error) {
    console.error('Failed to load persistent sessions:', error)
  }
}

watch(() => workspaceStore.selectedWorkspace, async (newWorkspace, oldWorkspace) => {
  console.log('🔄 Workspace changed:', newWorkspace?.name || 'none')

  if (!newWorkspace) {
    persistentSessions.value = []
    showSessionReconnect.value = false
    terminalStore.cleanup()
  } else {
    // Load sessions on initial workspace selection OR workspace switch
    const isWorkspaceSwitch = oldWorkspace && oldWorkspace.id !== newWorkspace.id
    const isInitialLoad = !oldWorkspace

    if (isWorkspaceSwitch) {
      console.log('🔄 Switching workspaces, reloading sessions')
      terminalStore.cleanup()
    } else if (isInitialLoad) {
      console.log('🔄 Initial workspace load, loading sessions')
    }

    await loadPersistentSessions()

    // Only create a new terminal if no sessions were restored
    if (terminalStore.panes.length === 0) {
      console.log('No persistent sessions found, creating new terminal')
      await createNewTerminal()
    }
  }
})

// Layout signature for auto-save
const layoutSignature = computed(() => {
  if (!terminalStore.hasPanes) return '';
  const paneSignatures = terminalStore.panes
    .map(p => `${p.id}:${p.tabs.length}`)
    .sort()
    .join('|');
  return `${terminalStore.currentLayout}|${paneSignatures}`;
});

watch(layoutSignature, (newSignature, oldSignature) => {
  if (newSignature && oldSignature && newSignature !== oldSignature && workspaceStore.selectedWorkspace && terminalStore.panes.length > 0) {
    const layoutConfig = {
      layout_type: terminalStore.currentLayout,
      type: terminalStore.currentLayout,
      panes: terminalStore.panes.map(pane => ({
        id: pane.id,
        name: pane.name,
        pane_type: 'Terminal',
        tabs: pane.tabs.map(tab => ({
          id: tab.id,
          session_id: tab.sessionId,
          name: tab.name,
          is_active: tab.isActive,
          order: tab.order
        })),
        active_tab: pane.activeTabId
      })),
      active_pane: terminalStore.activePane,
      timestamp: new Date().toISOString()
    }

    layoutStore.debouncedSaveLayout(
      `Auto-saved ${terminalStore.currentLayout} layout`,
      workspaceStore.selectedWorkspace.id,
      { ...layoutConfig, type: layoutConfig.layout_type || 'single' },
      false
    )
  }
})

const reconnectToSession = async (session: Session): Promise<void> => {
  if (!workspaceStore.selectedWorkspace || !workspaceStore.selectedWorkspace.id) {
    throw new Error('No workspace selected for session reconnection')
  }

  if (!session || !session.id) {
    throw new Error('Invalid session data provided')
  }

  console.log(`🔄 Reconnecting to session ${session.id}`)

  // Load session history to populate buffer with timeout
  let sessionBuffer = ''
  try {
    const historyPromise = apiService.getSessionHistory(session.id)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('History load timeout')), 3000)
    )

    const history = await Promise.race([historyPromise, timeoutPromise])

    if (Array.isArray(history)) {
      sessionBuffer = history.join('')
    } else if (typeof history === 'string') {
      sessionBuffer = history
    }
    console.log(`📜 Loaded session history for ${session.id}: ${sessionBuffer.length} characters`)
  } catch (historyError) {
    console.warn(`Failed to load session history for ${session.id}:`, historyError)
    // Continue without history - this is not a fatal error
  }

  // Reconnect to existing session with validation
  const pane = await terminalStore.reconnectToExistingSession(
    workspaceStore.selectedWorkspace.id,
    session.id,
    session.session_name || 'Terminal',
    sessionBuffer
  )

  if (!pane) {
    throw new Error(`Failed to create pane for session ${session.id}`)
  }

  console.log(`✅ Successfully reconnected to session ${session.id} in pane ${pane.id}`)
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

  // Don't load sessions here - let the workspace watcher handle it
  // This prevents double loading when workspace is set after mount
})

onUnmounted(() => {
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

.terminal-grid {
  flex: 1;
  display: grid;
  gap: 4px;
  padding: 8px;
  overflow: hidden;
  min-height: 0;
}

.terminal-grid.layout-single {
  gap: 0;
  padding: 4px;
}

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