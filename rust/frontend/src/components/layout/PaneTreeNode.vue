<template>
  <!-- Container Node - renders its children with flex layout -->
  <div
    v-if="node.type === 'container'"
    class="pane-container"
    :class="`direction-${node.direction}`"
    :style="containerStyle"
  >
    <template v-for="(child, index) in node.children" :key="child.id">
      <!-- Render child node -->
      <PaneTreeNode
        :node="child"
        :workspace-path="workspacePath"
        :theme="theme"
        :is-active="child.id === activeNodeId"
        @focus="$emit('focus', $event)"
        @split="$emit('split', $event)"
        @data="$emit('data', $event)"
        @resize="$emit('resize', $event)"
        @close-pane="$emit('close-pane', $event)"
        :style="{ flex: childFlexValues[index]?.flex || '1 1 0%' }"
      />

      <!-- Render splitter between children (not after the last child) -->
      <Splitter
        v-if="index < node.children.length - 1"
        :direction="node.direction || 'horizontal'"
        :index="index"
        @resize="handleSplitterResize"
      />
    </template>
  </div>

  <!-- Terminal Node - renders actual terminal pane -->
  <div
    v-else
    class="terminal-pane-wrapper"
    :class="{
      active: isActive,
      'drop-target': isDragOverPane,
      'has-empty-tab-area': !node.tabs || node.tabs.length === 0
    }"
    :data-pane-id="node.id"
    @dragover.prevent="handlePaneDragOver"
    @dragleave="handlePaneDragLeave"
    @drop="handlePaneDrop"
  >

    <!-- Enhanced Tabs Bar -->
    <div v-if="node.tabs && node.tabs.length > 0" class="pane-tabs" :class="{ 'single-tab': node.tabs.length === 1, 'multi-tab': node.tabs.length > 1 }">
      <div class="tabs-container">
        <!-- Tab Navigation Arrow (for overflow) -->
        <button
          v-if="showTabOverflow"
          class="tab-nav-arrow tab-nav-left"
          @click="scrollTabsLeft"
          :disabled="scrollPosition <= 0"
        >
          <ChevronLeftIcon class="h-3 w-3" />
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
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, tab)"
            @dragend="handleDragEnd"
          >
            <div class="tab-content">
              <span class="tab-name" :title="tab.name">{{ tab.name }}</span>
              <button
                v-if="node.tabs && node.tabs.length > 1"
                @click.stop="closeTab(tab.id)"
                class="tab-close"
                title="Close tab"
              >
                <XMarkIcon class="h-3 w-3" />
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

        <!-- Split Pane Dropdown -->
        <div ref="splitDropdownRef" class="split-dropdown">
          <button
            @click="toggleSplitDropdown"
            class="split-dropdown-trigger"
            title="Split pane"
            :class="{ active: showSplitDropdown }"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
            </svg>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </button>

          <div v-if="showSplitDropdown" class="split-dropdown-menu">
            <button
              @click="handleSplitPane('vertical')"
              class="split-option"
              title="Split right"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="8" height="18"></rect>
                <rect x="13" y="3" width="8" height="18"></rect>
              </svg>
              Split Right
            </button>
            <button
              @click="handleSplitPane('horizontal')"
              class="split-option"
              title="Split bottom"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="8"></rect>
                <rect x="3" y="13" width="18" height="8"></rect>
              </svg>
              Split Bottom
            </button>
          </div>
        </div>

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

        <!-- Close Pane Button (only show if there are multiple terminal nodes) -->
        <button
          v-if="showCloseButton"
          @click="handleClosePane"
          class="close-btn"
          title="Close pane"
        >
          <XMarkIcon class="h-3 w-3" />
        </button>
      </div>
    </div>

    <!-- Terminal Content -->
    <div class="terminal-content">
      <!-- Container for each terminal tab -->
      <div
        v-for="tab in node.tabs"
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
import type { PaneNode, TerminalTab } from '@/types/pane-tree'
import type { TerminalTheme } from '@/types/terminal'
import { useTerminalTreeStore } from '@/stores/terminal-tree'
import { useWorkspaceStore } from '@/stores/workspace'
import { calculateFlexProperties, getFlexDirection } from '@/utils/pane-tree'
import { XMarkIcon, ChevronLeftIcon } from '@heroicons/vue/24/outline'
import Splitter from './Splitter.vue'

