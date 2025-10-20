import { RealApiService } from './realApiService'
import { mockApiService } from './mockApiService'

// Check if mocks are enabled via environment variable
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

// Create the appropriate service instance
const realApiService = new RealApiService()

// Export the appropriate service based on environment
export const apiService = useMocks ? mockApiService : realApiService
export default apiService

// Export types for consumers
export type { RealApiService } from './realApiService'