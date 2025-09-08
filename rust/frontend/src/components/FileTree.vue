<template>
  <div class="file-tree">
    <!-- Breadcrumb Navigation -->
    <div v-if="fileStore.pathSegments.length > 0" class="breadcrumb">
      <button @click="navigateUp" class="breadcrumb-item" title="Go to parent directory">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        ..
      </button>
      <span 
        v-for="(segment, index) in fileStore.pathSegments" 
        :key="index" 
        class="breadcrumb-separator"
      >
        /
        <button 
          @click="navigateToSegment(index)" 
          class="breadcrumb-item"
        >
          {{ segment }}
        </button>
      </span>
    </div>
    
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
    
    <!-- File List -->
    <div v-else class="file-list">
      <div 
        v-for="(file, index) in fileStore.filteredFiles" 
        :key="file.path"
        class="file-item"
        :class="{ 
          selected: fileStore.selectedFile?.path === file.path,
          'keyboard-selected': fileStore.selectedFileIndex === index
        }"
        @click="handleFileClick(file, index)"
        @dblclick="handleFileDoubleClick(file)"
        @contextmenu="handleFileContextMenu($event, file)"
      >
        <svg 
          :width="16" 
          :height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
          class="file-icon"
        >
          <!-- Directory icon -->
          <path v-if="file.type === 'directory'" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          <!-- File icon -->
          <path v-else d="M14,2H6A2,2 0,0 0,4,4V20a2,2 0,0 0,2,2H18a2,2 0,0 0,2-2V8Z"></path>
          <polyline v-if="file.type === 'file'" points="14,2 14,8 20,8"></polyline>
        </svg>
        
        <div class="file-info">
          <div class="file-name">{{ file.name }}</div>
          <div v-if="file.type === 'file' && file.size" class="file-meta">
            {{ formatFileSize(file.size) }}
            <span v-if="file.modified"> • {{ formatDate(file.modified) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useFileStore } from '@/stores/file'
import { useFileOperations } from '@/composables/useFileOperations'

const workspaceStore = useWorkspaceStore()
const fileStore = useFileStore()

// File operations composable
const { 
  refreshFiles, 
  handleFileClick, 
  handleFileDoubleClick, 
  handleFileContextMenu,
  navigateUp,
  navigateToSegment,
  formatFileSize
} = useFileOperations()

// Load files when workspace changes
watch(() => workspaceStore.selectedWorkspace, async () => {
  if (workspaceStore.selectedWorkspace) {
    await refreshFiles()
  }
}, { immediate: true })

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}

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

/* Breadcrumb Navigation */
.breadcrumb {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  font-size: 11px;
  color: var(--text-secondary);
}

.breadcrumb-item {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.breadcrumb-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.breadcrumb-separator {
  display: flex;
  align-items: center;
  gap: 4px;
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
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
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

/* File List */
.file-list {
  padding: 4px 0;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 4px;
  transition: all 0.15s ease;
  user-select: none;
}

.file-item:hover {
  background: var(--sidebar-item-hover-bg);
}

.file-item.selected {
  background: var(--primary);
  color: white;
}

.file-item.keyboard-selected {
  background: var(--sidebar-item-selected-bg);
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.file-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.file-item.selected .file-icon {
  color: white;
}

.file-item[data-type="directory"] .file-icon {
  color: var(--primary);
}

.file-item.selected[data-type="directory"] .file-icon {
  color: white;
}

.file-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.file-name {
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.file-item.selected .file-name {
  color: white;
}

.file-meta {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.file-item.selected .file-meta {
  color: rgba(255, 255, 255, 0.8);
}

/* Directory specific styling */
.file-item[data-type="directory"] {
  font-weight: 500;
}

.file-item[data-type="directory"] .file-name {
  color: var(--primary);
}

.file-item.selected[data-type="directory"] .file-name {
  color: white;
}
</style>