interface Props {
  node: PaneNode
  isActive: boolean
  activeNodeId?: string
  workspacePath?: string
  showCloseButton?: boolean
  theme?: TerminalTheme
}

interface Emits {
  (e: 'focus', paneId: string): void
  (e: 'split', payload: { paneId: string, direction: 'horizontal' | 'vertical' }): void
  (e: 'data', payload: { paneId: string, data: string }): void
  (e: 'resize', payload: { paneId: string, cols: number, rows: number }): void
  (e: 'close-pane', paneId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  showCloseButton: true
})

const emit = defineEmits<Emits>()

const terminalStore = useTerminalTreeStore()
const workspaceStore = useWorkspaceStore()

// Access all terminal nodes from the store for drag and drop
const allTerminalNodes = computed(() => terminalStore.allTerminalNodes)

// Container-specific computed properties
const containerStyle = computed(() => {
  if (props.node.type !== 'container' || !props.node.direction) return {}

  return {
    display: 'flex',
    flexDirection: getFlexDirection(props.node.direction),
    width: '100%',
    height: '100%'
  }
})

const childFlexValues = computed(() => {
  if (props.node.type !== 'container') return []
  return calculateFlexProperties(props.node)
})

// Terminal-specific properties (reused from original TerminalPane component)
const draggedTab = ref<TerminalTab | null>(null)
const dragOverTab = ref<TerminalTab | null>(null)
const terminalRefs = ref<Map<string, HTMLDivElement>>(new Map())
const terminalInstances = ref<Map<string, Terminal>>(new Map())
const fitAddons = ref<Map<string, FitAddon>>(new Map())
const webLinksAddons = ref<Map<string, WebLinksAddon>>(new Map())
const webglAddons = ref<Map<string, WebglAddon>>(new Map())
const addonStates = ref<Map<string, { fitLoaded: boolean, webLinksLoaded: boolean, webglLoaded: boolean }>>(new Map())
const isDisposed = ref(false)

// Terminal management state
const resizeObserver = ref<ResizeObserver>()
let cleanupOutputHandler: (() => void) | null = null

// Tab management
const tabsScrollContainer = ref<HTMLDivElement>()
const scrollPosition = ref(0)
const showTabOverflow = ref(false)
const maxScrollPosition = ref(0)
const isDragOverPane = ref(false)
const showSplitDropdown = ref(false)
const splitDropdownRef = ref<HTMLDivElement>()

const sortedTabs = computed(() => {
  if (!props.node.tabs) return []
  return [...props.node.tabs].sort((a, b) => a.order - b.order)
})

const getActiveTab = (): TerminalTab | undefined => {
  return props.node.tabs?.find(tab => tab.isActive)
}

// Terminal management functions
const getActiveTerminal = (): Terminal | undefined => {
  const activeTab = getActiveTab()
  return activeTab ? terminalInstances.value.get(activeTab.id) : undefined
}

const createTerminalForTab = (tabId: string): Terminal => {
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
    allowTransparency: false,
    drawBoldTextInBrightColors: true,
    minimumContrastRatio: 1,
    customGlyphs: true,
    rescaleOverlappingGlyphs: true
  })

  terminalInstances.value.set(tabId, terminal)
  addonStates.value.set(tabId, { fitLoaded: false, webLinksLoaded: false, webglLoaded: false })

  return terminal
}

const initializeTerminalForTab = async (tabId: string) => {
  if (isDisposed.value) return

  if (terminalInstances.value.has(tabId)) {
    console.log(`Terminal already exists for tab ${tabId}`)
    return
  }

  let container = terminalRefs.value.get(tabId)
  if (!container) {
    await nextTick()
    container = terminalRefs.value.get(tabId)
    if (!container) {
      console.warn(`No container found for tab ${tabId}`)
      return
    }
  }

  const terminal = createTerminalForTab(tabId)
  const state = addonStates.value.get(tabId)!

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

  terminal.open(container)

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
    const activeTab = getActiveTab()
    if (activeTab?.id === tabId) {
      emit('data', { paneId: props.node.id, data })
    }
  })

  terminal.onResize(({ cols, rows }) => {
    if (cols < 10 || rows < 5 || cols > 500 || rows > 200) {
      console.warn(`Invalid terminal dimensions: ${cols}x${rows}`)
      return
    }
    const activeTab = getActiveTab()
    if (activeTab?.id === tabId) {
      emit('resize', { paneId: props.node.id, cols, rows })
    }
  })

  console.log(`✅ Terminal initialized for tab ${tabId}`)
}

