<template>
  <div class="file-tree">
    <!-- Loading State -->
    <div v-if="fileStore.loadingFiles" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading files...</span>
    </div>
    
    <!-- Error State -->
    <div v-else-if="fileStore.fileError" class="error-state">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>{{ fileStore.fileError }}</span>
      <button @click="() => refreshFiles()" class="retry-btn">Retry</button>
    </div>
    
    <!-- Empty State -->
    <div v-else-if="!fileStore.hasFiles" class="empty-state">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>No files found</span>
    </div>
    
    <!-- VS Code-like Tree View -->
    <div v-else class="tree-container">
      <FileTreeNode
        v-for="file in filteredTreeFiles"
        :key="file.path"
        :node="file"
        :level="0"
        :selected-path="selectedPath"
        @select="handleFileSelect"
        @toggle="handleDirectoryToggle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useFileStore } from '@/stores/file'
import { useFileOperations } from '@/composables/useFileOperations'
import FileTreeNode from './FileTreeNode.vue'
import type { FileItem } from '@/stores/file'

const workspaceStore = useWorkspaceStore()
const fileStore = useFileStore()

// File operations composable
const { refreshFiles } = useFileOperations()

// Computed property for selected path with proper typing
const selectedPath = computed(() => fileStore.selectedFile?.path ?? undefined)

// Computed property to filter tree files (VS Code-like)
const filteredTreeFiles = computed(() => {
  const tree = fileStore.fileTree
  if (!tree) return []
  
  return tree.filter(file => 
    fileStore.showHiddenFiles || !file.isHidden
  ) as FileItem[]
})

// Handle file selection (VS Code behavior)
const handleFileSelect = (file: FileItem) => {
  fileStore.selectFile(file)
}

// Handle directory expansion/collapse (VS Code behavior)
const handleDirectoryToggle = async (file: FileItem) => {
  await fileStore.toggleDirectoryExpansion(file)
}

// Load files when workspace changes
watch(() => workspaceStore.selectedWorkspace, async () => {
  if (workspaceStore.selectedWorkspace) {
    await refreshFiles()
  }
}, { immediate: true })

onMounted(async () => {
  if (workspaceStore.selectedWorkspace) {
    await refreshFiles()
  }
})
</script>

<style scoped>
.file-tree {
  height: 100%;
  overflow-y: auto;
  font-size: 13px;
}

/* Loading, Error, Empty States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  gap: 8px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-top: 2px solid var(--primary);
  border-right: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
  box-shadow: 0 0 10px rgba(0, 123, 204, 0.3);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  color: var(--error);
}

.retry-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 4px;
  transition: all 0.15s ease;
}

.retry-btn:hover {
  background: var(--button-hover);
}

/* VS Code-like Tree Container */
.tree-container {
  padding: 4px 0;
}
</style>