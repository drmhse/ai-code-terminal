<template>
  <div v-if="show" class="command-palette-overlay" @click.self="close">
    <div class="command-palette" @click.stop>
      <!-- Header -->
      <header class="palette-header">
        <div class="header-content">
          <div class="palette-title">
            <CommandLineIcon class="title-icon" />
            <span>Command Palette</span>
          </div>
          <div class="terminal-info">
            <span class="terminal-badge">{{ getSelectedTerminalDisplay() }}</span>
          </div>
        </div>
        <button @click="close" class="close-button" title="Close (Esc)">
          <XMarkIcon class="close-icon" />
        </button>
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
                <ChevronRightIcon v-if="command.type === 'navigation'" class="command-indicator" />
                <PlayIcon v-else-if="command.dangerous" class="command-indicator danger" />
                <PlayIcon v-else class="command-indicator" />
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
  PlayIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon
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
/* ACT Theme-Aware Command Palette Styles */
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
  padding: var(--space-12) var(--space-5) var(--space-5);
  animation: fadeIn var(--transition-fast) cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(2px);
  will-change: opacity;
}

.command-palette {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--modal-border-radius);
  width: 100%;
  max-width: var(--modal-max-width);
  max-height: calc(100vh - 120px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: slideDown var(--transition-base) cubic-bezier(0.16, 1, 0.3, 1);
  font-family: var(--font-family-sans);
  will-change: transform, opacity;
}

/* Header */
.palette-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border-secondary);
  background: var(--color-bg-secondary);
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
}

.palette-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.title-icon {
  width: var(--space-5);
  height: var(--space-5);
  color: var(--color-text-tertiary);
}

.terminal-info {
  display: flex;
  align-items: center;
}

.terminal-badge {
  background: var(--color-semantic-success-bg);
  color: var(--color-semantic-success);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  border: 1px solid var(--color-semantic-success-border);
  transition: var(--transition-colors);
}

.close-button {
  background: none;
  border: none;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-colors);
  width: var(--space-8);
  height: var(--space-8);
}

.close-button:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}

.close-icon {
  width: var(--space-4);
  height: var(--space-4);
}

/* Search Section */
.search-section {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border-secondary);
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  width: var(--space-4);
  height: var(--space-4);
  color: var(--color-text-tertiary);
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-10);
  border: 2px solid var(--color-input-border);
  border-radius: var(--input-border-radius);
  font-size: var(--input-font-size);
  line-height: var(--line-height-normal);
  color: var(--color-input-text);
  background: var(--color-input-background);
  outline: none;
  transition: all var(--transition-fast) cubic-bezier(0.23, 1, 0.32, 1);
  font-family: var(--font-family-sans);
  height: var(--input-height-base);
  transform: translateZ(0);
}

.search-input:focus {
  border-color: var(--color-input-border-focus);
  background: var(--color-input-background-focus);
  transform: translateY(-1px) translateZ(0);
  box-shadow: var(--shadow-sm);
}

.search-input::placeholder {
  color: var(--color-input-placeholder);
}

.search-mode-indicator {
  position: absolute;
  right: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--color-bg-tertiary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--font-size-xs);
  border: 1px solid var(--color-border-secondary);
}

.mode-symbol {
  font-weight: var(--font-weight-semibold);
  color: var(--color-interactive-primary);
}

.mode-label {
  color: var(--color-text-tertiary);
}

/* Content Area */
.palette-content {
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 280px);
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}

.palette-content::-webkit-scrollbar {
  width: 6px;
}

.palette-content::-webkit-scrollbar-track {
  background: var(--color-scrollbar-track);
}

.palette-content::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: var(--radius-full);
}

.palette-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}

/* Categories */
.command-categories {
  padding: var(--space-2);
}

.category-grid {
  display: grid;
  gap: var(--space-1);
}

.category-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast) cubic-bezier(0.23, 1, 0.32, 1);
  width: 100%;
  transform: translateZ(0);
}

.category-card:hover {
  background: var(--color-interactive-tertiary-hover);
  transform: translateY(-1px) translateZ(0);
  box-shadow: var(--shadow-sm);
}

.category-card.dangerous:hover {
  background: var(--color-semantic-error-bg);
  transform: translateY(-1px) translateZ(0);
  box-shadow: var(--shadow-sm);
}

.category-icon {
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: var(--transition-colors);
}

.category-icon svg {
  width: var(--space-4);
  height: var(--space-4);
  color: var(--color-text-tertiary);
}

.category-card.dangerous .category-icon {
  background: var(--color-semantic-error-bg);
}

.category-card.dangerous .category-icon svg {
  color: var(--color-semantic-error);
}

.category-content {
  flex: 1;
  min-width: 0;
}

.category-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1) 0;
  line-height: var(--line-height-tight);
}

.category-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-normal);
}

.category-arrow {
  width: var(--space-4);
  height: var(--space-4);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

/* Command Results */
.command-results {
  display: flex;
  flex-direction: column;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-secondary);
  background: var(--color-bg-secondary);
}

