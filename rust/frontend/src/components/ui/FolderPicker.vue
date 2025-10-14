<template>
  <div class="folder-picker">
    <div class="picker-header">
      <div class="current-path">
        <FolderIcon />
        <span class="path-text">{{ currentPath }}</span>
      </div>
      <button
        v-if="parentPath"
        @click="navigateUp"
        class="nav-button"
        type="button"
        title="Go to parent directory"
      >
        <ChevronLeftIcon />
        Up
      </button>
    </div>

    <div v-if="loading" class="picker-loading">
      <div class="spinner"></div>
      <span>Browsing directory...</span>
    </div>

    <div v-else-if="error" class="picker-error">
      <ExclamationCircleIcon />
      <div class="error-content">
        <span>{{ error }}</span>
        <button @click="loadDirectory(currentPath)" class="retry-button">Retry</button>
      </div>
    </div>

    <div v-else class="picker-content">
      <div
        v-for="entry in visibleEntries"
        :key="entry.path"
        @click="handleEntryClick(entry)"
        @dblclick="handleEntryDoubleClick(entry)"
        :class="['entry', { selected: selectedPath === entry.path, directory: entry.is_directory }]"
      >
        <FolderIcon v-if="entry.is_directory" />
        <DocumentIcon v-else />
        <span class="entry-name">{{ entry.name }}</span>
      </div>
      <div v-if="visibleEntries.length === 0" class="empty-state">
        <span>No folders in this directory</span>
      </div>
    </div>

    <div class="picker-footer">
      <label class="show-hidden-label">
        <input
          type="checkbox"
          v-model="showHidden"
          @change="handleShowHiddenChange"
        >
        <span>Show hidden folders</span>
      </label>
      <div class="actions">
        <button type="button" @click="handleCancel" class="btn-secondary">Cancel</button>
        <button
          type="button"
          @click="handleSelect"
          :disabled="!selectedPath"
          class="btn-primary"
        >
          Select Folder
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import apiService from '@/services/api'
import { FolderIcon, ChevronLeftIcon, ExclamationCircleIcon, DocumentIcon } from '@heroicons/vue/24/outline'

interface Props {
  initialPath?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialPath: undefined
})

const emit = defineEmits<{
  select: [path: string]
  cancel: []
}>()

const currentPath = ref('')
const parentPath = ref<string | null>(null)
const entries = ref<Array<{ name: string; path: string; is_directory: boolean; is_hidden: boolean }>>([])
const selectedPath = ref<string | null>(null)
const showHidden = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const visibleEntries = computed(() => {
  const filtered = entries.value.filter(entry => {
    if (!entry.is_directory) return false
    if (!showHidden.value && entry.is_hidden) return false
    return true
  })
  console.log('🔍 Visible entries:', filtered.length, 'from', entries.value.length, 'total')
  return filtered
})

const loadDirectory = async (path?: string) => {
  loading.value = true
  error.value = null
  selectedPath.value = null

  try {
    console.log('📁 Loading directory:', path || 'default')
    const response = await apiService.browseDirectory(path)
    console.log('✅ Directory response:', response)

    currentPath.value = response.current_path
    parentPath.value = response.parent_path
    entries.value = response.entries
    console.log('📂 Parsed entries:', entries.value.length, 'items')
  } catch (err) {
    console.error('❌ Failed to load directory:', err)
    error.value = (err as Error).message || 'Failed to load directory'
  } finally {
    loading.value = false
  }
}

const navigateUp = () => {
  if (parentPath.value) {
    loadDirectory(parentPath.value)
  }
}

const handleEntryClick = (entry: { name: string; path: string; is_directory: boolean; is_hidden: boolean }) => {
  if (entry.is_directory) {
    selectedPath.value = entry.path
  }
}

const handleEntryDoubleClick = (entry: { name: string; path: string; is_directory: boolean; is_hidden: boolean }) => {
  if (entry.is_directory) {
    loadDirectory(entry.path)
  }
}

const handleShowHiddenChange = () => {
  // Just triggers re-computation of visibleEntries
}

const handleSelect = () => {
  if (selectedPath.value) {
    emit('select', selectedPath.value)
  }
}

const handleCancel = () => {
  emit('cancel')
}

onMounted(() => {
  loadDirectory(props.initialPath)
})
</script>

<style scoped>
.folder-picker {
  display: flex;
  flex-direction: column;
  height: 500px;
  background: var(--color-bg-primary);
  border-radius: var(--radius-base);
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-primary);
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-primary);
  background: var(--color-bg-secondary);
}

.current-path {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.current-path svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.nav-button svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.picker-error svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.entry svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.7;
}

.path-text {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.nav-button:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.picker-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.entry {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
  user-select: none;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

.entry:hover {
  background: var(--color-bg-secondary);
}

.entry.selected {
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
}

.entry-name {
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
}

.picker-loading,
.picker-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  padding: var(--space-6);
}

.picker-error {
  color: var(--color-semantic-error);
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.retry-button {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-semantic-error-border);
  border-radius: var(--radius-sm);
  background: var(--color-semantic-error-bg);
  color: var(--color-semantic-error);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-base);
}

.retry-button:hover {
  background: var(--color-semantic-error-border);
  color: var(--color-text-inverse);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border-primary);
  border-top-color: var(--color-interactive-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-primary);
  background: var(--color-bg-secondary);
}

.show-hidden-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.show-hidden-label input[type="checkbox"] {
  cursor: pointer;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.btn-secondary,
.btn-primary {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-secondary {
  border: 1px solid var(--color-border-primary);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.btn-secondary:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-hover);
}

.btn-primary {
  border: 1px solid var(--color-interactive-primary);
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
  border-color: var(--color-interactive-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
