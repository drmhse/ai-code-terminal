import { isDesktopApp } from './backendPort'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'

export type OAuthProvider = 'github' | 'microsoft'

/**
 * Start OAuth flow in desktop or web mode
 * In desktop mode: Opens browser and listens for deep link callback
 * In web mode: Opens popup/redirect
 */
export async function startOAuthFlow(
  provider: OAuthProvider,
  authUrl: string,
  onSuccess: (code: string, state: string) => void | Promise<void>,
  onError: (error: string) => void
): Promise<void> {
  if (isDesktopApp()) {
    console.log(`[OAuth] Starting ${provider} OAuth flow in desktop mode`)

    // Listen for deep link callback before opening browser
    let unlisten: UnlistenFn | null = null

    try {
      unlisten = await listen<string>('oauth-callback', async (event) => {
        const url = event.payload
        console.log(`[OAuth] Received callback URL: ${url}`)

        try {
          handleOAuthCallback(url, provider, onSuccess, onError)
        } finally {
          // Clean up listener
          if (unlisten) {
            unlisten()
          }
        }
      })

      // Open browser for OAuth
      console.log(`[OAuth] Opening browser for ${provider} authentication`)
      await openUrl(authUrl)
    } catch (err) {
      if (unlisten) {
        unlisten()
      }
      const errorMsg = err instanceof Error ? err.message : 'Failed to start OAuth flow'
      console.error(`[OAuth] Error:`, errorMsg)
      onError(errorMsg)
    }
  } else {
    // Web mode: Use existing popup/redirect flow
    console.log(`[OAuth] Starting ${provider} OAuth flow in web mode`)
    window.open(authUrl, '_blank')
  }
}

/**
 * Parse OAuth callback URL and extract parameters
 */
function handleOAuthCallback(
  url: string,
  provider: OAuthProvider,
  onSuccess: (code: string, state: string) => void | Promise<void>,
  onError: (error: string) => void
): void {
  try {
    const urlObj = new URL(url)

    // Check for OAuth errors
    const error = urlObj.searchParams.get('error')
    if (error) {
      const errorDescription = urlObj.searchParams.get('error_description') || error
      console.error(`[OAuth] ${provider} error:`, errorDescription)
      onError(errorDescription)
      return
    }

    // Extract authorization code and state
    const code = urlObj.searchParams.get('code')
    const state = urlObj.searchParams.get('state')

    if (!code) {
      const errorMsg = 'Invalid OAuth response: missing authorization code'
      console.error(`[OAuth] ${errorMsg}`)
      onError(errorMsg)
      return
    }

    console.log(`[OAuth] Successfully received ${provider} authorization code`)

    // Call success handler
    const result = onSuccess(code, state || '')

    // If the result is a Promise, handle any errors
    if (result instanceof Promise) {
      result.catch((err) => {
        const errorMsg = err instanceof Error ? err.message : 'Failed to complete OAuth flow'
        console.error(`[OAuth] Error in success handler:`, errorMsg)
        onError(errorMsg)
      })
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to parse OAuth callback'
    console.error(`[OAuth] Parse error:`, errorMsg)
    onError(errorMsg)
  }
}

/**
 * Helper to generate and store OAuth state for CSRF protection
 */
export function generateOAuthState(): string {
  const state = crypto.randomUUID()
  localStorage.setItem('oauth_state', state)
  return state
}

/**
 * Helper to verify OAuth state for CSRF protection
 */
export function verifyOAuthState(state: string): boolean {
  const storedState = localStorage.getItem('oauth_state')
  localStorage.removeItem('oauth_state')
  return storedState === state
}
