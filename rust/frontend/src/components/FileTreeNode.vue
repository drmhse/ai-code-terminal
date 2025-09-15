<template>
  <div class="file-tree-node">
    <div 
      class="node-content"
      :class="{ 
        'is-file': node.type === 'file',
        'is-directory': node.type === 'directory',
        'is-expanded': isExpanded,
        'is-selected': isSelected,
        'is-loading': node.isLoading
      }"
      :style="{ paddingLeft: `${level * 16 + 8}px` }"
      @click="handleClick"
      @dblclick="handleDoubleClick"
    >
      <!-- Directory Toggle Arrow or Loading Spinner -->
      <button 
        v-if="node.type === 'directory'" 
        class="toggle-btn"
        :class="{ expanded: isExpanded }"
        @click.stop="toggleExpanded"
        :disabled="node.isLoading"
      >
        <div v-if="node.isLoading" class="loading-spinner"></div>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9,18 15,12 9,6"></polyline>
        </svg>
      </button>
      <div v-else class="toggle-spacer"></div>

      <!-- File/Directory Icon -->
      <div class="node-icon">
        <svg v-if="node.type === 'directory'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
        </svg>
      </div>

      <!-- File/Directory Name -->
      <span class="node-name">{{ node.name }}</span>

      <!-- File Size (for files only) -->
      <span v-if="node.type === 'file' && node.size" class="file-size">
        {{ formatFileSize(node.size) }}
      </span>
    </div>

    <!-- Children (for expanded directories) -->
    <div v-if="node.type === 'directory' && isExpanded && node.children && !node.isLoading" class="children">
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
import { computed } from 'vue'
import type { FileItem } from '@/stores/file'
import { useFileStore } from '@/stores/file'

const props = defineProps<{
  node: FileItem
  level: number
  selectedPath?: string | undefined
}>()

const emit = defineEmits<{
  select: [node: FileItem]
  toggle: [node: FileItem]
}>()

// Computed property for selected path with proper typing
const selectedPath = computed(() => props.selectedPath ?? undefined)

// Check if this node is selected
const isSelected = computed(() => {
  return selectedPath.value === props.node.path
})

// Use node's expansion state from the store
const isExpanded = computed(() => {
  return props.node.isExpanded || false
})

const handleClick = () => {
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
    // For files, emit a preview event
    emit('select', props.node)
    // Use the file store to show preview
    const fileStore = useFileStore()
    await fileStore.showFilePreview(props.node)
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// File extension utility (kept for future use)
// const getFileExtension = (filename: string): string => {
//   const parts = filename.split('.')
//   return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
// }
</script>

<style scoped>
.file-tree-node {
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
  gap: 6px;
  min-height: 24px;
}

.node-content:hover {
  background: var(--sidebar-item-hover);
  color: var(--sidebar-item-hover-text);
}

.node-content.is-file:hover {
  background: var(--sidebar-item-hover);
  color: var(--sidebar-item-hover-text);
}

.node-content.is-selected {
  background: var(--sidebar-item-active);
  color: var(--sidebar-item-active-text);
  border-left: 2px solid var(--sidebar-item-active-border);
}

.node-content.is-selected .node-icon,
.node-content.is-selected .node-name,
.node-content.is-selected .file-size {
  color: var(--sidebar-item-active-text);
}

.toggle-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s ease;
  border-radius: 2px;
  flex-shrink: 0;
}

.toggle-btn:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.toggle-btn.expanded {
  transform: rotate(90deg);
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border: 1px solid var(--sidebar-border);
  border-top: 1px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.toggle-spacer {
  width: 16px;
  flex-shrink: 0;
}

.node-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.node-content.is-directory .node-icon {
  color: var(--accent-blue);
}

.node-content:hover .node-icon,
.node-content.is-selected .node-icon {
  color: inherit;
}

.node-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.file-size {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
  white-space: nowrap;
  flex-shrink: 0;
}

.children {
  border-left: 1px solid var(--sidebar-border);
  margin-left: 20px;
}

/* File type specific styling */
.node-content.is-file .node-icon {
  color: var(--text-secondary);
}

/* Ensure icons inherit colors in interactive states */
.node-content:hover .node-icon,
.node-content.is-selected .node-icon {
  color: inherit;
}

/* TypeScript/JavaScript files */
.node-name[data-ext="ts"],
.node-name[data-ext="js"],
.node-name[data-ext="tsx"],
.node-name[data-ext="jsx"] {
  color: var(--accent-blue);
}

/* Vue files */
.node-name[data-ext="vue"] {
  color: var(--accent-green);
}

/* CSS files */
.node-name[data-ext="css"],
.node-name[data-ext="scss"],
.node-name[data-ext="sass"] {
  color: var(--accent-purple);
}

/* JSON files */
.node-name[data-ext="json"] {
  color: var(--accent-yellow);
}

/* Markdown files */
.node-name[data-ext="md"],
.node-name[data-ext="markdown"] {
  color: var(--accent-orange);
}
</style>