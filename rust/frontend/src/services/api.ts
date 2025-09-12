import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type { ApiResponse, User, Workspace, Session } from '@/types'
import type { Repository } from '@/stores/workspace'
import type { FileItem } from '@/stores/file'
import type { ThemePreference } from '@/types/theme'
import type { AppStats } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'



interface DirectoryListing {
  path: string
  items: FileItem[]
  total_items: number
  hidden_items: number
}

// Layout types
interface LayoutConfiguration {
  type: string
  [key: string]: unknown
}

interface CreateLayoutRequest {
  name: string
  layout_type: string
  configuration: LayoutConfiguration
  is_default?: boolean
  workspace_id: string
}

interface UpdateLayoutRequest {
  name?: string
  configuration?: LayoutConfiguration
  is_default?: boolean
}

interface LayoutResponse {
  id: string
  name: string
  layout_type: string
  configuration: LayoutConfiguration
  is_default: boolean
  workspace_id: string
  created_at: string
  updated_at: string
}

// Process types
interface CreateProcessRequest {
  name: string
  command: string
  args?: string[]
  working_directory: string
  environment_variables?: Record<string, string>
  max_restarts?: number
  auto_restart?: boolean
  workspace_id?: string
  session_id?: string
  tags?: string[]
}

interface UpdateProcessRequest {
  name?: string
  command?: string
  args?: string[]
  working_directory?: string
  environment_variables?: Record<string, string>
  max_restarts?: number
  auto_restart?: boolean
  tags?: string[]
}

interface ProcessResponse {
  id: string
  name: string
  pid?: number
  command: string
  args?: string[]
  working_directory: string
  environment_variables?: Record<string, string>
  status: string
  exit_code?: number
  start_time: string
  end_time?: string
  cpu_usage: number
  memory_usage: number
  restart_count: number
  max_restarts: number
  auto_restart: boolean
  user_id: string
  workspace_id?: string
  session_id?: string
  tags?: string[]
  data?: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface EnhancedApiError extends Error {
  code: string
  details?: Record<string, unknown>
  status?: number
  isRetryable: boolean
  userMessage: string
  severity?: ErrorSeverity
}

// Error categorization
enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  SERVER = 'server',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

// Error severity levels
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

class ApiService {
  private client: AxiosInstance
  private uiStore: ReturnType<typeof useUIStore> | null = null

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
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

