<template>
  <div class="tasks-board" :class="{ 'details-open': selectedTaskId }">
    <!-- Left Sidebar: Lists -->
    <TaskListSidebar
      :lists="lists"
      :selected-list-id="selectedListId"
      :loading="listsLoading"
      @select-list="handleSelectList"
      @create-list="handleCreateList"
      @rename-list="handleRenameList"
      @delete-list="handleDeleteList"
    />

    <!-- Middle: Tasks List -->
    <TasksList
      v-if="selectedListId"
      :tasks="tasks"
      :list-name="selectedListName"
      :loading="tasksLoading"
      :selected-task-id="selectedTaskId"
      :group-by="groupBy"
      :sort-by="sortBy"
      :filters="filters"
      @task-click="handleTaskClick"
      @task-update="(taskId: string, updates: any) => handleTaskUpdate(taskId, updates)"
      @task-delete="(taskId: string) => handleTaskDelete(taskId)"
      @task-create="(request: any) => handleTaskCreate(request)"
      @update-grouping="handleUpdateGrouping"
      @update-sorting="handleUpdateSorting"
      @update-filters="handleUpdateFilters"
    />

    <!-- Empty state when no list selected -->
    <div v-else class="empty-board">
      <div class="empty-icon">
        <ClipboardDocumentListIcon />
      </div>
      <h3 class="empty-title">
        {{ workspaceStore.currentWorkspace ? `No list for "${workspaceStore.currentWorkspace.name}"` : 'Select a list to get started' }}
      </h3>
      <p class="empty-text">
        {{ workspaceStore.currentWorkspace
          ? `Create a list to organize tasks for this workspace`
          : 'Choose a list from the sidebar or create a new one' }}
      </p>
      <button
        v-if="workspaceStore.currentWorkspace && todoStore.hasValidAuth"
        @click="handleCreateListForWorkspace"
        :disabled="creatingList"
        class="btn-primary"
      >
        <PlusCircleIcon v-if="!creatingList" class="btn-icon" />
        <div v-else class="spinner-sm"></div>
        {{ creatingList ? 'Creating...' : `Create list for ${workspaceStore.currentWorkspace.name}` }}
      </button>
    </div>

    <!-- Right Sidebar: Task Details -->
    <Transition name="slide-left">
      <TaskDetailPanel
        v-if="selectedTaskId && selectedTask"
        :task="selectedTask"
        :list-id="selectedListId"
        @close="handleCloseDetails"
        @update="handleTaskDetailUpdate"
        @delete="() => handleTaskDelete(selectedTaskId!)"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { useWorkspaceStore } from '@/stores/workspace'
import TaskListSidebar from './TaskListSidebar.vue'
import TasksList from './TasksList.vue'
import TaskDetailPanel from './TaskDetailPanel.vue'
import { ClipboardDocumentListIcon, PlusCircleIcon } from '@heroicons/vue/24/outline'
import type { TodoTask, TaskList, CreateTaskRequest } from '@/services/microsoft-auth'
import { logger } from '@/utils/logger'

// Stores
const todoStore = useTodoStore()
const workspaceStore = useWorkspaceStore()

// Local state
const selectedListId = ref<string | null>(null)
const selectedTaskId = ref<string | null>(null)
const creatingList = ref(false)
const groupBy = ref<'none' | 'status' | 'priority' | 'dueDate'>('status')
const sortBy = ref<'default' | 'title' | 'created' | 'updated' | 'dueDate'>('default')
const filters = ref<{
  status: string[]
  priority: string[]
  search: string
}>({
  status: [],
  priority: [],
  search: ''
})

// Computed
const lists = computed(() => todoStore.availableLists)
const listsLoading = computed(() => todoStore.listsLoading)
const tasks = computed(() => todoStore.tasks)
const tasksLoading = computed(() => todoStore.tasksLoading)
const selectedListName = computed(() => {
  const list = lists.value.find(l => l.id === selectedListId.value)
  return list?.displayName || ''
})
const selectedTask = computed(() => {
  return tasks.value.find(t => t.id === selectedTaskId.value)
})

// Methods
const handleSelectList = async (listId: string) => {
  selectedListId.value = listId
  selectedTaskId.value = null
  const list = lists.value.find(l => l.id === listId)
  if (list) {
    await todoStore.selectTaskList(list)
  }
}

