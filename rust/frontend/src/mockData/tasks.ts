// Mock Microsoft To Do / Tasks integration

// Task interface
export interface MockTask {
  id: string
  title: string
  description?: string
  status: 'notStarted' | 'inProgress' | 'completed' | 'rejected'
  priority: 'low' | 'normal' | 'high'
  due_date?: string
  created_at: string
  updated_at: string
  completed_at?: string
  list_id: string
  order: number
  tags?: string[]
  attachments?: string[]
  notes?: string
}

// Task list interface
export interface MockTaskList {
  id: string
  name: string
  description?: string
  is_default: boolean
  created_at: string
  updated_at: string
  order: number
  color?: string
  icon?: string
}

// Mock task lists
export const mockTaskLists: MockTaskList[] = [
  {
    id: 'list-1',
    name: 'Tasks',
    description: 'Default task list',
    is_default: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
    order: 0,
    color: '#0078d4',
    icon: '📋'
  },
  {
    id: 'list-2',
    name: 'AI Terminal Frontend',
    description: 'Tasks for the AI Terminal frontend project',
    is_default: false,
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-20T11:30:00Z',
    order: 1,
    color: '#107c10',
    icon: '💻'
  },
  {
    id: 'list-3',
    name: 'Documentation',
    description: 'Documentation and writing tasks',
    is_default: false,
    created_at: '2024-01-10T14:20:00Z',
    updated_at: '2024-01-19T16:45:00Z',
    order: 2,
    color: '#5c2d91',
    icon: '📚'
  },
  {
    id: 'list-4',
    name: 'Learning',
    description: 'Personal learning and development tasks',
    is_default: false,
    created_at: '2024-01-05T11:00:00Z',
    updated_at: '2024-01-18T13:15:00Z',
    order: 3,
    color: '#ca5010',
    icon: '🎓'
  }
]

