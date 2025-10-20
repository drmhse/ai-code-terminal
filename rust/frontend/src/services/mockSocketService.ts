import { Subject, BehaviorSubject, type Subscription } from '@/utils/reactive'
import {
  ConnectionState,
  type TerminalOutputEvent,
  type TerminalCreatedEvent,
  type TerminalDestroyedEvent,
  type StatsDataEvent,
  type WebSocketAuthErrorEvent,
  type ConnectionStateEvent,
  type SocketEventMap
} from '@/types/socket'

// Import types from real socket service
import type {
  WorkspaceSession,
  WorkspaceSessionsEvent,
  SessionRecoveredEvent,
  ReconnectionFailedEvent
} from './realSocketService'

// Import file system utilities
import { findNode, getChildren } from '@/mockData/fileSystemUtils'

// Helper function to simulate network delay
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))


let currentMockPath = '/home/demo'

// Terminal state management
const terminalState = new Map<string, {
  currentLine: string
  prompt: string
}>()

const getTerminalState = (sessionId: string) => {
  if (!terminalState.has(sessionId)) {
    terminalState.set(sessionId, {
      currentLine: '',
      prompt: `demo@mock-terminal:${currentMockPath}$ `
    })
  }
  return terminalState.get(sessionId)!
}

const updatePrompt = (sessionId: string) => {
  const state = terminalState.get(sessionId)
  if (state) {
    state.prompt = `demo@mock-terminal:${currentMockPath}$ `
  }
}

// Command interpreter for mock terminal
const interpretCommand = (command: string): { output: string[], dirChanged: boolean } => {
  const trimmedCommand = command.trim()
  const parts = trimmedCommand.split(' ')
  const cmd = parts[0]
  const args = parts.slice(1)

  const output: string[] = []
  let dirChanged = false

  switch (cmd) {
    case 'ls':
      const showAll = args.includes('-a') || args.includes('-la')
      const showLong = args.includes('-l') || args.includes('-la')
      const targetPath = args.find(arg => !arg.startsWith('-')) || currentMockPath

      const dir = findNode(targetPath)
      if (dir && dir.type === 'directory') {
        const children = getChildren(targetPath)
        const items = children
          .filter(item => showAll || !item.isHidden)
          .map(item => {
            if (showLong) {
              const isDir = item.is_directory
              const permissions = isDir ? 'drwxr-xr-x' : '-rw-r--r--'
              const size = isDir ? '4096' : item.size.toString()
              return `${permissions} 1 demo staff ${size} Jan 20 10:00 ${item.name}`
            }
            return item.name
          })
        output.push(...items)
      } else {
        output.push(`ls: cannot access '${targetPath}': No such file or directory`)
      }
      break

    case 'pwd':
      output.push(currentMockPath)
      break

    case 'cd':
      if (args.length === 0) {
        currentMockPath = '/home/demo'
        dirChanged = true
      } else {
        const targetPath = args[0].startsWith('/') ? args[0] : `${currentMockPath}/${args[0]}`
        const normalizedPath = targetPath.replace(/\/+/g, '/')

        const node = findNode(normalizedPath)
        if (node && node.type === 'directory') {
          currentMockPath = normalizedPath
          dirChanged = true
          // Don't output anything for successful cd (like real shells)
        } else {
          output.push(`cd: ${args[0]}: No such file or directory`)
        }
      }
      break

    case 'cat':
      if (args.length === 0) {
        output.push('cat: missing file operand')
        output.push('Try \'cat --help\' for more information.')
      } else {
        const filePath = args[0].startsWith('/') ? args[0] : `${currentMockPath}/${args[0]}`
        const file = findNode(filePath)
        if (file && file.type === 'file') {
          output.push(file.content || '')
        } else {
          output.push(`cat: ${args[0]}: No such file or directory`)
        }
      }
      break

    case 'echo':
      output.push(args.join(' '))
      break

    case 'whoami':
      output.push('demo')
      break

    case 'date':
      output.push(new Date().toString())
      break

    case 'clear':
      // Return empty array to simulate clear command
      return { output: [], dirChanged: false }

    case 'help':
      output.push('Available commands in mock terminal:')
      output.push('  ls [-la] [path]  - List directory contents')
      output.push('  pwd              - Print working directory')
      output.push('  cd [path]        - Change directory')
      output.push('  cat [file]       - Display file contents')
      output.push('  echo [text]      - Echo text')
      output.push('  whoami           - Display current user')
      output.push('  date             - Display current date and time')
      output.push('  clear            - Clear terminal screen')
      output.push('  help             - Show this help message')
      break

    case 'git':
      if (args[0] === 'status') {
        output.push('On branch main')
        output.push('Your branch is up to date with \'origin/main\'.')
        output.push('')
        output.push('Changes to be committed:')
        output.push('  (use "git restore --staged <file>..." to unstage)')
        output.push('        modified:   src/mockData/workspaces.ts')
        output.push('')
        output.push('Changes not staged for commit:')
        output.push('  (use "git add <file>..." to update what will be committed)')
        output.push('  (use "git restore <file>..." to discard changes in working directory)')
        output.push('        modified:   README.md')
      } else if (args[0] === 'log' && args.includes('--oneline')) {
        output.push('a1b2c3d (HEAD -> main, origin/main) Latest commit')
        output.push('d4e5f6g Previous commit')
        output.push('h7i8j9k Initial commit')
      } else {
        output.push(`git: '${args[0]}' is not a git command. See 'git --help'.`)
      }
      break

    case 'npm':
      if (args[0] === 'run' && args[1] === 'dev') {
        output.push('  > ai-terminal@1.0.0 dev')
        output.push('  > vite')
        output.push('')
        output.push('  VITE v5.0.0  ready in 250 ms')
        output.push('')
        output.push('  ➜  Local:   http://localhost:5173/')
        output.push('  ➜  Network: use --host to expose')
        output.push('  ➜  press h + enter to show help')
      } else {
        output.push(`npm: missing script: ${args[1] || 'unknown'}`)
      }
      break

    default:
      output.push(`zsh: command not found: ${cmd}`)
  }

  return { output, dirChanged }
}

