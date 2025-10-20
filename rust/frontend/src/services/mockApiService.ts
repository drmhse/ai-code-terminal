import type { Workspace, Session } from '@/types'

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Repository } from '@/stores/workspace'
import type { FileItem } from '@/stores/file'
import type { ThemePreference } from '@/types/theme'
import type { AppStats } from '@/stores/auth'
import type { UserPreferences } from '@/types/layout'

// Import mock data
import { mockWorkspaces, addWorkspace as addMockWorkspace, removeWorkspace as removeMockWorkspace } from '@/mockData/workspaces'


interface DirectoryEntry {
  name: string
  path: string
  is_directory: boolean
  is_hidden: boolean
}

interface BrowseDirectoryResponse {
  current_path: string
  parent_path: string | null
  entries: DirectoryEntry[]
}

interface CreateLayoutRequest {
  name: string
  layout_type: string
  tree_structure: string
  is_default?: boolean
  workspace_id: string
}

interface SaveLayoutRequest {
  name: string
  layout_type: string
  tree_structure: string
  is_default?: boolean
  workspace_id: string
}

interface UpdateLayoutRequest {
  name?: string
  tree_structure?: string
  is_default?: boolean
}

interface LayoutResponse {
  id: string
  name: string
  layout_type: string
  tree_structure: string
  is_default: boolean
  workspace_id: string
  created_at: string
  updated_at: string
}

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

// Helper function to simulate network delay
const delay = (ms: number = 200): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

// Helper function to simulate random failures (10% chance)
const randomFailure = (): boolean => Math.random() < 0.1

