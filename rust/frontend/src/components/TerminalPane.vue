<template>
  <div
    class="terminal-pane"
    :class="{
      active: isActive,
      'drop-target': isDragOverPane,
      'has-empty-tab-area': pane.tabs.length === 0
    }"
    :data-pane-id="pane.id"
    @dragover.prevent="handlePaneDragOver"
    @dragleave="handlePaneDragLeave"
    @drop="handlePaneDrop"
  >
    <!-- Pane Header -->
    <div class="pane-header">
      <div class="pane-info">
        <span class="pane-title">{{ pane.name || `Terminal ${pane.id}` }}</span>
        <span class="pane-cwd">{{ getActiveTab()?.cwd || workspacePath }}</span>
      </div>
      <div class="pane-actions" v-show="isActive">
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

    <!-- Enhanced Tabs Bar -->
    <div v-if="pane.tabs && pane.tabs.length > 0" class="pane-tabs" :class="{ 'single-tab': pane.tabs.length === 1, 'multi-tab': pane.tabs.length > 1 }">
      <div class="tabs-container">
        <!-- Tab Navigation Arrow (for overflow) -->
        <button
          v-if="showTabOverflow"
          class="tab-nav-arrow tab-nav-left"
          @click="scrollTabsLeft"
          :disabled="scrollPosition <= 0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>

        <!-- Tabs Scrollable Container -->
        <div ref="tabsScrollContainer" class="tabs-scroll-container" @scroll="handleTabsScroll">
          <div
            v-for="tab in sortedTabs"
            :key="tab.id"
            class="tab"
            :class="{
              active: tab.isActive,
              dragging: draggedTab?.id === tab.id,
              'drag-over': dragOverTab?.id === tab.id
            }"
            :draggable="true"
            @click="selectTab(tab.id)"
            @dragstart="handleDragStart($event, tab)"
            @dragover.prevent="handleDragOver($event, tab)"
            @dragleave="handleDragLeave($event, tab)"
            @drop="handleDrop($event, tab)"
            @dragend="handleDragEnd"
          >
            <div class="tab-content">
              <span class="tab-name" :title="tab.name">{{ tab.name }}</span>
              <button
                v-if="pane.tabs.length > 1"
                @click.stop="closeTab(tab.id)"
                class="tab-close"
                title="Close tab"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Tab Navigation Arrow (for overflow) -->
        <button
          v-if="showTabOverflow"
          class="tab-nav-arrow tab-nav-right"
          @click="scrollTabsRight"
          :disabled="scrollPosition >= maxScrollPosition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </button>

        <!-- Add New Tab Button -->
        <button
          @click="createNewTab"
          class="tab-new"
          title="New terminal tab"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Terminal Content -->
    <div class="terminal-content">
      <!-- Container for each terminal tab -->
      <div
        v-for="tab in pane.tabs"
        :key="tab.id"
        :ref="el => terminalRefs.set(tab.id, el as HTMLDivElement)"
        class="xterm-container"
        :class="{ active: tab.isActive }"
        :data-tab-id="tab.id"
        @click="focus"
        tabindex="0"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
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
  (e: 'update:pane', pane: TerminalPaneType): void
  (e: 'move-tab-to-pane', payload: { sourcePaneId: string, targetPaneId: string, tabId: string, targetIndex: number }): void
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  canSplit: true,
  showCloseButton: true
})

const emit = defineEmits<Emits>()

const terminalStore = useTerminalStore()
const workspaceStore = useWorkspaceStore()

const draggedTab = ref<TerminalTab | null>(null)
const dragOverTab = ref<TerminalTab | null>(null)
// Track terminal container refs per tab ID
const terminalRefs = ref<Map<string, HTMLDivElement>>(new Map())
// Store terminal instances per tab ID
const terminalInstances = ref<Map<string, Terminal>>(new Map())
const fitAddons = ref<Map<string, FitAddon>>(new Map())
const webLinksAddons = ref<Map<string, WebLinksAddon>>(new Map())
const webglAddons = ref<Map<string, WebglAddon>>(new Map())
const resizeObserver = ref<ResizeObserver>()
const isDisposed = ref(false)

// Track addon loading states per tab
const addonStates = ref<Map<string, { fitLoaded: boolean, webLinksLoaded: boolean, webglLoaded: boolean }>>(new Map())

// Output throttling for large data
const outputBuffer = ref<{ terminal: Terminal; data: string }[]>([])
const outputThrottleTimeout = ref<number | null>(null)
const isThrottling = ref(false)
const outputCharsPerSecond = ref(0)
const lastOutputTime = ref(Date.now())
const outputByteCount = ref(0)
const lastCols = ref(0)
const lastRows = ref(0)
const isResizing = ref(false)
const resizeTimeout = ref<number | null>(null)
const lastResizeTime = ref(0)
const RESIZE_DEBOUNCE_MS = 500
const RESIZE_COOLDOWN_MS = 300
let cleanupOutputHandler: (() => void) | null = null;

