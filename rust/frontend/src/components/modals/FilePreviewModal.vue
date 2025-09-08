<template>
  <div class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <div class="file-info">
          <svg 
            :width="20" 
            :height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2"
            class="file-icon"
          >
            <path d="M14,2H6A2,2 0,0 0,4,4V20a2,2 0,0 0,2,2H18a2,2 0,0 0,2-2V8Z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <div class="file-details">
            <h3>{{ fileStore.previewFile?.name }}</h3>
            <span v-if="fileStore.previewFile?.path" class="file-path">{{ fileStore.previewFile.path }}</span>
          </div>
        </div>
        
        <div class="header-actions">
          <button 
            @click="refreshPreview" 
            class="action-btn"
            title="Refresh file"
            :disabled="fileStore.previewLoading"
          >
            <svg 
              :width="16" 
              :height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2"
              :class="{ 'spinning': fileStore.previewLoading }"
            >
              <polyline points="23,4 23,10 17,10"></polyline>
              <polyline points="1,20 1,14 7,14"></polyline>
              <path d="m3.51,9a9,9 0 0,1,14.85-3.36L23,10M1,14l4.64,4.36A9,9 0 0,0,20.49,15"></path>
            </svg>
          </button>
          
          <button 
            @click="toggleEditMode" 
            class="action-btn"
            :class="{ active: editorStore.editMode }"
            title="Toggle edit mode"
          >
            <svg :width="16" :height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          
          <button @click="closeModal" class="close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="modal-body">
        <!-- Loading State -->
        <div v-if="fileStore.previewLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading file content...</p>
        </div>
        
        <!-- Error State -->
        <div v-else-if="fileStore.previewError" class="error-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h4>Failed to load file</h4>
          <p>{{ fileStore.previewError }}</p>
          <button @click="refreshPreview" class="retry-btn">Retry</button>
        </div>
        
        <!-- File Content -->
        <div v-else-if="fileStore.previewData !== null" class="content-container">
          <!-- Edit Mode -->
          <div v-if="editorStore.editMode" class="editor-container">
            <div class="editor-toolbar">
              <div class="editor-info">
                <span v-if="editorStore.hasChanges" class="changes-indicator">
                  • Unsaved changes
                </span>
                <span v-if="editorStore.currentFile?.language" class="file-language">
                  {{ editorStore.currentFile.language }}
                </span>
              </div>
              
              <div class="editor-actions">
                <button 
                  @click="saveFile" 
                  class="editor-btn save-btn"
                  :disabled="!editorStore.canSave || editorStore.saving"
                  title="Save file (Ctrl+S)"
                >
                  <div v-if="editorStore.saving" class="loading-spinner small"></div>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                  </svg>
                  {{ editorStore.saving ? 'Saving...' : 'Save' }}
                </button>
                
                <button 
                  @click="discardChanges" 
                  class="editor-btn discard-btn"
                  :disabled="!editorStore.hasChanges"
                  title="Discard changes"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                  </svg>
                  Discard
                </button>
              </div>
            </div>
            
            <!-- Code Editor (placeholder for CodeMirror) -->
            <div class="code-editor" ref="editorRef">
              <textarea 
                v-model="editorContent" 
                class="editor-textarea"
                :disabled="editorStore.saving"
                @input="handleEditorInput"
                spellcheck="false"
              ></textarea>
            </div>
          </div>
          
          <!-- Preview Mode -->
          <div v-else class="preview-container">
            <pre class="code-preview"><code>{{ fileStore.previewData }}</code></pre>
          </div>
        </div>
        
        <!-- Empty State -->
        <div v-else class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14,2H6A2,2 0,0 0,4,4V20a2,2 0,0 0,2,2H18a2,2 0,0 0,2-2V8Z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <p>File is empty</p>
        </div>
      </div>
      
      <!-- Save Error -->
      <div v-if="editorStore.saveError" class="save-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{{ editorStore.saveError }}</span>
        <button @click="editorStore.clearSaveError" class="error-close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-footer">
        <div class="file-meta">
          <span v-if="fileStore.previewFile?.size" class="meta-item">
            {{ formatFileSize(fileStore.previewFile.size) }}
          </span>
          <span v-if="fileStore.previewFile?.modified" class="meta-item">
            Modified {{ formatDate(fileStore.previewFile.modified) }}
          </span>
        </div>
        
        <div class="footer-actions">
          <button 
            @click="closeModal" 
            class="btn btn-secondary"
            :disabled="editorStore.saving"
          >
            {{ editorStore.editMode && editorStore.hasChanges ? 'Cancel' : 'Close' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useFileStore } from '@/stores/file'
import { useEditorStore } from '@/stores/editor'
import { useFileOperations } from '@/composables/useFileOperations'

const fileStore = useFileStore()
const editorStore = useEditorStore()
const fileOperations = useFileOperations()

const editorRef = ref<HTMLElement>()
const editorContent = ref('')

const closeModal = () => {
  if (editorStore.editMode && editorStore.hasChanges) {
    // Show discard modal
    fileStore.openDiscardModal('closeModal', editorStore.changesSummary)
  } else {
    fileStore.closeFilePreviewModal()
    if (editorStore.editMode) {
      editorStore.exitEditMode()
    }
  }
}

const handleOverlayClick = () => {
  closeModal()
}

const refreshPreview = async () => {
  await fileOperations.refreshFilePreview()
}

const toggleEditMode = async () => {
  if (!fileStore.previewFile) return
  
  if (!editorStore.editMode) {
    // Initialize editor with current file
    await fileOperations.initializeEditor(fileStore.previewFile, fileStore.previewData || '')
    editorContent.value = editorStore.currentFile?.content || ''
  } else {
    // Check for unsaved changes before exiting
    const result = await fileOperations.toggleEditMode()
    if (!result) {
      // Has unsaved changes, discard modal will be shown
      return
    }
  }
}

const saveFile = async () => {
  await fileOperations.saveFile()
}

const discardChanges = () => {
  fileOperations.discardChanges()
  editorContent.value = editorStore.currentFile?.originalContent || ''
}

const handleEditorInput = () => {
  if (editorStore.currentFile) {
    editorStore.updateContent(editorContent.value)
  }
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 's':
        e.preventDefault()
        if (editorStore.canSave) {
          saveFile()
        }
        break
      case 'z':
        if (editorStore.editMode) {
          e.preventDefault()
          editorStore.undo()
        }
        break
      case 'y':
        if (editorStore.editMode) {
          e.preventDefault()
          editorStore.redo()
        }
        break
    }
  }
  
  if (e.key === 'Escape') {
    closeModal()
  }
}

