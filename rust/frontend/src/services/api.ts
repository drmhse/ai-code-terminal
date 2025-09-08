import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type { ApiResponse, User, Workspace, Session } from '@/types'
import type { Repository } from '@/stores/workspace'
import type { FileItem } from '@/stores/file'
import type { ThemePreference } from '@/types/theme'
import type { AppStats } from '@/stores/auth'

class ApiService {
  private client: AxiosInstance

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

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        // Check if the API response indicates an error
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          if (!response.data.success) {
            throw new Error(response.data.error || 'API request failed')
          }
        }
        return response
      },
      (error) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          localStorage.removeItem('jwt_token')
          localStorage.removeItem('user')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth endpoints
  async getCurrentUser(): Promise<User> {
    const response: AxiosResponse<ApiResponse<User>> = await this.client.get('/api/v1/auth/me')
    return response.data.data
  }

  // Workspace endpoints
  async getWorkspaces(): Promise<Workspace[]> {
    const response: AxiosResponse<ApiResponse<Workspace[]>> = await this.client.get('/api/v1/workspaces')
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

  // Repository endpoints
  async getRepositories(page = 1, searchTerm = ''): Promise<{ repositories: Repository[], hasMore: boolean }> {
    const response: AxiosResponse<ApiResponse<{ repositories: Repository[], hasMore: boolean }>> = 
      await this.client.get('/api/v1/github/repositories', {
        params: { page, search: searchTerm }
      })
    return {
      repositories: response.data.data.repositories,
      hasMore: response.data.pagination.has_more
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