// Container readiness constants
const MIN_CONTAINER_WIDTH = 100
const MIN_CONTAINER_HEIGHT = 50
const MAX_WAIT_TIME = 5000 // 5 seconds max wait
const INITIAL_RETRY_DELAY = 50


// Enhanced tab management
const tabsScrollContainer = ref<HTMLDivElement>()
const scrollPosition = ref(0)
const showTabOverflow = ref(false)
const maxScrollPosition = ref(0)
const isDragOverPane = ref(false)

const sortedTabs = computed(() => {
  return [...props.pane.tabs].sort((a, b) => a.order - b.order)
})

const getActiveTab = (): TerminalTab | undefined => {
  return props.pane.tabs.find(tab => tab.isActive)
}

// Helper functions for multi-terminal management
const getActiveTerminal = (): Terminal | undefined => {
  const activeTab = getActiveTab()
  return activeTab ? terminalInstances.value.get(activeTab.id) : undefined
}

const getTerminalForTab = (tabId: string): Terminal | undefined => {
  return terminalInstances.value.get(tabId)
}

const createTerminalForTab = (tabId: string): Terminal => {
  // Configure for WebGL/Canvas rendering performance
  const terminal = new Terminal({
    theme: props.theme || defaultTheme,
    fontSize: 14,
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, monospace',
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 10000,
    fastScrollModifier: 'alt',
    fastScrollSensitivity: 5,
    scrollSensitivity: 3,
    convertEol: true,
    tabStopWidth: 4,
    rightClickSelectsWord: true,
    macOptionIsMeta: true,
    windowsMode: false,
    macOptionClickForcesSelection: false,
    disableStdin: false,
    smoothScrollDuration: 0,
    altClickMovesCursor: false,
    logLevel: 'warn',
    allowTransparency: false, // Required for WebGL
    drawBoldTextInBrightColors: true,
    minimumContrastRatio: 1,
    customGlyphs: true, // Forces canvas rendering - doesn't work with DOM
    rescaleOverlappingGlyphs: true // Also forces canvas rendering
  })

  // Store terminal instance
  terminalInstances.value.set(tabId, terminal)

  // Initialize addon state
  addonStates.value.set(tabId, { fitLoaded: false, webLinksLoaded: false, webglLoaded: false })

  return terminal
}

// Production-level container readiness check
const waitForContainerReady = (tabId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let retryCount = 0

    const checkContainer = (): void => {
      // Check if we've exceeded max wait time
      if (Date.now() - startTime > MAX_WAIT_TIME) {
        reject(new Error(`Container readiness timeout after ${MAX_WAIT_TIME}ms`))
        return
      }

      // Check if component is disposed
      const container = terminalRefs.value.get(tabId)
      if (isDisposed.value || !container) {
        reject(new Error('Terminal component disposed during initialization'))
        return
      }
      const rect = container.getBoundingClientRect()

      // Check if container is visible and has reasonable dimensions
      const isVisible = rect.width > 0 && rect.height > 0
      const hasMinimumSize = rect.width >= MIN_CONTAINER_WIDTH && rect.height >= MIN_CONTAINER_HEIGHT
      const isInViewport = rect.top >= 0 && rect.left >= 0 &&
                          rect.bottom <= window.innerHeight && rect.right <= window.innerWidth

      if (isVisible && hasMinimumSize) {
        console.log(`✅ Container ready: ${rect.width}x${rect.height} after ${Date.now() - startTime}ms`)
        resolve()
        return
      }

      // Log current state for debugging
      console.log(`⏳ Container not ready (attempt ${++retryCount}): ${rect.width}x${rect.height}, visible: ${isVisible}, minSize: ${hasMinimumSize}`)

      // Calculate exponential backoff delay
      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(1.5, retryCount), 500)

      // Use requestAnimationFrame for better timing, then setTimeout for delay
      requestAnimationFrame(() => {
        setTimeout(checkContainer, delay)
      })
    }

    // Start checking after a brief initial delay
    setTimeout(checkContainer, INITIAL_RETRY_DELAY)
  })
}

