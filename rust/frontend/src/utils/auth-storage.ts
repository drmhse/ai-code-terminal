/**
 * Centralized authentication token storage management
 * Single source of truth for auth token key and operations
 */

const AUTH_TOKEN_KEY = 'sso_token'

export const authStorage = {
  /**
   * Get the current authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  },

  /**
   * Set the authentication token
   */
  setToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  },

  /**
   * Remove the authentication token
   */
  removeToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  },

  /**
   * Check if a token exists
   */
  hasToken(): boolean {
    return !!this.getToken()
  }
}
