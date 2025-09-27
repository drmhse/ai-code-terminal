import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFileStore } from '@/stores/file'
import { useEditorStore } from '@/stores/editor'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUIStore } from '@/stores/ui'
import { useFileOperations } from './useFileOperations'
import type { FileItem } from '@/stores/file'

/**
 * Global keyboard shortcuts composable
 * Handles application-wide keyboard shortcuts and hotkeys
 */
export function useKeyboardShortcuts() {
  const authStore = useAuthStore()
  const fileStore = useFileStore()
  const editorStore = useEditorStore()
  const workspaceStore = useWorkspaceStore()
  const uiStore = useUIStore()
  const fileOperations = useFileOperations()

  const handleKeydown = async (event: KeyboardEvent) => {
    const { key, ctrlKey, metaKey, shiftKey, altKey } = event
    const cmdOrCtrl = ctrlKey || metaKey
    
    // Don't handle shortcuts when typing in input fields (except some specific ones)
    const activeElement = document.activeElement
    const isInputField = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      (activeElement as HTMLElement).contentEditable === 'true'
    )

    // Global shortcuts (work even in input fields)
    if (key === 'Escape') {
      handleEscape()
      return
    }

    // Skip other shortcuts when in input fields, except for editor
    if (isInputField && !activeElement?.closest('.code-editor')) {
      return
    }

    // File operations
    if (cmdOrCtrl) {
      switch (key) {
        case 's':
          event.preventDefault()
          await handleSave()
          break
        case 'o':
          event.preventDefault()
          handleOpen()
          break
        case 'r':
          event.preventDefault()
          await handleRefresh(shiftKey)
          break
        case 'f':
          event.preventDefault()
          handleSearch()
          break
        case 'n':
          event.preventDefault()
          handleNew(shiftKey)
          break
        case 'w':
          event.preventDefault()
          handleCloseFile()
          break
        case 'z':
          if (editorStore.editMode) {
            event.preventDefault()
            handleUndo(shiftKey)
          }
          break
        case 'y':
          if (editorStore.editMode) {
            event.preventDefault()
            handleRedo()
          }
          break
        case ',':
          event.preventDefault()
          handleSettings()
          break
        case 'k':
          if (shiftKey) {
            event.preventDefault()
            handleCommandPalette()
          }
          break
      }
    }

    // Function keys
    switch (key) {
      case 'F2':
        event.preventDefault()
        handleRename()
        break
      case 'F5':
        event.preventDefault()
        await handleRefresh()
        break
    }

    // File navigation
    if (!cmdOrCtrl && fileStore.currentFiles.length > 0) {
      switch (key) {
        case 'ArrowDown':
          if (!isInputField) {
            event.preventDefault()
            handleFileNavigation('down')
          }
          break
        case 'ArrowUp':
          if (!isInputField) {
            event.preventDefault()
            handleFileNavigation('up')
          }
          break
        case 'Enter':
          if (!isInputField && fileStore.selectedFile) {
            event.preventDefault()
            await handleFileOpen()
          }
          break
        case 'Delete':
          if (!isInputField && fileStore.selectedFile) {
            event.preventDefault()
            handleDelete()
          }
          break
        case 'Backspace':
          if (!isInputField && (cmdOrCtrl || altKey)) {
            event.preventDefault()
            await handleNavigateUp()
          }
          break
      }
    }

    // Modal and UI shortcuts
    if (altKey) {
      switch (key) {
        case '1':
          event.preventDefault()
          handleSwitchWorkspace(0)
          break
        case '2':
          event.preventDefault()
          handleSwitchWorkspace(1)
          break
        case '3':
          event.preventDefault()
          handleSwitchWorkspace(2)
          break
        case 't':
          event.preventDefault()
          handleToggleTheme()
          break
        case 'b':
          event.preventDefault()
          handleToggleSidebar()
          break
      }
    }

    // Developer shortcuts
    if (cmdOrCtrl && shiftKey) {
      switch (key) {
        case 'I':
          // Don't prevent default - let browser dev tools open
          break
        case 'C':
          event.preventDefault()
          handleCopyPath()
          break
        case 'R':
          event.preventDefault()
          await handleHardRefresh()
          break
      }
    }
  }

  // Shortcut handlers
  const handleEscape = () => {
    // Close modals in order of priority
    if (uiStore.showThemeModal) {
      uiStore.closeThemeModal()
    } else if (uiStore.showRepositoriesModal) {
      uiStore.closeRepositoriesModal()
    } else if (uiStore.showDeleteModal) {
      uiStore.closeDeleteModal()
    } else if (fileStore.showDiscardModal) {
      fileStore.closeDiscardModal()
    } else if (uiStore.showContextMenu) {
      uiStore.closeContextMenu()
    } else if (uiStore.isMobile) {
      // Close mobile interfaces
      if (uiStore.showMobileActionsMenu) {
        uiStore.closeMobileActionsMenu()
      } else if (uiStore.mobileInputOpen) {
        uiStore.closeMobileInput()
      } else if (uiStore.sidebarOpen) {
        uiStore.closeSidebar()
      }
    }
  }

  const handleSave = async () => {
    if (editorStore.canSave) {
      await fileOperations.saveFile()
    }
  }

  const handleOpen = () => {
    if (workspaceStore.selectedWorkspace) {
      // Focus file search input if available
      const searchInput = document.querySelector('.file-search-input') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
        searchInput.select()
      }
    }
  }

  const handleRefresh = async (hard = false) => {
    if (hard) {
      // Hard refresh - clear cache
      fileStore.clearCache()
    }
    await fileOperations.refreshFiles(undefined, !hard)
  }

  const handleSearch = () => {
    const searchInput = document.querySelector('.file-search-input') as HTMLInputElement
    if (searchInput) {
      searchInput.focus()
    }
  }

  const handleNew = (isFolder = false) => {
    if (!workspaceStore.selectedWorkspace) return
    
    const name = prompt(isFolder ? 'Enter folder name:' : 'Enter file name:')
    if (name) {
      if (isFolder) {
        fileStore.createDirectory(name)
      } else {
        fileStore.createFile(name)
      }
    }
  }

  const handleCloseFile = () => {
    if (editorStore.editMode) {
      editorStore.exitEditMode()
    }
  }

  const handleUndo = (isRedo = false) => {
    if (isRedo) {
      editorStore.redo()
    } else {
      editorStore.undo()
    }
  }

  const handleRedo = () => {
    editorStore.redo()
  }

  const handleSettings = () => {
    uiStore.openThemeModal()
  }

  const handleCommandPalette = () => {
    // Future: Open command palette
    console.log('Command palette shortcut pressed')
  }

  const handleRename = () => {
    if (fileStore.selectedFile) {
      const newName = prompt('Enter new name:', fileStore.selectedFile.name)
      if (newName && newName !== fileStore.selectedFile.name) {
        fileStore.renameFile(fileStore.selectedFile as FileItem, newName)
      }
    }
  }

  const handleFileNavigation = (direction: 'up' | 'down') => {
    const files = fileStore.filteredFiles
    if (files.length === 0) return

    let currentIndex = fileStore.selectedFileIndex
    
    if (direction === 'down') {
      currentIndex = Math.min(currentIndex + 1, files.length - 1)
    } else {
      currentIndex = Math.max(currentIndex - 1, 0)
    }
    
    fileStore.selectFile(files[currentIndex], currentIndex)
  }

  const handleFileOpen = async () => {
    if (fileStore.selectedFile) {
      await fileOperations.handleFileDoubleClick(fileStore.selectedFile as FileItem)
    }
  }

  const handleDelete = () => {
    if (fileStore.selectedFile) {
      const confirmMessage = fileStore.selectedFile.type === 'directory'
        ? `Delete folder "${fileStore.selectedFile.name}" and all contents?`
        : `Delete file "${fileStore.selectedFile.name}"?`
      
      if (confirm(confirmMessage)) {
        fileStore.deleteFile(fileStore.selectedFile as FileItem)
      }
    }
  }

  const handleNavigateUp = async () => {
    await fileOperations.navigateUp()
  }

  const handleSwitchWorkspace = (index: number) => {
    const workspace = workspaceStore.workspaces[index]
    if (workspace && workspace.id !== workspaceStore.selectedWorkspace?.id) {
      workspaceStore.switchWorkspace(workspace)
    }
  }

  const handleToggleTheme = () => {
    uiStore.openThemeModal()
  }

  const handleToggleSidebar = () => {
    uiStore.toggleSidebar()
  }

  const handleCopyPath = () => {
    if (fileStore.selectedFile) {
      fileOperations.copyToClipboard(fileStore.selectedFile.path)
    }
  }

  const handleHardRefresh = async () => {
    // Clear all caches and refresh everything
    fileStore.clearCache()
    await Promise.all([
      fileOperations.refreshFiles(undefined, false),
      workspaceStore.fetchWorkspaces()
    ])
    
    uiStore.addResourceAlert({
      type: 'info',
      title: 'Hard Refresh',
      message: 'All data has been refreshed'
    })
  }

  // Setup and cleanup
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    // Expose handlers for manual use if needed
    handleEscape,
    handleSave,
    handleRefresh,
    handleSearch,
    handleToggleTheme,
    handleToggleSidebar
  }
}

