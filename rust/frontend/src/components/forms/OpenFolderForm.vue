<template>
  <form @submit.prevent="handleSubmit" class="workspace-form" id="open-folder-form">
    <!-- Name Field -->
    <div class="form-field">
      <label for="folder-name" class="field-label">Workspace Name</label>
      <input
        id="folder-name"
        v-model="form.name"
        type="text"
        placeholder="Enter workspace name..."
        class="field-input"
        :class="{ error: errors.name }"
        :disabled="loading"
        required
      >
      <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
      <p v-else class="field-hint">A friendly name for this workspace</p>
    </div>

    <!-- Path Field -->
    <div class="form-field">
      <label for="folder-path" class="field-label">Folder Path</label>
      <div class="path-input-wrapper">
        <input
          id="folder-path"
          v-model="form.path"
          type="text"
          placeholder="/Users/username/projects/my-project"
          class="field-input"
          :class="{ error: errors.path }"
          :disabled="loading"
          required
          spellcheck="false"
        >
        <button
          type="button"
          class="browse-button"
          @click="browseFolders"
          :disabled="loading"
          title="Browse folders"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          Browse
        </button>
      </div>
      <p v-if="errors.path" class="field-error">{{ errors.path }}</p>
      <p v-else class="field-hint">
        Click Browse to select a folder, or enter the path manually
      </p>
    </div>

    <!-- Folder Picker Modal -->
    <div v-if="showFolderPicker" class="folder-picker-overlay" @click="handleFolderPickerCancel">
      <div class="folder-picker-modal" @click.stop>
        <FolderPicker
          :initialPath="form.path || undefined"
          @select="handleFolderSelect"
          @cancel="handleFolderPickerCancel"
        />
      </div>
    </div>

    <!-- Info Box -->
    <div class="info-box">
      <div class="info-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>Workspace Security</span>
      </div>
      <p class="info-text">
        All processes and terminal sessions will be restricted to this folder and its subdirectories for security.
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="form-loading">
      <LoadingSpinner size="medium" text="Opening folder..." />
    </div>

    <!-- Error Display -->
    <div v-if="error" class="form-error-banner">
      <ExclamationCircleIcon />
      <span>{{ error }}</span>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ExclamationCircleIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import FolderPicker from '@/components/ui/FolderPicker.vue'

export interface OpenFolderFormData {
  name: string
  path: string
}

interface Props {
  loading?: boolean
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null
})

const emit = defineEmits<{
  submit: [data: OpenFolderFormData]
}>()

const form = reactive<OpenFolderFormData>({
  name: '',
  path: ''
})

const errors = ref<Partial<Record<keyof OpenFolderFormData, string>>>({})
const showFolderPicker = ref(false)

const isValid = computed(() => {
  return form.name.trim().length > 0 && form.path.trim().length > 0 && Object.keys(errors.value).length === 0
})

const browseFolders = () => {
  showFolderPicker.value = true
}

const handleFolderSelect = (path: string) => {
  form.path = path
  showFolderPicker.value = false
}

const handleFolderPickerCancel = () => {
  showFolderPicker.value = false
}

const validateForm = () => {
  errors.value = {}

  if (!form.name.trim()) {
    errors.value.name = 'Workspace name is required'
  } else if (form.name.trim().length < 2) {
    errors.value.name = 'Workspace name must be at least 2 characters'
  } else if (form.name.trim().length > 50) {
    errors.value.name = 'Workspace name must be less than 50 characters'
  }

  if (!form.path.trim()) {
    errors.value.path = 'Folder path is required'
  } else if (!form.path.trim().startsWith('/') && !form.path.trim().match(/^[A-Za-z]:\\/)) {
    errors.value.path = 'Path must be an absolute path (starting with / or drive letter)'
  }

  return isValid.value
}

const handleSubmit = () => {
  if (!validateForm() || props.loading) {
    return
  }

  emit('submit', {
    name: form.name.trim(),
    path: form.path.trim()
  })
}

const resetForm = () => {
  form.name = ''
  form.path = ''
  errors.value = {}
}

defineExpose({
  resetForm,
  isValid
})
</script>

<style scoped>
.workspace-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* Form Fields */
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.path-input-wrapper {
  display: flex;
  gap: var(--space-2);
  align-items: stretch;
}

.path-input-wrapper .field-input {
  flex: 1;
}

.browse-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-base);
  background: var(--color-input-background);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}

.browse-button:hover:not(:disabled) {
  background: var(--color-input-background-focus);
  border-color: var(--color-input-border-focus);
  color: var(--color-text-primary);
}

.browse-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.browse-button svg {
  flex-shrink: 0;
}

.field-input {
  padding: var(--space-3);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-base);
  background: var(--color-input-background);
  color: var(--color-input-text);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-mono);
  transition: all var(--transition-base);
}

.field-input::placeholder {
  color: var(--color-input-placeholder);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-input-border-focus);
  background: var(--color-input-background-focus);
}

.field-input.error {
  border-color: var(--color-input-border-error);
}

.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: 0;
}

.field-error {
  font-size: var(--font-size-xs);
  color: var(--color-semantic-error);
  font-weight: var(--font-weight-medium);
  margin: 0;
}

/* Info Box */
.info-box {
  padding: var(--space-4);
  background: var(--color-semantic-info-bg);
  border: 1px solid var(--color-semantic-info-border);
  border-radius: var(--radius-base);
}

.info-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-semantic-info);
  margin-bottom: var(--space-2);
}

.info-header svg {
  flex-shrink: 0;
}

.info-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-relaxed);
}

/* Loading */
.form-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

/* Error Banner */
.form-error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-semantic-error-bg);
  border: 1px solid var(--color-semantic-error-border);
  border-radius: var(--radius-base);
  color: var(--color-semantic-error);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.form-error-banner svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Folder Picker Modal */
.folder-picker-overlay {
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
}

.folder-picker-modal {
  width: 90%;
  max-width: 600px;
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-base);
  border: 1px solid var(--color-border-primary);
}

/* Responsive */
@media (max-width: 768px) {
  .workspace-form {
    padding: var(--space-4);
    gap: var(--space-4);
  }

  .folder-picker-modal {
    width: 95%;
    padding: var(--space-2);
  }
}
</style>
