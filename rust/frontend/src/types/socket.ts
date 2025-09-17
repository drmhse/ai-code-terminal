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

export interface ReconnectionFailedEvent {
  attempts: number
  reason: string
}

export interface SocketEventMap {
  'terminal:output': TerminalOutputEvent
  'terminal:created': TerminalCreatedEvent
  'terminal:destroyed': TerminalDestroyedEvent
  'stats:data': StatsDataEvent
  'websocket:auth_error': WebSocketAuthErrorEvent
  'websocket:reconnection_failed': ReconnectionFailedEvent
  'connection:state': ConnectionStateEvent
}

export type SocketEventType = keyof SocketEventMap
export type SocketEventData<T extends SocketEventType> = SocketEventMap[T]

export function validateTerminalOutputEvent(data: unknown): data is TerminalOutputEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { sessionId: unknown }).sessionId === 'string' &&
    typeof (data as { output: unknown }).output === 'string'
  )
}

export function validateTerminalCreatedEvent(data: unknown): data is TerminalCreatedEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { sessionId: unknown }).sessionId === 'string' &&
    typeof (data as { pid: unknown }).pid === 'number' &&
    ((data as { success: unknown }).success === undefined || typeof (data as { success: unknown }).success === 'boolean') &&
    ((data as { workspaceId: unknown }).workspaceId === undefined || typeof (data as { workspaceId: unknown }).workspaceId === 'string')
  )
}

export function validateTerminalDestroyedEvent(data: unknown): data is TerminalDestroyedEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { sessionId: unknown }).sessionId === 'string'
  )
}

export function validateStatsDataEvent(data: unknown): data is StatsDataEvent {
  if (typeof data !== 'object' || data === null) return false
  
  const event = data as {
    cpu_usage?: unknown
    memory_usage?: unknown
    memory_total?: unknown
    disk_usage?: unknown
    disk_total?: unknown
    uptime?: unknown
    load_average?: unknown
    processes?: unknown
    timestamp?: unknown
  }
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
    typeof (data as { code: unknown }).code === 'string' &&
    typeof (data as { message: unknown }).message === 'string' &&
    typeof (data as { timestamp: unknown }).timestamp === 'number'
  )
}