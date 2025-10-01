import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { apiService } from '@/services/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUIStore } from '@/stores/ui'
import type { FileItem as FileType } from '@/types'

// Extended FileItem interface for tree structure support
export interface FileItem extends FileType {
  permissions?: string
  modified?: string
  // Tree structure support (VS Code-like)
  children?: FileItem[] | undefined
  isExpanded?: boolean
  isLoading?: boolean
  parentPath?: string
}

export interface EditorPosition {
  line: number
  column: number
}

export interface EditorSelection {
  start: EditorPosition
  end: EditorPosition
}

export interface EditorState {
  path: string
  content: string
  language: string
  is_modified: boolean
  selection?: EditorSelection
  cursor_position: EditorPosition
}

export interface FileTab {
  id: string
  path: string
  name: string
  language: string
  is_modified: boolean
  is_active: boolean
}

export interface DirectoryCacheItem {
  files: FileItem[]
  timestamp: number
}

export const useFileStore = defineStore('file', () => {
  const uiStore = useUIStore()

  // File explorer state
  const fileExplorerEnabled = ref(true)
  const fileExplorerCollapsed = ref(false)
  const currentFiles = ref<FileItem[]>([])
  const currentPath = ref('.')
  const selectedFile = ref<FileItem | null>(null)
  const loadingFiles = ref(false)
  const fileError = ref<string | null>(null)
  const showHiddenFiles = ref(false)

  // Tree structure state (VS Code-like)
  const fileTree = ref<FileItem[]>([])
  const expandedDirectories = ref<Set<string>>(new Set())

  // Multi-select state (VS Code-like)
  const selectedFiles = ref<Set<string>>(new Set())
  const lastSelectedPath = ref<string | null>(null)

  // Clipboard state for cut/copy/paste
  const clipboardFiles = ref<string[]>([])
  const clipboardOperation = ref<'cut' | 'copy' | null>(null)
  
  
  
  // Directory caching
  const directoryCache = ref<Map<string, DirectoryCacheItem>>(new Map())
  const cacheTimeout = ref(5 * 60 * 1000) // 5 minutes
  
  // File search
  const fileSearchTerm = ref('')
  const fileSearchTimeout = ref<number | null>(null)
  const selectedFileIndex = ref(-1)
  
  // Legacy preview state - kept for backward compatibility
  const previewFile = ref<FileItem | null>(null)
  const previewError = ref<string | null>(null)
  const previewData = ref<string | null>(null)
  const showDiscardModal = ref(false)
  const discardAction = ref<'exitEdit' | 'closeModal'>('exitEdit')
  const changesSummary = ref('')
  
  // Editor state
  const openFiles = ref<Map<string, EditorState>>(new Map())
  const fileTabs = ref<FileTab[]>([])
  const activeTabId = ref<string | null>(null)
  const showEditor = ref(false)
  const editorLoading = ref(false)
  const editorError = ref<string | null>(null)

  // Single source of truth for workspace-aware file operations
  const getWorkspaceContext = () => {
    const workspaceStore = useWorkspaceStore()
    return workspaceStore.currentWorkspace
  }

  // Workspace-aware file content getter
  const getFileContentWorkspaceAware = async (filePath: string): Promise<string> => {
    const workspace = getWorkspaceContext()
    
    if (workspace) {
      return await apiService.getWorkspaceFileContent(workspace.id, filePath)
    } else {
      return await apiService.getFileContent(filePath)
    }
  }

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
  
  // Editor computed properties
  const activeFile = computed(() => {
    if (!activeTabId.value) return null
    return openFiles.value.get(activeTabId.value) || null
  })
  
  const activeTab = computed(() => {
    return fileTabs.value.find(tab => tab.id === activeTabId.value) || null
  })
  
  const hasOpenFiles = computed(() => openFiles.value.size > 0)
  const hasMultipleTabs = computed(() => fileTabs.value.length > 1)
  const unsavedFiles = computed(() => 
    Array.from(openFiles.value.values()).filter(state => state.is_modified)
  )

  // Actions
  const clearFileError = () => {
    fileError.value = null
  }
  
const clearPreviewError = () => {
    previewError.value = null
  }

  // Helper function to find a file by its path
  const findFileByPath = (targetPath: string): FileItem | null => {
    const searchInFiles = (files: FileItem[]): FileItem | null => {
      for (const file of files) {
        if (file.path === targetPath) {
          return file
        }
        if (file.children && file.children.length > 0) {
          const found = searchInFiles(file.children)
          if (found) {
            return found
          }
        }
      }
      return null
    }

    return searchInFiles(fileTree.value) || searchInFiles(currentFiles.value)
  }

  const refreshFiles = async (path?: string, useCache = true, workspaceId?: string) => {
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
      // Use workspace-specific endpoint if workspaceId is provided
      const files = workspaceId 
        ? await apiService.getWorkspaceDirectoryContents(workspaceId, targetPath)
        : await apiService.getDirectoryContents(targetPath)
      
// Process files
      const processedFiles: FileItem[] = files.map((file: unknown) => {
        const apiFile = file as { name: string; is_directory: boolean; size?: number; modified?: string; modified_at?: string; permissions?: string }
        return ({
          name: apiFile.name,
          type: apiFile.is_directory ? 'directory' as const : 'file' as const,
          size: apiFile.size || 0,
          modified: apiFile.modified || apiFile.modified_at,
          modified_at: apiFile.modified_at || apiFile.modified || '',
          permissions: apiFile.permissions,
          isHidden: apiFile.name.startsWith('.'),
          is_directory: apiFile.is_directory,
          extension: apiFile.is_directory ? undefined : apiFile.name.split('.').pop()?.toLowerCase(),
          path: apiFile.name, // Use just the filename for relative paths
          language: apiFile.is_directory ? undefined : (getFileLanguage(apiFile.name) || undefined)
        })
      })

      // Sort: directories first, then files, alphabetically
      processedFiles.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true })
      })

      currentFiles.value = processedFiles
      currentPath.value = targetPath
      
      // Build tree structure for root level
      if (targetPath === '.' || targetPath === '') {
        fileTree.value = buildTreeFromFiles(processedFiles, targetPath)
      }
      
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

  // Tree structure methods (VS Code-like)
  const toggleDirectoryExpansion = async (directory: FileItem) => {
    if (directory.type !== 'directory') return
    
    const fullPath = directory.path
    
    if (expandedDirectories.value.has(fullPath)) {
      // Collapse directory
      expandedDirectories.value.delete(fullPath)
      directory.isExpanded = false
      directory.children = undefined as FileItem[] | undefined
    } else {
      // Expand directory
      expandedDirectories.value.add(fullPath)
      directory.isExpanded = true
      directory.isLoading = true
      
      try {
        // Load directory contents
        const workspace = getWorkspaceContext()
        
        const files = workspace 
          ? await apiService.getWorkspaceDirectoryContents(workspace.id, fullPath)
          : await apiService.getDirectoryContents(fullPath)
        
// Process children
        const processedChildren: FileItem[] = files.map((file: unknown) => {
          const apiFile = file as { name: string; is_directory: boolean; size?: number; modified?: string; modified_at?: string; permissions?: string }
          return ({
          name: apiFile.name,
          type: apiFile.is_directory ? 'directory' as const : 'file' as const,
          size: apiFile.size || 0,
          modified: apiFile.modified || apiFile.modified_at,
          modified_at: apiFile.modified_at || apiFile.modified || '',
          permissions: apiFile.permissions,
          isHidden: apiFile.name.startsWith('.'),
          is_directory: apiFile.is_directory,
          extension: apiFile.is_directory ? undefined : apiFile.name.split('.').pop()?.toLowerCase(),
          path: fullPath === '.' ? apiFile.name : `${fullPath}/${apiFile.name}`.replace(/\/+/g, '/'),
          language: apiFile.is_directory ? undefined : (getFileLanguage(apiFile.name) || undefined),
          parentPath: fullPath,
          isExpanded: false
        })
      })
        
        // Sort: directories first, then files, alphabetically
        processedChildren.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1
          }
          return a.name.localeCompare(b.name, undefined, { numeric: true })
        })
        
        directory.children = processedChildren as FileItem[] | undefined
      } catch (err) {
        console.error('Failed to load directory contents:', err)
        fileError.value = err instanceof Error ? err.message : 'Failed to load directory'
        // Revert expansion state on error
        expandedDirectories.value.delete(fullPath)
        directory.isExpanded = false
      } finally {
        directory.isLoading = false
      }
    }
  }

  const buildTreeFromFiles = (files: FileItem[], basePath = '.'): FileItem[] => {
    return files.map(file => ({
      ...file,
      path: basePath === '.' ? file.name : `${basePath}/${file.name}`,
      parentPath: basePath,
      isExpanded: false,
      children: undefined as FileItem[] | undefined
    }))
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
    uiStore.openContextMenu(x, y, file)
  }

  const closeContextMenu = () => {
    uiStore.closeContextMenu()
  }

  // File preview actions - now redirects to docked editor
  const showFilePreview = async (file: FileItem) => {
    // Use the docked editor instead of the modal
    await openFileInEditor(file)
  }

  const refreshFilePreview = async () => {
    // Legacy function - now does nothing since files are managed in docked editor
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

  // Refresh the entire file tree while preserving expanded state
  const refreshTree = async () => {
    const workspace = getWorkspaceContext()
    const workspaceId = workspace?.id

    // Store currently expanded directories
    const wasExpanded = new Set(expandedDirectories.value)

    try {
      // Refresh root level
      await refreshFiles('.', false, workspaceId)

      // Re-expand previously expanded directories
      if (wasExpanded.size > 0) {
        await reExpandDirectories(fileTree.value, wasExpanded)
      }
    } catch (err) {
      console.error('Failed to refresh tree:', err)
      throw err
    }
  }

  // Recursively re-expand directories that were previously expanded
  const reExpandDirectories = async (items: FileItem[], wasExpanded: Set<string>) => {
    for (const item of items) {
      if (item.type === 'directory' && wasExpanded.has(item.path)) {
        // Re-expand this directory
        await toggleDirectoryExpansion(item)

        // If it has children, recursively expand them
        if (item.children && item.children.length > 0) {
          await reExpandDirectories(item.children, wasExpanded)
        }
      }
    }
  }

  // Soft refresh - only reload a specific directory in the tree
  const refreshParentDirectory = async (dirPath: string) => {
    const workspace = getWorkspaceContext()
    const workspaceId = workspace?.id

    try {
      // If it's the root, refresh the whole tree
      if (dirPath === '.' || dirPath === '') {
        await refreshTree()
        return
      }

      // Find the parent directory in the tree
      const findAndRefreshDirectory = async (items: FileItem[], targetPath: string): Promise<boolean> => {
        for (const item of items) {
          if (item.path === targetPath && item.type === 'directory') {
            // Found the directory, refresh its children
            if (item.isExpanded) {
              // Collapse and re-expand to reload
              await toggleDirectoryExpansion(item) // Collapse
              await toggleDirectoryExpansion(item) // Re-expand
            }
            return true
          }

          // Search in children if expanded
          if (item.children && item.children.length > 0) {
            const found = await findAndRefreshDirectory(item.children, targetPath)
            if (found) return true
          }
        }
        return false
      }

      // Try to find and refresh the directory
      const found = await findAndRefreshDirectory(fileTree.value, dirPath)

      // If not found in tree, it might be at root level
      if (!found && dirPath === '.') {
        await refreshTree()
      }
    } catch (err) {
      console.error('Failed to refresh parent directory:', err)
      // Fallback to full refresh on error
      await refreshTree()
    }
  }

  // File operations
  const createFile = async (name: string, content = '') => {
    try {
      const workspace = getWorkspaceContext()
      const workspaceId = workspace?.id
      await apiService.createFile(currentPath.value, name, content, workspaceId)

      // Clear cache for current path
      directoryCache.value.delete(currentPath.value)

      // Soft refresh - only reload the current directory
      await refreshParentDirectory(currentPath.value)
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to create file'
      throw err
    }
  }

  const createDirectory = async (name: string) => {
    try {
      const workspace = getWorkspaceContext()
      const workspaceId = workspace?.id
      await apiService.createDirectory(currentPath.value, name, workspaceId)

      // Clear cache for current path
      directoryCache.value.delete(currentPath.value)

      // Soft refresh - only reload the current directory
      await refreshParentDirectory(currentPath.value)
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to create directory'
      throw err
    }
  }

  const deleteFile = async (file: FileItem) => {
    try {
      const workspace = getWorkspaceContext()
      const workspaceId = workspace?.id
      await apiService.deleteFile(file.path, workspaceId)

      // Clear cache for parent path
      const parentPath = file.parentPath || file.path.split('/').slice(0, -1).join('/') || '.'
      directoryCache.value.delete(parentPath)

      // Soft refresh - only reload the parent directory
      await refreshParentDirectory(parentPath)
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to delete file'
      throw err
    }
  }

  const renameFile = async (file: FileItem, newName: string) => {
    try {
      const workspace = getWorkspaceContext()
      const workspaceId = workspace?.id

      // Store expanded directories and update paths if renaming a directory
      const wasExpanded = new Set(expandedDirectories.value)
      const oldPath = file.path
      const isDirectory = file.type === 'directory'

      await apiService.renameFile(file.path, newName, workspaceId)

      // Clear cache for parent path
      const parentPath = file.parentPath || file.path.split('/').slice(0, -1).join('/') || '.'
      directoryCache.value.delete(parentPath)

      // If renaming a directory, update expanded paths
      if (isDirectory && wasExpanded.has(oldPath)) {
        const pathParts = oldPath.split('/')
        pathParts[pathParts.length - 1] = newName
        const newPath = pathParts.join('/')

        // Update expanded directories set
        expandedDirectories.value.delete(oldPath)
        expandedDirectories.value.add(newPath)

        // Update any child paths that were expanded
        const updatedExpanded = new Set<string>()
        for (const expandedPath of expandedDirectories.value) {
          if (expandedPath.startsWith(oldPath + '/')) {
            // This is a child of the renamed directory
            const childPath = expandedPath.substring(oldPath.length)
            updatedExpanded.add(newPath + childPath)
          } else {
            updatedExpanded.add(expandedPath)
          }
        }
        expandedDirectories.value = updatedExpanded
      }

      // Soft refresh - only reload the parent directory
      await refreshParentDirectory(parentPath)
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

  // Editor actions
  const openFileInEditor = async (file: FileItem) => {
    if (file.type !== 'file') return
    
    try {
      editorLoading.value = true
      editorError.value = null
      
      // Check if file is already open
      if (openFiles.value.has(file.path)) {
        setActiveTab(file.path)
        showEditor.value = true
        return
      }
      
      const content = await getFileContentWorkspaceAware(file.path)
      const language = getFileLanguage(file.name)
      
      const editorState: EditorState = {
        path: file.path,
        content,
        language,
        is_modified: false,
        cursor_position: { line: 0, column: 0 }
      }
      
      openFiles.value.set(file.path, editorState)
      
      // Create tab
      const tab: FileTab = {
        id: file.path,
        path: file.path,
        name: file.name,
        language,
        is_modified: false,
        is_active: true
      }
      
      fileTabs.value.push(tab)
      setActiveTab(file.path)
      showEditor.value = true
      
    } catch (err) {
      editorError.value = err instanceof Error ? err.message : 'Failed to open file'
      console.error('Failed to open file in editor:', err)
    } finally {
      editorLoading.value = false
    }
  }
  
  const closeFileInEditor = (path: string) => {
    const editorState = openFiles.value.get(path)
    if (editorState && editorState.is_modified) {
      // Show discard modal
      openDiscardModal('closeModal', `You have unsaved changes to ${path.split('/').pop() || path}`)
      return
    }
    
    doCloseFile(path)
  }
  
  const doCloseFile = (path: string) => {
    openFiles.value.delete(path)
    
    const tabIndex = fileTabs.value.findIndex(tab => tab.id === path)
    if (tabIndex !== -1) {
      fileTabs.value.splice(tabIndex, 1)
      
      // Update active tab if necessary
      if (activeTabId.value === path) {
        if (fileTabs.value.length > 0) {
          setActiveTab(fileTabs.value[0].id)
        } else {
          activeTabId.value = null
          showEditor.value = false
        }
      }
    }
  }
  
  const saveFile = async (path: string) => {
    try {
      const editorState = openFiles.value.get(path)
      if (!editorState) return
      
      const workspace = getWorkspaceContext()
      await apiService.saveFile(path, editorState.content, workspace?.id)
        
        // Update editor state
        editorState.is_modified = false
        openFiles.value.set(path, { ...editorState })
        
        // Update tab state
        const tab = fileTabs.value.find(t => t.id === path)
        if (tab) {
          tab.is_modified = false
        }
        
    } catch (err) {
      editorError.value = err instanceof Error ? err.message : 'Failed to save file'
      console.error('Failed to save file:', err)
      throw err
    }
  }
  
  const saveAllFiles = async () => {
    const savePromises = Array.from(openFiles.value.entries())
      .filter(([, state]) => state.is_modified)
      .map(([path]) => saveFile(path))
    
    await Promise.all(savePromises)
  }
  
  const setActiveTab = (path: string) => {
    // Deactivate current tab
    if (activeTabId.value) {
      const currentTab = fileTabs.value.find(tab => tab.id === activeTabId.value)
      if (currentTab) {
        currentTab.is_active = false
      }
    }
    
    // Activate new tab
    const newTab = fileTabs.value.find(tab => tab.id === path)
    if (newTab) {
      newTab.is_active = true
      activeTabId.value = path
    }
  }
  
  const updateFileContent = (path: string, content: string) => {
    const editorState = openFiles.value.get(path)
    if (editorState) {
      editorState.content = content
      editorState.is_modified = true
      openFiles.value.set(path, { ...editorState })
      
      // Update tab state
      const tab = fileTabs.value.find(t => t.id === path)
      if (tab) {
        tab.is_modified = true
      }
    }
  }
  
  const updateCursorPosition = (path: string, position: EditorPosition) => {
    const editorState = openFiles.value.get(path)
    if (editorState) {
      editorState.cursor_position = position
      openFiles.value.set(path, { ...editorState })
    }
  }
  
  const closeEditor = () => {
    if (unsavedFiles.value.length > 0) {
      openDiscardModal('exitEdit', 'You have unsaved changes in one or more files')
      return
    }
    
    doCloseAllFiles()
  }
  
  const doCloseAllFiles = () => {
    openFiles.value.clear()
    fileTabs.value = []
    activeTabId.value = null
    showEditor.value = false
  }
  
  const getFileLanguage = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase()
    
    const languageMap: Record<string, string> = {
      // JavaScript/TypeScript
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'mjs': 'javascript',
      'cjs': 'javascript',
      
      // Python
      'py': 'python',
      'pyw': 'python',
      'pyi': 'python',
      
      // Rust
      'rs': 'rust',
      
      // Go
      'go': 'go',
      
      // Java
      'java': 'java',
      'class': 'java',
      
      // C/C++
      'c': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'h': 'cpp',
      'hpp': 'cpp',
      
      // C#
      'cs': 'csharp',
      
      // PHP
      'php': 'php',
      'phtml': 'php',
      
      // Ruby
      'rb': 'ruby',
      
      // Shell/Bash
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      
      // HTML/CSS
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      
      // JSON
      'json': 'json',
      'jsonc': 'json',
      'json5': 'json',
      
      // XML
      'xml': 'xml',
      'xhtml': 'xml',
      'xsd': 'xml',
      'xsl': 'xml',
      
      // YAML
      'yaml': 'yaml',
      'yml': 'yaml',
      
      // Markdown
      'md': 'markdown',
      'markdown': 'markdown',
      
      // SQL
      'sql': 'sql',
      
      // Docker
      'dockerfile': 'dockerfile',
      'dockerignore': 'ignore',
      
      // Configuration files
      'ini': 'ini',
      'toml': 'toml',
      'cfg': 'ini',
      'conf': 'ini',
      
      // Git
      'gitignore': 'ignore',
      'gitattributes': 'gitattributes',
      
      // TypeScript definitions
      'd.ts': 'typescript',
      
      // Vue
      'vue': 'vue',
      
      // Svelte
      'svelte': 'svelte',
      
      // Other
      'txt': 'plaintext',
      'log': 'plaintext',
      'csv': 'csv',
      'tsv': 'csv',
    }
    
    return languageMap[extension || ''] || 'plaintext'
}
  
  // const isTextFile = (filename: string): boolean => {
  //   const textExtensions = [
  //     'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  //     'py', 'pyw', 'pyi',
  //     'rs',
  //     'go',
  //     'java', 'class',
  //     'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
  //     'cs',
  //     'php', 'phtml',
  //     'rb',
  //     'sh', 'bash', 'zsh', 'fish',
  //     'html', 'htm', 'css', 'scss', 'sass', 'less',
  //     'json', 'jsonc', 'json5',
  //     'xml', 'xhtml', 'xsd', 'xsl',
  //     'yaml', 'yml',
  //     'md', 'markdown',
  //     'sql',
  //     'dockerfile', 'dockerignore',
  //     'ini', 'toml', 'cfg', 'conf',
  //     'gitignore', 'gitattributes',
  //     'd.ts',
  //     'vue',
  //     'txt', 'log',
  //     'csv', 'tsv'
  //   ]
    
  //   const extension = filename.split('.').pop()?.toLowerCase()
  //   return textExtensions.includes(extension || '')
  // }
  
  // Override discard modal handling
  const handleDiscardConfirm = () => {
    if (discardAction.value === 'exitEdit') {
      doCloseAllFiles()
    } else {
      // Close modal without action
    }
    closeDiscardModal()
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

  // Multi-select operations (VS Code-like)
  const toggleFileSelection = (file: FileItem, event?: MouseEvent) => {
    const path = file.path

    if (event?.shiftKey && lastSelectedPath.value) {
      // Shift+Click: Select range
      selectFileRange(lastSelectedPath.value, path)
    } else if (event?.ctrlKey || event?.metaKey) {
      // Ctrl/Cmd+Click: Toggle selection
      if (selectedFiles.value.has(path)) {
        selectedFiles.value.delete(path)
      } else {
        selectedFiles.value.add(path)
      }
      lastSelectedPath.value = path
    } else {
      // Regular click: Select single file
      selectedFiles.value.clear()
      selectedFiles.value.add(path)
      lastSelectedPath.value = path
      selectedFile.value = file
    }
  }

  const selectFileRange = (fromPath: string, toPath: string) => {
    // Get all visible files in tree order
    const allFiles: FileItem[] = []
    const collectFiles = (files: FileItem[]) => {
      for (const file of files) {
        allFiles.push(file)
        if (file.isExpanded && file.children) {
          collectFiles(file.children)
        }
      }
    }
    collectFiles(fileTree.value)

    // Find indices
    const fromIndex = allFiles.findIndex(f => f.path === fromPath)
    const toIndex = allFiles.findIndex(f => f.path === toPath)

    if (fromIndex === -1 || toIndex === -1) return

    // Select range
    const startIndex = Math.min(fromIndex, toIndex)
    const endIndex = Math.max(fromIndex, toIndex)

    selectedFiles.value.clear()
    for (let i = startIndex; i <= endIndex; i++) {
      selectedFiles.value.add(allFiles[i].path)
    }
  }

  const clearFileSelection = () => {
    selectedFiles.value.clear()
    lastSelectedPath.value = null
  }

  const selectAllFiles = () => {
    const allFiles: FileItem[] = []
    const collectFiles = (files: FileItem[]) => {
      for (const file of files) {
        allFiles.push(file)
        if (file.isExpanded && file.children) {
          collectFiles(file.children)
        }
      }
    }
    collectFiles(fileTree.value)

    selectedFiles.value.clear()
    allFiles.forEach(file => selectedFiles.value.add(file.path))
  }

  // Clipboard operations
  const cutFiles = (paths?: string[]) => {
    const filePaths = paths || Array.from(selectedFiles.value)
    if (filePaths.length === 0) return

    clipboardFiles.value = filePaths
    clipboardOperation.value = 'cut'
  }

  const copyFiles = (paths?: string[]) => {
    const filePaths = paths || Array.from(selectedFiles.value)
    if (filePaths.length === 0) return

    clipboardFiles.value = filePaths
    clipboardOperation.value = 'copy'
  }

  const pasteFiles = async (targetDirectory: FileItem) => {
    if (clipboardFiles.value.length === 0 || !clipboardOperation.value) return

    const workspace = getWorkspaceContext()
    const workspaceId = workspace?.id

    try {
      for (const filePath of clipboardFiles.value) {
        const fileName = filePath.split('/').pop() || filePath
        const targetPath = targetDirectory.type === 'directory'
          ? `${targetDirectory.path}/${fileName}`
          : `${targetDirectory.path.split('/').slice(0, -1).join('/')}/${fileName}`

        if (clipboardOperation.value === 'cut') {
          await apiService.moveFile(filePath, targetPath, workspaceId)
        } else {
          await apiService.copyFile(filePath, targetPath, true, workspaceId)
        }
      }

      // Clear cache for affected directories
      const affectedPaths = new Set<string>()
      for (const filePath of clipboardFiles.value) {
        const parentPath = filePath.split('/').slice(0, -1).join('/') || '.'
        affectedPaths.add(parentPath)
      }
      affectedPaths.add(targetDirectory.path)
      affectedPaths.add(targetDirectory.parentPath || '.')

      // Clear cache for affected paths
      affectedPaths.forEach(path => directoryCache.value.delete(path))

      // Clear clipboard if it was a cut operation
      if (clipboardOperation.value === 'cut') {
        clipboardFiles.value = []
        clipboardOperation.value = null
      }

      // Refresh the entire tree
      await refreshTree()
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to paste files'
      throw err
    }
  }

  const clearClipboard = () => {
    clipboardFiles.value = []
    clipboardOperation.value = null
  }

  // Drag and drop operations
  const moveFiles = async (filePaths: string[], targetDirectory: FileItem) => {
    const workspace = getWorkspaceContext()
    const workspaceId = workspace?.id

    try {
      for (const filePath of filePaths) {
        const fileName = filePath.split('/').pop() || filePath
        const targetPath = targetDirectory.type === 'directory'
          ? `${targetDirectory.path}/${fileName}`
          : targetDirectory.path

        await apiService.moveFile(filePath, targetPath, workspaceId)
      }

      // Clear cache for affected directories
      const affectedPaths = new Set<string>()
      for (const filePath of filePaths) {
        const parentPath = filePath.split('/').slice(0, -1).join('/') || '.'
        affectedPaths.add(parentPath)
      }
      affectedPaths.add(targetDirectory.path)
      affectedPaths.add(targetDirectory.parentPath || '.')

      // Clear cache for affected paths
      affectedPaths.forEach(path => directoryCache.value.delete(path))

      // Refresh the entire tree
      await refreshTree()
      clearFileSelection()
    } catch (err) {
      fileError.value = err instanceof Error ? err.message : 'Failed to move files'
      throw err
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
    previewFile: readonly(previewFile),
    previewData: readonly(previewData),
    showDiscardModal: readonly(showDiscardModal),
    discardAction: readonly(discardAction),
    changesSummary: readonly(changesSummary),
    // Tree structure state
    fileTree: readonly(fileTree),
    expandedDirectories: readonly(expandedDirectories),
    // Multi-select state
    selectedFiles: readonly(selectedFiles),
    lastSelectedPath: readonly(lastSelectedPath),
    // Clipboard state
    clipboardFiles: readonly(clipboardFiles),
    clipboardOperation: readonly(clipboardOperation),
    // Editor state
    openFiles: readonly(openFiles),
    fileTabs: readonly(fileTabs),
    activeTabId: readonly(activeTabId),
    showEditor: readonly(showEditor),
    editorLoading: readonly(editorLoading),
    editorError: readonly(editorError),

    // Computed
    filteredFiles,
    pathSegments,
    hasFiles,
    selectedFileData,
    activeFile,
    activeTab,
    hasOpenFiles,
    hasMultipleTabs,
    unsavedFiles,

    // Actions
    clearFileError,
    clearPreviewError,
    findFileByPath,
    refreshFiles,
    navigateToPath,
    navigateUp,
    navigateToSegment,
    openDirectory,
    toggleDirectoryExpansion,
    buildTreeFromFiles,
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
    openDiscardModal,
    closeDiscardModal,
    handleDiscardConfirm,
    createFile,
    createDirectory,
    deleteFile,
    renameFile,
    handleFileNavigationKeys,
    // Editor actions
    openFileInEditor,
    closeFileInEditor,
    saveFile,
    saveAllFiles,
    setActiveTab,
    updateFileContent,
    updateCursorPosition,
    closeEditor,
    clearCache,
    cleanupCache,
    // Multi-select actions
    toggleFileSelection,
    selectFileRange,
    clearFileSelection,
    selectAllFiles,
    // Clipboard actions
    cutFiles,
    copyFiles,
    pasteFiles,
    clearClipboard,
    // Drag and drop actions
    moveFiles,
  }
})