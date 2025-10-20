import { RealSocketService } from './realSocketService'
import { mockSocketService } from './mockSocketService'

// Check if mocks are enabled via environment variable
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

// Create the appropriate service instance
const realSocketService = new RealSocketService()

// Export the appropriate service based on environment
export const socketService = useMocks ? mockSocketService : realSocketService
export default socketService

// Export types for consumers
export type { RealSocketService } from './realSocketService'
export type {
  WorkspaceSession,
  WorkspaceSessionsEvent,
  SessionRecoveredEvent,
  ReconnectionFailedEvent,
  SocketEvents
} from './realSocketService'

// Composable for Vue components
export function useSocketService() {
  return socketService
}