.breadcrumb-back {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: none;
  border: none;
  color: var(--color-interactive-link);
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: var(--space-1);
  border-radius: var(--radius-base);
  transition: var(--transition-colors);
  font-family: var(--font-family-sans);
}

.breadcrumb-back:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-interactive-link-hover);
}

.breadcrumb-icon {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
}

.breadcrumb-current {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.results-list {
  padding: var(--space-2);
}

.command-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast) cubic-bezier(0.23, 1, 0.32, 1);
  width: 100%;
  outline: none;
  position: relative;
  transform: translateZ(0);
}

.command-item:hover,
.command-item.active {
  background: var(--color-interactive-tertiary-hover);
  transform: translateY(-1px) translateZ(0);
}

.command-item.dangerous:hover,
.command-item.dangerous.active {
  background: var(--color-semantic-error-bg);
  transform: translateY(-1px) translateZ(0);
}

.command-item.active {
  box-shadow: inset 3px 0 0 var(--color-interactive-primary), var(--shadow-xs);
}

.command-item.dangerous.active {
  box-shadow: inset 3px 0 0 var(--color-semantic-error), var(--shadow-xs);
}

.command-icon {
  width: var(--space-6);
  height: var(--space-6);
  border-radius: var(--radius-base);
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: var(--transition-colors);
}

.command-icon svg {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

.command-item.dangerous .command-icon {
  background: var(--color-semantic-error-bg);
}

.command-item.dangerous .command-icon svg {
  color: var(--color-semantic-error);
}

.command-content {
  flex: 1;
  min-width: 0;
}

.command-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-0-5);
  line-height: var(--line-height-tight);
}

.command-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  margin-bottom: var(--space-1);
}

.command-preview {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: var(--space-0-5) var(--space-1-5);
  border-radius: var(--radius-base);
  display: inline-block;
  margin-top: var(--space-0-5);
  border: 1px solid var(--color-border-secondary);
}

.command-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.command-shortcut {
  display: flex;
  gap: var(--space-0-5);
}

.command-shortcut kbd {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  padding: var(--space-0-5) var(--space-1-5);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-family: var(--font-family-sans);
  box-shadow: var(--shadow-xs);
}

.command-indicator {
  width: var(--font-size-sm);
  height: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

.command-indicator.danger {
  color: var(--color-semantic-error);
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-5);
  text-align: center;
}

.no-results-icon {
  width: var(--space-12);
  height: var(--space-12);
  color: var(--color-border-primary);
  margin-bottom: var(--space-4);
}

.no-results-text {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1) 0;
  line-height: var(--line-height-tight);
}

.no-results-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-normal);
}

/* Footer */
.palette-footer {
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--color-border-secondary);
  background: var(--color-bg-secondary);
}

.footer-shortcuts {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.shortcut-group {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-family: var(--font-family-sans);
}

.shortcut-group kbd {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-base);
  padding: var(--space-0-5) var(--space-1-5);
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  font-family: var(--font-family-sans);
  box-shadow: var(--shadow-xs);
}

/* Animations */
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
    transform: translate3d(0, -8px, 0) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes staggerIn {
  from {
    opacity: 0;
    transform: translate3d(0, 4px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* Add stagger animation to results */
.results-list .command-item {
  animation: staggerIn var(--transition-base) cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.results-list .command-item:nth-child(1) { animation-delay: 0ms; }
.results-list .command-item:nth-child(2) { animation-delay: 20ms; }
.results-list .command-item:nth-child(3) { animation-delay: 40ms; }
.results-list .command-item:nth-child(4) { animation-delay: 60ms; }
.results-list .command-item:nth-child(5) { animation-delay: 80ms; }
.results-list .command-item:nth-child(6) { animation-delay: 100ms; }
.results-list .command-item:nth-child(7) { animation-delay: 120ms; }
.results-list .command-item:nth-child(8) { animation-delay: 140ms; }
.results-list .command-item:nth-child(9) { animation-delay: 160ms; }
.results-list .command-item:nth-child(10) { animation-delay: 180ms; }


/* Mobile Responsiveness */
@media (max-width: 768px) {
  .command-palette-overlay {
    padding: var(--space-5) var(--space-3);
    align-items: flex-end;
  }

  .command-palette {
    max-width: none;
    width: 100%;
    max-height: 85vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .palette-header {
    padding: var(--space-4);
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .search-section {
    padding: var(--space-3) var(--space-4);
  }

  .category-grid {
    gap: var(--space-0-5);
  }

  .category-card {
    padding: var(--space-4) var(--space-3);
  }

  .footer-shortcuts {
    gap: var(--space-4);
  }

  .shortcut-group {
    font-size: var(--font-size-xs);
  }
}

@media (max-width: 480px) {
  .footer-shortcuts {
    display: none;
  }

  .palette-footer {
    padding: var(--space-2) var(--space-4);
  }
}

</style>