const handleTaskClick = (taskId: string) => {
  selectedTaskId.value = taskId
}

const handleCloseDetails = () => {
  selectedTaskId.value = null
}

const handleTaskCreate = async (request: CreateTaskRequest) => {
  if (!selectedListId.value) return

  try {
    await todoStore.createTask(
      request.title,
      request.body_content,
      request.code_context
    )
  } catch (error) {
    logger.error('Failed to create task:', error)
  }
}

const handleTaskUpdate = async (taskId: string, updates: Partial<CreateTaskRequest>) => {
  if (!selectedListId.value) return

  try {
    // Update via API
    await todoStore.updateTask(taskId, updates)
  } catch (error) {
    logger.error('Failed to update task:', error)
  }
}

const handleTaskDetailUpdate = async (updates: Partial<CreateTaskRequest>) => {
  if (!selectedTaskId.value) return
  await handleTaskUpdate(selectedTaskId.value, updates)
}

const handleTaskDelete = async (taskId: string) => {
  if (!selectedListId.value) return

  try {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    if (!confirm(`Delete task "${task.title}"?`)) return

    await todoStore.deleteTask(taskId)

    if (selectedTaskId.value === taskId) {
      selectedTaskId.value = null
    }
  } catch (error) {
    logger.error('Failed to delete task:', error)
  }
}

const handleCreateList = async (name: string) => {
  // TODO: Implement list creation
  logger.log('Create list:', name)
}

const handleRenameList = async (listId: string, newName: string) => {
  // TODO: Implement list rename
  logger.log('Rename list:', listId, newName)
}

const handleDeleteList = async (listId: string) => {
  // TODO: Implement list deletion
  logger.log('Delete list:', listId)
}

const handleUpdateGrouping = (newGroupBy: typeof groupBy.value) => {
  groupBy.value = newGroupBy
}

const handleUpdateSorting = (newSortBy: typeof sortBy.value) => {
  sortBy.value = newSortBy
}

const handleUpdateFilters = (newFilters: typeof filters.value) => {
  filters.value = newFilters
}

const handleCreateListForWorkspace = async () => {
  if (!workspaceStore.currentWorkspace) return

  creatingList.value = true
  try {
    const newList = await todoStore.createListForWorkspace(
      workspaceStore.currentWorkspace.id,
      workspaceStore.currentWorkspace.name
    )

    // The list is auto-selected by createListForWorkspace
    selectedListId.value = newList.id

    logger.log(`✅ Successfully created list for workspace: ${workspaceStore.currentWorkspace.name}`)
  } catch (error) {
    logger.error('Failed to create list for workspace:', error)
  } finally {
    creatingList.value = false
  }
}

// Lifecycle
onMounted(async () => {
  // Load lists if not already loaded
  if (todoStore.hasValidAuth && lists.value.length === 0 && !listsLoading.value) {
    await todoStore.loadTaskLists()
  }
})

// Sync local selectedListId with global todo store
watch(() => todoStore.selectedList, (newList) => {
  selectedListId.value = newList?.id || null
}, { immediate: true })
</script>

<style scoped>
.tasks-board {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.tasks-board > * {
  min-height: 0;
  min-width: 0;
}

.tasks-board.details-open {
  grid-template-columns: 280px 1fr 480px;
}

/* Empty state */
.empty-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
  grid-column: 2;
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
  margin: 0 0 var(--space-6) 0;
  max-width: 400px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: white;
  background: var(--color-interactive-primary);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(56, 139, 255, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 20px;
  height: 20px;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all var(--transition-smooth);
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Responsive */
@media (max-width: 1200px) {
  .tasks-board.details-open {
    grid-template-columns: 240px 1fr 400px;
  }
}

@media (max-width: 960px) {
  .tasks-board {
    grid-template-columns: 240px 1fr;
  }

  .tasks-board.details-open {
    grid-template-columns: 1fr 100%;
  }

  .tasks-board.details-open > :nth-child(1),
  .tasks-board.details-open > :nth-child(2) {
    display: none;
  }
}

@media (max-width: 640px) {
  .tasks-board {
    grid-template-columns: 1fr;
  }
}
</style>