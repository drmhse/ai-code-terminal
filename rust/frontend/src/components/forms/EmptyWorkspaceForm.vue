<template>
  <form @submit.prevent="handleSubmit" class="workspace-form" id="empty-workspace-form">
    <!-- Name Field -->
    <div class="form-field">
      <label for="workspace-name" class="field-label">Workspace Name</label>
      <input
        id="workspace-name"
        v-model="form.name"
        type="text"
        placeholder="Enter workspace name..."
        class="field-input"
        :class="{ error: errors.name }"
        :disabled="loading"
        required
      >
      <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
    </div>

    <!-- Description Field -->
    <div class="form-field">
      <label for="workspace-description" class="field-label">Description <span class="optional">(optional)</span></label>
      <textarea
        id="workspace-description"
        v-model="form.description"
        placeholder="Enter workspace description..."
        class="field-textarea"
        :class="{ error: errors.description }"
        :disabled="loading"
        rows="3"
      ></textarea>
      <p v-if="errors.description" class="field-error">{{ errors.description }}</p>
    </div>

    <!-- Location Field -->
    <div class="form-field">
      <label for="workspace-location" class="field-label">Location <span class="optional">(optional)</span></label>
      <input
        id="workspace-location"
        v-model="form.path"
        type="text"
        placeholder="Leave empty for default location..."
        class="field-input"
        :class="{ error: errors.path }"
        :disabled="loading"
      >
      <p v-if="errors.path" class="field-error">{{ errors.path }}</p>
      <p v-else class="field-hint">Leave empty to create workspace in the default location</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="form-loading">
      <LoadingSpinner size="medium" text="Creating workspace..." />
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

.optional {
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-normal);
}

.field-input,
.field-textarea {
  padding: var(--space-3);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-base);
  background: var(--color-input-background);
  color: var(--color-input-text);
  font-size: var(--font-size-sm);
  font-family: inherit;
  transition: all var(--transition-base);
}

.field-input::placeholder,
.field-textarea::placeholder {
  color: var(--color-input-placeholder);
}

.field-input:focus,
.field-textarea:focus {
  outline: none;
  border-color: var(--color-input-border-focus);
  background: var(--color-input-background-focus);
}

.field-input.error,
.field-textarea.error {
  border-color: var(--color-input-border-error);
}

.field-input:disabled,
.field-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: var(--line-height-normal);
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

/* Responsive */
@media (max-width: 768px) {
  .workspace-form {
    padding: var(--space-4);
    gap: var(--space-4);
  }
}
</style>
