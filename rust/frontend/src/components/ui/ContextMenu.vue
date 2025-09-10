<template>
  <div 
    v-if="fileStore.showContextMenu"
    class="context-menu"
    :style="{ 
      left: fileStore.contextMenuX + 'px', 
      top: fileStore.contextMenuY + 'px' 
    }"
    @click.stop
  >
    <div v-if="fileStore.contextMenuFile" class="context-menu-header">
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
        <path v-if="fileStore.contextMenuFile.type === 'directory'" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <!-- File icon -->
        <template v-else>
          <path d="M14,2H6A2,2 0,0 0,4,4V20a2,2 0,0 0,2,2H18a2,2 0,0 0,2-2V8Z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
        </template>
      </svg>
      <span class="file-name">{{ fileStore.contextMenuFile.name }}</span>
    </div>
    
    <div class="context-menu-divider"></div>
    
    <div class="context-menu-items">
      <!-- File-specific actions -->
      <template v-if="fileStore.contextMenuFile?.type === 'file'">
        <button @click="previewFile" class="context-menu-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>Open</span>
          <kbd class="keybind">Enter</kbd>
        </button>
        
        <button @click="editFile" class="context-menu-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>Edit</span>
          <kbd class="keybind">F2</kbd>
        </button>
        
        <div class="context-menu-divider"></div>
        
        <button @click="openInTerminal" class="context-menu-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4,17 10,11 4,5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span>Open in Terminal</span>
        </button>
        
        <button @click="runCommand('cat')" class="context-menu-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
          <span>View Content</span>
        </button>
      </template>
      
      <!-- Directory-specific actions -->
      <template v-if="fileStore.contextMenuFile?.type === 'directory'">
        <button @click="openDirectory" class="context-menu-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Open Folder</span>
          <kbd class="keybind">Enter</kbd>
        </button>
        
        <button @click="openInTerminal" class="context-menu-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4,17 10,11 4,5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span>Open in Terminal</span>
        </button>
        
        <div class="context-menu-divider"></div>
        
        <button @click="runCommand('ls -la')" class="context-menu-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>
          </svg>
          <span>List Contents</span>
        </button>
      </template>
      
      <div class="context-menu-divider"></div>
      
      <!-- Copy actions -->
      <button @click="copyFileName" class="context-menu-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
          <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
        </svg>
        <span>Copy Name</span>
        <kbd class="keybind">Ctrl+C</kbd>
      </button>
      
      <button @click="copyFilePath" class="context-menu-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17,8 12,3 7,8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>Copy Path</span>
        <kbd class="keybind">Ctrl+Shift+C</kbd>
      </button>
      
      <div class="context-menu-divider"></div>
      
      <!-- File operations -->
      <button @click="renameFile" class="context-menu-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-4 1 1-4 5.4-5.4z"></path>
        </svg>
        <span>Rename</span>
        <kbd class="keybind">F2</kbd>
      </button>
      
      <button @click="duplicateFile" class="context-menu-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
          <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
        </svg>
        <span>Duplicate</span>
        <kbd class="keybind">Ctrl+D</kbd>
      </button>
      
      <div class="context-menu-divider"></div>
      
      <!-- Destructive actions -->
      <button @click="deleteFile" class="context-menu-item danger">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <span>Delete</span>
        <kbd class="keybind">Del</kbd>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFileStore } from '@/stores/file'
