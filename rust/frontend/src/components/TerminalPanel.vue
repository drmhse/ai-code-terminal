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
        </div>

        <div class="layout-actions">
          <button class="action-btn" @click="createNewTerminal" title="New terminal session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <!-- Layout Switcher (simplified) -->
        <div class="layout-switcher">
          <button 
            class="layout-btn"
            :class="{ active: terminalStore.currentLayout === 'single' }"
            @click="switchLayout('single')"
            title="Single pane"
          >
            <div class="layout-preview single"></div>
          </button>
          <button 
            class="layout-btn"
            :class="{ active: terminalStore.currentLayout === 'horizontal-split' }"
            @click="switchLayout('horizontal-split')"
            title="Horizontal split"
          >
            <div class="layout-preview horizontal"></div>
          </button>
          <button 
            class="layout-btn"
            :class="{ active: terminalStore.currentLayout === 'vertical-split' }"
            @click="switchLayout('vertical-split')"
            title="Vertical split"
          >
            <div class="layout-preview vertical"></div>
          </button>
        </div>
      </div>

      <!-- Terminal Container -->
      <div class="terminal-container" :class="`layout-${terminalStore.currentLayout}`">
        <div 
          v-for="pane in terminalStore.panes" 
          :key="pane.id"
          class="terminal-pane"
          :class="{ active: pane.id === terminalStore.activePaneId }"
        >
          <!-- Pane Header -->
          <div class="pane-header">
            <div class="pane-info">
              <span class="pane-title">{{ pane.title || `Terminal ${pane.id}` }}</span>
              <span class="pane-cwd">{{ pane.cwd || workspaceStore.selectedWorkspace?.path }}</span>
            </div>
            <button 
              v-if="terminalStore.panes.length > 1"
              @click="closeTerminal(pane.id)" 
              class="close-btn"
              title="Close terminal"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <!-- Terminal Content -->
          <div class="terminal-content">
            <div 
              :id="`terminal-${pane.id}`" 
              class="xterm-container"
              @click="focusTerminal(pane.id)"
            ></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useWorkspaceStore } from '../stores/workspace'
import { useTerminalStore } from '../stores/terminal'
import { socketService } from '../services/socket'
import { apiService } from '../services/api'
import type { TerminalTheme } from '../types/terminal'

const workspaceStore = useWorkspaceStore()
const terminalStore = useTerminalStore()
const showRepositoriesModal = ref(false)

// Terminal instances map
const terminalInstances = new Map<string, { terminal: Terminal, fitAddon: FitAddon, sessionId: string }>()

// Socket connection state
const isConnected = ref(false)

// Default terminal theme
const defaultTheme: TerminalTheme = {
  background: '#1a1a1a',
  foreground: '#ffffff',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selection: 'rgba(255, 255, 255, 0.3)',
  black: '#000000',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#dcdfe4',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff'
}

const formatLayoutName = (layout: string) => {
  return layout.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const createNewTerminal = async () => {
  if (workspaceStore.selectedWorkspace) {
    const pane = await terminalStore.createTerminal(workspaceStore.selectedWorkspace.id)
    if (pane) {
      await nextTick()
      initializeTerminal(pane.id)
    }
  }
}

const initializeTerminal = (paneId: string) => {
  const container = document.getElementById(`terminal-${paneId}`)
  if (!container) {
    console.error(`Terminal container not found: terminal-${paneId}`)
    return
  }

  const pane = terminalStore.panes.find(p => p.id === paneId)
  if (!pane) {
    console.error(`Terminal pane not found: ${paneId}`)
    return
  }

  // Create terminal instance
  const terminal = new Terminal({
    theme: defaultTheme,
    fontSize: 14,
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, monospace',
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 1000,
    convertEol: true
  })

  // Create addons
  const fitAddon = new FitAddon()
  const webLinksAddon = new WebLinksAddon()

  // Load addons
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(webLinksAddon)

  // Open terminal in container
  terminal.open(container)
  fitAddon.fit()

  // Store terminal instance with session mapping
  terminalInstances.set(paneId, { 
    terminal, 
    fitAddon, 
    sessionId: pane.sessionId 
  })

  // Show connection status
  if (isConnected.value) {
    terminal.writeln('\x1b[1;32m● Connected to AI Code Terminal\x1b[0m')
    terminal.writeln('\x1b[90mInitializing terminal session...\x1b[0m')
  } else {
    terminal.writeln('\x1b[1;31m● Disconnected from server\x1b[0m')
    terminal.writeln('\x1b[90mAttempting to connect...\x1b[0m')
  }

  // Handle terminal input - send to WebSocket
  terminal.onData((data) => {
    if (isConnected.value) {
      socketService.sendTerminalData(pane.sessionId, data)
    } else {
      // Show disconnection message if not connected
      terminal.write('\r\n\x1b[31mNot connected to server\x1b[0m\r\n')
    }
  })

  // Handle terminal resize
  terminal.onResize(({ cols, rows }) => {
    terminalStore.resizePane(paneId, cols, rows)
    if (isConnected.value) {
      socketService.resizeTerminal(pane.sessionId, cols, rows)
    }
  })

  // Handle container resize
  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit()
  })
  resizeObserver.observe(container)

  console.log(`✅ Terminal initialized for pane ${paneId} with session ${pane.sessionId}`)
}

const closeTerminal = async (paneId: string) => {
  // Clean up terminal instance
  const instance = terminalInstances.get(paneId)
  if (instance) {
    instance.terminal.dispose()
    terminalInstances.delete(paneId)
  }
  
  await terminalStore.closeTerminal(paneId)
}

const switchLayout = async (layout: 'single' | 'horizontal-split' | 'vertical-split') => {
  await terminalStore.setLayout(layout)
}

