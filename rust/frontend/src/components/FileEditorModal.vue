<template>
  <Teleport to="body">
    <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-container" @click.stop>
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="file-info">
            <div class="file-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
              </svg>
            </div>
            <div class="file-details">
              <div class="file-name">{{ file?.name || 'Untitled' }}</div>
              <div class="file-path">{{ file?.path || '' }}</div>
            </div>
          </div>
          
          <div class="modal-actions">
            <button 
              v-if="!readonly && hasChanges" 
              @click="saveFile" 
              class="action-btn save-btn"
              :disabled="saving"
              title="Save file (Ctrl+S)"
            >
              <div v-if="saving" class="loading-spinner"></div>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17,21 17,13 7,13 7,21"></polyline>
                <polyline points="7,3 7,8 15,8"></polyline>
              </svg>
            </button>
            
            <button 
              @click="toggleReadonly" 
              class="action-btn"
              :class="{ active: readonly }"
              title="Toggle read-only mode"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <circle cx="12" cy="16" r="1"></circle>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
            
            <button @click="closeModal" class="action-btn close-btn" title="Close (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="modal-body">
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner large"></div>
            <span>Loading file...</span>
          </div>
          
          <div v-else-if="error" class="error-state">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{{ error }}</span>
            <button @click="loadFileContent" class="retry-btn">Retry</button>
          </div>
          
          <div v-else class="editor-container" ref="editorContainer"></div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <div class="status-info">
            <span v-if="file?.size" class="file-size">{{ formatFileSize(file.size) }}</span>
            <span v-if="file?.modified" class="file-modified">Modified {{ formatDate(file.modified) }}</span>
            <span v-if="hasChanges" class="unsaved-indicator">• Unsaved changes</span>
          </div>
          
          <div class="editor-info">
            <span v-if="file?.extension" class="language-indicator">{{ file.extension.toUpperCase() }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { createUnifiedEditor } from '../utils/codemirror-editor'
import { fileService } from '../services/file.service'
import type { FileNode, EditorInstance } from '../types/editor'

const props = defineProps<{
  file: FileNode | null
  isVisible: boolean
  initialReadonly?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [file: FileNode, content: string]
}>()

const editorContainer = ref<HTMLElement>()
const editorInstance = ref<EditorInstance>()
const loading = ref(false)
const error = ref<string | null>(null)
const saving = ref(false)
const readonly = ref(props.initialReadonly ?? false)
const hasChanges = ref(false)
const originalContent = ref('')
const currentContent = ref('')

const loadFileContent = async () => {
  if (!props.file) return

  loading.value = true
  error.value = null

  try {
    console.log('📖 Loading file content:', props.file.path)
    
    // Use actual file service to read file content
    const fileContent = await fileService.readFile(props.file.path)
    
    // Extract content from FileContent object
    let content: string
    if (fileContent.encoding === 'base64') {
      // Decode base64 content if needed
      content = atob(fileContent.content)
    } else {
      content = fileContent.content
    }
    
    originalContent.value = content
    currentContent.value = content
    hasChanges.value = false
    
    console.log('✅ File content loaded successfully:', props.file.path, `(${content.length} chars)`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load file content'
    console.error('❌ Failed to load file content:', err)
  } finally {
    loading.value = false
  }
}

const initializeEditor = async () => {
  if (!editorContainer.value || !props.file) return

  // Clean up existing editor
  if (editorInstance.value) {
    editorInstance.value.destroy()
    editorInstance.value = undefined
  }

  // Create new editor instance
  editorInstance.value = createUnifiedEditor(editorContainer.value, {
    content: currentContent.value,
    readonly: readonly.value,
    fileExtension: props.file.extension || undefined,
    theme: {
      type: 'dark',
      colors: {
        primary: '#1a1a1a',
        secondary: '#2d2d2d',
        tertiary: '#3d3d3d',
        sidebar: '#252525',
        border: '#404040',
        textPrimary: '#ffffff',
        textSecondary: '#cccccc',
        textMuted: '#888888',
        accentBlue: '#61afef',
        accentBlueHover: '#4d8ed7',
        accentGreen: '#98c379',
        accentGreenHover: '#7fb069',
        accentRed: '#e06c75',
        accentRedHover: '#d45862',
        accentOrange: '#e5c07b',
        accentPurple: '#c678dd',
        terminalBg: '#1a1a1a'
      }
    },
    onChange: (content) => {
      currentContent.value = content
      hasChanges.value = content !== originalContent.value
    }
  })

  // Focus the editor
  editorInstance.value.focus()
  
  console.log('🎨 Editor initialized for:', props.file.name)
}

const saveFile = async () => {
  if (!props.file || saving.value) return

  saving.value = true
  error.value = null

  try {
    console.log('💾 Saving file:', props.file.path)
    
    // Use actual file service to save file content
    await fileService.saveFile(props.file.path, currentContent.value)
    
    // Update state after successful save
    originalContent.value = currentContent.value
    hasChanges.value = false
    
    // Emit save event for parent components
    emit('save', props.file, currentContent.value)
    
    console.log('✅ File saved successfully:', props.file.path)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save file'
    console.error('❌ Failed to save file:', err)
  } finally {
    saving.value = false
  }
}

const toggleReadonly = () => {
  readonly.value = !readonly.value
  if (editorInstance.value) {
    editorInstance.value.setReadonly(readonly.value)
  }
}

const closeModal = () => {
  if (hasChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
      return
    }
  }
  
  emit('close')
}

const handleOverlayClick = () => {
  closeModal()
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  )
}

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 's':
        e.preventDefault()
        if (!readonly.value && hasChanges.value) {
          saveFile()
        }
        break
    }
  }
  
  if (e.key === 'Escape') {
    closeModal()
  }
}

// Watch for file changes
watch(() => props.file, async (newFile) => {
  if (newFile && props.isVisible) {
    await loadFileContent()
    await nextTick()
    await initializeEditor()
  }
}, { immediate: true })

// Watch for visibility changes
watch(() => props.isVisible, async (visible) => {
  if (visible && props.file) {
    await loadFileContent()
    await nextTick()
    await initializeEditor()
  } else if (editorInstance.value) {
    editorInstance.value.destroy()
    editorInstance.value = undefined
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (editorInstance.value) {
    editorInstance.value.destroy()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 90vw;
  height: 80vh;
  max-width: 1200px;
  max-height: 800px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.file-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.file-details {
  min-width: 0;
}

.file-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-path {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--button-hover);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.save-btn {
  background: var(--accent-green);
  border-color: var(--accent-green);
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: var(--accent-green-hover);
}

.close-btn:hover {
  background: var(--error);
  border-color: var(--error);
  color: white;
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-state,
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
}

.error-state {
  color: var(--error);
}

.retry-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.retry-btn:hover {
  background: var(--button-hover);
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  flex-shrink: 0;
}

.status-info {
  display: flex;
  gap: 16px;
  color: var(--text-muted);
}

.unsaved-indicator {
  color: var(--accent-orange);
  font-weight: 500;
}

.editor-info {
  display: flex;
  gap: 8px;
}

.language-indicator {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--text-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.large {
  width: 24px;
  height: 24px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .modal-container {
    width: 95vw;
    height: 85vh;
  }
  
  .modal-header,
  .modal-footer {
    padding: 12px 16px;
  }
  
  .file-path {
    display: none;
  }
  
  .status-info {
    gap: 12px;
  }
}
</style>