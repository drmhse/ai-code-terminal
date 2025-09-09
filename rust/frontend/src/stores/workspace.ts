import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Workspace, Session } from '@/types'
import { apiService } from '@/services/api'
import { socketService } from '@/services/socket'

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
    loading.value = true
    error.value = null

    try {
      const data = await apiService.getWorkspaces(ownerId)
      workspaces.value = data
      
      // Set current workspace if none selected and workspaces exist
      if (!currentWorkspace.value && data.length > 0) {
        currentWorkspace.value = data[0]
      }
    } catch (err) {
      error.value = 'Failed to fetch workspaces'
      console.error('Failed to fetch workspaces:', err)
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
    currentWorkspace.value = workspace
    
    // Notify WebSocket server about workspace switch
    if (socketService.isConnected) {
      socketService.switchWorkspace(workspace.id)
    }
    
    // Fetch sessions for the new workspace
    await fetchSessions(workspace.id)
  }

  const fetchSessions = async (workspaceId: string) => {
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