<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Unsaved Changes</h3>
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
            <h4>You have unsaved changes</h4>
            <p>Your changes will be lost if you continue without saving.</p>
          </div>
        </div>
        
        <div v-if="fileStore.changesSummary" class="changes-summary">
          <h5>Changes:</h5>
          <p>{{ fileStore.changesSummary }}</p>
        </div>
        
        <div class="action-description">
          <p v-if="fileStore.discardAction === 'exitEdit'">
            This will discard your changes and exit edit mode.
          </p>
          <p v-else-if="fileStore.discardAction === 'closeModal'">
            This will discard your changes and close the file.
          </p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary">
          Cancel
        </button>
        <button @click="saveChanges" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
          </svg>
          Save Changes
        </button>
        <button @click="discardChanges" class="btn btn-danger">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
          </svg>
          Discard Changes
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFileStore } from '@/stores/file'
import { useEditorStore } from '@/stores/editor'
import { useFileOperations } from '@/composables/useFileOperations'

const fileStore = useFileStore()
const editorStore = useEditorStore()
const fileOperations = useFileOperations()

const closeModal = () => {
  fileStore.closeDiscardModal()
}

const saveChanges = async () => {
  try {
    const success = await fileOperations.saveFile()
    if (success) {
      closeModal()
      
      // Perform the original action after saving
      if (fileStore.discardAction === 'exitEdit') {
        editorStore.exitEditMode()
      } else if (fileStore.discardAction === 'closeModal') {
        fileStore.closeFilePreviewModal()
      }
    }
  } catch (err) {
    console.error('Failed to save file:', err)
    // Keep modal open on save error
  }
}

const discardChanges = () => {
  // Perform the discard action
  fileOperations.performDiscardChanges(fileStore.discardAction)
  
  closeModal()
  
  // Perform the original action after discarding
  if (fileStore.discardAction === 'closeModal') {
    fileStore.closeFilePreviewModal()
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
  z-index: 1100; /* Higher than file preview modal */
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
  color: var(--warning);
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
  margin-bottom: 20px;
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

.changes-summary {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.changes-summary h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.changes-summary p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: monospace;
}

.action-description {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}

.action-description p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
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

.btn-secondary {
  background: var(--button-secondary-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-secondary:hover {
  background: var(--button-secondary-hover);
}

.btn-primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.btn-danger {
  background: var(--error);
  color: white;
  border-color: var(--error);
}

.btn-danger:hover {
  background: var(--error-hover);
  border-color: var(--error-hover);
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
  
  .modal-footer {
    flex-direction: column;
    gap: 8px;
  }
  
  .modal-footer .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>