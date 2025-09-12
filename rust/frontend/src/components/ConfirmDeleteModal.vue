<template>
  <div v-if="isOpen" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <div class="header-content">
          <div class="warning-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div>
            <h3>Delete {{ itemType }}</h3>
            <p class="subtitle">This action cannot be undone</p>
          </div>
        </div>
        <button @click="close" class="close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="warning-message">
          <p>Are you sure you want to permanently delete the {{ itemType }} <strong>"{{ itemName }}"</strong>?</p>
          <p v-if="additionalInfo" class="additional-info">{{ additionalInfo }}</p>
        </div>
        
        <div v-if="showConfirmationInput" class="form-group">
          <label :for="confirmationInputId">
            Type <strong>{{ confirmationText }}</strong> to confirm:
          </label>
          <input
            :id="confirmationInputId"
            ref="confirmationInput"
            v-model="confirmationValue"
            type="text"
            :placeholder="`Type ${confirmationText} to confirm deletion`"
            @keyup.enter="handleDelete"
            @keyup.esc="close"
          />
        </div>
        
        <div class="modal-actions">
          <button @click="close" class="btn btn-secondary">Cancel</button>
          <button 
            @click="handleDelete" 
            class="btn btn-danger"
            :disabled="!canDelete"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1 2-2h4a2,2 0 0,1 2,2v2"></path>
            </svg>
            Delete {{ itemType }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

interface Props {
  isOpen: boolean
  itemName: string
  itemType: 'file' | 'folder' | 'workspace' | 'repository' | 'terminal'
  additionalInfo?: string | undefined
  showConfirmationInput?: boolean | undefined
  confirmationText?: string | undefined
}

interface Emits {
  (e: 'close'): void
  (e: 'confirm'): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

const confirmationValue = ref('')
const confirmationInput = ref<HTMLInputElement>()
const confirmationInputId = computed(() => `delete-confirmation-${props.itemName.replace(/[^a-zA-Z0-9]/g, '-')}`)

const canDelete = computed(() => {
  if (!props.showConfirmationInput) {
    return true
  }
  return confirmationValue.value.toLowerCase() === props.confirmationText?.toLowerCase()
})

// Watch for modal open to focus input if needed
watch(() => props.isOpen, (newVal) => {
  if (newVal && props.showConfirmationInput) {
    nextTick(() => {
      confirmationInput.value?.focus()
    })
  } else if (!newVal) {
    resetForm()
  }
})

const handleDelete = () => {
  if (!canDelete.value) {
    return
  }
  
  emit('confirm')
}

const handleOverlayClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    close()
  }
}

const close = () => {
  emit('close')
}

const resetForm = () => {
  confirmationValue.value = ''
}

// Expose close method for external use
defineExpose({
  close,
  resetForm
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.warning-icon {
  color: var(--warning);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.warning-message {
  margin-bottom: 20px;
}

.warning-message p {
  margin: 0 0 8px 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
}

.warning-message strong {
  color: var(--error);
  font-weight: 600;
}

.additional-info {
  font-size: 13px !important;
  color: var(--text-muted) !important;
  margin-top: 8px !important;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.15s ease;
}

.form-group input[type="text"]:focus {
  outline: none;
  border-color: var(--error);
  box-shadow: 0 0 0 2px rgba(var(--error-rgb), 0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--button-bg);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn:hover:not(:disabled) {
  background: var(--button-hover);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--button-hover);
  color: var(--text-primary);
}

.btn-danger {
  background: var(--error);
  border-color: var(--error);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--error-hover);
  border-color: var(--error-hover);
}

@media (max-width: 640px) {
  .modal-content {
    width: 95%;
    max-width: none;
  }
  
  .modal-body {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .modal-actions {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
  }
}
</style>