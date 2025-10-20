// Microsoft Auth types (re-exported for consistency)
/* eslint-disable @typescript-eslint/no-unused-vars */
export type {
  MicrosoftAuthStatus,
  AuthUrlResponse,
  CodeContext,
  CreateTaskRequest,
  CacheStats,
  WorkspaceSyncStatus,
  TodoSyncStatus,
  TaskList,
  TodoTask
} from './realMicrosoftAuthService'

import type { PaginationParams, PaginatedResponse } from '@/types'
import type {
  MicrosoftAuthStatus,
  AuthUrlResponse,
  CreateTaskRequest,
  CacheStats,
  WorkspaceSyncStatus,
  TodoSyncStatus,
  TaskList,
  TodoTask
} from './realMicrosoftAuthService'

// Mock Microsoft Auth Service for development
class MockMicrosoftAuthService {
  constructor() {}

  // Microsoft authentication endpoints
  async getAuthStatus(): Promise<MicrosoftAuthStatus> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200))

    return {
      authenticated: true,
      microsoft_email: 'demo@outlook.com',
      connected_at: '2024-01-20T10:00:00Z'
    }
  }

  async startOAuthFlow(): Promise<AuthUrlResponse> {
    await new Promise(resolve => setTimeout(resolve, 100))

    return {
      auth_url: 'https://mock-microsoft-auth.com/authorize?client_id=mock&response_type=code',
      state: 'mock-state-' + Date.now()
    }
  }

  async handleOAuthCallback(_code: string, _state: string, _error?: string, _errorDescription?: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300))
    // Mock successful callback
  }

  // Task list endpoints
  async getAllTaskLists(): Promise<TaskList[]> {
    await new Promise(resolve => setTimeout(resolve, 250))

    return [
      {
        id: 'list-1',
        displayName: 'Tasks',
        isOwner: true,
        isShared: false,
        wellknownListName: 'defaultList'
      },
      {
        id: 'list-2',
        displayName: 'AI Terminal Frontend',
        isOwner: true,
        isShared: false
      }
    ]
  }

  async getDefaultTaskList(): Promise<TaskList | null> {
    await new Promise(resolve => setTimeout(resolve, 200))

    return {
      id: 'list-1',
      displayName: 'Tasks',
      isOwner: true,
      isShared: false,
      wellknownListName: 'defaultList'
    }
  }

  async createList(displayName: string): Promise<TaskList> {
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      id: 'list-' + Date.now(),
      displayName,
      isOwner: true,
      isShared: false
    }
  }

  // Task endpoints
  async getListTasksPaginated(listId: string, paginationParams?: PaginationParams): Promise<PaginatedResponse<TodoTask>> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const mockTasks: TodoTask[] = [
      {
        id: 'task-1',
        title: 'Review pull requests',
        status: 'notStarted',
        importance: 'normal',
        createdDateTime: '2024-01-20T09:00:00Z',
        created_date_time: '2024-01-20T09:00:00Z',
        dueDateTime: '2024-01-25T17:00:00Z',
        due_date_time: '2024-01-25T17:00:00Z',
        body: {
          content: 'Review and merge pending pull requests',
          contentType: 'text'
        }
      },
      {
        id: 'task-2',
        title: 'Update documentation',
        status: 'inProgress',
        importance: 'low',
        createdDateTime: '2024-01-19T14:30:00Z',
        created_date_time: '2024-01-19T14:30:00Z',
        body: {
          content: 'Update API documentation with new endpoints',
          contentType: 'text'
        }
      },
      {
        id: 'task-3',
        title: 'Fix authentication bug',
        status: 'completed',
        importance: 'high',
        createdDateTime: '2024-01-18T16:20:00Z',
        created_date_time: '2024-01-18T16:20:00Z',
        completedDateTime: '2024-01-19T10:15:00Z',
        completed_date_time: '2024-01-19T10:15:00Z',
        body: {
          content: 'Fix the SSO authentication flow issue in production',
          contentType: 'text'
        }
      }
    ]

    // Simulate pagination
    const pageSize = paginationParams?.page_size || 10
    // Handle both 0-based and 1-based page numbers
    const pageNumber = paginationParams?.page || 0
    const page = pageNumber > 0 ? pageNumber - 1 : 0  // Convert to 0-based index
    const startIndex = page * pageSize
    const endIndex = startIndex + pageSize
    const paginatedTasks = mockTasks.slice(startIndex, endIndex)

    // Return the same structure as the real API
    return {
      data: paginatedTasks,
      pagination: {
        page: pageNumber,  // Return the original page number (1-based)
        page_size: pageSize,
        total_count: mockTasks.length,
        total_pages: Math.ceil(mockTasks.length / pageSize),
        has_next: (pageNumber * pageSize) < mockTasks.length,
        has_prev: pageNumber > 1
      }
    }
  }

  async getWorkspaceList(_workspaceId: string): Promise<TaskList | null> {
    await new Promise(resolve => setTimeout(resolve, 200))

    return {
      id: 'workspace-list-' + Date.now(),
      displayName: 'Workspace Tasks',
      isOwner: true,
      isShared: false
    }
  }

  async createTaskInList(listId: string, request: CreateTaskRequest): Promise<TodoTask> {
    await new Promise(resolve => setTimeout(resolve, 400))

    const createdTime = new Date().toISOString()
    return {
      id: 'task-' + Date.now(),
      title: request.title,
      status: request.status || 'notStarted',
      importance: request.importance || 'normal',
      createdDateTime: createdTime,
      created_date_time: createdTime,
      body: request.body_content ? {
        content: request.body_content,
        contentType: 'text'
      } : undefined
    }
  }

  async createTaskFromCode(request: CreateTaskRequest): Promise<TodoTask> {
    await new Promise(resolve => setTimeout(resolve, 400))

    const createdTime = new Date().toISOString()
    return {
      id: 'code-task-' + Date.now(),
      title: request.title,
      status: 'notStarted',
      importance: 'high',
      createdDateTime: createdTime,
      created_date_time: createdTime,
      body: request.body_content ? {
        content: request.body_content,
        contentType: 'text'
      } : undefined
    }
  }

  async updateTask(listId: string, taskId: string, updates: Partial<CreateTaskRequest>): Promise<TodoTask> {
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      id: taskId,
      title: updates.title || 'Updated Task',
      status: updates.status || 'inProgress',
      importance: updates.importance || 'normal',
      createdDateTime: '2024-01-20T09:00:00Z',
      created_date_time: '2024-01-20T09:00:00Z',
      lastModifiedDateTime: new Date().toISOString(),
      body: updates.body_content ? {
        content: updates.body_content,
        contentType: 'text'
      } : undefined
    }
  }

  async deleteTask(listId: string, taskId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200))
    // Mock successful deletion
  }

  async getTask(listId: string, taskId: string): Promise<TodoTask> {
    await new Promise(resolve => setTimeout(resolve, 200))

    return {
      id: taskId,
      title: 'Mock Task',
      status: 'notStarted',
      importance: 'normal',
      createdDateTime: '2024-01-20T09:00:00Z',
      created_date_time: '2024-01-20T09:00:00Z',
      body: {
        content: 'This is a mock task',
        contentType: 'text'
      }
    }
  }

  async getListTasks(listId: string): Promise<TodoTask[]> {
    await new Promise(resolve => setTimeout(resolve, 250))

    return [
      {
        id: 'list-task-1',
        title: 'Mock List Task 1',
        status: 'completed',
        importance: 'normal',
        createdDateTime: '2024-01-19T10:00:00Z',
        created_date_time: '2024-01-19T10:00:00Z',
        completedDateTime: '2024-01-19T15:30:00Z',
        completed_date_time: '2024-01-19T15:30:00Z',
        body: {
          content: 'First mock task in list',
          contentType: 'text'
        }
      },
      {
        id: 'list-task-2',
        title: 'Mock List Task 2',
        status: 'inProgress',
        importance: 'high',
        createdDateTime: '2024-01-20T08:00:00Z',
        created_date_time: '2024-01-20T08:00:00Z',
        body: {
          content: 'Second mock task in list',
          contentType: 'text'
        }
      }
    ]
  }

  // Sync endpoints
  async getSyncStatus(): Promise<WorkspaceSyncStatus[]> {
    await new Promise(resolve => setTimeout(resolve, 200))

    return [
      {
        workspace_id: 'mock-workspace-1',
        workspace_name: 'AI Terminal',
        has_list: true,
        cached: true,
        last_sync: Date.now()
      },
      {
        workspace_id: 'mock-workspace-2',
        workspace_name: 'Documentation Site',
        has_list: false,
        cached: false
      }
    ]
  }

  async syncWorkspace(_workspaceId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500))
    // Mock successful sync
  }

  async syncAllWorkspaces(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000))
    // Mock successful sync
  }

  async refreshCache(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300))
    // Mock successful cache refresh
  }

  async getCacheStats(): Promise<CacheStats> {
    await new Promise(resolve => setTimeout(resolve, 150))

    return {
      total_entries: 25,
      valid_entries: 20,
      expired_entries: 5,
      cache_hit_rate: 0.85
    }
  }

  async getTodoSyncStatus(): Promise<TodoSyncStatus> {
    await new Promise(resolve => setTimeout(resolve, 200))

    const workspaceStatuses = [
      {
        workspace_id: 'mock-workspace-1',
        workspace_name: 'AI Terminal',
        has_list: true,
        cached: true,
        last_sync: Date.now()
      },
      {
        workspace_id: 'mock-workspace-2',
        workspace_name: 'Documentation Site',
        has_list: false,
        cached: false
      }
    ]

    return {
      last_sync: Date.now(),
      total_tasks: 25,
      synced_tasks: 20,
      failed_tasks: 5,
      cache_status: 'fresh',
      synced_workspaces: 1,
      total_workspaces: 2,
      workspace_statuses: workspaceStatuses,
      cache_stats: {
        total_entries: 25,
        valid_entries: 20,
        expired_entries: 5,
        cache_hit_rate: 0.85
      }
    }
  }

  async health(): Promise<{ status: string; authenticated: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 100))

    return {
      status: 'healthy',
      authenticated: true
    }
  }
}

export const mockMicrosoftAuthService = new MockMicrosoftAuthService()
export default mockMicrosoftAuthService