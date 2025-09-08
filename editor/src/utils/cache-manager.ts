/**
 * Client-side cache management and version checking
 */

interface AssetVersionInfo {
  version: string;
  timestamp: number;
  strategy: string;
}

declare global {
  interface Window {
    APP_ASSET_VERSION: AssetVersionInfo;
  }
}

export class CacheManager {
  private static readonly STORAGE_KEY = 'app-asset-version';
  private static readonly CHECK_INTERVAL = 30000; // Check every 30 seconds
  private static readonly STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
  
  private checkInterval?: number;
  private isChecking = false;

  /**
   * Initialize cache management
   */
  public init(): void {
    if (typeof window === 'undefined') return;

    console.log('🔄 Initializing cache management...');
    
    this.checkVersionOnLoad();
    this.startPeriodicCheck();
    this.setupVisibilityHandler();
  }

  /**
   * Check version immediately on load
   */
  private checkVersionOnLoad(): void {
    const currentVersion = this.getCurrentVersion();
    const storedVersion = this.getStoredVersion();
    
    console.log('📦 Asset version check:', {
      current: currentVersion?.version,
      stored: storedVersion?.version,
      strategy: currentVersion?.strategy
    });

    if (storedVersion && currentVersion) {
      if (storedVersion.version !== currentVersion.version) {
        console.log('🔄 New version detected, clearing old caches...');
        this.clearBrowserCaches();
      } else {
        console.log('✅ Asset versions match, no cache clear needed');
      }
    }

    if (currentVersion) {
      this.storeCurrentVersion(currentVersion);
    }
  }

  /**
   * Start periodic version checking
   */
  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = window.setInterval(() => {
      if (!this.isChecking && !document.hidden) {
        this.checkForUpdates();
      }
    }, CacheManager.CHECK_INTERVAL);
  }

  /**
   * Setup page visibility change handler
   */
  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Page became visible, check for updates
        setTimeout(() => this.checkForUpdates(), 1000);
      }
    });
  }

  /**
   * Check for asset updates by fetching version info
   */
  private async checkForUpdates(): Promise<void> {
    if (this.isChecking) return;
    
    this.isChecking = true;
    
    try {
      console.log('🔍 Checking for asset updates...');
      
      // Fetch current version from server
      const response = await fetch('/api/asset-version', {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const serverVersion: AssetVersionInfo = await response.json();
        const currentVersion = this.getCurrentVersion();
        
        if (currentVersion && serverVersion.version !== currentVersion.version) {
          console.log('🆕 New asset version available!', {
            current: currentVersion.version,
            server: serverVersion.version
          });
          
          this.handleVersionMismatch(serverVersion);
        }
      }
    } catch (error) {
      console.warn('⚠️  Failed to check for updates:', error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Handle version mismatch
   */
  private handleVersionMismatch(newVersion: AssetVersionInfo): void {
    const stored = this.getStoredVersion();
    const timeSinceLastUpdate = stored ? Date.now() - stored.timestamp : 0;
    
    // Only show notification if it's been a while since last update
    if (timeSinceLastUpdate > CacheManager.STALE_THRESHOLD) {
      this.showUpdateNotification(newVersion);
    } else {
      // Auto-refresh if recent
      this.performSoftRefresh();
    }
  }

  /**
   * Show user-friendly update notification
   */
  private showUpdateNotification(newVersion: AssetVersionInfo): void {
    // Create a non-intrusive notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #2563eb;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>🚀</span>
        <span>New version available!</span>
        <button onclick="this.parentElement.parentElement.remove(); location.reload();" 
                style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-left: 8px;">
          Update
        </button>
      </div>
    `;
    
    // Add animation style
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  /**
   * Perform soft refresh (try to update without full reload)
   */
  private performSoftRefresh(): void {
    console.log('🔄 Performing soft refresh...');
    
    // Clear caches and reload
    this.clearBrowserCaches();
    
    // Small delay before reload to ensure cache clearing
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  /**
   * Clear browser caches
   */
  private clearBrowserCaches(): void {
    try {
      // Clear localStorage related to app
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('app-') || key.startsWith('codemirror-') || key.startsWith('terminal-')) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('app-') || key.startsWith('codemirror-') || key.startsWith('terminal-')) {
          sessionStorage.removeItem(key);
        }
      });

      console.log('🧹 Browser caches cleared');
    } catch (error) {
      console.warn('⚠️  Failed to clear some caches:', error);
    }
  }

  /**
   * Get current version from global variable
   */
  private getCurrentVersion(): AssetVersionInfo | null {
    return window.APP_ASSET_VERSION || null;
  }

  /**
   * Get stored version from localStorage
   */
  private getStoredVersion(): { version: string; timestamp: number } | null {
    try {
      const stored = localStorage.getItem(CacheManager.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Store current version in localStorage
   */
  private storeCurrentVersion(version: AssetVersionInfo): void {
    try {
      localStorage.setItem(CacheManager.STORAGE_KEY, JSON.stringify({
        version: version.version,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('⚠️  Failed to store version info:', error);
    }
  }

  /**
   * Destroy cache manager
   */
  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }
}

// Create and export singleton instance
export const cacheManager = new CacheManager();