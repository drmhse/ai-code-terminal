<template>
  <div class="status-bar" v-show="!isMobile || !statsOpen">
    <div class="status-left">
      <!-- Connection Status -->
      <div class="status-item connection-status" :class="connectionStatusClass">
        <div class="status-indicator"></div>
        <span class="status-text">{{ connectionStatusText }}</span>
      </div>

      <!-- Active Sessions Count -->
      <div class="status-item">
        <CommandLineIcon class="status-icon" />
        <span>{{ displaySessionCount }} session{{ displaySessionCount > 1 ? 's' : '' }}</span>
      </div>

      <!-- Current Layout -->
      <div v-if="terminalTreeStore.panes.length > 0" class="status-item">
        <Squares2X2Icon class="status-icon" />
        <span>{{ layoutDisplayName }}</span>
      </div>
    </div>

    <div class="status-center">
      <!-- Current Working Directory -->
      <div v-if="workspaceStore.selectedWorkspace" class="status-item workspace-info">
        <FolderIcon class="status-icon" />
        <span class="workspace-path">{{ workspaceStore.selectedWorkspace.path }}</span>
      </div>
    </div>

    <div class="status-right">
      <!-- Background Tasks Indicator -->
      <div v-if="hasBackgroundTasks" class="status-item background-tasks" @click="toggleBackgroundTasks">
        <CogIcon class="status-icon animate-spin" />
        <span>{{ backgroundTasksCount }} task{{ backgroundTasksCount > 1 ? 's' : '' }}</span>
      </div>

      <!-- Memory Usage -->
      <div class="status-item memory-usage"
           :title="`Memory: ${systemInfo.memoryUsage} (${systemInfo.memoryUsagePercent})`">
        <CpuChipIcon class="status-icon" />
        <span>{{ systemInfo.memoryUsage }}</span>
      </div>

      <!-- CPU Usage -->
      <div class="status-item"
           :title="`CPU: ${systemInfo.cpuUsage}`">
        <BoltIcon class="status-icon" />
        <span>{{ systemInfo.cpuUsage }}</span>
      </div>

      <!-- Disk Usage -->
      <div class="status-item"
           :title="`Disk: ${systemInfo.diskUsage} (${systemInfo.diskUsagePercent})`">
        <CircleStackIcon class="status-icon" />
        <span>{{ systemInfo.diskUsage }}</span>
      </div>

      <!-- System Info -->
      <div class="status-item"
           :title="`Uptime: ${systemInfo.uptime} • Processes: ${systemInfo.processes}`">
        <ClockIcon class="status-icon" />
        <span>{{ systemInfo.uptime }}</span>
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
import { useTerminalTreeStore } from '@/stores/terminal-tree'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { socketService } from '@/services/socket'
import type { Subscription } from '@/utils/reactive'
import type { StatsDataEvent } from '@/types/socket'

// Heroicons imports
import {
  CommandLineIcon,
  Squares2X2Icon,
  FolderIcon,
  CogIcon,
  CpuChipIcon,
  BoltIcon,
  CircleStackIcon,
  ClockIcon
} from '@heroicons/vue/24/outline'

const workspaceStore = useWorkspaceStore()
const terminalTreeStore = useTerminalTreeStore()
const uiStore = useUIStore()
const authStore = useAuthStore()

const statsOpen = ref(false)

// System stats reactive state
const statsData = ref<StatsDataEvent | null>(null)

// Utility functions for formatting
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatUptime = (seconds: number): string => {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

const formatPercentage = (value: number): string => {
  return `${Math.round(value * 10) / 10}%`
}

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

// Layout display name - Tree-based layout
const layoutDisplayName = computed(() => {
  return 'Tree Layout'
})

// Active sessions count from real backend data
const activeSessions = computed(() => {
  return statsData.value?.active_sessions || 0
})

// Display session count - uses backend data when available, falls back to UI panes
const displaySessionCount = computed(() => {
  // If we have backend stats data, use the real active sessions count
  if (statsData.value?.active_sessions !== undefined) {
    return statsData.value.active_sessions
  }
  // Fallback to UI pane count when backend stats aren't loaded yet
  return terminalTreeStore.panes.length
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

// System info with real data processing
const systemInfo = computed(() => {
  if (!statsData.value) {
    return {
      memoryUsage: '0 B',
      memoryUsagePercent: '0%',
      cpuUsage: '0%',
      diskUsage: '0 B',
      diskUsagePercent: '0%',
      uptime: '0s',
      processes: '0',
      platform: 'unknown'
    }
  }

  const stats = statsData.value
  const memoryPercent = stats.memory_total > 0 ? (stats.memory_usage / stats.memory_total) * 100 : 0
  const diskPercent = stats.disk_total > 0 ? (stats.disk_usage / stats.disk_total) * 100 : 0

  return {
    memoryUsage: formatBytes(stats.memory_usage),
    memoryUsagePercent: formatPercentage(memoryPercent),
    cpuUsage: formatPercentage(stats.cpu_usage),
    diskUsage: formatBytes(stats.disk_usage),
    diskUsagePercent: formatPercentage(diskPercent),
    uptime: formatUptime(stats.uptime),
    processes: stats.processes.toString(),
    platform: navigator.platform || 'unknown'
  }
})

// App version (placeholder)
const appVersion = '1.0.0'

let statsSubscription: Subscription | null = null

const handleStatsData = (data: StatsDataEvent) => {
  statsData.value = data
}

onMounted(() => {
  // Subscribe to real-time stats
  if (socketService.isConnected) {
    socketService.subscribeToStats(2) // 2 second interval
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

.status-item .status-icon {
  width: 14px;
  height: 14px;
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