import { io, type Socket } from 'socket.io-client'
import router from '@/router'
import { Subject, BehaviorSubject, type Subscription } from '@/utils/reactive'
import { 
  ConnectionState,
  type TerminalOutputEvent,
  type TerminalCreatedEvent,
  type TerminalDestroyedEvent,
  type StatsDataEvent,
  type WebSocketAuthErrorEvent,
  type ConnectionStateEvent,
  type SocketEventMap,
  validateTerminalOutputEvent,
  validateTerminalCreatedEvent,
  validateTerminalDestroyedEvent,
  validateStatsDataEvent
} from '@/types/socket'

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
  private isConnecting = false

  public readonly connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED)
  public readonly terminalOutput$ = new Subject<TerminalOutputEvent>()
  public readonly terminalCreated$ = new Subject<TerminalCreatedEvent>()
  public readonly terminalDestroyed$ = new Subject<TerminalDestroyedEvent>()
  public readonly statsData$ = new Subject<StatsDataEvent>()
  public readonly authError$ = new Subject<WebSocketAuthErrorEvent>()

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Prevent multiple simultaneous connections
      if (this.isConnecting || this.isConnected) {
        console.log('Socket already connecting or connected, skipping')
        if (this.isConnected) resolve()
        return
      }

      const token = localStorage.getItem('jwt_token')
      if (!token) {
        this.connectionState$.next(ConnectionState.ERROR)
        reject(new Error('No authentication token available'))
        return
      }

      this.isConnecting = true
      this.connectionState$.next(ConnectionState.CONNECTING)
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
        this.isConnecting = false
        this.connectionState$.next(ConnectionState.CONNECTED)
        
        this.socket?.emit('authenticate', { token })
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from WebSocket server:', reason)
        this.connectionState$.next(ConnectionState.DISCONNECTED)
        if (reason === 'io server disconnect') {
          this.handleReconnection()
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        this.isConnecting = false
        this.connectionState$.next(ConnectionState.ERROR)
        
        // Handle authentication errors more gracefully
        if (error.message.includes('Authentication') || 
            error.message.includes('Unauthorized') || 
            error.message.includes('JWT')) {
          console.warn('WebSocket authentication failed, but continuing connection')
          // Don't reject for auth errors - allow the connection to continue
          // This prevents redirect loops while still showing authentication issues
        } else {
          // For non-auth errors, reject the connection promise
          reject(error)
        }
      })

      this.socket.on('authenticated', (data) => {
        console.log('WebSocket authenticated successfully:', data)
        this.connectionState$.next(ConnectionState.AUTHENTICATED)
        resolve()
      })

      this.socket.on('auth_error', (error) => {
        console.error('WebSocket authentication error:', error)
        this.connectionState$.next(ConnectionState.ERROR)
        
        if (error.code === 'JWT_EXPIRED' || error.code === 'JWT_INVALID') {
          console.warn('JWT token issue detected, will need re-authentication')
          const authErrorEvent: WebSocketAuthErrorEvent = {
            code: error.code,
            message: error.message || 'Authentication error',
            timestamp: Date.now()
          }
          this.authError$.next(authErrorEvent)
        }
      })

      this.setupTerminalListeners()
      this.setupStatsListeners()
    })
  }

  private setupTerminalListeners(): void {
    if (!this.socket) return

    this.socket.on('terminal:output', (data: unknown) => {
      if (validateTerminalOutputEvent(data)) {
        this.terminalOutput$.next(data)
      } else {
        console.warn('Invalid terminal output data received:', data)
      }
    })

    this.socket.on('terminal:created', (data: unknown) => {
      if (validateTerminalCreatedEvent(data)) {
        this.terminalCreated$.next(data)
      } else {
        console.warn('Invalid terminal created data received:', data)
      }
    })

    this.socket.on('terminal:destroyed', (data: unknown) => {
      if (validateTerminalDestroyedEvent(data)) {
        this.terminalDestroyed$.next(data)
      } else {
        console.warn('Invalid terminal destroyed data received:', data)
      }
    })
  }

  private setupStatsListeners(): void {
    if (!this.socket) return

    this.socket.on('stats:data', (data: unknown) => {
      if (validateStatsDataEvent(data)) {
        this.statsData$.next(data)
      } else {
        console.warn('Invalid stats data received:', data)
      }
    })

    this.socket.on('stats:subscribed', (data: unknown) => {
      console.log('Successfully subscribed to stats:', data)
    })

    this.socket.on('stats:unsubscribed', (data: unknown) => {
      console.log('Successfully unsubscribed from stats:', data)
    })

    this.socket.on('stats:error', (error: unknown) => {
      console.error('Stats error:', error)
    })
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      this.connectionState$.next(ConnectionState.RECONNECTING)
      const delay = Math.pow(2, this.reconnectAttempts) * 1000
      setTimeout(() => {
        console.log(`Reconnection attempt ${this.reconnectAttempts}`)
        this.connect().catch(console.error)
      }, delay)
    } else {
      console.error('Max reconnection attempts reached')
      this.connectionState$.next(ConnectionState.ERROR)
      router.push('/login')
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnecting = false
    this.connectionState$.next(ConnectionState.DISCONNECTED)
  }

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
    this.socket?.emit('terminal:terminate', { sessionId, data: sessionId })
  }

  switchWorkspace(workspaceId: string): void {
    this.socket?.emit('workspace:switch', { workspaceId })
  }

  subscribeToStats(interval: number = 5): void {
    this.socket?.emit('stats:subscribe', { interval })
  }

  unsubscribeFromStats(): void {
    this.socket?.emit('stats:unsubscribe')
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false
  }

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
      case 'connection:state':
        return this.connectionState$.subscribe((state) => {
          const event: ConnectionStateEvent = {
            state,
            timestamp: Date.now(),
            reconnectAttempt: this.reconnectAttempts
          }
          callback(event as SocketEventMap[T])
        })
      default:
        throw new Error(`Unknown event type: ${eventType}`)
    }
  }
}

export const socketService = new SocketService()

// Composable for Vue components
export function useSocketService() {
  return socketService
}

export default socketService