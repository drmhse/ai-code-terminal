import { SsoClient } from '@drmhse/sso-sdk';
import { authStorage } from '@/utils/auth-storage';
import type { UserProfile, OAuthProvider } from '@drmhse/sso-sdk';

// Check if mocks are enabled via environment variable
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

// Mock SSO Client
class MockSsoClient {
  private token: string | null = null

  setAuthToken(token: string | null): void {
    this.token = token
  }

  readonly user = {
    getProfile: async (): Promise<UserProfile> => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300))

      // Return mock user profile
      return {
        id: 'mock-user-123',
        email: 'demo@aicodeterminal.io'
      }
    },

    // Mock getSubscription method
    getSubscription: async (): Promise<{ plan: string; features: string[]; status: string }> => {
      await new Promise(resolve => setTimeout(resolve, 200))
      return {
        plan: 'pro',
        features: ['unlimited-workspaces', 'ai-assistance', 'priority-support'],
        status: 'active'
      }
    },

    // Mock identities methods for Microsoft integration
    identities: {
      list: async () => [
        {
          id: 'mock-microsoft-identity',
          provider: 'microsoft',
          provider_id: 'mock-microsoft-id',
          email: 'demo@outlook.com',
          created_at: '2024-01-01T00:00:00Z'
        }
      ],

      unlink: async (_provider: string) => {
        // Mock unlink - simulate success
        await new Promise(resolve => setTimeout(resolve, 200))
      },

      startLink: async (_provider: string) => {
        // Mock start link - return a mock authorization URL
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          authorization_url: 'https://mock-auth.com/authorize?client_id=mock&response_type=code'
        }
      }
    }
  }

  readonly auth = {
    getLoginUrl: (provider: OAuthProvider, options?: { redirect_uri?: string; state?: string }): string => {
      // In mock mode, immediately redirect to the callback URL with mock tokens
      const redirectUri = options?.redirect_uri || window.location.origin + '/auth/callback'
      const mockToken = 'mock_access_token_' + Date.now()
      const mockRefreshToken = 'mock_refresh_token_' + Date.now()

      // Create a mock callback URL
      const callbackUrl = new URL(redirectUri)
      callbackUrl.searchParams.set('access_token', mockToken)
      callbackUrl.searchParams.set('refresh_token', mockRefreshToken)
      callbackUrl.searchParams.set('state', options?.state || 'mock-state')

      // Instead of returning a login URL, directly redirect to callback in mock mode
      setTimeout(() => {
        window.location.href = callbackUrl.toString()
      }, 100)

      return callbackUrl.toString()
    },

    logout: async (): Promise<void> => {
      // Simulate logout delay
      await new Promise(resolve => setTimeout(resolve, 200))

      // Clear mock tokens
      this.token = null
      authStorage.removeToken()
      localStorage.removeItem('sso_refresh_token')
      localStorage.removeItem('user')
    },

    deviceCode: {
      request: async (_options: { client_id: string; scope?: string }): Promise<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }> => {
        await new Promise(resolve => setTimeout(resolve, 500))

        return {
          device_code: 'mock-device-code-' + Date.now(),
          user_code: 'MOCK-CODE',
          verification_uri: 'https://mock-auth.com/activate',
          expires_in: 1800,
          interval: 5
        }
      },

      exchangeToken: async (_options: { client_id: string; device_code: string }): Promise<{ access_token: string; refresh_token: string; expires_in: number }> => {
        await new Promise(resolve => setTimeout(resolve, 1000))

        return {
          access_token: 'mock_device_access_token_' + Date.now(),
          refresh_token: 'mock_device_refresh_token_' + Date.now(),
          expires_in: 3600
        }
      },

      refreshToken: async (_refreshToken?: string): Promise<{ access_token: string; refresh_token: string }> => {
        await new Promise(resolve => setTimeout(resolve, 300))
        return {
          access_token: 'mock_refreshed_access_token_' + Date.now(),
          refresh_token: 'mock_refreshed_refresh_token_' + Date.now()
        }
      }
    }
  }

  async refreshToken(): Promise<{ access_token: string; refresh_token: string }> {
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      access_token: 'mock_refreshed_access_token_' + Date.now(),
      refresh_token: 'mock_refreshed_refresh_token_' + Date.now()
    }
  }

  async revokeToken(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200))
    this.token = null
  }
}

// Create appropriate client based on environment
const realSsoClient = new SsoClient({
  baseURL: import.meta.env.VITE_SSO_BASE_URL,
  token: authStorage.getToken() || undefined,
});

const mockSsoClient = new MockSsoClient()

const ssoClient = useMocks ? mockSsoClient : realSsoClient;

export default ssoClient;