const initializeTerminals = async () => {
  if (isDisposed.value || props.node.type !== 'terminal') return

  for (const tab of (props.node.tabs || [])) {
    await initializeTerminalForTab(tab.id)
  }

  // Set up resize observer for the terminal content area
  const terminalContent = document.querySelector(`[data-pane-id="${props.node.id}"] .terminal-content`) as HTMLElement
  if (terminalContent && !resizeObserver.value) {
    resizeObserver.value = new ResizeObserver(() => {
      // Debounced fit with multiple attempts for robustness
      setTimeout(() => {
        if (!isDisposed.value) {
          console.log(`🔄 ResizeObserver triggered for pane ${props.node.id}`)

          // Fit all terminals in this pane, not just the active one
          const allTabs = props.node.tabs || []
          allTabs.forEach(tab => {
            if (terminalInstances.value.has(tab.id)) {
              fitWithRetry(tab.id)
            }
          })
        }
      }, 50)
    })
    resizeObserver.value.observe(terminalContent)
    console.log(`👁️ ResizeObserver set up for pane ${props.node.id}`)
  }

  console.log(`✅ Terminals initialized for pane ${props.node.id}`)
}

const write = (data: string, sessionId?: string) => {
  if (!isDisposed.value && props.node.type === 'terminal') {
    if (sessionId) {
      const targetTab = props.node.tabs?.find(tab => tab.sessionId === sessionId)
      if (targetTab) {
        const targetTerminal = terminalInstances.value.get(targetTab.id)
        if (targetTerminal) {
          targetTerminal.write(data)
        }
      }
    } else {
      const activeTerminal = getActiveTerminal()
      if (activeTerminal) {
        activeTerminal.write(data)
      }
    }
  }
}

const fit = () => {
  if (!isDisposed.value) {
    const activeTab = getActiveTab()
    if (activeTab) {
      fitWithRetry(activeTab.id)
    }
  }
}

const dispose = () => {
  if (isDisposed.value) return

  try {
    if (resizeObserver.value) {
      resizeObserver.value.disconnect()
      resizeObserver.value = undefined
    }

    terminalInstances.value.forEach((terminal, tabId) => {
      try {
        terminal.dispose()
      } catch (error) {
        console.warn(`Terminal disposal error for tab ${tabId}:`, error)
      }
    })

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

    terminalInstances.value.clear()
    fitAddons.value.clear()
    webLinksAddons.value.clear()
    webglAddons.value.clear()
    addonStates.value.clear()

    isDisposed.value = true
  } catch (error) {
    console.error('Error during terminal disposal:', error)
    isDisposed.value = true
  }
}

// Terminal initialization and management (simplified version from original)
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

// Event handlers
const selectTab = (tabId: string) => {
  terminalStore.setActiveTabInPane(props.node.id, tabId)
  emit('focus', props.node.id)
}

const createNewTab = () => {
  if (workspaceStore.selectedWorkspace) {
    terminalStore.createTabInPane(props.node.id, workspaceStore.selectedWorkspace.id, 'Terminal')
  }
}

const closeTab = (tabId: string) => {
  terminalStore.closeTabInPane(props.node.id, tabId)
}

const focus = () => {
  const activeTerminal = getActiveTerminal()
  if (activeTerminal) {
    activeTerminal.focus()
  }
  emit('focus', props.node.id)
}

// Tab scrolling and overflow
const updateTabOverflow = () => {
  if (tabsScrollContainer.value) {
    const container = tabsScrollContainer.value
    showTabOverflow.value = container.scrollWidth > container.clientWidth
    maxScrollPosition.value = container.scrollWidth - container.clientWidth
  }
}

const scrollTabsLeft = () => {
  if (tabsScrollContainer.value) {
    tabsScrollContainer.value.scrollBy({ left: -150, behavior: 'smooth' })
  }
}

const scrollTabsRight = () => {
  if (tabsScrollContainer.value) {
    tabsScrollContainer.value.scrollBy({ left: 150, behavior: 'smooth' })
  }
}

const handleTabsScroll = () => {
  if (tabsScrollContainer.value) {
    scrollPosition.value = tabsScrollContainer.value.scrollLeft
  }
}

