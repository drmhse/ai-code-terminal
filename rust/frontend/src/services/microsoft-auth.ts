import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types'

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
  total_workspaces: number
  synced_workspaces: number
  cached_workspaces: number
  workspace_statuses: WorkspaceSyncStatus[]
  cache_stats: CacheStats
}

export interface CreateTaskFromCodeRequest {
  title: string
  body_content?: string
  importance?: 'low' | 'normal' | 'high'
  code_context: CodeContext
  workspace_id?: string
}

export interface TodoTask {
  id: string
  title: string
  body?: {
    content: string
    content_type: string
  }
  importance: 'low' | 'normal' | 'high'
  status: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred'
  created_date_time?: string
  completed_date_time?: string
  due_date_time?: string
}


export interface TaskList {
  id: string
  displayName: string
  isOwner: boolean
  isShared: boolean
  wellknownListName?: string
}

class MicrosoftAuthService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || '',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add JWT token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('jwt_token')
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

  async disconnect(): Promise<void> {
    await this.client.delete('/api/v1/microsoft/disconnect')
  }


  // General list operations (workspace-independent)
  async getAllTaskLists(): Promise<TaskList[]> {
    const response: AxiosResponse<ApiResponse<TaskList[]>> = await this.client.get('/api/v1/microsoft/lists')
    return response.data.data
  }

  async getDefaultTaskList(): Promise<TaskList | null> {
    const response: AxiosResponse<ApiResponse<TaskList | null>> = await this.client.get('/api/v1/microsoft/lists/default')
    return response.data.data
  }

  async getListTasks(listId: string): Promise<TodoTask[]> {
    const response: AxiosResponse<ApiResponse<TodoTask[]>> = await this.client.get(`/api/v1/microsoft/lists/${listId}/tasks`)
    return response.data.data
  }

  async createTaskInList(listId: string, request: CreateTaskRequest): Promise<TodoTask> {
    const response: AxiosResponse<ApiResponse<TodoTask>> = await this.client.post(`/api/v1/microsoft/lists/${listId}/tasks`, request)
    return response.data.data
  }

  async createTaskFromCode(request: CreateTaskFromCodeRequest): Promise<TodoTask> {
    const response: AxiosResponse<ApiResponse<TodoTask>> = await this.client.post('/api/v1/microsoft/tasks/from-code', request)
    return response.data.data
  }


  async updateTask(listId: string, taskId: string, request: Partial<CreateTaskRequest>): Promise<TodoTask> {
    const response: AxiosResponse<ApiResponse<TodoTask>> = await this.client.put(`/api/v1/microsoft/lists/${listId}/tasks/${taskId}`, request)
    return response.data.data
  }

  async deleteTask(listId: string, taskId: string): Promise<void> {
    await this.client.delete(`/api/v1/microsoft/lists/${listId}/tasks/${taskId}`)
  }

  // Sync-related methods
  async getSyncStatus(): Promise<TodoSyncStatus> {
    const response: AxiosResponse<ApiResponse<TodoSyncStatus>> = await this.client.get('/api/v1/microsoft/sync/status')
    return response.data.data
  }

  async syncWorkspace(workspaceId: string): Promise<void> {
    await this.client.post(`/api/v1/microsoft/sync/workspace/${workspaceId}`)
  }

  async syncAllWorkspaces(): Promise<void> {
    await this.client.post('/api/v1/microsoft/sync/all')
  }

  async refreshCache(): Promise<void> {
    await this.client.post('/api/v1/microsoft/sync/cache/refresh')
  }

  async healthCheck(): Promise<{ status: string; authenticated: boolean }> {
    const response: AxiosResponse<ApiResponse<{ status: string; authenticated: boolean }>> = await this.client.get('/api/v1/microsoft/health')
    return response.data.data
  }

}

export const microsoftAuthService = new MicrosoftAuthService()
export default microsoftAuthService