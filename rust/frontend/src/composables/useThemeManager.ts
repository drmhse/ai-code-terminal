/**
 * Theme manager composable - Legacy wrapper
 * @deprecated Use useTheme() instead for new code
 * 
 * This file provides backward compatibility for components that were
 * using the old theme manager. New code should use useTheme() directly.
 */

import { useTheme } from './useTheme'
export type { Theme, ThemePreference } from '@/types/theme'

/**
 * @deprecated Use useTheme() instead
 */
export function useThemeManager() {
  console.warn('useThemeManager is deprecated. Use useTheme() instead.')
  return useTheme()
}

// Re-export the main theme composable for convenience
export { useTheme } from './useTheme'