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
          <span v-if="layoutStore.currentLayout" class="current-layout-name">
            • {{ layoutStore.currentLayout.name }}
          </span>
        </div>

        <div class="layout-actions">
          <!-- Layout Management -->
          <div class="layout-dropdown" v-if="workspaceStore.selectedWorkspace">
            <button class="action-btn" @click="showLayoutMenu = !showLayoutMenu" title="Layout management">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
                <line x1="9" y1="17" x2="13" y2="17"></line>
              </svg>
            </button>
            
            <!-- Layout Menu -->
            <div v-if="showLayoutMenu" class="layout-menu" @click.stop>
              <!-- Save Layout -->
              <div class="menu-section">
                <div class="menu-header">Save Current Layout</div>
                <div class="save-layout-form">
                  <input 
                    v-model="newLayoutName" 
                    type="text" 
                    placeholder="Layout name..."
                    class="layout-name-input"
                    @keyup.enter="() => saveCurrentLayout(false)"
                  />
                  <div class="save-actions">
                    <button 
                      @click="saveCurrentLayout(false)" 
                      class="btn-save"
                      :disabled="!newLayoutName.trim()"
                      title="Save layout"
                    >
                      Save
                    </button>
                    <button 
                      @click="saveCurrentLayout(true)" 
                      class="btn-set-default"
                      :disabled="!newLayoutName.trim()"
                      title="Save and set as default"
                    >
                      Save as Default
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Load Layout -->
              <div v-if="layoutStore.workspaceLayouts(workspaceStore.selectedWorkspace.id).length > 0" class="menu-section">
                <div class="menu-header">Load Layout</div>
                <div class="layout-list">
                  <div 
                    v-for="layout in layoutStore.workspaceLayouts(workspaceStore.selectedWorkspace.id)" 
                    :key="layout.id"
                    class="layout-item"
                    :class="{ active: layoutStore.currentLayout?.id === layout.id }"
                  >
                    <div class="layout-item-info" @click="loadLayout(layout)">
                      <span class="layout-name">{{ layout.name }}</span>
                      <span v-if="layout.is_default" class="layout-badge">Default</span>
                    </div>
                    <div class="layout-item-actions">
                      <button 
                        @click="setLayoutAsDefault(layout.id)" 
                        class="action-btn-small"
                        :class="{ active: layout.is_default }"
                        title="Set as default"
                      >
                        ★
                      </button>
                      <button 
                        @click="duplicateLayout(layout)" 
                        class="action-btn-small"
                        title="Duplicate layout"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <button 
                        @click="deleteLayout(layout)" 
                        class="action-btn-small delete"
                        title="Delete layout"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3,6 5,6 21,6"></polyline>
                          <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="menu-section">
                <div class="no-layouts">No saved layouts</div>
              </div>
            </div>
          </div>
          
          <!-- New Terminal -->
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
          @data="(data: string) => handleTerminalData(pane.id, data)"
          @resize="(cols: number, rows: number) => handleTerminalResize(pane.id, cols, rows)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useTerminalStore } from '../stores/terminal'
import { useUIStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { useLayoutStore } from '../stores/layout'
import { socketService } from '../services/socket'
import { apiService } from '../services/api'
import TerminalPane from './TerminalPane.vue'
import type { Session } from '../types'
import type { LayoutType } from '../types/layout'

const workspaceStore = useWorkspaceStore()
const terminalStore = useTerminalStore()
const uiStore = useUIStore()
const authStore = useAuthStore()
const layoutStore = useLayoutStore()
const showRepositoriesModal = ref(false)

// Layout management state
const showLayoutMenu = ref(false)
const newLayoutName = ref('')

// Socket connection state
const isConnected = ref(false)

// Session management state
const persistentSessions = ref<Session[]>([])
const showSessionReconnect = ref(false)

// Terminal pane references
const terminalPanes = ref<InstanceType<typeof TerminalPane>[]>([])

// Terminal instances map for direct access
const terminalInstances = new Map<string, InstanceType<typeof TerminalPane>>()

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
  if (!workspaceStore.selectedWorkspace || !workspaceStore.selectedWorkspace.id) return
  
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

// Watch for workspace changes and reload persistent sessions
watch(() => workspaceStore.selectedWorkspace, async (newWorkspace) => {
  if (newWorkspace) {
    await loadPersistentSessions()
  } else {
    // Clear sessions when no workspace is selected
    persistentSessions.value = []
    showSessionReconnect.value = false
  }
})

// Watch for pane changes and auto-save layout
watch(() => terminalStore.panes, () => {
  if (workspaceStore.selectedWorkspace && terminalStore.panes.length > 0) {
    const layoutConfig = {
      layout_type: terminalStore.currentLayout,
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
      active_pane: terminalStore.activePaneId,
      timestamp: new Date().toISOString()
    }
    
    // Use debounced save to avoid excessive API calls during pane operations
    layoutStore.debouncedSaveLayout(
      `Auto-saved ${terminalStore.currentLayout} layout`,
      workspaceStore.selectedWorkspace.id,
      layoutConfig,
      false // Don't set as default for auto-saves
    )
  }
}, { deep: true })

const reconnectToSession = async (session: Session) => {
  if (!workspaceStore.selectedWorkspace || !workspaceStore.selectedWorkspace.id) {
    console.error('No workspace selected for session reconnection')
    return
  }
  
  try {
    // Create a new terminal session normally - the backend should now use the frontend session ID
    const pane = await terminalStore.createTerminal(workspaceStore.selectedWorkspace.id)
    if (pane) {
      await nextTick()
      initializeTerminal(pane.id)
      
      // Load and display session history from the old session
      try {
        const history = await apiService.getSessionHistory(session.id)
        const terminalInstance = terminalInstances.get(pane.id)
        if (terminalInstance && history.length > 0) {
          // Display session restoration message
          terminalInstance.writeln(`\r\n\x1b[1;34m● Restored from previous session (${history.length} commands)\x1b[0m`)
          // Display each command from history
          history.forEach(command => {
            terminalInstance.writeln(`\x1b[90m$ ${command}\x1b[0m`)
          })
          terminalInstance.writeln(`\x1b[1;32m● Session restored - ready for new commands\x1b[0m\r\n`)
        }
      } catch (historyError) {
        console.warn('Failed to load session history:', historyError)
        const terminalInstance = terminalInstances.get(pane.id)
        if (terminalInstance) {
          terminalInstance.writeln(`\r\n\x1b[1;33m● Starting fresh session (history unavailable)\x1b[0m\r\n`)
        }
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

const initializeTerminal = async (paneId: string) => {
  await nextTick()
  const terminalPane = terminalPanes.value.find(tp => {
    return tp.$props.pane.id === paneId
  })
  if (terminalPane) {
    // Store reference to terminal instance
    terminalInstances.set(paneId, terminalPane)
    
    console.log(`✅ Terminal initialized for pane ${paneId}`)
  }
}

// Guard against duplicate terminal creation calls
const creatingTerminal = ref(false)

const createNewTerminal = async () => {
  if (creatingTerminal.value) {
    console.log('⚠️ Terminal creation already in progress, skipping duplicate call')
    return
  }
  
  if (workspaceStore.selectedWorkspace) {
    creatingTerminal.value = true
    try {
      const pane = await terminalStore.createTerminal(workspaceStore.selectedWorkspace.id)
      if (pane) {
        await nextTick()
        initializeTerminal(pane.id)
      }
    } finally {
      creatingTerminal.value = false
    }
  }
}

const handleTerminalData = (paneId: string, data: string) => {
  const pane = terminalStore.panes.find(p => p.id === paneId)
  if (pane && isConnected.value && pane.activeTabId) {
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId)
    if (activeTab) {
      console.log(`Sending terminal data: ${JSON.stringify(data)} for session ${activeTab.sessionId}`)
      socketService.sendTerminalData(activeTab.sessionId, data)
    }
  } else if (!isConnected.value) {
    console.warn('Cannot send terminal data: WebSocket not connected')
  } else {
    console.warn(`Cannot find pane ${paneId} or active tab to send data`)
  }
}

const handleTerminalResize = (paneId: string, cols: number, rows: number) => {
  terminalStore.resizePane(paneId, cols, rows)
  const pane = terminalStore.panes.find(p => p.id === paneId)
  if (pane && isConnected.value && pane.activeTabId) {
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId)
    if (activeTab) {
      socketService.resizeTerminal(activeTab.sessionId, cols, rows)
    }
  }
}

const handleTerminalFocus = (paneId: string) => {
  // Only set active pane - don't call focus again to avoid recursion
  terminalStore.setActivePane(paneId)
  console.log(`Terminal pane ${paneId} set as active`)
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
  // Remove from terminal instances map
  terminalInstances.delete(paneId)
  await terminalStore.closeTerminal(paneId)
}

const switchLayout = async (layout: LayoutType) => {
  await terminalStore.setLayout(layout)
  
  // Auto-save layout configuration when layout changes
    if (workspaceStore.selectedWorkspace) {
      const layoutConfig = {
        layout_type: layout,
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
        active_pane: terminalStore.activePaneId,
        timestamp: new Date().toISOString()
      }
      
      // Use debounced save to avoid excessive API calls
      layoutStore.debouncedSaveLayout(
        `Auto-saved ${layout} layout`,
        workspaceStore.selectedWorkspace.id,
        layoutConfig,
        false // Don't set as default for auto-saves
      )
    }
}

// Layout management methods
const saveCurrentLayout = async (setDefault = false) => {
  if (!workspaceStore.selectedWorkspace || !newLayoutName.value.trim()) return
  
  try {
    const layoutConfig = {
      layout_type: terminalStore.currentLayout,
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
      active_pane: terminalStore.activePaneId,
      timestamp: new Date().toISOString()
    }
    
    await layoutStore.saveCurrentLayout(
      newLayoutName.value.trim(),
      workspaceStore.selectedWorkspace.id,
      layoutConfig,
      setDefault
    )
    
    newLayoutName.value = ''
    showLayoutMenu.value = false
  } catch (err) {
    console.error('Failed to save layout:', err)
  }
}

const loadLayout = async (layout: any) => {
  try {
    // Set the layout type
    await terminalStore.setLayout(layout.configuration.type as LayoutType)
    
    // Set as current layout in store
    layoutStore.setCurrentLayout(layout)
    
    showLayoutMenu.value = false
    
    // Note: Terminal pane restoration would need additional logic
    // This is a simplified version that just changes the layout type
  } catch (err) {
    console.error('Failed to load layout:', err)
  }
}

const setLayoutAsDefault = async (layoutId: string) => {
  try {
    await layoutStore.setDefaultLayout(layoutId)
  } catch (err) {
    console.error('Failed to set layout as default:', err)
  }
}

const duplicateLayout = async (layout: any) => {
  try {
    const newName = `${layout.name} (Copy)`
    await layoutStore.duplicateLayout(layout.id, newName)
  } catch (err) {
    console.error('Failed to duplicate layout:', err)
  }
}

const deleteLayout = async (layout: any) => {
  if (!confirm(`Are you sure you want to delete the layout "${layout.name}"?`)) return
  
  try {
    await layoutStore.deleteLayout(layout.id)
    
    // Clear current layout if it was deleted
    if (layoutStore.currentLayout?.id === layout.id) {
      layoutStore.setCurrentLayout(null)
    }
  } catch (err) {
    console.error('Failed to delete layout:', err)
  }
}

// Close layout menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (showLayoutMenu.value && !event.composedPath().some((el: any) => 
    el.classList?.contains('layout-dropdown') || el.classList?.contains('layout-menu')
  )) {
    showLayoutMenu.value = false
  }
}

