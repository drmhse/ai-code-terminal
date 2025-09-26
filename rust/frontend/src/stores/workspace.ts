import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Workspace, Session } from '@/types'
import { socketService } from '@/services/socket'
import { useLayoutStore } from '@/stores/layout'
import { useUIStore } from '@/stores/ui'
import { apiService } from '@/services/api'
import { logger } from '@/utils/logger'

export interface Repository {
  id: number | string
  name: string
  full_name: string
  description?: string
  html_url: string
  clone_url: string
  ssh_url: string
  private: boolean
  fork: boolean
  archived?: boolean
  disabled?: boolean
  updated_at: string
  language?: string | null
  stargazers_count: number
  forks_count: number
  size: number
  default_branch?: string
  pushed_at?: string
  owner?: {
    id: number
    login: string
    name?: string | null
    email?: string | null
    avatar_url: string
    html_url: string
    company?: string | null
    location?: string | null
    public_repos: number
    followers: number
    following: number
  }
}

export interface CloneProgress {
  repository: Repository
  progress: number
  stage: string
  message: string
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const uiStore = useUIStore()

  // Workspace switching control
  let isWorkspaceSwitching = false
  let pendingWorkspaceSwitch: string | null = null
  let workspaceSwitchTimeout: number | null = null
  const WORKSPACE_SWITCH_DEBOUNCE = 300 // ms

