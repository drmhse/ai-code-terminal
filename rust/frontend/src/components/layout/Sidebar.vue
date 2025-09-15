<template>
  <div class="sidebar" :class="{ 'mobile-open': uiStore.isMobile && uiStore.sidebarOpen }">
    <!-- Workspaces Section -->
    <div class="sidebar-section">
      <div class="section-header">
        <h2>Workspaces</h2>
        <button @click="workspaceStore.openRepositoriesModal" class="btn btn-small btn-icon" title="Clone Repository">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <div class="workspaces-list">
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
          <div class="workspace-content" @click="selectWorkspace(workspace)" :class="{ switching: workspaceSwitching && workspaceStore.selectedWorkspace?.id === workspace.id }">
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
    </div>

    <!-- File Explorer Section -->
    <div v-if="workspaceStore.selectedWorkspace" class="sidebar-section file-explorer">
      <div class="section-header">
        <h2>Files</h2>
        <div class="file-actions">
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
          class="search-input"
        >
        <button v-if="searchTerm" @click="clearFileSearch" class="search-clear">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- File Tree -->
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
import FileTree from '../FileTree.vue'

const workspaceStore = useWorkspaceStore()
const fileStore = useFileStore()
const uiStore = useUIStore()
const layoutStore = useLayoutStore()

const { refreshFiles, searchFiles, clearFileSearch } = useFileOperations()

const searchTerm = ref('')
const workspaceSwitching = ref(false)

const selectWorkspace = async (workspace: Workspace) => {
  // Prevent rapid workspace switching
  if (workspaceSwitching.value) {
    console.log('Workspace switch already in progress, ignoring click')
    return
  }

  // If already selected, do nothing
  if (workspaceStore.selectedWorkspace?.id === workspace.id) {
    return
  }

  try {
    workspaceSwitching.value = true
    await workspaceStore.switchWorkspace(workspace)
    await refreshFiles()
    await layoutStore.fetchLayouts(workspace.id)
  } catch (err) {
    console.error('Failed to select workspace:', err)
  } finally {
    workspaceSwitching.value = false
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
  flex: none;
  width: 100%;
  min-width: 200px;
  max-width: 280px;
  background: var(--sidebar-background);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sidebar-section:not(:last-child) {
  border-bottom: 1px solid var(--sidebar-border);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.section-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.btn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.15s ease;
}

.btn:hover {
  background: var(--button-hover);
  color: var(--text-primary);
  border-color: var(--border-focus);
}

.btn-small {
  padding: 6px 8px;
}

.btn-icon {
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-actions {
  display: flex;
  gap: 4px;
}

.workspaces-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 200px;
  max-height: 40vh;
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  color: var(--sidebar-text-secondary);
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px dashed var(--sidebar-border);
}

.empty-state p {
  margin-bottom: 16px;
  font-size: 13px;
}

.workspace-item {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid transparent;
  border-radius: 6px;
  margin-bottom: 4px;
  transition: all 0.15s ease;
  position: relative;
}

.workspace-item:hover {
  background: var(--sidebar-item-hover);
  border-color: var(--border-color);
  color: var(--sidebar-item-hover-text);
}

.workspace-item.selected {
  background: var(--sidebar-item-active);
  color: var(--sidebar-item-active-text);
}

.workspace-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  min-width: 0;
}

.workspace-content.switching {
  opacity: 0.6;
  pointer-events: none;
}

.icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.workspace-item:hover .icon,
.workspace-item.selected .icon {
  color: inherit;
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

.workspace-item:hover .workspace-name,
.workspace-item.selected .workspace-name {
  color: inherit;
}

.workspace-path {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.workspace-item:hover .workspace-path,
.workspace-item.selected .workspace-path {
  color: inherit;
  opacity: 0.8;
}

.delete-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
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

.file-explorer {
  flex: 1;
  min-height: 0;
}

.file-search {
  padding: 8px 12px;
  border-bottom: 1px solid var(--sidebar-border);
  position: relative;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  padding-right: 32px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: all 0.15s ease;
}

.search-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 2px rgba(0, 123, 204, 0.1);
}

.search-input::placeholder {
  color: var(--text-muted);
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
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
  min-height: 0;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 40px;
    left: -100%;
    bottom: 24px;
    width: min(80vw, 320px);
    z-index: 999;
    background: var(--sidebar-background);
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar.mobile-open {
    left: 0;
  }
}
</style>