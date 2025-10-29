/**
 * Version and cache busting utilities
 */

// Get version from package.json at build time
export const APP_VERSION = '1.0.0' // This will be replaced by build process

// Generate cache-busting hash
export function getCacheBustingHash(): string {
  // Use build timestamp and version
  const buildTime = new Date().getTime()
  const version = APP_VERSION
  return btoa(`${version}-${buildTime}`).replace(/[/+=]/g, '').substring(0, 8)
}

// Check if assets need updating
export function checkAssetVersion(storedVersion?: string): boolean {
  const currentVersion = getCacheBustingHash()
  return storedVersion !== currentVersion
}

// Store current version in localStorage
export function storeCurrentVersion(): void {
  const version = getCacheBustingHash()
  localStorage.setItem('app-version', version)
  localStorage.setItem('app-version-timestamp', Date.now().toString())
}

// Get stored version info
export function getStoredVersion(): { version?: string; timestamp?: number } {
  return {
    version: localStorage.getItem('app-version') || undefined,
    timestamp: parseInt(localStorage.getItem('app-version-timestamp') || '0') || undefined
  }
}