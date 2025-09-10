import { ref } from 'vue'

// Global app initialization state
const isGlobalAppInitialized = ref(false)
const isGlobalAppInitializing = ref(false)

export function useAppInitialization() {
  const canInitialize = () => {
    return !isGlobalAppInitialized.value && !isGlobalAppInitializing.value
  }

  const startInitialization = () => {
    if (!canInitialize()) {
      console.log('⚠️ Global app initialization already in progress or complete')
      return false
    }
    isGlobalAppInitializing.value = true
    return true
  }

  const completeInitialization = () => {
    isGlobalAppInitialized.value = true
    isGlobalAppInitializing.value = false
    console.log('✅ Global app initialization complete')
  }

  const resetInitialization = () => {
    isGlobalAppInitialized.value = false
    isGlobalAppInitializing.value = false
    console.log('🔄 Global app initialization state reset')
  }

  const failInitialization = (error?: Error) => {
    isGlobalAppInitializing.value = false
    console.error('❌ Global app initialization failed:', error)
  }

  return {
    canInitialize,
    startInitialization,
    completeInitialization,
    resetInitialization,
    failInitialization,
    isInitialized: isGlobalAppInitialized,
    isInitializing: isGlobalAppInitializing
  }
}