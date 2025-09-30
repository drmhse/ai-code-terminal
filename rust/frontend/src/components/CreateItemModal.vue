<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click="handleOverlayClick">
        <Transition name="modal-scale">
          <div v-if="isOpen" class="modal-container" @click.stop>
            <!-- Header -->
            <div class="modal-header">
              <div class="modal-header-content">
                <div class="header-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"></path>
                  </svg>
                </div>
                <div class="header-text">
                  <h2 class="modal-title">Create New Item</h2>
                  <p class="modal-subtitle">Add a new file or folder to your workspace</p>
                </div>
              </div>
              <button @click="close" class="close-button" aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="modal-body">
              <div class="form-group">
                <label for="item-name" class="form-label">Name</label>
                <input
                  id="item-name"
                  ref="nameInput"
                  v-model="itemName"
                  type="text"
                  class="form-input"
                  placeholder="Enter item name"
                  @keyup.enter="handleCreate"
                  @keyup.esc="close"
                />
                <div v-if="nameError" class="error-message">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {{ nameError }}
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Type</label>
                <div class="type-selector">
                  <label class="type-option" :class="{ active: itemType === 'file' }">
                    <input
                      v-model="itemType"
                      type="radio"
                      value="file"
                      name="item-type"
                    />
                    <div class="type-content">
                      <div class="type-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      </div>
                      <div class="type-info">
                        <span class="type-name">File</span>
                        <span class="type-description">Create a new file</span>
                      </div>
                    </div>
                  </label>

                  <label class="type-option" :class="{ active: itemType === 'directory' }">
                    <input
                      v-model="itemType"
                      type="radio"
                      value="directory"
                      name="item-type"
                    />
                    <div class="type-content">
                      <div class="type-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </div>
                      <div class="type-info">
                        <span class="type-name">Folder</span>
                        <span class="type-description">Create a new folder</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <Transition name="slide-fade">
                <div v-if="itemType === 'file'" class="form-group">
                  <label for="file-content" class="form-label">
                    Initial Content
                    <span class="label-optional">(optional)</span>
                  </label>
                  <textarea
                    id="file-content"
                    v-model="fileContent"
                    class="form-textarea"
                    placeholder="Enter initial file content..."
                    rows="4"
                  ></textarea>
                </div>
              </Transition>
            </div>

            <!-- Footer -->
            <div class="modal-footer">
              <button @click="close" class="btn btn-secondary">Cancel</button>
              <button
                @click="handleCreate"
                class="btn btn-primary"
                :disabled="!canCreate"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
                Create {{ itemType === 'file' ? 'File' : 'Folder' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

interface Props {
  isOpen: boolean
  parentPath: string
}

interface Emits {
  (e: 'close'): void
  (e: 'create', data: { name: string; type: 'file' | 'directory'; content?: string | undefined }): void
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  parentPath: ''
})

const emit = defineEmits<Emits>()

const itemName = ref('')
const itemType = ref<'file' | 'directory'>('file')
const fileContent = ref('')
const nameError = ref<string | null>(null)
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
/* ===== MODAL OVERLAY ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

/* ===== MODAL CONTAINER ===== */
.modal-container {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 540px;
  max-height: calc(100vh - var(--space-8));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== MODAL HEADER ===== */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--color-border-secondary);
  flex-shrink: 0;
  gap: var(--space-4);
}

.modal-header-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.header-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-interactive-primary);
  color: white;
  border-radius: var(--radius-base);
}

.header-text {
  flex: 1;
  min-width: 0;
}

.modal-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.modal-subtitle {
  margin: var(--space-1) 0 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.close-button {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-base);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.close-button:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}

.close-button:active {
  transform: scale(0.95);
}

/* ===== MODAL BODY ===== */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  min-height: 0;
}

/* ===== FORM ELEMENTS ===== */
.form-group {
  margin-bottom: var(--space-5);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.label-optional {
  font-weight: var(--font-weight-normal);
  color: var(--color-text-tertiary);
  margin-left: var(--space-1);
}

.form-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-base);
  background: var(--color-input-background);
  color: var(--color-input-text);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-sans);
  transition: all var(--transition-base);
  outline: none;
}