// Drag and drop with improved error handling and state management
const handleDragStart = (event: DragEvent, tab: TerminalTab) => {
  console.log(`🚀 Starting drag for tab ${tab.id}`)
  draggedTab.value = tab
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', tab.id)
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragOver = (event: DragEvent, tab: TerminalTab) => {
  event.preventDefault()
  event.stopPropagation()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  // Get dragged tab ID from dataTransfer to check if we should show drag over state
  const draggedTabId = event.dataTransfer?.getData('text/plain')
  if (draggedTabId && draggedTabId !== tab.id) {
    dragOverTab.value = tab
  }
}

const handleDragLeave = (event: DragEvent) => {
  // Only clear visual feedback, never clear the dragged tab state
  // The dragged tab state should only be cleared on dragend or successful drop
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    dragOverTab.value = null
  }
}

const handleDrop = async (event: DragEvent, targetTab: TerminalTab) => {
  event.preventDefault()
  event.stopPropagation()

  console.log(`🎯 Drop triggered for tab ${targetTab.id}`)

  // Get dragged tab ID from dataTransfer
  const draggedTabId = event.dataTransfer?.getData('text/plain')
  if (!draggedTabId || draggedTabId === targetTab.id) {
    console.log('❌ Invalid drop: no dragged tab or same tab')
    return
  }

  console.log(`📋 Got dragged tab ID from dataTransfer: ${draggedTabId}`)

  try {
    // Find source pane and dragged tab using the ID from dataTransfer
    let draggedTabObj: TerminalTab | null = null
    const sourcePane = allTerminalNodes.value.find(node => {
      const tab = node.tabs?.find(tab => tab.id === draggedTabId)
      if (tab) {
        draggedTabObj = tab
        return true
      }
      return false
    })

    if (!sourcePane || !draggedTabObj) {
      console.error('❌ Source pane or dragged tab not found')
      return
    }

    if (sourcePane.id !== props.node.id) {
      // Moving tab between different panes
      const targetIndex = props.node.tabs?.findIndex(tab => tab.id === targetTab.id) || 0
      console.log(`🔄 Moving tab ${draggedTabId} from pane ${sourcePane.id} to pane ${props.node.id} at index ${targetIndex}`)

      const success = terminalStore.moveTabBetweenPanes(sourcePane.id, props.node.id, draggedTabId, targetIndex)

      if (success) {
        console.log('✅ Tab moved between panes successfully')

        // Force resize the moved tab in its new container
        setTimeout(() => {
          console.log(`🔧 Triggering post-move resize for tab ${draggedTabId}`)
          forceResizeTab(draggedTabId)
        }, 100)
      } else {
        console.error('❌ Failed to move tab between panes')
      }
    } else {
      // Reordering tabs within the same pane
      const draggedIndex = props.node.tabs?.findIndex(tab => tab.id === draggedTabId) || 0
      const targetIndex = props.node.tabs?.findIndex(tab => tab.id === targetTab.id) || 0

      if (draggedIndex !== targetIndex && props.node.tabs) {
        console.log(`🔄 Reordering tab within pane ${props.node.id}: ${draggedIndex} → ${targetIndex}`)

        const tabs = [...props.node.tabs]
        const [draggedTabObj] = tabs.splice(draggedIndex, 1)
        tabs.splice(targetIndex, 0, draggedTabObj)

        // Update tab orders
        tabs.forEach((tab, index) => {
          tab.order = index
        })

        props.node.tabs = tabs
        console.log('✅ Tab reordered within pane successfully')
      }
    }
  } catch (error) {
    console.error('❌ Error during drop handling:', error)
  } finally {
    // Clear visual state
    dragOverTab.value = null
  }
}

const handleDragEnd = () => {
  console.log('🏁 Drag ended, cleaning up visual state')

  // Clear visual feedback immediately
  dragOverTab.value = null
  isDragOverPane.value = false

  // Don't clear draggedTab.value immediately to allow drop events to complete
  // Use a timeout to cleanup stale drag state as a fallback
  setTimeout(() => {
    if (draggedTab.value) {
      console.log('🧹 Cleaning up stale drag state')
      draggedTab.value = null
    }
  }, 100)
}

// Pane drag and drop with improved validation
const handlePaneDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  // Get dragged tab ID from dataTransfer to check if we should show drop target
  const draggedTabId = event.dataTransfer?.getData('text/plain')
  if (draggedTabId) {
    const sourcePane = allTerminalNodes.value.find(node =>
      node.tabs?.some(tab => tab.id === draggedTabId)
    )

    if (sourcePane && sourcePane.id !== props.node.id) {
      isDragOverPane.value = true
    }
  }
}

