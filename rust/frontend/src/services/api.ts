import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type { ApiResponse, User, Workspace, Session } from '@/types'
import type { Repository } from '@/stores/workspace'
import type { FileItem } from '@/stores/file'
import type { ThemePreference } from '@/types/theme'
import type { AppStats } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

interface ApiError {
  code: string
  message: string
  details?: any
  status?: number
}

interface EnhancedApiError extends Error {
  code: string
  details?: any
  status?: number
  isRetryable: boolean
  userMessage: string
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
  private uiStore = useUIStore()

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
  private enhanceError(error: any): EnhancedApiError {
    const uiStore = useUIStore()
    
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
      
      if (error.message.includes('Network Error')) {
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
    const data = error.response?.data || {}
    
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
  private createErrorFromResponse(data: any): EnhancedApiError {
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
    details?: any
  ): EnhancedApiError {
    const error = new Error(message) as EnhancedApiError
    error.code = code
    error.name = code
    error.details = details
    error.status = this.getStatusFromCategory(category)
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
  private getValidationMessage(data: any): string {
    if (data.details) {
      if (Array.isArray(data.details)) {
        return data.details.join(', ')
      }
      if (typeof data.details === 'object') {
        return Object.values(data.details).join(', ')
      }
      return String(data.details)
    }
    return data.message || 'Invalid request data'
  }

  // Handle API error with user notification
  private handleApiError(error: EnhancedApiError): void {
    const alertType = error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH 
      ? 'error' 
      : error.severity === ErrorSeverity.MEDIUM 
        ? 'warning' 
        : 'info'

    this.uiStore.addResourceAlert({
      type: alertType,
      title: this.getErrorTitle(error),
      message: error.userMessage
    })

    // Log error for debugging
    console.error('API Error:', {
      code: error.code,
      message: error.message,
      category: error.name,
      severity: error.severity,
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

  // Handle authentication error
  private handleAuthenticationError(): void {
    localStorage.removeItem('jwt_token')
    localStorage.removeItem('user')
    
    this.uiStore.addResourceAlert({
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
    const response: AxiosResponse<ApiResponse<User>> = await this.client.get('/api/v1/auth/me')
    return response.data.data
  }

  // Workspace endpoints
  async getWorkspaces(ownerId?: string): Promise<Workspace[]> {
    const params = ownerId ? { owner_id: ownerId } : undefined
    const response: AxiosResponse<ApiResponse<Workspace[]>> = await this.client.get('/api/v1/workspaces', { params })
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
    const response: AxiosResponse<ApiResponse<Workspace>> = await this.client.post('/api/v1/github/clone', {
      clone_url: cloneUrl,
      name
    })
    return response.data.data
  }

  // File system endpoints
  async getDirectoryContents(path: string): Promise<FileItem[]> {
    const response: AxiosResponse<ApiResponse<FileItem[]>> = await this.client.get('/api/v1/files', {
      params: { path }
    })
    return response.data.data
  }

  // Workspace-specific file system endpoints
  async getWorkspaceDirectoryContents(workspaceId: string, path: string = ''): Promise<FileItem[]> {
    const response: AxiosResponse<ApiResponse<FileItem[]>> = await this.client.get(`/api/v1/workspaces/${workspaceId}/files`, {
      params: { path }
    })
    return response.data.data
  }

  async getFileContent(path: string): Promise<string> {
    const response: AxiosResponse<ApiResponse<{ content: string }>> = await this.client.get('/api/v1/files/content', {
      params: { path }
    })
    return response.data.data.content
  }

  async saveFile(path: string, content: string): Promise<void> {
    await this.client.put('/api/v1/files/content', {
      path,
      content
    })
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
    } catch (err) {
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
}

export const apiService = new ApiService()
export default apiService