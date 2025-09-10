<template>
  <div class="terminal-panel">
    <!-- Welcome Screen -->
    <div v-if="!workspaceStore.selectedWorkspace" class="welcome-screen">
      <h2>Welcome to AI Code Terminal</h2>
      <p>
        Select a workspace from the sidebar or clone a repository to get started.<br/>
        Once connected, you'll have god-mode terminal access to your repositories.
      </p>
      <button @click="showRepositoriesModal = true" class="btn btn-icon">
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

    <!-- Terminal Interface -->
    <template v-else>
      <!-- Layout Controls -->
      <div class="layout-controls">
        <div class="layout-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
            <polyline points="4,17 10,11 4,5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span v-if="terminalStore.panes.length <= 1">Single Terminal</span>
          <span v-else>{{ formatLayoutName(terminalStore.currentLayout) }} ({{ terminalStore.panes.length }} panes)</span>
        </div>

        <div class="layout-actions">
          <button class="action-btn" @click="createNewTerminal" title="New terminal session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <!-- Layout Switcher -->
        <div v-if="!uiStore.isMobile" class="layout-switcher">
          <button 
            v-for="layout in terminalStore.layoutRecommendations.supported" 
            :key="layout"
            class="layout-btn"
            :class="{ active: terminalStore.currentLayout === layout }"
            @click="switchLayout(layout)"
            :title="formatLayoutName(layout)"
          >
            <div :class="`layout-preview ${layout}`"></div>
          </button>
        </div>
      </div>

      <!-- Terminal Container -->
      <div 
        class="terminal-container" 
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
          ref="terminalPanes"
          :pane="pane"
          :is-active="pane.id === terminalStore.activePaneId"
          :workspace-path="workspaceStore.selectedWorkspace?.path"
          :can-split="terminalStore.panes.length < 4"
          :show-close-button="terminalStore.panes.length > 1"
          @focus="handleTerminalFocus"
          @close="closeTerminal(pane.id)"
          @split="handleSplit"
          @data="handleTerminalData"
          @resize="handleTerminalResize"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useTerminalStore } from '../stores/terminal'
import { useUIStore } from '../stores/ui'
import { socketService } from '../services/socket'
import { apiService } from '../services/api'
import TerminalPane from './TerminalPane.vue'
import type { TerminalTheme } from '../types/terminal'

const workspaceStore = useWorkspaceStore()
const terminalStore = useTerminalStore()
const uiStore = useUIStore()
const showRepositoriesModal = ref(false)

// Socket connection state
const isConnected = ref(false)

// Session management state
const persistentSessions = ref<Session[]>([])
const showSessionReconnect = ref(false)

// Terminal pane references
const terminalPanes = ref<InstanceType<typeof TerminalPane>[]>([])

// Touch gesture state
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchEndX = ref(0)
const touchEndY = ref(0)
const minSwipeDistance = 50
const maxVerticalDistance = 100