// Mock tasks
export const mockTasks: MockTask[] = [
  // General tasks
  {
    id: 'task-1',
    title: 'Review pull requests',
    description: 'Review and approve pending pull requests',
    status: 'inProgress',
    priority: 'high',
    due_date: '2024-01-21T17:00:00Z',
    created_at: '2024-01-20T09:00:00Z',
    updated_at: '2024-01-20T14:30:00Z',
    list_id: 'list-1',
    order: 0,
    tags: ['github', 'review'],
    notes: 'Focus on the frontend refactoring PR'
  },
  {
    id: 'task-2',
    title: 'Update dependencies',
    description: 'Update npm packages to latest versions',
    status: 'notStarted',
    priority: 'normal',
    due_date: '2024-01-25T12:00:00Z',
    created_at: '2024-01-19T10:15:00Z',
    updated_at: '2024-01-19T10:15:00Z',
    list_id: 'list-1',
    order: 1,
    tags: ['npm', 'maintenance']
  },
  {
    id: 'task-3',
    title: 'Team meeting',
    description: 'Weekly sync with the development team',
    status: 'completed',
    priority: 'normal',
    due_date: '2024-01-19T15:00:00Z',
    created_at: '2024-01-18T11:30:00Z',
    updated_at: '2024-01-19T15:30:00Z',
    completed_at: '2024-01-19T15:25:00Z',
    list_id: 'list-1',
    order: 2,
    tags: ['meeting', 'team']
  },

  // AI Terminal Frontend tasks
  {
    id: 'task-4',
    title: 'Implement terminal command history',
    description: 'Add history navigation and search for terminal commands',
    status: 'inProgress',
    priority: 'high',
    due_date: '2024-01-22T18:00:00Z',
    created_at: '2024-01-15T09:30:00Z',
    updated_at: '2024-01-20T10:45:00Z',
    list_id: 'list-2',
    order: 0,
    tags: ['terminal', 'feature'],
    notes: 'Consider using arrow keys for navigation'
  },
  {
    id: 'task-5',
    title: 'Add file tree view',
    description: 'Implement collapsible file tree for workspace navigation',
    status: 'notStarted',
    priority: 'high',
    due_date: '2024-01-24T17:00:00Z',
    created_at: '2024-01-16T14:20:00Z',
    updated_at: '2024-01-16T14:20:00Z',
    list_id: 'list-2',
    order: 1,
    tags: ['ui', 'feature', 'navigation']
  },
  {
    id: 'task-6',
    title: 'Dark mode theme',
    description: 'Implement dark theme with proper contrast and accessibility',
    status: 'inProgress',
    priority: 'normal',
    due_date: '2024-01-26T12:00:00Z',
    created_at: '2024-01-17T10:45:00Z',
    updated_at: '2024-01-20T09:15:00Z',
    list_id: 'list-2',
    order: 2,
    tags: ['ui', 'theme', 'accessibility']
  },
  {
    id: 'task-7',
    title: 'Fix responsive layout issues',
    description: 'Address layout problems on mobile and tablet devices',
    status: 'completed',
    priority: 'normal',
    due_date: '2024-01-19T17:00:00Z',
    created_at: '2024-01-15T16:00:00Z',
    updated_at: '2024-01-19T16:45:00Z',
    completed_at: '2024-01-19T16:45:00Z',
    list_id: 'list-2',
    order: 3,
    tags: ['bug', 'responsive', 'css']
  },
  {
    id: 'task-8',
    title: 'WebSocket reconnection logic',
    description: 'Implement robust reconnection handling for WebSocket connections',
    status: 'notStarted',
    priority: 'high',
    due_date: '2024-01-23T15:00:00Z',
    created_at: '2024-01-18T13:30:00Z',
    updated_at: '2024-01-18T13:30:00Z',
    list_id: 'list-2',
    order: 4,
    tags: ['websocket', 'network', 'feature']
  },

  // Documentation tasks
  {
    id: 'task-9',
    title: 'Write API documentation',
    description: 'Document all API endpoints with examples',
    status: 'inProgress',
    priority: 'normal',
    due_date: '2024-01-28T17:00:00Z',
    created_at: '2024-01-10T14:45:00Z',
    updated_at: '2024-01-20T11:00:00Z',
    list_id: 'list-3',
    order: 0,
    tags: ['documentation', 'api']
  },
  {
    id: 'task-10',
    title: 'Update README with setup instructions',
    description: 'Add detailed installation and configuration guide',
    status: 'completed',
    priority: 'normal',
    due_date: '2024-01-18T12:00:00Z',
    created_at: '2024-01-12T09:20:00Z',
    updated_at: '2024-01-17T14:30:00Z',
    completed_at: '2024-01-17T14:30:00Z',
    list_id: 'list-3',
    order: 1,
    tags: ['documentation', 'readme']
  },
  {
    id: 'task-11',
    title: 'Create user guide',
    description: 'Write comprehensive user guide with screenshots',
    status: 'notStarted',
    priority: 'low',
    due_date: '2024-02-02T17:00:00Z',
    created_at: '2024-01-14T11:15:00Z',
    updated_at: '2024-01-14T11:15:00Z',
    list_id: 'list-3',
    order: 2,
    tags: ['documentation', 'user-guide']
  },

  // Learning tasks
  {
    id: 'task-12',
    title: 'Learn Rust programming',
    description: 'Complete the Rust book and build a small project',
    status: 'inProgress',
    priority: 'normal',
    due_date: '2024-02-15T18:00:00Z',
    created_at: '2024-01-05T11:00:00Z',
    updated_at: '2024-01-20T08:30:00Z',
    list_id: 'list-4',
    order: 0,
    tags: ['rust', 'learning', 'programming'],
    notes: 'Currently on Chapter 8 - Common Collections'
  },
  {
    id: 'task-13',
    title: 'Study advanced TypeScript',
    description: 'Learn generics, decorators, and advanced type patterns',
    status: 'notStarted',
    priority: 'low',
    due_date: '2024-02-10T17:00:00Z',
    created_at: '2024-01-08T15:45:00Z',
    updated_at: '2024-01-08T15:45:00Z',
    list_id: 'list-4',
    order: 1,
    tags: ['typescript', 'learning']
  },
  {
    id: 'task-14',
    title: 'Complete cloud architecture course',
    description: 'Finish the AWS Solutions Architect course',
    status: 'inProgress',
    priority: 'normal',
    due_date: '2024-01-30T12:00:00Z',
    created_at: '2024-01-07T09:30:00Z',
    updated_at: '2024-01-19T19:20:00Z',
    list_id: 'list-4',
    order: 2,
    tags: ['aws', 'cloud', 'learning', 'certification']
  }
]

