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
      @contextmenu="(event) => handleFileContextMenu(event, node)"
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
        <ChevronRightIcon v-else class="icon-sm" />
      </button>
      <div v-else class="toggle-spacer"></div>

      <!-- File/Directory Icon -->
      <div class="node-icon" :class="getFileTypeClass(node)">
        <FolderIcon v-if="node.type === 'directory'" class="icon-xs" />
        <DocumentIcon v-else class="icon-xs" />
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
import { useFileOperations } from '@/composables/useFileOperations'
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

// Use file operations for context menu
const { handleFileContextMenu } = useFileOperations()

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
    // For files, open in the docked editor
    emit('select', props.node)
    // Use the file store to open in editor
    const fileStore = useFileStore()
    await fileStore.openFileInEditor(props.node)
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

const getFileTypeClass = (node: FileItem): string => {
  if (node.type === 'directory') {
    return 'icon-directory'
  }

  const ext = getFileExtension(node.name)

  // Map file extensions to icon types
  const typeMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'icon-javascript',
    'ts': 'icon-typescript',
    'jsx': 'icon-react',
    'tsx': 'icon-react',
    'mjs': 'icon-javascript',

    // Vue
    'vue': 'icon-vue',

    // Styles
    'css': 'icon-css',
    'scss': 'icon-sass',
    'sass': 'icon-sass',
    'less': 'icon-less',

    // Data/Config
    'json': 'icon-json',
    'yaml': 'icon-yaml',
    'yml': 'icon-yaml',
    'toml': 'icon-config',
    'xml': 'icon-xml',

    // Documentation
    'md': 'icon-markdown',
    'markdown': 'icon-markdown',
    'txt': 'icon-text',
    'rst': 'icon-text',

    // Images
    'png': 'icon-image',
    'jpg': 'icon-image',
    'jpeg': 'icon-image',
    'gif': 'icon-image',
    'svg': 'icon-image',
    'webp': 'icon-image',

    // Other languages
    'py': 'icon-python',
    'rs': 'icon-rust',
    'go': 'icon-go',
    'java': 'icon-java',
    'php': 'icon-php',
    'rb': 'icon-ruby',
    'sh': 'icon-shell',
    'bash': 'icon-shell',
    'zsh': 'icon-shell',

    // Build/Config files
    'dockerfile': 'icon-docker',
    'gitignore': 'icon-git',
    'env': 'icon-config',
    'lock': 'icon-lock'
  }

  return typeMap[ext] || 'icon-file'
}
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
  color: var(--text-primary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  min-height: 16px;
  opacity: 1;
  transition: opacity 0.15s ease;
}

.node-content:hover .node-icon,
.node-content.is-selected .node-icon {
  opacity: 1;
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

/* File type specific styling respecting theme */
.icon-directory {
  color: var(--accent-blue);
}

.icon-javascript,
.icon-typescript,
.icon-react {
  color: var(--accent-blue);
}

.icon-vue {
  color: var(--accent-green);
}

.icon-css,
.icon-sass,
.icon-less {
  color: var(--accent-purple);
}

.icon-json,
.icon-yaml,
.icon-config {
  color: var(--accent-yellow);
}

.icon-xml,
.icon-markdown {
  color: var(--accent-orange);
}

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
  color: var(--text-secondary);
}
</style>
