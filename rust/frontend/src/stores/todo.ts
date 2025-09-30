import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { microsoftAuthService } from '@/services/microsoft-auth'
import type {
  MicrosoftAuthStatus,
  AuthUrlResponse,
  TodoTask,
  TaskList,
  TodoSyncStatus,
  CreateTaskFromCodeRequest,
  CodeContext
} from '@/services/microsoft-auth'
import { logger } from '@/utils/logger'

export const useTodoStore = defineStore('todo', () => {
  // Microsoft authentication state
  const isAuthenticated = ref(false)
  const authStatus = ref<MicrosoftAuthStatus | null>(null)
  const authLoading = ref(false)
  const authError = ref<string | null>(null)

  // Todo tasks state
  const tasks = ref<TodoTask[]>([])
  const tasksLoading = ref(false)
  const tasksError = ref<string | null>(null)


  // Task creation state
  const creatingTask = ref(false)
  const createTaskError = ref<string | null>(null)

  // Sync state
  const syncLoading = ref(false)
  const syncStatus = ref<TodoSyncStatus | null>(null)
  const syncError = ref<string | null>(null)

  // Task lists state (for list selection)
  const availableLists = ref<TaskList[]>([])
  const selectedList = ref<TaskList | null>(null)
  const listsLoading = ref(false)
  const listsError = ref<string | null>(null)
  const defaultList = ref<TaskList | null>(null)

  // Computed properties
  const hasValidAuth = computed(() => isAuthenticated.value && authStatus.value?.authenticated)
  const microsoftEmail = computed(() => authStatus.value?.microsoft_email)
  const hasTasks = computed(() => tasks.value.length > 0)
  const completedTasks = computed(() => tasks.value.filter(task => task.status === 'completed'))
  const pendingTasks = computed(() => tasks.value.filter(task => task.status !== 'completed'))
  const hasLists = computed(() => availableLists.value.length > 0)
  const selectedListName = computed(() => selectedList.value?.displayName || 'No list selected')
  const isDefaultListSelected = computed(() =>
    selectedList.value?.id === defaultList.value?.id
  )

  // Check authentication status
  const checkAuthStatus = async () => {
    authLoading.value = true
    authError.value = null

    try {
      logger.log('🔍 Checking Microsoft authentication status...')
      const status = await microsoftAuthService.getAuthStatus()
      authStatus.value = status
      isAuthenticated.value = status.authenticated

      if (status.authenticated) {
        logger.log('✅ Microsoft authentication is active')
        await loadTaskLists()
      } else {
        logger.log('❌ Microsoft authentication not active')
      }
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Failed to check auth status'
      logger.error('❌ Failed to check Microsoft auth status:', error)
    } finally {
      authLoading.value = false
    }
  }

  // Start OAuth flow
  const startOAuthFlow = async (): Promise<AuthUrlResponse> => {
    authLoading.value = true
    authError.value = null

    try {
      logger.log('🚀 Starting Microsoft OAuth flow...')
      const authUrl = await microsoftAuthService.startOAuthFlow()
      logger.log('✅ OAuth URL generated successfully')
      return authUrl
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Failed to start OAuth flow'
      logger.error('❌ Failed to start OAuth flow:', error)
      throw error
    } finally {
      authLoading.value = false
    }
  }

  // Handle OAuth callback
  const handleOAuthCallback = async (code: string, state: string) => {
    authLoading.value = true
    authError.value = null

    try {
      logger.log('🔄 Handling OAuth callback...')
      await microsoftAuthService.handleOAuthCallback(code, state)
      await checkAuthStatus()
      logger.log('✅ OAuth callback handled successfully')
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Failed to handle OAuth callback'
      logger.error('❌ Failed to handle OAuth callback:', error)
      throw error
    } finally {
      authLoading.value = false
    }
  }

  // Disconnect Microsoft account
  const disconnect = async () => {
    authLoading.value = true
    authError.value = null

    try {
      logger.log('🔄 Disconnecting Microsoft account...')
      await microsoftAuthService.disconnect()

      // Clear local state
      isAuthenticated.value = false
      authStatus.value = null
      tasks.value = []
      availableLists.value = []
      selectedList.value = null
      defaultList.value = null

      logger.log('✅ Microsoft account disconnected')
    } catch (error) {
      authError.value = error instanceof Error ? error.message : 'Failed to disconnect'
      logger.error('❌ Failed to disconnect Microsoft account:', error)
      throw error
    } finally {
      authLoading.value = false
    }
  }

  // Load all available task lists
  const loadTaskLists = async () => {
    if (!hasValidAuth.value) {
      logger.warn('⚠️ Cannot load task lists - Microsoft authentication required')
      return
    }

    // Prevent multiple simultaneous calls
    if (listsLoading.value) {
      logger.log('⏳ Task lists already loading, skipping duplicate call')
      return
    }

    listsLoading.value = true
    listsError.value = null

    try {
      logger.log('🔄 Loading task lists...')
      const [lists, defaultListResult] = await Promise.all([
        microsoftAuthService.getAllTaskLists(),
        microsoftAuthService.getDefaultTaskList()
      ])

      availableLists.value = lists
      defaultList.value = defaultListResult

      if (lists.length === 0) {
        logger.log(`📝 No Microsoft To-Do lists found - user needs to create their first list`)
      } else {
        logger.log(`✅ Loaded ${lists.length} task lists`)

        // Auto-select default list if no list is currently selected
        if (!selectedList.value && defaultList.value) {
          selectedList.value = defaultList.value
          logger.log(`📝 Auto-selected default list: ${defaultList.value.displayName}`)
        }
      }

    } catch (error) {
      listsError.value = error instanceof Error ? error.message : 'Failed to load task lists'
      logger.error('❌ Failed to load task lists:', error)
    } finally {
      listsLoading.value = false
    }
  }

  // Select a specific task list
  const selectTaskList = async (list: TaskList | null) => {
    selectedList.value = list

    if (list) {
      logger.log(`📝 Selected task list: ${list.displayName}`)
      // Load tasks from the selected list
      await loadSelectedListTasks()
    } else {
      // Clear tasks if no list selected
      tasks.value = []
      logger.log('📝 No task list selected')
    }
  }

  // Load tasks from the currently selected list
  const loadSelectedListTasks = async () => {
    if (!hasValidAuth.value) {
      logger.warn('⚠️ Cannot load tasks - Microsoft authentication required')
      return
    }

    if (!selectedList.value) {
      logger.warn('⚠️ Cannot load tasks - No list selected')
      return
    }

    tasksLoading.value = true
    tasksError.value = null

    try {
      logger.log(`🔄 Loading tasks from list: ${selectedList.value.displayName}`)
      const listTasks = await microsoftAuthService.getListTasks(selectedList.value.id)
      tasks.value = listTasks
      logger.log(`✅ Loaded ${listTasks.length} tasks from list`)
    } catch (error) {
      tasksError.value = error instanceof Error ? error.message : 'Failed to load tasks'
      logger.error('❌ Failed to load tasks from list:', error)
    } finally {
      tasksLoading.value = false
    }
  }

  // Smart list selection based on workspace
  const selectListForWorkspace = async (workspaceId: string, workspaceName?: string) => {
    if (!hasValidAuth.value) return

    // Enhanced matching logic - try multiple strategies
    let matchedList: TaskList | undefined

    // Strategy 1: Exact workspace ID match
    matchedList = availableLists.value.find(list =>
      list.displayName.toLowerCase() === workspaceId.toLowerCase()
    )

    // Strategy 2: Workspace name match (if provided)
    if (!matchedList && workspaceName) {
      matchedList = availableLists.value.find(list =>
        list.displayName.toLowerCase() === workspaceName.toLowerCase()
      )
    }

    // Strategy 3: Partial workspace ID match
    if (!matchedList) {
      matchedList = availableLists.value.find(list =>
        list.displayName.toLowerCase().includes(workspaceId.toLowerCase()) ||
        workspaceId.toLowerCase().includes(list.displayName.toLowerCase())
      )
    }

    // Strategy 4: Partial workspace name match (if provided)
    if (!matchedList && workspaceName) {
      matchedList = availableLists.value.find(list =>
        list.displayName.toLowerCase().includes(workspaceName.toLowerCase()) ||
        workspaceName.toLowerCase().includes(list.displayName.toLowerCase())
      )
    }

    // Strategy 5: Look for lists that contain common project keywords
    if (!matchedList && workspaceName) {
      const projectKeywords = workspaceName.toLowerCase().split(/[-_\s]+/)
      matchedList = availableLists.value.find(list => {
        const listWords = list.displayName.toLowerCase().split(/[-_\s]+/)
        return projectKeywords.some(keyword =>
          keyword.length > 2 && listWords.some(word => word.includes(keyword))
        )
      })
    }

    if (matchedList) {
      await selectTaskList(matchedList)
      logger.log(`📝 Smart-selected workspace list: ${matchedList.displayName} for workspace ${workspaceId}`)
    } else if (defaultList.value) {
      await selectTaskList(defaultList.value)
      logger.log(`📝 Fallback to default list: ${defaultList.value.displayName}`)
    } else {
      logger.log(`📝 No suitable list found for workspace ${workspaceId}`)
    }
  }

  // Auto-select appropriate list when workspace changes
  const handleWorkspaceChange = async (workspace: { id: string; name?: string } | null) => {
    if (!workspace) {
      // No workspace selected, default to user's default list
      if (defaultList.value && selectedList.value?.id !== defaultList.value.id) {
        await selectTaskList(defaultList.value)
        logger.log(`📝 No workspace - selected default list: ${defaultList.value.displayName}`)
      }
    } else {
      // Workspace selected, try to find appropriate list
      await selectListForWorkspace(workspace.id, workspace.name)
    }
  }

  
  
  // Create task
  const createTask = async (title: string, bodyContent?: string, codeContext?: CodeContext): Promise<TodoTask> => {
    if (!hasValidAuth.value) {
      throw new Error('Microsoft authentication required')
    }

    if (!selectedList.value) {
      throw new Error('No list selected')
    }

    creatingTask.value = true
    createTaskError.value = null

    try {
      logger.log(`🔄 Creating task: ${title}`)

      const request = {
        title,
        body_content: bodyContent,
        code_context: codeContext,
      }

      const task = await microsoftAuthService.createTaskInList(selectedList.value.id, request)
      tasks.value.unshift(task)

      logger.log(`✅ Task created successfully: ${task.title}`)
      return task
    } catch (error) {
      createTaskError.value = error instanceof Error ? error.message : 'Failed to create task'
      logger.error('❌ Failed to create task:', error)
      throw error
    } finally {
      creatingTask.value = false
    }
  }

  // Create task from code (workspace-aware)
  const createTaskFromCode = async (request: CreateTaskFromCodeRequest): Promise<TodoTask> => {
    if (!hasValidAuth.value) {
      throw new Error('Microsoft authentication required')
    }

    creatingTask.value = true
    createTaskError.value = null

    try {
      logger.log(`🔄 Creating task from code: ${request.title}`)

      const task = await microsoftAuthService.createTaskFromCode(request)

      // If we have a current list selected and the task was created there, refresh the list
      if (selectedList.value) {
        await loadSelectedListTasks()
      }

      logger.log(`✅ Task created from code successfully: ${task.title}`)
      return task
    } catch (error) {
      createTaskError.value = error instanceof Error ? error.message : 'Failed to create task from code'
      logger.error('❌ Failed to create task from code:', error)
      throw error
    } finally {
      creatingTask.value = false
    }
  }

  // Update task
  const updateTask = async (taskId: string, updates: Partial<CreateTaskRequest>): Promise<TodoTask> => {
    if (!hasValidAuth.value) {
      throw new Error('Microsoft authentication required')
    }

    if (!selectedList.value) {
      throw new Error('No list selected')
    }

    try {
      logger.log(`🔄 Updating task: ${taskId}`)

      const task = await microsoftAuthService.updateTask(selectedList.value.id, taskId, updates)

      // Update the task in the local array
      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        tasks.value[index] = task
      }

      logger.log(`✅ Task updated successfully: ${task.title}`)
      return task
    } catch (error) {
      logger.error('❌ Failed to update task:', error)
      throw error
    }
  }

  // Load sync status
  const loadSyncStatus = async () => {
    if (!hasValidAuth.value) {
      logger.warn('⚠️ Cannot load sync status - Microsoft authentication required')
      return
    }

    syncLoading.value = true
    syncError.value = null

    try {
      logger.log('🔄 Loading sync status...')
      const status = await microsoftAuthService.getSyncStatus()
      syncStatus.value = status
      logger.log(`✅ Sync status loaded: ${status.synced_workspaces}/${status.total_workspaces} workspaces synced`)
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : 'Failed to load sync status'
      logger.error('❌ Failed to load sync status:', error)
    } finally {
      syncLoading.value = false
    }
  }

  // Sync specific workspace
  const syncWorkspace = async (workspaceId: string) => {
    if (!hasValidAuth.value) {
      throw new Error('Microsoft authentication required')
    }

    syncLoading.value = true
    syncError.value = null

    try {
      logger.log(`🔄 Syncing workspace: ${workspaceId}`)
      await microsoftAuthService.syncWorkspace(workspaceId)
      await loadSyncStatus()
      logger.log(`✅ Workspace synced successfully: ${workspaceId}`)
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : 'Failed to sync workspace'
      logger.error('❌ Failed to sync workspace:', error)
      throw error
    } finally {
      syncLoading.value = false
    }
  }

  // Sync all workspaces
  const syncAllWorkspaces = async () => {
    if (!hasValidAuth.value) {
      throw new Error('Microsoft authentication required')
    }

    syncLoading.value = true
    syncError.value = null

    try {
      logger.log('🔄 Syncing all workspaces...')
      await microsoftAuthService.syncAllWorkspaces()
      await loadSyncStatus()
      logger.log('✅ All workspaces synced successfully')
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : 'Failed to sync all workspaces'
      logger.error('❌ Failed to sync all workspaces:', error)
      throw error
    } finally {
      syncLoading.value = false
    }
  }

  // Refresh cache
  const refreshCache = async () => {
    if (!hasValidAuth.value) {
      throw new Error('Microsoft authentication required')
    }

    syncLoading.value = true
    syncError.value = null

    try {
      logger.log('🔄 Refreshing cache...')
      await microsoftAuthService.refreshCache()
      await loadSyncStatus()
      logger.log('✅ Cache refreshed successfully')
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : 'Failed to refresh cache'
      logger.error('❌ Failed to refresh cache:', error)
      throw error
    } finally {
      syncLoading.value = false
    }
  }

  // Load tasks for specific workspace
  const loadWorkspaceTasks = async (workspaceId: string) => {
    if (!hasValidAuth.value) {
      logger.warn('⚠️ Cannot load workspace tasks - Microsoft authentication required')
      return
    }

    tasksLoading.value = true
    tasksError.value = null

    try {
      logger.log(`🔄 Loading tasks for workspace: ${workspaceId}`)

      // Find the list for this workspace
      const workspaceList = availableLists.value.find(list =>
        list.displayName.toLowerCase() === workspaceId.toLowerCase()
      )

      if (workspaceList) {
        const listTasks = await microsoftAuthService.getListTasks(workspaceList.id)
        tasks.value = listTasks
        selectedList.value = workspaceList
        logger.log(`✅ Loaded ${listTasks.length} tasks for workspace: ${workspaceId}`)
      } else {
        logger.log(`📝 No list found for workspace: ${workspaceId}`)
        tasks.value = []
      }
    } catch (error) {
      tasksError.value = error instanceof Error ? error.message : 'Failed to load workspace tasks'
      logger.error('❌ Failed to load workspace tasks:', error)
    } finally {
      tasksLoading.value = false
    }
  }

  // Check if workspace has a list
  const workspaceHasList = (workspaceId: string): boolean => {
    return availableLists.value.some(list =>
      list.displayName.toLowerCase() === workspaceId.toLowerCase()
    )
  }



  // Clear all errors
  const clearErrors = () => {
    authError.value = null
    tasksError.value = null
    listsError.value = null
    createTaskError.value = null
    syncError.value = null
  }

  // Auto-load data when authentication changes
  watch(isAuthenticated, (newValue) => {
    if (!newValue) {
      // Clear state when not authenticated
      tasks.value = []
      availableLists.value = []
      selectedList.value = null
      defaultList.value = null
    }
    // Note: We don't call loadTaskLists() here because checkAuthStatus() already does it
  })

  return {
    // State
    isAuthenticated,
    authStatus,
    authLoading,
    authError,
    tasks,
    tasksLoading,
    tasksError,
    creatingTask,
    createTaskError,
    // List selection state
    availableLists,
    selectedList,
    listsLoading,
    listsError,
    defaultList,
    // Sync state
    syncLoading,
    syncStatus,
    syncError,

    // Computed
    hasValidAuth,
    microsoftEmail,
    hasTasks,
    completedTasks,
    pendingTasks,
    hasLists,
    selectedListName,
    isDefaultListSelected,

    // Actions
    checkAuthStatus,
    startOAuthFlow,
    handleOAuthCallback,
    disconnect,
    // List management
    loadTaskLists,
    selectTaskList,
    loadSelectedListTasks,
    selectListForWorkspace,
    handleWorkspaceChange,
    // Task management
    createTask,
    createTaskFromCode,
    updateTask,
    // Sync management
    loadSyncStatus,
    syncWorkspace,
    syncAllWorkspaces,
    refreshCache,
    loadWorkspaceTasks,
    workspaceHasList,
    clearErrors,
  }
})