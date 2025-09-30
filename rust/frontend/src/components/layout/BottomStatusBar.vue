<template>
  <div class="status-bar" v-show="!isMobile || !statsOpen">
    <div class="status-section status-left">
      <!-- Connection Status Badge -->
      <button class="status-badge" :class="connectionBadgeClass" :title="connectionStatusText">
        <div class="status-badge-indicator"></div>
        <span class="status-badge-text">{{ connectionStatusText }}</span>
      </button>

      <div class="status-divider"></div>

      <!-- Active Sessions -->
      <div class="status-item" :title="`${displaySessionCount} active ${displaySessionCount === 1 ? 'session' : 'sessions'}`">
        <CommandLineIcon class="status-icon" />
        <span class="status-label">{{ displaySessionCount }}</span>
      </div>

      <!-- Layout Indicator -->
      <div v-if="terminalTreeStore.panes.length > 0" class="status-item" :title="layoutDisplayName">
        <Squares2X2Icon class="status-icon" />
        <span class="status-label">{{ layoutDisplayName }}</span>
      </div>
    </div>

    <div class="status-section status-center">
      <!-- Current Workspace -->
      <div v-if="workspaceStore.selectedWorkspace" class="status-item workspace-item" :title="workspaceStore.selectedWorkspace.path">
        <FolderOpenIcon class="status-icon" />
        <span class="workspace-path">{{ workspaceStore.selectedWorkspace.path }}</span>
      </div>
    </div>

    <div class="status-section status-right">
      <!-- Background Tasks -->
      <button
        v-if="hasBackgroundTasks"
        class="status-item status-item-interactive"
        @click="toggleBackgroundTasks"
        :title="`${backgroundTasksCount} background ${backgroundTasksCount === 1 ? 'task' : 'tasks'} running`">
        <ArrowPathIcon class="status-icon status-icon-spin" />
        <span class="status-label">{{ backgroundTasksCount }}</span>
      </button>

      <div v-if="hasBackgroundTasks" class="status-divider"></div>

      <!-- System Resources -->
      <div class="status-item status-item-metric" :title="`Memory: ${systemInfo.memoryUsage} / ${systemInfo.memoryUsagePercent}`">
        <CpuChipIcon class="status-icon" />
        <span class="status-value">{{ systemInfo.memoryUsage }}</span>
      </div>

      <div class="status-item status-item-metric" :title="`CPU: ${systemInfo.cpuUsage}`">
        <BoltIcon class="status-icon" />
        <span class="status-value">{{ systemInfo.cpuUsage }}</span>
      </div>

      <div class="status-item status-item-metric" :title="`Disk: ${systemInfo.diskUsage} / ${systemInfo.diskUsagePercent}`">
        <CircleStackIcon class="status-icon" />
        <span class="status-value">{{ systemInfo.diskUsage }}</span>
      </div>

      <div class="status-divider"></div>

      <!-- System Uptime -->
      <div class="status-item" :title="`Uptime: ${systemInfo.uptime} • Processes: ${systemInfo.processes}`">
        <ClockIcon class="status-icon" />
        <span class="status-label">{{ systemInfo.uptime }}</span>
      </div>

      <div class="status-divider"></div>

      <!-- Version -->
      <div class="status-item status-item-version" :title="`Version ${appVersion}`">
        <span class="status-version">v{{ appVersion }}</span>
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
  FolderOpenIcon,
  ArrowPathIcon,
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
const connectionBadgeClass = computed(() => {
  if (socketService.isConnected && authStore.isAuthenticated) {
    return 'status-badge-connected'
  } else if (authStore.isAuthenticated) {
    return 'status-badge-connecting'
  } else {
    return 'status-badge-disconnected'
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
// This computed property is intentionally defined for future use

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
/* ========================================
   ATLASSIAN-INSPIRED STATUS BAR
   Modern, clean design with theme support
   ======================================== */

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 26px;
  padding: 0 var(--space-3);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-primary);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  font-family: var(--font-family-sans);
  user-select: none;
}

/* ===== SECTIONS ===== */
.status-section {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 100%;
}

.status-left {
  flex: 1;
  justify-content: flex-start;
}

.status-center {
  flex: 2;
  justify-content: center;
  max-width: 400px;
}

.status-right {
  flex: 1;
  justify-content: flex-end;
}

/* ===== DIVIDER ===== */
.status-divider {
  width: 1px;
  height: 14px;
  background: var(--color-border-secondary);
  opacity: 0.5;
}

/* ===== BASE ITEM STYLES ===== */
.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  height: 20px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
  white-space: nowrap;
  font-weight: var(--font-weight-medium);
}