const handlePaneDragLeave = (event: DragEvent) => {
  // Only clear visual drop target state, never clear the dragged tab
  // Be more conservative about clearing to avoid race conditions
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY

  // Add some margin to prevent flickering when dragging near edges
  const margin = 10
  if (x < rect.left - margin || x > rect.right + margin ||
      y < rect.top - margin || y > rect.bottom + margin) {
    isDragOverPane.value = false
  }
}

const handlePaneDrop = async (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  console.log(`🎯 Pane drop triggered for pane ${props.node.id}`)

  isDragOverPane.value = false

  // Get the dragged tab ID from dataTransfer instead of local state
  const draggedTabId = event.dataTransfer?.getData('text/plain')
  if (!draggedTabId) {
    console.log('❌ No dragged tab ID in dataTransfer')
    return
  }

  console.log(`📋 Got dragged tab ID from dataTransfer: ${draggedTabId}`)

  try {
    // Find source pane and dragged tab using the ID from dataTransfer
    let draggedTabObj: TerminalTab | null = null
    const sourcePane = allTerminalNodes.value.find(node => {
      const tab = node.tabs?.find(tab => tab.id === draggedTabId)
      if (tab) {
        draggedTabObj = tab
        return true
      }
      return false
    })

    if (!sourcePane || !draggedTabObj) {
      console.error('❌ Source pane or dragged tab not found for pane drop')
      return
    }

    if (sourcePane.id !== props.node.id) {
      // Moving tab to a different pane (at the end)
      const targetIndex = props.node.tabs?.length || 0
      console.log(`🔄 Moving tab ${draggedTabId} from pane ${sourcePane.id} to end of pane ${props.node.id} at index ${targetIndex}`)

      const success = terminalStore.moveTabBetweenPanes(sourcePane.id, props.node.id, draggedTabId, targetIndex)

      if (success) {
        console.log('✅ Tab moved to pane successfully')

        // Force resize the moved tab in its new container
        setTimeout(() => {
          console.log(`🔧 Triggering post-move resize for tab ${draggedTabId}`)
          forceResizeTab(draggedTabId)
        }, 100)
      } else {
        console.error('❌ Failed to move tab to pane')
      }
    }
  } catch (error) {
    console.error('❌ Error during pane drop handling:', error)
  } finally {
    // Clear visual state
    dragOverTab.value = null
    isDragOverPane.value = false
  }
}

// Splitter resizing
const handleSplitterResize = (payload: { index: number, delta: number }) => {
  if (props.node.type !== 'container' || !props.node.children) return

  const children = props.node.children
  const { index, delta } = payload

  // Calculate current sizes as percentages
  const currentSizes = children.map(child => child.size || (100 / children.length))

  // Determine pixel-to-percentage conversion factor
  // This is a rough approximation - in production you'd want to get the actual container size
  const containerSize = props.node.direction === 'horizontal' ? window.innerHeight : window.innerWidth
  const deltaPercentage = (delta / containerSize) * 100

  // Adjust the two adjacent panes
  if (index >= 0 && index < children.length - 1) {
    const newLeftSize = Math.max(5, Math.min(95, currentSizes[index] + deltaPercentage))
    const newRightSize = Math.max(5, Math.min(95, currentSizes[index + 1] - deltaPercentage))

    // Update the sizes array
    const newSizes = [...currentSizes]
    newSizes[index] = newLeftSize
    newSizes[index + 1] = newRightSize

    // Call the store action to update sizes
    terminalStore.resizePanes(props.node.id, newSizes)
  }
}

// Pane closing
const handleClosePane = () => {
  terminalStore.closePane(props.node.id)
}

// Split dropdown functionality
const toggleSplitDropdown = () => {
  showSplitDropdown.value = !showSplitDropdown.value
}

const handleSplitPane = (direction: 'horizontal' | 'vertical') => {
  emit('split', { paneId: props.node.id, direction })
  showSplitDropdown.value = false
}

// Close dropdown when clicking outside
const handleClickOutside = (event: Event) => {
  if (splitDropdownRef.value && !splitDropdownRef.value.contains(event.target as Node)) {
    showSplitDropdown.value = false
  }
}

