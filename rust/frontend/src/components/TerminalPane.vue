<template>
  <div 
    class="terminal-pane"
    :class="{ active: isActive }"
    :data-pane-id="pane.id"
  >
    <!-- Pane Header -->
    <div class="pane-header">
      <div class="pane-info">
        <span class="pane-title">{{ pane.name || `Terminal ${pane.id}` }}</span>
        <span class="pane-cwd">{{ getActiveTab()?.cwd || workspacePath }}</span>
      </div>
      <div class="pane-actions">
        <button 
          v-if="canSplit"
          @click="$emit('split', 'horizontal')"
          class="action-btn"
          title="Split horizontally"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="16" y2="6"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
            <line x1="8" y1="18" x2="16" y2="18"></line>
          </svg>
        </button>
        <button 
          v-if="canSplit"
          @click="$emit('split', 'vertical')"
          class="action-btn"
          title="Split vertically"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="6" y1="8" x2="6" y2="16"></line>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="18" y1="8" x2="18" y2="16"></line>
          </svg>
        </button>
        <button 
          v-if="showCloseButton"
          @click="$emit('close')" 
          class="close-btn"
          title="Close terminal"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div v-if="pane.tabs && pane.tabs.length > 1" class="pane-tabs">
      <div class="tabs-container">
        <div 
          v-for="tab in sortedTabs" 
          :key="tab.id"
          class="tab"
          :class="{ active: tab.isActive }"
          :draggable="true"
          @click="selectTab(tab.id)"
          @dragstart="handleDragStart($event, tab)"
          @dragover.prevent="handleDragOver($event)"
          @drop="handleDrop($event, tab)"
          @dragend="handleDragEnd"
        >
          <span class="tab-name">{{ tab.name }}</span>
          <button 
            v-if="pane.tabs.length > 1"
            @click.stop="closeTab(tab.id)"
            class="tab-close"
            title="Close tab"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <button 
          @click="createNewTab"
          class="tab-new"
          title="New terminal tab"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Terminal Content -->
    <div class="terminal-content">
      <div 
        ref="terminalRef"
        class="xterm-container"
        @click="focus"
        tabindex="0"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { TerminalPane as TerminalPaneType, TerminalTab } from '@/stores/terminal'
import type { TerminalTheme } from '@/types/terminal'
import { useTerminalStore } from '@/stores/terminal'
import { useWorkspaceStore } from '@/stores/workspace'

interface Props {
  pane: TerminalPaneType
  isActive: boolean
  workspacePath?: string
  canSplit: boolean
  showCloseButton: boolean
  theme?: TerminalTheme
}

interface Emits {
  (e: 'focus', paneId: string): void
  (e: 'close'): void
  (e: 'split', direction: 'horizontal' | 'vertical'): void
  (e: 'resize', cols: number, rows: number): void
  (e: 'data', data: string): void
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  canSplit: true,
  showCloseButton: true
})

const emit = defineEmits<Emits>()

const terminalStore = useTerminalStore()
const workspaceStore = useWorkspaceStore()

// Drag and drop state
const draggedTab = ref<TerminalTab | null>(null)

const terminalRef = ref<HTMLDivElement>()
const terminalInstance = ref<Terminal>()
const fitAddon = ref<FitAddon>()
const resizeObserver = ref<ResizeObserver>()

// Computed
const sortedTabs = computed(() => {
  return [...props.pane.tabs].sort((a, b) => a.order - b.order)
})

const getActiveTab = () => {
  return props.pane.tabs.find(tab => tab.isActive)
}

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

const initializeTerminal = () => {
  if (!terminalRef.value) return

  // Create terminal instance
  terminalInstance.value = new Terminal({
    theme: props.theme || defaultTheme,
    fontSize: 14,
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, monospace',
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 1000,
    convertEol: true,
    tabStopWidth: 4,
    rightClickSelectsWord: true,
    macOptionIsMeta: true
  })

  // Create addons
  fitAddon.value = new FitAddon()
  const webLinksAddon = new WebLinksAddon()

  // Load addons
  terminalInstance.value.loadAddon(fitAddon.value)
  terminalInstance.value.loadAddon(webLinksAddon)

  // Open terminal in container
  terminalInstance.value.open(terminalRef.value)
  fitAddon.value.fit()

  // Handle terminal input - ensure the terminal can accept input
  terminalInstance.value.onData((data) => {
    console.log(`Terminal input received: ${JSON.stringify(data)} from pane ${props.pane.id}`)
    emit('data', data)
  })

  // Focus terminal if it's the active pane
  if (props.isActive && terminalInstance.value) {
    setTimeout(() => {
      terminalInstance.value?.focus()
      console.log(`✅ Terminal focused for pane ${props.pane.id}`)
    }, 100)
  }

  // Handle terminal resize
  terminalInstance.value.onResize(({ cols, rows }) => {
    emit('resize', cols, rows)
  })

  // Handle container resize
  resizeObserver.value = new ResizeObserver(() => {
    if (fitAddon.value) {
      fitAddon.value.fit()
    }
  })
  resizeObserver.value.observe(terminalRef.value)

  console.log(`✅ Terminal initialized for pane ${props.pane.id}`)
}