export const mockApiService = {
  // Workspace endpoints
  async getWorkspaces(): Promise<Workspace[]> {
    await delay(300)

    if (randomFailure()) {
      throw new Error('Failed to fetch workspaces')
    }

    return [...mockWorkspaces]
  },

  async createWorkspace(name: string, path: string): Promise<Workspace> {
    await delay(500)

    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name,
      path,
      github_repo: '',
      github_url: '',
      local_path: path,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    addMockWorkspace(newWorkspace)
    return newWorkspace
  },

  async createEmptyWorkspace(options: {
    name: string
    description?: string
    path?: string
  }): Promise<Workspace> {
    await delay(400)

    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name: options.name,
      path: options.path || `/mock/path/${options.name}`,
      github_repo: '',
      github_url: '',
      local_path: options.path || `/mock/path/${options.name}`,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    addMockWorkspace(newWorkspace)
    return newWorkspace
  },

  async openFolder(options: {
    name: string
    path: string
  }): Promise<Workspace> {
    await delay(600)

    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name: options.name,
      path: options.path,
      github_repo: '',
      github_url: '',
      local_path: options.path,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    addMockWorkspace(newWorkspace)
    return newWorkspace
  },

  async deleteWorkspace(id: string): Promise<void> {
    await delay(300)

    if (randomFailure()) {
      throw new Error('Failed to delete workspace')
    }

    const success = removeMockWorkspace(id)
    if (!success) {
      throw new Error('Workspace not found')
    }
  },

  // Session endpoints
  async getAllSessions(): Promise<Session[]> {
    await delay(250)

    const mockSessions: Session[] = [
      {
        id: 'session-1',
        workspace_id: 'workspace-1',
        name: 'Main Terminal',
        session_name: 'zsh',
        created_at: '2024-01-20T10:00:00Z',
        active: true,
        status: 'running',
        pid: 12345,
        cwd: '/Users/demo/projects/ai-terminal',
        size: { cols: 80, rows: 24 }
      }
    ]

    return mockSessions
  },

  async getSessions(workspaceId: string): Promise<Session[]> {
    await delay(200)

    if (!workspaceId) {
      throw new Error('Workspace ID is required for getSessions')
    }

    return []
  },

  async getSessionBuffer(sessionId: string): Promise<string> {
    await delay(150)
    return 'Mock terminal buffer content'
  },

  async getSessionHistory(_sessionId: string): Promise<string> {
    await delay(150)
    return 'Mock terminal history'
  },

  // Repository endpoints
  async getRepositories(page = 1, searchTerm = ''): Promise<{ repositories: Repository[], hasMore: boolean }> {
    await delay(800) // Simulate slower GitHub API

    // Generate mock repositories
    const repositories: Repository[] = []
    const startIndex = (page - 1) * 10
    const endIndex = startIndex + 10

    for (let i = startIndex; i < endIndex; i++) {
      const repoName = searchTerm ? `${searchTerm}-repo-${i}` : `mock-repo-${i}`
      repositories.push({
        id: i,
        name: repoName,
        full_name: `demo/${repoName}`,
        description: `Mock repository ${i} for testing purposes`,
        html_url: `https://github.com/demo/${repoName}`,
        clone_url: `https://github.com/demo/${repoName}.git`,
        ssh_url: `git@github.com:demo/${repoName}.git`,
        private: false,
        fork: false,
        updated_at: '2024-01-20T12:00:00Z',
        language: 'TypeScript',
        stargazers_count: Math.floor(Math.random() * 1000),
        forks_count: Math.floor(Math.random() * 500),
        size: Math.floor(Math.random() * 10000),
        default_branch: 'main',
        pushed_at: '2024-01-19T15:30:00Z',
        owner: {
          id: 1,
          login: 'demo',
          name: 'Demo User',
          email: 'demo@example.com',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
          html_url: 'https://github.com/demo',
          company: 'Demo Company',
          location: 'Demo City',
          public_repos: 50,
          followers: 100,
          following: 50
        }
      })
    }

    return {
      repositories,
      hasMore: page < 5 // Mock pagination - 5 pages max
    }
  },

  async cloneRepository(cloneUrl: string, name: string): Promise<Workspace> {
    // Simulate the cloning process with progress
    await delay(1000) // Initial delay

    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name,
      path: `/mock/cloned/${name}`,
      github_repo: cloneUrl.split('/').pop()?.replace('.git', '') || name,
      github_url: cloneUrl,
      local_path: `/mock/cloned/${name}`,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return newWorkspace
  },

  // File system endpoints (basic implementation)
  async getDirectoryContents(path: string): Promise<FileItem[]> {
    await delay(200)
    return []
  },

  async getWorkspaceDirectoryContents(_workspaceId: string, _path: string = ''): Promise<FileItem[]> {
    await delay(250)

    // Mock file structure - will be replaced with comprehensive mock file system
    const mockFiles: FileItem[] = [
      {
        name: 'src',
        path: '/mock/src',
        is_directory: true,
        size: 0,
        modified_at: '2024-01-20T10:00:00Z',
        type: 'directory',
        isHidden: false
      },
      {
        name: 'package.json',
        path: '/mock/package.json',
        is_directory: false,
        size: 1024,
        modified_at: '2024-01-20T10:00:00Z',
        extension: 'json',
        language: 'json',
        type: 'file',
        isHidden: false
      },
      {
        name: 'README.md',
        path: '/mock/README.md',
        is_directory: false,
        size: 2048,
        modified_at: '2024-01-20T10:00:00Z',
        extension: 'md',
        language: 'markdown',
        type: 'file',
        isHidden: false
      }
    ]

    return mockFiles
  },

  async getFileContent(path: string): Promise<string> {
    await delay(150)

    // Return mock content based on file extension
    if (path.endsWith('.json')) {
      return JSON.stringify({ name: 'mock-project', version: '1.0.0' }, null, 2)
    } else if (path.endsWith('.md')) {
      return '# Mock Project\n\nThis is a mock project for demonstration purposes.'
    } else if (path.endsWith('.ts') || path.endsWith('.js')) {
      return '// Mock TypeScript file\nconsole.log("Hello, World!");'
    }

    return 'Mock file content'
  },

  async getWorkspaceFileContent(_workspaceId: string, path: string): Promise<string> {
    await delay(150)
    return this.getFileContent(path)
  },

  async saveFile(path: string, _content: string, _workspaceId?: string): Promise<void> {
    await delay(200)

    if (randomFailure()) {
      throw new Error('Failed to save file')
    }
  },

  async saveWorkspaceFile(workspaceId: string, path: string, content: string): Promise<void> {
    return this.saveFile(path, content, workspaceId)
  },

  async createFile(_parentPath: string, _name: string, _content = '', _workspaceId?: string): Promise<void> {
    await delay(300)
  },

  async createDirectory(_parentPath: string, _name: string, _workspaceId?: string): Promise<void> {
    await delay(300)
  },

  async deleteFile(_path: string, _workspaceId?: string): Promise<void> {
    await delay(250)
  },

  async renameFile(_oldPath: string, _newName: string, _workspaceId?: string): Promise<void> {
    await delay(200)
  },

  async moveFile(_fromPath: string, _toPath: string, _workspaceId?: string): Promise<void> {
    await delay(300)
  },

  async copyFile(_fromPath: string, _toPath: string, _recursive: boolean = true, _workspaceId?: string): Promise<void> {
    await delay(400)
  },

  // Theme preference endpoints (using localStorage)
  async getCurrentTheme(): Promise<ThemePreference | null> {
    await delay(100)

    const stored = localStorage.getItem('theme-preferences')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    }

    return null
  },

  async saveTheme(preferences: ThemePreference): Promise<void> {
    await delay(100)
    localStorage.setItem('theme-preferences', JSON.stringify(preferences))
  },

  // User preferences endpoints (using localStorage)
  async getUserPreferences(): Promise<UserPreferences | null> {
    await delay(100)

    const stored = localStorage.getItem('user-preferences')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    }

    return {
      currentWorkspaceId: null,
      layoutPreferences: {
        sidebarWidth: 250,
        editorWidth: 400,
        version: '1.0'
      }
    }
  },

  async updateUserPreferences(preferences: UserPreferences): Promise<void> {
    await delay(100)
    localStorage.setItem('user-preferences', JSON.stringify(preferences))
  },

  async setCurrentWorkspace(workspaceId: string | null): Promise<void> {
    await delay(100)

    const currentPrefs = await this.getUserPreferences()
    const preferences: UserPreferences = {
      currentWorkspaceId: workspaceId,
      layoutPreferences: currentPrefs?.layoutPreferences || {
        sidebarWidth: 250,
        editorWidth: 400,
        version: '1.0'
      }
    }

    await this.updateUserPreferences(preferences)
  },

  // System stats endpoints
  async getSystemStats(): Promise<AppStats> {
    await delay(200)

    return {
      system: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk: Math.random() * 100,
        uptime: Math.floor(Math.random() * 86400)
      },
      sessions: {
        active: Math.floor(Math.random() * 10) + 1,
        total: Math.floor(Math.random() * 50) + 10
      },
      workspaces: {
        count: Math.floor(Math.random() * 5) + 1
      }
    }
  },

  async browseDirectory(path?: string): Promise<BrowseDirectoryResponse> {
    await delay(300)

    const entries: DirectoryEntry[] = [
      {
        name: 'Documents',
        path: '/Users/demo/Documents',
        is_directory: true,
        is_hidden: false
      },
      {
        name: 'Downloads',
        path: '/Users/demo/Downloads',
        is_directory: true,
        is_hidden: false
      },
      {
        name: 'Projects',
        path: '/Users/demo/Projects',
        is_directory: true,
        is_hidden: false
      }
    ]

    return {
      current_path: path || '/Users/demo',
      parent_path: path ? '/Users/demo' : null,
      entries
    }
  },

  // Logout endpoint
  async logout(): Promise<void> {
    await delay(200)
  },

  // Layout endpoints (basic implementation)
  async getLayouts(workspaceId?: string): Promise<LayoutResponse[]> {
    await delay(200)
    return []
  },

  async createLayout(layout: CreateLayoutRequest): Promise<LayoutResponse> {
    await delay(300)

    const newLayout: LayoutResponse = {
      id: `layout-${Date.now()}`,
      name: layout.name,
      layout_type: layout.layout_type,
      tree_structure: layout.tree_structure,
      is_default: layout.is_default || false,
      workspace_id: layout.workspace_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return newLayout
  },

  async getLayout(_id: string): Promise<LayoutResponse> {
    await delay(150)
    throw new Error('Layout not found')
  },

  async updateLayout(_id: string, _layout: UpdateLayoutRequest): Promise<LayoutResponse> {
    await delay(250)
    throw new Error('Layout not found')
  },

  async deleteLayout(_id: string): Promise<void> {
    await delay(200)
  },

  async setDefaultLayout(_id: string): Promise<void> {
    await delay(200)
  },

  async duplicateLayout(_id: string, _name?: string): Promise<LayoutResponse> {
    await delay(300)
    throw new Error('Layout not found')
  },

  async saveLayout(layout: SaveLayoutRequest): Promise<LayoutResponse> {
    await delay(300)

    const newLayout: LayoutResponse = {
      id: `layout-${Date.now()}`,
      name: layout.name,
      layout_type: layout.layout_type,
      tree_structure: layout.tree_structure,
      is_default: layout.is_default || false,
      workspace_id: layout.workspace_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return newLayout
  },

  // Process endpoints (basic implementation)
  async getProcesses(_workspaceId?: string, _sessionId?: string, _status?: string): Promise<ProcessResponse[]> {
    await delay(200)
    return []
  },

  async createProcess(process: CreateProcessRequest): Promise<ProcessResponse> {
    await delay(400)

    const newProcess: ProcessResponse = {
      id: `process-${Date.now()}`,
      name: process.name,
      pid: Math.floor(Math.random() * 10000) + 1000,
      command: process.command,
      args: process.args,
      working_directory: process.working_directory,
      environment_variables: process.environment_variables,
      status: 'Running',
      start_time: new Date().toISOString(),
      cpu_usage: 0,
      memory_usage: 0,
      restart_count: 0,
      max_restarts: process.max_restarts || 3,
      auto_restart: process.auto_restart || false,
      user_id: 'mock-user',
      workspace_id: process.workspace_id,
      session_id: process.session_id,
      tags: process.tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return newProcess
  },

  async getProcess(_id: string): Promise<ProcessResponse> {
    await delay(150)
    throw new Error('Process not found')
  },

  async updateProcess(_id: string, _process: UpdateProcessRequest): Promise<ProcessResponse> {
    await delay(250)
    throw new Error('Process not found')
  },

  async deleteProcess(_id: string): Promise<void> {
    await delay(200)
  },

  async stopProcess(_id: string): Promise<void> {
    await delay(200)
  },

  async restartProcess(_id: string): Promise<void> {
    await delay(300)
  },

  async getProcessOutput(_id: string): Promise<string> {
    await delay(150)
    return 'Mock process output'
  }
}