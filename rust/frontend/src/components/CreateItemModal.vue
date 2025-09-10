<template>
  <div v-if="isOpen" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Create New Item</h3>
        <button @click="close" class="close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label for="item-name">Name</label>
          <input
            id="item-name"
            ref="nameInput"
            v-model="itemName"
            type="text"
            placeholder="Enter item name"
            @keyup.enter="handleCreate"
            @keyup.esc="close"
          />
          <div v-if="nameError" class="error-message">{{ nameError }}</div>
        </div>
        
        <div class="form-group">
          <label>Type</label>
          <div class="type-selector">
            <label class="type-option">
              <input
                v-model="itemType"
                type="radio"
                value="file"
                name="item-type"
              />
              <div class="type-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
                <span>File</span>
              </div>
            </label>
            
            <label class="type-option">
              <input
                v-model="itemType"
                type="radio"
                value="directory"
                name="item-type"
              />
              <div class="type-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" />
                </svg>
                <span>Folder</span>
              </div>
            </label>
          </div>
        </div>
        
        <div v-if="itemType === 'file'" class="form-group">
          <label for="file-content">Initial Content (optional)</label>
          <textarea
            id="file-content"
            v-model="fileContent"
            placeholder="Enter initial file content..."
            rows="4"
          ></textarea>
        </div>
        
        <div class="modal-actions">
          <button @click="close" class="btn btn-secondary">Cancel</button>
          <button 
            @click="handleCreate" 
            class="btn btn-primary"
            :disabled="!canCreate"
          >
            Create {{ itemType === 'file' ? 'File' : 'Folder' }}
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
  parentPath: string
}

interface Emits {
  (e: 'close'): void
  (e: 'create', data: { name: string; type: 'file' | 'directory'; content?: string }): void
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  parentPath: ''
})

const emit = defineEmits<Emits>()

const itemName = ref('')
const itemType = ref<'file' | 'directory'>('file')
const fileContent = ref('')
const nameError = ref('')
const nameInput = ref<HTMLInputElement>()

// Validation
const invalidChars = /[\\/:*?"<>|]/
const reservedNames = ['.', '..', 'CON', 'PRN', 'AUX', 'NUL', 
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']

const validateName = (name: string): string | null => {
  if (!name.trim()) {
    return 'Name is required'
  }
  
  if (name.trim().length > 255) {
    return 'Name must be less than 255 characters'
  }
  
  if (invalidChars.test(name)) {
    return 'Name cannot contain \\ / : * ? " < > | characters'
  }
  
  if (reservedNames.includes(name.toUpperCase())) {
    return 'This name is reserved by the system'
  }
  
  if (name.endsWith(' ') || name.endsWith('.')) {
    return 'Name cannot end with a space or dot'
  }
  
  return null
}

const canCreate = computed(() => {
  return itemName.value.trim() && !nameError.value
})

// Watch for modal open to focus input
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      nameInput.value?.focus()
    })
  } else {
    resetForm()
  }
})

// Watch for name changes to validate
watch(itemName, (newName) => {
  nameError.value = validateName(newName)
})

const handleCreate = () => {
  const validationError = validateName(itemName.value)
  if (validationError) {
    nameError.value = validationError
    return
  }
  
  emit('create', {
    name: itemName.value.trim(),
    type: itemType.value,
    content: itemType.value === 'file' ? fileContent.value : undefined
  })
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
  itemName.value = ''
  itemType.value = 'file'
  fileContent.value = ''
  nameError.value = ''
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

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
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
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}

.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace;
  resize: vertical;
  transition: all 0.15s ease;
}

.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}

.type-selector {
  display: flex;
  gap: 12px;
}

.type-option {
  flex: 1;
  cursor: pointer;
}

.type-option input[type="radio"] {
  position: absolute;
  opacity: 0;
}

.type-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  transition: all 0.15s ease;
}

.type-option input[type="radio"]:checked + .type-content {
  border-color: var(--primary);
  background: rgba(var(--primary-rgb), 0.1);
}

.type-option:hover .type-content {
  border-color: var(--primary-hover);
}

.type-content svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.type-option input[type="radio"]:checked + .type-content svg {
  color: var(--primary);
}

.type-content span {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.error-message {
  margin-top: 4px;
  font-size: 12px;
  color: var(--error);
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

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

@media (max-width: 640px) {
  .modal-content {
    width: 95%;
    max-width: none;
  }
  
  .modal-body {
    padding: 16px;
  }
  
  .type-selector {
    flex-direction: column;
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