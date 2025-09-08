import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { apiService } from '@/services/api'

export interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  permissions?: string
  isHidden: boolean
  extension?: string
  path: string
}

export interface DirectoryCacheItem {
  files: FileItem[]
  timestamp: number
}

export const useFileStore = defineStore('file', () => {
  // File explorer state
  const fileExplorerEnabled = ref(true)
  const fileExplorerCollapsed = ref(false)
  const currentFiles = ref<FileItem[]>([])
  const currentPath = ref('.')
  const selectedFile = ref<FileItem | null>(null)
  const loadingFiles = ref(false)
  const fileError = ref<string | null>(null)
  const showHiddenFiles = ref(false)
  
  // Directory caching
  const directoryCache = ref<Map<string, DirectoryCacheItem>>(new Map())
  const cacheTimeout = ref(5 * 60 * 1000) // 5 minutes
  
  // File search
  const fileSearchTerm = ref('')
  const fileSearchTimeout = ref<number | null>(null)
  const selectedFileIndex = ref(-1)
  
  // Context menu
  const showContextMenu = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuFile = ref<FileItem | null>(null)
  
  // File preview modal
  const showFilePreviewModal = ref(false)
  const previewFile = ref<FileItem | null>(null)
  const previewData = ref<string | null>(null)
  const previewLoading = ref(false)
  const previewError = ref<string | null>(null)
  
  // Discard changes modal
  const showDiscardModal = ref(false)
  const discardAction = ref<'exitEdit' | 'closeModal'>('exitEdit')
  const changesSummary = ref('')

  // Computed properties
  const filteredFiles = computed(() => {
    if (!fileSearchTerm.value || fileSearchTerm.value.trim() === '') {
      return currentFiles.value.filter(file =>
        showHiddenFiles.value || !file.isHidden
      )
    }

    const searchTerm = fileSearchTerm.value.toLowerCase().trim()
    return currentFiles.value.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(searchTerm)
      const matchesHidden = showHiddenFiles.value || !file.isHidden
      return matchesSearch && matchesHidden
    })
  })

  const pathSegments = computed(() => {
    if (!currentPath.value || currentPath.value === '.') {
      return []
    }
    return currentPath.value.split('/').filter(segment => segment.length > 0)
  })

  const hasFiles = computed(() => currentFiles.value.length > 0)
  
  const selectedFileData = computed(() => {
    if (selectedFileIndex.value >= 0 && selectedFileIndex.value < filteredFiles.value.length) {
      return filteredFiles.value[selectedFileIndex.value]
    }
    return null
  })

  // Actions
  const clearFileError = () => {
    fileError.value = null
  }
  
  const clearPreviewError = () => {
    previewError.value = null
  }

  const refreshFiles = async (path?: string, useCache = true) => {
    const targetPath = path || currentPath.value
    
    // Check cache first if enabled
    if (useCache) {
      const cached = directoryCache.value.get(targetPath)
      if (cached && (Date.now() - cached.timestamp) < cacheTimeout.value) {
        currentFiles.value = cached.files
        currentPath.value = targetPath
        return cached.files
      }
    }

    loadingFiles.value = true
    fileError.value = null

    try {
      const files = await apiService.getDirectoryContents(targetPath)
      
      // Process files
      const processedFiles: FileItem[] = files.map((file: any) => ({
        name: file.name,
        type: file.isDirectory ? 'directory' as const : 'file' as const,
        size: file.size,
        modified: file.mtime,
        permissions: file.mode,
        isHidden: file.name.startsWith('.'),
        extension: file.isDirectory ? undefined : file.name.split('.').pop()?.toLowerCase(),
        path: `${targetPath}/${file.name}`.replace(/^\.\//, '')
      }))

      // Sort: directories first, then files, alphabetically
      processedFiles.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true })
      })

      currentFiles.value = processedFiles
      currentPath.value = targetPath
      
      // Update cache
      directoryCache.value.set(targetPath, {
        files: processedFiles,
        timestamp: Date.now()
      })
      
      return processedFiles
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to load files'
      console.error('Failed to refresh files:', err)
      throw err
    } finally {
      loadingFiles.value = false
    }
  }

  const navigateToPath = async (path: string) => {
    await refreshFiles(path)
  }

  const navigateUp = async () => {
    if (currentPath.value === '.' || currentPath.value === '/') return
    
    const parentPath = currentPath.value.split('/').slice(0, -1).join('/') || '.'
    await navigateToPath(parentPath)
  }

  const navigateToSegment = async (segmentIndex: number) => {
    const segments = pathSegments.value.slice(0, segmentIndex + 1)
    const path = segments.length > 0 ? segments.join('/') : '.'
    await navigateToPath(path)
  }

  const openDirectory = async (directory: FileItem) => {
    if (directory.type !== 'directory') return
    
    const newPath = directory.path
    await navigateToPath(newPath)
  }

  const selectFile = (file: FileItem, index?: number) => {
    selectedFile.value = file
    if (typeof index === 'number') {
      selectedFileIndex.value = index
    }
  }

  const clearSelection = () => {
    selectedFile.value = null
    selectedFileIndex.value = -1
  }

  const searchFiles = (term: string) => {
    fileSearchTerm.value = term
    
    if (fileSearchTimeout.value) {
      clearTimeout(fileSearchTimeout.value)
    }
    
    // Reset selection when searching
    selectedFileIndex.value = -1
  }

  const clearSearch = () => {
    fileSearchTerm.value = ''
    selectedFileIndex.value = -1
  }

  const toggleHiddenFiles = () => {
    showHiddenFiles.value = !showHiddenFiles.value
  }

  const toggleFileExplorer = () => {
    fileExplorerCollapsed.value = !fileExplorerCollapsed.value
  }

  // Context menu actions
  const openContextMenu = (file: FileItem, x: number, y: number) => {
    contextMenuFile.value = file
    contextMenuX.value = x
    contextMenuY.value = y
    showContextMenu.value = true
  }

  const closeContextMenu = () => {
    showContextMenu.value = false
    contextMenuFile.value = null
    contextMenuX.value = 0
    contextMenuY.value = 0
  }

  // File preview actions
  const showFilePreview = async (file: FileItem) => {
    previewFile.value = file
    previewLoading.value = true
    previewError.value = null
    showFilePreviewModal.value = true

    try {
      const content = await apiService.getFileContent(file.path)
      previewData.value = content
    } catch (err) {
      previewError.value = err instanceof Error ? err.message : 'Failed to load file'
      console.error('Failed to preview file:', err)
    } finally {
      previewLoading.value = false
    }
  }

  const refreshFilePreview = async () => {
    if (!previewFile.value) return
    await showFilePreview(previewFile.value)
  }

  const closeFilePreviewModal = () => {
    showFilePreviewModal.value = false
    previewFile.value = null
    previewData.value = null
    previewError.value = null
  }

  // Discard changes modal
  const openDiscardModal = (action: 'exitEdit' | 'closeModal', summary = '') => {
    discardAction.value = action
    changesSummary.value = summary
    showDiscardModal.value = true
  }

  const closeDiscardModal = () => {
    showDiscardModal.value = false
    discardAction.value = 'exitEdit'
    changesSummary.value = ''
  }

  // File operations
  const createFile = async (name: string, content = '') => {
    try {
      await apiService.createFile(currentPath.value, name, content)
      await refreshFiles(currentPath.value, false) // Don't use cache
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to create file'
      throw err
    }
  }

  const createDirectory = async (name: string) => {
    try {
      await apiService.createDirectory(currentPath.value, name)
      await refreshFiles(currentPath.value, false) // Don't use cache
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to create directory'
      throw err
    }
  }

  const deleteFile = async (file: FileItem) => {
    try {
      await apiService.deleteFile(file.path)
      await refreshFiles(currentPath.value, false) // Don't use cache
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to delete file'
      throw err
    }
  }

  const renameFile = async (file: FileItem, newName: string) => {
    try {
      await apiService.renameFile(file.path, newName)
      await refreshFiles(currentPath.value, false) // Don't use cache
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to rename file'
      throw err
    }
  }

  // Keyboard navigation
  const handleFileNavigationKeys = (event: KeyboardEvent) => {
    const files = filteredFiles.value
    if (files.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        selectedFileIndex.value = Math.min(selectedFileIndex.value + 1, files.length - 1)
        selectedFile.value = files[selectedFileIndex.value]
        break
        
      case 'ArrowUp':
        event.preventDefault()
        selectedFileIndex.value = Math.max(selectedFileIndex.value - 1, 0)
        selectedFile.value = files[selectedFileIndex.value]
        break
        
      case 'Enter':
        event.preventDefault()
        if (selectedFile.value) {
          if (selectedFile.value.type === 'directory') {
            openDirectory(selectedFile.value)
          } else {
            showFilePreview(selectedFile.value)
          }
        }
        break
        
      case 'Backspace':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          navigateUp()
        }
        break
    }
  }

  // Cache management
  const clearCache = () => {
    directoryCache.value.clear()
  }

  const cleanupCache = () => {
    const now = Date.now()
    for (const [path, item] of directoryCache.value.entries()) {
      if (now - item.timestamp > cacheTimeout.value) {
        directoryCache.value.delete(path)
      }
    }
  }

  return {
    // State
    fileExplorerEnabled: readonly(fileExplorerEnabled),
    fileExplorerCollapsed: readonly(fileExplorerCollapsed),
    currentFiles: readonly(currentFiles),
    currentPath: readonly(currentPath),
    selectedFile: readonly(selectedFile),
    loadingFiles: readonly(loadingFiles),
    fileError: readonly(fileError),
    showHiddenFiles: readonly(showHiddenFiles),
    fileSearchTerm: readonly(fileSearchTerm),
    selectedFileIndex: readonly(selectedFileIndex),
    showContextMenu: readonly(showContextMenu),
    contextMenuX: readonly(contextMenuX),
    contextMenuY: readonly(contextMenuY),
    contextMenuFile: readonly(contextMenuFile),
    showFilePreviewModal: readonly(showFilePreviewModal),
    previewFile: readonly(previewFile),
    previewData: readonly(previewData),
    previewLoading: readonly(previewLoading),
    previewError: readonly(previewError),
    showDiscardModal: readonly(showDiscardModal),
    discardAction: readonly(discardAction),
    changesSummary: readonly(changesSummary),

    // Computed
    filteredFiles,
    pathSegments,
    hasFiles,
    selectedFileData,

    // Actions
    clearFileError,
    clearPreviewError,
    refreshFiles,
    navigateToPath,
    navigateUp,
    navigateToSegment,
    openDirectory,
    selectFile,
    clearSelection,
    searchFiles,
    clearSearch,
    toggleHiddenFiles,
    toggleFileExplorer,
    openContextMenu,
    closeContextMenu,
    showFilePreview,
    refreshFilePreview,
    closeFilePreviewModal,
    openDiscardModal,
    closeDiscardModal,
    createFile,
    createDirectory,
    deleteFile,
    renameFile,
    handleFileNavigationKeys,
    clearCache,
    cleanupCache,
  }
})