// Keyboard shortcut helper for displaying shortcuts in UI
export const keyboardShortcuts = {
  // File operations
  save: { key: 'S', modifiers: ['Ctrl'], description: 'Save file' },
  open: { key: 'O', modifiers: ['Ctrl'], description: 'Open file search' },
  refresh: { key: 'R', modifiers: ['Ctrl'], description: 'Refresh files' },
  hardRefresh: { key: 'R', modifiers: ['Ctrl', 'Shift'], description: 'Hard refresh' },
  search: { key: 'F', modifiers: ['Ctrl'], description: 'Search files' },
  newFile: { key: 'N', modifiers: ['Ctrl'], description: 'New file' },
  newFolder: { key: 'N', modifiers: ['Ctrl', 'Shift'], description: 'New folder' },
  close: { key: 'W', modifiers: ['Ctrl'], description: 'Close file' },
  
  // Edit operations
  undo: { key: 'Z', modifiers: ['Ctrl'], description: 'Undo' },
  redo: { key: 'Z', modifiers: ['Ctrl', 'Shift'], description: 'Redo' },
  
  // Navigation
  fileUp: { key: '↑', modifiers: [], description: 'Select file above' },
  fileDown: { key: '↓', modifiers: [], description: 'Select file below' },
  openFile: { key: 'Enter', modifiers: [], description: 'Open selected file' },
  goUp: { key: 'Backspace', modifiers: ['Ctrl'], description: 'Go to parent directory' },
  
  // UI
  escape: { key: 'Escape', modifiers: [], description: 'Close modal/menu' },
  settings: { key: ',', modifiers: ['Ctrl'], description: 'Open settings' },
  commandPalette: { key: 'K', modifiers: ['Ctrl', 'Shift'], description: 'Command palette' },
  toggleSidebar: { key: 'B', modifiers: ['Alt'], description: 'Toggle sidebar' },
  toggleTheme: { key: 'T', modifiers: ['Alt'], description: 'Theme selector' },
  
  // Workspace
  workspace1: { key: '1', modifiers: ['Alt'], description: 'Switch to workspace 1' },
  workspace2: { key: '2', modifiers: ['Alt'], description: 'Switch to workspace 2' },
  workspace3: { key: '3', modifiers: ['Alt'], description: 'Switch to workspace 3' },
  
  // File operations
  rename: { key: 'F2', modifiers: [], description: 'Rename file' },
  delete: { key: 'Delete', modifiers: [], description: 'Delete file' },
  copyPath: { key: 'C', modifiers: ['Ctrl', 'Shift'], description: 'Copy file path' }
}

// Helper to format shortcut for display
export function formatShortcut(shortcut: typeof keyboardShortcuts[keyof typeof keyboardShortcuts]): string {
  const modifiers = shortcut.modifiers.map(mod => {
    switch (mod) {
      case 'Ctrl': return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'
      case 'Shift': return '⇧'
      case 'Alt': return navigator.platform.includes('Mac') ? '⌥' : 'Alt'
      default: return mod
    }
  })
  
  return [...modifiers, shortcut.key].join('+')
}