<template>
  <div class="terminal-panel">
    <!-- Welcome Screen -->
    <div v-if="!workspaceStore.selectedWorkspace" class="welcome-screen">
      <h2>Welcome to AI Code Terminal</h2>
      <p>
        Select a workspace from the sidebar or clone a repository to get started.<br/>
        Once connected, you'll have god-mode terminal access to your repositories.
      </p>
      <button @click="showRepositoriesModal = true" class="btn btn-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="6" y1="3" x2="6" y2="21"></line>
          <line x1="18" y1="3" x2="18" y2="21"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        Clone Your First Repository
      </button>
    </div>

    <!-- Session Reconnection Screen -->
    <div v-else-if="showSessionReconnect" class="session-reconnect">
      <h2>Restore Terminal Sessions</h2>
      <p>
        We found {{ persistentSessions.length }} persistent terminal session(s) for this workspace.<br/>
        Would you like to restore them or start fresh?
      </p>

      <div class="sessions-list">
        <div v-for="session in persistentSessions" :key="session.id" class="session-item">
          <div class="session-info">
            <span class="session-name">{{ session.session_name || 'Terminal Session' }}</span>
            <span class="session-status">{{ session.status }}</span>
            <span class="session-time">{{ new Date(session.created_at).toLocaleString() }}</span>
          </div>
          <button @click="reconnectToSession(session)" class="btn btn-primary">
            Reconnect
          </button>
        </div>
      </div>

      <div class="session-actions">
        <button @click="createNewSession" class="btn btn-secondary">
          Start Fresh Terminal
        </button>
      </div>
    </div>

    <!-- Terminal Interface -->
    <template v-else>
      <!-- Layout Controls -->
      <div class="layout-controls">
        <div class="layout-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
            <polyline points="4,17 10,11 4,5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span v-if="terminalStore.panes.length <= 1">Single Terminal</span>
          <span v-else>{{ formatLayoutName(terminalStore.currentLayout) }} ({{ terminalStore.panes.length }} panes)</span>
          <span v-if="layoutStore.currentLayout" class="current-layout-name">
            • {{ layoutStore.currentLayout.name }}
          </span>
        </div>

        <div class="layout-actions">
          <!-- Layout Management -->
          <div class="layout-dropdown" v-if="workspaceStore.selectedWorkspace">
            <button class="action-btn" @click="showLayoutMenu = !showLayoutMenu" title="Layout management">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
                <line x1="9" y1="17" x2="13" y2="17"></line>
              </svg>
            </button>

            <!-- Layout Menu -->
            <div v-if="showLayoutMenu" class="layout-menu" @click.stop>
              <!-- Save Layout -->
              <div class="menu-section">
                <div class="menu-header">Save Current Layout</div>
                <div class="save-layout-form">
                  <input
                    v-model="newLayoutName"
                    type="text"
                    placeholder="Layout name..."
                    class="layout-name-input"
                    @keyup.enter="() => saveCurrentLayout(false)"
                  />
                  <div class="save-actions">
                    <button
                      @click="saveCurrentLayout(false)"
                      class="btn-save"
                      :disabled="!newLayoutName.trim()"
                      title="Save layout"
                    >
                      Save
                    </button>
                    <button
                      @click="saveCurrentLayout(true)"
                      class="btn-set-default"
                      :disabled="!newLayoutName.trim()"
                      title="Save and set as default"
                    >
                      Save as Default
                    </button>
                  </div>
                </div>
              </div>

              <!-- Load Layout -->
              <div v-if="layoutStore.workspaceLayouts(workspaceStore.selectedWorkspace.id).length > 0" class="menu-section">
                <div class="menu-header">Load Layout</div>
                <div class="layout-list">
                  <div
                    v-for="layout in layoutStore.workspaceLayouts(workspaceStore.selectedWorkspace.id)"
                    :key="layout.id"
                    class="layout-item"
                    :class="{ active: layoutStore.currentLayout?.id === layout.id }"
                  >
                    <div class="layout-item-info" @click="loadLayout(layout)">
                      <span class="layout-name">{{ layout.name }}</span>
                      <span v-if="layout.is_default" class="layout-badge">Default</span>
                    </div>
                    <div class="layout-item-actions">
                      <button
                        @click="setLayoutAsDefault(layout.id)"
                        class="action-btn-small"
                        :class="{ active: layout.is_default }"
                        title="Set as default"
                      >
                        ★
                      </button>
                      <button
                        @click="duplicateLayout(layout)"
                        class="action-btn-small"
                        title="Duplicate layout"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <button
                        @click="deleteLayout(layout)"
                        class="action-btn-small delete"
                        title="Delete layout"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3,6 5,6 21,6"></polyline>
                          <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0,0,1-2-2V6m3,0V4a2,2 0,0,1,2-2h4a2,2 0,0,1,2,2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="menu-section">
                <div class="no-layouts">No saved layouts</div>
              </div>
            </div>
          </div>

          <!-- New Terminal -->
          <button class="action-btn" @click="createNewTerminal" title="New terminal session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <!-- Layout Switcher -->
        <div v-if="!uiStore.isMobile" class="layout-switcher">
          <button
            v-for="layout in terminalStore.layoutRecommendations.supported"
            :key="layout"
            class="layout-btn"
            :class="{ active: terminalStore.currentLayout === layout }"
            @click="switchLayout(layout)"
            :title="formatLayoutName(layout)"
          >
            <div :class="`layout-preview ${layout}`"></div>
          </button>
        </div>
      </div>

      <!-- Terminal Container -->
      <div
        class="terminal-container"
        :style="{
          'grid-template-columns': terminalStore.gridTemplateColumns,
          'grid-template-rows': terminalStore.gridTemplateRows
        }"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <TerminalPane
          v-for="pane in terminalStore.panes"
          :key="pane.id"
          :pane="pane as any"
          :is-active="pane.id === terminalStore.activePane"
          :workspace-path="workspaceStore.selectedWorkspace?.path"
          :can-split="terminalStore.panes.length < 4"
          :show-close-button="terminalStore.panes.length > 1"
          @focus="handleTerminalFocus"
          @close="closeTerminal(pane.id)"
          @split="handleSplit"
          @data="(data: string) => handleTerminalData(pane.id, data)"
          @resize="(cols: number, rows: number) => handleTerminalResize(pane.id, cols, rows)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useTerminalStore } from '../stores/terminal'
import { useUIStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { useLayoutStore } from '../stores/layout'
import { socketService } from '../services/socket'
import { apiService } from '../services/api'
import TerminalPane from './TerminalPane.vue'
import type { Session } from '../types'
import type { LayoutType } from '../types/layout'

const workspaceStore = useWorkspaceStore()
const terminalStore = useTerminalStore()
const uiStore = useUIStore()
const authStore = useAuthStore()
const layoutStore = useLayoutStore()
const showRepositoriesModal = ref(false)

const showLayoutMenu = ref(false)
const newLayoutName = ref('')
const isConnected = ref(false)
const persistentSessions = ref<Session[]>([])
const showSessionReconnect = ref(false)

const touchStartX = ref(0)
const touchStartY = ref(0)
const touchEndX = ref(0)
const touchEndY = ref(0)
const minSwipeDistance = 50
const maxVerticalDistance = 100

const formatLayoutName = (layout: string) => {
  return layout.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const loadPersistentSessions = async () => {
  if (!workspaceStore.selectedWorkspace || !workspaceStore.selectedWorkspace.id) return

  try {
    const sessions = await apiService.getSessions(workspaceStore.selectedWorkspace.id)
    persistentSessions.value = sessions.filter(session =>
      session.status === 'active' || session.status === 'disconnected'
    )
    showSessionReconnect.value = persistentSessions.value.length > 0
  } catch (error) {
    console.error('Failed to load persistent sessions:', error)
  }
}

watch(() => workspaceStore.selectedWorkspace, async (newWorkspace) => {
  if (newWorkspace) {
    await loadPersistentSessions()
  } else {
    persistentSessions.value = []
    showSessionReconnect.value = false
  }
})

// **FIX:** Create a computed property that generates a "signature" of the layout structure.
const layoutSignature = computed(() => {
  if (!terminalStore.hasPanes) return '';
  const paneSignatures = terminalStore.panes
    .map(p => `${p.id}:${p.tabs.length}`)
    .sort() // Sort to make it deterministic regardless of pane order
    .join('|');
  return `${terminalStore.currentLayout}|${paneSignatures}`;
});


// **FIX:** Watch the layout signature instead of a deep watch on the panes array.
watch(layoutSignature, (newSignature, oldSignature) => {
  // Only save if the structure has actually changed and is not the initial setup.
  if (newSignature && oldSignature && newSignature !== oldSignature && workspaceStore.selectedWorkspace && terminalStore.panes.length > 0) {
    const layoutConfig = {
      layout_type: terminalStore.currentLayout,
      type: terminalStore.currentLayout,
      panes: terminalStore.panes.map(pane => ({
        id: pane.id,
        name: pane.name,
        pane_type: 'Terminal',
        tabs: pane.tabs.map(tab => ({
          id: tab.id,
          session_id: tab.sessionId,
          name: tab.name,
          is_active: tab.isActive,
          order: tab.order
        })),
        active_tab: pane.activeTabId
      })),
      active_pane: terminalStore.activePane,
      timestamp: new Date().toISOString()
    }

    // **FIX:** Pass `true` for the new `silent` parameter.
    layoutStore.debouncedSaveLayout(
      `Auto-saved ${terminalStore.currentLayout} layout`,
      workspaceStore.selectedWorkspace.id,
      { ...layoutConfig, type: layoutConfig.layout_type || 'single' },
      false, // isDefault
      true // silent
    )
  }
})

const reconnectToSession = async (session: Session) => {
  if (!workspaceStore.selectedWorkspace || !workspaceStore.selectedWorkspace.id) {
    console.error('No workspace selected for session reconnection')
    return
  }

  try {
    const pane = await terminalStore.createTerminal(workspaceStore.selectedWorkspace.id)
    if (pane) {
      const terminalInstance = terminalStore.panes.find(p => p.id === pane.id); // This is simplified
      if (terminalInstance) {
          try {
              const history = await apiService.getSessionHistory(session.id)
              // The TerminalPane component would need a method to display this history
              console.log(`Restored history for session ${session.id}:`, history);
          } catch (historyError) {
              console.warn('Failed to load session history:', historyError)
          }
      }
    }

    showSessionReconnect.value = false
  } catch (error) {
    console.error('Failed to reconnect to session:', error)
  }
}

const createNewSession = async () => {
  await createNewTerminal()
  showSessionReconnect.value = false
}

const creatingTerminal = ref(false)

const createNewTerminal = async () => {
  if (creatingTerminal.value) return
  if (workspaceStore.selectedWorkspace) {
    creatingTerminal.value = true
    try {
      await terminalStore.createTerminal(workspaceStore.selectedWorkspace.id)
    } finally {
      creatingTerminal.value = false
    }
  }
}

const handleTerminalData = (paneId: string, data: string) => {
  terminalStore.sendInput(paneId, data)
}

const handleTerminalResize = (paneId: string, cols: number, rows: number) => {
  terminalStore.resizePane(paneId, cols, rows)
}

const handleTerminalFocus = (paneId: string) => {
  terminalStore.setActivePane(paneId)
}

const handleSplit = async (direction: 'horizontal' | 'vertical') => {
  if (!workspaceStore.selectedWorkspace) return

  const currentLayout = terminalStore.currentLayout
  let newLayout: typeof currentLayout = currentLayout

  if (currentLayout === 'single') {
    newLayout = direction === 'horizontal' ? 'horizontal-split' : 'vertical-split'
  } else if (currentLayout === 'horizontal-split' && direction === 'vertical') {
    newLayout = 'grid-2x2'
  } else if (currentLayout === 'vertical-split' && direction === 'horizontal') {
    newLayout = 'grid-2x2'
  }

  if (newLayout !== currentLayout) {
    await terminalStore.setLayout(newLayout)
  }

  await createNewTerminal()
}

const handleTouchStart = (event: TouchEvent) => {
  if (!uiStore.isMobile || terminalStore.panes.length <= 1) return
  touchStartX.value = event.touches[0].clientX
  touchStartY.value = event.touches[0].clientY
}

const handleTouchMove = (event: TouchEvent) => {
  if (!uiStore.isMobile || terminalStore.panes.length <= 1) return
  touchEndX.value = event.touches[0].clientX
  touchEndY.value = event.touches[0].clientY
}

const handleTouchEnd = () => {
  if (!uiStore.isMobile || terminalStore.panes.length <= 1) return

  const deltaX = touchEndX.value - touchStartX.value
  const deltaY = Math.abs(touchEndY.value - touchStartY.value)

  if (Math.abs(deltaX) > minSwipeDistance && deltaY < maxVerticalDistance) {
    const currentIndex = terminalStore.panes.findIndex(pane => pane.id === terminalStore.activePane)
    if (currentIndex !== -1) {
      let nextIndex
      if (deltaX > 0) {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : terminalStore.panes.length - 1
      } else {
        nextIndex = currentIndex < terminalStore.panes.length - 1 ? currentIndex + 1 : 0
      }
      const nextPane = terminalStore.panes[nextIndex]
      if (nextPane) {
        terminalStore.setActivePane(nextPane.id)
        console.log(`Switched to terminal ${nextIndex + 1} of ${terminalStore.panes.length}`)
      }
    }
  }
}

const closeTerminal = async (paneId: string) => {
  await terminalStore.closeTerminal(paneId)
}

const switchLayout = async (layout: LayoutType) => {
  await terminalStore.setLayout(layout)
    if (workspaceStore.selectedWorkspace) {
      const layoutConfig = {
        layout_type: layout,
        type: layout,
        panes: terminalStore.panes.map(pane => ({
          id: pane.id,
          name: pane.name,
          pane_type: 'Terminal',
          tabs: pane.tabs.map(tab => ({
            id: tab.id,
            session_id: tab.sessionId,
            name: tab.name,
            is_active: tab.isActive,
            order: tab.order
          })),
          active_tab: pane.activeTabId
        })),
        active_pane: terminalStore.activePane,
        timestamp: new Date().toISOString()
      }
      layoutStore.debouncedSaveLayout(
        `Auto-saved ${layout} layout`,
        workspaceStore.selectedWorkspace.id,
        layoutConfig,
        false
      )
    }
}

const saveCurrentLayout = async (setDefault = false) => {
  if (!workspaceStore.selectedWorkspace || !newLayoutName.value.trim()) return
  try {
    const layoutConfig = {
      layout_type: terminalStore.currentLayout,
      type: terminalStore.currentLayout,
      panes: terminalStore.panes.map(pane => ({
        id: pane.id,
        name: pane.name,
        pane_type: 'Terminal',
        tabs: pane.tabs.map(tab => ({
          id: tab.id,
          session_id: tab.sessionId,
          name: tab.name,
          is_active: tab.isActive,
          order: tab.order
        })),
        active_tab: pane.activeTabId
      })),
      active_pane: terminalStore.activePane,
      timestamp: new Date().toISOString()
    }
    await layoutStore.saveCurrentLayout(
      newLayoutName.value.trim(),
      workspaceStore.selectedWorkspace.id,
      { ...layoutConfig, type: layoutConfig.layout_type || 'single' },
      setDefault,
      false // Not silent, this is a manual save
    )
    newLayoutName.value = ''
    showLayoutMenu.value = false
  } catch (err) {
    console.error('Failed to save layout:', err)
  }
}

const loadLayout = async (layout: import('@/stores/layout').Layout) => {
  try {
    await terminalStore.setLayout(layout.configuration.type as LayoutType)
    layoutStore.setCurrentLayout(layout)
    showLayoutMenu.value = false
  } catch (err) {
    console.error('Failed to load layout:', err)
  }
}

const setLayoutAsDefault = async (layoutId: string) => {
  try {
    await layoutStore.setDefaultLayout(layoutId)
  } catch (err) {
    console.error('Failed to set layout as default:', err)
  }
}

const duplicateLayout = async (layout: import('@/stores/layout').Layout) => {
  try {
    const newName = `${layout.name} (Copy)`
    await layoutStore.duplicateLayout(layout.id, newName)
  } catch (err) {
    console.error('Failed to duplicate layout:', err)
  }
}

const deleteLayout = async (layout: import('@/stores/layout').Layout) => {
  if (!confirm(`Are you sure you want to delete the layout "${layout.name}"?`)) return
  try {
    await layoutStore.deleteLayout(layout.id)
    if (layoutStore.currentLayout?.id === layout.id) {
      layoutStore.setCurrentLayout(null)
    }
  } catch (err) {
    console.error('Failed to delete layout:', err)
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (showLayoutMenu.value && !event.composedPath().some((el: Element) =>
    el.classList?.contains('layout-dropdown') || el.classList?.contains('layout-menu')
  )) {
    showLayoutMenu.value = false
  }
}

const initializeSocketConnection = async () => {
  try {
    await authStore.connectWebSocket()
    isConnected.value = socketService.isConnected
    if (isConnected.value) {
      console.log('✅ WebSocket connected successfully')
    }
  } catch (error) {
    console.error('❌ Failed to connect to WebSocket:', error)
    isConnected.value = false
  }
}

onMounted(async () => {
  terminalStore.initialize()
  await initializeSocketConnection()

  if (workspaceStore.selectedWorkspace) {
    await loadPersistentSessions()
    if (!showSessionReconnect.value && terminalStore.panes.length === 0) {
      await createNewTerminal()
    }
  }

  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  terminalStore.cleanup()
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style>

</style>

<style scoped>
.terminal-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--terminal-bg);
  overflow: hidden;
}

.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 64px 32px;
  background: radial-gradient(ellipse at center, rgba(0, 123, 204, 0.05) 0%, transparent 50%);
  position: relative;
}

.welcome-screen::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="1" fill="rgba(255,255,255,0.02)"/></svg>') repeat;
  pointer-events: none;
}

.welcome-screen h2 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-screen p {
  color: var(--text-secondary);
  font-size: 17px;
  line-height: 1.6;
  margin-bottom: 40px;
  max-width: 560px;
  z-index: 1;
  position: relative;
}

.session-reconnect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 56px 32px;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

.session-reconnect h2 {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.session-reconnect h2::before {
  content: '🔌';
  font-size: 24px;
}

.session-reconnect p {
  color: var(--text-secondary);
  font-size: 17px;
  line-height: 1.6;
  margin-bottom: 36px;
  max-width: 640px;
}

.sessions-list {
  width: 100%;
  max-width: 600px;
  margin-bottom: 32px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.session-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  border-color: var(--primary);
}

.session-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.session-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.session-status {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: capitalize;
}

.session-time {
  font-size: 11px;
  color: var(--text-muted);
}

.session-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--button-bg);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:hover {
  background: var(--button-hover);
}

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.layout-controls {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, rgba(37, 37, 38, 0.95) 100%);
  border-bottom: 1px solid var(--border-color);
  gap: 20px;
  flex-shrink: 0;
  backdrop-filter: blur(10px);
  position: relative;
}