import { useFileOperations } from '@/composables/useFileOperations'
import { useUIStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'

const fileStore = useFileStore()
const uiStore = useUIStore()
const workspaceStore = useWorkspaceStore()
const fileOperations = useFileOperations()

const previewFile = async () => {
  if (!fileStore.contextMenuFile) return
  
  await fileOperations.showFilePreview(fileStore.contextMenuFile)
  fileStore.closeContextMenu()
}

const editFile = async () => {
  if (!fileStore.contextMenuFile) return
  
  await fileOperations.showFilePreview(fileStore.contextMenuFile)
  // The file preview modal will handle edit mode
  fileStore.closeContextMenu()
}

const openDirectory = async () => {
  if (!fileStore.contextMenuFile || fileStore.contextMenuFile.type !== 'directory') return
  
  await fileOperations.handleFileDoubleClick(fileStore.contextMenuFile)
  fileStore.closeContextMenu()
}

const openInTerminal = () => {
  if (!fileStore.contextMenuFile) return
  
  // This would send a command to the terminal to cd into the directory
  // or open the file location
  const path = fileStore.contextMenuFile.type === 'directory' 
    ? fileStore.contextMenuFile.path 
    : fileStore.contextMenuFile.path.substring(0, fileStore.contextMenuFile.path.lastIndexOf('/'))
  
  runCommand(`cd "${path}"`)
  fileStore.closeContextMenu()
}

const runCommand = (command: string) => {
  if (!fileStore.contextMenuFile) return
  
  // Replace placeholder with actual file path
  const filePath = fileStore.contextMenuFile.path
  const finalCommand = command.includes('cat') ? `${command} "${filePath}"` : command
  
  // This would send the command to the active terminal
  // For now, just show a notification
  uiStore.addResourceAlert({
    type: 'info',
    title: 'Terminal Command',
    message: `Running: ${finalCommand}`
  })
  
  console.log('Running terminal command:', finalCommand)
  fileStore.closeContextMenu()
}

const copyFileName = () => {
  if (!fileStore.contextMenuFile) return
  
  fileOperations.copyToClipboard(fileStore.contextMenuFile.name)
  fileStore.closeContextMenu()
}

const copyFilePath = () => {
  if (!fileStore.contextMenuFile) return
  
  fileOperations.copyToClipboard(fileStore.contextMenuFile.path)
  fileStore.closeContextMenu()
}

const renameFile = async () => {
  if (!fileStore.contextMenuFile) return
  
  const newName = prompt('Enter new name:', fileStore.contextMenuFile.name)
  if (newName && newName !== fileStore.contextMenuFile.name) {
    try {
      await fileStore.renameFile(fileStore.contextMenuFile, newName)
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'File Renamed',
        message: `Renamed to ${newName}`
      })
    } catch (err) {
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Rename Failed',
        message: err instanceof Error ? err.message : 'Failed to rename file'
      })
    }
  }
  
  fileStore.closeContextMenu()
}

const duplicateFile = async () => {
  if (!fileStore.contextMenuFile) return
  
  const extension = fileStore.contextMenuFile.name.includes('.') 
    ? fileStore.contextMenuFile.name.substring(fileStore.contextMenuFile.name.lastIndexOf('.'))
    : ''
  const baseName = extension 
    ? fileStore.contextMenuFile.name.substring(0, fileStore.contextMenuFile.name.lastIndexOf('.'))
    : fileStore.contextMenuFile.name
  
  const newName = `${baseName}_copy${extension}`
  
  try {
    // This would duplicate the file
    uiStore.addResourceAlert({
      type: 'info',
      title: 'File Duplicated',
      message: `Created ${newName}`
    })
    
    console.log('Duplicating file:', fileStore.contextMenuFile.name, 'to', newName)
  } catch (err) {
    uiStore.addResourceAlert({
      type: 'error',
      title: 'Duplicate Failed',
      message: err instanceof Error ? err.message : 'Failed to duplicate file'
    })
  }
  
  fileStore.closeContextMenu()
}

const deleteFile = async () => {
  if (!fileStore.contextMenuFile) return
  
  uiStore.openConfirmDeleteModal({
    itemName: fileStore.contextMenuFile.name,
    itemType: fileStore.contextMenuFile.type === 'directory' ? 'folder' : 'file',
    additionalInfo: fileStore.contextMenuFile.type === 'directory' 
      ? 'This will delete the folder and all its contents. This action cannot be undone.'
      : 'This action cannot be undone.',
    onConfirm: async () => {
      await fileStore.deleteFile(fileStore.contextMenuFile!)
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Item Deleted',
        message: `Deleted ${fileStore.contextMenuFile!.name}`
      })
    }
  })
  
  fileStore.closeContextMenu()
}
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 8px 0;
  min-width: 200px;
  max-width: 280px;
  z-index: 2000;
  font-size: 14px;
  animation: contextMenuIn 0.15s ease-out;
}

.context-menu-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin-bottom: 4px;
}

.file-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.file-name {
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.context-menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.context-menu-items {
  padding: 0;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  transition: background-color 0.15s ease;
}

.context-menu-item:hover {
  background: var(--sidebar-item-hover-bg);
}

.context-menu-item:active {
  background: var(--bg-tertiary);
}

.context-menu-item.danger {
  color: var(--error);
}

.context-menu-item.danger:hover {
  background: var(--error);
  color: white;
}

.context-menu-item svg {
  flex-shrink: 0;
  color: currentColor;
}

.context-menu-item span {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.keybind {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
  margin-left: 8px;
}

@keyframes contextMenuIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Ensure menu doesn't go off-screen */
.context-menu {
  /* These will be adjusted by JavaScript if needed */
  transform-origin: top left;
}

@media (max-width: 768px) {
  .context-menu {
    min-width: 160px;
    font-size: 16px; /* Larger touch targets on mobile */
  }
  
  .context-menu-item {
    padding: 12px 16px;
  }
  
  .keybind {
    display: none; /* Hide keyboard shortcuts on mobile */
  }
}
</style>