const debouncedFit = () => {
  const now = Date.now()

  // Prevent resize if we're already in cooldown or if recent resize
  if (isResizing.value || (now - lastResizeTime.value) < RESIZE_COOLDOWN_MS) {
    return
  }

  // Clear existing timeout
  if (resizeTimeout.value) {
    clearTimeout(resizeTimeout.value)
  }

  // Set new timeout
  resizeTimeout.value = setTimeout(() => {
    const activeTerminal = getActiveTerminal()
    const activeTab = getActiveTab()
    const fitAddon = activeTab ? fitAddons.value.get(activeTab.id) : undefined

    if (fitAddon && activeTerminal && !isResizing.value && !isDisposed.value) {
      // Validate container dimensions before fitting
      const activeContainer = activeTab ? terminalRefs.value.get(activeTab.id) : undefined
      if (activeContainer) {
        const rect = activeContainer.getBoundingClientRect()
        const isValidSize = rect.width >= MIN_CONTAINER_WIDTH && rect.height >= MIN_CONTAINER_HEIGHT
        const isVisible = rect.width > 0 && rect.height > 0

        if (!isVisible) {
          console.log(`⚠️ Container not visible: ${rect.width}x${rect.height}, skipping fit`)
          return
        }

        if (!isValidSize) {
          console.log(`⚠️ Container too small for fit: ${rect.width}x${rect.height} (min: ${MIN_CONTAINER_WIDTH}x${MIN_CONTAINER_HEIGHT}), skipping`)
          return
        }
      }

      try {
        isResizing.value = true
        lastResizeTime.value = Date.now()

        // Fit the active terminal
        fitAddon.fit()

        setTimeout(() => {
          if (!isDisposed.value) {
            isResizing.value = false
          }
        }, RESIZE_COOLDOWN_MS)

      } catch (error) {
        console.error(`Error during terminal fit for pane ${props.pane.id}:`, error)
        isResizing.value = false
      }
    }
  }, RESIZE_DEBOUNCE_MS)
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

// Removed createTerminalForSession - using simple single instance approach

const initializeTerminalForTab = async (tabId: string) => {
  if (isDisposed.value) return

  // Check if terminal already exists for this tab
  if (terminalInstances.value.has(tabId)) {
    console.log(`Terminal already exists for tab ${tabId}`)
    return
  }

  // Get the container for this tab - wait for it to be available
  let container = terminalRefs.value.get(tabId)
  if (!container) {
    // Wait for DOM to be ready with a short timeout
    await nextTick()
    container = terminalRefs.value.get(tabId)
    if (!container) {
      console.warn(`No container found for tab ${tabId} after nextTick, skipping initialization`)
      return
    }
  }

  const terminal = createTerminalForTab(tabId)
  const state = addonStates.value.get(tabId)!

  // Load addons
  try {
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    fitAddons.value.set(tabId, fitAddon)
    state.fitLoaded = true
  } catch (error) {
    console.warn(`FitAddon loading failed for tab ${tabId}:`, error)
  }

  try {
    const webLinksAddon = new WebLinksAddon()
    terminal.loadAddon(webLinksAddon)
    webLinksAddons.value.set(tabId, webLinksAddon)
    state.webLinksLoaded = true
  } catch (error) {
    console.warn(`WebLinksAddon loading failed for tab ${tabId}:`, error)
  }

  // Open terminal in its dedicated container
  terminal.open(container)

  // Load WebGL addon after terminal is opened
  try {
    const webglAddon = new WebglAddon()
    terminal.loadAddon(webglAddon)
    webglAddons.value.set(tabId, webglAddon)
    state.webglLoaded = true
    console.log(`✅ WebGL renderer activated for tab ${tabId}`)
  } catch (error) {
    console.warn(`⚠️ WebGL addon failed for tab ${tabId}:`, error)
  }

  // Set up event handlers
  terminal.onData((data) => {
    // Only emit data if this is the active terminal
    const activeTab = getActiveTab()
    if (activeTab?.id === tabId) {
      emit('data', data)
    }
  })

  terminal.onResize(({ cols, rows }) => {
    if (cols < 10 || rows < 5 || cols > 500 || rows > 200) {
      console.warn(`Invalid terminal dimensions: ${cols}x${rows}, ignoring`)
      return
    }
    // Only emit resize if this is the active terminal
    const activeTab = getActiveTab()
    if (activeTab?.id === tabId) {
      emit('resize', cols, rows)
    }
  })

  console.log(`✅ Terminal initialized for tab ${tabId}`)
}

const initializeTerminal = async () => {
  if (isDisposed.value) return

  // Initialize terminals for all tabs
  for (const tab of props.pane.tabs) {
    await initializeTerminalForTab(tab.id)
  }

  // Set up resize observer for the main terminal content area
  const terminalContent = document.querySelector(`[data-pane-id="${props.pane.id}"] .terminal-content`) as HTMLElement
  if (terminalContent) {
    resizeObserver.value = new ResizeObserver(() => debouncedFit())
    resizeObserver.value.observe(terminalContent)
  }

  console.log(`✅ Terminal initialized for pane ${props.pane.id}`)
}

const switchToTab = async (tabId: string) => {
  if (isDisposed.value) return

  // Ensure terminal exists for the target tab
  let terminal = getTerminalForTab(tabId)
  if (!terminal) {
    await initializeTerminalForTab(tabId)
    terminal = getTerminalForTab(tabId)
  }

  if (terminal) {
    // Focus and fit the terminal (CSS handles visibility via :class="{ active: tab.isActive }")
    setTimeout(() => {
      terminal?.focus()

      const fitAddon = fitAddons.value.get(tabId)
      if (fitAddon) {
        fitAddon.fit()
      }
    }, 50)

    console.log(`🔄 Switched to terminal for tab ${tabId}`)
  }
}

// Watch for tab changes and switch terminal instances (after component is mounted)
watch(() => props.pane.activeTabId, (newTabId, oldTabId) => {
  if (newTabId && newTabId !== oldTabId) {
    switchToTab(newTabId)
  }
});

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

// Enhanced tab overflow handling
const updateTabOverflow = () => {
  if (tabsScrollContainer.value) {
    const container = tabsScrollContainer.value
    showTabOverflow.value = container.scrollWidth > container.clientWidth
    maxScrollPosition.value = container.scrollWidth - container.clientWidth
  }
}

const scrollTabsLeft = () => {
  if (tabsScrollContainer.value) {
    const scrollAmount = 150
    tabsScrollContainer.value.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
  }
}

const scrollTabsRight = () => {
  if (tabsScrollContainer.value) {
    const scrollAmount = 150
    tabsScrollContainer.value.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }
}

const handleTabsScroll = () => {
  if (tabsScrollContainer.value) {
    scrollPosition.value = tabsScrollContainer.value.scrollLeft
  }
}

// Enhanced drag and drop functionality
const handleDragStart = (event: DragEvent, tab: TerminalTab) => {
  draggedTab.value = tab
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', tab.id)
    event.dataTransfer.setData('application/x-terminal-tab', JSON.stringify({
      tabId: tab.id,
      paneId: props.pane.id,
      sessionId: tab.sessionId,
      name: tab.name
    }))
    event.dataTransfer.effectAllowed = 'move'
  }
  // Add visual feedback
  setTimeout(() => {
    if (event.target instanceof HTMLElement) {
      event.target.classList.add('dragging')
    }
  }, 0)
}

