<template>
  <div
    class="task-item"
    :class="{
      selected,
      completed: task.status === 'completed',
      'high-priority': task.importance === 'high'
    }"
    @click="$emit('click')"
  >
    <!-- Checkbox -->
    <button
      @click.stop="toggleComplete"
      class="task-checkbox"
      :class="{ checked: task.status === 'completed' }"
      title="Mark as complete"
    >
      <CheckIcon v-if="task.status === 'completed'" />
    </button>

    <!-- Content -->
    <div class="task-content">
      <!-- Title -->
      <div v-if="!editingTitle" class="task-title" @dblclick="startEditingTitle">
        <span :class="{ 'line-through': task.status === 'completed' }">
          {{ task.title }}
        </span>
        <ExclamationTriangleIcon
          v-if="task.importance === 'high'"
          class="priority-icon"
          title="High priority"
        />
      </div>
      <input
        v-else
        ref="titleInputRef"
        v-model="editedTitle"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        @keyup.escape="cancelEditTitle"
        class="task-title-input"
      />

      <!-- Meta info -->
      <div class="task-meta">
        <!-- Status -->
        <span class="meta-item status-badge" :class="`status-${task.status}`">
          {{ getStatusLabel(task.status) }}
        </span>

        <!-- Due date -->
        <span v-if="task.due_date_time" class="meta-item due-date" :class="dueDateClass">
          <ClockIcon />
          {{ formatDueDate(task.due_date_time) }}
        </span>

        <!-- Has description -->
        <span v-if="task.body?.content" class="meta-item" title="Has description">
          <DocumentTextIcon />
        </span>

        <!-- Code context -->
        <span v-if="hasCodeContext" class="meta-item" title="Linked to code">
          <CodeBracketIcon />
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="task-actions">
      <button
        @click.stop="$emit('delete')"
        class="action-btn delete-btn"
        title="Delete task"
      >
        <TrashIcon />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import type { TodoTask, CreateTaskRequest } from '@/services/microsoft-auth'
import {
  CheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'

interface Props {
  task: TodoTask
  selected: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
  update: [updates: Partial<CreateTaskRequest>]
  delete: []
}>()

// Local state
const editingTitle = ref(false)
const editedTitle = ref(props.task.title)
const titleInputRef = ref<HTMLInputElement>()

// Computed
const hasCodeContext = computed(() => {
  return props.task.body?.content?.includes('<!-- DEV-CONTEXT') || false
})

const dueDateClass = computed(() => {
  if (!props.task.due_date_time) return ''

  const now = new Date()
  const due = new Date(props.task.due_date_time)
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'due-today'
  if (diffDays <= 3) return 'due-soon'
  return ''
})

// Methods
const toggleComplete = () => {
  const newStatus = props.task.status === 'completed' ? 'notStarted' : 'completed'
  emit('update', {
    title: props.task.title,
    body_content: props.task.body?.content,
    status: newStatus
  })
}

const startEditingTitle = () => {
  editingTitle.value = true
  editedTitle.value = props.task.title
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

const saveTitle = () => {
  if (editedTitle.value.trim() && editedTitle.value !== props.task.title) {
    emit('update', { title: editedTitle.value.trim() })
  }
  editingTitle.value = false
}

const cancelEditTitle = () => {
  editedTitle.value = props.task.title
  editingTitle.value = false
}

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    notStarted: 'Not Started',
    inProgress: 'In Progress',
    completed: 'Completed',
    waitingOnOthers: 'Waiting',
    deferred: 'Deferred'
  }
  return statusMap[status] || status
}

const formatDueDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays)
    return `${absDays === 1 ? 'Yesterday' : `${absDays} days ago`}`
  }
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 7) return `In ${diffDays} days`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Watch for task changes
watch(() => props.task.title, (newTitle) => {
  if (!editingTitle.value) {
    editedTitle.value = newTitle
  }
})
</script>

<style scoped>
.task-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-6);
  background: var(--color-bg-primary);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: all var(--transition-base);
  position: relative;
}

.task-item:hover {
  background: var(--color-bg-secondary);
}

.task-item.selected {
  background: rgba(56, 139, 255, 0.08);
  border-left-color: var(--color-interactive-primary);
}

.task-item.high-priority {
  border-left-color: var(--color-semantic-error);
}

.task-item.completed {
  opacity: 0.6;
}

/* Checkbox */
.task-checkbox {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border-primary);
  border-radius: 50%;
  background: none;
  cursor: pointer;
  transition: all var(--transition-base);
}

.task-checkbox:hover {
  border-color: var(--color-interactive-primary);
  background: rgba(56, 139, 255, 0.05);
}

.task-checkbox.checked {
  background: var(--color-semantic-success);
  border-color: var(--color-semantic-success);
}

.task-checkbox svg {
  width: 14px;
  height: 14px;
  color: white;
}

/* Content */
.task-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
  word-break: break-word;
}

.line-through {
  text-decoration: line-through;
  color: var(--color-text-tertiary);
}

.priority-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--color-semantic-error);
}

.task-title-input {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  background: var(--color-input-background);
  border: 1px solid var(--color-border-focus);
  border-radius: var(--radius-sm);
  outline: none;
}

/* Meta */
.task-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.meta-item svg {
  width: 14px;
  height: 14px;
}

.status-badge {
  padding: 2px var(--space-2);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
}

.status-badge.status-notStarted {
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
}

.status-badge.status-inProgress {
  color: var(--color-semantic-warning);
  background: var(--color-semantic-warning-bg);
}

.status-badge.status-completed {
  color: var(--color-semantic-success);
  background: var(--color-semantic-success-bg);
}

.status-badge.status-waitingOnOthers {
  color: var(--color-semantic-info);
  background: var(--color-semantic-info-bg);
}

.status-badge.status-deferred {
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
}

.due-date.overdue {
  color: var(--color-semantic-error);
}

.due-date.due-today {
  color: var(--color-semantic-warning);
}

.due-date.due-soon {
  color: var(--color-interactive-primary);
}

/* Actions */
.task-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.task-item:hover .task-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.delete-btn:hover {
  background: var(--color-semantic-error-bg);
  color: var(--color-semantic-error);
}
</style>