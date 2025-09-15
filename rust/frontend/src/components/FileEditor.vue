<template>
  <div class="file-editor" :class="{ 'editor-visible': showEditor }">
    <!-- Editor Header -->
    <div class="editor-header">
      <div class="editor-tabs">
        <div 
          v-for="tab in fileTabs" 
          :key="tab.id"
          :class="['tab', { 'active': tab.is_active, 'modified': tab.is_modified }]"
          @click="setActiveTab(tab.id)"
        >
          <span class="tab-name">{{ tab.name }}</span>
          <span v-if="tab.is_modified" class="modified-indicator">●</span>
          <button 
            @click.stop="closeFile(tab.id)" 
            class="close-tab"
            title="Close file"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="editor-actions">
        <button 
          v-if="unsavedFiles.length > 0"
          @click="saveAllFiles" 
          class="action-btn"
          title="Save all files"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
            <polyline points="17,21 17,13 7,13 7,21"></polyline>
            <polyline points="7,3 7,8 15,8"></polyline>
          </svg>
          Save All ({{ unsavedFiles.length }})
        </button>
        
        <button 
          v-if="activeFile?.is_modified"
          @click="saveActiveFile" 
          class="action-btn primary"
          title="Save current file"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
            <polyline points="17,21 17,13 7,13 7,21"></polyline>
            <polyline points="7,3 7,8 15,8"></polyline>
          </svg>
          Save
        </button>
        
        <button @click="closeEditor" class="action-btn" title="Close editor">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Editor Content -->
    <div class="editor-content">
      <div v-if="editorLoading" class="editor-loading">
        <div class="loading-spinner"></div>
        <p>Loading file...</p>
      </div>
      
      <div v-else-if="editorError" class="editor-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ editorError }}</p>
        <button @click="clearEditorError" class="btn btn-primary">Dismiss</button>
      </div>
      
      <div v-else-if="activeFile" class="editor-container">
        <div class="editor-info">
          <span class="file-path">{{ activeFile.path }}</span>
          <span class="language">{{ activeFile.language }}</span>
          <span v-if="activeFile.is_modified" class="modified">Modified</span>
        </div>
        
        <!-- CodeMirror Editor -->
        <div ref="editorContainer" class="code-editor"></div>
      </div>
      
      <div v-else class="editor-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10,9 9,9 8,9"></polyline>
        </svg>
        <p>No file open</p>
        <p>Select a file from the file explorer to start editing</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useFileStore } from '@/stores/file'
import { createUnifiedEditor } from '@/utils/codemirror-editor'
import type { EditorInstance } from '@/types/editor'
import type { EditorState } from '@/stores/file'
import { useTheme } from '@/composables/useTheme'
import { transformToLegacyTheme, legacyToEditorTheme } from '@/utils/themeCompat'

const fileStore = useFileStore()
const { currentTheme } = useTheme()

// State
const editorContainer = ref<HTMLElement>()
const editorInstance = ref<EditorInstance>()
const currentLanguage = ref<string>('plaintext')

// Computed
const showEditor = computed(() => fileStore.showEditor)
const fileTabs = computed(() => fileStore.fileTabs)
const activeFile = computed(() => fileStore.activeFile)
const unsavedFiles = computed(() => fileStore.unsavedFiles)
const editorLoading = computed(() => fileStore.editorLoading)
const editorError = computed(() => fileStore.editorError)

// Language mapping is now handled in the codemirror-editor utility

// Watch for active file changes
watch(activeFile, async (newFile, oldFile) => {
  if (newFile && newFile.path !== oldFile?.path) {
    await updateEditor(newFile)
  }
})

// Watch for language changes
watch(() => activeFile.value?.language, (newLang) => {
  if (newLang && newLang !== currentLanguage.value) {
    currentLanguage.value = newLang
    updateEditorLanguage()
  }
})

// Watch for theme changes and update editor
watch(currentTheme, (newTheme) => {
  if (newTheme && editorInstance.value) {
    const legacyTheme = transformToLegacyTheme(newTheme)
    const editorTheme = legacyToEditorTheme(legacyTheme)
    editorInstance.value.setTheme(editorTheme)
  }
}, { deep: true })

// Methods
const updateEditor = async (file: EditorState) => {
  if (!editorContainer.value) return
  
  await nextTick()
  
  try {
    // Clean up existing editor instance
    if (editorInstance.value) {
      editorInstance.value.destroy()
      editorInstance.value = undefined
    }
    
    // Use current theme from theme system
    const legacyTheme = currentTheme.value ? transformToLegacyTheme(currentTheme.value) : null
    const editorTheme = legacyTheme ? legacyToEditorTheme(legacyTheme) : {
      // Fallback to default dark theme
      type: 'dark' as const,
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
    }
    
    // Create new editor instance using the unified editor utility
    editorInstance.value = createUnifiedEditor(editorContainer.value, {
      content: file.content,
      readonly: false,
      theme: editorTheme,
      fileExtension: getFileExtension(file.path),
      onChange: (content: string) => {
        fileStore.updateFileContent(file.path, content)
      }
    })
    
    currentLanguage.value = file.language
    console.log('✅ Editor updated successfully for:', file.path)
    
  } catch (error) {
    console.error('❌ Failed to update editor:', error)
    fileStore.editorError = 'Failed to initialize editor'
  }
}