// Watch for tab changes and initialize new terminals
const knownTabIds = ref<Set<string>>(new Set())

watch(() => props.node.tabs, async (newTabs) => {
  if (!newTabs || props.node.type !== 'terminal') return

  // Find newly added tabs
  const newTabIds = new Set(newTabs.map(tab => tab.id))
  const addedTabs = newTabs.filter(tab => !knownTabIds.value.has(tab.id))

  // Initialize terminals for new tabs
  for (const tab of addedTabs) {
    await nextTick() // Ensure DOM is updated
    await initializeTerminalForTab(tab.id)

    // Write any buffered content to the newly initialized terminal
    if (tab.buffer && terminalInstances.value.has(tab.id)) {
      const terminal = terminalInstances.value.get(tab.id)
      if (terminal) {
        terminal.write(tab.buffer)
      }
    }

    // Force resize for newly added tabs (especially important for moved tabs)
    console.log(`🔄 Triggering resize for newly added tab ${tab.id}`)
    forceResizeTab(tab.id)
  }

  // Update known tabs
  knownTabIds.value = newTabIds

  // Update tab overflow
  nextTick(updateTabOverflow)
}, { immediate: true, deep: true })

// Watch for theme changes and update all terminal themes dynamically
watch(() => props.theme, (newTheme) => {
  if (newTheme) {
    terminalInstances.value.forEach((terminal) => {
      terminal.options.theme = newTheme
    })
  }
}, { deep: true })

// Force resize for newly added tabs (especially moved tabs)
const forceResizeTab = (tabId: string) => {
  const terminal = terminalInstances.value.get(tabId)
  const fitAddon = fitAddons.value.get(tabId)

  if (terminal && fitAddon) {
    try {
      console.log(`🔧 Force resizing terminal for tab ${tabId}`)

      // Multiple resize attempts with different timings to handle various scenarios
      setTimeout(() => fitAddon.fit(), 50)   // Quick resize
      setTimeout(() => fitAddon.fit(), 150)  // DOM settled
      setTimeout(() => fitAddon.fit(), 300)  // Final resize after animations

      console.log(`✅ Terminal resize scheduled for tab ${tabId}`)
    } catch (error) {
      console.error(`❌ Error scheduling resize for tab ${tabId}:`, error)
    }
  } else {
    console.warn(`⚠️ Terminal or FitAddon not found for tab ${tabId} resize`)
  }
}

// Enhanced fit function with retry logic
const fitWithRetry = (tabId?: string) => {
  const targetTab = tabId ? { id: tabId } : getActiveTab()
  if (!targetTab) return

  const fitAddon = fitAddons.value.get(targetTab.id)
  const terminal = terminalInstances.value.get(targetTab.id)

  if (fitAddon && terminal && !isDisposed.value) {
    try {
      fitAddon.fit()
      console.log(`📏 Terminal fitted for tab ${targetTab.id}`)
    } catch (error) {
      console.warn(`⚠️ Fit retry failed for tab ${targetTab.id}:`, error)
    }
  }
}

// Expose methods for parent component
defineExpose({ write, fit, focus, dispose, forceResizeTab, fitWithRetry })

onMounted(() => {
  if (props.node.type === 'terminal') {
    // Initialize known tabs with current tabs
    if (props.node.tabs) {
      knownTabIds.value = new Set(props.node.tabs.map(tab => tab.id))
    }

    nextTick(async () => {
      await initializeTerminals()

      // Set up output handler
      cleanupOutputHandler = terminalStore.onTerminalOutput((sessionId, output) => {
        write(output, sessionId)
      })

      // Focus the active terminal and fit it
      setTimeout(() => {
        const activeTerminal = getActiveTerminal()
        if (activeTerminal) {
          activeTerminal.focus()
          fit()
        }
      }, 100)

      updateTabOverflow()
      window.addEventListener('resize', updateTabOverflow)
      document.addEventListener('click', handleClickOutside)
    })
  }
})

