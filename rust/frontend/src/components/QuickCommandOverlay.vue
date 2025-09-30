<template>
  <div v-if="show" class="command-palette-overlay" @click.self="close">
    <div class="command-palette" @click.stop>
      <!-- Header -->
      <header class="palette-header">
        <div class="header-content">
          <div class="header-left">
            <div class="palette-title">
              <div class="title-icon-wrapper">
                <CommandLineIcon class="title-icon" />
              </div>
              <h2 class="title-text">Command Palette</h2>
            </div>
            <div class="terminal-info">
              <ComputerDesktopIcon class="terminal-icon" />
              <span class="terminal-label">{{ getSelectedTerminalDisplay() }}</span>
            </div>
          </div>
          <button @click="close" class="close-button" title="Close (Esc)" aria-label="Close">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
      </header>

      <!-- Search Input -->
      <div class="search-section">
        <div class="search-input-container">
          <MagnifyingGlassIcon class="search-icon" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Type a command or search..."
            class="search-input"
            @keydown="handleSearchKeydown"
            @input="onSearchInput"
          />
          <div v-if="searchMode" class="search-mode-indicator">
            <span class="mode-symbol">{{ searchMode === 'search' ? '/' : '>' }}</span>
            <span class="mode-label">{{ searchMode === 'search' ? 'Search' : 'Command' }}</span>
          </div>
        </div>
      </div>

      <!-- Categories / Results -->
      <div class="palette-content">

        <!-- Command Categories -->
        <div v-if="!searchQuery && !selectedCategory" class="command-categories">
          <div class="category-grid">
            <button
              v-for="category in commandCategories"
              :key="category.id"
              @click="selectCategory(category.id)"
              class="category-card"
              :class="{ dangerous: category.dangerous }"
            >
              <div class="category-icon">
                <component :is="category.icon" />
              </div>
              <div class="category-content">
                <h3 class="category-title">{{ category.title }}</h3>
                <p class="category-description">{{ category.description }}</p>
              </div>
              <ChevronRightIcon class="category-arrow" />
            </button>
          </div>
        </div>

        <!-- Command Results -->
        <div v-else class="command-results">
          <div v-if="selectedCategory" class="breadcrumb">
            <button @click="goBack" class="breadcrumb-back">
              <ChevronLeftIcon class="breadcrumb-icon" />
              Back
            </button>
            <span class="breadcrumb-current">{{ getCategoryTitle(selectedCategory) }}</span>
          </div>

          <div class="results-list">
            <div
              v-for="(command, index) in filteredCommands"
              :key="command.id"
              @click="selectCommand(command)"
              @keydown="handleCommandKeydown($event, command)"
              class="command-item"
              :class="{
                active: selectedCommandIndex === index,
                dangerous: command.dangerous
              }"
              tabindex="0"
            >
              <div class="command-icon">
                <component :is="command.icon" />
              </div>
              <div class="command-content">
                <div class="command-title">{{ command.title }}</div>
                <div class="command-description">{{ command.description }}</div>
                <div v-if="command.preview" class="command-preview">
                  <code>{{ command.preview }}</code>
                </div>
              </div>
              <div class="command-meta">
                <div v-if="command.shortcut" class="command-shortcut">
                  <kbd v-for="key in command.shortcut" :key="key">{{ key }}</kbd>
                </div>
                <ChevronRightIcon class="command-indicator" />
              </div>
            </div>

            <div v-if="filteredCommands.length === 0" class="no-results">
              <MagnifyingGlassIcon class="no-results-icon" />
              <p class="no-results-text">No commands found</p>
              <p class="no-results-hint">Try a different search term or browse categories</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="palette-footer">
        <div class="footer-shortcuts">
          <div class="shortcut-group">
            <kbd>⌘K</kbd>
            <span>Toggle</span>
          </div>
          <div class="shortcut-group">
            <kbd>↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div class="shortcut-group">
            <kbd>Enter</kbd>
            <span>Execute</span>
          </div>
          <div class="shortcut-group">
            <kbd>Esc</kbd>
            <span>Close</span>
          </div>
          <div class="shortcut-group">
            <kbd>/</kbd>
            <span>Search</span>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTerminalTreeStore } from '@/stores/terminal-tree'
