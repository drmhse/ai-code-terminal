import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'

export interface EditorFile {
  path: string
  name: string
  content: string
  originalContent: string
  language?: string
  size?: number
  modified?: string
}

export const useEditorStore = defineStore('editor', () => {
  // Editor state
  const editMode = ref(false)
  const editorInstance = ref<any>(null) // CodeMirror instance
  const originalContent = ref('')
  const hasUnsavedChanges = ref(false)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  
  // Editor keyboard handler
  const editorKeyboardHandler = ref<any>(null)
  
  // File being edited
  const currentFile = ref<EditorFile | null>(null)
  
  // Editor configuration
  const editorConfig = ref({
    theme: 'default',
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    lineWrapping: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']
  })

  // Lazy load apiService when needed
  const getApiService = async () => {
    const { apiService } = await import('@/services/api')
    return apiService
  }

  // Computed properties
  const isEditing = computed(() => editMode.value && currentFile.value !== null)
  
  const hasChanges = computed(() => {
    if (!currentFile.value) return false
    return currentFile.value.content !== currentFile.value.originalContent
  })
  
  const changesSummary = computed(() => {
    if (!hasChanges.value || !currentFile.value) return ''
    
    const original = currentFile.value.originalContent.split('\n')
    const current = currentFile.value.content.split('\n')
    
    let added = 0
    let removed = 0
    let modified = 0
    
    const maxLines = Math.max(original.length, current.length)
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = original[i] || ''
      const currentLine = current[i] || ''
      
      if (!originalLine && currentLine) {
        added++
      } else if (originalLine && !currentLine) {
        removed++
      } else if (originalLine !== currentLine) {
        modified++
      }
    }
    
    const parts = []
    if (added > 0) parts.push(`+${added} lines`)
    if (removed > 0) parts.push(`-${removed} lines`)
    if (modified > 0) parts.push(`~${modified} lines`)
    
    return parts.join(', ')
  })
  
  const canSave = computed(() => {
    return isEditing.value && hasChanges.value && !saving.value
  })

  // Actions
  const clearSaveError = () => {
    saveError.value = null
  }

  const initializeEditor = async (filePath: string, content: string) => {
    try {
      const fileExtension = filePath.split('.').pop()?.toLowerCase() || ''
      const language = getLanguageFromExtension(fileExtension)
      
      currentFile.value = {
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        content: content,
        originalContent: content,
        language
      }
      
      originalContent.value = content
      hasUnsavedChanges.value = false
      saveError.value = null
      
      return currentFile.value
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Failed to initialize editor'
      throw err
    }
  }

  const toggleEditMode = async () => {
    if (!currentFile.value) return

    if (editMode.value) {
      // Exiting edit mode
      if (hasChanges.value) {
        // Let the component handle the discard modal
        return { hasChanges: true, changesSummary: changesSummary.value }
      } else {
        exitEditMode()
      }
    } else {
      // Entering edit mode
      editMode.value = true
    }
    
    return { hasChanges: false }
  }

  const exitEditMode = () => {
    editMode.value = false
    hasUnsavedChanges.value = false
    editorInstance.value = null
    editorKeyboardHandler.value = null
  }

  const updateContent = (content: string) => {
    if (currentFile.value) {
      currentFile.value.content = content
      hasUnsavedChanges.value = content !== currentFile.value.originalContent
    }
  }

  const saveFile = async () => {
    if (!currentFile.value || !canSave.value) return

    saving.value = true
    saveError.value = null

    try {
      const apiService = await getApiService()
      await apiService.saveFile(currentFile.value.path, currentFile.value.content)
      
      // Update original content to match saved content
      currentFile.value.originalContent = currentFile.value.content
      originalContent.value = currentFile.value.content
      hasUnsavedChanges.value = false
      
      return true
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Failed to save file'
      console.error('Failed to save file:', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  const discardChanges = () => {
    if (!currentFile.value) return

    // Revert content to original
    currentFile.value.content = currentFile.value.originalContent
    hasUnsavedChanges.value = false
    
    // Update editor if it exists
    if (editorInstance.value && editorInstance.value.setValue) {
      editorInstance.value.setValue(currentFile.value.originalContent)
    }
  }

  const confirmDiscardChanges = () => {
    discardChanges()
    exitEditMode()
  }

  const performDiscardChanges = (action: 'exitEdit' | 'closeModal' = 'exitEdit') => {
    discardChanges()
    
    if (action === 'exitEdit') {
      exitEditMode()
    }
    // If action is 'closeModal', just discard changes but stay in edit mode
  }

  const setEditorInstance = (instance: any) => {
    editorInstance.value = instance
  }

  const setKeyboardHandler = (handler: any) => {
    editorKeyboardHandler.value = handler
  }

  const updateEditorConfig = (config: Partial<typeof editorConfig.value>) => {
    editorConfig.value = { ...editorConfig.value, ...config }
  }

  const closeFile = () => {
    currentFile.value = null
    exitEditMode()
    clearSaveError()
  }

  // Helper functions
  const getLanguageFromExtension = (extension: string): string => {
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript', 
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'php': 'php',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'markdown': 'markdown',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'ps1': 'powershell',
      'dockerfile': 'dockerfile',
      'vue': 'vue',
      'svelte': 'svelte',
      'r': 'r',
      'matlab': 'matlab',
      'm': 'matlab'
    }
    
    return languageMap[extension] || 'text'
  }

  const formatDocument = () => {
    // Placeholder for document formatting
    if (editorInstance.value && editorInstance.value.autoFormatSelection) {
      editorInstance.value.autoFormatSelection()
    }
  }

  const find = (query: string) => {
    if (editorInstance.value && editorInstance.value.openDialog) {
      editorInstance.value.openDialog(query)
    }
  }

  const findNext = () => {
    if (editorInstance.value && editorInstance.value.findNext) {
      editorInstance.value.findNext()
    }
  }

  const findPrevious = () => {
    if (editorInstance.value && editorInstance.value.findPrev) {
      editorInstance.value.findPrev()
    }
  }

  const replace = (replaceText: string) => {
    if (editorInstance.value && editorInstance.value.replaceAll) {
      editorInstance.value.replaceAll(replaceText)
    }
  }

  const goToLine = (line: number) => {
    if (editorInstance.value && editorInstance.value.setCursor) {
      editorInstance.value.setCursor(line - 1, 0)
      editorInstance.value.focus()
    }
  }

  const undo = () => {
    if (editorInstance.value && editorInstance.value.undo) {
      editorInstance.value.undo()
    }
  }

  const redo = () => {
    if (editorInstance.value && editorInstance.value.redo) {
      editorInstance.value.redo()
    }
  }

  return {
    // State
    editMode: readonly(editMode),
    editorInstance: readonly(editorInstance),
    originalContent: readonly(originalContent),
    hasUnsavedChanges: readonly(hasUnsavedChanges),
    saving: readonly(saving),
    saveError: readonly(saveError),
    editorKeyboardHandler: readonly(editorKeyboardHandler),
    currentFile: readonly(currentFile),
    editorConfig: readonly(editorConfig),

    // Computed
    isEditing,
    hasChanges,
    changesSummary,
    canSave,

    // Actions
    clearSaveError,
    initializeEditor,
    toggleEditMode,
    exitEditMode,
    updateContent,
    saveFile,
    discardChanges,
    confirmDiscardChanges,
    performDiscardChanges,
    setEditorInstance,
    setKeyboardHandler,
    updateEditorConfig,
    closeFile,
    formatDocument,
    find,
    findNext,
    findPrevious,
    replace,
    goToLine,
    undo,
    redo,
  }
})