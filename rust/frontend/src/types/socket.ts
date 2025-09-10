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
}

export interface TerminalDestroyedEvent {
  sessionId: string
}

export interface StatsDataEvent {
  timestamp: number
  cpu: {
    usage: number
    cores: number
  }
  memory: {
    used: number
    total: number
    usage: number
  }
  disk: {
    used: number
    total: number
    usage: number
  }
  network?: {
    rx: number
    tx: number
  }
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
    typeof (data as any).pid === 'number'
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
    typeof event.timestamp === 'number' &&
    typeof event.cpu === 'object' &&
    typeof event.cpu.usage === 'number' &&
    typeof event.cpu.cores === 'number' &&
    typeof event.memory === 'object' &&
    typeof event.memory.used === 'number' &&
    typeof event.memory.total === 'number' &&
    typeof event.memory.usage === 'number' &&
    typeof event.disk === 'object' &&
    typeof event.disk.used === 'number' &&
    typeof event.disk.total === 'number' &&
    typeof event.disk.usage === 'number'
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