import { useUIStore } from '@/stores/ui'
import { CommandHistory } from '@/utils/claudeCommands'
import type { TerminalPane } from '@/types/terminal'

// Heroicons
import {
  ChatBubbleLeftRightIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  CogIcon,
  XMarkIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
  ComputerDesktopIcon
} from '@heroicons/vue/24/outline'

const terminalTreeStore = useTerminalTreeStore()
const uiStore = useUIStore()

// Component state
const searchInput = ref<HTMLInputElement>()
const searchQuery = ref('')
const selectedTerminal = ref<string>('')
const selectedCategory = ref<string>('')
const selectedCommandIndex = ref(0)
const searchMode = ref<'search' | 'command' | null>(null)
const commandHistory = ref<string[]>([])

// Command categories
const commandCategories = [
  {
    id: 'claude-safe',
    title: 'Ask Claude',
    description: 'Ask questions, get explanations, analyze code',
    icon: ChatBubbleLeftRightIcon,
    dangerous: false
  },
  {
    id: 'claude-modify',
    title: 'Modify Code',
    description: 'Claude can modify files and make code changes',
    icon: ExclamationTriangleIcon,
    dangerous: true
  },
  {
    id: 'terminal',
    title: 'Terminal Commands',
    description: 'Execute commands directly in the terminal',
    icon: CommandLineIcon,
    dangerous: false
  },
  {
    id: 'claude-session',
    title: 'Claude Sessions',
    description: 'Start interactive Claude CLI sessions',
    icon: CogIcon,
    dangerous: false
  },
  {
    id: 'recent',
    title: 'Recent Commands',
    description: 'Access your command history',
    icon: ClockIcon,
    dangerous: false
  }
]

// Dynamic command generation
const generateCommands = () => {
  const commands = []

  // Claude Safe Commands
  if (!selectedCategory.value || selectedCategory.value === 'claude-safe') {
    commands.push(
      {
        id: 'claude-ask-custom',
        title: 'Ask Claude',
        description: 'Ask a custom question',
        icon: ChatBubbleLeftRightIcon,
        category: 'claude-safe',
        type: 'input',
        dangerous: false,
        action: () => openInputMode('ask')
      }
    )
  }

  // Claude Modify Commands
  if (!selectedCategory.value || selectedCategory.value === 'claude-modify') {
    commands.push(
      {
        id: 'claude-modify-custom',
        title: 'Modify Code',
        description: 'Tell Claude what to change or implement',
        icon: ExclamationTriangleIcon,
        category: 'claude-modify',
        type: 'input',
        dangerous: true,
        action: () => openInputMode('modify')
      }
    )
  }

  // Terminal Commands
  if (!selectedCategory.value || selectedCategory.value === 'terminal') {
    commands.push(
      {
        id: 'terminal-custom',
        title: 'Run Command',
        description: 'Execute a custom terminal command',
        icon: CommandLineIcon,
        category: 'terminal',
        type: 'input',
        dangerous: false,
        action: () => openInputMode('command')
      },
      {
        id: 'terminal-ls',
        title: 'List Files',
        description: 'List directory contents',
        icon: DocumentTextIcon,
        category: 'terminal',
        type: 'command',
        preview: 'ls -la',
        dangerous: false,
        shortcut: ['⌘', 'L'],
        action: () => executeCommand('ls -la')
      },
      {
        id: 'terminal-git-status',
        title: 'Git Status',
        description: 'Check repository status',
        icon: WrenchScrewdriverIcon,
        category: 'terminal',
        type: 'command',
        preview: 'git status',
        dangerous: false,
        action: () => executeCommand('git status')
      }
    )
  }

  // Claude Session Commands
  if (!selectedCategory.value || selectedCategory.value === 'claude-session') {
    commands.push(
      {
        id: 'claude-session-safe',
        title: 'Start Claude Session',
        description: 'Begin an interactive Claude CLI session',
        icon: CogIcon,
        category: 'claude-session',
        type: 'command',
        preview: 'claude',
        dangerous: false,
        action: () => executeCommand('claude')
      },
      {
        id: 'claude-session-dangerous',
        title: 'Start Claude Session (Edit Mode)',
        description: 'Start Claude with file modification permissions',
        icon: ExclamationTriangleIcon,
        category: 'claude-session',
        type: 'command',
        preview: 'claude --permission-mode acceptEdits',
        dangerous: true,
        action: () => executeCommand('claude --permission-mode acceptEdits')
      }
    )
  }

  // Recent Commands
  if (!selectedCategory.value || selectedCategory.value === 'recent') {
    commandHistory.value.slice(0, 10).forEach((cmd, index) => {
      commands.push({
        id: `recent-${index}`,
        title: cmd.length > 40 ? cmd.substring(0, 37) + '...' : cmd,
        description: 'Recent command',
        icon: ClockIcon,
        category: 'recent',
        type: 'command',
        preview: cmd,
        dangerous: false,
        action: () => executeCommand(cmd)
      })
    })
  }

  return commands
}

