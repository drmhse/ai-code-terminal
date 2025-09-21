import { ref, computed, nextTick, readonly } from 'vue'
import { useFileStore } from '@/stores/file'
import { useEditorStore } from '@/stores/editor'
import { useUIStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import type { FileItem } from '@/stores/file'

/**
 * File operations composable
 * Migrated from the original refreshFiles(), showFilePreview(), and file management methods
 */
export function useFileOperations() {
  const fileStore = useFileStore()
  const editorStore = useEditorStore()
  const uiStore = useUIStore()
  const workspaceStore = useWorkspaceStore()

  // File operations state
  const refreshing = ref(false)
  const operationInProgress = ref(false)

  // Refresh files in current directory (migrated from refreshFiles method)
  const refreshFiles = async (path?: string, useCache = true) => {
    if (refreshing.value) return
    
    if (!workspaceStore.selectedWorkspace) {
      console.warn('No workspace selected for file refresh')
      return
    }

    refreshing.value = true
    
    try {
      console.log(`🔄 Refreshing files${path ? ` for path: ${path}` : ''}...`)
      
      const files = await fileStore.refreshFiles(path, useCache, workspaceStore.selectedWorkspace.id)
      
      console.log(`✅ Loaded ${files.length} files`)
      return files
      
    } catch (err) {
      console.error('❌ Failed to refresh files:', err)
      
      uiStore.addResourceAlert({
        type: 'error',
        title: 'File Load Failed',
        message: err instanceof Error ? err.message : 'Failed to load files'
      })
      
      throw err
    } finally {
      refreshing.value = false
    }
  }

  // Show file preview modal (migrated from showFilePreview method)
  const showFilePreview = async (file: FileItem) => {
    try {
      console.log(`👁️ Opening file preview: ${file.name}`)
      
      // Use the file store method which handles loading and state
      await fileStore.showFilePreview(file)
      
    } catch (err) {
      console.error(`❌ Failed to preview file ${file.name}:`, err)
      
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Preview Failed',
        message: `Failed to preview ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
      })
    }
  }

  // Refresh file preview (migrated from refreshFilePreview method)
  const refreshFilePreview = async () => {
    if (!fileStore.previewFile) return
    
    try {
      await fileStore.refreshFilePreview()
    } catch (err) {
      console.error('Failed to refresh file preview:', err)
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Refresh Failed',
        message: 'Failed to refresh file preview'
      })
    }
  }

  // Initialize editor for file editing (migrated from initializeEditor method)
  const initializeEditor = async (file: FileItem, content?: string) => {
    try {
      console.log(`📝 Initializing editor for: ${file.name}`)
      
      // Get file content if not provided
      let fileContent = content
      if (!fileContent) {
        // This would typically come from the file preview data
        if (fileStore.previewFile?.path === file.path && fileStore.previewData) {
          fileContent = fileStore.previewData
        } else {
          // Load file content
          await showFilePreview(file)
          fileContent = fileStore.previewData || ''
        }
      }
      
      // Initialize editor with file content
      await editorStore.initializeEditor(file.path, fileContent)
      
      console.log(`✅ Editor initialized for ${file.name}`)
      
    } catch (err) {
      console.error(`❌ Failed to initialize editor for ${file.name}:`, err)
      
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Editor Failed',
        message: `Failed to open ${file.name} in editor`
      })
      
      throw err
    }
  }

  // Toggle edit mode (migrated from toggleEditMode method)
  const toggleEditMode = async () => {
    try {
      const result = await editorStore.toggleEditMode()
      
      if (result?.hasChanges) {
        // Show discard modal
        fileStore.openDiscardModal('exitEdit', result.changesSummary || '')
        return false // Don't exit edit mode yet
      }
      
      return true // Successfully toggled
      
    } catch (err) {
      console.error('Failed to toggle edit mode:', err)
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Edit Mode Failed',
        message: 'Failed to toggle edit mode'
      })
      return false
    }
  }

  // Save file (migrated from saveFile method)
  const saveFile = async () => {
    if (!editorStore.canSave) return false
    
    operationInProgress.value = true
    
    try {
      console.log(`💾 Saving file: ${editorStore.currentFile?.name}`)
      
      const workspaceId = workspaceStore.selectedWorkspace?.id
      if (!workspaceId) {
        throw new Error('No workspace selected for file save operation')
      }
      
      const success = await editorStore.saveFile(workspaceId)
      
      if (success) {
        console.log(`✅ File saved: ${editorStore.currentFile?.name}`)
        
        uiStore.addResourceAlert({
          type: 'info',
          title: 'File Saved',
          message: `Successfully saved ${editorStore.currentFile?.name}`
        })
        
        // Refresh file preview if it's the same file
        if (fileStore.previewFile?.path === editorStore.currentFile?.path) {
          await refreshFilePreview()
        }
        
        // Refresh file list to update modification time
        await refreshFiles(undefined, false) // Don't use cache
      }
      
      return success
      
    } catch (err) {
      console.error('❌ Failed to save file:', err)
      
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Save Failed',
        message: err instanceof Error ? err.message : 'Failed to save file'
      })
      
      return false
    } finally {
      operationInProgress.value = false
    }
  }

  // Discard changes (migrated from discardChanges method)
  const discardChanges = () => {
    editorStore.discardChanges()
    
    uiStore.addResourceAlert({
      type: 'info',
      title: 'Changes Discarded',
      message: 'File changes have been discarded'
    })
  }

  // Confirm discard changes (migrated from confirmDiscardChanges method)
  const confirmDiscardChanges = () => {
    editorStore.confirmDiscardChanges()
    
    uiStore.addResourceAlert({
      type: 'info',
      title: 'Changes Discarded',
      message: 'File changes have been discarded and edit mode closed'
    })
  }

  // Perform discard changes with action (migrated from performDiscardChanges method)
  const performDiscardChanges = (action: 'exitEdit' | 'closeModal' = 'exitEdit') => {
    editorStore.performDiscardChanges(action)
    
    const message = action === 'exitEdit' 
      ? 'File changes have been discarded and edit mode closed'
      : 'File changes have been discarded'
    
    uiStore.addResourceAlert({
      type: 'info',
      title: 'Changes Discarded',
      message
    })
  }

  // Handle file double click - VS Code behavior
  const handleFileDoubleClick = async (file: FileItem) => {
    if (file.type === 'directory') {
      // Toggle directory expansion in tree view (VS Code behavior)
      fileStore.toggleDirectoryExpansion(file)
    } else {
      // Open file for editing (VS Code behavior)
      await showFilePreview(file)
    }
  }

  // Handle file single click - VS Code behavior (selection only)
  const handleFileClick = (file: FileItem, index?: number) => {
    // Always just select the file/directory (VS Code behavior)
    fileStore.selectFile(file, index)
  }

  // Navigate to parent directory
  const navigateUp = async () => {
    try {
      await fileStore.navigateUp()
    } catch (err) {
      console.error('Failed to navigate up:', err)
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Navigation Failed',
        message: 'Failed to navigate to parent directory'
      })
    }
  }

  // Navigate to specific path segment
  const navigateToSegment = async (segmentIndex: number) => {
    try {
      await fileStore.navigateToSegment(segmentIndex)
    } catch (err) {
      console.error('Failed to navigate to segment:', err)
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Navigation Failed',
        message: 'Failed to navigate to directory'
      })
    }
  }

  // File search operations
  const searchFiles = (term: string) => {
    fileStore.searchFiles(term)
  }

  const clearFileSearch = () => {
    fileStore.clearSearch()
  }

  // File context menu operations
  const handleFileContextMenu = (event: MouseEvent, file: FileItem) => {
    event.preventDefault()
    fileStore.openContextMenu(file, event.clientX, event.clientY)

    // Close context menu when clicking elsewhere
    const closeContextMenu = (e: Event) => {
      if (!(e.target as Element)?.closest('.context-menu')) {
        fileStore.closeContextMenu()
        document.removeEventListener('click', closeContextMenu)
      }
    }

    nextTick(() => {
      document.addEventListener('click', closeContextMenu)
    })
  }

  // Context menu actions
  const copyFilePath = () => {
    if (!fileStore.contextMenuFile) return
    
    copyToClipboard(fileStore.contextMenuFile.path)
    fileStore.closeContextMenu()
  }

  const copyFileName = () => {
    if (!fileStore.contextMenuFile) return
    
    copyToClipboard(fileStore.contextMenuFile.name)
    fileStore.closeContextMenu()
  }

  const previewContextFile = async () => {
    if (!fileStore.contextMenuFile) return
    
    await showFilePreview(fileStore.contextMenuFile as FileItem)
    fileStore.closeContextMenu()
  }

  // Utility function to copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        showNotification('Copied to clipboard', 'info')
      } else {
        fallbackCopyToClipboard(text)
      }
    } catch {
      fallbackCopyToClipboard(text)
    }
  }

  const fallbackCopyToClipboard = (text: string) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      document.execCommand('copy')
      showNotification('Copied to clipboard', 'info')
    } catch (err) {
      console.error('Failed to copy text:', err)
      showNotification('Failed to copy to clipboard', 'error')
    } finally {
      document.body.removeChild(textArea)
    }
  }

  const showNotification = (message: string, type: 'info' | 'error' | 'warning' = 'info') => {
    uiStore.addResourceAlert({
      type: type === 'info' ? 'info' : type,
      title: 'File Operation',
      message
    })
  }

  // Get file icon based on extension
  const getFileIcon = (file: FileItem): string => {
    if (file.type === 'directory') {
      return 'folder'
    }

    const extension = file.extension?.toLowerCase()
    if (!extension) return 'file'

    const iconMap: Record<string, string> = {
      // Code files
      'js': 'file-text',
      'ts': 'file-text', 
      'jsx': 'file-text',
      'tsx': 'file-text',
      'py': 'file-text',
      'java': 'file-text',
      'cpp': 'file-text',
      'c': 'file-text',
      'cs': 'file-text',
      'go': 'file-text',
      'rs': 'file-text',
      'php': 'file-text',
      'rb': 'file-text',
      
      // Web files
      'html': 'code',
      'htm': 'code',
      'css': 'code',
      'scss': 'code',
      'sass': 'code',
      'less': 'code',
      
      // Config files
      'json': 'settings',
      'xml': 'settings',
      'yml': 'settings',
      'yaml': 'settings',
      'toml': 'settings',
      'ini': 'settings',
      
      // Documentation
      'md': 'file-text',
      'txt': 'file-text',
      'rtf': 'file-text',
      'pdf': 'file-text',
      
      // Images
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'svg': 'image',
      'bmp': 'image',
      'webp': 'image',
      
      // Archives
      'zip': 'archive',
      'tar': 'archive',
      'gz': 'archive',
      'rar': 'archive',
      '7z': 'archive',
      
      // Default
      'default': 'file'
    }

    return iconMap[extension] || iconMap.default
  }

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Computed properties
  const currentFiles = computed(() => fileStore.filteredFiles)
  const currentPath = computed(() => fileStore.currentPath)
  const pathSegments = computed(() => fileStore.pathSegments)
  const selectedFile = computed(() => fileStore.selectedFile)
  const hasFiles = computed(() => fileStore.hasFiles)
  const loadingFiles = computed(() => fileStore.loadingFiles)
  const fileError = computed(() => fileStore.fileError)
  const previewFile = computed(() => fileStore.previewFile)
  const showContextMenu = computed(() => fileStore.showContextMenu)
  const fileSearchTerm = computed(() => fileStore.fileSearchTerm)

  return {
    // State
    refreshing: readonly(refreshing),
    operationInProgress: readonly(operationInProgress),
    
    // Computed (from stores)
    currentFiles,
    currentPath,
    pathSegments,
    selectedFile,
    hasFiles,
    loadingFiles,
    fileError,
    previewFile,
    showContextMenu,
    fileSearchTerm,
    
    // Methods
    refreshFiles,
    showFilePreview,
    refreshFilePreview,
    initializeEditor,
    toggleEditMode,
    saveFile,
    discardChanges,
    confirmDiscardChanges,
    performDiscardChanges,
    handleFileDoubleClick,
    handleFileClick,
    navigateUp,
    navigateToSegment,
    searchFiles,
    clearFileSearch,
    handleFileContextMenu,
    copyFilePath,
    copyFileName,
    previewContextFile,
    copyToClipboard,
    getFileIcon,
    formatFileSize
  }
}