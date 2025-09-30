<template>
  <div class="task-detail-panel">
    <!-- Header -->
    <div class="panel-header">
      <button @click="$emit('close')" class="btn-icon" title="Close">
        <XMarkIcon />
      </button>
      <div class="header-actions">
        <button @click="$emit('delete')" class="btn-icon delete-btn" title="Delete task">
          <TrashIcon />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="panel-content">
      <!-- Title -->
      <div class="section">
        <div class="title-section">
          <button
            @click="toggleComplete"
            class="task-checkbox"
            :class="{ checked: task.status === 'completed' }"
          >
            <CheckIcon v-if="task.status === 'completed'" />
          </button>
          <div class="title-wrapper">
            <textarea
              ref="titleTextareaRef"
              v-model="localTask.title"
              @blur="handleTitleBlur"
              class="title-textarea"
              placeholder="Task title..."
              rows="1"
              @input="autoResizeTextarea"
            />
          </div>
        </div>
      </div>

      <!-- Priority -->
      <div class="section">
        <label class="section-label">Priority</label>
        <div class="priority-selector">
          <button
            v-for="priority in priorities"
            :key="priority.value"
            @click="updatePriority(priority.value as 'high' | 'normal' | 'low')"
            class="priority-option"
            :class="{
              active: localTask.importance === priority.value,
              [priority.value]: true
            }"
          >
            <component :is="priority.icon" />
            <span>{{ priority.label }}</span>
          </button>
        </div>
      </div>

      <!-- Status -->
      <div class="section">
        <label class="section-label">Status</label>
        <select v-model="localTask.status" @change="handleStatusChange" class="status-select">
          <option value="notStarted">Not Started</option>
          <option value="inProgress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="waitingOnOthers">Waiting on Others</option>
          <option value="deferred">Deferred</option>
        </select>
      </div>

      <!-- Due Date -->
      <div class="section">
        <label class="section-label">
          <ClockIcon />
          <span>Due Date</span>
        </label>
        <div class="due-date-wrapper">
          <input
            v-model="localDueDate"
            type="date"
            class="date-input"
            @change="handleDueDateChange"
          />
          <button
            v-if="localDueDate"
            @click="clearDueDate"
            class="btn-icon btn-xs"
            title="Clear due date"
          >
            <XMarkIcon />
          </button>
        </div>
      </div>

      <!-- Description -->
      <div class="section">
        <label class="section-label">
          <DocumentTextIcon />
          <span>Description</span>
        </label>
        <textarea
          ref="descriptionTextareaRef"
          v-model="localTask.body_content"
          @blur="handleDescriptionBlur"
          class="description-textarea"
          placeholder="Add description..."
          rows="4"
        />
      </div>

      <!-- Code Context -->
      <div v-if="hasCodeContext" class="section">
        <label class="section-label">
          <CodeBracketIcon />
          <span>Code Context</span>
        </label>
        <div class="code-context-card">
          <div class="code-info">
            <div class="code-file">
              <DocumentIcon />
              <span>{{ codeContext.file }}</span>
            </div>
            <div v-if="codeContext.lines" class="code-lines">
              Lines {{ formatLineRange(codeContext.lines) }}
            </div>
            <div v-if="codeContext.branch" class="code-meta">
              <span class="meta-badge">{{ codeContext.branch }}</span>
            </div>
          </div>
          <button v-if="codeContext.file" @click="jumpToCode" class="btn-link">
            <ArrowTopRightOnSquareIcon />
            <span>Open in Editor</span>
          </button>
        </div>
      </div>

      <!-- Timestamps -->
      <div class="section timestamps">
        <div v-if="task.created_date_time" class="timestamp-row">
          <span class="timestamp-label">Created</span>
          <span class="timestamp-value">{{ formatTimestamp(task.created_date_time) }}</span>
        </div>
        <div v-if="task.completed_date_time" class="timestamp-row">
          <span class="timestamp-label">Completed</span>
          <span class="timestamp-value">{{ formatTimestamp(task.completed_date_time) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { TodoTask, CreateTaskRequest } from '@/services/microsoft-auth'
import {
  XMarkIcon,
  TrashIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  DocumentIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  MinusIcon
} from '@heroicons/vue/24/outline'

interface Props {
  task: TodoTask
  listId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  update: [updates: Partial<CreateTaskRequest>]
  delete: []
}>()

// Local state
const localTask = ref({
  title: props.task.title,
  body_content: props.task.body?.content || '',
  importance: props.task.importance,
  status: props.task.status
})

const localDueDate = ref('')
const titleTextareaRef = ref<HTMLTextAreaElement>()
const descriptionTextareaRef = ref<HTMLTextAreaElement>()

// Priority options
const priorities = [
  { label: 'High', value: 'high', icon: ExclamationTriangleIcon },
  { label: 'Normal', value: 'normal', icon: FlagIcon },
  { label: 'Low', value: 'low', icon: MinusIcon }
]

// Computed
const hasCodeContext = computed(() => {
  return localTask.value.body_content?.includes('<!-- DEV-CONTEXT') || false
})

const codeContext = computed(() => {
  if (!hasCodeContext.value) return null

  try {
    const match = localTask.value.body_content?.match(/<!--\s*DEV-CONTEXT\s*\n([\s\S]*?)\n\s*-->/)
    if (!match) return null

    const contextData = JSON.parse(match[1].trim())
    return {
      file: contextData.file_path || contextData.file || '',
      lines: contextData.line_start && contextData.line_end
        ? [contextData.line_start, contextData.line_end]
        : null,
      branch: contextData.branch,
      commit: contextData.commit,
      language: contextData.language
    }
  } catch (error) {
    console.error('Failed to parse code context:', error)
    return null
  }
})

// Methods
const autoResizeTextarea = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

const toggleComplete = () => {
  localTask.value.status = localTask.value.status === 'completed' ? 'notStarted' : 'completed'
  emitUpdate()
}

const updatePriority = (priority: 'high' | 'normal' | 'low') => {
  localTask.value.importance = priority
  emitUpdate()
}

const handleStatusChange = () => {
  emitUpdate()
}

const handleTitleBlur = () => {
  if (localTask.value.title.trim() !== props.task.title) {
    emitUpdate()
  }
}

const handleDescriptionBlur = () => {
  const currentContent = props.task.body?.content || ''
  if (localTask.value.body_content !== currentContent) {
    emitUpdate()
  }
}

const handleDueDateChange = () => {
  emitUpdate()
}

const clearDueDate = () => {
  localDueDate.value = ''
  emitUpdate()
}

const emitUpdate = () => {
  emit('update', {
    title: localTask.value.title,
    body_content: localTask.value.body_content,
    importance: localTask.value.importance,
    status: localTask.value.status
  })
}

const jumpToCode = () => {
  // TODO: Implement jump to code
  console.log('Jump to code:', codeContext.value)
}

const formatLineRange = (lines: number[] | [number, number]): string => {
  if (!Array.isArray(lines) || lines.length < 2) return ''
  const [start, end] = lines
  return start === end ? `${start}` : `${start}-${end}`
}

const formatTimestamp = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    // Show time if today
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }
}