// Computed properties
const filteredCommands = computed(() => {
  const commands = generateCommands()

  if (!searchQuery.value) {
    return selectedCategory.value
      ? commands.filter(cmd => cmd.category === selectedCategory.value)
      : []
  }

  const query = searchQuery.value.toLowerCase()
  return commands.filter(cmd =>
    cmd.title.toLowerCase().includes(query) ||
    cmd.description.toLowerCase().includes(query) ||
    (cmd.preview && cmd.preview.toLowerCase().includes(query))
  )
})

// Load command history from localStorage
const loadCommandHistory = () => {
  commandHistory.value = CommandHistory.load()
}

// Add command to history
const addToHistory = (cmd: string) => {
  commandHistory.value = CommandHistory.addCommand(cmd)
}

// Terminal utilities
const getActiveTabName = (pane: TerminalPane): string => {
  const activeTab = pane.tabs.find(tab => tab.isActive)
  return activeTab?.name || 'Terminal'
}

// Initialize selected terminal
const initializeSelectedTerminal = () => {
  if (terminalTreeStore.activePane) {
    selectedTerminal.value = terminalTreeStore.activePane
  } else if (terminalTreeStore.panes.length > 0) {
    selectedTerminal.value = terminalTreeStore.panes[0].id
  }
}

// Get selected terminal display
const getSelectedTerminalDisplay = () => {
  const pane = terminalTreeStore.panes.find(p => p.id === selectedTerminal.value)
  if (!pane) return 'No Terminal'
  const tabName = getActiveTabName(pane)
  return `${pane.name} - ${tabName}`
}

// Category helpers
const selectCategory = (categoryId: string) => {
  selectedCategory.value = categoryId
  selectedCommandIndex.value = 0
}

const goBack = () => {
  selectedCategory.value = ''
  searchQuery.value = ''
  selectedCommandIndex.value = 0
}

const getCategoryTitle = (categoryId: string) => {
  const category = commandCategories.find(c => c.id === categoryId)
  return category?.title || ''
}

// Component visibility
const show = computed(() => uiStore.showQuickCommandOverlay)

// Close overlay
const close = () => {
  uiStore.closeQuickCommandOverlay()
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedCommandIndex.value = 0
  searchMode.value = null
}

// Command execution
const executeCommand = (command: string) => {
  if (!selectedTerminal.value || !command.trim()) return

  // Add to history
  addToHistory(command)

  // Send to terminal
  terminalTreeStore.sendInput(selectedTerminal.value, command)

  // Close overlay
  close()
}

// Command interface
interface Command {
  id: string
  title: string
  description: string
  icon: typeof CommandLineIcon
  category: string
  type: string
  preview?: string
  dangerous: boolean
  shortcut?: string[]
  action: () => void
}

// Select and execute command
const selectCommand = (command: Command) => {
  if (command.action) {
    command.action()
  }
}