const handleDragOver = (event: DragEvent, tab: TerminalTab) => {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

  // Visual feedback for drop target
  if (draggedTab.value && draggedTab.value.id !== tab.id) {
    dragOverTab.value = tab
  }
}

const handleDragLeave = (event: DragEvent, tab: TerminalTab) => {
  // Only clear drag-over state if leaving the tab element
  const target = event.currentTarget as HTMLElement
  const relatedTarget = event.relatedTarget as Node | null
  if (target && relatedTarget && !target.contains(relatedTarget)) {
    if (dragOverTab.value?.id === tab.id) {
      dragOverTab.value = null
    }
  }
}

const handleDrop = (event: DragEvent, targetTab: TerminalTab) => {
  event.preventDefault()

  if (draggedTab.value && draggedTab.value.id !== targetTab.id) {
    const sourceIndex = props.pane.tabs.findIndex(t => t.id === draggedTab.value!.id)
    const targetIndex = props.pane.tabs.findIndex(t => t.id === targetTab.id)

    if (sourceIndex !== -1 && targetIndex !== -1) {
      // Check if this is an internal reorder or cross-pane move
      const dragData = event.dataTransfer?.getData('application/x-terminal-tab')

      if (dragData) {
        try {
          const parsedData = JSON.parse(dragData)

          if (parsedData.paneId === props.pane.id) {
            // Internal reorder within same pane
            const updatedPane = { ...props.pane }
            const updatedTabs = [...updatedPane.tabs]
            const [movedTab] = updatedTabs.splice(sourceIndex, 1)
            updatedTabs.splice(targetIndex, 0, movedTab)
            updatedTabs.forEach((t, i) => t.order = i)
            emit('update:pane', { ...updatedPane, tabs: updatedTabs })
          } else {
            // Cross-pane move - this would need to be handled at a higher level
            // For now, we'll emit an event for the parent to handle
            emit('move-tab-to-pane', {
              sourcePaneId: parsedData.paneId,
              targetPaneId: props.pane.id,
              tabId: parsedData.tabId,
              targetIndex
            })
          }
        } catch (error) {
          console.warn('Failed to parse drag data:', error)
        }
      }
    }
  }

  // Clear drag state
  draggedTab.value = null
  dragOverTab.value = null
}

const handleDragEnd = (event: DragEvent) => {
  if (event.target instanceof HTMLElement) {
    event.target.classList.remove('dragging')
  }
  draggedTab.value = null
  dragOverTab.value = null
  isDragOverPane.value = false
}