// Helper functions for task list operations
export const addTaskList = (taskList: MockTaskList): void => {
  mockTaskLists.push(taskList)
}

export const removeTaskList = (id: string): boolean => {
  const index = mockTaskLists.findIndex(list => list.id === id)
  if (index !== -1) {
    mockTaskLists.splice(index, 1)
    return true
  }
  return false
}

export const findTaskList = (id: string): MockTaskList | undefined => {
  return mockTaskLists.find(list => list.id === id)
}

export const updateTaskList = (id: string, updates: Partial<MockTaskList>): boolean => {
  const taskList = findTaskList(id)
  if (taskList) {
    Object.assign(taskList, updates, { updated_at: new Date().toISOString() })
    return true
  }
  return false
}

// Helper functions for task operations
export const addTask = (task: MockTask): void => {
  mockTasks.push(task)
}

export const removeTask = (id: string): boolean => {
  const index = mockTasks.findIndex(task => task.id === id)
  if (index !== -1) {
    mockTasks.splice(index, 1)
    return true
  }
  return false
}

export const findTask = (id: string): MockTask | undefined => {
  return mockTasks.find(task => task.id === id)
}

export const updateTask = (id: string, updates: Partial<MockTask>): boolean => {
  const task = findTask(id)
  if (task) {
    // Update completed_at if status changed to completed
    if (updates.status === 'completed' && task.status !== 'completed') {
      updates.completed_at = new Date().toISOString()
    } else if (updates.status !== 'completed' && task.status === 'completed') {
      updates.completed_at = undefined
    }

    Object.assign(task, updates, { updated_at: new Date().toISOString() })
    return true
  }
  return false
}

// Get tasks by list ID
export const getTasksByList = (listId: string): MockTask[] => {
  return mockTasks
    .filter(task => task.list_id === listId)
    .sort((a, b) => a.order - b.order)
}

// Get all task lists
export const getAllTaskLists = (): MockTaskList[] => {
  return mockTaskLists.sort((a, b) => a.order - b.order)
}

// Create a new task
export const createTask = (
  title: string,
  listId: string,
  options: {
    description?: string
    priority?: 'low' | 'normal' | 'high'
    dueDate?: string
    tags?: string[]
    notes?: string
  } = {}
): MockTask => {
  const newTask: MockTask = {
    id: `task-${Date.now()}`,
    title,
    description: options.description,
    status: 'notStarted',
    priority: options.priority || 'normal',
    due_date: options.dueDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    list_id: listId,
    order: mockTasks.filter(t => t.list_id === listId).length,
    tags: options.tags,
    notes: options.notes
  }

  addTask(newTask)
  return newTask
}

// Create a new task list
export const createTaskList = (
  name: string,
  options: {
    description?: string
    color?: string
    icon?: string
  } = {}
): MockTaskList => {
  const newList: MockTaskList = {
    id: `list-${Date.now()}`,
    name,
    description: options.description,
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order: mockTaskLists.length,
    color: options.color,
    icon: options.icon
  }

  addTaskList(newList)
  return newList
}

// Mock Microsoft identity integration
export const mockMicrosoftIdentity = {
  isConnected: true,
  permissions: [
    'Tasks.ReadWrite',
    'User.Read'
  ],
  profile: {
    id: 'microsoft-user-456',
    displayName: 'Demo User',
    email: 'demo@outlook.com',
    preferredLanguage: 'en-US'
  }
}

// Simulate task execution from code
export const simulateTaskExecution = (taskTitle: string, taskDescription?: string): MockTask => {
  const tasksList = mockTaskLists.find(list => list.name === 'Tasks')
  const defaultListId = tasksList?.id || mockTaskLists[0].id

  return createTask(taskTitle, defaultListId, {
    description: taskDescription || `Created from code execution`,
    priority: 'normal',
    tags: ['auto-generated', 'code-execution']
  })
}