<template>
  <div class="status-bar" v-show="!isMobile || !statsOpen">
    <div class="status-left">
      <!-- Connection Status -->
      <div class="status-item connection-status" :class="connectionStatusClass">
        <div class="status-indicator"></div>
        <span class="status-text">{{ connectionStatusText }}</span>
      </div>

      <!-- Active Sessions Count -->
      <div v-if="terminalStore.panes.length > 0" class="status-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4,17 10,11 4,5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <span>{{ terminalStore.panes.length }} session{{ terminalStore.panes.length > 1 ? 's' : '' }}</span>
      </div>

      <!-- Current Layout -->
      <div v-if="terminalStore.panes.length > 0" class="status-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="9" x2="15" y2="9"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <span>{{ layoutDisplayName }}</span>
      </div>
    </div>

    <div class="status-center">
      <!-- Current Working Directory -->
      <div v-if="workspaceStore.selectedWorkspace" class="status-item workspace-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
        <span class="workspace-path">{{ workspaceStore.selectedWorkspace.path }}</span>
      </div>
    </div>

    <div class="status-right">
      <!-- Background Tasks Indicator -->
      <div v-if="hasBackgroundTasks" class="status-item background-tasks" @click="toggleBackgroundTasks">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="m12 1 0 6m0 6 0 6m11-7-6 0m-6 0-6 0m11.66-4.66-4.24 4.24m-5.66 0-4.24-4.24m14.1 9.9-4.24-4.24m-5.66 0-4.24 4.24"></path>
        </svg>
        <span>{{ backgroundTasksCount }} task{{ backgroundTasksCount > 1 ? 's' : '' }}</span>
      </div>

      <!-- Memory Usage -->
      <div class="status-item memory-usage"
           :title="`Memory: ${systemInfo.memoryUsage || '0 B'}`">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
          <rect x="9" y="9" width="6" height="6"></rect>
          <line x1="9" y1="1" x2="9" y2="4"></line>
          <line x1="15" y1="1" x2="15" y2="4"></line>
          <line x1="9" y1="20" x2="9" y2="23"></line>
          <line x1="15" y1="20" x2="15" y2="23"></line>
          <line x1="20" y1="9" x2="23" y2="9"></line>
          <line x1="20" y1="14" x2="23" y2="14"></line>
          <line x1="1" y1="9" x2="4" y2="9"></line>
          <line x1="1" y1="14" x2="4" y2="14"></line>
        </svg>
        <span>{{ systemInfo.memoryUsage || '0 B' }}</span>
      </div>

      <!-- CPU Usage -->
      <div class="status-item"
           :title="`CPU: ${systemInfo.cpuUsage || '0%'}`">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"></polygon>
        </svg>
        <span>{{ systemInfo.cpuUsage || '0%' }}</span>
      </div>

      <!-- System Info -->
      <div class="status-item"
           :title="`${systemInfo.platform || 'unknown'} • Uptime: ${systemInfo.uptime || '0m'}`">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12,6 12,12 16,14"></polyline>
        </svg>
        <span>{{ systemInfo.uptime || '0m' }}</span>
      </div>

      <!-- Version Info -->
      <div class="status-item version-info">
        <span class="version-text">v{{ appVersion }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTerminalStore } from '@/stores/terminal'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { socketService } from '@/services/socket'
import type { Subscription } from '@/utils/reactive'

const workspaceStore = useWorkspaceStore()
const terminalStore = useTerminalStore()
const uiStore = useUIStore()
const authStore = useAuthStore()

const statsOpen = ref(false)

// Mobile detection
const isMobile = computed(() => {
  return window.innerWidth < 768
})

// Connection status
const connectionStatusClass = computed(() => {
  if (socketService.isConnected && authStore.isAuthenticated) {
    return 'connected'
  } else if (authStore.isAuthenticated) {
    return 'connecting'
  } else {
    return 'disconnected'
  }
})

