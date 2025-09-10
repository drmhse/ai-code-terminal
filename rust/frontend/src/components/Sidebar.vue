<template>
  <div class="sidebar" :class="{ 'mobile-open': uiStore.isMobile && uiStore.sidebarOpen }">
    <div class="sidebar-header">
      <h2>Workspaces</h2>
      <button @click="workspaceStore.openRepositoriesModal" class="btn btn-small btn-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
    
    <div class="workspaces-section">
      <div v-if="!workspaceStore.hasWorkspaces" class="empty-state">
        <p>No workspaces yet</p>
        <button @click="workspaceStore.openRepositoriesModal" class="btn btn-small">
          Clone Repository
        </button>
      </div>
      
      <div 
        v-for="workspace in workspaceStore.workspaces" 
        :key="workspace.id" 
        class="workspace-item"
        :class="{ selected: workspaceStore.selectedWorkspace?.id === workspace.id }"
      >
        <div class="workspace-content" @click="selectWorkspace(workspace)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <div class="details">
            <div class="workspace-name">{{ workspace.name }}</div>
            <div class="workspace-path">{{ workspace.github_repo || workspace.path }}</div>
          </div>
        </div>
        <button 
          @click.stop="workspaceStore.openDeleteModal(workspace)" 
          class="delete-btn" 
          :title="`Delete ${workspace.name} workspace`"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- File Explorer Section -->
    <div v-if="workspaceStore.selectedWorkspace" class="file-explorer-section">
      <div class="sidebar-header">
        <h2>Files</h2>
        <div class="file-explorer-actions">
          <button @click="openCreateItemModal" class="btn btn-small btn-icon" title="New File">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14,2H6A2,2 0,0,0,4,4V20A2,2 0,0,0,6,22H18A2,2 0,0,0,20,20V8L14,2M18,20H6V4H13V9H18V20Z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
          </button>
          <button @click="openCreateFolderModal" class="btn btn-small btn-icon" title="New Folder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22,19A2,2 0,0,1,20,21H4A2,2 0,0,1,2,19V5A2,2 0,0,1,4,3H9L11,5H20A2,2 0,0,1,22,7V19Z"></path>
              <line x1="12" y1="11" x2="12" y2="17"></line>
              <line x1="9" y1="14" x2="15" y2="14"></line>
            </svg>
          </button>
          <button @click="fileStore.toggleHiddenFiles" class="btn btn-small btn-icon" 
                  :title="fileStore.showHiddenFiles ? 'Hide hidden files' : 'Show hidden files'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <g v-if="!fileStore.showHiddenFiles">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </g>
              <g v-else>
                <path d="m17.94,11.59a10.07,10.07 0,0 0,20.77,7.4"></path>
                <path d="m9.9,4.24A9.12,9.12 0,0 1,12,4c7,0 11,8 11,8a18.5,18.5 0,0 1,-2.16,3.19l-6.13-6.13Z"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M5.83,5.83a14.2,14.2 0,0 0,-4.78,6.17s4,8 11,8a9.71,9.71 0,0 0,5.93-2.05"></path>
                <path d="m11.95,7.95a2.57,2.57 0,0 1,3,3L11.95,7.95Z"></path>
              </g>
            </svg>
          </button>
          <button @click="() => refreshFiles()" class="btn btn-small btn-icon" title="Refresh Files" 
                  :disabled="fileStore.loadingFiles">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 :class="{ 'spinning': fileStore.loadingFiles }">
              <polyline points="23,4 23,10 17,10"></polyline>
              <polyline points="1,20 1,14 7,14"></polyline>
              <path d="m3.51,9a9,9 0 0,1,14.85-3.36L23,10M1,14l4.64,4.36A9,9 0 0,0,20.49,15"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- File Search -->
      <div class="file-search">
        <input 
          v-model="searchTerm" 
          @input="handleFileSearch"
          type="text" 
          placeholder="Search files..." 
          class="file-search-input"
        >
        <button v-if="searchTerm" @click="clearFileSearch" class="search-clear">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="file-tree">
        <FileTree />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useFileStore } from '@/stores/file'
import { useUIStore } from '@/stores/ui'
import { useLayoutStore } from '@/stores/layout'
import { useFileOperations } from '@/composables/useFileOperations'
import type { Workspace } from '@/types'
import FileTree from './FileTree.vue'

const workspaceStore = useWorkspaceStore()
const fileStore = useFileStore()
const uiStore = useUIStore()
const layoutStore = useLayoutStore()

// File operations composable
const { refreshFiles, searchFiles, clearFileSearch } = useFileOperations()

// File search state
const searchTerm = ref('')

const selectWorkspace = async (workspace: Workspace) => {
  try {
    await workspaceStore.switchWorkspace(workspace)
    // After switching workspace, refresh files
    await refreshFiles()
    // Fetch layouts for the selected workspace
    await layoutStore.fetchLayouts(workspace.id)
  } catch (err) {
    console.error('Failed to select workspace:', err)
  }
}

const handleFileSearch = () => {
  searchFiles(searchTerm.value)
}

const openCreateItemModal = () => {
  uiStore.openCreateItemModal(fileStore.currentPath)
}

const openCreateFolderModal = () => {
  uiStore.openCreateItemModal(fileStore.currentPath)
}

</script>

<style scoped>
.sidebar {
  width: 300px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(180deg, var(--bg-sidebar) 0%, rgba(24, 24, 24, 0.95) 100%);
  backdrop-filter: blur(10px);
}

.sidebar-header h2 {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: 0.02em;
}

.btn-small {
  padding: 6px 8px;
  font-size: 12px;
}

.btn-icon {
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workspaces-section {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  padding: 32px 20px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 12px;
  margin: 12px;
  border: 1px dashed var(--border-color);
}

.empty-state p {
  margin-bottom: 20px;
  font-size: 14px;
  line-height: 1.4;
}

.workspace-item {
  display: flex;
  align-items: center;
  background: var(--sidebar-item-bg);
  border: 1px solid transparent;
  border-radius: 8px;
  margin-bottom: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.workspace-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 3px;
  background: var(--primary);
  transform: scaleY(0);
  transition: transform 0.2s ease;
}

.workspace-item:hover {
  background: var(--sidebar-item-hover-bg);
  border-color: var(--border-color);
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.workspace-item.selected {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 123, 204, 0.3);
}

.workspace-item.selected::before {
  transform: scaleY(1);
}

.workspace-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  cursor: pointer;
}

.icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.workspace-item.selected .icon {
  color: white;
}

.details {
  min-width: 0;
  flex: 1;
}

.workspace-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-item.selected .workspace-name {
  color: white;
}

.workspace-path {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.workspace-item.selected .workspace-path {
  color: rgba(255, 255, 255, 0.8);
}

.delete-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  margin-right: 4px;
  opacity: 0;
  transition: all 0.15s ease;
}

.workspace-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: var(--error);
  color: white;
}

.file-explorer-section {
  border-top: 1px solid var(--border-color);
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.file-explorer-actions {
  display: flex;
  gap: 4px;
}

.file-search {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.file-search-input {
  width: 100%;
  padding: 10px 14px;
  padding-right: 36px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.file-search-input:focus {
  border-color: var(--primary);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(0, 123, 204, 0.1);
  transform: translateY(-1px);
}

.file-search-input::placeholder {
  color: var(--text-muted);
  font-style: italic;
}

.search-clear {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* FileTree component styles are handled internally */

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 48px;
    left: -300px;
    height: calc(100vh - 48px);
    z-index: 999;
    transition: left 0.2s ease;
  }

  .sidebar.mobile-open {
    left: 0;
  }
}
</style>