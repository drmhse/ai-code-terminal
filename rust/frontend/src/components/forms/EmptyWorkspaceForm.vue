<template>
  <form @submit.prevent="handleSubmit" class="empty-workspace-form" id="empty-workspace-form">
    <div class="form-section">
      <label for="workspace-name" class="form-label">Workspace Name</label>
      <input
        id="workspace-name"
        v-model="form.name"
        type="text"
        placeholder="Enter workspace name..."
        class="form-input"
        :class="{ 'error': errors.name }"
        :disabled="loading"
        required
      >
      <p v-if="errors.name" class="form-error">
        {{ errors.name }}
      </p>
    </div>

    <div class="form-section">
      <label for="workspace-description" class="form-label">Description</label>
      <textarea
        id="workspace-description"
        v-model="form.description"
        placeholder="Enter workspace description (optional)..."
        class="form-textarea"
        :disabled="loading"
        rows="3"
      ></textarea>
      <p v-if="errors.description" class="form-error">
        {{ errors.description }}
      </p>
    </div>

    <div class="form-section">
      <label for="workspace-path" class="form-label">Location</label>
      <input
        id="workspace-path"
        v-model="form.path"
        type="text"
        placeholder="Leave empty for default location..."
        class="form-input"
        :class="{ 'error': errors.path }"
        :disabled="loading"
      >
      <p v-if="errors.path" class="form-error">
        {{ errors.path }}
      </p>
      <p v-else class="form-hint">
        Leave empty to create workspace in the default location
      </p>
    </div>

    <div v-if="loading" class="loading-state">
      <LoadingSpinner size="medium" text="Creating workspace..." />
    </div>

    <div v-if="error" class="error-message">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>{{ error }}</span>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

export interface EmptyWorkspaceFormData {
  name: string
  description: string
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
  submit: [data: EmptyWorkspaceFormData]
}>()

const form = reactive<EmptyWorkspaceFormData>({
  name: '',
  description: '',
  path: ''
})

const errors = ref<Partial<Record<keyof EmptyWorkspaceFormData, string>>>({})

const isValid = computed(() => {
  return form.name.trim().length > 0 && Object.keys(errors.value).length === 0
})

const validateForm = () => {
  errors.value = {}

  if (!form.name.trim()) {
    errors.value.name = 'Workspace name is required'
  } else if (form.name.trim().length < 2) {
    errors.value.name = 'Workspace name must be at least 2 characters'
  } else if (form.name.trim().length > 50) {
    errors.value.name = 'Workspace name must be less than 50 characters'
  }

  if (form.description.length > 200) {
    errors.value.description = 'Description must be less than 200 characters'
  }

  return isValid.value
}

const handleSubmit = () => {
  if (!validateForm() || props.loading) {
    return
  }

  emit('submit', {
    name: form.name.trim(),
    description: form.description.trim() || '',
    path: form.path.trim() || ''
  })
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.path = ''
  errors.value = {}
}

defineExpose({
  resetForm,
  isValid
})
</script>

<style scoped>
.empty-workspace-form {
  padding: var(--space-3xl, 32px);
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl, 24px);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm, 8px);
}

.form-label {
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.form-input,
.form-textarea {
  padding: var(--space-lg, 16px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg, 12px);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-base, 14px);
  outline: none;
  transition: all 0.2s ease;
  font-family: inherit;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--primary);
  box-shadow:
    0 0 0 3px rgba(var(--primary-rgb, 59, 130, 246), 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1);
  background: var(--bg-primary);
}

.form-input.error,
.form-textarea.error {
  border-color: var(--error);
  box-shadow: 0 0 0 3px rgba(var(--error-rgb, 239, 68, 68), 0.1);
}

.form-input:disabled,
.form-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-tertiary);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.5;
}

.form-hint {
  font-size: var(--font-size-sm, 12px);
  color: var(--text-muted);
  line-height: 1.4;
}

.form-error {
  font-size: var(--font-size-sm, 12px);
  color: var(--error);
  font-weight: var(--font-weight-medium, 500);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl, 24px);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-md, 12px);
  padding: var(--space-lg, 16px) var(--space-xl, 20px);
  background: var(--error);
  color: white;
  border-radius: var(--radius-lg, 12px);
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
}

/* Responsive Design */
@media (max-width: 480px) {
  .empty-workspace-form {
    padding: var(--space-2xl, 24px);
  }

  .form-input,
  .form-textarea {
    padding: var(--space-md, 12px);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .form-input,
  .form-textarea {
    border-width: 2px;
  }

  .form-input:focus,
  .form-textarea:focus {
    border-width: 2px;
  }

  .form-input.error,
  .form-textarea.error {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .form-input,
  .form-textarea {
    transition: none !important;
  }
}
</style>