// Input mode for custom commands
const openInputMode = (type: string) => {
  // This would open a secondary input dialog
  // For now, we'll use a simple prompt
  const input = prompt(getInputPromptText(type))
  if (input) {
    const formattedCommand = formatCommandByType(type, input)
    executeCommand(formattedCommand)
  }
}

const getInputPromptText = (type: string) => {
  switch (type) {
    case 'ask': return 'What would you like to ask Claude?'
    case 'modify': return 'What would you like Claude to change or implement?'
    case 'command': return 'Enter terminal command:'
    default: return 'Enter your input:'
  }
}

const formatCommandByType = (type: string, input: string) => {
  switch (type) {
    case 'ask': return `claude -p "${input}"`
    case 'modify': return `claude --permission-mode acceptEdits -p "${input}"`
    case 'command': return input
    default: return input
  }
}

// Search handling
const onSearchInput = () => {
  // Detect search mode
  if (searchQuery.value.startsWith('/')) {
    searchMode.value = 'search'
  } else if (searchQuery.value.startsWith('>')) {
    searchMode.value = 'command'
  } else {
    searchMode.value = null
  }

  selectedCommandIndex.value = 0
}

// Keyboard handling
const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (selectedCategory.value) {
      goBack()
    } else {
      close()
    }
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const commands = filteredCommands.value
    if (commands.length > 0 && selectedCommandIndex.value < commands.length) {
      selectCommand(commands[selectedCommandIndex.value])
    }
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedCommandIndex.value = Math.max(0, selectedCommandIndex.value - 1)
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const maxIndex = Math.max(0, filteredCommands.value.length - 1)
    selectedCommandIndex.value = Math.min(maxIndex, selectedCommandIndex.value + 1)
    return
  }

  if (event.key === '/') {
    if (searchQuery.value === '') {
      event.preventDefault()
      searchQuery.value = '/'
      searchMode.value = 'search'
    }
    return
  }
}

const handleCommandKeydown = (event: KeyboardEvent, command: Command) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectCommand(command)
  }
}

// Focus management
watch(show, (newShow) => {
  if (newShow) {
    nextTick(() => {
      initializeSelectedTerminal()
      loadCommandHistory()
      searchInput.value?.focus()
    })
  }
})

// Watch for category changes
watch(selectedCategory, () => {
  selectedCommandIndex.value = 0
})

// Watch for search changes
watch(searchQuery, () => {
  selectedCommandIndex.value = 0
})

// Global keyboard shortcuts
const handleGlobalKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    if (show.value) {
      close()
    } else {
      uiStore.openQuickCommandOverlay()
    }
  }
}

onMounted(() => {
  loadCommandHistory()
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
/* ===== ATLASSIAN-INSPIRED COMMAND PALETTE ===== */
.command-palette-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: var(--z-modal);
  padding: 80px var(--space-4) var(--space-4);
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(8px);
}

.command-palette {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg, 12px);
  width: 100%;
  max-width: 640px;
  max-height: calc(100vh - 160px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ===== HEADER ===== */
.palette-header {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-secondary);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4, 16px) var(--space-5, 20px);
  gap: var(--space-4, 16px);
}

.header-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.palette-title {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.title-icon-wrapper {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-brand-subtle);
  border-radius: var(--radius-base, 8px);
  color: var(--color-text-brand);
  flex-shrink: 0;
}

.title-icon {
  width: 18px;
  height: 18px;
  color: inherit;
}

.title-text {
  margin: 0;
  font-size: var(--font-size-lg, 16px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight, 1.3);
}

.terminal-info {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding-left: 44px;
  color: var(--color-text-tertiary);
}

.terminal-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.terminal-label {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium, 500);
}

.close-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-base, 8px);
  cursor: pointer;
  color: var(--color-text-tertiary);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.close-button:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}

.close-button:active {
  transform: scale(0.95);
}

.close-icon {
  width: 18px;
  height: 18px;
  color: inherit;
}