// Pane-level drag and drop handling
const handlePaneDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  // Only show drop target if dragging a tab from another pane
  const dragData = event.dataTransfer?.getData('application/x-terminal-tab')
  if (dragData) {
    try {
      const parsedData = JSON.parse(dragData)
      if (parsedData.paneId !== props.pane.id) {
        isDragOverPane.value = true
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }
}

const handlePaneDragLeave = (event: DragEvent) => {
  // Only clear drop target if leaving the pane entirely
  const target = event.currentTarget as HTMLElement
  const relatedTarget = event.relatedTarget as Node | null
  if (target && relatedTarget && !target.contains(relatedTarget)) {
    isDragOverPane.value = false
  }
}

const handlePaneDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOverPane.value = false

  const dragData = event.dataTransfer?.getData('application/x-terminal-tab')
  if (dragData) {
    try {
      const parsedData = JSON.parse(dragData)

      // Only handle cross-pane drops
      if (parsedData.paneId !== props.pane.id) {
        emit('move-tab-to-pane', {
          sourcePaneId: parsedData.paneId,
          targetPaneId: props.pane.id,
          tabId: parsedData.tabId,
          targetIndex: props.pane.tabs.length // Append to end of pane
        })
      }
    } catch (error) {
      console.warn('Failed to parse drag data:', error)
    }
  }
}

const focus = () => {
  const activeTerminal = getActiveTerminal()
  activeTerminal?.focus()
  emit('focus', props.pane.id)
}

const write = (data: string, sessionId?: string) => {
  if (!isDisposed.value) {
    if (sessionId) {
      // Route output to the specific terminal for this session
      const targetTab = props.pane.tabs.find(tab => tab.sessionId === sessionId)
      if (targetTab) {
        const targetTerminal = terminalInstances.value.get(targetTab.id)
        if (targetTerminal) {
          writeThrottledToTerminal(targetTerminal, data)
        }
      }
    } else {
      // Use active terminal instance for general writes
      const activeTerminal = getActiveTerminal()
      if (activeTerminal) {
        writeThrottledToTerminal(activeTerminal, data)
      }
    }
  }
}

const writeln = (data: string) => {
  if (!isDisposed.value) {
    writeThrottled(data + '\r\n')
  }
}

const clear = () => {
  if (!isDisposed.value) {
    const activeTerminal = getActiveTerminal()
    if (activeTerminal) {
      activeTerminal.clear()
    }
  }
}

const fit = () => {
  if (!isDisposed.value) {
    debouncedFit()
  }
}

// Throttled output handling for large data streams
const THROTTLE_THRESHOLD = 50000 // chars per second
const BUFFER_MAX_SIZE = 100 // max buffered chunks
const THROTTLE_DELAY = 4 // ~250fps for faster interactive response

const writeThrottledToTerminal = (terminal: Terminal, data: string) => {
  if (!terminal || isDisposed.value) return

  const now = Date.now()
  const timeDiff = now - lastOutputTime.value
  outputByteCount.value += data.length

  // Calculate output rate
  if (timeDiff > 1000) {
    outputCharsPerSecond.value = outputByteCount.value / (timeDiff / 1000)
    outputByteCount.value = 0
    lastOutputTime.value = now
  }

  // Only throttle large data streams, not small interactive data
  const isInteractiveData = data.length <= 20 && outputBuffer.value.length === 0
  const shouldThrottle = outputCharsPerSecond.value > THROTTLE_THRESHOLD && !isInteractiveData

  if (shouldThrottle || (isThrottling.value && !isInteractiveData)) {
    outputBuffer.value.push({ terminal, data })

    if (outputBuffer.value.length > BUFFER_MAX_SIZE) {
      // Prevent memory overflow - truncate oldest entries
      outputBuffer.value = outputBuffer.value.slice(-BUFFER_MAX_SIZE)
      console.warn(`⚠️ Terminal output buffer overflow, truncating to last ${BUFFER_MAX_SIZE} chunks`)
    }

    if (!isThrottling.value) {
      isThrottling.value = true
      console.log(`🐌 Terminal output throttling engaged (${Math.round(outputCharsPerSecond.value)} chars/sec)`)
      startThrottling()
    }
    return
  }

  // Normal rate - write directly
  try {
    terminal.write(data)
  } catch (error) {
    console.error('Error writing to terminal:', error)
  }
}

const writeThrottled = (data: string) => {
  const activeTerminal = getActiveTerminal()
  if (activeTerminal) {
    writeThrottledToTerminal(activeTerminal, data)
  }
}

const startThrottling = () => {
  if (outputThrottleTimeout.value || isDisposed.value) return

  const processBuffer = () => {
    if (outputBuffer.value.length === 0) {
      isThrottling.value = false
      outputThrottleTimeout.value = null
      console.log('✅ Terminal output throttling disengaged')
      return
    }

    // Process one chunk at a time
    const item = outputBuffer.value.shift()
    if (item && !isDisposed.value) {
      try {
        item.terminal.write(item.data)
      } catch (error) {
        console.error('Error writing buffered terminal data:', error)
      }
    }

    // Continue processing
    outputThrottleTimeout.value = setTimeout(processBuffer, THROTTLE_DELAY)
  }

  outputThrottleTimeout.value = setTimeout(processBuffer, THROTTLE_DELAY)
}

