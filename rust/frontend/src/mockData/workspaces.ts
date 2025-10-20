import type { Workspace } from '@/types'

// Mock workspaces data - this array is mutable to allow for create/delete operations
export const mockWorkspaces: Workspace[] = [
  {
    id: 'workspace-1',
    name: 'AI Terminal Frontend',
    path: '/Users/demo/projects/ai-terminal',
    github_repo: 'demo/ai-terminal',
    github_url: 'https://github.com/demo/ai-terminal',
    local_path: '/Users/demo/projects/ai-terminal',
    is_active: true,
    last_sync_at: '2024-01-20T15:30:00Z',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T15:30:00Z'
  },
  {
    id: 'workspace-2',
    name: 'Documentation Site',
    path: '/Users/demo/projects/docs-site',
    github_repo: 'demo/docs-site',
    github_url: 'https://github.com/demo/docs-site',
    local_path: '/Users/demo/projects/docs-site',
    is_active: false,
    last_sync_at: '2024-01-19T12:00:00Z',
    created_at: '2024-01-10T09:00:00Z',
    updated_at: '2024-01-19T12:00:00Z'
  },
  {
    id: 'workspace-3',
    name: 'CLI Tools',
    path: '/Users/demo/projects/cli-tools',
    github_repo: 'demo/cli-tools',
    github_url: 'https://github.com/demo/cli-tools',
    local_path: '/Users/demo/projects/cli-tools',
    is_active: false,
    last_sync_at: '2024-01-18T18:45:00Z',
    created_at: '2024-01-08T14:20:00Z',
    updated_at: '2024-01-18T18:45:00Z'
  },
  {
    id: 'workspace-4',
    name: 'Vue Components',
    path: '/Users/demo/projects/vue-components',
    github_repo: 'demo/vue-components',
    github_url: 'https://github.com/demo/vue-components',
    local_path: '/Users/demo/projects/vue-components',
    is_active: false,
    last_sync_at: '2024-01-17T09:15:00Z',
    created_at: '2024-01-05T11:30:00Z',
    updated_at: '2024-01-17T09:15:00Z'
  }
]

// Helper functions for workspace operations
export const addWorkspace = (workspace: Workspace): void => {
  mockWorkspaces.push(workspace)
}

export const removeWorkspace = (id: string): boolean => {
  const index = mockWorkspaces.findIndex(w => w.id === id)
  if (index !== -1) {
    mockWorkspaces.splice(index, 1)
    return true
  }
  return false
}

export const findWorkspace = (id: string): Workspace | undefined => {
  return mockWorkspaces.find(w => w.id === id)
}

export const updateWorkspace = (id: string, updates: Partial<Workspace>): boolean => {
  const workspace = findWorkspace(id)
  if (workspace) {
    Object.assign(workspace, updates, { updated_at: new Date().toISOString() })
    return true
  }
  return false
}