/* ===== SEARCH SECTION ===== */
.search-section {
  padding: var(--space-4, 16px) var(--space-5, 20px);
  border-bottom: 1px solid var(--color-border-secondary);
  flex-shrink: 0;
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-3, 12px);
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
  z-index: 1;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 44px;
  padding: 0 var(--space-4, 16px) 0 40px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base, 8px);
  font-size: var(--font-size-md, 15px);
  line-height: var(--line-height-normal, 1.5);
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  outline: none;
  transition: all 0.15s ease;
}

.search-input:focus {
  border-color: var(--color-border-focus);
  background: var(--color-bg-primary);
  box-shadow: 0 0 0 3px var(--color-bg-brand-subtle);
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

.search-mode-indicator {
  position: absolute;
  right: var(--space-3, 12px);
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  background: var(--color-bg-tertiary);
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-base, 8px);
  font-size: var(--font-size-xs, 12px);
  border: 1px solid var(--color-border-secondary);
}

.mode-symbol {
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-brand);
}

.mode-label {
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-medium, 500);
}

/* ===== CONTENT AREA ===== */
.palette-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}

.palette-content::-webkit-scrollbar {
  width: 8px;
}

.palette-content::-webkit-scrollbar-track {
  background: transparent;
}

.palette-content::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: 4px;
}

.palette-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}

/* ===== CATEGORIES ===== */
.command-categories {
  padding: var(--space-2, 8px);
}

.category-grid {
  display: grid;
  gap: var(--space-1, 4px);
}

.category-card {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border: 1px solid transparent;
  border-radius: var(--radius-base, 8px);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  width: 100%;
}

.category-card:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-primary);
}

.category-card.dangerous {
  border-color: transparent;
}

.category-card.dangerous:hover {
  background: var(--color-bg-danger-subtle);
  border-color: var(--color-border-danger);
}

.category-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-base, 8px);
  background: var(--color-bg-brand-subtle);
  color: var(--color-text-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.category-icon svg {
  width: 18px;
  height: 18px;
  color: inherit;
}

.category-card.dangerous .category-icon {
  background: var(--color-bg-danger-subtle);
  color: var(--color-text-danger);
}

.category-content {
  flex: 1;
  min-width: 0;
}

.category-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1, 4px) 0;
  line-height: var(--line-height-tight, 1.3);
}

.category-description {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-normal, 1.5);
}

.category-arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ===== COMMAND RESULTS ===== */
.command-results {
  display: flex;
  flex-direction: column;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border-secondary);
  background: var(--color-bg-secondary);
}

.breadcrumb-back {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  background: transparent;
  border: none;
  color: var(--color-text-brand);
  cursor: pointer;
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-medium, 500);
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-base, 8px);
  transition: all 0.15s ease;
}

.breadcrumb-back:hover {
  background: var(--color-interactive-tertiary-hover);
}

.breadcrumb-icon {
  width: 14px;
  height: 14px;
  color: inherit;
}

.breadcrumb-current {
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
}

.results-list {
  padding: var(--space-2, 8px);
}

.command-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border: 1px solid transparent;
  border-radius: var(--radius-base, 8px);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  width: 100%;
  outline: none;
  position: relative;
}

.command-item:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-primary);
}

.command-item.active {
  background: var(--color-bg-brand-subtle);
  border-color: var(--color-border-brand);
}

.command-item.dangerous:hover {
  background: var(--color-bg-danger-subtle);
  border-color: var(--color-border-danger);
}

.command-item.dangerous.active {
  background: var(--color-bg-danger-subtle);
  border-color: var(--color-border-danger);
}

.command-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-base, 8px);
  background: var(--color-bg-brand-subtle);
  color: var(--color-text-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.command-icon svg {
  width: 16px;
  height: 16px;
  color: inherit;
}

.command-item.dangerous .command-icon {
  background: var(--color-bg-danger-subtle);
  color: var(--color-text-danger);
}

.command-content {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}

.command-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1, 4px);
  line-height: var(--line-height-tight, 1.3);
}

.command-description {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal, 1.5);
  margin-bottom: var(--space-2, 8px);
}

