<template>
  <div class="task-quick-create">
    <div v-if="!isCreating" class="quick-trigger" @click="startCreating">
      <PlusIcon />
      <span>Add task</span>
    </div>

    <div v-else class="quick-form">
      <input
        ref="titleInputRef"
        v-model="title"
        type="text"
        placeholder="Task title..."
        class="quick-input"
        @keyup.enter="handleCreate"
        @keyup.escape="cancelCreating"
      />
      <div class="quick-actions">
        <button
          @click="handleCreate"
          :disabled="!title.trim()"
          class="btn-primary btn-sm"
        >
          Add
        </button>
        <button @click="cancelCreating" class="btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import type { CreateTaskRequest } from '@/services/microsoft-auth'

const emit = defineEmits<{
  create: [request: CreateTaskRequest]
}>()

const isCreating = ref(false)
const title = ref('')
const titleInputRef = ref<HTMLInputElement>()

const startCreating = async () => {
  isCreating.value = true
  await nextTick()
  titleInputRef.value?.focus()
}

const cancelCreating = () => {
  isCreating.value = false
  title.value = ''
}

const handleCreate = () => {
  if (!title.value.trim()) return

  emit('create', {
    title: title.value.trim(),
    importance: 'normal'
  })

  title.value = ''
  titleInputRef.value?.focus()
}
</script>

<style scoped>
.task-quick-create {
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--color-border-primary);
}

.quick-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 2px dashed var(--color-border-primary);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.quick-trigger svg {
  width: 18px;
  height: 18px;
}

.quick-trigger:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
}

.quick-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.quick-input {
  width: 100%;
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: var(--color-input-background);
  border: 2px solid var(--color-border-focus);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.quick-input:focus {
  outline: none;
  background: var(--color-input-background-focus);
  box-shadow: 0 0 0 3px rgba(56, 139, 255, 0.1);
}

.quick-input::placeholder {
  color: var(--color-text-tertiary);
}

.quick-actions {
  display: flex;
  gap: var(--space-2);
}

.btn-primary,
.btn-secondary {
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
}

.btn-primary {
  color: white;
  background: var(--color-interactive-primary);
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  color: var(--color-text-secondary);
  background: var(--color-interactive-tertiary);
  border: 1px solid var(--color-border-primary);
}

.btn-secondary:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}
</style>