.layout-controls::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%);
  opacity: 0.3;
}

.layout-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.current-layout-name {
  color: var(--primary);
  font-weight: 500;
}

.icon {
  color: var(--text-muted);
}

.layout-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.layout-dropdown {
  position: relative;
}

.layout-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  min-width: 280px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 4px;
}

.menu-section {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.menu-section:last-child {
  border-bottom: none;
}

.menu-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.save-layout-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layout-name-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.layout-name-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}

.save-actions {
  display: flex;
  gap: 6px;
}

.btn-save,
.btn-set-default {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save {
  background: var(--primary);
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-set-default {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-set-default:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-save:disabled,
.btn-set-default:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.layout-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layout-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.layout-item:hover {
  background: var(--bg-hover);
}

.layout-item.active {
  background: var(--primary-bg);
}

.layout-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  cursor: pointer;
}

.layout-name {
  font-size: 13px;
  color: var(--text-primary);
}

.layout-badge {
  background: var(--primary);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.layout-item-actions {
  display: flex;
  gap: 4px;
}

.action-btn-small {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 12px;
}

.action-btn-small:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn-small.active {
  color: var(--primary);
}

.action-btn-small.delete:hover {
  background: var(--error-bg);
  color: var(--error);
}

.no-layouts {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 16px;
}

.action-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(0, 123, 204, 0.2);
  transition: all 0.3s ease;
  transform: translate(-50%, -50%);
}

.action-btn:hover {
  background: var(--button-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.action-btn:hover::before {
  width: 100px;
  height: 100px;
}

.action-btn:active {
  transform: translateY(0);
}

.layout-switcher {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.layout-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.layout-btn:hover {
  background: var(--button-hover);
}

.layout-btn.active {
  background: var(--primary);
  border-color: var(--primary);
}

.layout-preview {
  width: 16px;
  height: 12px;
  border: 1px solid var(--text-muted);
  border-radius: 2px;
}

.layout-preview.horizontal {
  border-bottom: 1px solid var(--text-muted);
}

.layout-preview.vertical {
  border-right: 1px solid var(--text-muted);
}

.layout-preview.grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 1px;
}

.layout-preview.grid-2x2::before,
.layout-preview.grid-2x2::after {
  content: '';
  border: 1px solid var(--text-muted);
}

.layout-preview.three-pane {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 1px;
}

.layout-preview.three-pane::before,
.layout-preview.three-pane::after {
  content: '';
  border: 1px solid var(--text-muted);
}

.layout-btn.active .layout-preview {
  border-color: white;
}

.terminal-container {
  flex: 1;
  display: grid;
  gap: 1px;
  background: var(--border-color);
  overflow: hidden;
}

@media (max-width: 768px) {
  .layout-controls {
    padding: 6px 12px;
  }

  .layout-info span {
    display: none;
  }

  .layout-switcher {
    display: none;
  }

  .pane-cwd {
    display: none;
  }
}
</style>
