import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { TerminalSession } from '@/types'
import { socketService } from '@/services/socket'
import type { Subscription } from '@/utils/reactive'
import {
  type LayoutType,
  type LayoutRecommendations,
  getSupportedLayouts,
  getRecommendedLayout,
  getLayoutConfig
} from '@/types/layout'

export interface TerminalTab {
  id: string
  sessionId: string
  name: string
  isActive: boolean
  order: number
  buffer: string
  cwd?: string
  size: {
    cols: number
    rows: number
  }
  pid?: number
}

export interface TerminalPane {
  id: string
  name: string
  isActive: boolean
  tabs: TerminalTab[]
  activeTabId: string | null
  size: {
    cols: number
    rows: number
  }
}

export const useTerminalStore = defineStore('terminal', () => {
  const panes = ref<TerminalPane[]>([])
  const activePane = ref<string | null>(null)
  const sessions = ref<Map<string, TerminalSession>>(new Map())

  // Workspace-specific terminal state
  const workspaceTerminals = ref<Map<string, {
    panes: TerminalPane[]
    activePane: string | null
    sessions: Map<string, TerminalSession>
  }>>(new Map())

  const currentWorkspaceId = ref<string | null>(null)

  // Legacy tabs array for backward compatibility
  const terminalTabs = ref<TerminalTab[]>([])
  const activeTabId = ref<string | null>(null)

  const draggedTab = ref<TerminalTab | null>(null)
  const dragOverPane = ref<string | null>(null)
  const dragState = ref({
    isDragging: false,
    draggedTabId: null as string | null
  })

  const viewportWidth = ref(window.innerWidth)
  const layoutRecommendations = ref<LayoutRecommendations>({
    supported: ['single'],
    recommended: 'single'
  })

  let socketSubscriptions: Subscription[] = []
  const outputHandlers: ((sessionId: string, output: string) => void)[] = []

  const createTabInPane = (paneId: string, workspaceId: string, name: string = 'Terminal') => {
    const pane = panes.value.find(p => p.id === paneId)
    if (!pane) return null

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newTab: TerminalTab = {
      id: tabId,
      sessionId,
      name,
      isActive: false,
      order: pane.tabs.length,
      buffer: '',
      size: { cols: 80, rows: 24 },
    }

    pane.tabs.push(newTab)

    // Set as active tab if it's the first tab
    if (pane.tabs.length === 1) {
      setActiveTabInPane(paneId, tabId)
    }

    // Create terminal session via WebSocket
    if (socketService.isConnected) {
      // Pass our frontend-generated sessionId so the backend can map it
      socketService.createTerminal(workspaceId, sessionId)
    }

    return newTab
  }

  const initializeSocketSubscriptions = () => {
    socketSubscriptions.push(
      socketService.subscribe('terminal:output', (event) => {
        console.log(`📥 Terminal output received for session ${event.sessionId}:`, JSON.stringify(event.output))

        // VS Code approach: NO FILTERING - trust xterm.js to handle all sequences properly
        appendOutput(event.sessionId, event.output)

        // Notify all registered output handlers with raw output
        outputHandlers.forEach(handler => {
          try {
            handler(event.sessionId, event.output)
          } catch (error) {
            console.error('Error in terminal output handler:', error)
          }
        })
      }),

      socketService.subscribe('terminal:created', (event) => {
        console.log(`✅ Terminal created event received:`, event)

        // **FIX:** The backend might return a different session ID than the one we sent.
        // We need to find the tab we created (which has a temporary ID) and update it.
        // The `event` should ideally include the original temporary ID for mapping.
        // Assuming for now the `create` request's `sessionId` is the one returned.
        for (const pane of panes.value) {
          const tab = pane.tabs.find(t => t.sessionId === event.sessionId)
          if (tab) {
            tab.pid = event.pid
            console.log(`✅ Updated PID for session ${event.sessionId} in tab ${tab.id}`)
            break
          }
        }
      }),

      socketService.subscribe('terminal:destroyed', (event) => {
        // Find the tab with this session ID across all panes
        for (const pane of panes.value) {
          const tab = pane.tabs.find(t => t.sessionId === event.sessionId)
          if (tab) {
            closeTabInPane(pane.id, tab.id)
            break
          }
        }
      })
    )
  }

  const onTerminalOutput = (handler: (sessionId: string, output: string) => void) => {
    outputHandlers.push(handler)
    return () => {
      const index = outputHandlers.indexOf(handler)
      if (index !== -1) {
        outputHandlers.splice(index, 1)
      }
    }
  }

  const cleanupSocketSubscriptions = () => {
    socketSubscriptions.forEach(sub => sub.unsubscribe())
    socketSubscriptions = []
  }

  const appendOutput = (sessionId: string, output: string) => {
    // Find the tab with this session ID across all panes
    for (const pane of panes.value) {
      const tab = pane.tabs.find(t => t.sessionId === sessionId)
      if (tab) {
        // Output is already cleaned in the socket subscription, no need to filter again
        tab.buffer += output

        // Keep buffer size manageable (last 10000 characters)
        if (tab.buffer.length > 10000) {
          tab.buffer = tab.buffer.slice(-8000)
        }
        break
      }
    }
  }

  const activePaneData = computed(() =>
    panes.value.find(pane => pane.id === activePane.value) || null
  )

  const hasPanes = computed(() => panes.value.length > 0)

  const createPane = (workspaceId: string, name: string = 'Terminal') => {
    const paneId = `pane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newPane: TerminalPane = {
      id: paneId,
      name,
      isActive: false,
      tabs: [],
      activeTabId: null,
      size: { cols: 80, rows: 24 },
    }

    panes.value.push(newPane)

    // Set as active if it's the first pane
    if (panes.value.length === 1) {
      activePane.value = paneId
    }

    // Create first tab in the pane
    createTabInPane(paneId, workspaceId, 'Terminal')

    return newPane
  }

  const closePane = (paneId: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (!pane) return

    // Destroy all terminal sessions in the pane
    pane.tabs.forEach(tab => {
      if (socketService.isConnected) {
        socketService.destroyTerminal(tab.sessionId)
      }
      sessions.value.delete(tab.sessionId)
    })

    // Remove pane
    const index = panes.value.findIndex(p => p.id === paneId)
    if (index !== -1) {
      panes.value.splice(index, 1)
    }

    // Switch active pane if necessary
    if (activePane.value === paneId) {
      if (panes.value.length > 0) {
        activePane.value = panes.value[0].id
      } else {
        activePane.value = null
      }
    }
  }

  const setActivePane = (paneId: string) => {
    // Deactivate current pane
    if (activePane.value) {
      const currentPane = panes.value.find(p => p.id === activePane.value)
      if (currentPane) {
        currentPane.isActive = false
      }
    }

    // Activate new pane
    const newPane = panes.value.find(p => p.id === paneId)
    if (newPane) {
      newPane.isActive = true
      activePane.value = paneId
    }
  }

  const closeTabInPane = (paneId: string, tabId: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (!pane) return

    const tabIndex = pane.tabs.findIndex(t => t.id === tabId)
    if (tabIndex === -1) return

    const tab = pane.tabs[tabIndex]

    // Destroy terminal session
    if (socketService.isConnected) {
      socketService.destroyTerminal(tab.sessionId)
    }

    // Remove from sessions map
    sessions.value.delete(tab.sessionId)

    // Remove tab
    pane.tabs.splice(tabIndex, 1)

    // Update active tab if necessary
    if (pane.activeTabId === tabId) {
      if (pane.tabs.length > 0) {
        // Activate the tab at the same position, or the last one
        const newActiveIndex = Math.min(tabIndex, pane.tabs.length - 1)
        setActiveTabInPane(paneId, pane.tabs[newActiveIndex].id)
      } else {
        pane.activeTabId = null
        // If no tabs left, close the pane
        closePane(paneId)
      }
    }

    // Update tab orders
    pane.tabs.forEach((tab, index) => {
      tab.order = index
    })
  }

  const setActiveTabInPane = (paneId: string, tabId: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (!pane) return

    // Deactivate current tab
    if (pane.activeTabId) {
      const currentTab = pane.tabs.find(t => t.id === pane.activeTabId)
      if (currentTab) {
        currentTab.isActive = false
      }
    }

    // Activate new tab
    const newTab = pane.tabs.find(t => t.id === tabId)
    if (newTab) {
      newTab.isActive = true
      pane.activeTabId = tabId
    }
  }

  const moveTabBetweenPanes = (sourcePaneId: string, targetPaneId: string, tabId: string, targetIndex?: number) => {
    const sourcePane = panes.value.find(p => p.id === sourcePaneId)
    const targetPane = panes.value.find(p => p.id === targetPaneId)

    if (!sourcePane || !targetPane) return

    const tabIndex = sourcePane.tabs.findIndex(t => t.id === tabId)
    if (tabIndex === -1) return

    const [tab] = sourcePane.tabs.splice(tabIndex, 1)

    // Insert at target position or at the end
    const insertIndex = targetIndex !== undefined ? Math.min(targetIndex, targetPane.tabs.length) : targetPane.tabs.length
    targetPane.tabs.splice(insertIndex, 0, tab)

    // Update orders
    sourcePane.tabs.forEach((t, index) => t.order = index)
    targetPane.tabs.forEach((t, index) => t.order = index)

    // If source pane has no more tabs, close it
    if (sourcePane.tabs.length === 0) {
      closePane(sourcePaneId)
    }

    // If moving to a different pane, activate the tab in the target pane
    if (sourcePaneId !== targetPaneId) {
      setActiveTabInPane(targetPaneId, tabId)
      setActivePane(targetPaneId)
    }
  }

  const sendInput = (paneId: string, data: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane && pane.activeTabId && socketService.isConnected) {
      const activeTab = pane.tabs.find(t => t.id === pane.activeTabId)
      if (activeTab) {
        console.log(`Sending terminal data: ${JSON.stringify(data)} for session ${activeTab.sessionId}`)
        socketService.sendTerminalData(activeTab.sessionId, data)
      }
    } else if (!socketService.isConnected) {
      console.warn('Cannot send terminal data: WebSocket not connected')
    } else {
      console.warn(`Cannot find pane ${paneId} or active tab to send data`)
    }
  }

  const resizePaneTimeouts = new Map<string, number>()
  const lastResizeTimes = new Map<string, number>()
  const WEBSOCKET_RESIZE_DEBOUNCE_MS = 100

  const resizePane = (paneId: string, cols: number, rows: number) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (!pane) return

    // Check if dimensions are valid
    if (cols < 10 || rows < 5 || cols > 500 || rows > 200) {
      console.warn(`Invalid pane dimensions: ${cols}x${rows}, ignoring resize for pane ${paneId}`)
      return
    }

    // Check if size actually changed
    if (pane.size.cols === cols && pane.size.rows === rows) {
      return
    }

    // Update pane size immediately for UI responsiveness
    pane.size = { cols, rows }

    // Debounce WebSocket calls to prevent rapid successive calls
    const timeoutKey = paneId
    if (resizePaneTimeouts.has(timeoutKey)) {
      clearTimeout(resizePaneTimeouts.get(timeoutKey)!)
    }

    const now = Date.now()
    const lastResize = lastResizeTimes.get(timeoutKey) || 0

    // If too soon since last resize, debounce it
    if (now - lastResize < WEBSOCKET_RESIZE_DEBOUNCE_MS) {
      resizePaneTimeouts.set(timeoutKey, setTimeout(() => {
        performPaneResize(pane, cols, rows, timeoutKey)
      }, WEBSOCKET_RESIZE_DEBOUNCE_MS))
    } else {
      // Immediate resize if enough time has passed
      performPaneResize(pane, cols, rows, timeoutKey)
    }
  }

  const performPaneResize = (pane: TerminalPane, cols: number, rows: number, timeoutKey: string) => {
    console.log(`🔧 Performing WebSocket resize for pane ${pane.id} to ${cols}x${rows}`)
    lastResizeTimes.set(timeoutKey, Date.now())

    // Resize all tabs in the pane via WebSocket
    pane.tabs.forEach(tab => {
      tab.size = { cols, rows }
      if (socketService.isConnected) {
        socketService.resizeTerminal(tab.sessionId, cols, rows)
      }
    })

    // Clean up timeout reference
    resizePaneTimeouts.delete(timeoutKey)
  }

  const registerSession = (sessionId: string, session: TerminalSession) => {
    sessions.value.set(sessionId, session)
  }

  const unregisterSession = (sessionId: string) => {
    sessions.value.delete(sessionId)
  }

  const clearBuffer = (paneId: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane && pane.activeTabId) {
      const activeTab = pane.tabs.find(t => t.id === pane.activeTabId)
      if (activeTab) {
        activeTab.buffer = ''
      }
    }
  }

  const renamePane = (paneId: string, newName: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane) {
      pane.name = newName
    }
  }

  const currentLayout = ref<LayoutType>('single')

  const activeTab = computed(() => {
    return terminalTabs.value.find(tab => tab.sessionId === activeTabId.value) || null
  })

  const hasMultipleTabs = computed(() => terminalTabs.value.length > 1)

  const canSplitHorizontally = computed(() => viewportWidth.value >= 768)
  const canSplitVertically = computed(() => viewportWidth.value >= 1024)

  const gridTemplateColumns = computed(() => {
    const config = getLayoutConfig(currentLayout.value)
    return config.gridTemplateColumns
  })

  const gridTemplateRows = computed(() => {
    const config = getLayoutConfig(currentLayout.value)
    return config.gridTemplateRows
  })

  const createTerminal = async (workspaceId: string) => {
    const pane = createPane(workspaceId)
    console.log(`Creating terminal session in pane ${pane.id} for workspace ${workspaceId}`)

    // The first tab is already created in createPane, so we just need to set up session mapping
    if (pane.tabs.length > 0) {
      const firstTab = pane.tabs[0]
      const originalSessionId = firstTab.sessionId

      // Set up a one-time listener for the created event
      const handleCreated = (event: { sessionId?: string }) => {
        if (event.sessionId && event.sessionId !== originalSessionId) {
          console.log(`🔄 Mapping session ID from ${originalSessionId} to ${event.sessionId}`)
          const targetTab = pane.tabs.find(t => t.sessionId === originalSessionId)
          if (targetTab) {
            console.log(`✅ Found target tab ${targetTab.id}, updating session ID`)
            targetTab.sessionId = event.sessionId
          } else {
            console.warn(`⚠️ Could not find tab with session ID ${originalSessionId}`)
          }
        }
      }

      const subscription = socketService.subscribe('terminal:created', handleCreated)

      // Clean up after 5 seconds
      setTimeout(() => {
        subscription.unsubscribe()
      }, 5000)
    }

    return pane
  }

  const reconnectToExistingSession = async (workspaceId: string, sessionId: string, sessionName: string = 'Terminal', sessionBuffer: string = '') => {
    console.log(`🔄 Reconnecting to existing session ${sessionId} for workspace ${workspaceId}`)

    const paneId = `pane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newTab: TerminalTab = {
      id: tabId,
      sessionId, // Use the existing session ID
      name: sessionName,
      isActive: false,
      order: 0,
      buffer: sessionBuffer, // Load existing buffer
      size: { cols: 80, rows: 24 },
    }

    const newPane: TerminalPane = {
      id: paneId,
      name: sessionName,
      isActive: false,
      tabs: [newTab],
      activeTabId: tabId,
      size: { cols: 80, rows: 24 },
    }

    panes.value.push(newPane)

    // Set as active if it's the first pane
    if (panes.value.length === 1) {
      activePane.value = paneId
      newPane.isActive = true
    }

    // Set the tab as active
    setActiveTabInPane(paneId, tabId)

    // For existing sessions, call createTerminal to establish output routing
    // The backend now handles existing sessions properly and sets up WebSocket output
    if (socketService.isConnected) {
      console.log(`🔌 Establishing output routing for existing session ${sessionId}`)
      socketService.switchWorkspace(workspaceId)
      socketService.createTerminal(workspaceId, sessionId)
    }

    console.log(`✅ Reconnected to session ${sessionId} in pane ${paneId}`)
    return newPane
  }

  const closeTerminal = async (paneId: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane) {
      console.log(`Closing terminal pane ${paneId} with ${pane.tabs.length} tabs`)
      closePane(paneId)
    }
  }

  const setLayout = async (layout: LayoutType) => {
    // Enforce single layout on mobile
    if (viewportWidth.value < 768) {
      currentLayout.value = 'single'
      return
    }

    if (layoutRecommendations.value.supported.includes(layout)) {
      currentLayout.value = layout
    }
  }

  const updateViewportWidth = () => {
    viewportWidth.value = window.innerWidth
    updateLayoutRecommendations()
  }

  const updateLayoutRecommendations = () => {
    const supported = getSupportedLayouts(viewportWidth.value)
    const recommended = getRecommendedLayout(viewportWidth.value, terminalTabs.value.length)
    layoutRecommendations.value = { supported, recommended }
  }

  const addTab = (tab: TerminalTab) => {
    if (!terminalTabs.value.find(t => t.sessionId === tab.sessionId)) {
      terminalTabs.value.push(tab)
      if (!activeTabId.value) {
        activeTabId.value = tab.sessionId
      }
    }
  }

  const removeTab = (sessionId: string) => {
    const index = terminalTabs.value.findIndex(t => t.sessionId === sessionId)
    if (index !== -1) {
      terminalTabs.value.splice(index, 1)

      // Update active tab if necessary
      if (activeTabId.value === sessionId) {
        activeTabId.value = terminalTabs.value.length > 0 ? terminalTabs.value[0].sessionId : null
      }

      // Remove associated panes
      panes.value = panes.value.filter(p => !p.tabs.some(t => t.sessionId === sessionId))
    }
  }

  const setActiveTab = (sessionId: string) => {
    if (terminalTabs.value.find(t => t.sessionId === sessionId)) {
      activeTabId.value = sessionId
    }
  }

  // Drag and drop functionality
  const startDragTab = (tab: TerminalTab) => {
    draggedTab.value = tab
    dragState.value = {
      isDragging: true,
      draggedTabId: tab.sessionId
    }
  }

  const setDragOverPane = (paneId: string | null) => {
    dragOverPane.value = paneId
  }

  const setDragState = (newState: { isDragging: boolean; draggedTabId: string | null }) => {
    dragState.value = newState
  }

  const reorderTab = (draggedTabId: string, targetTabId: string) => {
    const draggedIndex = terminalTabs.value.findIndex(tab => tab.sessionId === draggedTabId)
    const targetIndex = terminalTabs.value.findIndex(tab => tab.sessionId === targetTabId)

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return

    // Remove dragged tab from current position
    const [draggedTab] = terminalTabs.value.splice(draggedIndex, 1)

    // Insert at new position
    terminalTabs.value.splice(targetIndex, 0, draggedTab)

    clearDragState()
  }

  const moveTabLeft = (tabId: string) => {
    const currentIndex = terminalTabs.value.findIndex(tab => tab.sessionId === tabId)
    if (currentIndex > 0) {
      const targetIndex = currentIndex - 1
      const tab = terminalTabs.value[currentIndex]
      terminalTabs.value.splice(currentIndex, 1)
      terminalTabs.value.splice(targetIndex, 0, tab)
    }
  }

  const moveTabRight = (tabId: string) => {
    const currentIndex = terminalTabs.value.findIndex(tab => tab.sessionId === tabId)
    if (currentIndex < terminalTabs.value.length - 1) {
      const targetIndex = currentIndex + 1
      const tab = terminalTabs.value[currentIndex]
      terminalTabs.value.splice(currentIndex, 1)
      terminalTabs.value.splice(targetIndex, 0, tab)
    }
  }

  const selectTab = (tabId: string) => {
    setActiveTab(tabId)
  }

  const dropTab = (targetPaneId: string) => {
    if (draggedTab.value && targetPaneId) {
      // Implementation for tab dropping logic
      draggedTab.value = null
      dragOverPane.value = null
    }
  }

  const clearDragState = () => {
    draggedTab.value = null
    dragOverPane.value = null
    dragState.value = {
      isDragging: false,
      draggedTabId: null
    }
  }

  const convertLayout = async (newLayout: LayoutType) => {
    // Advanced terminal layout management - to be implemented with pane creation logic
    setLayout(newLayout)
  }

  const initialize = () => {
    console.log('Terminal store initialized')
    initializeSocketSubscriptions()
    updateLayoutRecommendations()
  }

  const switchToWorkspace = (workspaceId: string) => {
    // Save current workspace state if we have one
    if (currentWorkspaceId.value) {
      workspaceTerminals.value.set(currentWorkspaceId.value, {
        panes: [...panes.value],
        activePane: activePane.value,
        sessions: new Map(sessions.value)
      })
      console.log(`Saved terminal state for workspace ${currentWorkspaceId.value}`)
    }

    // Load state for new workspace
    const workspaceState = workspaceTerminals.value.get(workspaceId)
    if (workspaceState) {
      // Restore terminals for this workspace
      panes.value = workspaceState.panes
      activePane.value = workspaceState.activePane
      sessions.value = workspaceState.sessions
      console.log(`Restored terminal state for workspace ${workspaceId}: ${panes.value.length} panes`)
    } else {
      // No previous state for this workspace, start clean
      panes.value = []
      activePane.value = null
      sessions.value = new Map()
      console.log(`No previous terminal state for workspace ${workspaceId}, starting clean`)
    }

    currentWorkspaceId.value = workspaceId
  }

  const getCurrentWorkspaceTerminalCount = () => {
    if (!currentWorkspaceId.value) return 0
    const workspaceState = workspaceTerminals.value.get(currentWorkspaceId.value)
    return workspaceState ? workspaceState.panes.length : panes.value.length
  }

  const cleanup = () => {
    cleanupSocketSubscriptions()

    // Clean up resize timeouts
    resizePaneTimeouts.forEach((timeout) => {
      clearTimeout(timeout)
    })
    resizePaneTimeouts.clear()
    lastResizeTimes.clear()

    // Clear workspace terminal state
    workspaceTerminals.value.clear()
  }

  return {
    // Original state
    panes: readonly(panes),
    activePane: readonly(activePane),
    sessions: readonly(sessions),
    activePaneData,
    hasPanes,

    // Enhanced state
    terminalTabs: readonly(terminalTabs),
    activeTabId: readonly(activeTabId),
    currentLayout: readonly(currentLayout),
    draggedTab: readonly(draggedTab),
    dragOverPane: readonly(dragOverPane),
    dragState: readonly(dragState),
    viewportWidth: readonly(viewportWidth),
    layoutRecommendations: readonly(layoutRecommendations),

    // Computed
    activeTab,
    hasMultipleTabs,
    canSplitHorizontally,
    canSplitVertically,
    gridTemplateColumns,
    gridTemplateRows,

    // Original actions
    createPane,
    closePane,
    setActivePane,
    sendInput,
    appendOutput,
    resizePane,
    registerSession,
    unregisterSession,
    clearBuffer,
    renamePane,
    createTerminal,
    reconnectToExistingSession,
    closeTerminal,
    initialize,

    // New tab management actions
    createTabInPane,
    closeTabInPane,
    setActiveTabInPane,
    moveTabBetweenPanes,

    // Enhanced actions
    setLayout,
    updateViewportWidth,
    updateLayoutRecommendations,
    addTab,
    removeTab,
    setActiveTab,
    startDragTab,
    setDragOverPane,
    setDragState,
    reorderTab,
    moveTabLeft,
    moveTabRight,
    selectTab,
    dropTab,
    clearDragState,
    convertLayout,
    cleanup,
    onTerminalOutput,

    // Workspace-aware functions
    switchToWorkspace,
    getCurrentWorkspaceTerminalCount,
  }
})
