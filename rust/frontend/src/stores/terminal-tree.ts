import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { TerminalSession } from '@/types'
import { socketService } from '@/services/socket'
import type { Subscription } from '@/utils/reactive'
import type {
  PaneLayout,
  PaneNode,
  TerminalTab,
  SplitDirection,
  PaneTreeState
} from '@/types/pane-tree'
import {
  createInitialLayout,
  findNode,
  findActiveTerminalNode,
  getAllTerminalNodes,
  setActiveNode,
  splitNode,
  generateTabId,
  createTerminalNode,
  validatePaneTree
} from '@/utils/pane-tree'

export const useTerminalTreeStore = defineStore('terminal-tree', () => {
  // Core state - replaced flat panes with hierarchical layout
  const layout = ref<PaneLayout | null>(null)
  const sessions = ref<Map<string, TerminalSession>>(new Map())
  const currentWorkspaceId = ref<string | null>(null)

  // Workspace-specific terminal layouts
  const workspaceLayouts = ref<Map<string, PaneLayout>>(new Map())

  let socketSubscriptions: Subscription[] = []
  const outputHandlers: ((sessionId: string, output: string) => void)[] = []

  // Computed properties
  const hasPanes = computed(() => layout.value !== null)

  const activeNode = computed(() => {
    if (!layout.value) return null
    const result = findNode(layout.value.root, layout.value.activeNodeId)
    return result?.node || null
  })

  const allTerminalNodes = computed(() => {
    if (!layout.value) return []
    return getAllTerminalNodes(layout.value.root)
  })

  const activeTerminalNode = computed(() => {
    if (!layout.value) return null
    return findActiveTerminalNode(layout.value.root)?.node || null
  })

  // Legacy compatibility - expose panes as computed
  const panes = computed(() => {
    if (!layout.value) return []

    return getAllTerminalNodes(layout.value.root).map(node => ({
      id: node.id,
      name: node.name || 'Terminal',
      isActive: node.isActive || false,
      tabs: node.tabs || [],
      activeTabId: node.activeTabId,
      size: { cols: 80, rows: 24 } // Default size - will be updated by terminal component
    }))
  })

  const activePane = computed(() => layout.value?.activeNodeId || null)

  const activePaneData = computed(() => {
    const active = activeTerminalNode.value
    if (!active) return null

    return {
      id: active.id,
      name: active.name || 'Terminal',
      isActive: active.isActive || false,
      tabs: active.tabs || [],
      activeTabId: active.activeTabId,
      size: { cols: 80, rows: 24 }
    }
  })

  // Socket subscriptions
  const initializeSocketSubscriptions = () => {
    socketSubscriptions.push(
      socketService.subscribe('terminal:output', (event) => {
        console.log(`📥 Terminal output received for session ${event.sessionId}:`, JSON.stringify(event.output))
        appendOutput(event.sessionId, event.output)

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

        // Update PID for the session across all terminal nodes
        if (layout.value) {
          const terminals = getAllTerminalNodes(layout.value.root)
          for (const terminal of terminals) {
            const tab = terminal.tabs?.find(t => t.sessionId === event.sessionId)
            if (tab) {
              tab.pid = event.pid
              console.log(`✅ Updated PID for session ${event.sessionId} in terminal ${terminal.id}`)
              break
            }
          }
        }
      }),

      socketService.subscribe('terminal:destroyed', (event) => {
        closeTabBySessionId(event.sessionId)
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

  // Terminal session management
  const appendOutput = (sessionId: string, output: string) => {
    if (!layout.value) return

    const terminals = getAllTerminalNodes(layout.value.root)
    for (const terminal of terminals) {
      const tab = terminal.tabs?.find(t => t.sessionId === sessionId)
      if (tab) {
        tab.buffer += output

        // Keep buffer size manageable
        if (tab.buffer.length > 10000) {
          tab.buffer = tab.buffer.slice(-8000)
        }
        break
      }
    }
  }

  // Layout management
  const initializeLayout = (workspaceId: string, initialTab?: TerminalTab) => {
    layout.value = createInitialLayout(workspaceId, initialTab)
    currentWorkspaceId.value = workspaceId
    console.log(`✅ Initialized layout for workspace ${workspaceId}`)
  }

  const setActivePane = (paneId: string) => {
    if (!layout.value) return

    layout.value = setActiveNode(layout.value, paneId)
    console.log(`🎯 Set active pane: ${paneId}`)
  }

  // Split functionality - the core new feature
  const splitPane = (direction: SplitDirection, paneId?: string, newPaneName?: string) => {
    if (!layout.value) return null

    const targetPaneId = paneId || layout.value.activeNodeId

    const result = splitNode(layout.value, {
      nodeId: targetPaneId,
      direction,
      newPaneData: {
        name: newPaneName || 'Terminal'
      }
    })

    if (result.success && result.newLayout) {
      layout.value = result.newLayout

      // Set the new pane as active
      if (result.newPaneId) {
        setActivePane(result.newPaneId)
      }

      console.log(`✅ Split pane ${targetPaneId} ${direction}, created ${result.newPaneId}`)

      // Save layout after split
      if (currentWorkspaceId.value) {
        savePaneStructure(currentWorkspaceId.value)
      }

      return result.newPaneId
    } else {
      console.error(`❌ Split failed: ${result.error}`)
      return null
    }
  }

  // Tab management within nodes
  const createTabInPane = (paneId: string, workspaceId: string, name: string = 'Terminal') => {
    if (!layout.value) return null

    const nodeResult = findNode(layout.value.root, paneId)
    if (!nodeResult || nodeResult.node.type !== 'terminal') {
      console.error(`Cannot create tab in non-terminal pane: ${paneId}`)
      return null
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tabId = generateTabId()

    const newTab: TerminalTab = {
      id: tabId,
      sessionId,
      name,
      isActive: false,
      order: nodeResult.node.tabs?.length || 0,
      buffer: '',
      size: { cols: 80, rows: 24 }
    }

    if (!nodeResult.node.tabs) {
      nodeResult.node.tabs = []
    }

    nodeResult.node.tabs.push(newTab)

    // Set as active tab if it's the first tab
    if (nodeResult.node.tabs.length === 1) {
      setActiveTabInPane(paneId, tabId)
    }

    // Create terminal session via WebSocket
    if (socketService.isConnected) {
      socketService.createTerminal(workspaceId, sessionId)
    }

    return newTab
  }

  const setActiveTabInPane = (paneId: string, tabId: string) => {
    if (!layout.value) return

    const nodeResult = findNode(layout.value.root, paneId)
    if (!nodeResult || nodeResult.node.type !== 'terminal') return

    const node = nodeResult.node

    // Deactivate current tab
    if (node.activeTabId && node.tabs) {
      const currentTab = node.tabs.find(t => t.id === node.activeTabId)
      if (currentTab) {
        currentTab.isActive = false
      }
    }

    // Activate new tab
    if (node.tabs) {
      const newTab = node.tabs.find(t => t.id === tabId)
      if (newTab) {
        newTab.isActive = true
        node.activeTabId = tabId
      }
    }
  }

  const closeTabInPane = (paneId: string, tabId: string) => {
    if (!layout.value) return

    const nodeResult = findNode(layout.value.root, paneId)
    if (!nodeResult || nodeResult.node.type !== 'terminal') return

    const node = nodeResult.node
    if (!node.tabs) return

    const tabIndex = node.tabs.findIndex(t => t.id === tabId)
    if (tabIndex === -1) return

    const tab = node.tabs[tabIndex]

    // Destroy terminal session
    if (socketService.isConnected) {
      socketService.destroyTerminal(tab.sessionId)
    }
    sessions.value.delete(tab.sessionId)

    // Remove tab
    node.tabs.splice(tabIndex, 1)

    // Update active tab if necessary
    if (node.activeTabId === tabId) {
      if (node.tabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, node.tabs.length - 1)
        setActiveTabInPane(paneId, node.tabs[newActiveIndex].id)
      } else {
        node.activeTabId = null
        // TODO: Handle pane removal when no tabs left
      }
    }

    // Update tab orders
    node.tabs.forEach((tab, index) => {
      tab.order = index
    })
  }

  const closeTabBySessionId = (sessionId: string) => {
    if (!layout.value) return

    const terminals = getAllTerminalNodes(layout.value.root)
    for (const terminal of terminals) {
      const tab = terminal.tabs?.find(t => t.sessionId === sessionId)
      if (tab) {
        closeTabInPane(terminal.id, tab.id)
        break
      }
    }
  }

  // Terminal operations
  const sendInput = (paneId: string, data: string) => {
    if (!layout.value || !socketService.isConnected) return

    const nodeResult = findNode(layout.value.root, paneId)
    if (!nodeResult || nodeResult.node.type !== 'terminal') return

    const node = nodeResult.node
    if (node.activeTabId && node.tabs) {
      const activeTab = node.tabs.find(t => t.id === node.activeTabId)
      if (activeTab) {
        console.log(`Sending terminal data: ${JSON.stringify(data)} for session ${activeTab.sessionId}`)
        socketService.sendTerminalData(activeTab.sessionId, data)
      }
    }
  }

  const resizePane = (paneId: string, cols: number, rows: number) => {
    if (!layout.value) return

    const nodeResult = findNode(layout.value.root, paneId)
    if (!nodeResult || nodeResult.node.type !== 'terminal') return

    const node = nodeResult.node
    if (node.tabs) {
      node.tabs.forEach(tab => {
        tab.size = { cols, rows }
        if (socketService.isConnected) {
          socketService.resizeTerminal(tab.sessionId, cols, rows)
        }
      })
    }
  }

  // Persistence
  const savePaneStructure = (workspaceId: string) => {
    if (!workspaceId || !layout.value) return

    const layoutData = {
      layout: layout.value,
      timestamp: Date.now()
    }

    try {
      localStorage.setItem(`pane_tree_${workspaceId}`, JSON.stringify(layoutData))
      console.log(`💾 Saved pane tree structure for workspace ${workspaceId}`)
    } catch (error) {
      console.warn('Failed to save pane tree structure:', error)
    }
  }

  const loadPaneStructure = (workspaceId: string): PaneLayout | null => {
    if (!workspaceId) return null

    try {
      const stored = localStorage.getItem(`pane_tree_${workspaceId}`)
      if (stored) {
        const data = JSON.parse(stored)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        if (Date.now() - data.timestamp < maxAge) {
          console.log(`📖 Loaded pane tree structure for workspace ${workspaceId}`)

          // Validate the structure
          const validation = validatePaneTree(data.layout.root)
          if (validation.valid) {
            return data.layout
          } else {
            console.warn('Invalid pane tree loaded:', validation.errors)
            localStorage.removeItem(`pane_tree_${workspaceId}`)
          }
        } else {
          localStorage.removeItem(`pane_tree_${workspaceId}`)
        }
      }
    } catch (error) {
      console.warn('Failed to load pane tree structure:', error)
    }
    return null
  }

  // Workspace management
  const switchToWorkspace = (workspaceId: string) => {
    // Save current workspace layout
    if (currentWorkspaceId.value && layout.value) {
      workspaceLayouts.value.set(currentWorkspaceId.value, layout.value)
      savePaneStructure(currentWorkspaceId.value)
    }

    // Load layout for new workspace
    const savedLayout = workspaceLayouts.value.get(workspaceId) || loadPaneStructure(workspaceId)
    if (savedLayout) {
      layout.value = savedLayout
    } else {
      layout.value = null
    }

    currentWorkspaceId.value = workspaceId
    console.log(`🔄 Switched to workspace ${workspaceId}`)
  }

  // Legacy compatibility methods
  const createPane = (workspaceId: string, name: string = 'Terminal') => {
    if (!layout.value) {
      initializeLayout(workspaceId)
    }

    if (layout.value) {
      const newPaneId = splitPane('horizontal', layout.value.activeNodeId, name)
      if (newPaneId) {
        // Create initial tab in the new pane
        createTabInPane(newPaneId, workspaceId, 'Terminal')
      }
    }
  }

  const createTerminal = async (workspaceId: string) => {
    if (!layout.value) {
      initializeLayout(workspaceId)
      if (layout.value) {
        createTabInPane(layout.value.activeNodeId, workspaceId, 'Terminal')
      }
    } else {
      // Split current active pane
      const newPaneId = splitPane('horizontal', undefined, 'Terminal')
      if (newPaneId) {
        createTabInPane(newPaneId, workspaceId, 'Terminal')
      }
    }
  }

  // Method to restore layout (used by session reconnection)
  const restoreLayout = (savedLayout: PaneLayout) => {
    layout.value = savedLayout
    console.log(`✅ Restored layout with ${getAllTerminalNodes(savedLayout.root).length} terminal nodes`)
  }

  const initialize = () => {
    console.log('Terminal tree store initialized')
    initializeSocketSubscriptions()
  }

  const cleanup = () => {
    cleanupSocketSubscriptions()

    // Save current layout
    if (currentWorkspaceId.value && layout.value) {
      savePaneStructure(currentWorkspaceId.value)
    }

    workspaceLayouts.value.clear()
  }

  return {
    // Core state - hierarchical
    layout: readonly(layout),
    sessions: readonly(sessions),
    currentWorkspaceId: readonly(currentWorkspaceId),

    // Computed
    hasPanes,
    activeNode,
    allTerminalNodes,
    activeTerminalNode,

    // Legacy compatibility
    panes,
    activePane,
    activePaneData,

    // New split functionality
    splitPane,

    // Pane management
    initializeLayout,
    setActivePane,

    // Tab management
    createTabInPane,
    setActiveTabInPane,
    closeTabInPane,

    // Terminal operations
    sendInput,
    resizePane,

    // Session management
    appendOutput,
    onTerminalOutput,

    // Workspace
    switchToWorkspace,

    // Persistence
    savePaneStructure,
    loadPaneStructure,

    // Legacy methods
    createPane,
    createTerminal,

    // Lifecycle
    initialize,
    cleanup,

    // Layout restore
    restoreLayout
  }
})