const connectionStatusText = computed(() => {
  if (socketService.isConnected && authStore.isAuthenticated) {
    return 'Connected'
  } else if (authStore.isAuthenticated) {
    return 'Connecting...'
  } else {
    return 'Not authenticated'
  }
})

// Layout display name
const layoutDisplayName = computed(() => {
  const layout = terminalStore.currentLayout
  switch (layout) {
    case 'single': return 'Single'
    case 'horizontal-split': return 'Horizontal'
    case 'vertical-split': return 'Vertical'
    case 'grid-2x2': return 'Grid 2×2'
    default: return 'Unknown'
  }
})

// Background tasks
const hasBackgroundTasks = computed(() => backgroundTasksCount.value > 0)
const backgroundTasksCount = computed(() => {
  // This would be connected to your background tasks store
  // For now, returning 0 as placeholder
  return 0
})

const toggleBackgroundTasks = () => {
  uiStore.setShowBackgroundTasks(!uiStore.showBackgroundTasks)
}

// System info (enhanced from both components)
const systemInfo = computed(() => ({
  memoryUsage: '0 B',
  cpuUsage: '0%',
  uptime: '0m',
  platform: 'unknown'
}))

// App version (placeholder)
const appVersion = '1.0.0'

let statsSubscription: Subscription | null = null

const handleStatsData = () => {
  // Handle real-time stats data when available
  // For now, keeping placeholder values
}

onMounted(() => {
  // Subscribe to real-time stats
  if (socketService.isConnected) {
    socketService.subscribeToStats()
  }

  // Listen for stats data events
  statsSubscription = socketService.subscribe('stats:data', handleStatsData)
})

onBeforeUnmount(() => {
  // Clean up subscription
  if (statsSubscription) {
    statsSubscription.unsubscribe()
  }

  // Unsubscribe from stats
  if (socketService.isConnected) {
    socketService.unsubscribeFromStats()
  }
})
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 12px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  min-height: 28px;
}

.status-left,
.status-center,
.status-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-left {
  flex: 1;
  justify-content: flex-start;
}

.status-center {
  flex: 2;
  justify-content: center;
}

.status-right {
  flex: 1;
  justify-content: flex-end;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.status-item svg {
  flex-shrink: 0;
  opacity: 0.7;
  color: var(--text-muted);
}

.connection-status {
  padding-left: 4px;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 2px;
}

.connection-status.connected .status-indicator {
  background-color: var(--success);
  box-shadow: 0 0 4px rgba(34, 197, 94, 0.4);
}

.connection-status.connecting .status-indicator {
  background-color: var(--warning);
  animation: pulse 2s ease-in-out infinite;
}

.connection-status.disconnected .status-indicator {
  background-color: var(--error);
}

.workspace-info {
  max-width: 300px;
}

.workspace-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.background-tasks {
  cursor: pointer;
}

.background-tasks:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.memory-usage {
  font-family: monospace;
  color: var(--info);
}

.version-info {
  opacity: 0.6;
}

.version-text {
  font-family: monospace;
  font-size: 10px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .status-bar {
    padding: 6px 16px;
    font-size: 11px;
    border-radius: 12px 12px 0 0;
  }

  .status-left,
  .status-right {
    gap: 12px;
  }

  .status-center {
    display: none;
  }

  .status-right .status-item:nth-child(n+3) {
    display: none;
  }

  .status-item {
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }
}

@media (max-width: 480px) {
  .status-bar {
    padding: 4px 12px;
    font-size: 10px;
    gap: 8px;
  }

  .status-left,
  .status-right {
    gap: 8px;
  }

  .status-right .status-item:nth-child(n+2) {
    display: none;
  }

  .status-left .status-item:nth-child(n+2) {
    display: none;
  }

  .status-item span {
    display: none;
  }

  .status-item svg {
    display: block;
  }

  .connection-status .status-text {
    display: none;
  }
}
</style>