// Clean terminal buffer to prevent corruption
const cleanTerminalBuffer = (buffer: string): string => {
  if (!buffer || buffer.length === 0) return ''

  // Remove any incomplete escape sequences at the end
  let cleaned = buffer

  // Remove incomplete escape sequences (ESC not followed by proper sequences)
  cleaned = cleaned.replace(/\x1b(?![[\d;]*[A-Za-z])/g, '')

  // Handle bracketed paste mode - remove if incomplete
  if (cleaned.includes('\x1b[?2004h') && !cleaned.includes('\x1b[?2004l')) {
    cleaned = cleaned.replace(/\x1b\[?2004h/g, '')
  }
  if (cleaned.includes('\x1b[?2004l') && !cleaned.includes('\x1b[?2004h')) {
    cleaned = cleaned.replace(/\x1b\[?2004l/g, '')
  }

  // Remove any malformed sequences that could corrupt display
  cleaned = cleaned.replace(/\x1b\[[\d;]*(?![A-Za-z])/g, '')

  // Ensure buffer doesn't start with partial sequences
  cleaned = cleaned.replace(/^[\x00-\x1f]+/, '')

  // Remove any null bytes that could cause issues
  cleaned = cleaned.replace(/\x00/g, '')

  return cleaned
}

const restoreTerminalBuffers = async () => {
  if (isDisposed.value) return

  console.log(`🔄 Restoring terminal buffers for pane ${props.pane.id}`)

  for (const tab of props.pane.tabs) {
    const terminal = terminalInstances.value.get(tab.id)
    if (!terminal || !tab.sessionId) continue

    let bufferToRestore = tab.buffer

    // If tab buffer is empty, fetch from backend
    if (!bufferToRestore) {
      try {
        // Import apiService
        const { apiService } = await import('@/services/api')
        const backendBuffer = await apiService.getSessionBuffer(tab.sessionId)
        if (backendBuffer) {
          bufferToRestore = backendBuffer
          console.log(`🌐 Retrieved buffer from backend for session ${tab.sessionId}: ${backendBuffer.length} chars`)
        }
      } catch (error) {
        console.warn(`Failed to retrieve backend buffer for ${tab.sessionId}:`, error)
      }
    }

    // Fallback to localStorage if both tab buffer and backend are empty
    if (!bufferToRestore) {
      try {
        const storedBuffer = localStorage.getItem(`terminal_buffer_${tab.sessionId}`)
        if (storedBuffer) {
          bufferToRestore = storedBuffer
          console.log(`📦 Retrieved localStorage backup for session ${tab.sessionId}`)
        }
      } catch (error) {
        console.warn(`Failed to retrieve localStorage buffer for ${tab.sessionId}:`, error)
      }
    }

    if (!bufferToRestore) continue

    try {
      // Clean the buffer to prevent corruption
      const cleanedBuffer = cleanTerminalBuffer(bufferToRestore)

      if (cleanedBuffer.length > 0) {
        console.log(`📋 Restoring ${cleanedBuffer.length} characters to terminal ${tab.id}`)

        // Write the buffer content to restore visual state
        terminal.write(cleanedBuffer)

        console.log(`✅ Buffer restored for terminal ${tab.id}`)
      }
    } catch (error) {
      console.warn(`⚠️ Failed to restore buffer for terminal ${tab.id}:`, error)
      // Continue with other terminals even if one fails
    }
  }
}

// Save terminal buffers to localStorage for persistence
const saveTerminalBuffers = () => {
  for (const tab of props.pane.tabs) {
    if (tab.buffer && tab.sessionId) {
      try {
        // Keep only last 5000 characters to prevent localStorage bloat
        const trimmedBuffer = tab.buffer.length > 5000 ? tab.buffer.slice(-5000) : tab.buffer
        localStorage.setItem(`terminal_buffer_${tab.sessionId}`, trimmedBuffer)
      } catch (error) {
        console.warn(`Failed to save buffer for session ${tab.sessionId}:`, error)
      }
    }
  }
}

const dispose = () => {
  if (isDisposed.value) return // Prevent double disposal

  try {
    // Clear output throttling
    if (outputThrottleTimeout.value) {
      clearTimeout(outputThrottleTimeout.value)
      outputThrottleTimeout.value = null
    }
    outputBuffer.value = []
    isThrottling.value = false

    // Clear any pending timeouts
    if (resizeTimeout.value) {
      clearTimeout(resizeTimeout.value)
      resizeTimeout.value = null
    }

    // Disconnect resize observer
    if (resizeObserver.value) {
      resizeObserver.value.disconnect()
      resizeObserver.value = undefined
    }

    // Dispose all terminal instances
    terminalInstances.value.forEach((terminal, tabId) => {
      try {
        terminal.dispose()
      } catch (error) {
        console.warn(`Terminal disposal error for tab ${tabId}:`, error)
      }
    })

    // Dispose all addons
    fitAddons.value.forEach((addon, tabId) => {
      try {
        addon.dispose()
      } catch (error) {
        console.warn(`FitAddon disposal error for tab ${tabId}:`, error)
      }
    })

    webLinksAddons.value.forEach((addon, tabId) => {
      try {
        addon.dispose()
      } catch (error) {
        console.warn(`WebLinksAddon disposal error for tab ${tabId}:`, error)
      }
    })

    webglAddons.value.forEach((addon, tabId) => {
      try {
        addon.dispose()
      } catch (error) {
        console.warn(`WebglAddon disposal error for tab ${tabId}:`, error)
      }
    })

    // Clear all references
    terminalInstances.value.clear()
    fitAddons.value.clear()
    webLinksAddons.value.clear()
    webglAddons.value.clear()
    addonStates.value.clear()

    isDisposed.value = true
  } catch (error) {
    console.error('Error during terminal disposal:', error)
    // Still mark as disposed even if there were errors
    isDisposed.value = true
  }
}

defineExpose({ write, writeln, clear, fit, focus, dispose })

onMounted(() => {
  nextTick(async () => {
    await initializeTerminal()

    // Initialize the active tab after terminals are set up
    const activeTab = getActiveTab()
    if (activeTab) {
      await switchToTab(activeTab.id)
    }

    // Route output to correct session terminal instead of active tab only
    cleanupOutputHandler = terminalStore.onTerminalOutput((sessionId, output) => {
      write(output, sessionId);
    });

    // Restore terminal buffers for session persistence
    await restoreTerminalBuffers()

    // Set up tab overflow detection
    updateTabOverflow()

    // Watch for resize to update overflow state
    window.addEventListener('resize', updateTabOverflow)

    // Periodic saving of terminal buffers (every 30 seconds)
    const saveInterval = setInterval(saveTerminalBuffers, 30000)

    // Store interval ref for cleanup
    ;(window as any).terminalBufferSaveInterval = saveInterval
  })
})

// Watch for tab changes to update overflow
watch(() => props.pane.tabs.length, () => {
  nextTick(updateTabOverflow)
}, { immediate: true })

// Watch for theme changes and update all terminal themes dynamically
watch(() => props.theme, (newTheme) => {
  if (newTheme) {
    // Update theme for all terminal instances
    terminalInstances.value.forEach((terminal) => {
      terminal.options.theme = newTheme
    })
  }
}, { deep: true })

onUnmounted(() => {
  try {
    // Save terminal buffers before disposal
    saveTerminalBuffers()

    // Clean up terminal
    dispose()

    // Clean up output handler
    if (cleanupOutputHandler) {
      cleanupOutputHandler()
      cleanupOutputHandler = null
    }

    // Clear periodic buffer saving
    if ((window as any).terminalBufferSaveInterval) {
      clearInterval((window as any).terminalBufferSaveInterval)
      delete (window as any).terminalBufferSaveInterval
    }

    // Remove event listeners
    window.removeEventListener('resize', updateTabOverflow)

    console.log(`✅ Terminal pane ${props.pane.id} unmounted cleanly`)
  } catch (error) {
    console.warn('Error during terminal pane unmount:', error)
  }
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
  border: 1px solid var(--border-color);
  border-radius: 8px;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.15s ease-in-out;
}

.terminal-pane:hover {
  border-color: var(--text-muted);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.terminal-pane.active {
  border: 1px solid var(--primary);
  box-shadow: 0 0 0 1px rgba(0, 123, 204, 0.1);
}

.terminal-pane.active::before {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  height: 2px;
  background: var(--primary);
  border-radius: 8px 8px 0 0;
  z-index: 1;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  border-radius: 8px 8px 0 0;
  min-height: 28px;
  position: relative;
}

.pane-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--border-color) 50%, transparent 100%);
}

.pane-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.pane-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.pane-title::before {
  content: '●';
  color: var(--success);
  font-size: 10px;
  animation: pulse 2s infinite;
}

.terminal-pane.active .pane-title::before {
  color: var(--primary);
  animation: none;
}

.pane-cwd {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  max-width: 200px;
}

.pane-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.action-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.3s;
}

.action-btn:hover {
  background: var(--button-hover);
  color: var(--text-primary);
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-btn:hover::before {
  left: 100%;
}

.close-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.close-btn:hover {
  background: var(--error);
  border-color: var(--error);
  color: white;
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(241, 76, 76, 0.3);
}

.terminal-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: var(--terminal-bg);
  border-radius: 0 0 8px 8px;
  min-height: 300px; /* Ensure minimum height for terminal */
  display: flex;
  flex-direction: column;
}

.xterm-container {
  width: 100%;
  height: 100%;
  flex: 1; /* Take all available space in terminal-content */
  background: var(--terminal-bg);
  border-radius: 0 0 8px 8px;
  position: relative;
  min-height: 0;
  box-sizing: border-box;
  display: none; /* Hide by default */
}

.xterm-container.active {
  display: block; /* Show active terminal */
}

/* ONLY hide the font measurement elements - these contain ╚╚╚╚ test characters */
:deep(.xterm-width-cache-measure-container) {
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

/* Hide xterm helper textarea but keep it functional - position off-screen but maintain size */
:deep(.xterm-helper-textarea) {
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  opacity: 0 !important;
  z-index: -1 !important;
}

/* Hide composition view for IME (this one can be fully hidden) */
:deep(.xterm-composition-view) {
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

/* VS Code approach: Minimal CSS interference with canvas renderer */
:deep(.xterm-viewport) {
  overflow: auto !important;
}

:deep(.xterm-screen) {
  position: relative !important;
}

/* Let canvas renderer handle scrolling naturally */
:deep(.xterm canvas) {
  outline: none !important;
}


.terminal-pane.active .pane-header {
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  box-shadow: 0 1px 3px rgba(0, 123, 204, 0.1);
}

.terminal-pane.active .terminal-content {
  box-shadow: inset 0 1px 3px rgba(0, 123, 204, 0.1);
}

/* Enhanced Pane Separators */
.terminal-pane + .terminal-pane {
  margin-left: 4px;
}

/* Add subtle inner glow for active pane */
.terminal-pane.active .terminal-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0, 123, 204, 0.3), transparent);
  pointer-events: none;
}

/* Enhanced Tabs Styling */
.pane-tabs {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  min-height: 32px;
  position: relative;
}

.pane-tabs.single-tab {
  min-height: 28px;
}

.pane-tabs.multi-tab {
  min-height: 32px;
}

.tabs-container {
  display: flex;
  align-items: center;
  height: 100%;
  position: relative;
  padding: 0 8px;
}

/* Tab Navigation Arrows */
.tab-nav-arrow {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  margin: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 2;
  position: relative;
}

.tab-nav-arrow:hover:not(:disabled) {
  background: var(--button-hover);
  color: var(--text-primary);
  border-color: var(--primary);
  transform: translateY(-1px);
}

.tab-nav-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

/* Scrollable Tabs Container */
.tabs-scroll-container {
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  margin: 0 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  scroll-behavior: smooth;
  padding: 6px 0;
}

.tabs-scroll-container::-webkit-scrollbar {
  display: none;
}

/* Enhanced Tab Design */
.tab {
  display: flex;
  align-items: stretch;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  min-width: 80px;
  max-width: 180px;
  height: 28px;
  margin-right: 1px;
  transition: all 0.15s ease;
  position: relative;
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}

.tab-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  background: transparent;
  width: 100%;
  height: 100%;
  transition: all 0.15s ease;
  position: relative;
}

