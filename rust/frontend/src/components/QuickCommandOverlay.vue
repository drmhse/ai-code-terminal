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
import { useTerminalStore } from '@/stores/terminal'
import { useUIStore } from '@/stores/ui'
import type { TerminalPane } from '@/stores/terminal'
import { CommandHistory } from '@/utils/claudeCommands'

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

const terminalStore = useTerminalStore()
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
  if (terminalStore.activePane) {
    selectedTerminal.value = terminalStore.activePane
  } else if (terminalStore.panes.length > 0) {
    selectedTerminal.value = terminalStore.panes[0].id
  }
}

// Get selected terminal display
const getSelectedTerminalDisplay = () => {
  const pane = terminalStore.panes.find(p => p.id === selectedTerminal.value)
  if (!pane) return 'No Terminal'
  const tabName = getActiveTabName(pane as TerminalPane)
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
  terminalStore.sendInput(selectedTerminal.value, command)

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
/* Atlassian-inspired Command Palette Styles */
.command-palette-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(9, 30, 66, 0.54);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 9999;
  padding: 60px 20px 20px;
  animation: fadeIn 0.15s ease-out;
}

.command-palette {
  background: #FFFFFF;
  border: 1px solid #DFE1E6;
  border-radius: 8px;
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 120px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 16px -4px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31);
  animation: slideDown 0.15s ease-out;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.palette-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #DFE1E6;
  background: #FAFBFC;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.palette-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  color: #172B4D;
}

.title-icon {
  width: 20px;
  height: 20px;
  color: #6B778C;
}

.terminal-info {
  display: flex;
  align-items: center;
}

.terminal-badge {
  background: #E3FCEF;
  color: #006644;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #C1E9D1;
}

.close-button {
  background: none;
  border: none;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  color: #6B778C;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.close-button:hover {
  background: #F4F5F7;
  color: #172B4D;
}

.close-icon {
  width: 16px;
  height: 16px;
}

/* Search Section */
.search-section {
  padding: 16px 20px;
  border-bottom: 1px solid #DFE1E6;
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: #6B778C;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 40px;
  border: 2px solid #DFE1E6;
  border-radius: 6px;
  font-size: 14px;
  line-height: 20px;
  color: #172B4D;
  background: #FFFFFF;
  outline: none;
  transition: border-color 0.1s ease;
}

.search-input:focus {
  border-color: #2684FF;
}

.search-input::placeholder {
  color: #6B778C;
}

.search-mode-indicator {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: #F4F5F7;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.mode-symbol {
  font-weight: 600;
  color: #2684FF;
}

.mode-label {
  color: #6B778C;
}

/* Content Area */
.palette-content {
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 280px);
}

/* Categories */
.command-categories {
  padding: 8px;
}

.category-grid {
  display: grid;
  gap: 4px;
}

.category-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.1s ease;
  width: 100%;
}

.category-card:hover {
  background: #F4F5F7;
}

.category-card.dangerous:hover {
  background: #FFEBE6;
}

.category-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #F4F5F7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-icon svg {
  width: 16px;
  height: 16px;
  color: #6B778C;
}

.category-card.dangerous .category-icon {
  background: #FFEBE6;
}

.category-card.dangerous .category-icon svg {
  color: #DE350B;
}

.category-content {
  flex: 1;
  min-width: 0;
}

.category-title {
  font-size: 14px;
  font-weight: 500;
  color: #172B4D;
  margin: 0 0 2px 0;
}

.category-description {
  font-size: 12px;
  color: #6B778C;
  margin: 0;
  line-height: 16px;
}

.category-arrow {
  width: 16px;
  height: 16px;
  color: #6B778C;
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
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #DFE1E6;
  background: #FAFBFC;
}

.breadcrumb-back {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #2684FF;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.1s ease;
}

.breadcrumb-back:hover {
  background: #DEEBFF;
}

.breadcrumb-icon {
  width: 14px;
  height: 14px;
}