.command-preview {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-base, 8px);
  display: inline-block;
  border: 1px solid var(--color-border-secondary);
}

.command-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-shrink: 0;
  padding-top: 2px;
  color: var(--color-text-tertiary);
}

.command-shortcut {
  display: flex;
  gap: var(--space-1, 4px);
}

.command-shortcut kbd {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base, 8px);
  padding: 2px 6px;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium, 500);
  min-width: 20px;
  text-align: center;
}

.command-indicator {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ===== EMPTY STATES ===== */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12, 48px) var(--space-6, 24px);
  text-align: center;
}

.no-results-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-4, 16px);
}

.no-results-text {
  font-size: var(--font-size-md, 15px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2, 8px) 0;
  line-height: var(--line-height-tight, 1.3);
}

.no-results-hint {
  font-size: var(--font-size-sm, 13px);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-normal, 1.5);
}

/* ===== FOOTER ===== */
.palette-footer {
  padding: var(--space-3, 12px) var(--space-5, 20px);
  border-top: 1px solid var(--color-border-secondary);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}

.footer-shortcuts {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-5, 20px);
  flex-wrap: wrap;
}

.shortcut-group {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium, 500);
}

.shortcut-group kbd {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base, 8px);
  padding: 2px 6px;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium, 500);
  min-width: 24px;
  text-align: center;
}

/* ===== ANIMATIONS ===== */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-16px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes staggerIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.category-card {
  animation: staggerIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.category-card:nth-child(1) { animation-delay: 0ms; }
.category-card:nth-child(2) { animation-delay: 40ms; }
.category-card:nth-child(3) { animation-delay: 80ms; }
.category-card:nth-child(4) { animation-delay: 120ms; }
.category-card:nth-child(5) { animation-delay: 160ms; }

.command-item {
  animation: staggerIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.command-item:nth-child(1) { animation-delay: 0ms; }
.command-item:nth-child(2) { animation-delay: 30ms; }
.command-item:nth-child(3) { animation-delay: 60ms; }
.command-item:nth-child(4) { animation-delay: 90ms; }
.command-item:nth-child(5) { animation-delay: 120ms; }
.command-item:nth-child(6) { animation-delay: 150ms; }
.command-item:nth-child(7) { animation-delay: 180ms; }
.command-item:nth-child(8) { animation-delay: 210ms; }
.command-item:nth-child(9) { animation-delay: 240ms; }
.command-item:nth-child(10) { animation-delay: 270ms; }


/* ===== ACCESSIBILITY ===== */
.close-button:focus-visible,
.breadcrumb-back:focus-visible,
.category-card:focus-visible,
.command-item:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .command-palette-overlay {
    padding: var(--space-4) var(--space-2);
  }

  .command-palette {
    max-width: 100%;
    max-height: calc(100vh - 32px);
  }

  .header-content {
    padding: var(--space-3, 12px) var(--space-4, 16px);
  }

  .header-left {
    gap: var(--space-1, 4px);
  }

  .terminal-info {
    padding-left: 0;
    padding-left: 44px;
  }

  .search-section {
    padding: var(--space-3, 12px) var(--space-4, 16px);
  }

  .category-icon {
    width: 36px;
    height: 36px;
  }

  .category-icon svg {
    width: 16px;
    height: 16px;
  }

  .command-icon {
    width: 28px;
    height: 28px;
  }

  .command-icon svg {
    width: 14px;
    height: 14px;
  }

  .footer-shortcuts {
    gap: var(--space-3, 12px);
  }
}

@media (max-width: 480px) {
  .terminal-info {
    padding-left: 0;
  }

  .footer-shortcuts {
    display: none;
  }

  .palette-footer {
    padding: var(--space-2, 8px);
  }
}

/* ===== REDUCED MOTION ===== */
@media (prefers-reduced-motion: reduce) {
  .command-palette-overlay,
  .command-palette,
  .category-card,
  .command-item,
  .close-button,
  .breadcrumb-back {
    animation: none !important;
    transition: none !important;
  }
}

</style>