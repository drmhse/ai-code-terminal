<template>
  <div class="file-editor" :class="{ 'editor-visible': showEditor, 'docked-mode': docked }">
    <!-- Consolidated Editor Header - Single Row -->
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
            <XMarkIcon class="icon-sm" />
          </button>
        </div>
      </div>

      <!-- Consolidated File Info - Language and Status -->
      <div v-if="activeFile" class="editor-meta">
        <span class="language">{{ activeFile.language }}</span>
        <span v-if="activeFile.is_modified" class="modified">Modified</span>
      </div>

      <div class="editor-actions">
        <button
          v-if="unsavedFiles.length > 0"
          @click="saveAllFiles"
          class="action-btn"
          title="Save all files"
        >
          <ArrowDownTrayIcon class="icon-base" />
          Save All ({{ unsavedFiles.length }})
        </button>

        <button
          v-if="activeFile?.is_modified"
          @click="saveActiveFile"
          class="action-btn primary"
          title="Save current file"
        >
          <ArrowDownTrayIcon class="icon-base" />
          Save
        </button>

        <button @click="closeEditor" class="close-btn" title="Close editor">
          <XMarkIcon class="icon-sm" />
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
        <!-- CodeMirror Editor - No redundant info bar -->
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
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline'

// Props
const props = defineProps<{
  docked?: boolean
}>()

const fileStore = useFileStore()
const { currentTheme } = useTheme()

// Set default docked to false for backward compatibility
const docked = computed(() => props.docked ?? false)

// State
const editorContainer = ref<HTMLElement>()
const editorInstance = ref<EditorInstance>()
const currentLanguage = ref<string>('plaintext')
const isUpdatingEditor = ref(false)

// Computed
const showEditor = computed(() => fileStore.showEditor)
const fileTabs = computed(() => fileStore.fileTabs)
const activeFile = computed(() => fileStore.activeFile)
const unsavedFiles = computed(() => fileStore.unsavedFiles)
const editorLoading = computed(() => fileStore.editorLoading)
const editorError = computed(() => fileStore.editorError)

// Language mapping is now handled in the codemirror-editor utility

// Watch for active file changes
watch(activeFile, async (newFile) => {
  if (newFile) {
    // Always update the editor when there's an active file
    // This ensures content displays even when switching between tabs
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
  // Prevent concurrent updates
  if (isUpdatingEditor.value) {
    console.log('🔄 Editor update already in progress, skipping...')
    return
  }

  if (!editorContainer.value) {
    console.warn('⚠️ Editor container not available, retrying...')
    await nextTick()
    if (!editorContainer.value) {
      console.error('❌ Editor container still not available after nextTick')
      return
    }
  }

  isUpdatingEditor.value = true
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
  } finally {
    isUpdatingEditor.value = false
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
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  /* Remove z-index as it's no longer floating */
}

.editor-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 12px 0 0;
  background: var(--bg-secondary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 42px;
  gap: 12px;
  position: relative;
}

.editor-tabs {
  display: flex;
  gap: 1px;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  align-items: flex-end;
  padding: 4px 0 0 12px;
}

.editor-tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.12s ease;
  max-width: 240px; /* Only constrain extreme cases */
  position: relative;
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0; /* Prevent tabs from shrinking below content size */
  height: 30px;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
}

.tab.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  border-bottom: 2px solid var(--primary);
  z-index: 2;
}

.tab.modified::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 8px;
  background: var(--warning);
  border-radius: 1px;
}

.tab-name {
  font-size: 12px;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 400;
  /* Let content determine width naturally */
}

.modified-indicator {
  color: var(--warning);
  font-size: 8px;
  opacity: 0.8;
}

.close-tab {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 1px;
  border-radius: 2px;
  transition: opacity 0.12s ease;
  flex-shrink: 0;
  opacity: 0.6;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-tab:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* Consolidated file metadata in header */
.editor-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
  font-size: 12px;
  height: 100%;
}

.editor-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 100%;
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

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  min-width: 32px;
  height: 32px;
}

.close-btn:hover {
  background: var(--error, #f14c4c);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(241, 76, 76, 0.4);
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
  margin-top: -1px; /* Pull content up to eliminate any gap */
}

/* Updated styles for language and modified indicators in header */
.editor-meta .language {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 500;
}

.editor-meta .modified {
  color: var(--warning);
  font-weight: 500;
  font-size: 11px;
}

.code-editor {
  flex: 1;
  overflow: hidden;
  border-top: none; /* Ensure no top border creates separation */
}

.code-editor :deep(.cm-editor) {
  height: 100%;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace;
  font-size: 14px;
  border: none; /* Remove any default CodeMirror borders */
  margin: 0; /* Remove any default margins */
}

.code-editor :deep(.cm-scroller) {
  overflow: auto;
}

.code-editor :deep(.cm-content) {
  padding: 0 16px 16px 16px; /* Remove top padding for seamless tab connection */
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

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .editor-header {
    flex-direction: column;
    gap: 8px;
    min-height: auto;
  }

  .editor-tabs {
    width: 100%;
  }

  .tab {
    max-width: 120px; /* Tighter constraint on mobile */
    padding: 4px 8px;
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

  /* Compact meta section on mobile */
  .editor-meta {
    gap: 8px;
    font-size: 11px;
  }
}
</style>