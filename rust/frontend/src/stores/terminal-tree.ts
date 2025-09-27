import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { TerminalSession } from '@/types'
import { socketService } from '@/services/socket'
import { apiService } from '@/services/api'
import type { Subscription } from '@/utils/reactive'
import { logger } from '@/utils/logger'
import type {
  PaneLayout,
  PaneNode,
  TerminalTab,
  SplitDirection
} from '@/types/pane-tree'
import {
  createInitialLayout,
  findNode,
  findActiveTerminalNode,
  getAllTerminalNodes,
  setActiveNode,
  splitNode,
  generateTabId,
  validatePaneTree,
  removeNode,
  moveTabBetweenPanes
} from '@/utils/pane-tree'

export const useTerminalTreeStore = defineStore('terminal-tree', () => {
  // Core state - replaced flat panes with hierarchical layout
  const layout = ref<PaneLayout | null>(null)
  const sessions = ref<Map<string, TerminalSession>>(new Map())
  const currentWorkspaceId = ref<string | null>(null)

  // PERFORMANCE: Cache for terminal node lookups
  let terminalNodesCache: PaneNode[] | null = null
  let layoutCacheKey: string | null = null

  // RACE CONDITION PROTECTION: Workspace switching guard
  let isWorkspaceSwitching = false
  let pendingWorkspaceSwitch: string | null = null


  let socketSubscriptions: Subscription[] = []
  const outputHandlers: ((sessionId: string, output: string) => void)[] = []
  let isInitialized = false

  // PERFORMANCE: Cached terminal node lookup with automatic invalidation
  const getCachedTerminalNodes = (): PaneNode[] => {
    if (!layout.value) return []

    const currentKey = layout.value.activeNodeId // Simple but effective cache key
    if (terminalNodesCache && layoutCacheKey === currentKey) {
      return terminalNodesCache
    }

    // Cache miss - compute and cache
    terminalNodesCache = getAllTerminalNodes(layout.value.root)
    layoutCacheKey = currentKey
    return terminalNodesCache
  }

  const invalidateTerminalCache = () => {
    terminalNodesCache = null
    layoutCacheKey = null
  }

  // RACE CONDITION PROTECTION: Check if session already exists in layout
  const findTabBySessionId = (sessionId: string): { paneId: string, tabId: string } | null => {
    if (!layout.value) return null

    const terminalNodes = getAllTerminalNodes(layout.value.root)
    for (const node of terminalNodes) {
      if (node.tabs) {
        const tab = node.tabs.find(t => t.sessionId === sessionId)
        if (tab) {
          return { paneId: node.id, tabId: tab.id }
        }
      }
    }
    return null
  }

  // WORKSPACE CLEANUP: Clear all existing tabs and sessions
  const clearAllTabsAndSessions = () => {
    if (!layout.value) return

    const terminalNodes = getAllTerminalNodes(layout.value.root)
    let clearedCount = 0

    for (const node of terminalNodes) {
      if (node.tabs) {
        // Clear all tabs without triggering WebSocket cleanup (workspace switch scenario)
        const tabCount = node.tabs.length
        node.tabs = []
        node.activeTabId = null
        clearedCount += tabCount
      }
    }

    // Clear sessions map
    sessions.value.clear()

    if (clearedCount > 0) {
      logger.log(`🧹 Cleared ${clearedCount} existing tabs for workspace switch`)
    }
  }

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
        logger.log(`📥 Terminal output received for session ${event.sessionId}:`, JSON.stringify(event.output))
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
        logger.log(`✅ Terminal created event received:`, event)

        // Update PID for the session across all terminal nodes
        if (layout.value) {
          const terminals = getAllTerminalNodes(layout.value.root)
          for (const terminal of terminals) {
            const tab = terminal.tabs?.find(t => t.sessionId === event.sessionId)
            if (tab) {
              tab.pid = event.pid
              logger.log(`✅ Updated PID for session ${event.sessionId} in terminal ${terminal.id}`)
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
    invalidateTerminalCache() // Cache invalidation on layout change
    logger.log(`✅ Initialized layout for workspace ${workspaceId}`)
  }

  const setActivePane = (paneId: string) => {
    if (!layout.value) return

    layout.value = setActiveNode(layout.value, paneId)
    invalidateTerminalCache() // Cache invalidation on layout change
    logger.log(`🎯 Set active pane: ${paneId}`)
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
      invalidateTerminalCache() // Cache invalidation on layout change

      // Set the new pane as active
      if (result.newPaneId) {
        setActivePane(result.newPaneId)
      }

      logger.log(`✅ Split pane ${targetPaneId} ${direction}, created ${result.newPaneId}`)

      return result.newPaneId
    } else {
      console.error(`❌ Split failed: ${result.error}`)
      return null
    }
  }

  // Tab management within nodes (OPTIMIZED)
  const createTabInPane = (paneId: string, workspaceId: string, name: string = 'Terminal', existingSessionId?: string, autoConnect: boolean = true) => {
    if (!layout.value) return null

    const nodeResult = findNode(layout.value.root, paneId)
    if (!nodeResult) {
      console.error(`Cannot find pane: ${paneId}`)
      return null
    }

    if (nodeResult.node.type !== 'terminal') {
      console.error(`Cannot create tab in non-terminal pane: ${paneId} (type: ${nodeResult.node.type})`)
      return null
    }

    // Use existing session ID for reconnection, or generate new one for fresh sessions
    const sessionId = existingSessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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

    // Create terminal session via WebSocket (if auto-connect enabled)
    if (autoConnect && socketService.isConnected) {
      socketService.createTerminal(workspaceId, sessionId, paneId)
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
        // Remove pane when no tabs left (VS Code/Zed behavior)
        layout.value = removeNode(layout.value, paneId)
        logger.log(`✅ Removed empty pane ${paneId}`)
        return // Exit early since pane structure changed
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
        logger.log(`Sending terminal data: ${JSON.stringify(data)} for session ${activeTab.sessionId}`)
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

  // Layout structure persistence - backend database only (NO session data, NO localStorage)

  const saveLayoutStructure = async (workspaceId: string, layoutName?: string) => {
    if (!workspaceId || !layout.value) return

    // Strip all session data before saving
    const cleanLayout = stripSessionDataFromLayout(layout.value)

    try {
      const response = await apiService.saveLayout({
        name: layoutName || `Layout ${new Date().toISOString()}`,
        layout_type: 'hierarchical',
        tree_structure: JSON.stringify(cleanLayout),
        workspace_id: workspaceId
      })

      logger.log(`💾 Saved layout structure for workspace ${workspaceId}:`, response.id)
      return response
    } catch (error) {
      console.warn('Failed to save layout:', error)
    }
  }

  // Strip session data from layout before saving to backend (structure only)
  const stripSessionDataFromLayout = (layout: PaneLayout): PaneLayout => {
    const stripNode = (node: PaneNode): PaneNode => {
      if (node.type === 'terminal') {
        return {
          ...node,
          tabs: [] // Remove all tabs with session data - save structure only
        }
      }
      return {
        ...node,
        children: node.children?.map(stripNode) as PaneNode[]
      }
    }

    return {
      ...layout,
      root: stripNode(layout.root)
    }
  }

  // Workspace management - always fresh from backend (no caching)
  const switchToWorkspace = async (workspaceId: string, autoRestoreSessions: boolean = true) => {
    logger.log(`🚀 switchToWorkspace called with workspaceId: ${workspaceId}, autoRestoreSessions: ${autoRestoreSessions}`)

    // CRITICAL: Prevent duplicate workspace switches (race condition fix)
    if (isWorkspaceSwitching) {
      if (pendingWorkspaceSwitch === workspaceId) {
        logger.log(`⏭️ Workspace switch to ${workspaceId} already in progress, ignoring duplicate`)
        return
      } else {
        logger.log(`⏸️ Different workspace switch (${workspaceId}) requested while switching to ${pendingWorkspaceSwitch}, queuing...`)
        pendingWorkspaceSwitch = workspaceId
        return
      }
    }

    // Early return if already on this workspace
    if (currentWorkspaceId.value === workspaceId && layout.value) {
      logger.log(`✅ Already on workspace ${workspaceId}, skipping switch`)
      return
    }

    isWorkspaceSwitching = true
    pendingWorkspaceSwitch = workspaceId

    try {
      logger.log(`🔄 Switching to workspace ${workspaceId} (no cache, always fresh)...`)

      // CLEAN SLATE: Clear existing tabs and sessions first
      clearAllTabsAndSessions()

      // Then clear layout and cache
      layout.value = null
      currentWorkspaceId.value = workspaceId
      invalidateTerminalCache()

      // Try to restore saved layout structure first
      let layoutRestored = false
      try {
        const layoutModule = await import('@/stores/layout')
        const layoutStore = layoutModule.useLayoutStore()

        // Get layouts for this workspace
        const workspaceLayouts = layoutStore.workspaceLayouts(workspaceId)
        console.log(`🔍 Found ${workspaceLayouts.length} layouts for workspace ${workspaceId}:`, workspaceLayouts)

        const savedLayout = workspaceLayouts.find(l => l.layout_type === 'hierarchical')
        console.log(`🔍 Found hierarchical layout:`, savedLayout)

        if (savedLayout && savedLayout.tree_structure) {
          console.log(`🔄 Restoring saved layout structure for workspace ${workspaceId}`)
          console.log(`🔍 Layout tree_structure:`, savedLayout.tree_structure)

          const parsedLayout = JSON.parse(savedLayout.tree_structure)
          console.log(`🔍 Parsed layout:`, parsedLayout)

          restoreLayout(parsedLayout)
          layoutRestored = true
          console.log(`✅ Restored layout structure with ${getAllTerminalNodes(parsedLayout.root).length} terminal nodes`)
        } else {
          console.log(`ℹ️ No saved layout structure found for workspace ${workspaceId}`)
        }
      } catch (error) {
        console.warn(`Failed to restore saved layout for workspace ${workspaceId}:`, error)
      }

      // POPULATE SESSIONS: Always populate sessions after successful layout restoration
      if (layoutRestored && autoRestoreSessions && socketService.isConnected) {
        try {
          console.log(`🔄 Populating restored layout with backend sessions for workspace ${workspaceId}`)

          // Get current sessions for this workspace
          const sessions = await apiService.getSessions(workspaceId)
          const activeSessions = sessions.filter(session =>
            session.status === 'active' || session.status === 'disconnected'
          )

          console.log(`🔍 Found ${activeSessions.length} active sessions to populate into restored layout`)

          if (activeSessions.length > 0) {
            await populateLayoutWithSessions(activeSessions, workspaceId)
          }
        } catch (error) {
          console.warn(`Failed to populate restored layout with sessions for workspace ${workspaceId}:`, error)
        }
      }

      // Fallback: create layout from backend sessions if no saved structure
      if (!layoutRestored && autoRestoreSessions && socketService.isConnected) {
        try {
          await createLayoutFromBackendSessions(workspaceId)
        } catch (error) {
          console.warn(`Failed to create layout from backend sessions for workspace ${workspaceId}:`, error)
          // Final fallback: create empty layout if backend fails
          layout.value = null
        }
      } else if (!layoutRestored) {
        // No session restoration and no saved layout - leave layout null for now
        layout.value = null
      }

      logger.log(`✅ Switched to workspace ${workspaceId} (fresh from backend)`)
    } finally {
      isWorkspaceSwitching = false

      // Handle any pending workspace switch
      if (pendingWorkspaceSwitch && pendingWorkspaceSwitch !== workspaceId) {
        const nextWorkspaceId = pendingWorkspaceSwitch
        pendingWorkspaceSwitch = null
        logger.log(`🔄 Processing queued workspace switch to ${nextWorkspaceId}`)
        await switchToWorkspace(nextWorkspaceId, autoRestoreSessions)
      } else {
        pendingWorkspaceSwitch = null
      }
    }
  }

  // Create layout from saved structure + current backend sessions (OPTIMIZED)
  const createLayoutFromBackendSessions = async (workspaceId: string) => {
    try {
      logger.log(`🔍 Fetching current sessions for workspace ${workspaceId}...`)

      const [sessions, layouts] = await Promise.all([
        apiService.getSessions(workspaceId),
        apiService.getLayouts(workspaceId).catch(() => [])
      ])

      const activeSessions = sessions.filter(session =>
        session.status === 'active' || session.status === 'disconnected'
      )

      // Parse layout structure once
      let layoutStructure = null
      const defaultLayout = layouts.find(l => l.is_default) || layouts[0]
      if (defaultLayout) {
        try {
          layoutStructure = JSON.parse(defaultLayout.tree_structure)
          logger.log(`📖 Loaded layout structure from backend for workspace ${workspaceId}`)
        } catch (error) {
          console.warn('Failed to parse layout structure:', error)
          layoutStructure = null
        }
      }

      // SINGLE DECISION POINT: Determine optimal strategy upfront
      const strategy = determineLayoutStrategy(activeSessions, layoutStructure)

      switch (strategy.type) {
        case 'fresh_with_sessions':
          initializeLayout(workspaceId)
          await populateLayoutWithSessions(activeSessions, workspaceId)
          break

        case 'restore_and_populate':
          layout.value = layoutStructure
          await populateLayoutWithSessions(activeSessions, workspaceId)
          break

        case 'restore_with_default_terminal':
          layout.value = layoutStructure
          // Create a terminal in ALL empty panes from the saved layout
          if (strategy.targetPaneIds && strategy.targetPaneIds.length > 0) {
            for (const paneId of strategy.targetPaneIds) {
              createTabInPane(paneId, workspaceId, 'Terminal', undefined, true)
            }
            // Set the first pane as active
            setActivePane(strategy.targetPaneIds[0])
            logger.log(`✅ Created default terminals in ${strategy.targetPaneIds.length} restored panes`)
          }
          break

        case 'fresh_empty':
          initializeLayout(workspaceId)
          createTabInPane(layout.value!.activeNodeId, workspaceId, 'Terminal', undefined, true)
          break

        default:
          layout.value = null
      }
    } catch (error) {
      console.warn(`Failed to create layout from backend sessions for workspace ${workspaceId}:`, error)
      throw error
    }
  }

  // PERFORMANCE OPTIMIZATION: Single analysis pass to determine strategy
  const determineLayoutStrategy = (activeSessions: any[], layoutStructure: any) => {
    const hasSessions = activeSessions.length > 0
    const hasLayout = !!layoutStructure

    if (!hasLayout && !hasSessions) {
      return { type: 'none' }
    }

    if (!hasLayout && hasSessions) {
      return { type: 'fresh_with_sessions' }
    }

    if (hasLayout && hasSessions) {
      // Check if layout is valid for session population (single tree traversal)
      const terminalNodes = getAllTerminalNodes(layoutStructure.root)
      return terminalNodes.length > 0
        ? { type: 'restore_and_populate' }
        : { type: 'fresh_with_sessions' }
    }

    if (hasLayout && !hasSessions) {
      // Check if layout has terminals and create default tab (single tree traversal)
      const terminalNodes = getAllTerminalNodes(layoutStructure.root)
      return terminalNodes.length > 0
        ? { type: 'restore_with_default_terminal', targetPaneIds: terminalNodes.map(node => node.id) }
        : { type: 'fresh_empty' }
    }

    return { type: 'none' }
  }

  // Populate layout structure with current sessions (OPTIMIZED + DEDUPLICATION)
  const populateLayoutWithSessions = async (sessions: any[], workspaceId: string) => {
    if (!layout.value || sessions.length === 0) return

    // PERFORMANCE: Use cached terminal nodes lookup
    const terminalNodes = getCachedTerminalNodes()
    if (terminalNodes.length === 0) {
      console.error(`❌ Cannot populate sessions: layout has no terminal nodes`)
      return
    }

    // CRITICAL DEDUPLICATION: Filter out sessions that already have tabs
    const newSessions = sessions.filter(session => {
      const existingTab = findTabBySessionId(session.id)
      if (existingTab) {
        logger.log(`⏭️ Session ${session.id} already has a tab (${existingTab.tabId}), skipping`)
        return false
      }
      return true
    })

    if (newSessions.length === 0) {
      logger.log(`✅ All sessions already populated, no new tabs needed`)
      return
    }

    console.log(`🔄 Distributing ${newSessions.length} sessions across ${terminalNodes.length} terminal panes`)
    logger.log(`🔄 Populating ${newSessions.length}/${sessions.length} new sessions (${sessions.length - newSessions.length} already exist)`)

    // INTELLIGENT SESSION PLACEMENT: Restore to original panes when possible
    const connectPromises = newSessions.map(async (session, index) => {
      try {
        let targetPaneId: string
        let placementReason: string

        // 1. INTELLIGENT PLACEMENT: Try to restore to original pane
        if (session.pane_id) {
          const originalPane = terminalNodes.find(node => node.id === session.pane_id)
          if (originalPane) {
            targetPaneId = session.pane_id
            placementReason = '🎯 restored to original pane'
          } else {
            // Original pane missing, use round-robin fallback
            const fallbackIndex = index % terminalNodes.length
            targetPaneId = terminalNodes[fallbackIndex].id
            placementReason = `🔄 original pane missing, fallback to pane ${fallbackIndex + 1}`
          }
        } else {
          // 2. LEGACY FALLBACK: No pane association, use round-robin
          const roundRobinIndex = index % terminalNodes.length
          targetPaneId = terminalNodes[roundRobinIndex].id
          placementReason = `🔄 legacy session, round-robin to pane ${roundRobinIndex + 1}`
        }

        console.log(`📍 Session ${session.id} → ${targetPaneId} (${placementReason})`)

        const tab = createTabInPane(
          targetPaneId,
          workspaceId,
          session.session_name || 'Terminal',
          session.id,
          false
        )

        if (tab && socketService.isConnected) {
          socketService.createTerminal(workspaceId, session.id, targetPaneId)
          return { success: true, sessionId: session.id, tabId: tab.id, paneId: targetPaneId }
        }
        return { success: false, sessionId: session.id, error: 'Failed to create tab' }
      } catch (error) {
        console.error(`Failed to populate session ${session.id}:`, error)
        return { success: false, sessionId: session.id, error }
      }
    })

    const results = await Promise.allSettled(connectPromises)
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length

    // Log distribution summary
    const successfulResults = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .map(r => (r as PromiseFulfilledResult<any>).value)

    const paneDistribution = successfulResults.reduce((acc, result) => {
      acc[result.paneId] = (acc[result.paneId] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(`✅ Session distribution complete: ${successful}/${newSessions.length} sessions distributed`)
    console.log(`📊 Pane distribution:`, Object.entries(paneDistribution).map(([paneId, count]) => `${paneId}: ${count} sessions`))

    logger.log(`✅ Populated layout with ${successful}/${newSessions.length} new sessions`)

    // AUTO-CREATE SESSIONS: Create new sessions for any empty panes
    const emptyPanes = terminalNodes.filter(node => !paneDistribution[node.id])
    if (emptyPanes.length > 0) {
      console.log(`🔧 Creating new sessions for ${emptyPanes.length} empty panes`)

      const createPromises = emptyPanes.map(async (pane) => {
        try {
          console.log(`🆕 Creating new session for empty pane ${pane.id}`)
          const newTab = createTabInPane(pane.id, workspaceId, 'Terminal', undefined, true)
          return { success: !!newTab, paneId: pane.id }
        } catch (error) {
          console.error(`Failed to create session for pane ${pane.id}:`, error)
          return { success: false, paneId: pane.id, error }
        }
      })

      const createResults = await Promise.allSettled(createPromises)
      const newSessionsCreated = createResults.filter(r => r.status === 'fulfilled' && r.value.success).length
      console.log(`✅ Created ${newSessionsCreated}/${emptyPanes.length} new sessions for empty panes`)
    }

    // FIX: Ensure at least one tab is active after session reconnection
    if (successful > 0 && layout.value) {
      const firstSuccessfulResult = results.find(r =>
        r.status === 'fulfilled' && r.value.success
      ) as PromiseFulfilledResult<{success: boolean, tabId: string, paneId: string}>

      if (firstSuccessfulResult?.value.tabId && firstSuccessfulResult?.value.paneId) {
        logger.log(`🎯 Activating first reconnected tab ${firstSuccessfulResult.value.tabId} in pane ${firstSuccessfulResult.value.paneId}`)
        setActiveTabInPane(firstSuccessfulResult.value.paneId, firstSuccessfulResult.value.tabId)
        setActivePane(firstSuccessfulResult.value.paneId)
      }
    }
  }

  // Helper function to check if session is recent (shared with component)
  const isRecentSession = (session: any): boolean => {
    const sessionTime = new Date(session.created_at).getTime()
    const now = Date.now()
    const twoHoursInMs = 2 * 60 * 60 * 1000 // 2 hours
    return (now - sessionTime) < twoHoursInMs
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
      return
    }

    // PERFORMANCE: Use cached terminal nodes lookup
    const terminalNodes = getCachedTerminalNodes()

    if (terminalNodes.length > 0) {
      // Simple case: add tab to existing terminal
      createTabInPane(terminalNodes[0].id, workspaceId, 'Terminal')
    } else {
      // Complex case: split or recreate layout
      const newPaneId = splitPane('horizontal', undefined, 'Terminal')
      if (newPaneId) {
        createTabInPane(newPaneId, workspaceId, 'Terminal')
      } else {
        // Last resort: recreate layout
        initializeLayout(workspaceId)
        if (layout.value) {
          createTabInPane(layout.value.activeNodeId, workspaceId, 'Terminal')
        }
      }
    }
  }

  // Pane resizing functionality
  const resizePanes = (parentContainerId: string, newSizes: number[]) => {
    if (!layout.value) return

    const nodeResult = findNode(layout.value.root, parentContainerId)
    if (!nodeResult || nodeResult.node.type !== 'container') {
      console.error(`Cannot resize - node ${parentContainerId} is not a container`)
      return
    }

    const container = nodeResult.node
    if (!container.children || container.children.length !== newSizes.length) {
      console.error(`Size array length (${newSizes.length}) does not match children count (${container.children?.length || 0})`)
      return
    }

    // Ensure sizes sum to 100
    const sum = newSizes.reduce((acc, size) => acc + size, 0)
    if (Math.abs(sum - 100) > 0.1) {
      console.warn(`Sizes do not sum to 100, normalizing: ${sum}`)
      const factor = 100 / sum
      newSizes = newSizes.map(size => size * factor)
    }

    // Update sizes
    container.children.forEach((child, index) => {
      child.size = Math.max(5, Math.min(95, newSizes[index])) // Clamp between 5% and 95%
    })

    logger.log(`🔄 Resized panes in container ${parentContainerId}:`, newSizes)
  }

  // Tab moving between panes functionality
  const moveTabBetweenPanes = (sourcePaneId: string, targetPaneId: string, tabId: string, targetIndex?: number) => {
    if (!layout.value) return false

    const sourceResult = findNode(layout.value.root, sourcePaneId)
    const targetResult = findNode(layout.value.root, targetPaneId)

    if (!sourceResult || !targetResult ||
        sourceResult.node.type !== 'terminal' ||
        targetResult.node.type !== 'terminal') {
      console.error(`Cannot move tab between non-terminal panes: ${sourcePaneId} -> ${targetPaneId}`)
      return false
    }

    const sourceNode = sourceResult.node
    const targetNode = targetResult.node

    if (!sourceNode.tabs) {
      console.error(`Source pane ${sourcePaneId} has no tabs`)
      return false
    }

    // Find and remove the tab from source pane
    const tabIndex = sourceNode.tabs.findIndex(t => t.id === tabId)
    if (tabIndex === -1) {
      console.error(`Tab ${tabId} not found in source pane ${sourcePaneId}`)
      return false
    }

    const tab = sourceNode.tabs[tabIndex]
    sourceNode.tabs.splice(tabIndex, 1)

    // Update tab orders in source pane
    sourceNode.tabs.forEach((tab, index) => {
      tab.order = index
    })

    // Handle active tab in source pane
    if (sourceNode.activeTabId === tabId) {
      if (sourceNode.tabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, sourceNode.tabs.length - 1)
        setActiveTabInPane(sourcePaneId, sourceNode.tabs[newActiveIndex].id)
      } else {
        sourceNode.activeTabId = null
        // If source pane is now empty, we'll remove it after the move is complete
      }
    }

    // Add tab to target pane
    if (!targetNode.tabs) {
      targetNode.tabs = []
    }

    const insertIndex = targetIndex !== undefined ?
      Math.min(targetIndex, targetNode.tabs.length) :
      targetNode.tabs.length

    // Deactivate tab before moving
    tab.isActive = false

    // Insert tab at specified position
    targetNode.tabs.splice(insertIndex, 0, tab)

    // Update tab orders in target pane
    targetNode.tabs.forEach((tab, index) => {
      tab.order = index
    })

    // Set moved tab as active in target pane
    setActiveTabInPane(targetPaneId, tabId)

    // Set target pane as active
    setActivePane(targetPaneId)

    logger.log(`🔄 Moved tab ${tabId} from pane ${sourcePaneId} to pane ${targetPaneId} at index ${insertIndex}`)

    // UPDATE BACKEND: Update session-pane association after successful move
    if (tab.sessionId && socketService.isConnected) {
      console.log(`🔄 Updating session ${tab.sessionId} pane association to ${targetPaneId}`)
      socketService.updateSessionPaneAssociation(tab.sessionId, targetPaneId)
    }

    // Remove source pane if it's now empty (VS Code/Zed behavior)
    if (sourceNode.tabs.length === 0) {
      layout.value = removeNode(layout.value, sourcePaneId)
      logger.log(`✅ Removed empty source pane ${sourcePaneId}`)
    }

    return true
  }

  // Pane closing functionality (VS Code/Zed style)
  const closePane = (paneId: string) => {
    if (!layout.value) return

    const nodeResult = findNode(layout.value.root, paneId)
    if (!nodeResult) {
      console.error(`Cannot find pane ${paneId}`)
      return
    }

    const { node } = nodeResult

    // Cannot close the root node if it's the only pane
    if (node === layout.value.root && node.type === 'terminal') {
      const terminals = getAllTerminalNodes(layout.value.root)
      if (terminals.length <= 1) {
        console.warn('Cannot close the last terminal pane')
        return
      }
    }

    // If this is a terminal node, clean up its tabs first
    if (node.type === 'terminal' && node.tabs) {
      for (const tab of node.tabs) {
        if (socketService.isConnected) {
          socketService.destroyTerminal(tab.sessionId)
        }
        sessions.value.delete(tab.sessionId)
      }
    }

    // Use the removeNode utility function for clean removal
    try {
      layout.value = removeNode(layout.value, paneId)
      logger.log(`🗑️ Closed pane ${paneId}`)
    } catch (error) {
      console.error(`Failed to close pane ${paneId}:`, error)
    }
  }

  // Method to restore layout (used by session reconnection)
  const restoreLayout = (savedLayout: PaneLayout) => {
    layout.value = savedLayout
    logger.log(`✅ Restored layout with ${getAllTerminalNodes(savedLayout.root).length} terminal nodes`)
  }

  const initialize = () => {
    if (isInitialized) {
      logger.log('Terminal tree store already initialized, skipping')
      return
    }
    logger.log('Terminal tree store initialized')
    initializeSocketSubscriptions()
    isInitialized = true
  }

  const cleanup = () => {
    cleanupSocketSubscriptions()

    // Clear current state - no saving needed
    layout.value = null
    currentWorkspaceId.value = null
    invalidateTerminalCache() // Cache cleanup
    isInitialized = false
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
    resizePanes,
    closePane,

    // Tab management
    createTabInPane,
    setActiveTabInPane,
    closeTabInPane,
    moveTabBetweenPanes,

    // Terminal operations
    sendInput,
    resizePane,

    // Session management
    appendOutput,
    onTerminalOutput,

    // Workspace
    switchToWorkspace,
    isRecentSession,

    // Database persistence (structure only)
    saveLayoutStructure,
    stripSessionDataFromLayout,

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