import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type { FileItem } from '@/types'

interface Command {
  command: string
  description: string
}


export interface ResourceAlert {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: number
}

export interface SessionUpdate {
  sessionId: string
  type: 'created' | 'destroyed' | 'active'
  timestamp: number
  details?: Record<string, unknown>
}

export const useUIStore = defineStore('ui', () => {
  // Mobile and responsive state
  const isMobile = ref(false)
  const sidebarOpen = ref(false)
  const statsOpen = ref(false)
  
  // Mobile stats interface
  const statsExpanded = ref(false)
  const activeStatsTab = ref<'system' | 'sessions' | 'resources'>('system')

  // Active view management
  const activeView = ref<'terminal' | 'editor'>('terminal')
  
  // Theme management
  const showThemeModal = ref(false)

  // Settings management
  const showSettingsModal = ref(false)

  // Modal states
  const showDeleteModal = ref(false)
  const showDiscardModal = ref(false)
  const showCreateItemModal = ref(false)
  const showConfirmDeleteModal = ref(false)
  const showRepositoriesModal = ref(false)
  const showContextMenu = ref(false)
  const showBackgroundTasks = ref(false)
  const showTodoTasks = ref(false)
  const showQuickCommandOverlay = ref(false)
  
  // Modal data
  const createItemModalData = ref<{
    parentPath: string
  } | null>(null)
  
  const confirmDeleteModalData = ref<{
    itemName: string
    itemType: 'file' | 'folder' | 'workspace' | 'repository' | 'terminal'
    additionalInfo?: string
    showConfirmationInput?: boolean
    confirmationText?: string
    onConfirm: () => Promise<void> | void
  } | null>(null)

  // Context menu data
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuFile = ref<FileItem | null>(null)
  
  // Mobile actions menu
  const showMobileActionsMenu = ref(false)
  const showUtilityActions = ref(false)
  
  // Floating Action Button System  
  const showSecondaryFAB = ref(false)
  
  // Connection state
  const connectionError = ref<string | null>(null)
  
  // System monitoring
  const resourceAlerts = ref<ResourceAlert[]>([])
  const sessionUpdates = ref<SessionUpdate[]>([])
  const lastSessionCount = ref(0)
  
  // Mobile input proxy state
  const mobileInputOpen = ref(false)
  const mobileInputText = ref('')
  const activeModifiers = ref({ 
    ctrl: false, 
    alt: false, 
    shift: false 
  })
  const commandHistory = ref<string[]>([])
  const suggestions = ref<string[]>([])
  
  // Compact interface properties
  const overlayExpanded = ref(false)
  const contextualMode = ref(true)
  const historyPanelOpen = ref(false)
  const activeTab = ref<'actions' | 'commands' | 'keys'>('actions')
  
  // Touch and gesture state
  const touchStartTime = ref(0)
  const swipeStartY = ref(0)
  
  // Essential actions for mobile interface
  const essentialActions = ref([
    { key: 'Tab', label: 'Tab', description: 'Auto-complete' },
    { key: 'Escape', label: 'Esc', description: 'Cancel/Exit' },
    { key: 'ArrowUp', label: '↑', description: 'Previous command' },
    { key: 'ArrowDown', label: '↓', description: 'Next command' }
  ])
  
  // Top commands for mobile interface
  const topCommands = ref([
    { command: 'ls', description: 'List directory contents' },
    { command: 'git status', description: 'Check git status' },
    { command: 'npm install', description: 'Install dependencies' },
    { command: 'cd ..', description: 'Go to parent directory' }
  ])
  
  // Quick actions for mobile
  const quickActions = ref([
    { key: 'Tab', label: 'Tab', description: 'Auto-complete' },
    { key: 'Escape', label: 'Esc', description: 'Cancel/Exit' },
    { key: 'ArrowUp', label: '↑', description: 'Previous command' },
    { key: 'ArrowDown', label: '↓', description: 'Next command' },
    { key: 'ArrowLeft', label: '←', description: 'Move left' },
    { key: 'ArrowRight', label: '→', description: 'Move right' },
    { key: 'Home', label: 'Home', description: 'Beginning of line' },
    { key: 'End', label: 'End', description: 'End of line' },
    { key: 'Delete', label: 'Del', description: 'Delete character' },
    { key: 'Backspace', label: '⌫', description: 'Backspace' }
  ])
  
  // Common commands for mobile interface
  const commonCommands = ref<Command[]>([
    { command: 'ls', description: 'List directory contents' },
    { command: 'ls -la', description: 'List all files with details' },
    { command: 'cd', description: 'Change directory' },
    { command: 'pwd', description: 'Print working directory' },
    { command: 'clear', description: 'Clear terminal' },
    { command: 'vim', description: 'Open vim editor' },
    { command: 'nano', description: 'Open nano editor' },
    { command: 'git status', description: 'Check git status' },
    { command: 'git add .', description: 'Stage all changes' },
    { command: 'git commit -m ""', description: 'Commit changes' },
    { command: 'npm install', description: 'Install npm packages' },
    { command: 'npm run', description: 'Run npm script' }
  ])
  
  // Frequent letters for mobile input
  const frequentLetters = ref(['C', 'Z', 'X', 'V', 'A', 'S', 'D', 'F', 'Q', 'W', 'E', 'R'])

  // Computed properties
  const hasResourceAlerts = computed(() => resourceAlerts.value.length > 0)
  
  const hasSessionUpdates = computed(() => sessionUpdates.value.length > 0)
  
  const activeResourceAlerts = computed(() => 
    resourceAlerts.value.filter(alert => Date.now() - alert.timestamp < 300000) // 5 minutes
  )
  
  const recentSessionUpdates = computed(() =>
    sessionUpdates.value
      .filter(update => Date.now() - update.timestamp < 600000) // 10 minutes
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
  )
  
  
  const hasModifiersActive = computed(() => 
    activeModifiers.value.ctrl || activeModifiers.value.alt || activeModifiers.value.shift
  )

  // Actions
  const checkMobile = () => {
    isMobile.value = window.innerWidth <= 768
  }
  
  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value
  }

  const setActiveView = (view: 'terminal' | 'editor') => {
    activeView.value = view
  }
  
  const closeSidebar = () => {
    sidebarOpen.value = false
  }
  
  const openSidebar = () => {
    sidebarOpen.value = true
  }
  
  const toggleStats = () => {
    statsOpen.value = !statsOpen.value
  }
  
  const closeStats = () => {
    statsOpen.value = false
  }
  
  const toggleMobileActionsMenu = () => {
    showMobileActionsMenu.value = !showMobileActionsMenu.value
  }
  
  const closeMobileActionsMenu = () => {
    showMobileActionsMenu.value = false
  }
  
  const toggleSecondaryFAB = () => {
    showSecondaryFAB.value = !showSecondaryFAB.value
  }

  
  const openThemeModal = () => {
    showThemeModal.value = true
  }
  
  const closeThemeModal = () => {
    showThemeModal.value = false
  }

  const toggleThemeModal = () => {
    showThemeModal.value = !showThemeModal.value
  }

  // Settings modal
  const openSettingsModal = () => {
    showSettingsModal.value = true
  }

  const closeSettingsModal = () => {
    showSettingsModal.value = false
  }

  const toggleSettingsModal = () => {
    showSettingsModal.value = !showSettingsModal.value
  }

  // Background tasks modal
  const setShowBackgroundTasks = (show: boolean) => {
    showBackgroundTasks.value = show
  }

  // Todo tasks modal
  const setShowTodoTasks = (show: boolean) => {
    showTodoTasks.value = show
  }

  // Quick command overlay
  const openQuickCommandOverlay = () => {
    showQuickCommandOverlay.value = true
  }

  const closeQuickCommandOverlay = () => {
    showQuickCommandOverlay.value = false
  }

  const toggleQuickCommandOverlay = () => {
    showQuickCommandOverlay.value = !showQuickCommandOverlay.value
  }

  // Create item modal
  const openCreateItemModal = (parentPath: string) => {
    createItemModalData.value = { parentPath }
    showCreateItemModal.value = true
  }
  
  const closeCreateItemModal = () => {
    showCreateItemModal.value = false
    createItemModalData.value = null
  }
  
  // Confirm delete modal
  const openConfirmDeleteModal = (data: {
    itemName: string
    itemType: 'file' | 'folder' | 'workspace' | 'repository' | 'terminal'
    additionalInfo?: string
    showConfirmationInput?: boolean
    confirmationText?: string
    onConfirm: () => Promise<void> | void
  }) => {
    confirmDeleteModalData.value = data
    showConfirmDeleteModal.value = true
  }
  
  const closeConfirmDeleteModal = () => {
    showConfirmDeleteModal.value = false
    confirmDeleteModalData.value = null
  }

  // Repositories modal
  const openRepositoriesModal = async () => {
    showRepositoriesModal.value = true
    // Load repositories if needed
    const workspaceStore = await import('@/stores/workspace').then(m => m.useWorkspaceStore())
    if (!workspaceStore.hasRepositories) {
      await workspaceStore.loadRepositories()
    }
  }

  const closeRepositoriesModal = async () => {
    showRepositoriesModal.value = false
    // Clear cloning state
    const workspaceStore = await import('@/stores/workspace').then(m => m.useWorkspaceStore())
    workspaceStore.clearCloningState()
  }

  // Delete modal
  const openDeleteModal = () => {
    showDeleteModal.value = true
  }

  const closeDeleteModal = async () => {
    showDeleteModal.value = false
    // Clear delete state
    const workspaceStore = await import('@/stores/workspace').then(m => m.useWorkspaceStore())
    workspaceStore.clearDeleteState()
  }

  // Context menu
  const openContextMenu = (x: number, y: number, file: FileItem) => {
    contextMenuX.value = x
    contextMenuY.value = y
    contextMenuFile.value = file
    showContextMenu.value = true
  }

  const closeContextMenu = () => {
    showContextMenu.value = false
    contextMenuX.value = 0
    contextMenuY.value = 0
    contextMenuFile.value = null
  }

  // Mobile input management
  const openMobileInput = () => {
    mobileInputOpen.value = true
    mobileInputText.value = ''
  }
  
  const closeMobileInput = () => {
    mobileInputOpen.value = false
    mobileInputText.value = ''
    clearModifiers()
  }
  
  const updateMobileInputText = (text: string) => {
    mobileInputText.value = text
  }
  
  const clearModifiers = () => {
    activeModifiers.value = { ctrl: false, alt: false, shift: false }
  }
  
  const toggleModifier = (modifier: 'ctrl' | 'alt' | 'shift') => {
    activeModifiers.value[modifier] = !activeModifiers.value[modifier]
  }
  
  const addToCommandHistory = (command: string) => {
    if (command.trim() && !commandHistory.value.includes(command)) {
      commandHistory.value.unshift(command)
      
      // Keep only last 50 commands
      if (commandHistory.value.length > 50) {
        commandHistory.value = commandHistory.value.slice(0, 50)
      }
    }
  }
  
  const clearCommandHistory = () => {
    commandHistory.value = []
  }

  // Alert and notification management
  const addResourceAlert = (alert: Omit<ResourceAlert, 'id' | 'timestamp'>) => {
    const newAlert: ResourceAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }
    
    resourceAlerts.value.push(newAlert)
    
    // Auto-remove after 5 minutes
    setTimeout(() => {
      removeResourceAlert(newAlert.id)
    }, 300000)
  }
  
  const removeResourceAlert = (alertId: string) => {
    const index = resourceAlerts.value.findIndex(alert => alert.id === alertId)
    if (index !== -1) {
      resourceAlerts.value.splice(index, 1)
    }
  }
  
  const clearResourceAlerts = () => {
    resourceAlerts.value = []
  }
  
  const addSessionUpdate = (update: Omit<SessionUpdate, 'timestamp'>) => {
    sessionUpdates.value.push({
      ...update,
      timestamp: Date.now()
    })
    
    // Keep only last 50 updates
    if (sessionUpdates.value.length > 50) {
      sessionUpdates.value = sessionUpdates.value.slice(0, 50)
    }
  }
  
  const clearSessionUpdates = () => {
    sessionUpdates.value = []
  }
  
  const setConnectionError = (error: string | null) => {
    connectionError.value = error
  }
  
  const clearConnectionError = () => {
    connectionError.value = null
  }

  // Touch and gesture handlers
  const handleTouchStart = (y: number) => {
    touchStartTime.value = Date.now()
    swipeStartY.value = y
  }
  
  const handleTouchEnd = (y: number) => {
    const touchDuration = Date.now() - touchStartTime.value
    const swipeDistance = Math.abs(y - swipeStartY.value)
    
    // Detect swipe gestures
    if (touchDuration < 300 && swipeDistance > 50) {
      const direction = y > swipeStartY.value ? 'down' : 'up'
      
      if (direction === 'up' && !overlayExpanded.value) {
        overlayExpanded.value = true
      } else if (direction === 'down' && overlayExpanded.value) {
        overlayExpanded.value = false
      }
    }
  }
  
  const toggleOverlayExpanded = () => {
    overlayExpanded.value = !overlayExpanded.value
  }
  
  const setActiveTab = (tab: 'actions' | 'commands' | 'keys') => {
    activeTab.value = tab
  }
  
  const toggleContextualMode = () => {
    contextualMode.value = !contextualMode.value
  }
  
  const toggleHistoryPanel = () => {
    historyPanelOpen.value = !historyPanelOpen.value
  }

  return {
    // State
    isMobile: readonly(isMobile),
    sidebarOpen: readonly(sidebarOpen),
    statsOpen: readonly(statsOpen),
    statsExpanded: readonly(statsExpanded),
    activeStatsTab: readonly(activeStatsTab),
    showThemeModal: readonly(showThemeModal),
    showSettingsModal: readonly(showSettingsModal),
    showDeleteModal: readonly(showDeleteModal),
    showDiscardModal: readonly(showDiscardModal),
    showCreateItemModal: readonly(showCreateItemModal),
    showConfirmDeleteModal: readonly(showConfirmDeleteModal),
    showRepositoriesModal: readonly(showRepositoriesModal),
    showContextMenu: readonly(showContextMenu),
    showBackgroundTasks: readonly(showBackgroundTasks),
    showTodoTasks: readonly(showTodoTasks),
    showQuickCommandOverlay: readonly(showQuickCommandOverlay),
    createItemModalData: readonly(createItemModalData),
    confirmDeleteModalData: readonly(confirmDeleteModalData),
    contextMenuX: readonly(contextMenuX),
    contextMenuY: readonly(contextMenuY),
    contextMenuFile: readonly(contextMenuFile),
    showMobileActionsMenu: readonly(showMobileActionsMenu),
    showUtilityActions: readonly(showUtilityActions),
    showSecondaryFAB: readonly(showSecondaryFAB),
    connectionError: readonly(connectionError),
    resourceAlerts: readonly(resourceAlerts),
    sessionUpdates: readonly(sessionUpdates),
    lastSessionCount: readonly(lastSessionCount),
    mobileInputOpen: readonly(mobileInputOpen),
    mobileInputText: readonly(mobileInputText),
    activeModifiers: readonly(activeModifiers),
    commandHistory: readonly(commandHistory),
    suggestions: readonly(suggestions),
    overlayExpanded: readonly(overlayExpanded),
    contextualMode: readonly(contextualMode),
    historyPanelOpen: readonly(historyPanelOpen),
    activeTab: readonly(activeTab),
    activeView: readonly(activeView),
    touchStartTime: readonly(touchStartTime),
    swipeStartY: readonly(swipeStartY),
    essentialActions: readonly(essentialActions),
    topCommands: readonly(topCommands),
    quickActions: readonly(quickActions),
    commonCommands: readonly(commonCommands),
    frequentLetters: readonly(frequentLetters),

    // Computed
    hasResourceAlerts,
    hasSessionUpdates,
    activeResourceAlerts,
    recentSessionUpdates,
    hasModifiersActive,

    // Actions
    checkMobile,
    toggleSidebar,
    closeSidebar,
    openSidebar,
    setActiveView,
    toggleStats,
    closeStats,
    toggleMobileActionsMenu,
    closeMobileActionsMenu,
    toggleSecondaryFAB,
    openThemeModal,
    closeThemeModal,
    toggleThemeModal,
    openSettingsModal,
    closeSettingsModal,
    toggleSettingsModal,
    setShowBackgroundTasks,
    setShowTodoTasks,
    openQuickCommandOverlay,
    closeQuickCommandOverlay,
    toggleQuickCommandOverlay,
    openCreateItemModal,
    closeCreateItemModal,
    openConfirmDeleteModal,
    closeConfirmDeleteModal,
    openRepositoriesModal,
    closeRepositoriesModal,
    openDeleteModal,
    closeDeleteModal,
    openContextMenu,
    closeContextMenu,
    openMobileInput,
    closeMobileInput,
    updateMobileInputText,
    clearModifiers,
    toggleModifier,
    addToCommandHistory,
    clearCommandHistory,
    addResourceAlert,
    removeResourceAlert,
    clearResourceAlerts,
    addSessionUpdate,
    clearSessionUpdates,
    setConnectionError,
    clearConnectionError,
    handleTouchStart,
    handleTouchEnd,
    toggleOverlayExpanded,
    setActiveTab,
    toggleContextualMode,
    toggleHistoryPanel,
  }
})