.breadcrumb-current {
  font-size: 14px;
  font-weight: 500;
  color: #172B4D;
}

.results-list {
  padding: 8px;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.1s ease;
  width: 100%;
  outline: none;
}

.command-item:hover,
.command-item.active {
  background: #F4F5F7;
}

.command-item.dangerous:hover,
.command-item.dangerous.active {
  background: #FFEBE6;
}

.command-item.active {
  box-shadow: inset 3px 0 0 #2684FF;
}

.command-item.dangerous.active {
  box-shadow: inset 3px 0 0 #DE350B;
}

.command-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #F4F5F7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.command-icon svg {
  width: 14px;
  height: 14px;
  color: #6B778C;
}

.command-item.dangerous .command-icon {
  background: #FFEBE6;
}

.command-item.dangerous .command-icon svg {
  color: #DE350B;
}

.command-content {
  flex: 1;
  min-width: 0;
}

.command-title {
  font-size: 14px;
  font-weight: 500;
  color: #172B4D;
  margin-bottom: 2px;
  line-height: 20px;
}

.command-description {
  font-size: 12px;
  color: #6B778C;
  line-height: 16px;
  margin-bottom: 4px;
}

.command-preview {
  font-family: 'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace;
  font-size: 11px;
  color: #6B778C;
  background: #F4F5F7;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
  margin-top: 2px;
}

.command-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.command-shortcut {
  display: flex;
  gap: 2px;
}

.command-shortcut kbd {
  background: #F4F5F7;
  border: 1px solid #DFE1E6;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11px;
  color: #6B778C;
  font-family: inherit;
}

.command-indicator {
  width: 14px;
  height: 14px;
  color: #6B778C;
}

.command-indicator.danger {
  color: #DE350B;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.no-results-icon {
  width: 48px;
  height: 48px;
  color: #DFE1E6;
  margin-bottom: 16px;
}

.no-results-text {
  font-size: 16px;
  font-weight: 500;
  color: #172B4D;
  margin: 0 0 4px 0;
}

.no-results-hint {
  font-size: 14px;
  color: #6B778C;
  margin: 0;
}

/* Footer */
.palette-footer {
  padding: 12px 20px;
  border-top: 1px solid #DFE1E6;
  background: #FAFBFC;
}

.footer-shortcuts {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.shortcut-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6B778C;
}

.shortcut-group kbd {
  background: #FFFFFF;
  border: 1px solid #DFE1E6;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11px;
  color: #172B4D;
  font-family: inherit;
  box-shadow: 0 1px 0 rgba(9, 30, 66, 0.08);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  .command-palette {
    background: #1D2125;
    border-color: #2C333A;
    color: #B3D4FF;
  }

  .palette-header {
    background: #161A1D;
    border-color: #2C333A;
  }

  .palette-title {
    color: #B3D4FF;
  }

  .terminal-badge {
    background: #164B35;
    color: #4BCE97;
    border-color: #22543D;
  }

  .search-input {
    background: #22272B;
    border-color: #2C333A;
    color: #B3D4FF;
  }

  .search-input:focus {
    border-color: #2684FF;
  }

  .category-card:hover,
  .command-item:hover,
  .command-item.active {
    background: #22272B;
  }

  .palette-footer {
    background: #161A1D;
    border-color: #2C333A;
  }
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .command-palette-overlay {
    padding: 20px 12px;
    align-items: flex-end;
  }

  .command-palette {
    max-width: none;
    width: 100%;
    max-height: 85vh;
    border-radius: 12px 12px 0 0;
  }

  .palette-header {
    padding: 16px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .search-section {
    padding: 12px 16px;
  }

  .category-grid {
    gap: 2px;
  }

  .category-card {
    padding: 16px 12px;
  }

  .footer-shortcuts {
    gap: 16px;
  }

  .shortcut-group {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .footer-shortcuts {
    display: none;
  }

  .palette-footer {
    padding: 8px 16px;
  }
}

</style>