  // Original workspace state
  const workspaces = ref<Workspace[]>([])
  const currentWorkspace = ref<Workspace | null>(null)
  const sessions = ref<Session[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Watch for direct currentWorkspace changes (to catch bypassed switchWorkspace calls)
  watch(currentWorkspace, (newWorkspace, oldWorkspace) => {
    console.log('🔍 currentWorkspace changed directly from:', oldWorkspace?.name || 'null', 'to:', newWorkspace?.name || 'null')
    console.trace('🔍 Call stack for direct currentWorkspace change')
  }, { immediate: false })
  
  // Enhanced repository management
  const repositories = ref<Repository[]>([])
  const repositoriesLoading = ref(false)
  const repositoryError = ref<string | null>(null)
  const repositoryPage = ref(1)
  const repositoryHasMore = ref(true)
  const repositoryLoadingMore = ref(false)
  const repositorySearchTerm = ref('')
  const searchTimeout = ref<number | null>(null)
  
  // Repository cloning state
  const cloningRepository = ref<Repository | null>(null)
  const cloneProgress = ref<CloneProgress | null>(null)
  const cloneError = ref<string | null>(null)

  // Workspace deletion state (modal state moved to UI store)
  const workspaceToDelete = ref<Workspace | null>(null)
  const deleteFiles = ref(false)
  const deletingWorkspace = ref(false)

  

  const hasWorkspaces = computed(() => workspaces.value.length > 0)
  const hasRepositories = computed(() => repositories.value.length > 0)
  const filteredRepositories = computed((): Repository[] => {
    if (!repositorySearchTerm.value.trim()) {
      return repositories.value
    }
    const searchTerm = repositorySearchTerm.value.toLowerCase()
    return repositories.value.filter(repo => 
      repo.name.toLowerCase().includes(searchTerm) ||
      repo.full_name.toLowerCase().includes(searchTerm) ||
      (repo.description && repo.description.toLowerCase().includes(searchTerm))
    )
  })
  const selectedWorkspace = computed(() => currentWorkspace.value) // Alias for compatibility

  const fetchWorkspaces = async () => {
    logger.log('🚀 fetchWorkspaces called')
    loading.value = true
    error.value = null

    try {
      logger.log('🔄 Making API call to getWorkspaces...')
      const data = await apiService.getWorkspaces()
      logger.log('✅ API call successful, received:', data)
      workspaces.value = data
      
      // Set current workspace if none selected and workspaces exist
      if (!currentWorkspace.value && data.length > 0) {
        let targetWorkspace = data[0] // Default fallback

        // Try to restore previously selected workspace from user preferences
        try {
          const userPreferences = await apiService.getUserPreferences()
          if (userPreferences?.currentWorkspaceId) {
            const savedWorkspace = data.find(ws => ws.id === userPreferences.currentWorkspaceId)
            if (savedWorkspace) {
              targetWorkspace = savedWorkspace
              logger.log('✅ Restored workspace from user preferences:', targetWorkspace.name)
            } else {
              logger.warn('⚠️ Saved workspace not found, using first workspace as fallback')
              // Clear invalid stored workspace preference
              await apiService.setCurrentWorkspace(null)
            }
          } else {
            logger.log('ℹ️ No saved workspace preference, using first workspace')
          }
        } catch (preferencesError) {
          logger.warn('⚠️ Failed to load user preferences, using first workspace:', preferencesError)
        }

        currentWorkspace.value = targetWorkspace
        logger.log('✅ Set current workspace to:', targetWorkspace.name)

        // CRITICAL: Properly initialize terminal context for workspace
        try {
          await switchTerminalToWorkspace(targetWorkspace.id)
          await fetchLayoutsForWorkspace(targetWorkspace.id)
          logger.log('✅ Initialized terminal context for workspace')
        } catch (terminalError) {
          logger.warn('⚠️ Failed to initialize terminal context for workspace:', terminalError)
          // Don't throw - workspace loading should continue even if terminal initialization fails
        }
      }
    } catch (err) {
      error.value = 'Failed to fetch workspaces'
      logger.error('❌ Failed to fetch workspaces:', err)
      logger.error('Error details:', {
        error: err,
        hasToken: !!localStorage.getItem('jwt_token'),
        apiUrl: import.meta.env.VITE_API_BASE_URL
      })
    } finally {
      loading.value = false
    }
  }

  const createWorkspace = async (name: string, path: string) => {
    loading.value = true
    error.value = null

    try {
      const newWorkspace = await apiService.createWorkspace(name, path)
      workspaces.value.push(newWorkspace)

      // Auto-select the new workspace
      if (!currentWorkspace.value) {
        await switchWorkspace(newWorkspace)
      }

      return newWorkspace
    } catch (err) {
      error.value = 'Failed to create workspace'
      logger.error('Failed to create workspace:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createEmptyWorkspace = async (options: {
    name: string
    description?: string
    path?: string
  }) => {
    loading.value = true
    error.value = null

    try {
      const newWorkspace = await apiService.createEmptyWorkspace({
        name: options.name,
        description: options.description,
        path: options.path
      })

      workspaces.value.push(newWorkspace)

      // Auto-select the new workspace
      await switchWorkspace(newWorkspace)

      return newWorkspace
    } catch (err) {
      error.value = 'Failed to create empty workspace'
      logger.error('Failed to create empty workspace:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteWorkspace = async (id: string) => {
    loading.value = true
    error.value = null

    try {
      await apiService.deleteWorkspace(id)
      
      // Remove from local state
      const index = workspaces.value.findIndex(ws => ws.id === id)
      if (index !== -1) {
        workspaces.value.splice(index, 1)
      }
      
      // Clean up user preferences if the deleted workspace was saved there
      try {
        const userPreferences = await apiService.getUserPreferences()
        if (userPreferences?.currentWorkspaceId === id) {
          await apiService.setCurrentWorkspace(null)
          logger.log('🧹 Removed deleted workspace from user preferences')
        }
      } catch (preferencesError) {
        logger.warn('⚠️ Failed to clean up workspace preference:', preferencesError)
      }

      // Switch to another workspace if current one was deleted
      if (currentWorkspace.value?.id === id) {
        currentWorkspace.value = workspaces.value.length > 0 ? workspaces.value[0] : null
        if (currentWorkspace.value) {
          await switchWorkspace(currentWorkspace.value)
        }
      }
    } catch (err) {
      error.value = 'Failed to delete workspace'
      logger.error('Failed to delete workspace:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const switchWorkspace = async (workspace: Workspace) => {
    console.log('🚀 workspaceStore.switchWorkspace called with:', workspace.name)
    const targetWorkspaceId = workspace.id

    // Clear any pending timeout
    if (workspaceSwitchTimeout) {
      clearTimeout(workspaceSwitchTimeout)
      workspaceSwitchTimeout = null
    }

    // If already switching, queue this switch
    if (isWorkspaceSwitching) {
      console.log('⏸️ Already switching, queuing workspace switch to:', workspace.name)
      pendingWorkspaceSwitch = targetWorkspaceId
      return
    }

    // If already in this workspace, do nothing
    if (currentWorkspace.value?.id === targetWorkspaceId) {
      console.log('✅ Already in workspace, doing nothing:', workspace.name)
      logger.log('Already in workspace', workspace.name)
      return
    }

    // Set up debounced switch to prevent rapid switching
    workspaceSwitchTimeout = setTimeout(async () => {
      await performWorkspaceSwitch(workspace)

      // Handle any pending switch
      if (pendingWorkspaceSwitch && pendingWorkspaceSwitch !== targetWorkspaceId) {
        const pendingWorkspace = workspaces.value.find(w => w.id === pendingWorkspaceSwitch)
        if (pendingWorkspace) {
          pendingWorkspaceSwitch = null
          await switchWorkspace(pendingWorkspace)
        }
      }
    }, WORKSPACE_SWITCH_DEBOUNCE)
  }

  const performWorkspaceSwitch = async (workspace: Workspace) => {
    console.log('🚀 performWorkspaceSwitch called with:', workspace.name)
    if (isWorkspaceSwitching) {
      console.log('⏸️ performWorkspaceSwitch early return - already switching')
      return
    }

    try {
      console.log('🔄 performWorkspaceSwitch starting switch process')
      isWorkspaceSwitching = true
      const previousWorkspaceId = currentWorkspace.value?.id

      console.log(`🔄 Switching from workspace ${previousWorkspaceId} to ${workspace.id}`)
      logger.log(`Switching from workspace ${previousWorkspaceId} to ${workspace.id}`)

      // Update current workspace immediately for UI responsiveness
      console.log('🔄 Updating currentWorkspace.value to:', workspace.name)
      currentWorkspace.value = workspace

      // Save workspace preference to backend for multi-device persistence
      console.log('🔄 Saving workspace preference to backend')
      try {
        await apiService.setCurrentWorkspace(workspace.id)
        console.log('✅ Saved workspace preference to backend:', workspace.name)
        logger.log('💾 Saved workspace preference to backend:', workspace.name)
      } catch (preferencesError) {
        console.log('⚠️ Failed to save workspace preference:', preferencesError)
        logger.warn('⚠️ Failed to save workspace preference:', preferencesError)
        // Don't throw - workspace switching should continue even if preference saving fails
      }

      // Save current layout before switching (if we have an active workspace)
      console.log('🔄 About to save current layout. previousWorkspaceId:', previousWorkspaceId)
      if (previousWorkspaceId) {
        console.log('🔄 Saving current layout for previous workspace:', previousWorkspaceId)
        try {
          const terminalModule = await import('@/stores/terminal-tree')
          const terminalTreeStore = terminalModule.useTerminalTreeStore()
          const layoutStore = useLayoutStore()

          console.log('🔍 Terminal store layout exists:', !!terminalTreeStore.layout)
          if (terminalTreeStore.layout) {
            console.log('🔄 Stripping session data from layout')
            const structureOnly = terminalTreeStore.stripSessionDataFromLayout(terminalTreeStore.layout)
            const treeStructure = JSON.stringify(structureOnly)

            console.log('🔄 Calling debouncedSaveLayout')
            await layoutStore.debouncedSaveLayout(
              `Auto-saved on workspace switch`,
              previousWorkspaceId,
              treeStructure,
              'hierarchical',
              false,
              true // silent mode
            )
            console.log(`✅ Saved layout for previous workspace ${previousWorkspaceId}`)
            logger.log(`💾 Saved layout for previous workspace ${previousWorkspaceId}`)
          } else {
            console.log('ℹ️ No layout to save for previous workspace')
          }
        } catch (saveError) {
          console.log('⚠️ Failed to save previous workspace layout:', saveError)
          logger.warn('Failed to save previous workspace layout:', saveError)
          // Don't throw - layout saving failure shouldn't break workspace switching
        }
      } else {
        console.log('ℹ️ No previous workspace to save layout for')
      }

      // Fetch layouts for the new workspace first (needed for terminal layout restoration)
      console.log(`🔄 Fetching layouts for workspace ${workspace.id}`)
      await fetchLayoutsForWorkspace(workspace.id)
      console.log(`✅ Layouts fetched for workspace ${workspace.id}`)

      // Switch terminal store to new workspace context with proper cleanup
      console.log(`🔄 About to switch terminal to workspace`)
      await switchTerminalToWorkspace(workspace.id)
      console.log(`✅ Terminal switched to workspace`)

      // Notify WebSocket server about workspace switch
      console.log(`🔄 Notifying WebSocket server about workspace switch`)
      if (socketService.isConnected) {
        socketService.switchWorkspace(workspace.id)
        console.log(`✅ WebSocket notified about workspace switch`)
      } else {
        console.log(`⚠️ WebSocket not connected, skipping notification`)
      }

      // Fetch sessions for the new workspace (don't clear existing ones)
      console.log(`🔄 Fetching sessions for workspace`)
      await fetchSessions(workspace.id)
      console.log(`✅ Sessions fetched`)

      // Reload files for the new workspace context
      console.log(`🔄 Reloading files for workspace`)
      await reloadFilesForWorkspace(workspace.id)
      console.log(`✅ Files reloaded`)

      // Ensure the workspace has at least one terminal
      console.log('🔄 Ensuring workspace has terminal')
      await ensureWorkspaceHasTerminal(workspace.id)

      console.log('✅ performWorkspaceSwitch completed successfully for:', workspace.name)
    } catch (error) {
      console.log('❌ Error during workspace switch:', error)
      logger.error('Error during workspace switch:', error)
    } finally {
      console.log('🔧 performWorkspaceSwitch cleanup - resetting flags')
      isWorkspaceSwitching = false
      pendingWorkspaceSwitch = null
      workspaceSwitchTimeout = null
    }
  }

const fetchSessions = async (workspaceId: string) => {
  if (!workspaceId) {
    logger.warn('No workspace ID provided for fetchSessions')
    return
  }
  
  loading.value = true
  error.value = null

  try {
    const data = await apiService.getSessions(workspaceId)
    sessions.value = data
  } catch (err) {
    error.value = 'Failed to fetch sessions'
    logger.error('Failed to fetch sessions:', err)
  } finally {
    loading.value = false
  }
}

const fetchLayoutsForWorkspace = async (workspaceId: string) => {
  if (!workspaceId) {
    logger.warn('No workspace ID provided for fetchLayoutsForWorkspace')
    return
  }

  try {
    const layoutStore = useLayoutStore()
    logger.log(`🔄 fetchLayoutsForWorkspace: Calling layoutStore.fetchLayouts(${workspaceId})`)
    await layoutStore.fetchLayouts(workspaceId)

    // Clear currentLayout when switching workspaces to prevent cross-workspace auto-save issues
    layoutStore.setCurrentLayout(null)
    logger.log(`🔄 Cleared currentLayout for workspace switch`)

    logger.log(`✅ fetchLayoutsForWorkspace: Successfully fetched layouts for workspace ${workspaceId}`)
    logger.log(`🔍 Layout store now has ${layoutStore.layouts.length} total layouts`)

    const workspaceLayouts = layoutStore.workspaceLayouts(workspaceId)
    logger.log(`🔍 Layouts for workspace ${workspaceId}:`, workspaceLayouts)
  } catch (err) {
    logger.error('Failed to fetch layouts for workspace:', err)
    // Don't throw here - layouts are not critical for workspace functionality
  }
}

const reloadFilesForWorkspace = async (workspaceId: string) => {
  if (!workspaceId) {
    logger.warn('No workspace ID provided for reloadFilesForWorkspace')
    return
  }

  try {
    // Use dynamic import with proper await to avoid warnings
    const fileModule = await import('@/stores/file')
    const fileStore = fileModule.useFileStore()

    // Clear file cache and reload files with new workspace context
    fileStore.clearCache()
    await fileStore.refreshFiles('.', false, workspaceId)
    logger.log(`Files reloaded for workspace ${workspaceId}`)
  } catch (err) {
    logger.error('Failed to reload files for workspace:', err)
    // Don't throw here - file reloading failure shouldn't break workspace switching
  }
}

const switchTerminalToWorkspace = async (workspaceId: string) => {
  if (!workspaceId) {
    logger.warn('No workspace ID provided for switchTerminalToWorkspace')
    return
  }

  try {
    // Use dynamic import with proper await to avoid warnings
    const terminalModule = await import('@/stores/terminal-tree')
    const terminalTreeStore = terminalModule.useTerminalTreeStore()

    logger.log(`🔄 switchTerminalToWorkspace: Calling switchToWorkspace(${workspaceId})`)
    // Switch terminal store to workspace context
    terminalTreeStore.switchToWorkspace(workspaceId)
    logger.log(`✅ Terminal store switched to workspace ${workspaceId}`)
  } catch (err) {
    logger.error('Failed to switch terminal to workspace:', err)
    // Don't throw here - terminal switching failure shouldn't break workspace switching
  }
}

const ensureWorkspaceHasTerminal = async (workspaceId: string) => {
  if (!workspaceId) {
    logger.warn('No workspace ID provided for ensureWorkspaceHasTerminal')
    return
  }

  try {
    // Use dynamic import with proper await to avoid warnings
    const terminalModule = await import('@/stores/terminal-tree')
    const terminalTreeStore = terminalModule.useTerminalTreeStore()

    // Check if workspace already has restored frontend terminals
    if (terminalTreeStore.hasPanes) {
      logger.log(`✅ Workspace ${workspaceId} already has restored frontend terminals`)
      return
    }

    // First check for existing backend sessions
    logger.log(`🔍 Checking for existing backend sessions in workspace ${workspaceId}`)
    const existingSessions = await discoverExistingSessions(workspaceId)

    if (existingSessions && existingSessions.length > 0) {
      logger.log(`✅ Found ${existingSessions.length} existing backend sessions, reconnecting...`)
      await reconnectToSessions(existingSessions, workspaceId)
      return
    }

    // Production-quality logging and user feedback
    logger.warn(`🔧 Backend session persistence unavailable for workspace ${workspaceId}`)
    logger.info('ℹ️ Creating fresh terminal session - this is normal for new workspaces')

    // Check if this is a known workspace with expected sessions
    const workspaceTerminalCount = terminalTreeStore.allTerminalNodes.length
    if (workspaceTerminalCount > 0) {
      logger.warn(`⚠️ Expected ${workspaceTerminalCount} terminal sessions but backend has none`)
      logger.warn('📋 User workflows will be interrupted - consider implementing session persistence')
    }

    await terminalTreeStore.createTerminal(workspaceId)
  } catch (err) {
    logger.error('Failed to ensure workspace has terminal:', err)
    // Don't throw here - terminal creation failure shouldn't break workspace switching
  }
}

const discoverExistingSessions = (workspaceId: string): Promise<import('@/services/socket').WorkspaceSession[] | null> => {
  return new Promise((resolve, reject) => {
    try {
      let resolved = false

      // Set up listener for the response
      const subscription = socketService.workspaceSessions$.subscribe((data) => {
        if (resolved || data.workspaceId !== workspaceId) return

        logger.log(`📨 Received session data for workspace ${data.workspaceId}:`, data.sessions)

        subscription.unsubscribe()
        resolved = true

        if (!data.sessions || data.sessions.length === 0) {
          logger.warn(`🔍 No backend sessions found for workspace ${workspaceId}`)
          resolve([])
          return
        }

        // More lenient filtering - try to recover any available sessions
        const recoverableSessions = data.sessions.filter(s => {
          // Accept sessions that are active OR explicitly marked as recoverable
          return (s.status as string === 'active') ||
                 (s.can_recover === true) ||
                 (s.status as string === 'running') ||
                 (s.status as string === 'idle')
        })

        if (recoverableSessions.length === 0) {
          logger.warn(`⚠️ Found ${data.sessions.length} sessions but none are recoverable`)
          logger.log('Session statuses:', data.sessions.map(s => ({ id: s.id, status: s.status, can_recover: s.can_recover })))
        }

        resolve(recoverableSessions)
      })

      // Request sessions for workspace
      logger.log(`📤 Requesting sessions for workspace ${workspaceId}`)
      socketService.getWorkspaceSessions(workspaceId)

      // Longer timeout for production stability
      setTimeout(() => {
        if (resolved) return
        resolved = true
        subscription.unsubscribe()
        logger.warn(`⏰ Backend session discovery timeout for workspace ${workspaceId}`)
        resolve(null)
      }, 10000) // Increased to 10 seconds

    } catch (error) {
      logger.error('Error discovering sessions:', error)
      reject(error)
    }
  })
}

const reconnectToSessions = async (sessions: import('@/services/socket').WorkspaceSession[], workspaceId: string) => {
  try {
    logger.log(`🔄 Reconnecting to ${sessions.length} sessions for workspace ${workspaceId}`)

    let successCount = 0
    for (const session of sessions) {
      if (session.recovery_token && session.can_recover) {
        try {
          logger.log(`🔗 Attempting to recover session ${session.id} with token ${session.recovery_token}`)
          await recoverSession(session.recovery_token, session.id)
          successCount++
        } catch (error) {
          logger.warn(`Failed to recover session ${session.id}:`, error)
        }
      } else {
        logger.warn(`Session ${session.id} cannot be recovered - no token or not recoverable`)
      }
    }

    // Only create new terminal if no sessions were successfully recovered
    if (successCount === 0) {
      logger.log('⚠️ No sessions were recovered, creating new terminal')
      const terminalModule = await import('@/stores/terminal-tree')
      const terminalTreeStore = terminalModule.useTerminalTreeStore()
      await terminalTreeStore.createTerminal(workspaceId)
    } else {
      logger.log(`✅ Successfully recovered ${successCount} out of ${sessions.length} sessions`)
    }
  } catch (error) {
    logger.error('Error reconnecting to sessions:', error)
    // Fallback: create new terminal
    const terminalModule = await import('@/stores/terminal-tree')
    const terminalTreeStore = terminalModule.useTerminalTreeStore()
    await terminalTreeStore.createTerminal(workspaceId)
  }
}

const recoverSession = (recoveryToken: string, sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Set up listener for recovery response
      const subscription = socketService.sessionRecovered$.subscribe((data) => {
        logger.log(`📨 Session recovery response:`, data)

        if (data.sessionId === sessionId) {
          subscription.unsubscribe()
          if (data.success) {
            logger.log(`✅ Successfully recovered session ${sessionId}`)
            resolve()
          } else {
            reject(new Error(`Failed to recover session ${sessionId}`))
          }
        }
      })

      // Request session recovery
      logger.log(`📤 Requesting recovery for session ${sessionId}`)
      socketService.recoverSession(recoveryToken)

      // Set timeout
      setTimeout(() => {
        subscription.unsubscribe()
        reject(new Error(`Timeout recovering session ${sessionId}`))
      }, 10000)

    } catch (error) {
      logger.error('Error recovering session:', error)
      reject(error)
    }
  })
}

  const clearError = () => {
    error.value = null
  }
  
  const clearRepositoryError = () => {
    repositoryError.value = null
  }
  
  const clearCloneError = () => {
    cloneError.value = null
  }

  const selectWorkspace = switchWorkspace
  
  // Repository management actions
  const loadRepositories = async (page = 1, append = false) => {
    // Prevent duplicate calls when already loading
    if (page === 1 && repositoriesLoading.value) {
      return
    }
    
    if (page > 1 && repositoryLoadingMore.value) {
      return
    }
    
    if (page === 1) {
      repositoriesLoading.value = true
    } else {
      repositoryLoadingMore.value = true
    }
    
    repositoryError.value = null
    
    try {
      const data = await apiService.getRepositories(page, repositorySearchTerm.value)
      
      if (append && page > 1) {
        repositories.value.push(...data.repositories)
      } else {
        repositories.value = data.repositories
      }
      
      repositoryPage.value = page
      repositoryHasMore.value = data.hasMore
    } catch (err) {
      repositoryError.value = 'Failed to load repositories'
      logger.error('Failed to load repositories:', err)
    } finally {
      repositoriesLoading.value = false
      repositoryLoadingMore.value = false
    }
  }
  
  const loadMoreRepositories = async () => {
    if (repositoryHasMore.value && !repositoryLoadingMore.value) {
      await loadRepositories(repositoryPage.value + 1, true)
    }
  }
  
  const searchRepositories = (term: string) => {
    repositorySearchTerm.value = term
    
    if (searchTimeout.value) {
      clearTimeout(searchTimeout.value)
    }
    
    searchTimeout.value = setTimeout(async () => {
      await loadRepositories(1, false)
    }, 300)
  }
  
  const cloneRepository = async (repository: Repository) => {
    cloningRepository.value = repository
    cloneError.value = null
    cloneProgress.value = {
      repository,
      progress: 0,
      stage: 'initializing',
      message: 'Initializing clone...'
    }
    
    try {
      const workspace = await apiService.cloneRepository(repository.clone_url, repository.name)
      
      // Update progress
      cloneProgress.value = {
        repository,
        progress: 100,
        stage: 'complete',
        message: 'Clone complete!'
      }
      
      // Add to workspaces  
      workspaces.value.push(workspace)
      
      // Auto-select the new workspace
      if (!currentWorkspace.value) {
        await switchWorkspace(workspace)
      }
      
      // Close modal and clear state
      uiStore.closeRepositoriesModal()
      cloningRepository.value = null
      cloneProgress.value = null
      
      return workspace
    } catch (err) {
      cloneError.value = err instanceof Error ? err.message : 'Failed to clone repository'
      cloneProgress.value = null
      throw err
    }
  }
  
  const clearCloningState = () => {
    cloningRepository.value = null
    cloneProgress.value = null
    cloneError.value = null
  }

  const clearDeleteState = () => {
    workspaceToDelete.value = null
    deleteFiles.value = false
    deletingWorkspace.value = false
  }

  const prepareWorkspaceForDeletion = (workspace: Workspace) => {
    workspaceToDelete.value = workspace
    deleteFiles.value = false
  }
  
  const confirmDeleteWorkspace = async () => {
    if (!workspaceToDelete.value) return

    deletingWorkspace.value = true

    try {
      await deleteWorkspace(workspaceToDelete.value.id)
      // Close modal and clear state
      uiStore.closeDeleteModal()
    } catch (err) {
      logger.error('Failed to delete workspace:', err)
    } finally {
      deletingWorkspace.value = false
    }
  }

  return {
    // Original workspace state
    workspaces,
    currentWorkspace,
    selectedWorkspace,
    sessions,
    loading,
    error,
    hasWorkspaces,
    
    // Enhanced repository state
    repositories,
    repositoriesLoading,
    repositoryError,
    repositoryPage,
    repositoryHasMore,
    repositoryLoadingMore,
    repositorySearchTerm,
    cloningRepository,
    cloneProgress,
    cloneError,
    workspaceToDelete,
    deleteFiles,
    deletingWorkspace,
    
    // Computed
    hasRepositories,
    filteredRepositories,
    
    // Original actions
    fetchWorkspaces,
    createWorkspace,
    createEmptyWorkspace,
    deleteWorkspace,
    switchWorkspace,
    selectWorkspace,
    fetchSessions,
    clearError,
    
    // Enhanced repository actions
    loadRepositories,
    loadMoreRepositories,
    searchRepositories,
    cloneRepository,
    clearCloningState,
    clearRepositoryError,
    clearCloneError,

    // Workspace deletion actions
    prepareWorkspaceForDeletion,
    clearDeleteState,
    confirmDeleteWorkspace,
  }
})