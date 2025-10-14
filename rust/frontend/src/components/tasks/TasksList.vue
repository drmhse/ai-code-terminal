<template>
  <div class="tasks-list">
    <!-- Header -->
    <div class="list-header">
      <div class="header-top">
        <h1 class="list-title">{{ listName }}</h1>
        <div class="header-actions">
          <button @click="showFilters = !showFilters" class="btn-icon" title="Filter">
            <FunnelIcon />
          </button>
          <button @click="showViewOptions = !showViewOptions" class="btn-icon" title="View options">
            <AdjustmentsHorizontalIcon />
          </button>
        </div>
      </div>

      <!-- Quick add -->
      <TaskQuickCreate @create="handleQuickCreate" />

      <!-- Filters bar -->
      <Transition name="slide-down">
        <div v-if="showFilters" class="filters-bar">
          <div class="filter-group">
            <label class="filter-label">Status</label>
            <div class="filter-chips">
              <button
                v-for="status in availableStatuses"
                :key="status.value"
                @click="toggleStatusFilter(status.value)"
                class="filter-chip"
                :class="{ active: filters.status.includes(status.value) }"
              >
                {{ status.label }}
              </button>
            </div>
          </div>
          <div class="filter-group">
            <label class="filter-label">Priority</label>
            <div class="filter-chips">
              <button
                v-for="priority in availablePriorities"
                :key="priority.value"
                @click="togglePriorityFilter(priority.value)"
                class="filter-chip"
                :class="{ active: filters.priority.includes(priority.value) }"
              >
                {{ priority.label }}
              </button>
            </div>
          </div>
          <button v-if="hasActiveFilters" @click="clearFilters" class="btn-text">
            Clear all filters
          </button>
        </div>
      </Transition>

      <!-- View options -->
      <Teleport to="body">
        <div
          v-if="showViewOptions"
          ref="viewOptionsRef"
          class="view-options-dropdown"
          :style="viewOptionsStyle"
        >
          <div class="dropdown-section">
            <label class="dropdown-label">Group by</label>
            <button
              v-for="option in groupByOptions"
              :key="option.value"
              @click="handleGroupByChange(option.value as 'none' | 'status' | 'priority' | 'dueDate')"
              class="dropdown-item"
              :class="{ active: groupBy === option.value }"
            >
              <CheckIcon v-if="groupBy === option.value" class="check-icon" />
              <span>{{ option.label }}</span>
            </button>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-section">
            <label class="dropdown-label">Sort by</label>
            <button
              v-for="option in sortByOptions"
              :key="option.value"
              @click="handleSortByChange(option.value as 'default' | 'title' | 'created' | 'updated' | 'dueDate')"
              class="dropdown-item"
              :class="{ active: sortBy === option.value }"
            >
              <CheckIcon v-if="sortBy === option.value" class="check-icon" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>
      </Teleport>
    </div>

    <!-- Tasks content -->
    <div class="list-content">
      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p class="loading-text">Loading tasks...</p>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredTasks.length === 0" class="empty-state">
        <div class="empty-icon">
          <CheckCircleIcon />
        </div>
        <h3 class="empty-title">
          {{ hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet' }}
        </h3>
        <p class="empty-text">
          {{ hasActiveFilters ? 'Try adjusting your filters' : 'Create your first task to get started' }}
        </p>
      </div>

      <!-- Grouped tasks -->
      <div v-else class="tasks-groups">
        <div v-for="group in groupedTasks" :key="group.key" class="task-group">
          <div class="group-header">
            <div class="group-title-wrapper">
              <component :is="group.icon" v-if="group.icon" class="group-icon" />
              <h2 class="group-title">{{ group.title }}</h2>
              <span class="group-count">{{ group.tasks.length }}</span>
            </div>
            <button
              @click="toggleGroupCollapse(group.key)"
              class="btn-icon btn-xs"
            >
              <ChevronDownIcon :class="{ 'rotate-180': collapsedGroups.has(group.key) }" />
            </button>
          </div>

          <Transition name="collapse">
            <div v-if="!collapsedGroups.has(group.key)" class="group-tasks">
              <TaskItem
                v-for="task in group.tasks"
                :key="task.id"
                :task="task"
                :selected="task.id === selectedTaskId"
                @click="$emit('task-click', task.id)"
                @update="handleTaskUpdate(task.id, $event)"
                @delete="$emit('task-delete', task.id)"
              />
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { TodoTask, CreateTaskRequest } from '@/services/microsoft-auth'
import TaskItem from './TaskItem.vue'
import TaskQuickCreate from './TaskQuickCreate.vue'
import {
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  CheckIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  FlagIcon
} from '@heroicons/vue/24/outline'

interface Props {
  tasks: TodoTask[]
  listName: string
  loading: boolean
  selectedTaskId: string | null
  groupBy: 'none' | 'status' | 'priority' | 'dueDate'
  sortBy: 'default' | 'title' | 'created' | 'updated' | 'dueDate'
  filters: {
    status: string[]
    priority: string[]
    search: string
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'task-click': [taskId: string]
  'task-update': [taskId: string, updates: Partial<CreateTaskRequest>]
  'task-delete': [taskId: string]
  'task-create': [request: CreateTaskRequest]
  'update-grouping': [groupBy: Props['groupBy']]
  'update-sorting': [sortBy: Props['sortBy']]
  'update-filters': [filters: Props['filters']]
}>()

// Local state
const showFilters = ref(false)
const showViewOptions = ref(false)
const viewOptionsRef = ref<HTMLDivElement>()
const viewOptionsStyle = ref({})
const collapsedGroups = ref(new Set<string>())

// Filter options
const availableStatuses = [
  { label: 'Not Started', value: 'notStarted' },
  { label: 'In Progress', value: 'inProgress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Waiting', value: 'waitingOnOthers' },
  { label: 'Deferred', value: 'deferred' }
]

const availablePriorities = [
  { label: 'High', value: 'high' },
  { label: 'Normal', value: 'normal' },
  { label: 'Low', value: 'low' }
]

const groupByOptions = [
  { label: 'None', value: 'none' },
  { label: 'Status', value: 'status' },
  { label: 'Priority', value: 'priority' },
  { label: 'Due Date', value: 'dueDate' }
]

const sortByOptions = [
  { label: 'Default', value: 'default' },
  { label: 'Title', value: 'title' },
  { label: 'Created', value: 'created' },
  { label: 'Updated', value: 'updated' },
  { label: 'Due Date', value: 'dueDate' }
]

// Computed
const hasActiveFilters = computed(() => {
  return props.filters.status.length > 0 ||
    props.filters.priority.length > 0 ||
    props.filters.search.length > 0
})

const filteredTasks = computed(() => {
  let result = [...props.tasks]

  // Apply status filter
  if (props.filters.status.length > 0) {
    result = result.filter(task => props.filters.status.includes(task.status))
  }

  // Apply priority filter
  if (props.filters.priority.length > 0) {
    result = result.filter(task => props.filters.priority.includes(task.importance))
  }

  // Apply search filter
  if (props.filters.search.trim()) {
    const query = props.filters.search.toLowerCase()
    result = result.filter(task =>
      task.title.toLowerCase().includes(query) ||
      task.body?.content?.toLowerCase().includes(query)
    )
  }

  // Apply sorting
  result = sortTasks(result, props.sortBy)

  return result
})

const groupedTasks = computed(() => {
  if (props.groupBy === 'none') {
    return [{
      key: 'all',
      title: 'All Tasks',
      tasks: filteredTasks.value,
      icon: null
    }]
  }

  const groups = new Map<string, TodoTask[]>()

  filteredTasks.value.forEach(task => {
    let groupKey: string

    switch (props.groupBy) {
      case 'status':
        groupKey = task.status
        break
      case 'priority':
        groupKey = task.importance
        break
      case 'dueDate':
        groupKey = getDueDateGroup(task.due_date_time)
        break
      default:
        groupKey = 'all'
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(task)
  })

  return Array.from(groups.entries()).map(([key, tasks]) => ({
    key,
    title: key === 'all' ? 'All Tasks' : key,
    tasks: sortTasks(tasks, props.sortBy),
    icon: getGroupIcon(key, props.groupBy)
  }))
})

// Methods
const sortTasks = (tasks: TodoTask[], sortBy: Props['sortBy']): TodoTask[] => {
  const sorted = [...tasks]

  switch (sortBy) {
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'created':
      return sorted.sort((a, b) => {
        const aTime = a.created_date_time ? new Date(a.created_date_time).getTime() : 0
        const bTime = b.created_date_time ? new Date(b.created_date_time).getTime() : 0
        return bTime - aTime
      })
    case 'updated':
      return sorted.sort((a, b) => {
        const aTime = a.created_date_time ? new Date(a.created_date_time).getTime() : 0
        const bTime = b.created_date_time ? new Date(b.created_date_time).getTime() : 0
        return bTime - aTime
      })
    case 'dueDate':
      return sorted.sort((a, b) => {
        if (!a.due_date_time && !b.due_date_time) return 0
        if (!a.due_date_time) return 1
        if (!b.due_date_time) return -1
        return new Date(a.due_date_time).getTime() - new Date(b.due_date_time).getTime()
      })
    default:
      return sorted
  }
}

const getDueDateGroup = (dueDate: string | undefined): string => {
  if (!dueDate) return 'No Due Date'

  const now = new Date()
  const due = new Date(dueDate)
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 7) return 'This Week'
  if (diffDays <= 30) return 'This Month'
  return 'Later'
}

const getGroupIcon = (key: string, groupBy: Props['groupBy']) => {
  if (groupBy === 'priority') {
    if (key === 'high') return ExclamationTriangleIcon
    if (key === 'normal' || key === 'low') return FlagIcon
  }
  if (groupBy === 'dueDate') {
    if (key === 'Overdue' || key === 'Today') return ExclamationTriangleIcon
    return ClockIcon
  }
  return null
}

const toggleStatusFilter = (status: string) => {
  const newFilters = { ...props.filters }
  const index = newFilters.status.indexOf(status)
  if (index > -1) {
    newFilters.status.splice(index, 1)
  } else {
    newFilters.status.push(status)
  }
  emit('update-filters', newFilters)
}

const togglePriorityFilter = (priority: string) => {
  const newFilters = { ...props.filters }
  const index = newFilters.priority.indexOf(priority)
  if (index > -1) {
    newFilters.priority.splice(index, 1)
  } else {
    newFilters.priority.push(priority)
  }
  emit('update-filters', newFilters)
}

const clearFilters = () => {
  emit('update-filters', {
    status: [],
    priority: [],
    search: ''
  })
}

const toggleGroupCollapse = (groupKey: string) => {
  if (collapsedGroups.value.has(groupKey)) {
    collapsedGroups.value.delete(groupKey)
  } else {
    collapsedGroups.value.add(groupKey)
  }
}

const handleGroupByChange = (value: Props['groupBy']) => {
  emit('update-grouping', value)
  showViewOptions.value = false
}

const handleSortByChange = (value: Props['sortBy']) => {
  emit('update-sorting', value)
  showViewOptions.value = false
}

const handleQuickCreate = (request: CreateTaskRequest) => {
  emit('task-create', request)
}

const handleTaskUpdate = (taskId: string, updates: Partial<CreateTaskRequest>) => {
  emit('task-update', taskId, updates)
}

// Close dropdowns on click outside
const handleClickOutside = (event: MouseEvent) => {
  if (showViewOptions.value && viewOptionsRef.value) {
    if (!viewOptionsRef.value.contains(event.target as Node)) {
      showViewOptions.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.tasks-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
  border-right: 1px solid var(--color-border-primary);
}

/* Header */
.list-header {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-primary);
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
}

.list-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
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

.btn-xs {
  width: 24px;
  height: 24px;
}

.btn-xs svg {
  width: 16px;
  height: 16px;
  transition: transform var(--transition-base);
}

.rotate-180 {
  transform: rotate(180deg);
}

/* Filters */
.filters-bar {
  padding: var(--space-4) var(--space-6);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.filter-chip {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-base);
}

.filter-chip:hover {
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.filter-chip.active {
  background: var(--color-interactive-primary);
  border-color: var(--color-interactive-primary);
  color: white;
}

.btn-text {
  align-self: flex-start;
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-interactive-primary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-text:hover {
  background: rgba(56, 139, 255, 0.08);
}

/* View options dropdown */
.view-options-dropdown {
  position: fixed;
  z-index: var(--z-dropdown);
  min-width: 220px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--space-2);
}

.dropdown-section {
  padding: var(--space-2) 0;
}

.dropdown-label {
  display: block;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.dropdown-item:hover {
  background: var(--color-bg-tertiary);
}

.dropdown-item.active {
  color: var(--color-interactive-primary);
}

.check-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border-primary);
  margin: var(--space-1) 0;
}

/* Content */
.list-content {
  flex: 1;
  min-height: 0; /* Critical for flex child to scroll properly */
  overflow-y: auto;
  overflow-x: hidden;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-16);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border-primary);
  border-top-color: var(--color-interactive-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-6);
  color: var(--color-text-tertiary);
}

.empty-icon svg {
  width: 40px;
  height: 40px;
}

.empty-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
}

.empty-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  max-width: 400px;
}

/* Task groups */
.tasks-groups {
  padding: var(--space-4) 0;
}

.task-group {
  margin-bottom: var(--space-6);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-6);
  margin-bottom: var(--space-2);
}

.group-title-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.group-icon {
  width: 18px;
  height: 18px;
  color: var(--color-text-tertiary);
}

.group-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.group-count {
  padding: 2px var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
}

.group-tasks {
  display: flex;
  flex-direction: column;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all var(--transition-smooth);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 500px;
  opacity: 1;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all var(--transition-smooth);
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 5000px;
  opacity: 1;
}
</style>