.form-input:hover {
  border-color: var(--color-border-hover);
  background: var(--color-input-background-focus);
}

.form-input:focus {
  border-color: var(--color-input-border-focus);
  background: var(--color-input-background-focus);
  box-shadow: 0 0 0 2px rgba(56, 139, 255, 0.15);
}

.form-input::placeholder {
  color: var(--color-input-placeholder);
}

.form-textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-base);
  background: var(--color-input-background);
  color: var(--color-input-text);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-mono);
  line-height: var(--line-height-relaxed);
  resize: vertical;
  transition: all var(--transition-base);
  outline: none;
  min-height: 96px;
}

.form-textarea:hover {
  border-color: var(--color-border-hover);
  background: var(--color-input-background-focus);
}

.form-textarea:focus {
  border-color: var(--color-input-border-focus);
  background: var(--color-input-background-focus);
  box-shadow: 0 0 0 2px rgba(56, 139, 255, 0.15);
}

.form-textarea::placeholder {
  color: var(--color-input-placeholder);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-semantic-error);
  background: var(--color-semantic-error-bg);
  border: 1px solid var(--color-semantic-error-border);
  border-radius: var(--radius-base);
  line-height: var(--line-height-tight);
}

.error-message svg {
  flex-shrink: 0;
}

/* ===== TYPE SELECTOR (Atlassian-style radio cards) ===== */
.type-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.type-option {
  cursor: pointer;
}

.type-option input[type="radio"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.type-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  transition: all var(--transition-base);
  outline: 1px solid var(--color-border-primary);
  outline-offset: -1px;
}

.type-option:hover:not(.active) .type-content {
  outline-color: var(--color-border-hover);
  background: var(--color-bg-tertiary);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.type-option.active .type-content {
  border-color: var(--color-interactive-primary);
  background: rgba(56, 139, 255, 0.08);
  outline: none;
  box-shadow: none;
}

.type-option.active:hover .type-content {
  box-shadow: none;
  transform: none;
}

.type-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  transition: all var(--transition-base);
}

.type-option:hover .type-icon {
  transform: scale(1.05);
}

.type-option.active .type-icon {
  background: var(--color-interactive-primary);
  color: white;
  transform: scale(1.05);
}

.type-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.type-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.type-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  line-height: var(--line-height-tight);
}

/* ===== MODAL FOOTER ===== */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--color-border-secondary);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}

/* ===== BUTTONS (Atlassian style) ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-sans);
  cursor: pointer;
  transition: all var(--transition-base);
  min-height: 40px;
  min-width: 80px;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: var(--color-interactive-tertiary);
  border-color: var(--color-border-primary);
  color: var(--color-text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-interactive-tertiary-hover);
  border-color: var(--color-border-hover);
}

.btn-primary {
  background: var(--color-interactive-primary);
  border-color: var(--color-interactive-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
  border-color: var(--color-interactive-primary-hover);
}

.btn-primary svg {
  flex-shrink: 0;
}

/* ===== ANIMATIONS ===== */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--transition-smooth);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: all var(--transition-smooth);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all var(--transition-smooth);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* ===== RESPONSIVE ===== */
@media (max-width: 640px) {
  .modal-overlay {
    padding: var(--space-2);
  }

  .modal-container {
    max-height: calc(100vh - var(--space-4));
  }

  .modal-header {
    padding: var(--space-4);
  }

  .modal-body {
    padding: var(--space-4);
  }

  .modal-footer {
    padding: var(--space-4);
    flex-direction: column-reverse;
  }

  .modal-footer .btn {
    width: 100%;
  }

  .type-selector {
    grid-template-columns: 1fr;
  }

  .type-content {
    padding: var(--space-3);
  }

  .type-icon {
    width: 36px;
    height: 36px;
  }
}

/* ===== ACCESSIBILITY ===== */
.close-button:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

.btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

.type-option:focus-visible .type-content {
  box-shadow: 0 0 0 2px var(--color-border-focus);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-scale-enter-active,
  .modal-scale-leave-active,
  .slide-fade-enter-active,
  .slide-fade-leave-active,
  .close-button,
  .btn,
  .type-content {
    transition: none !important;
  }
}
</style>