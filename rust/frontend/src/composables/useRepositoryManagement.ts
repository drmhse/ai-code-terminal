import { ref, readonly } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUIStore } from '@/stores/ui'
import type { Repository } from '@/stores/workspace'

/**
 * Repository management composable
 * Migrated from the original loadRepositories() and cloneRepository() methods
 */
export function useRepositoryManagement() {
  const workspaceStore = useWorkspaceStore()
  const uiStore = useUIStore()

  const scrollTimeout = ref<number | null>(null)
  const isLoadingMore = ref(false)

  // Load repositories with pagination and search (migrated from loadRepositories method)
  const loadRepositories = async (page = 1, append = false) => {
    try {
      // Delegate to workspace store
      await workspaceStore.loadRepositories(page, append)

      // Handle scroll to load more
      if (page === 1) {
        setupScrollHandler()
      }

    } catch (err) {
      console.error('Failed to load repositories:', err)
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Repository Load Failed',
        message: err instanceof Error ? err.message : 'Failed to load repositories'
      })
      throw err
    }
  }

  // Load more repositories when scrolling (migrated from scroll handling logic)
  const loadMoreRepositories = async () => {
    if (isLoadingMore.value || !workspaceStore.repositoryHasMore) return

    isLoadingMore.value = true

    try {
      await workspaceStore.loadMoreRepositories()
    } catch (err) {
      console.error('Failed to load more repositories:', err)
    } finally {
      isLoadingMore.value = false
    }
  }

  // Setup scroll handler for infinite scrolling
  const setupScrollHandler = () => {
    const repositoryList = document.querySelector('.repository-list')
    if (!repositoryList) return

    const handleScroll = () => {
      if (scrollTimeout.value) {
        clearTimeout(scrollTimeout.value)
      }

      scrollTimeout.value = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = repositoryList

        // Load more when 200px from bottom
        if (scrollHeight - scrollTop <= clientHeight + 200) {
          if (workspaceStore.repositoryHasMore && !workspaceStore.repositoryLoadingMore) {
            loadMoreRepositories()
          }
        }
      }, 100)
    }

    repositoryList.addEventListener('scroll', handleScroll)

    // Cleanup function
    return () => {
      repositoryList.removeEventListener('scroll', handleScroll)
      if (scrollTimeout.value) {
        clearTimeout(scrollTimeout.value)
      }
    }
  }

  // Search repositories with debouncing (migrated from repository search logic)
  const searchRepositories = (searchTerm: string) => {
    workspaceStore.searchRepositories(searchTerm)
  }

  // Clone repository with progress tracking (migrated from cloneRepository method)
  const cloneRepository = async (repository: Repository) => {
    try {
      console.log(`🔄 Starting clone of ${repository.full_name}...`)

      // Show progress notification
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Cloning Repository',
        message: `Starting clone of ${repository.full_name}...`
      })

      // Delegate to workspace store which handles progress tracking
      const workspace = await workspaceStore.cloneRepository(repository)

      console.log(`✅ Successfully cloned ${repository.full_name}`)

      // Show success notification
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Clone Complete',
        message: `Successfully cloned ${repository.full_name}`
      })

      return workspace

    } catch (err) {
      console.error(`❌ Failed to clone ${repository.full_name}:`, err)

      // Show error notification
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Clone Failed',
        message: err instanceof Error ? err.message : `Failed to clone ${repository.full_name}`
      })

      throw err
    }
  }

  // Open repositories modal and load repositories if needed
  const openRepositoriesModal = async () => {
    try {
      await workspaceStore.openRepositoriesModal()
    } catch (err) {
      console.error('Failed to open repositories modal:', err)
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Load Failed',
        message: 'Failed to load repositories'
      })
    }
  }

  // Close repositories modal
  const closeRepositoriesModal = () => {
    workspaceStore.closeRepositoriesModal()
  }

  // Repository selection and filtering
  const selectRepository = (repository: Repository) => {
    // Could add selection logic here if needed
    console.log('Repository selected:', repository.full_name)
  }

  // Get repository icon based on language
  const getRepositoryIcon = (language: string | null) => {
    if (!language) return 'folder'

    const iconMap: Record<string, string> = {
      'JavaScript': 'file-text',
      'TypeScript': 'file-text',
      'Python': 'file-text',
      'Java': 'file-text',
      'C++': 'file-text',
      'C#': 'file-text',
      'Go': 'file-text',
      'Rust': 'file-text',
      'PHP': 'file-text',
      'Ruby': 'file-text',
      'Swift': 'file-text',
      'Kotlin': 'file-text',
      'HTML': 'code',
      'CSS': 'code',
      'Vue': 'code',
      'React': 'code',
      'Shell': 'terminal',
      'Dockerfile': 'package',
      'Makefile': 'settings'
    }

    return iconMap[language] || 'file-text'
  }

  // Format repository size
  const formatRepositorySize = (sizeKb: number) => {
    if (sizeKb < 1024) {
      return `${sizeKb} KB`
    } else if (sizeKb < 1024 * 1024) {
      return `${Math.round(sizeKb / 1024)} MB`
    } else {
      return `${Math.round(sizeKb / (1024 * 1024))} GB`
    }
  }

  // Format last updated time
  const formatLastUpdated = (updatedAt: string) => {
    const date = new Date(updatedAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} month${months > 1 ? 's' : ''} ago`
    } else {
      const years = Math.floor(diffDays / 365)
      return `${years} year${years > 1 ? 's' : ''} ago`
    }
  }

  // Direct reactive references to store properties
  const hasRepositories = workspaceStore.hasRepositories
  const repositories = workspaceStore.repositories
  const filteredRepositories = workspaceStore.filteredRepositories
  const repositoriesLoading = workspaceStore.repositoriesLoading
  const repositoryError = workspaceStore.repositoryError
  const repositoryHasMore = workspaceStore.repositoryHasMore
  const repositoryLoadingMore = workspaceStore.repositoryLoadingMore
  const showRepositoriesModal = workspaceStore.showRepositoriesModal
  const cloningRepository = workspaceStore.cloningRepository
  const cloneProgress = workspaceStore.cloneProgress
  const cloneError = workspaceStore.cloneError
  const repositorySearchTerm = workspaceStore.repositorySearchTerm

  // Cleanup function
  const cleanup = () => {
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
    }
  }

  return {
    // State
    isLoadingMore: readonly(isLoadingMore),

    // Computed (from store)
    hasRepositories,
    repositories,
    filteredRepositories,
    repositoriesLoading,
    repositoryError,
    repositoryHasMore,
    repositoryLoadingMore,
    showRepositoriesModal,
    cloningRepository,
    cloneProgress,
    cloneError,
    repositorySearchTerm,

    // Methods
    loadRepositories,
    loadMoreRepositories,
    searchRepositories,
    cloneRepository,
    openRepositoriesModal,
    closeRepositoriesModal,
    selectRepository,
    getRepositoryIcon,
    formatRepositorySize,
    formatLastUpdated,
    cleanup
  }
}