const focusTerminal = (paneId: string) => {
  terminalStore.setActivePane(paneId)
}

// WebSocket event handlers
const setupSocketListeners = () => {
  // Terminal output handler
  const handleTerminalOutput = (event: CustomEvent) => {
    const { sessionId, output } = event.detail
    
    // Find the terminal instance for this session
    for (const [, instance] of terminalInstances) {
      if (instance.sessionId === sessionId) {
        instance.terminal.write(output)
        terminalStore.appendOutput(sessionId, output)
        break
      }
    }
  }

  // Terminal created handler
  const handleTerminalCreated = (event: CustomEvent) => {
    const { sessionId, pid } = event.detail
    console.log(`✅ Terminal session created: ${sessionId} (PID: ${pid})`)
    
    // Find the terminal instance and update connection status
    for (const [, instance] of terminalInstances) {
      if (instance.sessionId === sessionId) {
        instance.terminal.writeln(`\r\n\x1b[1;32m✅ Terminal session started (PID: ${pid})\x1b[0m`)
        break
      }
    }
  }

  // Terminal destroyed handler
  const handleTerminalDestroyed = (event: CustomEvent) => {
    const { sessionId } = event.detail
    console.log(`🔴 Terminal session destroyed: ${sessionId}`)
  }

  // Add event listeners
  window.addEventListener('terminal:output', handleTerminalOutput as EventListener)
  window.addEventListener('terminal:created', handleTerminalCreated as EventListener)
  window.addEventListener('terminal:destroyed', handleTerminalDestroyed as EventListener)

  // Return cleanup function
  return () => {
    window.removeEventListener('terminal:output', handleTerminalOutput as EventListener)
    window.removeEventListener('terminal:created', handleTerminalCreated as EventListener)
    window.removeEventListener('terminal:destroyed', handleTerminalDestroyed as EventListener)
  }
}

// Initialize WebSocket connection
const initializeSocketConnection = async () => {
  try {
    await socketService.connect()
    isConnected.value = true
    console.log('✅ WebSocket connected successfully')
    
    // Update existing terminals with connection status
    for (const [paneId, instance] of terminalInstances) {
      instance.terminal.writeln('\r\n\x1b[1;32m● Connected to server\x1b[0m')
    }
  } catch (error) {
    console.error('❌ Failed to connect to WebSocket:', error)
    isConnected.value = false
    
    // Update existing terminals with connection status
    for (const [paneId, instance] of terminalInstances) {
      instance.terminal.writeln('\r\n\x1b[1;31m● Connection failed\x1b[0m')
    }
  }
}

onMounted(async () => {
  // Set up socket event listeners first
  const cleanupSocketListeners = setupSocketListeners()
  
  // Initialize WebSocket connection
  await initializeSocketConnection()
  
  // Initialize terminal when a workspace is selected
  if (workspaceStore.selectedWorkspace) {
    // First, try to load existing sessions
    try {
      const existingSessions = await apiService.getSessions(workspaceStore.selectedWorkspace.id)
      if (existingSessions.length > 0) {
        console.log(`Found ${existingSessions.length} existing sessions, attempting to recover them`)
        // TODO: Implement session recovery logic
        // For now, just log the sessions
        existingSessions.forEach(session => {
          console.log(`Session: ${session.id}, Status: ${session.status}, Name: ${session.session_name}`)
        })
      }
      
      // If no existing sessions or panes, create a new terminal
      if (terminalStore.panes.length === 0) {
        await createNewTerminal()
      }
    } catch (error) {
      console.warn('Failed to load existing sessions:', error)
      // Fallback to creating new terminal
      if (terminalStore.panes.length === 0) {
        await createNewTerminal()
      }
    }
  }

  // Initialize existing terminals
  for (const pane of terminalStore.panes) {
    await nextTick()
    initializeTerminal(pane.id)
  }

  // Store cleanup function for unmount
  onUnmounted(() => {
    // Clean up socket listeners
    cleanupSocketListeners()
    
    // Disconnect from WebSocket
    socketService.disconnect()
    
    // Clean up all terminal instances
    for (const [, instance] of terminalInstances) {
      instance.terminal.dispose()
    }
    terminalInstances.clear()
  })
})
</script>

<style>
/* Import xterm.js CSS - must be unscoped */
@import '@xterm/xterm/css/xterm.css';
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
  padding: 48px 24px;
}

.welcome-screen h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.welcome-screen p {
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.5;
  margin-bottom: 32px;
  max-width: 500px;
}

.layout-controls {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
  flex-shrink: 0;
}

.layout-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.icon {
  color: var(--text-muted);
}

.layout-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--button-hover);
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

.layout-btn.active .layout-preview {
  border-color: white;
}

.terminal-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.terminal-container.layout-horizontal {
  flex-direction: column;
}

.terminal-container.layout-vertical {
  flex-direction: row;
}

.terminal-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  overflow: hidden;
}

.terminal-pane:last-child {
  border-right: none;
  border-bottom: none;
}

.terminal-container.layout-horizontal .terminal-pane {
  border-right: none;
}

.terminal-container.layout-vertical .terminal-pane {
  border-bottom: none;
}

.terminal-container.layout-horizontal .terminal-pane:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.terminal-container.layout-vertical .terminal-pane:not(:last-child) {
  border-right: 1px solid var(--border-color);
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  min-height: 36px;
}

.pane-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.pane-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.pane-cwd {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 2px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--error);
  color: white;
}

.terminal-content {
  flex: 1;
  overflow: hidden;
}

.xterm-container {
  width: 100%;
  height: 100%;
  padding: 8px;
}

.terminal-pane.active .pane-header {
  background: var(--bg-secondary);
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