const updateEditorLanguage = () => {
  if (!editorInstance.value || !activeFile.value) return
  
  try {
    // File extension is handled internally by the editor utility
    
    // Reconfigure editor with new language
    editorInstance.value.setTheme({
      type: 'dark', // This could be made dynamic based on user preference
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
    })
    
    currentLanguage.value = activeFile.value.language
    console.log('🎨 Editor language updated to:', currentLanguage.value)
  } catch (error) {
    console.error('❌ Failed to update editor language:', error)
  }
}

const setActiveTab = (path: string) => {
  fileStore.setActiveTab(path)
}

const closeFile = (path: string) => {
  fileStore.closeFileInEditor(path)
}

const saveActiveFile = async () => {
  if (activeFile.value) {
    await fileStore.saveFile(activeFile.value.path)
  }
}

const saveAllFiles = async () => {
  await fileStore.saveAllFiles()
}

const closeEditor = () => {
  fileStore.closeEditor()
}

const clearEditorError = () => {
  fileStore.editorError = null
}

// Helper function to get file extension
const getFileExtension = (filePath: string): string | undefined => {
  const lastDotIndex = filePath.lastIndexOf('.')
  return lastDotIndex !== -1 ? filePath.slice(lastDotIndex + 1) : undefined
}

// Lifecycle
onMounted(() => {
  if (activeFile.value) {
    updateEditor(activeFile.value)
  }
})

onUnmounted(() => {
  if (editorInstance.value) {
    editorInstance.value.destroy()
  }
})
</script>

<style scoped>
.file-editor {
  position: fixed;
  top: 0;
  right: -100%;
  width: 60%;
  height: 100vh;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: right 0.3s ease;
  z-index: 1000;
}

.file-editor.editor-visible {
  right: 0;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  min-height: 48px;
}

.editor-tabs {
  display: flex;
  gap: 2px;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: thin;
}

.editor-tabs::-webkit-scrollbar {
  height: 4px;
}

.editor-tabs::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
}

.editor-tabs::-webkit-scrollbar-thumb {
  background: var(--text-muted);
  border-radius: 2px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 120px;
  max-width: 200px;
}

.tab:hover {
  background: var(--button-hover);
}

.tab.active {
  background: var(--bg-primary);
  border-color: var(--border-color);
  border-bottom-color: var(--bg-primary);
}

.tab.modified {
  border-left: 3px solid var(--warning);
}

.tab-name {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.modified-indicator {
  color: var(--warning);
  font-size: 10px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.close-tab {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.close-tab:hover {
  background: var(--error);
  color: white;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--button-hover);
}

.action-btn.primary {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.action-btn.primary:hover {
  background: var(--primary-dark);
}

.editor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-loading,
.editor-error,
.editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 48px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.editor-error svg,
.editor-empty svg {
  width: 64px;
  height: 64px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.editor-error p,
.editor-empty p {
  color: var(--text-secondary);
  margin: 8px 0;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
}

.file-path {
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}

.language {
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  text-transform: uppercase;
}

.modified {
  color: var(--warning);
  font-weight: 500;
}

.code-editor {
  flex: 1;
  overflow: hidden;
}

.code-editor :deep(.cm-editor) {
  height: 100%;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace;
  font-size: 14px;
}

.code-editor :deep(.cm-scroller) {
  overflow: auto;
}

.code-editor :deep(.cm-content) {
  padding: 16px;
}

.code-editor :deep(.cm-activeLine) {
  background: rgba(255, 255, 255, 0.05);
}

.code-editor :deep(.cm-selectionBackground) {
  background: rgba(255, 255, 255, 0.2);
}

.code-editor :deep(.cm-cursor) {
  border-left: 2px solid #50fa7b;
}

.code-editor :deep(.cm-gutters) {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
}

/* Responsive design */
@media (max-width: 1200px) {
  .file-editor {
    width: 70%;
  }
}

@media (max-width: 768px) {
  .file-editor {
    width: 100%;
    right: -100%;
  }
  
  .file-editor.editor-visible {
    right: 0;
  }
  
  .editor-header {
    flex-direction: column;
    gap: 8px;
    min-height: auto;
  }
  
  .editor-tabs {
    width: 100%;
  }
  
  .tab {
    min-width: 80px;
    max-width: 120px;
  }
  
  .tab-name {
    font-size: 11px;
  }
  
  .editor-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .action-btn {
    font-size: 11px;
    padding: 4px 8px;
  }
  
  .editor-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>