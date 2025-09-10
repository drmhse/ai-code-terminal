export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface TerminalOutputEvent {
  sessionId: string
  output: string
}

export interface TerminalCreatedEvent {
  sessionId: string
  pid: number
  success?: boolean
  workspaceId?: string
}

export interface TerminalDestroyedEvent {
  sessionId: string
}

export interface StatsDataEvent {
  cpu_usage: number
  memory_usage: number
  memory_total: number
  disk_usage: number
  disk_total: number
  uptime: number
  load_average: number
  processes: number
  timestamp: number
}

export interface WebSocketAuthErrorEvent {
  code: string
  message: string
  timestamp: number
}

export interface ConnectionStateEvent {
  state: ConnectionState
  timestamp: number
  error?: string
  reconnectAttempt?: number
}

export interface SocketEventMap {
  'terminal:output': TerminalOutputEvent
  'terminal:created': TerminalCreatedEvent
  'terminal:destroyed': TerminalDestroyedEvent
  'stats:data': StatsDataEvent
  'websocket:auth_error': WebSocketAuthErrorEvent
  'connection:state': ConnectionStateEvent
}

export type SocketEventType = keyof SocketEventMap
export type SocketEventData<T extends SocketEventType> = SocketEventMap[T]

export function validateTerminalOutputEvent(data: unknown): data is TerminalOutputEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).sessionId === 'string' &&
    typeof (data as any).output === 'string'
  )
}

export function validateTerminalCreatedEvent(data: unknown): data is TerminalCreatedEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).sessionId === 'string' &&
    typeof (data as any).pid === 'number' &&
    ((data as any).success === undefined || typeof (data as any).success === 'boolean') &&
    ((data as any).workspaceId === undefined || typeof (data as any).workspaceId === 'string')
  )
}

export function validateTerminalDestroyedEvent(data: unknown): data is TerminalDestroyedEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).sessionId === 'string'
  )
}

export function validateStatsDataEvent(data: unknown): data is StatsDataEvent {
  if (typeof data !== 'object' || data === null) return false
  
  const event = data as any
  return (
    typeof event.cpu_usage === 'number' &&
    typeof event.memory_usage === 'number' &&
    typeof event.memory_total === 'number' &&
    typeof event.disk_usage === 'number' &&
    typeof event.disk_total === 'number' &&
    typeof event.uptime === 'number' &&
    typeof event.load_average === 'number' &&
    typeof event.processes === 'number' &&
    typeof event.timestamp === 'number'
  )
}

export function validateWebSocketAuthErrorEvent(data: unknown): data is WebSocketAuthErrorEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).code === 'string' &&
    typeof (data as any).message === 'string' &&
    typeof (data as any).timestamp === 'number'
  )
}