onUnmounted(() => {
  if (props.node.type === 'terminal') {
    dispose()

    if (cleanupOutputHandler) {
      cleanupOutputHandler()
      cleanupOutputHandler = null
    }

    window.removeEventListener('resize', updateTabOverflow)
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<style scoped>
/* Container Styles */
.pane-container {
  min-height: 0;
  min-width: 0;
  gap: 0; /* Remove gap for seamless pane appearance */
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--bg-primary, #1a1a1a); /* Subtle container background */
}

.pane-container.direction-horizontal {
  flex-direction: column;
}

.pane-container.direction-vertical {
  flex-direction: row;
}

/* Terminal Pane Wrapper Styles - Borderless Design */
.terminal-pane-wrapper {
  display: flex;
  flex-direction: column;
  background: var(--terminal-bg);
  overflow: hidden;
  min-height: 0;
  min-width: 0;
  width: 100%;
  height: 100%;
  position: relative;
  transition: all 0.15s ease-in-out;
}

.terminal-pane-wrapper:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.02));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.terminal-pane-wrapper.active {
  background: var(--terminal-bg-active, var(--terminal-bg));
  box-shadow: 0 0 0 2px rgba(0, 123, 204, 0.1);
}

.terminal-pane-wrapper.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary);
  z-index: 1;
}


.action-btn, .close-btn, .split-dropdown-trigger, .tab-new {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  min-width: 32px;
  height: 32px;
}

.action-btn:hover, .split-dropdown-trigger:hover, .tab-new:hover {
  background: var(--button-hover, rgba(255, 255, 255, 0.1));
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.close-btn:hover {
  background: var(--error, #f14c4c);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(241, 76, 76, 0.4);
}

/* Terminal Content - Borderless Design */
.terminal-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: var(--terminal-bg);
  min-height: 200px;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 4px;
}

.xterm-container {
  width: 100%;
  height: 100%;
  flex: 1;
  background: var(--terminal-bg);
  position: relative;
  min-height: 0;
  box-sizing: border-box;
  display: none;
}

.xterm-container.active {
  display: block;
}

/* Tabs - Borderless Design */
.pane-tabs {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  min-height: 32px;
  position: relative;
}

.tabs-container {
  display: flex;
  align-items: center;
  height: 100%;
  position: relative;
  padding: 0 8px;
  gap: 8px;
}

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


/* Split Dropdown Styles */
.split-dropdown {
  position: relative;
  z-index: 100;
}

.split-dropdown-trigger {
  gap: 4px;
  min-width: 36px;
}


.split-dropdown-trigger.active {
  background: var(--primary, #007bcc);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 123, 204, 0.4);
}

.split-dropdown-trigger .chevron {
  transition: transform 0.2s ease;
  margin-left: 2px;
}

.split-dropdown-trigger.active .chevron {
  transform: rotate(180deg);
}

.split-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1);
  min-width: 140px;
  z-index: 1000;
  overflow: hidden;
  animation: dropdownFadeIn 0.15s ease-out;
}

.split-option {
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
  text-align: left;
  position: relative;
}

.split-option:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  background: var(--border-color, rgba(255, 255, 255, 0.08));
  opacity: 0.5;
}

.split-option:hover {
  background: var(--button-hover, rgba(255, 255, 255, 0.08));
  color: var(--primary);
}

.split-option:active {
  background: rgba(0, 123, 204, 0.1);
  transform: scale(0.98);
}

.split-option svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.split-option:hover svg {
  opacity: 1;
  color: var(--primary);
}

@keyframes dropdownFadeIn {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Tab navigation arrows - Borderless */
.tab-nav-arrow {
  background: transparent;
  border: none;
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
  background: var(--button-hover, rgba(255, 255, 255, 0.1));
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tab-nav-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none;
}

/* Drag states */
.tab.dragging {
  opacity: 0.6;
  transform: rotate(2deg) scale(0.95);
  z-index: 1000;
}

.tab.drag-over {
  transform: translateY(-2px);
  border-left: 3px solid var(--primary);
}

.terminal-pane-wrapper.drop-target {
  background: rgba(0, 123, 204, 0.1);
  box-shadow: 0 0 0 2px var(--primary), 0 0 20px rgba(0, 123, 204, 0.15);
  transform: scale(1.01);
  transition: all 0.2s ease;
}

/* Pulse animation */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* XTerm.js specific styling for proper functionality */
:deep(.xterm-helper-textarea) {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  width: 0 !important;
  height: 0 !important;
  opacity: 0 !important;
  z-index: -1 !important;
  pointer-events: auto !important;
}

:deep(.xterm-composition-view) {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  opacity: 0 !important;
  pointer-events: auto !important;
}

:deep(.xterm) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.xterm-screen) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.xterm canvas) {
  outline: none !important;
}
</style>