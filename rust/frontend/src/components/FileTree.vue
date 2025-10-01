<template>
  <div class="file-tree" role="tree" aria-label="File Explorer">
    <!-- Loading State -->
    <div v-if="fileStore.loadingFiles" class="loading-state" role="status" aria-live="polite">
      <div class="loading-spinner" aria-hidden="true"></div>
      <span>Loading files...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="fileStore.fileError" class="error-state" role="alert">
      <ExclamationCircleIcon class="icon-base" aria-hidden="true" />
      <span>{{ fileStore.fileError }}</span>
      <button @click="() => refreshFiles()" class="retry-btn" aria-label="Retry loading files">
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!fileStore.hasFiles" class="empty-state" role="status">
      <FolderIcon class="icon-base" aria-hidden="true" />
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
import { ExclamationCircleIcon, FolderIcon } from '@heroicons/vue/24/outline'

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
/* ===================================
   FILE TREE CONTAINER
   VS Code/Zed inspired design
   =================================== */

.file-tree {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  font-size: var(--font-size-sm);
}

/* Loading, Error, Empty States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  gap: var(--space-3);
}

.loading-state .icon-base,
.error-state .icon-base,
.empty-state .icon-base {
  width: 32px;
  height: 32px;
  color: var(--color-text-tertiary);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-top: 2px solid var(--color-interactive-primary);
  border-radius: 50%;
  animation: spin 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  color: var(--color-semantic-error);
}

.error-state .icon-base {
  color: var(--color-semantic-error);
}

.retry-btn {
  background: var(--color-interactive-tertiary);
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-base);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  margin-top: var(--space-1);
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.retry-btn:hover {
  background: var(--color-interactive-tertiary-hover);
  border-color: var(--color-border-hover);
}

.retry-btn:active {
  transform: scale(0.98);
}

/* Tree Container - Clean, minimal spacing */
.tree-container {
  padding: var(--space-1) 0;
}

/* Custom scrollbar for file tree */
.file-tree::-webkit-scrollbar {
  width: 10px;
}

.file-tree::-webkit-scrollbar-track {
  background: transparent;
}

.file-tree::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: var(--radius-base);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.file-tree::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
  background-clip: padding-box;
}
</style>