.status-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--color-text-tertiary);
  transition: color var(--transition-base);
}

.status-label,
.status-value {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  transition: color var(--transition-base);
}

/* ===== CONNECTION BADGE ===== */
.status-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  height: 20px;
  border-radius: var(--radius-base);
  border: 1px solid transparent;
  background: transparent;
  cursor: default;
  transition: all var(--transition-base);
  font-weight: var(--font-weight-medium);
}

.status-badge-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: all var(--transition-base);
}

.status-badge-text {
  font-size: var(--font-size-xs);
  transition: color var(--transition-base);
}

/* Connection states */
.status-badge-connected {
  background: var(--color-semantic-success-bg);
  border-color: var(--color-semantic-success-border);
}

.status-badge-connected .status-badge-indicator {
  background-color: var(--color-semantic-success);
  box-shadow: 0 0 6px var(--color-semantic-success);
}

.status-badge-connected .status-badge-text {
  color: var(--color-semantic-success);
}

.status-badge-connecting {
  background: var(--color-semantic-warning-bg);
  border-color: var(--color-semantic-warning-border);
}

.status-badge-connecting .status-badge-indicator {
  background-color: var(--color-semantic-warning);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.status-badge-connecting .status-badge-text {
  color: var(--color-semantic-warning);
}

.status-badge-disconnected {
  background: var(--color-semantic-error-bg);
  border-color: var(--color-semantic-error-border);
}

.status-badge-disconnected .status-badge-indicator {
  background-color: var(--color-semantic-error);
}

.status-badge-disconnected .status-badge-text {
  color: var(--color-semantic-error);
}

/* ===== WORKSPACE ITEM ===== */
.workspace-item {
  max-width: 400px;
  padding: 0 var(--space-3);
}

.workspace-item .status-icon {
  color: var(--color-interactive-primary);
}

.workspace-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

/* ===== INTERACTIVE ITEMS ===== */
.status-item-interactive {
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
}

.status-item-interactive:hover {
  background: var(--color-interactive-tertiary-hover);
  border-color: var(--color-border-hover);
}

.status-item-interactive:hover .status-icon {
  color: var(--color-interactive-primary);
}

.status-item-interactive:hover .status-label {
  color: var(--color-text-primary);
}

.status-item-interactive:active {
  background: var(--color-interactive-tertiary);
  transform: scale(0.98);
}

/* ===== METRIC ITEMS ===== */
.status-item-metric {
  font-family: var(--font-family-mono);
}

.status-item-metric .status-value {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

/* ===== VERSION ===== */
.status-item-version {
  padding: 0 var(--space-2);
}

.status-version {
  font-family: var(--font-family-mono);
  font-size: 10px;
  color: var(--color-text-tertiary);
  opacity: 0.7;
}

/* ===== ANIMATIONS ===== */
.status-icon-spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

/* ===== RESPONSIVE DESIGN ===== */
@media (max-width: 1024px) {
  .status-right .status-item-metric:nth-child(n+3) {
    display: none;
  }
}

@media (max-width: 768px) {
  .status-bar {
    height: 30px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  .status-center {
    display: none;
  }

  .status-right .status-item:not(.status-item-interactive) {
    display: none;
  }

  .status-right .status-item-version {
    display: flex;
  }

  .status-item {
    padding: 0 var(--space-3);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
  }
}

@media (max-width: 480px) {
  .status-bar {
    height: 28px;
    padding: 0 var(--space-3);
    gap: var(--space-2);
  }

  .status-section {
    gap: var(--space-1);
  }

  .status-badge-text,
  .status-label,
  .status-value {
    display: none;
  }

  .status-divider {
    display: none;
  }

  .status-item-version {
    display: none;
  }

  .status-left .status-item:nth-child(n+3) {
    display: none;
  }
}
</style>