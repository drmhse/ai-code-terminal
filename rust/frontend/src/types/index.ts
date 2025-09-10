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
  session_name: string
  created_at: string
  active: boolean
  status: string
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

export interface FileItem {
  name: string
  path: string
  is_directory: boolean
  size: number
  modified_at: string
  extension?: string
  language?: string
}

export interface FileContent {
  path: string
  content: string
  encoding: string
  size: number
}

export interface DirectoryListing {
  path: string
  items: FileItem[]
  total_count: number
}

export interface EditorPosition {
  line: number
  column: number
}

export interface EditorSelection {
  start: EditorPosition
  end: EditorPosition
}

export interface EditorState {
  path: string
  content: string
  language: string
  is_modified: boolean
  selection?: EditorSelection
  cursor_position: EditorPosition
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