import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type { ApiResponse, PaginationParams, PaginatedResponse } from '@/types'
import { authStorage } from '@/utils/auth-storage'

// Microsoft Auth types
export interface MicrosoftAuthStatus {
  authenticated: boolean
  microsoft_email?: string
  connected_at?: string
}

export interface AuthUrlResponse {
  auth_url: string
  state: string
}

export interface CodeContext {
  file_path: string
  line_start?: number
  line_end?: number
  branch?: string
  commit?: string
  language?: string
  context_snippet?: string
}

export interface CreateTaskRequest {
  title: string
  body_content?: string
  importance?: 'low' | 'normal' | 'high'
  code_context?: CodeContext
  status?: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred'
}

export interface CacheStats {
  total_entries: number
  valid_entries: number
  expired_entries: number
  cache_hit_rate: number
}

export interface WorkspaceSyncStatus {
  workspace_id: string
  workspace_name: string
  has_list: boolean
  cached: boolean
  last_sync?: number
}

export interface TodoSyncStatus {
  last_sync: number
  total_tasks: number
  synced_tasks: number
  failed_tasks: number
  cache_status: 'fresh' | 'stale' | 'expired'
  synced_workspaces?: number
  total_workspaces?: number
  workspace_statuses?: WorkspaceSyncStatus[]
  cache_stats?: CacheStats
}

export interface TaskList {
  id: string
  displayName: string
  isOwner: boolean
  isShared: boolean
  wellknownListName?: string
}

export interface TodoTask {
  id: string
  title: string
  status: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred'
  importance: 'low' | 'normal' | 'high'
  createdDateTime: string
  created_date_time?: string // Alias for createdDateTime for component compatibility
  dueDateTime?: string
  due_date_time?: string // Alias for dueDateTime for component compatibility
  body?: {
    content: string
    contentType: string
  }
  completedDateTime?: string
  completed_date_time?: string // Alias for completedDateTime for component compatibility
  lastModifiedDateTime?: string
}

