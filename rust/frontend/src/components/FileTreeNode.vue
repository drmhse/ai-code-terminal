<template>
  <div class="file-tree-node">
    <div
      class="node-content"
      :class="{
        'is-file': node.type === 'file',
        'is-directory': node.type === 'directory',
        'is-expanded': isExpanded,
        'is-selected': isSelected || isMultiSelected,
        'is-loading': node.isLoading,
        'is-drag-over': isDragOver,
        'is-cut': isCut
      }"
      :style="{ paddingLeft: `${level * 12 + 12}px` }"
      :draggable="true"
      tabindex="0"
      role="treeitem"
      :aria-selected="isSelected || isMultiSelected"
      :aria-expanded="node.type === 'directory' ? isExpanded : undefined"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      @contextmenu="(event) => handleFileContextMenu(event, node)"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @keydown="handleKeyDown"
    >
      <!-- Directory Toggle Arrow or Loading Spinner -->
      <button
        v-if="node.type === 'directory'"
        class="toggle-btn"
        :class="{ 'is-expanded': isExpanded }"
        :aria-label="isExpanded ? 'Collapse folder' : 'Expand folder'"
        @click.stop="toggleExpanded"
        :disabled="node.isLoading"
      >
        <div v-if="node.isLoading" class="loading-spinner"></div>
        <ChevronRightIcon v-else class="chevron-icon" />
      </button>
      <div v-else class="toggle-spacer"></div>

      <!-- File/Directory Icon -->
      <div class="node-icon" :class="fileTypeClass">
        <FolderIcon v-if="node.type === 'directory'" class="icon" />
        <DocumentIcon v-else class="icon" />
      </div>

      <!-- File/Directory Name -->
      <span class="node-name" :title="node.name">{{ node.name }}</span>
    </div>

    <!-- Children (for expanded directories) -->
    <div
      v-if="node.type === 'directory' && isExpanded && node.children && !node.isLoading"
      class="children"
      role="group"
    >
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :level="level + 1"
        :selected-path="selectedPath"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FileItem } from '@/stores/file'
import { useFileStore } from '@/stores/file'
import { useFileOperations } from '@/composables/useFileOperations'
import { getFileTypeClass } from '@/composables/useFileTree'
import { ChevronRightIcon, FolderIcon, DocumentIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  node: FileItem
  level: number
  selectedPath?: string | undefined
}>()

const emit = defineEmits<{
  select: [node: FileItem]
  toggle: [node: FileItem]
}>()

const fileStore = useFileStore()

// Use file operations for context menu
const { handleFileContextMenu } = useFileOperations()

// Drag and drop state
const isDragOver = ref(false)
const dragCounter = ref(0)

// Computed property for selected path with proper typing
const selectedPath = computed(() => props.selectedPath ?? undefined)

// Check if this node is selected (single selection)
const isSelected = computed(() => {
  return selectedPath.value === props.node.path
})

// Check if this node is multi-selected
const isMultiSelected = computed(() => {
  return fileStore.selectedFiles.has(props.node.path)
})

// Check if this node is cut (in clipboard with cut operation)
const isCut = computed(() => {
  return fileStore.clipboardOperation === 'cut' && fileStore.clipboardFiles.includes(props.node.path)
})

// Use node's expansion state from the store
const isExpanded = computed(() => {
  return props.node.isExpanded || false
})

const handleClick = (event: MouseEvent) => {
  // Handle multi-select with Ctrl/Cmd and Shift
  fileStore.toggleFileSelection(props.node, event)

  // Always emit select for both files and directories (VS Code behavior)
  emit('select', props.node)
}

const toggleExpanded = () => {
  emit('toggle', props.node)
}

const handleDoubleClick = async () => {
  if (props.node.type === 'directory') {
    toggleExpanded()
  } else {
    // For files, open in the docked editor
    emit('select', props.node)
    // Use the file store to open in editor
    const fileStore = useFileStore()
    await fileStore.openFileInEditor(props.node)
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  // Handle keyboard navigation
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (props.node.type === 'directory') {
      toggleExpanded()
    } else {
      handleDoubleClick()
    }
  } else if (event.key === 'ArrowRight' && props.node.type === 'directory' && !isExpanded.value) {
    event.preventDefault()
    toggleExpanded()
  } else if (event.key === 'ArrowLeft' && props.node.type === 'directory' && isExpanded.value) {
    event.preventDefault()
    toggleExpanded()
  }
}

// Compute file type class for styling
const fileTypeClass = computed(() => getFileTypeClass(props.node.name, props.node.type === 'directory'))

// Drag and drop handlers
const handleDragStart = (event: DragEvent) => {
  if (!event.dataTransfer) return

  // If this file is not in the selection, select it
  if (!fileStore.selectedFiles.has(props.node.path)) {
    fileStore.clearFileSelection()
    fileStore.toggleFileSelection(props.node)
  }

  // Set drag data
  const selectedPaths = Array.from(fileStore.selectedFiles)
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', JSON.stringify(selectedPaths))

  // Add a visual indicator
  event.dataTransfer.setDragImage(event.currentTarget as Element, 0, 0)
}