// Watch for editor content changes
watch(() => editorStore.currentFile?.content, (newContent) => {
  if (newContent !== undefined && newContent !== editorContent.value) {
    editorContent.value = newContent
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  
  // Initialize editor content if in edit mode
  if (editorStore.editMode && editorStore.currentFile) {
    editorContent.value = editorStore.currentFile.content
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
  width: 90vw;
  height: 80vh;
  max-width: 1000px;
  max-height: 800px;
  display: flex;
  flex-direction: column;
  animation: scaleIn 0.2s ease-out;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.file-details {
  min-width: 0;
  flex: 1;
}

.file-details h3 {
  margin: 0;
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
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn,
.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.action-btn:hover,
.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.action-btn.active {
  background: var(--primary);
  color: white;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

.modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  gap: 12px;
  text-align: center;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.small {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

.error-state {
  color: var(--error);
}

.error-state h4 {
  margin: 0;
  font-size: 16px;
}

.error-state p {
  margin: 0;
  max-width: 400px;
}

.retry-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.retry-btn:hover {
  background: var(--button-hover);
}

/* Content */
.content-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Editor Mode */
.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.editor-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.changes-indicator {
  color: var(--warning);
  font-weight: 500;
}

.file-language {
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.editor-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}

.editor-btn:hover:not(:disabled) {
  background: var(--button-hover);
}

.editor-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.save-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.discard-btn:hover:not(:disabled) {
  background: var(--error);
  color: white;
  border-color: var(--error);
}

.code-editor {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.5;
  padding: 16px;
  resize: none;
  white-space: pre;
  overflow: auto;
}

/* Preview Mode */
.preview-container {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
}

.code-preview {
  margin: 0;
  padding: 16px;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Save Error */
.save-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--error);
  color: white;
  font-size: 14px;
}

.error-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
}

.error-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.file-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.15s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--button-secondary-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--button-secondary-hover);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.95);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .modal-content {
    margin: 10px;
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
    max-width: none;
    max-height: none;
  }
  
  .file-details h3 {
    font-size: 14px;
  }
  
  .editor-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .editor-info {
    order: 2;
  }
  
  .editor-actions {
    order: 1;
    align-self: flex-end;
  }
  
  .modal-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .footer-actions {
    align-self: flex-end;
  }
}
</style>