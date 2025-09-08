export interface User {
  id: string
  login: string
  name: string | null
  email: string | null
  avatar_url: string
}

export interface Workspace {
  id: string
  name: string
  path: string
  github_repo: string
  github_url: string
  local_path: string
  is_active: boolean
  last_sync_at?: string
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  workspace_id: string
  name: string
  created_at: string
  active: boolean
}

export interface TerminalSession {
  id: string
  pid: number
  cwd: string
  size: {
    cols: number
    rows: number
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  data: T
  error?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}