// Initialize due date
onMounted(() => {
  if (props.task.due_date_time) {
    const date = new Date(props.task.due_date_time)
    localDueDate.value = date.toISOString().split('T')[0]
  }

  // Auto-resize textareas
  nextTick(() => {
    if (titleTextareaRef.value) {
      titleTextareaRef.value.style.height = 'auto'
      titleTextareaRef.value.style.height = `${titleTextareaRef.value.scrollHeight}px`
    }
  })
})

// Watch for task changes
watch(() => props.task, (newTask) => {
  localTask.value = {
    title: newTask.title,
    body_content: newTask.body?.content || '',
    importance: newTask.importance,
    status: newTask.status
  }

  if (newTask.due_date_time) {
    const date = new Date(newTask.due_date_time)
    localDueDate.value = date.toISOString().split('T')[0]
  } else {
    localDueDate.value = ''
  }
}, { deep: true })
</script>

<style scoped>
.task-detail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
  border-left: 1px solid var(--color-border-primary);
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-primary);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-icon svg {
  width: 20px;
  height: 20px;
}

.btn-icon:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.btn-icon.delete-btn:hover {
  background: var(--color-semantic-error-bg);
  color: var(--color-semantic-error);
}

.btn-xs {
  width: 24px;
  height: 24px;
}

.btn-xs svg {
  width: 16px;
  height: 16px;
}

/* Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.section-label svg {
  width: 18px;
  height: 18px;
}

/* Title */
.title-section {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.task-checkbox {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-top: 4px;
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
  width: 18px;
  height: 18px;
  color: white;
}

.title-wrapper {
  flex: 1;
  min-width: 0;
}

.title-textarea {
  width: 100%;
  padding: var(--space-2) 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  background: none;
  border: none;
  resize: none;
  overflow: hidden;
  line-height: var(--line-height-tight);
}

.title-textarea:focus {
  outline: none;
}

.title-textarea::placeholder {
  color: var(--color-text-tertiary);
}

/* Priority */
.priority-selector {
  display: flex;
  gap: var(--space-2);
}

.priority-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.priority-option svg {
  width: 18px;
  height: 18px;
}

.priority-option:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
}

.priority-option.active {
  background: rgba(56, 139, 255, 0.08);
  border-color: var(--color-interactive-primary);
  color: var(--color-interactive-primary);
}

.priority-option.high.active {
  background: var(--color-semantic-error-bg);
  border-color: var(--color-semantic-error);
  color: var(--color-semantic-error);
}

.priority-option.low.active {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
  color: var(--color-text-tertiary);
}

/* Status */
.status-select {
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: var(--color-input-background);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.status-select:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(56, 139, 255, 0.1);
}

/* Due Date */
.due-date-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.date-input {
  flex: 1;
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: var(--color-input-background);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.date-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(56, 139, 255, 0.1);
}

/* Description */
.description-textarea {
  width: 100%;
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: var(--color-input-background);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  resize: vertical;
  min-height: 100px;
  line-height: var(--line-height-normal);
}

.description-textarea:focus {
  outline: none;
  border-color: var(--color-border-focus);
  background: var(--color-input-background-focus);
  box-shadow: 0 0 0 3px rgba(56, 139, 255, 0.1);
}

.description-textarea::placeholder {
  color: var(--color-text-tertiary);
}

/* Code Context */
.code-context-card {
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.code-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.code-file {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-mono);
  color: var(--color-text-primary);
}

.code-file svg {
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
}

.code-lines {
  font-size: var(--font-size-xs);
  font-family: var(--font-family-mono);
  color: var(--color-text-secondary);
}

.code-meta {
  display: flex;
  gap: var(--space-2);
}

.meta-badge {
  display: inline-flex;
  padding: 2px var(--space-2);
  font-size: var(--font-size-xs);
  font-family: var(--font-family-mono);
  color: var(--color-semantic-info);
  background: var(--color-semantic-info-bg);
  border-radius: var(--radius-sm);
}

.btn-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-interactive-primary);
  background: none;
  border: 1px solid var(--color-interactive-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
  align-self: flex-start;
}

.btn-link svg {
  width: 16px;
  height: 16px;
}

.btn-link:hover {
  background: rgba(56, 139, 255, 0.08);
}

/* Timestamps */
.timestamps {
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border-primary);
}

.timestamp-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
}

.timestamp-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.timestamp-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>