class RealMicrosoftAuthService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || '',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add SSO token
    this.client.interceptors.request.use((config) => {
      const token = authStorage.getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })
  }

  // Microsoft authentication endpoints
  async getAuthStatus(): Promise<MicrosoftAuthStatus> {
    const response: AxiosResponse<ApiResponse<MicrosoftAuthStatus>> = await this.client.get('/api/v1/microsoft/status')
    return response.data.data
  }

  async startOAuthFlow(): Promise<AuthUrlResponse> {
    const response: AxiosResponse<ApiResponse<AuthUrlResponse>> = await this.client.get('/api/v1/microsoft/connect')
    return response.data.data
  }

  async handleOAuthCallback(code: string, state: string, error?: string, errorDescription?: string): Promise<void> {
    await this.client.post('/api/v1/microsoft/callback', {
      code,
      state,
      error,
      error_description: errorDescription
    })
  }

  // Task list endpoints
  async getAllTaskLists(): Promise<TaskList[]> {
    const response: AxiosResponse<ApiResponse<TaskList[]>> = await this.client.get('/api/v1/microsoft/lists')
    return response.data.data
  }

  async getDefaultTaskList(): Promise<TaskList | null> {
    const response: AxiosResponse<ApiResponse<TaskList | null>> = await this.client.get('/api/v1/microsoft/lists/default')
    return response.data.data
  }

  async createList(displayName: string): Promise<TaskList> {
    const response: AxiosResponse<ApiResponse<TaskList>> = await this.client.post('/api/v1/microsoft/lists', {
      displayName
    })
    return response.data.data
  }

  // Task endpoints
  async getListTasksPaginated(listId: string, paginationParams?: PaginationParams): Promise<PaginatedResponse<TodoTask>> {
    const params = new URLSearchParams()
    if (paginationParams?.page_size) params.set('page_size', paginationParams.page_size.toString())
    if (paginationParams?.page !== undefined) params.set('page', paginationParams.page.toString())

    const url = params.toString()
      ? `/api/v1/microsoft/lists/${listId}/tasks?${params.toString()}`
      : `/api/v1/microsoft/lists/${listId}/tasks`

    const response: AxiosResponse<ApiResponse<PaginatedResponse<TodoTask>>> = await this.client.get(url)

    // Convert to paginated response
    // Real API returns nested structure: { data: { data: tasks[], pagination: {...} } }
    const responseData = response.data.data as PaginatedResponse<TodoTask>
    const tasks = responseData.data || []
    const pagination = responseData.pagination || {
      page: paginationParams?.page || 0,
      page_size: paginationParams?.page_size || 10,
      total_count: tasks.length
    }

    return {
      data: tasks,
      pagination: {
        page: pagination.page,
        page_size: pagination.page_size,
        total_count: pagination.total_count,
        total_pages: Math.ceil(pagination.total_count / pagination.page_size),
        has_next: pagination.page < Math.ceil(pagination.total_count / pagination.page_size),
        has_prev: pagination.page > 0
      }
    }
  }

  async getWorkspaceList(workspaceId: string): Promise<TaskList | null> {
    const response: AxiosResponse<ApiResponse<TaskList | null>> = await this.client.get(`/api/v1/microsoft/workspaces/${workspaceId}/list`)
    return response.data.data
  }

  async createTaskInList(listId: string, request: CreateTaskRequest): Promise<TodoTask> {
    const response: AxiosResponse<ApiResponse<TodoTask>> = await this.client.post(`/api/v1/microsoft/lists/${listId}/tasks`, request)
    return response.data.data
  }

  async createTaskFromCode(request: CreateTaskRequest): Promise<TodoTask> {
    const response: AxiosResponse<ApiResponse<TodoTask>> = await this.client.post('/api/v1/microsoft/tasks/from-code', request)
    return response.data.data
  }

  async updateTask(listId: string, taskId: string, updates: Partial<CreateTaskRequest>): Promise<TodoTask> {
    const response: AxiosResponse<ApiResponse<TodoTask>> = await this.client.put(`/api/v1/microsoft/lists/${listId}/tasks/${taskId}`, updates)
    return response.data.data
  }

  async deleteTask(listId: string, taskId: string): Promise<void> {
    await this.client.delete(`/api/v1/microsoft/lists/${listId}/tasks/${taskId}`)
  }

  async getTask(listId: string, taskId: string): Promise<TodoTask> {
    const response: AxiosResponse<ApiResponse<TodoTask>> = await this.client.get(`/api/v1/microsoft/lists/${listId}/tasks/${taskId}`)
    return response.data.data
  }

  async getListTasks(listId: string): Promise<TodoTask[]> {
    const response: AxiosResponse<ApiResponse<TodoTask[]>> = await this.client.get(`/api/v1/microsoft/lists/${listId}/tasks`)
    return response.data.data
  }

  // Sync endpoints
  async getSyncStatus(): Promise<WorkspaceSyncStatus[]> {
    const response: AxiosResponse<ApiResponse<WorkspaceSyncStatus[]>> = await this.client.get('/api/v1/microsoft/sync/status')
    return response.data.data
  }

  async syncWorkspace(workspaceId: string): Promise<void> {
    await this.client.post(`/api/v1/microsoft/sync/workspace/${workspaceId}`)
  }

  async syncAllWorkspaces(): Promise<void> {
    await this.client.post('/api/v1/microsoft/sync/all')
  }

  async refreshCache(): Promise<void> {
    await this.client.post('/api/v1/microsoft/cache/refresh')
  }

  async getCacheStats(): Promise<CacheStats> {
    const response: AxiosResponse<ApiResponse<CacheStats>> = await this.client.get('/api/v1/microsoft/cache/stats')
    return response.data.data
  }

  async getTodoSyncStatus(): Promise<TodoSyncStatus> {
    const response: AxiosResponse<ApiResponse<TodoSyncStatus>> = await this.client.get('/api/v1/microsoft/sync/todo-status')
    return response.data.data
  }

  async health(): Promise<{ status: string; authenticated: boolean }> {
    const response: AxiosResponse<ApiResponse<{ status: string; authenticated: boolean }>> = await this.client.get('/api/v1/microsoft/health')
    return response.data.data
  }
}

export const realMicrosoftAuthService = new RealMicrosoftAuthService()
export default realMicrosoftAuthService