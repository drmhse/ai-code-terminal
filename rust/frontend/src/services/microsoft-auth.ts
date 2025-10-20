// Microsoft Auth Service Switcher
// Exports either real or mock service based on environment

// Check if mocks are enabled via environment variable
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

// Import services
import realMicrosoftAuthService from './realMicrosoftAuthService'
import mockMicrosoftAuthService from './mockMicrosoftAuthService'

// Export types from real service
export type {
  MicrosoftAuthStatus,
  AuthUrlResponse,
  CodeContext,
  CreateTaskRequest,
  CacheStats,
  WorkspaceSyncStatus,
  TodoSyncStatus,
  TaskList,
  TodoTask
} from './realMicrosoftAuthService'

// Export the appropriate service
export const microsoftAuthService = useMocks ? mockMicrosoftAuthService : realMicrosoftAuthService
export default microsoftAuthService