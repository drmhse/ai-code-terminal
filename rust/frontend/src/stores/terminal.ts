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
  sessionId: string
  sessionName: string
  pid?: number
  isDefault?: boolean
}

export interface TerminalPane {
  id: string
  sessionId: string
  title: string
  isActive: boolean
  buffer: string
  cwd?: string
  size: {
    cols: number
    rows: number
  }
}

export const useTerminalStore = defineStore('terminal', () => {
  const panes = ref<TerminalPane[]>([])
  const activePane = ref<string | null>(null)
  const sessions = ref<Map<string, TerminalSession>>(new Map())
  
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
  let outputHandlers: ((sessionId: string, output: string) => void)[] = []

  const initializeSocketSubscriptions = () => {
    socketSubscriptions.push(
      socketService.subscribe('terminal:output', (event) => {
        appendOutput(event.sessionId, event.output)
        // Notify all registered output handlers
        outputHandlers.forEach(handler => {
          try {
            handler(event.sessionId, event.output)
          } catch (error) {
            console.error('Error in terminal output handler:', error)
          }
        })
      }),
      
      socketService.subscribe('terminal:created', (event) => {
        const tab = terminalTabs.value.find(t => t.sessionId === event.sessionId)
        if (tab) {
          tab.pid = event.pid
        }
      }),
      
      socketService.subscribe('terminal:destroyed', (event) => {
        const pane = panes.value.find(p => p.sessionId === event.sessionId)
        if (pane) {
          closePane(pane.id)
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

  const activePaneData = computed(() => 
    panes.value.find(pane => pane.id === activePane.value) || null
  )

  const hasPanes = computed(() => panes.value.length > 0)

  const createPane = (workspaceId: string, title: string = 'Terminal') => {
    const paneId = `pane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newPane: TerminalPane = {
      id: paneId,
      sessionId,
      title,
      isActive: false,
      buffer: '',
      size: { cols: 80, rows: 24 },
    }

    panes.value.push(newPane)
    
    // Set as active if it's the first pane
    if (panes.value.length === 1) {
      setActivePane(paneId)
    }

    // Create terminal session via WebSocket
    if (socketService.isConnected) {
      socketService.createTerminal(workspaceId, sessionId)
    }

    return newPane
  }

  const closePane = (paneId: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (!pane) return

    // Destroy terminal session
    if (socketService.isConnected) {
      socketService.destroyTerminal(pane.sessionId)
    }

    // Remove from sessions map
    sessions.value.delete(pane.sessionId)

    // Remove pane
    const index = panes.value.findIndex(p => p.id === paneId)
    if (index !== -1) {
      panes.value.splice(index, 1)
    }

    // Switch active pane if necessary
    if (activePane.value === paneId) {
      if (panes.value.length > 0) {
        setActivePane(panes.value[0].id)
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

  const sendInput = (paneId: string, data: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane && socketService.isConnected) {
      socketService.sendTerminalData(pane.sessionId, data)
    }
  }

  const appendOutput = (sessionId: string, output: string) => {
    const pane = panes.value.find(p => p.sessionId === sessionId)
    if (pane) {
      pane.buffer += output
      
      // Keep buffer size manageable (last 10000 characters)
      if (pane.buffer.length > 10000) {
        pane.buffer = pane.buffer.slice(-8000)
      }
    }
  }

  const resizePane = (paneId: string, cols: number, rows: number) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane) {
      pane.size = { cols, rows }
      
      if (socketService.isConnected) {
        socketService.resizeTerminal(pane.sessionId, cols, rows)
      }
    }
  }

  const registerSession = (sessionId: string, session: TerminalSession) => {
    sessions.value.set(sessionId, session)
  }

  const unregisterSession = (sessionId: string) => {
    sessions.value.delete(sessionId)
  }

  const clearBuffer = (paneId: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane) {
      pane.buffer = ''
    }
  }

  const renamePane = (paneId: string, newTitle: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane) {
      pane.title = newTitle
    }
  }

  const currentLayout = ref<LayoutType>('single')
  
  const activePaneId = computed(() => activePane.value || null)
  
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
    socketService.createTerminal(workspaceId, pane.sessionId)
    return pane
  }

  const closeTerminal = async (paneId: string) => {
    const pane = panes.value.find(p => p.id === paneId)
    if (pane) {
      socketService.destroyTerminal(pane.sessionId)
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
      panes.value = panes.value.filter(p => p.sessionId !== sessionId)
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

  const cleanup = () => {
    cleanupSocketSubscriptions()
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
    activePaneId,
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
    closeTerminal,
    initialize,
    
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
  }
})