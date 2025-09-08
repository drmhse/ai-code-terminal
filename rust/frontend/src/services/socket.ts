import { io, type Socket } from 'socket.io-client'

export interface SocketEvents {
  // Terminal events
  'terminal:create': (data: { workspaceId: string; sessionId: string }) => void
  'terminal:data': (data: { sessionId: string; data: string }) => void
  'terminal:resize': (data: { sessionId: string; cols: number; rows: number }) => void
  'terminal:destroy': (data: { sessionId: string }) => void

  // Workspace events
  'workspace:switch': (data: { workspaceId: string }) => void
}

class SocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('jwt_token')
      if (!token) {
        reject(new Error('No authentication token available'))
        return
      }

      const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001'
      
      this.socket = io(wsUrl, {
        auth: {
          token,
        },
        transports: ['websocket'],
        upgrade: false,
      })

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server')
        this.reconnectAttempts = 0
        resolve()
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from WebSocket server:', reason)
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          this.handleReconnection()
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        if (error.message.includes('Authentication')) {
          // Clear invalid token and redirect to login
          localStorage.removeItem('jwt_token')
          localStorage.removeItem('user')
          window.location.href = '/login'
        }
        reject(error)
      })

      // Set up event listeners for terminal data
      this.setupTerminalListeners()
    })
  }

  private setupTerminalListeners(): void {
    if (!this.socket) return

    this.socket.on('terminal:output', (data: { sessionId: string; output: string }) => {
      // Emit custom event for components to listen to
      window.dispatchEvent(new CustomEvent('terminal:output', { detail: data }))
    })

    this.socket.on('terminal:created', (data: { sessionId: string; pid: number }) => {
      window.dispatchEvent(new CustomEvent('terminal:created', { detail: data }))
    })

    this.socket.on('terminal:destroyed', (data: { sessionId: string }) => {
      window.dispatchEvent(new CustomEvent('terminal:destroyed', { detail: data }))
    })
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.pow(2, this.reconnectAttempts) * 1000 // Exponential backoff
      setTimeout(() => {
        console.log(`Reconnection attempt ${this.reconnectAttempts}`)
        this.connect().catch(console.error)
      }, delay)
    } else {
      console.error('Max reconnection attempts reached')
      // Redirect to login or show error message
      window.location.href = '/login'
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // Terminal methods
  createTerminal(workspaceId: string, sessionId: string): void {
    this.socket?.emit('terminal:create', { workspaceId, sessionId })
  }

  sendTerminalData(sessionId: string, data: string): void {
    this.socket?.emit('terminal:data', { sessionId, data })
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    this.socket?.emit('terminal:resize', { sessionId, cols, rows })
  }

  destroyTerminal(sessionId: string): void {
    this.socket?.emit('terminal:destroy', { sessionId })
  }

  // Workspace methods
  switchWorkspace(workspaceId: string): void {
    this.socket?.emit('workspace:switch', { workspaceId })
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false
  }
}

export const socketService = new SocketService()

// Composable for Vue components
export function useSocketService() {
  return socketService
}

export default socketService