const formatLayoutName = (layout: string) => {
  return layout.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const loadPersistentSessions = async () => {
  if (!workspaceStore.selectedWorkspace) return
  
  try {
    const sessions = await apiService.getSessions(workspaceStore.selectedWorkspace.id)
    persistentSessions.value = sessions.filter(session => 
      session.status === 'active' || session.status === 'disconnected'
    )
    showSessionReconnect.value = persistentSessions.value.length > 0
  } catch (error) {
    console.error('Failed to load persistent sessions:', error)
  }
}

const reconnectToSession = async (session: Session) => {
  try {
    // Create a new pane for the reconnected session
    const pane = await terminalStore.createTerminal(workspaceStore.selectedWorkspace!.id)
    if (pane) {
      // Update the pane to use the existing session ID
      pane.sessionId = session.id
      
      await nextTick()
      initializeTerminal(pane.id)
      
      // Load and display session history
      try {
        const history = await apiService.getSessionHistory(session.id)
        const terminalInstance = terminalInstances.get(pane.id)
        if (terminalInstance) {
          // Display each command from history
          history.forEach(command => {
            terminalInstance.terminal.writeln(`\x1b[90m$ ${command}\x1b[0m`)
          })
        }
      } catch (historyError) {
        console.warn('Failed to load session history:', historyError)
      }
    }
    
    showSessionReconnect.value = false
  } catch (error) {
    console.error('Failed to reconnect to session:', error)
  }
}

const createNewSession = async () => {
  await createNewTerminal()
  showSessionReconnect.value = false
}

const createNewTerminal = async () => {
  if (workspaceStore.selectedWorkspace) {
    const pane = await terminalStore.createTerminal(workspaceStore.selectedWorkspace.id)
    if (pane) {
      await nextTick()
      initializeTerminal(pane.id)
    }
  }
}

const handleTerminalData = (paneId: string, data: string) => {
  const pane = terminalStore.panes.find(p => p.id === paneId)
  if (pane && isConnected.value) {
    socketService.sendTerminalData(pane.sessionId, data)
  }
}

const handleTerminalResize = (paneId: string, cols: number, rows: number) => {
  terminalStore.resizePane(paneId, cols, rows)
  const pane = terminalStore.panes.find(p => p.id === paneId)
  if (pane && isConnected.value) {
    socketService.resizeTerminal(pane.sessionId, cols, rows)
  }
}

const handleTerminalFocus = (paneId: string) => {
  terminalStore.setActivePane(paneId)
}

const handleSplit = async (direction: 'horizontal' | 'vertical') => {
  if (!workspaceStore.selectedWorkspace) return
  
  // Determine new layout based on current layout and split direction
  const currentLayout = terminalStore.currentLayout
  let newLayout: typeof currentLayout = currentLayout
  
  if (currentLayout === 'single') {
    newLayout = direction === 'horizontal' ? 'horizontal-split' : 'vertical-split'
  } else if (currentLayout === 'horizontal-split' && direction === 'vertical') {
    newLayout = 'grid-2x2'
  } else if (currentLayout === 'vertical-split' && direction === 'horizontal') {
    newLayout = 'grid-2x2'
  }
  
  // Update layout if it changed
  if (newLayout !== currentLayout) {
    await terminalStore.setLayout(newLayout)
  }
  
  // Create new terminal
  await createNewTerminal()
}

// Touch gesture handlers for mobile terminal switching
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
  
  // Check if it's a horizontal swipe and not too vertical
  if (Math.abs(deltaX) > minSwipeDistance && deltaY < maxVerticalDistance) {
    // Switch to next or previous terminal
    const currentIndex = terminalStore.panes.findIndex(pane => pane.id === terminalStore.activePaneId)
    if (currentIndex !== -1) {
      let nextIndex
      if (deltaX > 0) {
        // Swipe right - go to previous terminal
        nextIndex = currentIndex > 0 ? currentIndex - 1 : terminalStore.panes.length - 1
      } else {
        // Swipe left - go to next terminal
        nextIndex = currentIndex < terminalStore.panes.length - 1 ? currentIndex + 1 : 0
      }
      
      const nextPane = terminalStore.panes[nextIndex]
      if (nextPane) {
        terminalStore.setActivePane(nextPane.id)
        
        // Visual feedback - could add a swipe animation here
        console.log(`Switched to terminal ${nextIndex + 1} of ${terminalStore.panes.length}`)
      }
    }
  }
}

const closeTerminal = async (paneId: string) => {
  await terminalStore.closeTerminal(paneId)
}

const switchLayout = async (layout: 'single' | 'horizontal-split' | 'vertical-split') => {
  await terminalStore.setLayout(layout)
}

const focusTerminal = (paneId: string) => {
  terminalStore.setActivePane(paneId)
}

// Terminal output is now handled via store subscription in onMounted

// Initialize WebSocket connection
const initializeSocketConnection = async () => {
  try {
    await socketService.connect()
    isConnected.value = true
    console.log('✅ WebSocket connected successfully')
    
    // Update existing terminals with connection status
    for (const [, instance] of terminalInstances) {
      instance.terminal.writeln('\r\n\x1b[1;32m● Connected to server\x1b[0m')
    }
  } catch (error) {
    console.error('❌ Failed to connect to WebSocket:', error)
    isConnected.value = false
    
    // Update existing terminals with connection status
    for (const [, instance] of terminalInstances) {
      instance.terminal.writeln('\r\n\x1b[1;31m● Connection failed\x1b[0m')
    }
  }
}

