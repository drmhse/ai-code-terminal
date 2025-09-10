<template>
  <div 
    class="terminal-pane"
    :class="{ active: isActive }"
    :data-pane-id="pane.id"
  >
    <!-- Pane Header -->
    <div class="pane-header">
      <div class="pane-info">
        <span class="pane-title">{{ pane.title || `Terminal ${pane.id}` }}</span>
        <span class="pane-cwd">{{ pane.cwd || workspacePath }}</span>
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
    
    <!-- Terminal Content -->
    <div class="terminal-content">
      <div 
        :ref="terminalRef"
        class="xterm-container"
        @click="focus"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { TerminalPane as TerminalPaneType } from '@/stores/terminal'
import type { TerminalTheme } from '@/types/terminal'

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

const terminalRef = ref<HTMLElement>()
const terminalInstance = ref<Terminal>()
const fitAddon = ref<FitAddon>()
const resizeObserver = ref<ResizeObserver>()

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
    convertEol: true
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

  // Handle terminal input
  terminalInstance.value.onData((data) => {
    emit('data', data)
  })

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

const focus = () => {
  if (props.isActive) {
    emit('focus', props.pane.id)
    terminalInstance.value?.focus()
  }
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
</style>