const handleDragEnd = () => {
  isDragOver.value = false
  dragCounter.value = 0
}

const handleDragOver = (event: DragEvent) => {
  // Only allow drop on directories
  if (props.node.type !== 'directory') return

  event.preventDefault()
  if (!event.dataTransfer) return

  event.dataTransfer.dropEffect = 'move'
}

const handleDragEnter = (event: DragEvent) => {
  if (props.node.type !== 'directory') return

  event.preventDefault()
  dragCounter.value++
  isDragOver.value = true
}

const handleDragLeave = () => {
  dragCounter.value--
  if (dragCounter.value === 0) {
    isDragOver.value = false
  }
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
  dragCounter.value = 0

  if (props.node.type !== 'directory') return
  if (!event.dataTransfer) return

  try {
    const data = event.dataTransfer.getData('text/plain')
    const filePaths: string[] = JSON.parse(data)

    // Don't allow dropping a file into itself or its parent
    const targetPath = props.node.path
    const isInvalidDrop = filePaths.some(path => {
      return path === targetPath || targetPath.startsWith(path + '/')
    })

    if (isInvalidDrop) {
      console.warn('Cannot move a file into itself or its children')
      return
    }

    // Move the files
    await fileStore.moveFiles(filePaths, props.node)
  } catch (err) {
    console.error('Failed to handle file drop:', err)
  }
}
</script>

<style scoped>
/* ===================================
   FILE TREE NODE - VS CODE/ZED INSPIRED
   =================================== */

.file-tree-node {
  user-select: none;
}

/* Node Content Container */
.node-content {
  display: flex;
  align-items: center;
  padding: 0 var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast), color var(--transition-fast);
  gap: var(--space-1);
  min-height: 22px;
  position: relative;
}

/* Hover State - Subtle but clear */
.node-content:hover {
  background: var(--color-sidebar-item-hover);
}

/* Selected State - Full highlight like VS Code */
.node-content.is-selected {
  background: var(--color-sidebar-item-active);
  color: var(--color-sidebar-item-active-text);
}

.node-content.is-selected .node-icon,
.node-content.is-selected .node-name {
  color: var(--color-sidebar-item-active-text);
}

/* Focus State - Keyboard navigation */
.node-content:focus {
  outline: 1px solid var(--color-border-focus);
  outline-offset: -1px;
}

.node-content:focus:not(:focus-visible) {
  outline: none;
}

/* Drag Over State - Clean visual feedback */
.node-content.is-drag-over {
  background: var(--color-interactive-primary);
  opacity: 0.2;
}

.node-content.is-drag-over::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--color-interactive-primary);
  border-radius: var(--radius-sm);
  pointer-events: none;
}

/* Cut State - Dimmed appearance */
.node-content.is-cut {
  opacity: 0.4;
}

/* Toggle Button */
.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  width: 16px;
  height: 16px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: transform var(--transition-fast), color var(--transition-fast);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.toggle-btn:hover {
  color: var(--color-text-primary);
}

.toggle-btn.is-expanded {
  transform: rotate(90deg);
}

.toggle-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.chevron-icon {
  width: 14px;
  height: 14px;
}

/* Loading Spinner */
.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top: 2px solid var(--color-interactive-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Toggle Spacer */
.toggle-spacer {
  width: 16px;
  flex-shrink: 0;
}

/* Node Icon */
.node-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary);
}

.node-icon .icon {
  width: 16px;
  height: 16px;
}

/* Selected node icons should match text color */
.node-content.is-selected .node-icon {
  color: var(--color-sidebar-item-active-text);
}

/* Node Name */
.node-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  font-weight: var(--font-weight-normal);
}

.node-content.is-selected .node-name {
  font-weight: var(--font-weight-medium);
}

/* Children Container - Clean nesting */
.children {
  /* No visual borders - just indentation like VS Code */
}

/* ===================================
   FILE TYPE ICON COLORS
   Using semantic colors from theme
   =================================== */

/* Directories - Blue accent */
.icon-directory {
  color: var(--color-interactive-primary);
}

/* JavaScript/TypeScript - Blue */
.icon-javascript,
.icon-typescript,
.icon-react {
  color: var(--color-interactive-primary);
}

/* Vue - Green */
.icon-vue {
  color: var(--color-semantic-success);
}

/* Styles - Purple (using link visited color as proxy) */
.icon-css,
.icon-sass,
.icon-less {
  color: var(--color-interactive-link-visited);
}

/* Config/Data - Warning color */
.icon-json,
.icon-yaml,
.icon-config {
  color: var(--color-semantic-warning);
}

/* Markup - Secondary text */
.icon-xml,
.icon-markdown {
  color: var(--color-text-secondary);
}

/* Default files - Muted */
.icon-text,
.icon-image,
.icon-python,
.icon-rust,
.icon-go,
.icon-java,
.icon-php,
.icon-ruby,
.icon-shell,
.icon-docker,
.icon-git,
.icon-lock,
.icon-file {
  color: var(--color-text-tertiary);
}
</style>
