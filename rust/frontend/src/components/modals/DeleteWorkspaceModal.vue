<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Delete Workspace</h3>
        <button @click="closeModal" class="close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="warning-section">
          <div class="warning-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m21.73,18-8-14a2,2 0 0,0-3.48,0l-8,14A2,2 0 0,0,4,21H20a2,2 0 0,0,1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          
          <div class="warning-content">
            <h4>Are you sure you want to delete this workspace?</h4>
            <p v-if="workspaceStore.workspaceToDelete">
              This will permanently delete the <strong>{{ workspaceStore.workspaceToDelete.name }}</strong> workspace.
            </p>
          </div>
        </div>
        
        <div v-if="workspaceStore.workspaceToDelete" class="workspace-info">
          <div class="info-item">
            <span class="label">Name:</span>
            <span class="value">{{ workspaceStore.workspaceToDelete.name }}</span>
          </div>
          <div v-if="workspaceStore.workspaceToDelete.path" class="info-item">
            <span class="label">Path:</span>
            <span class="value">{{ workspaceStore.workspaceToDelete.path }}</span>
          </div>
          <div v-if="workspaceStore.workspaceToDelete.github_repo" class="info-item">
            <span class="label">Repository:</span>
            <span class="value">{{ workspaceStore.workspaceToDelete.github_repo }}</span>
          </div>
        </div>
        
        <div class="options-section">
          <label class="checkbox-container">
            <input 
              v-model="workspaceStore.deleteFiles" 
              type="checkbox" 
              class="checkbox-input"
            >
            <span class="checkbox-checkmark"></span>
            <span class="checkbox-label">
              Also delete files from disk
              <span class="checkbox-description">
                This will permanently remove all files in the workspace directory
              </span>
            </span>
          </label>
        </div>
        
        <div class="confirmation-section">
          <p class="confirmation-text">
            <strong>This action cannot be undone.</strong> 
            {{ workspaceStore.deleteFiles ? 'The workspace and all its files will be permanently deleted.' : 'Only the workspace reference will be removed.' }}
          </p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary" :disabled="workspaceStore.deletingWorkspace">
          Cancel
        </button>
        <button 
          @click="confirmDelete" 
          class="btn btn-danger"
          :disabled="workspaceStore.deletingWorkspace"
        >
          <div v-if="workspaceStore.deletingWorkspace" class="loading-spinner small"></div>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          {{ workspaceStore.deletingWorkspace ? 'Deleting...' : 'Delete Workspace' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWorkspaceStore } from '@/stores/workspace'

const workspaceStore = useWorkspaceStore()

const closeModal = () => {
  if (!workspaceStore.deletingWorkspace) {
    workspaceStore.closeDeleteModal()
  }
}

const confirmDelete = async () => {
  try {
    await workspaceStore.confirmDeleteWorkspace()
  } catch (err) {
    console.error('Failed to delete workspace:', err)
    // Error handling is done in the store
  }
}
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
  max-width: 500px;
  width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: scaleIn 0.2s ease-out;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--error);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.warning-section {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.warning-icon {
  flex-shrink: 0;
  color: var(--warning);
}

.warning-content h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.warning-content p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.4;
}

.workspace-info {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  margin-bottom: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item .label {
  font-weight: 500;
  color: var(--text-secondary);
  width: 80px;
  flex-shrink: 0;
}

.info-item .value {
  color: var(--text-primary);
  flex: 1;
  word-break: break-word;
}

.options-section {
  margin-bottom: 20px;
}

.checkbox-container {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;
}

.checkbox-input:checked {
  background: var(--error);
  border-color: var(--error);
}

.checkbox-input:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 6px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-label {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.4;
}

.checkbox-description {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.confirmation-section {
  background: var(--bg-tertiary);
  border: 1px solid var(--error);
  border-radius: 8px;
  padding: 16px;
}

.confirmation-text {
  margin: 0;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.4;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
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

.btn-danger {
  background: var(--error);
  color: white;
  border-color: var(--error);
}

.btn-danger:hover:not(:disabled) {
  background: var(--error-hover);
  border-color: var(--error-hover);
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.9);
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
    margin: 20px;
    max-height: calc(100vh - 40px);
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding-left: 16px;
    padding-right: 16px;
  }
  
  .warning-section {
    flex-direction: column;
    gap: 12px;
  }
  
  .info-item {
    flex-direction: column;
    gap: 4px;
  }
  
  .info-item .label {
    width: auto;
  }
}
</style>