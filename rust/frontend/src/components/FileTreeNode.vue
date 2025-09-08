<template>
  <div class="file-tree-node">
    <div 
      class="node-content"
      :class="{ 
        'is-file': node.type === 'file',
        'is-directory': node.type === 'directory',
        'is-expanded': isExpanded
      }"
      :style="{ paddingLeft: `${level * 16 + 8}px` }"
      @click="handleClick"
    >
      <!-- Directory Toggle Arrow -->
      <button 
        v-if="node.type === 'directory'" 
        class="toggle-btn"
        :class="{ expanded: isExpanded }"
        @click.stop="toggleExpanded"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    <div v-if="node.type === 'directory' && isExpanded && node.children" class="children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :level="level + 1"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FileNode } from '../types/editor'

const props = defineProps<{
  node: FileNode
  level: number
}>()

const emit = defineEmits<{
  select: [node: FileNode]
  toggle: [node: FileNode]
}>()

const isExpanded = ref(false)

const handleClick = () => {
  if (props.node.type === 'directory') {
    toggleExpanded()
  } else {
    emit('select', props.node)
  }
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
  emit('toggle', props.node)
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
  background: var(--sidebar-item-hover-bg);
}

.node-content.is-file:hover {
  background: var(--sidebar-item-hover-bg);
}

.node-content.is-directory.is-expanded {
  background: var(--sidebar-item-active-bg);
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
  border-left: 1px solid var(--border-color);
  margin-left: 20px;
}

/* File type specific styling */
.node-content.is-file .node-icon {
  color: var(--text-secondary);
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