// Tab management methods
const selectTab = (tabId: string) => {
  terminalStore.setActiveTabInPane(props.pane.id, tabId)
  emit('focus', props.pane.id)
}

const createNewTab = () => {
  if (workspaceStore.selectedWorkspace) {
    terminalStore.createTabInPane(props.pane.id, workspaceStore.selectedWorkspace.id, 'Terminal')
  }
}

const closeTab = (tabId: string) => {
  terminalStore.closeTabInPane(props.pane.id, tabId)
}

// Drag and drop methods
const handleDragStart = (event: DragEvent, tab: TerminalTab) => {
  draggedTab.value = tab
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', tab.id)
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleDrop = (event: DragEvent, targetTab: TerminalTab) => {
  event.preventDefault()
  if (draggedTab.value && draggedTab.value.id !== targetTab.id) {
    // Reorder tabs within the same pane
    const sourceIndex = props.pane.tabs.findIndex(t => t.id === draggedTab.value!.id)
    const targetIndex = props.pane.tabs.findIndex(t => t.id === targetTab.id)
    
    if (sourceIndex !== -1 && targetIndex !== -1) {
      // Update orders
      props.pane.tabs[sourceIndex].order = targetIndex
      props.pane.tabs[targetIndex].order = sourceIndex
      
      // Sort tabs by order
      props.pane.tabs.sort((a, b) => a.order - b.order)
    }
  }
  draggedTab.value = null
}

const handleDragEnd = () => {
  draggedTab.value = null
}

const focus = () => {
  if (terminalInstance.value) {
    terminalInstance.value.focus()
  }
  // Only emit focus event after successfully focusing to avoid recursion
  emit('focus', props.pane.id)
}

const write = (data: string) => {
  terminalInstance.value?.write(data)
}

const writeln = (data: string) => {
  terminalInstance.value?.writeln(data)
}

const clear = () => {
  terminalInstance.value?.clear()
}

const fit = () => {
  fitAddon.value?.fit()
}

const dispose = () => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
  terminalInstance.value?.dispose()
}

// Expose methods to parent
defineExpose({
  write,
  writeln,
  clear,
  fit,
  focus,
  dispose
})

onMounted(() => {
  nextTick(() => {
    initializeTerminal()
  })
})

onUnmounted(() => {
  dispose()
})
</script>

<style scoped>
.terminal-pane {
  display: flex;
  flex-direction: column;
  background: var(--terminal-bg);
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.terminal-pane.active {
  border: 2px solid var(--primary);
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

.pane-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 2px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 2px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
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

.pane-tabs {
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  min-height: 32px;
}

.tabs-container {
  display: flex;
  align-items: center;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.tabs-container::-webkit-scrollbar {
  height: 2px;
}

.tabs-container::-webkit-scrollbar-track {
  background: transparent;
}

.tabs-container::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 1px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-bottom: none;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  min-width: 80px;
  max-width: 200px;
  transition: all 0.15s ease;
  position: relative;
}

.tab:hover {
  background: var(--bg-hover);
}

.tab.active {
  background: var(--terminal-bg);
  border-color: var(--primary);
  border-top-width: 2px;
  margin-top: -1px;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--terminal-bg);
}

.tab-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tab-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: var(--error-bg);
  color: var(--error);
}

.tab-new {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  margin: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.tab-new:hover {
  background: var(--button-hover);
  color: var(--text-primary);
  border-color: var(--primary);
}

.tab[draggable="true"] {
  cursor: move;
}

.tab.dragging {
  opacity: 0.5;
}
</style>