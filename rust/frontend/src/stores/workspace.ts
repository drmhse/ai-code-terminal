import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Workspace, Session } from '@/types'
import { socketService } from '@/services/socket'
import { useLayoutStore } from '@/stores/layout'
import { apiService } from '@/services/api'

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
  
  // Enhanced repository management
  const repositories = ref<Repository[]>([])
  const repositoriesLoading = ref(false)
  const repositoryError = ref<string | null>(null)
  const repositoryPage = ref(1)
  const repositoryHasMore = ref(true)
  const repositoryLoadingMore = ref(false)
  const repositorySearchTerm = ref('')
  const searchTimeout = ref<number | null>(null)
  
  // Repository modals and UI state
  const showRepositoriesModal = ref(false)
  const cloningRepository = ref<Repository | null>(null)
  const cloneProgress = ref<CloneProgress | null>(null)
  const cloneError = ref<string | null>(null)
  
  // Workspace deletion state
  const showDeleteModal = ref(false)
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

  const fetchWorkspaces = async (ownerId?: string) => {
    console.log('🚀 fetchWorkspaces called with ownerId:', ownerId)
    loading.value = true
    error.value = null

    try {
      console.log('🔄 Making API call to getWorkspaces...')
      const data = await apiService.getWorkspaces(ownerId)
      console.log('✅ API call successful, received:', data)
      workspaces.value = data
      
      // Set current workspace if none selected and workspaces exist
      if (!currentWorkspace.value && data.length > 0) {
        currentWorkspace.value = data[0]
        console.log('✅ Set current workspace to:', currentWorkspace.value.name)
      }
    } catch (err) {
      error.value = 'Failed to fetch workspaces'
      console.error('❌ Failed to fetch workspaces:', err)
      console.error('Error details:', {
        error: err,
        ownerId,
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
      console.error('Failed to create workspace:', err)
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
      
      // Switch to another workspace if current one was deleted
      if (currentWorkspace.value?.id === id) {
        currentWorkspace.value = workspaces.value.length > 0 ? workspaces.value[0] : null
        if (currentWorkspace.value) {
          await switchWorkspace(currentWorkspace.value)
        }
      }
    } catch (err) {
      error.value = 'Failed to delete workspace'
      console.error('Failed to delete workspace:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const switchWorkspace = async (workspace: Workspace) => {
    const targetWorkspaceId = workspace.id

    // Clear any pending timeout
    if (workspaceSwitchTimeout) {
      clearTimeout(workspaceSwitchTimeout)
      workspaceSwitchTimeout = null
    }

    // If already switching, queue this switch
    if (isWorkspaceSwitching) {
      pendingWorkspaceSwitch = targetWorkspaceId
      return
    }

    // If already in this workspace, do nothing
    if (currentWorkspace.value?.id === targetWorkspaceId) {
      console.log('Already in workspace', workspace.name)
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
    if (isWorkspaceSwitching) return

    try {
      isWorkspaceSwitching = true
      const previousWorkspaceId = currentWorkspace.value?.id

      console.log(`Switching from workspace ${previousWorkspaceId} to ${workspace.id}`)

      // Update current workspace immediately for UI responsiveness
      currentWorkspace.value = workspace

      // Switch terminal store to new workspace context with proper cleanup
      await switchTerminalToWorkspace(workspace.id)

      // Notify WebSocket server about workspace switch
      if (socketService.isConnected) {
        socketService.switchWorkspace(workspace.id)
      }

      // Fetch sessions for the new workspace (don't clear existing ones)
      await fetchSessions(workspace.id)

      // Fetch layouts for the new workspace
      await fetchLayoutsForWorkspace(workspace.id)

      // Reload files for the new workspace context
      await reloadFilesForWorkspace(workspace.id)

      // Ensure the workspace has at least one terminal
      await ensureWorkspaceHasTerminal(workspace.id)

    } catch (error) {
      console.error('Error during workspace switch:', error)
    } finally {
      isWorkspaceSwitching = false
      pendingWorkspaceSwitch = null
      workspaceSwitchTimeout = null
    }
  }

const fetchSessions = async (workspaceId: string) => {
  if (!workspaceId) {
    console.warn('No workspace ID provided for fetchSessions')
    return
  }
  
  loading.value = true
  error.value = null

  try {
    const data = await apiService.getSessions(workspaceId)
    sessions.value = data
  } catch (err) {
    error.value = 'Failed to fetch sessions'
    console.error('Failed to fetch sessions:', err)
  } finally {
    loading.value = false
  }
}

const fetchLayoutsForWorkspace = async (workspaceId: string) => {
  if (!workspaceId) {
    console.warn('No workspace ID provided for fetchLayoutsForWorkspace')
    return
  }

  try {
    const layoutStore = useLayoutStore()
    await layoutStore.fetchLayouts(workspaceId)
  } catch (err) {
    console.error('Failed to fetch layouts for workspace:', err)
    // Don't throw here - layouts are not critical for workspace functionality
  }
}

const reloadFilesForWorkspace = async (workspaceId: string) => {
  if (!workspaceId) {
    console.warn('No workspace ID provided for reloadFilesForWorkspace')
    return
  }

  try {
    // Use dynamic import with proper await to avoid warnings
    const fileModule = await import('@/stores/file')
    const fileStore = fileModule.useFileStore()

    // Clear file cache and reload files with new workspace context
    fileStore.clearCache()
    await fileStore.refreshFiles('.', false, workspaceId)
    console.log(`Files reloaded for workspace ${workspaceId}`)
  } catch (err) {
    console.error('Failed to reload files for workspace:', err)
    // Don't throw here - file reloading failure shouldn't break workspace switching
  }
}

const switchTerminalToWorkspace = async (workspaceId: string) => {
  if (!workspaceId) {
    console.warn('No workspace ID provided for switchTerminalToWorkspace')
    return
  }

  try {
    // Use dynamic import with proper await to avoid warnings
    const terminalModule = await import('@/stores/terminal')
    const terminalStore = terminalModule.useTerminalStore()

    // Switch terminal store to workspace context
    terminalStore.switchToWorkspace(workspaceId)
    console.log(`Terminal store switched to workspace ${workspaceId}`)
  } catch (err) {
    console.error('Failed to switch terminal to workspace:', err)
    // Don't throw here - terminal switching failure shouldn't break workspace switching
  }
}

const ensureWorkspaceHasTerminal = async (workspaceId: string) => {
  if (!workspaceId) {
    console.warn('No workspace ID provided for ensureWorkspaceHasTerminal')
    return
  }

  try {
    // Use dynamic import with proper await to avoid warnings
    const terminalModule = await import('@/stores/terminal')
    const terminalStore = terminalModule.useTerminalStore()

    // Check if workspace already has restored frontend terminals
    if (terminalStore.hasPanes) {
      console.log(`✅ Workspace ${workspaceId} already has restored frontend terminals`)
      return
    }

    // First check for existing backend sessions
    console.log(`🔍 Checking for existing backend sessions in workspace ${workspaceId}`)
    const existingSessions = await discoverExistingSessions(workspaceId)

    if (existingSessions && existingSessions.length > 0) {
      console.log(`✅ Found ${existingSessions.length} existing backend sessions, reconnecting...`)
      await reconnectToSessions(existingSessions, workspaceId)
      return
    }

    // Production-quality logging and user feedback
    console.warn(`🔧 Backend session persistence unavailable for workspace ${workspaceId}`)
    console.info('ℹ️ Creating fresh terminal session - this is normal for new workspaces')

    // Check if this is a known workspace with expected sessions
    const workspaceState = terminalStore.getCurrentWorkspaceTerminalCount()
    if (workspaceState > 0) {
      console.warn(`⚠️ Expected ${workspaceState} terminal sessions but backend has none`)
      console.warn('📋 User workflows will be interrupted - consider implementing session persistence')
    }

    await terminalStore.createTerminal(workspaceId)
  } catch (err) {
    console.error('Failed to ensure workspace has terminal:', err)
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

        console.log(`📨 Received session data for workspace ${data.workspaceId}:`, data.sessions)

        subscription.unsubscribe()
        resolved = true

        if (!data.sessions || data.sessions.length === 0) {
          console.warn(`🔍 No backend sessions found for workspace ${workspaceId}`)
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
          console.warn(`⚠️ Found ${data.sessions.length} sessions but none are recoverable`)
          console.log('Session statuses:', data.sessions.map(s => ({ id: s.id, status: s.status, can_recover: s.can_recover })))
        }

        resolve(recoverableSessions)
      })

      // Request sessions for workspace
      console.log(`📤 Requesting sessions for workspace ${workspaceId}`)
      socketService.getWorkspaceSessions(workspaceId)

      // Longer timeout for production stability
      setTimeout(() => {
        if (resolved) return
        resolved = true
        subscription.unsubscribe()
        console.warn(`⏰ Backend session discovery timeout for workspace ${workspaceId}`)
        resolve(null)
      }, 10000) // Increased to 10 seconds

    } catch (error) {
      console.error('Error discovering sessions:', error)
      reject(error)
    }
  })
}

const reconnectToSessions = async (sessions: import('@/services/socket').WorkspaceSession[], workspaceId: string) => {
  try {
    console.log(`🔄 Reconnecting to ${sessions.length} sessions for workspace ${workspaceId}`)

    let successCount = 0
    for (const session of sessions) {
      if (session.recovery_token && session.can_recover) {
        try {
          console.log(`🔗 Attempting to recover session ${session.id} with token ${session.recovery_token}`)
          await recoverSession(session.recovery_token, session.id)
          successCount++
        } catch (error) {
          console.warn(`Failed to recover session ${session.id}:`, error)
        }
      } else {
        console.warn(`Session ${session.id} cannot be recovered - no token or not recoverable`)
      }
    }

    // Only create new terminal if no sessions were successfully recovered
    if (successCount === 0) {
      console.log('⚠️ No sessions were recovered, creating new terminal')
      const terminalModule = await import('@/stores/terminal')
      const terminalStore = terminalModule.useTerminalStore()
      await terminalStore.createTerminal(workspaceId)
    } else {
      console.log(`✅ Successfully recovered ${successCount} out of ${sessions.length} sessions`)
    }
  } catch (error) {
    console.error('Error reconnecting to sessions:', error)
    // Fallback: create new terminal
    const terminalModule = await import('@/stores/terminal')
    const terminalStore = terminalModule.useTerminalStore()
    await terminalStore.createTerminal(workspaceId)
  }
}

const recoverSession = (recoveryToken: string, sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Set up listener for recovery response
      const subscription = socketService.sessionRecovered$.subscribe((data) => {
        console.log(`📨 Session recovery response:`, data)

        if (data.sessionId === sessionId) {
          subscription.unsubscribe()
          if (data.success) {
            console.log(`✅ Successfully recovered session ${sessionId}`)
            resolve()
          } else {
            reject(new Error(`Failed to recover session ${sessionId}`))
          }
        }
      })

      // Request session recovery
      console.log(`📤 Requesting recovery for session ${sessionId}`)
      socketService.recoverSession(recoveryToken)

      // Set timeout
      setTimeout(() => {
        subscription.unsubscribe()
        reject(new Error(`Timeout recovering session ${sessionId}`))
      }, 10000)

    } catch (error) {
      console.error('Error recovering session:', error)
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
      console.error('Failed to load repositories:', err)
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
      showRepositoriesModal.value = false
      cloningRepository.value = null
      cloneProgress.value = null
      
      return workspace
    } catch (err) {
      cloneError.value = err instanceof Error ? err.message : 'Failed to clone repository'
      cloneProgress.value = null
      throw err
    }
  }
  
  const openRepositoriesModal = async () => {
    showRepositoriesModal.value = true
    if (!hasRepositories.value) {
      await loadRepositories()
    }
  }
  
  const closeRepositoriesModal = () => {
    showRepositoriesModal.value = false
    cloningRepository.value = null
    cloneProgress.value = null
    cloneError.value = null
  }
  
  const openDeleteModal = (workspace: Workspace) => {
    workspaceToDelete.value = workspace
    deleteFiles.value = false
    showDeleteModal.value = true
  }
  
  const closeDeleteModal = () => {
    showDeleteModal.value = false
    workspaceToDelete.value = null
    deleteFiles.value = false
    deletingWorkspace.value = false
  }
  
  const confirmDeleteWorkspace = async () => {
    if (!workspaceToDelete.value) return
    
    deletingWorkspace.value = true
    
    try {
      await deleteWorkspace(workspaceToDelete.value.id)
      closeDeleteModal()
    } catch (err) {
      console.error('Failed to delete workspace:', err)
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
    showRepositoriesModal,
    cloningRepository,
    cloneProgress,
    cloneError,
    showDeleteModal,
    workspaceToDelete,
    deleteFiles,
    deletingWorkspace,
    
    // Computed
    hasRepositories,
    filteredRepositories,
    
    // Original actions
    fetchWorkspaces,
    createWorkspace,
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
    openRepositoriesModal,
    closeRepositoriesModal,
    openDeleteModal,
    closeDeleteModal,
    confirmDeleteWorkspace,
    clearRepositoryError,
    clearCloneError,
  }
})