// Terminal output is now handled via store subscription in onMounted

// Initialize WebSocket connection
const initializeSocketConnection = async () => {
  try {
    // Use auth store's connectWebSocket method to prevent duplicate connections
    await authStore.connectWebSocket()
    isConnected.value = socketService.isConnected
    
    if (isConnected.value) {
      console.log('✅ WebSocket connected successfully')
      
      // Update existing terminals with connection status
      for (const [, instance] of terminalInstances) {
        instance.writeln('\r\n\x1b[1;32m● Connected to server\x1b[0m')
      }
    }
  } catch (error) {
    console.error('❌ Failed to connect to WebSocket:', error)
    isConnected.value = false
    
    // Update existing terminals with connection status
    for (const [, instance] of terminalInstances) {
      instance.writeln('\r\n\x1b[1;31m● Connection failed\x1b[0m')
    }
  }
}

// Store cleanup function reference
let cleanupOutputHandler: (() => void) | null = null

onMounted(async () => {
  // Initialize terminal store socket subscriptions
  terminalStore.initialize()
  
  // Set up terminal output handlers
  cleanupOutputHandler = terminalStore.onTerminalOutput((sessionId: string, output: string) => {
    console.log(`🖥️ Writing output to terminal UI for session ${sessionId}:`, JSON.stringify(output))
    
    // Find the terminal pane and tab for this session and write output
    let targetPane = null
    let targetTerminalPane = null
    
    for (const pane of terminalStore.panes) {
      const tab = pane.tabs.find(t => t.sessionId === sessionId)
      if (tab) {
        targetPane = pane
        targetTerminalPane = terminalPanes.value.find(tp => {
          return tp.$props.pane.id === pane.id
        })
        break
      }
    }
    
    if (targetTerminalPane) {
      targetTerminalPane.write(output)
      console.log(`✅ Output written to terminal pane ${targetPane?.id}`)
    } else {
      console.warn(`⚠️ Terminal pane not found for session ${sessionId}`)
      console.log(`Available panes:`, terminalStore.panes.map(p => ({ 
        id: p.id, 
        tabs: p.tabs.map(t => ({ id: t.id, sessionId: t.sessionId }))
      })))
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

  // Add click outside listener for layout menu
  document.addEventListener('click', handleClickOutside)
  
  // Terminal initialization is now handled by TerminalPane components
})

// Store cleanup function for unmount - MUST be outside async context
onUnmounted(() => {
  // Clean up output handler
  if (cleanupOutputHandler) {
    cleanupOutputHandler()
  }
  
  // Clean up terminal store subscriptions
  terminalStore.cleanup()
  
  // Clean up all terminal panes
  terminalPanes.value.forEach(pane => {
    pane.dispose()
  })
  
  // Clear terminal instances map
  terminalInstances.clear()
  
  // Remove click outside listener
  document.removeEventListener('click', handleClickOutside)
  
  // Note: Don't disconnect socketService here as it's shared across components
  // Let the auth store handle WebSocket lifecycle
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
  padding: 64px 32px;
  background: radial-gradient(ellipse at center, rgba(0, 123, 204, 0.05) 0%, transparent 50%);
  position: relative;
}

.welcome-screen::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="1" fill="rgba(255,255,255,0.02)"/></svg>') repeat;
  pointer-events: none;
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
  z-index: 1;
  position: relative;
}

.session-reconnect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 56px 32px;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

.session-reconnect h2 {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.session-reconnect h2::before {
  content: '🔌';
  font-size: 24px;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.session-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  border-color: var(--primary);
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
  padding: 12px 20px;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, rgba(37, 37, 38, 0.95) 100%);
  border-bottom: 1px solid var(--border-color);
  gap: 20px;
  flex-shrink: 0;
  backdrop-filter: blur(10px);
  position: relative;
}

.layout-controls::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%);
  opacity: 0.3;
}

.layout-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.current-layout-name {
  color: var(--primary);
  font-weight: 500;
}

.icon {
  color: var(--text-muted);
}

.layout-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.layout-dropdown {
  position: relative;
}

.layout-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  min-width: 280px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 4px;
}

.menu-section {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.menu-section:last-child {
  border-bottom: none;
}

.menu-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.save-layout-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layout-name-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.layout-name-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}

.save-actions {
  display: flex;
  gap: 6px;
}

.btn-save,
.btn-set-default {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save {
  background: var(--primary);
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-set-default {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-set-default:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-save:disabled,
.btn-set-default:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.layout-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layout-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.layout-item:hover {
  background: var(--bg-hover);
}

.layout-item.active {
  background: var(--primary-bg);
}

.layout-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  cursor: pointer;
}

.layout-name {
  font-size: 13px;
  color: var(--text-primary);
}

.layout-badge {
  background: var(--primary);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.layout-item-actions {
  display: flex;
  gap: 4px;
}

.action-btn-small {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 12px;
}

.action-btn-small:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn-small.active {
  color: var(--primary);
}

.action-btn-small.delete:hover {
  background: var(--error-bg);
  color: var(--error);
}

.no-layouts {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 16px;
}

.action-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(0, 123, 204, 0.2);
  transition: all 0.3s ease;
  transform: translate(-50%, -50%);
}

.action-btn:hover {
  background: var(--button-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.action-btn:hover::before {
  width: 100px;
  height: 100px;
}

.action-btn:active {
  transform: translateY(0);
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