onMounted(async () => {
  // Initialize terminal store socket subscriptions
  terminalStore.initialize()
  
  // Set up terminal output handlers
  const cleanupOutputHandler = terminalStore.onTerminalOutput((sessionId: string, output: string) => {
    // Find the terminal pane for this session and write output
    const pane = terminalStore.panes.find(p => p.sessionId === sessionId)
    if (pane) {
      const terminalPane = terminalPanes.value.find(tp => {
        return tp.$props.pane.id === pane.id
      })
      if (terminalPane) {
        terminalPane.write(output)
      }
    }
  })
  
  // Initialize WebSocket connection
  await initializeSocketConnection()
  
  // Initialize terminal when a workspace is selected
  if (workspaceStore.selectedWorkspace) {
    // Load persistent sessions for reconnection UI
    await loadPersistentSessions()
    
    // If no persistent sessions or user chose to start fresh, create new terminal
    if (!showSessionReconnect.value && terminalStore.panes.length === 0) {
      await createNewTerminal()
    }
  }

  // Terminal initialization is now handled by TerminalPane components

  // Store cleanup function for unmount
  onUnmounted(() => {
    // Clean up output handler
    cleanupOutputHandler()
    
    // Clean up terminal store subscriptions
    terminalStore.cleanup()
    
    // Disconnect from WebSocket
    socketService.disconnect()
    
    // Clean up all terminal panes
    terminalPanes.value.forEach(pane => {
      pane.dispose()
    })
  })
})
</script>

<style>

</style>

<style scoped>
.terminal-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--terminal-bg);
  overflow: hidden;
}

.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 48px 24px;
}

.welcome-screen h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.welcome-screen p {
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.5;
  margin-bottom: 32px;
  max-width: 500px;
}

.session-reconnect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 48px 24px;
}

.session-reconnect h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.session-reconnect p {
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.5;
  margin-bottom: 32px;
  max-width: 600px;
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
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 12px;
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

.session-status {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: capitalize;
}

.session-time {
  font-size: 11px;
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

.layout-controls {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
  flex-shrink: 0;
}

.layout-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.icon {
  color: var(--text-muted);
}

.layout-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--button-hover);
}

.layout-switcher {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.layout-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.layout-btn:hover {
  background: var(--button-hover);
}

.layout-btn.active {
  background: var(--primary);
  border-color: var(--primary);
}

.layout-preview {
  width: 16px;
  height: 12px;
  border: 1px solid var(--text-muted);
  border-radius: 2px;
}

.layout-preview.horizontal {
  border-bottom: 1px solid var(--text-muted);
}

.layout-preview.vertical {
  border-right: 1px solid var(--text-muted);
}

.layout-preview.grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 1px;
}

.layout-preview.grid-2x2::before,
.layout-preview.grid-2x2::after {
  content: '';
  border: 1px solid var(--text-muted);
}

.layout-preview.three-pane {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 1px;
}

.layout-preview.three-pane::before,
.layout-preview.three-pane::after {
  content: '';
  border: 1px solid var(--text-muted);
}

.layout-btn.active .layout-preview {
  border-color: white;
}

.terminal-container {
  flex: 1;
  display: grid;
  gap: 1px;
  background: var(--border-color);
  overflow: hidden;
}

.terminal-pane {
  display: flex;
  flex-direction: column;
  background: var(--terminal-bg);
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  min-height: 36px;
}

.pane-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.pane-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.pane-cwd {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 2px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--error);
  color: white;
}

.terminal-content {
  flex: 1;
  overflow: hidden;
}

.xterm-container {
  width: 100%;
  height: 100%;
  padding: 8px;
}



@media (max-width: 768px) {
  .layout-controls {
    padding: 6px 12px;
  }
  
  .layout-info span {
    display: none;
  }
  
  .layout-switcher {
    display: none;
  }
  
  .pane-cwd {
    display: none;
  }
}
</style>