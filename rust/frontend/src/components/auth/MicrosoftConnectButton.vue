<template>
  <div class="microsoft-connect">
    <div v-if="!isAuthenticated" class="connect-section">
      <button
        @click="handleConnect"
        :disabled="authLoading"
        class="connect-button"
      >
        <svg class="microsoft-icon" viewBox="0 0 24 24" width="16" height="16">
          <path fill="#00BCF2" d="M0 0h11v11H0z"/>
          <path fill="#00B4A6" d="M12 0h11v11H12z"/>
          <path fill="#FFB900" d="M0 12h11v11H0z"/>
          <path fill="#F25022" d="M12 12h11v11H12z"/>
        </svg>
        <span v-if="authLoading">Connecting...</span>
        <span v-else>Connect Microsoft To Do</span>
      </button>
      <p class="connect-description">
        Connect your Microsoft account to sync tasks with Microsoft To Do
      </p>
    </div>

    <div v-else class="connected-section">
      <div class="connected-info">
        <svg class="check-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        <span class="connected-email">{{ microsoftEmail }}</span>
      </div>

      <div class="connected-actions">
        <button
          @click="handleRefreshSync"
          :disabled="syncLoading"
          class="action-button refresh-button"
        >
          <svg class="refresh-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
            <polyline points="23,4 23,10 17,10"/>
            <polyline points="1,20 1,14 7,14"/>
            <path d="m3.51,9a9,9 0 0 1 14.85,-3.36L23,10M1,14l4.64,4.36A9,9 0 0 0 20.49,15"/>
          </svg>
          <span v-if="syncLoading">Syncing...</span>
          <span v-else>Refresh</span>
        </button>

        <button
          @click="handleDisconnect"
          :disabled="authLoading"
          class="action-button disconnect-button"
        >
          <svg class="disconnect-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
            <path d="M16 17l5-5-5-5M19.8 12H9M10 3H4a2 2 0 00-2 2v14c0 1.1.9 2 2 2h6"/>
          </svg>
          Disconnect
        </button>
      </div>

      <div v-if="syncStatus" class="sync-status">
        <p class="sync-summary">
          {{ syncStatus.synced_workspaces }}/{{ syncStatus.total_workspaces }} workspaces synced
        </p>
        <div v-if="hasRecentSync" class="last-sync">
          Last sync: {{ formatLastSync() }}
        </div>
      </div>
    </div>

    <!-- Error display -->
    <div v-if="authError" class="error-message">
      <svg class="error-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      {{ authError }}
      <button @click="clearErrors" class="clear-error">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { logger } from '@/utils/logger'

const todoStore = useTodoStore()

// Computed properties
const isAuthenticated = computed(() => todoStore.isAuthenticated)
const microsoftEmail = computed(() => todoStore.microsoftEmail)
const authLoading = computed(() => todoStore.authLoading)
const syncLoading = computed(() => todoStore.syncLoading)
const authError = computed(() => todoStore.authError)
const syncStatus = computed(() => todoStore.syncStatus)

// Check if any workspace has recent sync
const hasRecentSync = computed(() => {
  if (!syncStatus.value) return false
  return syncStatus.value.workspace_statuses.some(ws => ws.last_sync)
})

// Actions
const handleConnect = async () => {
  try {
    const { auth_url } = await todoStore.startOAuthFlow()

    // Open Microsoft OAuth URL in popup window
    const popup = window.open(auth_url, 'microsoft-oauth', 'width=600,height=700,scrollbars=yes,resizable=yes')

    // Listen for messages from the popup
    const messageHandler = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'MICROSOFT_AUTH_SUCCESS') {
        console.log('✅ Received Microsoft auth success message from popup')
        // Refresh auth status after successful authentication
        todoStore.checkAuthStatus()
        window.removeEventListener('message', messageHandler)
        clearInterval(checkClosed)
      } else if (event.data.type === 'MICROSOFT_AUTH_ERROR') {
        console.log('❌ Received Microsoft auth error message from popup:', event.data.error)
        logger.error('Microsoft OAuth error:', event.data.error)
        window.removeEventListener('message', messageHandler)
        clearInterval(checkClosed)
      }
    }

    window.addEventListener('message', messageHandler)

    // Clean up listener if popup is closed manually (handle COOP errors)
    const checkClosed = setInterval(() => {
      try {
        if (popup?.closed) {
          window.removeEventListener('message', messageHandler)
          clearInterval(checkClosed)
        }
      } catch {
        // COOP policy blocks window.closed access - this is expected
        // We'll rely on the message-based communication instead
      }
    }, 1000)

    // Clean up after a reasonable timeout (5 minutes)
    setTimeout(() => {
      window.removeEventListener('message', messageHandler)
      clearInterval(checkClosed)
    }, 5 * 60 * 1000)

  } catch (error) {
    logger.error('Failed to start Microsoft OAuth flow:', error)
  }
}

const handleDisconnect = async () => {
  if (confirm('Are you sure you want to disconnect Microsoft To Do? This will remove access to your synced tasks.')) {
    try {
      await todoStore.disconnect()
    } catch (error) {
      logger.error('Failed to disconnect Microsoft account:', error)
    }
  }
}

const handleRefreshSync = async () => {
  try {
    await todoStore.refreshCache()
  } catch (error) {
    logger.error('Failed to refresh sync:', error)
  }
}

const clearErrors = () => {
  todoStore.clearErrors()
}


const formatLastSync = (): string => {
  if (!syncStatus.value) return 'Unknown'

  // Find the most recent sync from all workspaces
  const recentSync = syncStatus.value.workspace_statuses
    .filter(ws => ws.last_sync)
    .sort((a, b) => (b.last_sync || 0) - (a.last_sync || 0))[0]

  if (!recentSync?.last_sync) return 'Unknown'

  try {
    return new Date(recentSync.last_sync * 1000).toLocaleString()
  } catch {
    return 'Unknown'
  }
}

// Check auth status on mount
todoStore.checkAuthStatus()
</script>

<style scoped>
.microsoft-connect {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--background-secondary);
}

.connect-section {
  text-align: center;
}

.connect-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
  margin: 0 auto;
}

.connect-button:hover:not(:disabled) {
  background: var(--accent-color-hover);
}

.connect-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.microsoft-icon {
  flex-shrink: 0;
}

.connect-description {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.connected-section {
  space-y: 1rem;
}

.connected-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--success-background);
  border-radius: 4px;
  color: var(--success-text);
  font-size: 0.9rem;
}

.check-icon {
  color: var(--success-color);
  flex-shrink: 0;
}

.connected-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background);
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover:not(:disabled) {
  background: var(--background-hover);
  border-color: var(--border-hover);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-button {
  flex: 1;
}

.disconnect-button {
  color: var(--danger-text);
  border-color: var(--danger-border);
}

.disconnect-button:hover:not(:disabled) {
  background: var(--danger-background);
}

.sync-status {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--background);
  border-radius: 4px;
  font-size: 0.8rem;
}

.sync-summary {
  font-weight: 500;
  color: var(--text-primary);
}

.last-sync {
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--danger-background);
  color: var(--danger-text);
  border-radius: 4px;
  font-size: 0.8rem;
}

.error-icon {
  flex-shrink: 0;
  color: var(--danger-color);
}

.clear-error {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--danger-text);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.clear-error:hover {
  background: rgba(0, 0, 0, 0.1);
}
</style>