    // Response interceptor for enhanced error handling
    this.client.interceptors.response.use(
      (response) => {
        // Check if the API response indicates an error
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          if (!response.data.success) {
            const apiError = this.createErrorFromResponse(response.data)
            this.handleApiError(apiError)
            throw apiError
          }
        }
        return response
      },
      (error) => {
        const enhancedError = this.enhanceError(error)
        this.handleApiError(enhancedError)
        
        // Handle authentication errors
        if (error.response?.status === 401) {
          this.handleAuthenticationError()
        }
        
        return Promise.reject(enhancedError)
      }
    )
  }

  // Create enhanced error from Axios error
  private enhanceError(error: {
  response?: {
    data?: { code?: string; message?: string; error?: string }
    status?: number
  }
  code?: string
  message?: string
}): EnhancedApiError {
    
    // Network errors
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return this.createEnhancedError(
          'TIMEOUT_ERROR',
          'Request timeout',
          ErrorCategory.TIMEOUT,
          ErrorSeverity.MEDIUM,
          'The request took too long to complete. Please try again.',
          true
        )
      }
      
      if (error.message?.includes('Network Error')) {
        return this.createEnhancedError(
          'NETWORK_ERROR',
          'Network connection failed',
          ErrorCategory.NETWORK,
          ErrorSeverity.HIGH,
          'Unable to connect to the server. Please check your internet connection.',
          true
        )
      }
    }

    // HTTP errors
    const status = error.response?.status
    const data = error.response?.data as { message?: string; details?: unknown } || {}
    
    switch (status) {
      case 400:
        return this.createEnhancedError(
          'VALIDATION_ERROR',
          data.message || 'Invalid request',
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM,
          this.getValidationMessage(data),
          false
        )
        
      case 401:
        return this.createEnhancedError(
          'AUTHENTICATION_ERROR',
          'Authentication required',
          ErrorCategory.AUTHENTICATION,
          ErrorSeverity.HIGH,
          'Please log in to continue.',
          false
        )
        
      case 403:
        return this.createEnhancedError(
          'AUTHORIZATION_ERROR',
          'Access denied',
          ErrorCategory.AUTHORIZATION,
          ErrorSeverity.HIGH,
          'You do not have permission to perform this action.',
          false
        )
        
      case 404:
        return this.createEnhancedError(
          'NOT_FOUND_ERROR',
          'Resource not found',
          ErrorCategory.NOT_FOUND,
          ErrorSeverity.MEDIUM,
          'The requested resource could not be found.',
          false
        )
        
      case 429:
        return this.createEnhancedError(
          'RATE_LIMIT_ERROR',
          'Too many requests',
          ErrorCategory.RATE_LIMIT,
          ErrorSeverity.MEDIUM,
          'Too many requests. Please wait a moment before trying again.',
          true
        )
        
      case 500:
        return this.createEnhancedError(
          'SERVER_ERROR',
          'Internal server error',
          ErrorCategory.SERVER,
          ErrorSeverity.HIGH,
          'An internal server error occurred. Please try again later.',
          true
        )
        
      case 502:
      case 503:
      case 504:
        return this.createEnhancedError(
          'SERVICE_UNAVAILABLE',
          'Service unavailable',
          ErrorCategory.NETWORK,
          ErrorSeverity.HIGH,
          'The service is temporarily unavailable. Please try again later.',
          true
        )
        
      default:
        return this.createEnhancedError(
          'UNKNOWN_ERROR',
          data.message || 'An unexpected error occurred',
          ErrorCategory.UNKNOWN,
          ErrorSeverity.MEDIUM,
          'An unexpected error occurred. Please try again.',
          true
        )
    }
  }

  // Create error from API response
  private createErrorFromResponse(data: {
  code?: string
  error?: string
  message?: string
}): EnhancedApiError {
    return this.createEnhancedError(
      data.code || 'API_ERROR',
      data.error || 'API request failed',
      ErrorCategory.SERVER,
      ErrorSeverity.MEDIUM,
      data.message || 'The server returned an error. Please try again.',
      false
    )
  }

  // Create enhanced error with all properties
  private createEnhancedError(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    userMessage: string,
    isRetryable: boolean,
details?: Record<string, unknown>
  ): EnhancedApiError {
    const error = new Error(message) as EnhancedApiError
    error.code = code
    error.name = code
    error.details = details || undefined
    error.status = this.getStatusFromCategory(category)
    error.severity = severity
    error.isRetryable = isRetryable
    error.userMessage = userMessage
    return error
  }

  // Get HTTP status from error category
  private getStatusFromCategory(category: ErrorCategory): number {
    switch (category) {
      case ErrorCategory.VALIDATION:
        return 400
      case ErrorCategory.AUTHENTICATION:
        return 401
      case ErrorCategory.AUTHORIZATION:
        return 403
      case ErrorCategory.NOT_FOUND:
        return 404
      case ErrorCategory.RATE_LIMIT:
        return 429
      case ErrorCategory.SERVER:
        return 500
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return 0 // Network errors don't have HTTP status
      default:
        return 500
    }
  }

  // Get user-friendly validation message
  private getValidationMessage(data: {
  details?: unknown
}): string {
    if (data.details) {
      if (Array.isArray(data.details)) {
        return data.details.join(', ')
      }
      if (typeof data.details === 'object') {
        return Object.values(data.details).join(', ')
      }
      return String(data.details || '')
    }
    return (data as { message?: string }).message || 'Invalid request data'
  }

  // Handle API error with user notification
  private handleApiError(error: EnhancedApiError): void {
    const alertType = error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH 
      ? 'error' 
      : error.severity === ErrorSeverity.MEDIUM 
        ? 'warning' 
        : 'info'

    this.getUIStore().addResourceAlert({
      type: alertType,
      title: this.getErrorTitle(error),
      message: error.userMessage
    })

    // Log error for debugging
    console.error('API Error:', {
      code: error.code,
      message: error.message,
      category: error.name,
      
      details: error.details,
      stack: error.stack
    })
  }

  // Get error title based on error type
  private getErrorTitle(error: EnhancedApiError): string {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return 'Connection Error'
      case 'TIMEOUT_ERROR':
        return 'Request Timeout'
      case 'AUTHENTICATION_ERROR':
        return 'Authentication Required'
      case 'AUTHORIZATION_ERROR':
        return 'Access Denied'
      case 'VALIDATION_ERROR':
        return 'Invalid Input'
      case 'NOT_FOUND_ERROR':
        return 'Not Found'
      case 'RATE_LIMIT_ERROR':
        return 'Rate Limited'
      case 'SERVER_ERROR':
        return 'Server Error'
      case 'SERVICE_UNAVAILABLE':
        return 'Service Unavailable'
      default:
        return 'Error'
    }
  }

  // Lazy load the UI store when needed
  private getUIStore(): ReturnType<typeof useUIStore> {
    if (!this.uiStore) {
      this.uiStore = useUIStore()
    }
    return this.uiStore
  }

  // Handle authentication error
  private handleAuthenticationError(): void {
    localStorage.removeItem('jwt_token')
    localStorage.removeItem('user')
    
    this.getUIStore().addResourceAlert({
      type: 'error',
      title: 'Session Expired',
      message: 'Your session has expired. Please log in again.'
    })
    
    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
  }

  // Auth endpoints
  async getCurrentUser(): Promise<User> {
    const response: AxiosResponse<ApiResponse<any>> = await this.client.get('/api/v1/auth/me');
    const backendUser = response.data.data;
    const frontendUser: User = {
      id: backendUser.user_id,
      login: backendUser.username,
      name: backendUser.name || null,
      email: backendUser.email,
      avatar_url: backendUser.avatar_url
    };
    return frontendUser;
  }

  // Workspace endpoints
  async getWorkspaces(ownerId?: string): Promise<Workspace[]> {
    console.log('🚀 API: getWorkspaces called with ownerId:', ownerId)
    const params = ownerId ? { owner_id: ownerId } : undefined
    console.log('🔄 API: Making request to /api/v1/workspaces with params:', params)
    
    const response: AxiosResponse<ApiResponse<Workspace[]>> = await this.client.get('/api/v1/workspaces', { params })
    console.log('✅ API: Received response:', response.data)
    return response.data.data
  }

  async createWorkspace(name: string, path: string): Promise<Workspace> {
    const response: AxiosResponse<ApiResponse<Workspace>> = await this.client.post('/api/v1/workspaces', {
      name,
      path,
    })
    return response.data.data
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.client.delete(`/api/v1/workspaces/${id}`)
  }

  // Session endpoints
  async getSessions(workspaceId: string): Promise<Session[]> {
    if (!workspaceId) {
      throw new Error('Workspace ID is required for getSessions')
    }
    
    const response: AxiosResponse<ApiResponse<Session[]>> = await this.client.get(
      `/api/v1/workspaces/${workspaceId}/sessions`
    )
    return response.data.data
  }

  async getSessionHistory(sessionId: string): Promise<string[]> {
    const response: AxiosResponse<ApiResponse<string[]>> = await this.client.get(
      `/api/v1/sessions/${sessionId}/history`
    )
    return response.data.data
  }

  // Repository endpoints
  async getRepositories(page = 1, searchTerm = ''): Promise<{ repositories: Repository[], hasMore: boolean }> {
    const response = await this.client.get('/api/v1/github/repositories', {
      params: { page, search: searchTerm }
    })
    
    // Validate response structure
    if (!response.data || !response.data.data || !response.data.data.repositories) {
      throw new Error('Invalid response structure from repositories API')
    }
    
    return {
      repositories: response.data.data.repositories || [],
      hasMore: response.data.pagination?.has_more || false
    }
  }

  async cloneRepository(cloneUrl: string, name: string): Promise<Workspace> {
    interface CloneResponse {
      success: boolean
      workspace: Workspace | null
      message: string | null
    }
    
    const response: AxiosResponse<ApiResponse<CloneResponse>> = await this.client.post('/api/v1/github/clone', {
      git_url: cloneUrl,
      name
    })
    
    const cloneResult = response.data.data
    if (!cloneResult.success || !cloneResult.workspace) {
      throw new Error(cloneResult.message || 'Failed to clone repository')
    }
    
    return cloneResult.workspace
  }

  // File system endpoints
  async getDirectoryContents(path: string): Promise<FileItem[]> {
    const response: AxiosResponse<ApiResponse<DirectoryListing>> = await this.client.get('/api/v1/files', {
      params: { path }
    })
    // Extract items from DirectoryListing structure
    return response.data.data.items || []
  }

  // Workspace-specific file system endpoints
  async getWorkspaceDirectoryContents(workspaceId: string, path: string = ''): Promise<FileItem[]> {
    const response: AxiosResponse<ApiResponse<DirectoryListing>> = await this.client.get(`/api/v1/workspaces/${workspaceId}/files`, {
      params: { path }
    })
    // Extract items from DirectoryListing structure
    return response.data.data.items || []
  }

  async getFileContent(path: string): Promise<string> {
    const response: AxiosResponse<ApiResponse<{ content: string }>> = await this.client.get('/api/v1/files/content', {
      params: { path }
    })
    return response.data.data.content
  }

  // Workspace-specific file content endpoint
  async getWorkspaceFileContent(workspaceId: string, path: string): Promise<string> {
    const response: AxiosResponse<ApiResponse<{ content: string }>> = await this.client.get(`/api/v1/workspaces/${workspaceId}/files/content`, {
      params: { path }
    })
    return response.data.data.content
  }

  async saveFile(path: string, content: string, workspaceId?: string): Promise<void> {
    if (!workspaceId) {
      throw new Error('Workspace ID is required for file operations')
    }
    
    // Always use workspace-specific save endpoint
    await this.client.put(`/api/v1/workspaces/${workspaceId}/files/content`, {
      path,
      content
    })
  }

  async saveWorkspaceFile(workspaceId: string, path: string, content: string): Promise<void> {
    return this.saveFile(path, content, workspaceId)
  }

  async createFile(parentPath: string, name: string, content = ''): Promise<void> {
    await this.client.post('/api/v1/files', {
      path: `${parentPath}/${name}`,
      content,
      type: 'file'
    })
  }

  async createDirectory(parentPath: string, name: string): Promise<void> {
    await this.client.post('/api/v1/files', {
      path: `${parentPath}/${name}`,
      type: 'directory'
    })
  }

  async deleteFile(path: string): Promise<void> {
    await this.client.delete('/api/v1/files', {
      params: { path }
    })
  }

  async renameFile(oldPath: string, newName: string): Promise<void> {
    const pathParts = oldPath.split('/')
    pathParts[pathParts.length - 1] = newName
    const newPath = pathParts.join('/')
    
    await this.client.patch('/api/v1/files/rename', {
      oldPath,
      newPath
    })
  }

  // Theme preference endpoints
  async getCurrentTheme(): Promise<ThemePreference | null> {
    try {
      const response: AxiosResponse<ApiResponse<ThemePreference>> = await this.client.get('/api/v1/themes/current')
      return response.data.data
    } catch {
      return null
    }
  }

  async saveTheme(preferences: ThemePreference): Promise<void> {
    // Convert camelCase to snake_case for backend compatibility
    const backendPreferences = {
      theme_id: preferences.themeId,
      auto_switch: preferences.autoSwitch,
      system_override: preferences.systemOverride,
      customizations: preferences.customizations
    }
    await this.client.post('/api/v1/themes/current', backendPreferences)
  }

  // System stats endpoints
  async getSystemStats(): Promise<AppStats> {
    const response: AxiosResponse<ApiResponse<AppStats>> = await this.client.get('/api/v1/system/stats')
    return response.data.data
  }

  // Logout endpoint
  async logout(): Promise<void> {
    await this.client.post('/api/v1/auth/logout')
  }

  // Layout endpoints
  async getLayouts(workspaceId?: string): Promise<LayoutResponse[]> {
    const params = workspaceId ? { workspace_id: workspaceId } : undefined
    const response: AxiosResponse<ApiResponse<LayoutResponse[]>> = await this.client.get('/api/v1/layouts', { params })
    return response.data.data
  }

  async createLayout(layout: CreateLayoutRequest): Promise<LayoutResponse> {
    const response: AxiosResponse<ApiResponse<LayoutResponse>> = await this.client.post('/api/v1/layouts', layout)
    return response.data.data
  }

  async getLayout(id: string): Promise<LayoutResponse> {
    const response: AxiosResponse<ApiResponse<LayoutResponse>> = await this.client.get(`/api/v1/layouts/${id}`)
    return response.data.data
  }

  async updateLayout(id: string, layout: UpdateLayoutRequest): Promise<LayoutResponse> {
    const response: AxiosResponse<ApiResponse<LayoutResponse>> = await this.client.put(`/api/v1/layouts/${id}`, layout)
    return response.data.data
  }

  async deleteLayout(id: string): Promise<void> {
    await this.client.delete(`/api/v1/layouts/${id}`)
  }

  async setDefaultLayout(id: string): Promise<void> {
    await this.client.post(`/api/v1/layouts/${id}/default`)
  }

  async duplicateLayout(id: string, name?: string): Promise<LayoutResponse> {
    const response: AxiosResponse<ApiResponse<LayoutResponse>> = await this.client.post(`/api/v1/layouts/${id}/duplicate`, { name })
    return response.data.data
  }

  // Process endpoints (will be implemented when backend routes are ready)
  async getProcesses(workspaceId?: string, sessionId?: string, status?: string): Promise<ProcessResponse[]> {
    const params: Record<string, string> = {}
    if (workspaceId) params.workspace_id = workspaceId
    if (sessionId) params.session_id = sessionId
    if (status) params.status = status
    
    const response: AxiosResponse<ApiResponse<ProcessResponse[]>> = await this.client.get('/api/v1/processes', { params })
    return response.data.data
  }

  async createProcess(process: CreateProcessRequest): Promise<ProcessResponse> {
    const response: AxiosResponse<ApiResponse<ProcessResponse>> = await this.client.post('/api/v1/processes', process)
    return response.data.data
  }

  async getProcess(id: string): Promise<ProcessResponse> {
    const response: AxiosResponse<ApiResponse<ProcessResponse>> = await this.client.get(`/api/v1/processes/${id}`)
    return response.data.data
  }

  async updateProcess(id: string, process: UpdateProcessRequest): Promise<ProcessResponse> {
    const response: AxiosResponse<ApiResponse<ProcessResponse>> = await this.client.put(`/api/v1/processes/${id}`, process)
    return response.data.data
  }

  async deleteProcess(id: string): Promise<void> {
    await this.client.delete(`/api/v1/processes/${id}`)
  }

  async stopProcess(id: string): Promise<void> {
    await this.client.post(`/api/v1/processes/${id}/stop`)
  }

  async restartProcess(id: string): Promise<void> {
    await this.client.post(`/api/v1/processes/${id}/restart`)
  }

  async getProcessOutput(id: string): Promise<string> {
    const response: AxiosResponse<ApiResponse<{ output: string }>> = await this.client.get(`/api/v1/processes/${id}/output`)
    return response.data.data.output
  }
}

export const apiService = new ApiService()
export default apiService