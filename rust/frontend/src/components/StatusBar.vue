<template>
  <div class="status-bar" v-show="!isMobile || !statsOpen">
    <div class="status-left">
      <div class="status-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
          <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
        </svg>
        <span>{{ stats.sessions?.active || 0 }} sessions</span>
      </div>
      <div class="status-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>{{ stats.workspaces?.active || 0 }} workspaces</span>
      </div>
    </div>
    
    <div class="status-right">
      <div 
        class="status-item memory-usage" 
        :title="`Memory: ${stats.resources?.memory?.formatted?.used || '0 B'} / ${stats.resources?.memory?.formatted?.limit || '0 B'} (${stats.resources?.memory?.percentage || 0}%)`"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
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
        <span>{{ stats.resources?.memory?.formatted?.used || '0 B' }}</span>
      </div>
      
      <div 
        class="status-item" 
        :title="`CPU: ${stats.resources?.cpu?.percentage || 0}% (${stats.resources?.cpu?.formatted?.limit || 'unknown'})`"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"></polygon>
        </svg>
        <span>{{ stats.resources?.cpu?.percentage || 0 }}%</span>
      </div>
      
      <div 
        class="status-item" 
        :title="`Workspace Storage: ${stats.resources?.disk?.workspaces?.formatted || '0 B'}`"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
          <line x1="22" y1="12" x2="2" y2="12"></line>
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
        </svg>
        <span>{{ stats.resources?.disk?.workspaces?.formatted || '0 B' }}</span>
      </div>
      
      <div class="status-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12,6 12,12 16,14"></polyline>
        </svg>
        <span>{{ stats.system?.uptimeFormatted || '0m' }}</span>
      </div>
      
      <div 
        class="status-item" 
        :title="`${stats.system?.platform || 'unknown'} • Node.js ${stats.system?.nodeVersion || 'unknown'} • Containerized`"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <span>{{ stats.system?.containerized ? 'Docker' : stats.system?.platform || 'System' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

interface SystemStats {
  sessions?: { active: number }
  workspaces?: { active: number }
  resources?: {
    memory?: {
      formatted?: { used: string; limit: string }
      percentage?: number
    }
    cpu?: {
      percentage?: number
      formatted?: { limit: string }
    }
    disk?: {
      workspaces?: { formatted: string }
    }
  }
  system?: {
    uptimeFormatted?: string
    platform?: string
    nodeVersion?: string
    containerized?: boolean
  }
}

const stats = ref<SystemStats>({})
const statsOpen = ref(false)

// Mobile detection
const isMobile = computed(() => {
  return window.innerWidth < 768
})

// Mock stats for now - will be replaced with real API calls
const updateStats = () => {
  stats.value = {
    sessions: { active: 1 },
    workspaces: { active: 1 },
    resources: {
      memory: {
        formatted: { used: '128 MB', limit: '512 MB' },
        percentage: 25
      },
      cpu: {
        percentage: 15,
        formatted: { limit: '1 core' }
      },
      disk: {
        workspaces: { formatted: '45 MB' }
      }
    },
    system: {
      uptimeFormatted: '2h 15m',
      platform: 'Linux',
      nodeVersion: '18.17.0',
      containerized: true
    }
  }
}

let statsInterval: number

onMounted(() => {
  updateStats()
  // Update stats every 5 seconds
  statsInterval = window.setInterval(updateStats, 5000)
})

onBeforeUnmount(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
  }
})
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
  min-height: 28px;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.memory-usage {
  color: var(--info);
}

@media (max-width: 768px) {
  .status-bar {
    padding: 4px 12px;
    font-size: 10px;
  }
  
  .status-left,
  .status-right {
    gap: 8px;
  }
  
  .status-right .status-item:nth-child(n+3) {
    display: none;
  }
}

@media (max-width: 480px) {
  .status-right .status-item:nth-child(n+2) {
    display: none;
  }
}
</style>