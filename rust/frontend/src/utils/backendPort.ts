import { invoke } from '@tauri-apps/api/core'

/**
 * Check if running inside Tauri desktop app
 */
function isTauriApp(): boolean {
  const isTauri = !!window.__TAURI__
  console.log('🔍 Checking Tauri environment:', {
    isTauri,
    hasTauriGlobal: '__TAURI__' in window,
    windowKeys: Object.keys(window).filter(k => k.includes('TAURI') || k.includes('tauri'))
  })
  return isTauri
}

/**
 * Get the backend port from Tauri with retry logic
 */
async function getBackendPort(): Promise<number> {
  if (!isTauriApp()) {
    throw new Error('Not running in Tauri environment')
  }

  console.log('🔍 Getting backend port from Tauri...')

  // Retry logic - backend might not be ready immediately
  let attempts = 0
  const maxAttempts = 10
  const retryDelay = 500 // ms

  while (attempts < maxAttempts) {
    try {
      const port = await invoke<number>('get_backend_port')
      console.log('✅ Got backend port from Tauri:', port)
      return port
    } catch (error) {
      attempts++
      console.warn(`⚠️ Attempt ${attempts}/${maxAttempts} failed to get backend port:`, error)

      if (attempts >= maxAttempts) {
        console.error('❌ All attempts failed to get backend port from Tauri')
        console.warn('🔄 Falling back to default port 3001')
        return 3001
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  return 3001
}

/**
 * Wait for backend to be ready
 */
async function waitForBackend(baseUrl: string, maxAttempts = 20): Promise<boolean> {
  console.log('⏳ Waiting for backend to be ready at', baseUrl)

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      })

      if (response.ok) {
        console.log('✅ Backend is ready!')
        return true
      }
    } catch {
      // Backend not ready yet, will retry
      console.log(`⏳ Backend check ${i + 1}/${maxAttempts}...`)
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.warn('⚠️ Backend did not become ready within timeout')
  return false
}

/**
 * Get the API base URL based on environment
 */
export async function getApiBaseUrl(): Promise<string> {
  if (isTauriApp()) {
    // In Tauri: get the dynamic port from backend
    const port = await getBackendPort()
    const baseUrl = `http://localhost:${port}`

    // Wait for backend to be ready
    await waitForBackend(baseUrl)

    return baseUrl
  } else {
    // In web: use environment variables
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
  }
}

/**
 * Get the WebSocket URL based on environment
 */
export async function getWsUrl(): Promise<string> {
  if (isTauriApp()) {
    // In Tauri: get the dynamic port from backend
    const port = await getBackendPort()
    const baseUrl = `http://localhost:${port}`

    // Wait for backend to be ready
    await waitForBackend(baseUrl)

    return baseUrl
  } else {
    // In web: use environment variables
    return import.meta.env.VITE_WS_URL || 'http://localhost:3001'
  }
}

/**
 * Check if running in Tauri environment
 */
export function isDesktopApp(): boolean {
  return isTauriApp()
}