// Mock process types
export interface MockProcess {
  id: string
  name: string
  pid?: number
  command: string
  args?: string[]
  working_directory: string
  environment_variables?: Record<string, string>
  status: 'Running' | 'Stopped' | 'Restarting' | 'Failed'
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

// Mock processes array - mutable to allow for create/update/delete operations
export const mockProcesses: MockProcess[] = [
  {
    id: 'process-1',
    name: 'Development Server',
    pid: 12345,
    command: 'npm',
    args: ['run', 'dev'],
    working_directory: '/home/demo/projects/ai-terminal',
    environment_variables: {
      NODE_ENV: 'development',
      PORT: '5173'
    },
    status: 'Running',
    start_time: '2024-01-20T09:00:00Z',
    cpu_usage: 15.5,
    memory_usage: 128.7,
    restart_count: 0,
    max_restarts: 3,
    auto_restart: true,
    user_id: 'mock-user-123',
    workspace_id: 'workspace-1',
    tags: ['development', 'frontend'],
    data: {
      url: 'http://localhost:5173',
      framework: 'Vite'
    },
    created_at: '2024-01-20T09:00:00Z',
    updated_at: '2024-01-20T10:30:00Z'
  },
  {
    id: 'process-2',
    name: 'Database Server',
    pid: 23456,
    command: 'postgres',
    args: ['-D', '/usr/local/var/postgres'],
    working_directory: '/usr/local/var/postgres',
    environment_variables: {
      PGDATA: '/usr/local/var/postgres'
    },
    status: 'Running',
    start_time: '2024-01-19T08:00:00Z',
    cpu_usage: 8.2,
    memory_usage: 256.3,
    restart_count: 0,
    max_restarts: 5,
    auto_restart: true,
    user_id: 'mock-user-123',
    workspace_id: 'workspace-1',
    tags: ['database', 'backend'],
    data: {
      port: 5432,
      version: '15.0'
    },
    created_at: '2024-01-19T08:00:00Z',
    updated_at: '2024-01-20T10:25:00Z'
  },
  {
    id: 'process-3',
    name: 'Redis Cache',
    pid: 34567,
    command: 'redis-server',
    args: [],
    working_directory: '/home/demo',
    environment_variables: {},
    status: 'Running',
    start_time: '2024-01-18T10:30:00Z',
    cpu_usage: 3.1,
    memory_usage: 64.2,
    restart_count: 1,
    max_restarts: 3,
    auto_restart: true,
    user_id: 'mock-user-123',
    workspace_id: 'workspace-1',
    tags: ['cache', 'database'],
    data: {
      port: 6379,
      clients: 3
    },
    created_at: '2024-01-18T10:30:00Z',
    updated_at: '2024-01-20T10:15:00Z'
  },
  {
    id: 'process-4',
    name: 'Build Process',
    pid: 45678,
    command: 'webpack',
    args: ['--mode', 'development', '--watch'],
    working_directory: '/home/demo/projects/vue-components',
    environment_variables: {
      NODE_ENV: 'development'
    },
    status: 'Stopped',
    exit_code: 0,
    start_time: '2024-01-20T07:45:00Z',
    end_time: '2024-01-20T09:15:00Z',
    cpu_usage: 0,
    memory_usage: 0,
    restart_count: 0,
    max_restarts: 2,
    auto_restart: false,
    user_id: 'mock-user-123',
    workspace_id: 'workspace-4',
    tags: ['build', 'frontend'],
    data: {
      bundle_size: '2.4MB',
      build_time: '4.2s'
    },
    created_at: '2024-01-20T07:45:00Z',
    updated_at: '2024-01-20T09:15:00Z'
  },
  {
    id: 'process-5',
    name: 'API Server',
    pid: 56789,
    command: 'python',
    args: ['-m', 'uvicorn', 'main:app', '--reload'],
    working_directory: '/home/demo/projects/docs-site',
    environment_variables: {
      PYTHONPATH: '.',
      ENV: 'development'
    },
    status: 'Failed',
    exit_code: 1,
    start_time: '2024-01-20T11:00:00Z',
    end_time: '2024-01-20T11:02:00Z',
    cpu_usage: 0,
    memory_usage: 0,
    restart_count: 2,
    max_restarts: 3,
    auto_restart: true,
    user_id: 'mock-user-123',
    workspace_id: 'workspace-2',
    tags: ['api', 'backend', 'python'],
    data: {
      error: 'ModuleNotFoundError: No module named \'fastapi\'',
      port: 8000
    },
    created_at: '2024-01-20T11:00:00Z',
    updated_at: '2024-01-20T11:02:00Z'
  }
]

// Helper functions for process operations
export const addProcess = (process: MockProcess): void => {
  mockProcesses.push(process)
}

export const removeProcess = (id: string): boolean => {
  const index = mockProcesses.findIndex(p => p.id === id)
  if (index !== -1) {
    mockProcesses.splice(index, 1)
    return true
  }
  return false
}

export const findProcess = (id: string): MockProcess | undefined => {
  return mockProcesses.find(p => p.id === id)
}

export const updateProcess = (id: string, updates: Partial<MockProcess>): boolean => {
  const process = findProcess(id)
  if (process) {
    Object.assign(process, updates, { updated_at: new Date().toISOString() })
    return true
  }
  return false
}

// Get processes filtered by workspace, session, or status
export const getProcesses = (
  workspaceId?: string,
  sessionId?: string,
  status?: string
): MockProcess[] => {
  return mockProcesses.filter(process => {
    if (workspaceId && process.workspace_id !== workspaceId) {
      return false
    }
    if (sessionId && process.session_id !== sessionId) {
      return false
    }
    if (status && process.status !== status) {
      return false
    }
    return true
  })
}

// Simulate real-time process stats updates
export const simulateProcessStatsUpdate = (): void => {
  mockProcesses.forEach(process => {
    if (process.status === 'Running') {
      // Simulate slight CPU and memory fluctuations
      process.cpu_usage = Math.max(0, Math.min(100, process.cpu_usage + (Math.random() - 0.5) * 10))
      process.memory_usage = Math.max(0, Math.min(1000, process.memory_usage + (Math.random() - 0.5) * 20))
      process.updated_at = new Date().toISOString()
    }
  })
}

// Simulate process failure and restart
export const simulateProcessFailure = (id: string): boolean => {
  const process = findProcess(id)
  if (process && process.status === 'Running') {
    process.status = 'Failed'
    process.exit_code = Math.floor(Math.random() * 10) + 1
    process.end_time = new Date().toISOString()
    process.cpu_usage = 0
    process.memory_usage = 0
    process.updated_at = new Date().toISOString()

    // Auto-restart if enabled
    if (process.auto_restart && process.restart_count < process.max_restarts) {
      setTimeout(() => {
        simulateProcessRestart(id)
      }, 2000)

      return true
    }
  }
  return false
}

// Simulate process restart
export const simulateProcessRestart = (id: string): boolean => {
  const process = findProcess(id)
  if (process) {
    process.status = 'Restarting'
    process.restart_count += 1
    process.updated_at = new Date().toISOString()

    setTimeout(() => {
      process.status = 'Running'
      process.start_time = new Date().toISOString()
      process.end_time = undefined
      process.exit_code = undefined
      process.pid = Math.floor(Math.random() * 50000) + 10000
      process.cpu_usage = Math.random() * 20
      process.memory_usage = Math.random() * 300 + 50
      process.updated_at = new Date().toISOString()
    }, 1000)

    return true
  }
  return false
}

// Get process output (mock implementation)
export const getProcessOutput = (id: string): string => {
  const process = findProcess(id)
  if (!process) {
    return 'Process not found'
  }

  // Generate mock output based on command
  switch (process.command) {
    case 'npm':
      if (process.args?.includes('dev')) {
        return `> ${process.data?.framework || 'Vite'} v5.0.0 ready in 245 ms\n\n  ➜  Local:   http://localhost:${process.data?.port || 5173}/\n  ➜  Network: use --host to expose\n  ➜  press h + enter to show help`
      }
      return 'npm command executed'

    case 'python':
      if (process.args?.includes('uvicorn')) {
        return `INFO:     Uvicorn running on http://127.0.0.1:${process.data?.port || 8000}\nINFO:     Started reloader process [1]\nINFO:     Started server process [${process.pid}]`
      }
      return 'Python process running'

    case 'redis-server':
      return `* Server initialized\n* Ready to accept connections on port ${process.data?.port || 6379}\n* PID: ${process.pid}`

    case 'postgres':
      return `LOG:  database system is ready to accept connections\nLOG:  autovacuum launcher started\nLOG:  database system is ready to accept connections`

    case 'webpack':
      return `webpack compiled successfully\n${process.data?.bundle_size || '2.4MB'} built in ${process.data?.build_time || '4.2s'}`

    default:
      return `Process ${process.name} is ${process.status.toLowerCase()}\nPID: ${process.pid}\nCommand: ${process.command} ${process.args?.join(' ') || ''}\nWorking Directory: ${process.working_directory}`
  }
}

// Create a new process
export const createProcess = (
  name: string,
  command: string,
  args: string[] = [],
  workingDirectory: string,
  options: {
    workspaceId?: string
    sessionId?: string
    autoRestart?: boolean
    maxRestarts?: number
    environmentVariables?: Record<string, string>
    tags?: string[]
  } = {}
): MockProcess => {
  const newProcess: MockProcess = {
    id: `process-${Date.now()}`,
    name,
    pid: Math.floor(Math.random() * 50000) + 10000,
    command,
    args,
    working_directory: workingDirectory,
    environment_variables: options.environmentVariables || {},
    status: 'Running',
    start_time: new Date().toISOString(),
    cpu_usage: Math.random() * 20,
    memory_usage: Math.random() * 200 + 50,
    restart_count: 0,
    max_restarts: options.maxRestarts || 3,
    auto_restart: options.autoRestart ?? true,
    user_id: 'mock-user-123',
    workspace_id: options.workspaceId,
    session_id: options.sessionId,
    tags: options.tags,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  addProcess(newProcess)
  return newProcess
}