.tab:hover .tab-content {
  background: rgba(255, 255, 255, 0.05);
}

.tab.active .tab-content {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary);
}

/* Tab Name */
.tab-name {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 4px;
}

.tab.active .tab-name {
  color: var(--text-primary);
  font-weight: 500;
}

/* Tab Close Button */
.tab-close {
  background: transparent;
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
  width: 16px;
  height: 16px;
}

.tab:hover .tab-close {
  opacity: 0.7;
}

.tab.active .tab-close {
  opacity: 0.5;
}

.tab-close:hover {
  opacity: 1 !important;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

/* New Tab Button */
.tab-new {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 6px;
  margin-left: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.tab-new::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 123, 204, 0.1), transparent);
  transition: left 0.3s;
}

.tab-new:hover {
  background: var(--button-hover);
  color: var(--text-primary);
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.tab-new:hover::before {
  left: 100%;
}

/* Drag and Drop States */
.tab.dragging {
  opacity: 0.6;
  transform: rotate(2deg) scale(0.95);
  z-index: 1000;
}

.tab.drag-over {
  transform: translateY(-2px);
  border-left: 3px solid var(--primary);
}

.tab.drag-over .tab-content {
  background: rgba(0, 123, 204, 0.1);
  border-color: var(--primary);
}

/* Pane Drop Target States */
.terminal-pane.drop-target {
  border: 2px dashed var(--primary);
  background: rgba(0, 123, 204, 0.05);
  transform: scale(1.02);
  transition: all 0.2s ease;
}

.terminal-pane.drop-target::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent, rgba(0, 123, 204, 0.1), transparent);
  pointer-events: none;
  z-index: 10;
}

.terminal-pane.has-empty-tab-area.drop-target {
  border-style: solid;
  background: rgba(0, 123, 204, 0.1);
}

.terminal-pane.has-empty-tab-area.drop-target .terminal-content::after {
  content: 'Drop tab here';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--primary);
  font-size: 16px;
  font-weight: 600;
  pointer-events: none;
  z-index: 11;
}

/* Mobile Optimizations */
@media (max-width: 768px) {
  .tab {
    min-width: 100px;
    max-width: 160px;
  }

  .tab-content {
    padding: 0 8px;
    gap: 6px;
  }

  .tab-name {
    font-size: 12px;
  }

  .tab-nav-arrow {
    padding: 6px;
  }
}
</style>