export const mockSocketService = {
  // State management
  connectionState$: new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED),
  terminalOutput$: new Subject<TerminalOutputEvent>(),
  terminalCreated$: new Subject<TerminalCreatedEvent>(),
  terminalDestroyed$: new Subject<TerminalDestroyedEvent>(),
  statsData$: new Subject<StatsDataEvent>(),
  authError$: new Subject<WebSocketAuthErrorEvent>(),
  workspaceSessions$: new Subject<WorkspaceSessionsEvent>(),
  sessionRecovered$: new Subject<SessionRecoveredEvent>(),
  reconnectionFailed$: new Subject<ReconnectionFailedEvent>(),
  taskExecutionStarted$: new Subject<{ taskId: string; taskData: Record<string, unknown> }>(),
  taskExecutionOutput$: new Subject<{ taskId: string; output: string }>(),
  taskExecutionStatus$: new Subject<{ taskId: string; status: string; result?: unknown }>(),
  taskExecutionError$: new Subject<{ taskId: string; error: string }>(),
  taskExecutionCancelled$: new Subject<{ taskId: string }>(),

  // Internal state
  terminals: new Map<string, { pid: number; workspaceId: string }>(),
  statsInterval: null as number | null,

  async connect(): Promise<void> {
    await delay(500) // Simulate connection delay

    console.log('Mock WebSocket: Connected')
    this.connectionState$.next(ConnectionState.CONNECTED)

    await delay(200) // Simulate authentication delay
    console.log('Mock WebSocket: Authenticated')
    this.connectionState$.next(ConnectionState.AUTHENTICATED)

    // Start real-time stats simulation
    this.startStatsSimulation()
  },

  disconnect(): void {
    console.log('Mock WebSocket: Disconnected')
    this.connectionState$.next(ConnectionState.DISCONNECTED)

    // Stop stats simulation
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }
  },

  createTerminal(workspaceId: string, sessionId: string, paneId: string): void {
    const pid = Math.floor(Math.random() * 10000) + 1000

    // Store terminal info
    this.terminals.set(sessionId, { pid, workspaceId })

    // Emit terminal created event
    setTimeout(() => {
      this.terminalCreated$.next({
        sessionId,
        pid,
        workspaceId
      })

      // Simulate welcome message
      setTimeout(() => {
        this.terminalOutput$.next({
          sessionId,
          output: `Welcome to Mock Terminal v1.0.0\\n`
        })

        this.terminalOutput$.next({
          sessionId,
          output: `demo@mock-terminal:${currentMockPath}$ `
        })
      }, 100)
    }, 200)
  },

  sendTerminalData(sessionId: string, data: string): void {
    const terminal = this.terminals.get(sessionId)
    if (!terminal) return

    const state = getTerminalState(sessionId)

    // Process input data
    let i = 0
    while (i < data.length) {
      const char = data[i]

      // Handle escape sequences (arrow keys, etc.)
      if (char === '\x1b' && i + 2 < data.length && data[i + 1] === '[') {
        // This is an ANSI escape sequence
        const escapeCode = data[i + 2]

        switch (escapeCode) {
          case 'A': // Up arrow
          case 'B': // Down arrow
            // Ignore history navigation for now
            break
          case 'C': // Right arrow
          case 'D': // Left arrow
            // Ignore cursor movement for now
            break
        }

        i += 3
        continue
      }

      if (char === '\r' || char === '\n') {
        // Enter/Return key - execute the command
        const command = state.currentLine

        // Echo the newline first
        this.terminalOutput$.next({
          sessionId,
          output: '\r\n'
        })

        if (command.trim()) {
          // Execute the command
          const result = interpretCommand(command)

          // Update prompt if directory changed
          if (result.dirChanged) {
            updatePrompt(sessionId)
          }

          // Output results immediately
          if (result.output.length > 0) {
            const commandOutput = result.output.join('\r\n') + '\r\n'
            this.terminalOutput$.next({
              sessionId,
              output: commandOutput
            })
          }

          // Show new prompt after command completes
          setTimeout(() => {
            this.terminalOutput$.next({
              sessionId,
              output: state.prompt
            })
          }, 50)
        } else {
          // Empty command - just show new prompt
          this.terminalOutput$.next({
            sessionId,
            output: state.prompt
          })
        }

        // Reset current line
        state.currentLine = ''

      } else if (char === '\x7F' || char === '\b') {
        // Backspace/Delete
        if (state.currentLine.length > 0) {
          state.currentLine = state.currentLine.slice(0, -1)
          // Echo backspace sequence: move cursor back, write space, move cursor back again
          this.terminalOutput$.next({
            sessionId,
            output: '\b \b'
          })
        }
      } else if (char === '\x03') {
        // Ctrl+C - interrupt
        this.terminalOutput$.next({
          sessionId,
          output: '^C\r\n' + state.prompt
        })
        state.currentLine = ''
      } else if (char === '\x04') {
        // Ctrl+D - EOF
        if (state.currentLine.length === 0) {
          this.terminalOutput$.next({
            sessionId,
            output: 'exit\r\n'
          })
        }
      } else if (char >= ' ' && char <= '~') {
        // Printable ASCII character - add to current line and echo
        state.currentLine += char
        this.terminalOutput$.next({
          sessionId,
          output: char
        })
      }
      // Ignore other control characters

      i++
    }
  },

  resizeTerminal(_sessionId: string, _cols: number, _rows: number): void {
    console.log(`Mock terminal resized`)
  },

  destroyTerminal(sessionId: string): void {
    this.terminals.delete(sessionId)

    setTimeout(() => {
      this.terminalDestroyed$.next({
        sessionId
      })
    }, 100)
  },

  switchWorkspace(workspaceId: string): void {
    console.log(`Mock: Switched to workspace ${workspaceId}`)
  },

  // Session discovery and reconnection
  getWorkspaceSessions(workspaceId: string): void {
    setTimeout(() => {
      const mockSessions: WorkspaceSession[] = [
        {
          id: 'session-1',
          session_name: 'zsh',
          workspace_id: workspaceId,
          status: 'active',
          last_activity_at: new Date().toISOString(),
          created_at: '2024-01-20T10:00:00Z',
          can_recover: true,
          terminal_size: { cols: 80, rows: 24 }
        },
        {
          id: 'session-2',
          session_name: 'bash',
          workspace_id: workspaceId,
          status: 'inactive',
          last_activity_at: '2024-01-19T15:30:00Z',
          created_at: '2024-01-19T14:00:00Z',
          can_recover: false,
          terminal_size: { cols: 80, rows: 24 }
        }
      ]

      this.workspaceSessions$.next({
        workspaceId,
        sessions: mockSessions
      })
    }, 300)
  },

  recoverSession(_recoveryToken: string): void {
    setTimeout(() => {
      this.sessionRecovered$.next({
        sessionId: 'recovered-session-1',
        success: true
      })
    }, 500)
  },

  updateSessionPaneAssociation(sessionId: string, paneId: string): void {
    console.log(`Mock: Associated session ${sessionId} with pane ${paneId}`)
  },

  // Stats simulation
  startStatsSimulation(): void {
    // Emit initial stats
    this.emitStatsData()

    // Set up interval for real-time stats updates
    this.statsInterval = setInterval(() => {
      this.emitStatsData()
    }, 2000) // Update every 2 seconds
  },

  emitStatsData(): void {
    const stats: StatsDataEvent = {
      cpu_usage: Math.random() * 100,
      memory_usage: Math.random() * 100,
      memory_total: 16000, // Mock total memory in MB
      disk_usage: Math.random() * 100,
      disk_total: 500000, // Mock total disk in MB
      uptime: Math.floor(Math.random() * 86400),
      load_average: Math.random() * 2,
      processes: Math.floor(Math.random() * 200) + 50,
      active_sessions: Math.floor(Math.random() * 10) + 1,
      timestamp: Date.now()
    }

    this.statsData$.next(stats)
  },

  subscribeToStats(interval: number = 5): void {
    console.log(`Mock: Subscribed to stats with interval ${interval}s`)
    // Restart stats simulation with new interval
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
    }
    this.startStatsSimulation()
  },

  unsubscribeFromStats(): void {
    console.log('Mock: Unsubscribed from stats')
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }
  },

  // Task execution simulation
  simulateTaskExecution(taskId: string, taskData: unknown): void {
    // Emit task started
    setTimeout(() => {
      this.taskExecutionStarted$.next({
        taskId,
        taskData: taskData as Record<string, unknown>
      })
    }, 100)

    // Emit progress updates
    const steps = [
      { message: 'Analyzing task requirements...', progress: 10 },
      { message: 'Planning implementation approach...', progress: 25 },
      { message: 'Generating code changes...', progress: 50 },
      { message: 'Reviewing and optimizing...', progress: 75 },
      { message: 'Finalizing changes...', progress: 90 }
    ]

    steps.forEach((step, index) => {
      setTimeout(() => {
        this.taskExecutionOutput$.next({
          taskId,
          output: `[${step.progress}%] ${step.message}`
        })
      }, (index + 1) * 800)
    })

    // Emit completion
    setTimeout(() => {
      this.taskExecutionStatus$.next({
        taskId,
        status: 'completed',
        result: { message: 'Task completed successfully' }
      })
    }, steps.length * 800 + 500)
  },

  // Mock properties
  get isConnected(): boolean {
    return this.connectionState$.value === ConnectionState.AUTHENTICATED
  },

  getSocket(): null {
    return null // Mock service doesn't use real socket
  },

  // Subscription handling
  subscribe<T extends keyof SocketEventMap>(
    eventType: T,
    callback: (data: SocketEventMap[T]) => void
  ): Subscription {
    switch (eventType) {
      case 'terminal:output':
        return this.terminalOutput$.subscribe(callback as (data: TerminalOutputEvent) => void)
      case 'terminal:created':
        return this.terminalCreated$.subscribe(callback as (data: TerminalCreatedEvent) => void)
      case 'terminal:destroyed':
        return this.terminalDestroyed$.subscribe(callback as (data: TerminalDestroyedEvent) => void)
      case 'stats:data':
        return this.statsData$.subscribe(callback as (data: StatsDataEvent) => void)
      case 'websocket:auth_error':
        return this.authError$.subscribe(callback as (data: WebSocketAuthErrorEvent) => void)
      case 'websocket:reconnection_failed':
        return this.reconnectionFailed$.subscribe(callback as (data: ReconnectionFailedEvent) => void)
      case 'connection:state':
        return this.connectionState$.subscribe((state) => {
          const event: ConnectionStateEvent = {
            state,
            timestamp: Date.now(),
            reconnectAttempt: 0
          }
          callback(event as SocketEventMap[T])
        })
      default:
        throw new Error(`Unknown event type: ${eventType}`)
    }
  }
}