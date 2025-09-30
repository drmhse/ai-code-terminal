<template>
  <div class="task-list-sidebar">
    <!-- Header -->
    <div class="sidebar-header">
      <h2 class="sidebar-title">Lists</h2>
      <button
        @click="showCreateModal = true"
        class="btn-icon"
        title="Create new list"
      >
        <PlusIcon />
      </button>
    </div>

    <!-- Search -->
    <div class="search-container">
      <div class="search-wrapper">
        <MagnifyingGlassIcon class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search lists..."
          class="search-input"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <span class="loading-text">Loading lists...</span>
    </div>

    <!-- Lists -->
    <div v-else class="lists-container">
      <!-- Default lists section -->
      <div v-if="defaultLists.length > 0" class="list-section">
        <h3 class="section-title">MY LISTS</h3>
        <div class="list-items">
          <button
            v-for="list in defaultLists"
            :key="list.id"
            @click="$emit('select-list', list.id)"
            @contextmenu.prevent="showContextMenu(list, $event)"
            class="list-item"
            :class="{ active: list.id === selectedListId }"
          >
            <div class="list-icon">
              <ListBulletIcon v-if="list.wellknownListName === 'defaultList'" />
              <ClipboardDocumentCheckIcon v-else />
            </div>
            <span class="list-name">{{ list.displayName }}</span>
            <span v-if="list.wellknownListName === 'defaultList'" class="list-badge">
              Default
            </span>
          </button>
        </div>
      </div>

      <!-- Custom lists section -->
      <div v-if="customLists.length > 0" class="list-section">
        <h3 class="section-title">WORKSPACES</h3>
        <div class="list-items">
          <button
            v-for="list in customLists"
            :key="list.id"
            @click="$emit('select-list', list.id)"
            @contextmenu.prevent="showContextMenu(list, $event)"
            class="list-item"
            :class="{ active: list.id === selectedListId }"
          >
            <div class="list-icon">
              <FolderIcon />
            </div>
            <span class="list-name">{{ list.displayName }}</span>
            <span v-if="list.isShared" class="list-badge shared">
              Shared
            </span>
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="filteredLists.length === 0" class="empty-lists">
        <p class="empty-text">
          {{ searchQuery ? 'No lists found' : 'No lists yet' }}
        </p>
        <button
          v-if="!searchQuery"
          @click="showCreateModal = true"
          class="btn-primary btn-sm"
        >
          <PlusIcon />
          Create List
        </button>
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible && contextMenu.list"
        ref="contextMenuRef"
        class="context-menu"
        :style="{
          top: `${contextMenu.y}px`,
          left: `${contextMenu.x}px`
        }"
        @click="closeContextMenu"
      >
        <button
          @click="handleRename(contextMenu.list!)"
          class="context-menu-item"
        >
          <PencilIcon />
          Rename
        </button>
        <button
          v-if="!contextMenu.list.wellknownListName"
          @click="handleDelete(contextMenu.list!)"
          class="context-menu-item danger"
        >
          <TrashIcon />
          Delete
        </button>
      </div>
    </Teleport>

    <!-- Create List Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Create New List</h3>
            <button @click="showCreateModal = false" class="btn-icon">
              <XMarkIcon />
            </button>
          </div>
          <div class="modal-body">
            <label class="input-label">List Name</label>
            <input
              v-model="newListName"
              ref="createInputRef"
              type="text"
              placeholder="Enter list name..."
              class="text-input"
              @keyup.enter="handleCreate"
              @keyup.escape="showCreateModal = false"
            />
          </div>
          <div class="modal-footer">
            <button @click="showCreateModal = false" class="btn-secondary">
              Cancel
            </button>
            <button
              @click="handleCreate"
              :disabled="!newListName.trim()"
              class="btn-primary"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Rename List Modal -->
    <Teleport to="body">
      <div v-if="showRenameModal && renameList" class="modal-overlay" @click.self="showRenameModal = false">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Rename List</h3>
            <button @click="showRenameModal = false" class="btn-icon">
              <XMarkIcon />
            </button>
          </div>
          <div class="modal-body">
            <label class="input-label">List Name</label>
            <input
              v-model="renameListName"
              ref="renameInputRef"
              type="text"
              placeholder="Enter new name..."
              class="text-input"
              @keyup.enter="handleRenameConfirm"
              @keyup.escape="showRenameModal = false"
            />
          </div>
          <div class="modal-footer">
            <button @click="showRenameModal = false" class="btn-secondary">
              Cancel
            </button>
            <button
              @click="handleRenameConfirm"
              :disabled="!renameListName.trim()"
              class="btn-primary"
            >
              Rename
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { TaskList } from '@/services/microsoft-auth'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ListBulletIcon,
  ClipboardDocumentCheckIcon,
  FolderIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

interface Props {
  lists: TaskList[]
  selectedListId: string | null
  loading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'select-list': [listId: string]
  'create-list': [name: string]
  'rename-list': [listId: string, newName: string]
  'delete-list': [listId: string]
}>()

// Local state
const searchQuery = ref('')
const showCreateModal = ref(false)
const showRenameModal = ref(false)
const newListName = ref('')
const renameList = ref<TaskList | null>(null)
const renameListName = ref('')
const createInputRef = ref<HTMLInputElement>()
const renameInputRef = ref<HTMLInputElement>()
const contextMenuRef = ref<HTMLDivElement>()
const contextMenu = ref<{
  visible: boolean
  x: number
  y: number
  list: TaskList | null
}>({
  visible: false,
  x: 0,
  y: 0,
  list: null
})

// Computed
const filteredLists = computed(() => {
  // Filter out any lists without displayName
  const validLists = props.lists.filter(list => list.displayName)

  if (!searchQuery.value.trim()) return validLists

  const query = searchQuery.value.toLowerCase()
  return validLists.filter(list =>
    list.displayName.toLowerCase().includes(query)
  )
})

const defaultLists = computed(() => {
  return filteredLists.value.filter(list =>
    list.wellknownListName || (list.displayName && list.displayName.toLowerCase() === 'tasks')
  )
})

const customLists = computed(() => {
  return filteredLists.value.filter(list =>
    !list.wellknownListName && (!list.displayName || list.displayName.toLowerCase() !== 'tasks')
  )
})

// Methods
const showContextMenu = (list: TaskList, event: MouseEvent) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    list
  }
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
  contextMenu.value.list = null
}

const handleCreate = () => {
  if (!newListName.value.trim()) return

  emit('create-list', newListName.value.trim())
  newListName.value = ''
  showCreateModal.value = false
}

const handleRename = (list: TaskList) => {
  renameList.value = list
  renameListName.value = list.displayName
  showRenameModal.value = true
  closeContextMenu()
}

const handleRenameConfirm = () => {
  if (!renameList.value || !renameListName.value.trim()) return

  emit('rename-list', renameList.value.id, renameListName.value.trim())
  renameList.value = null
  renameListName.value = ''
  showRenameModal.value = false
}

const handleDelete = (list: TaskList) => {
  if (!confirm(`Delete "${list.displayName}"? This action cannot be undone.`)) return

  emit('delete-list', list.id)
  closeContextMenu()
}

// Auto-focus inputs
watch(showCreateModal, async (value) => {
  if (value) {
    await nextTick()
    createInputRef.value?.focus()
  }
})

watch(showRenameModal, async (value) => {
  if (value) {
    await nextTick()
    renameInputRef.value?.focus()
  }
})

// Click outside to close context menu
const handleClickOutside = (event: MouseEvent) => {
  if (contextMenu.value.visible && contextMenuRef.value) {
    if (!contextMenuRef.value.contains(event.target as Node)) {
      closeContextMenu()
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.task-list-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border-primary);
}

/* Header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4);
  border-bottom: 1px solid var(--color-border-primary);
  flex-shrink: 0;
}

.sidebar-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-icon svg {
  width: 20px;
  height: 20px;
}

.btn-icon:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* Search */
.search-container {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border-primary);
  flex-shrink: 0;
}

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-8);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(56, 139, 255, 0.1);
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

/* Loading */
.loading-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border-primary);
  border-top-color: var(--color-interactive-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Lists */
.lists-container {
  flex: 1;
  min-height: 0; /* Critical for flex child to scroll properly */
  overflow-y: auto;
  padding: var(--space-2) 0;
}

.list-section {
  margin-bottom: var(--space-4);
}

.section-title {
  padding: var(--space-3) var(--space-4) var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.list-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-base);
  position: relative;
}

.list-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-interactive-primary);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.list-item:hover {
  background: var(--color-bg-tertiary);
}

.list-item.active {
  background: rgba(56, 139, 255, 0.08);
  font-weight: var(--font-weight-medium);
}

.list-item.active::before {
  opacity: 1;
}

.list-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
}

.list-item.active .list-icon {
  color: var(--color-interactive-primary);
}

.list-icon svg {
  width: 18px;
  height: 18px;
}

.list-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-badge {
  flex-shrink: 0;
  padding: 2px var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-semantic-info);
  background: var(--color-semantic-info-bg);
  border-radius: var(--radius-sm);
}

.list-badge.shared {
  color: var(--color-semantic-warning);
  background: var(--color-semantic-warning-bg);
}

/* Empty */
.empty-lists {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: white;
  background: var(--color-interactive-primary);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary svg {
  width: 16px;
  height: 16px;
}

.btn-sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
}

/* Context Menu */
.context-menu {
  position: fixed;
  z-index: var(--z-popover);
  min-width: 180px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--space-1);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.context-menu-item svg {
  width: 16px;
  height: 16px;
}

.context-menu-item:hover {
  background: var(--color-bg-tertiary);
}

.context-menu-item.danger {
  color: var(--color-semantic-error);
}

.context-menu-item.danger:hover {
  background: var(--color-semantic-error-bg);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  padding: var(--space-4);
}

.modal {
  width: 100%;
  max-width: 480px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-primary);
}

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.modal-body {
  padding: var(--space-6);
}

.input-label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.text-input {
  width: 100%;
  padding: var(--space-3) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: var(--color-input-background);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.text-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  background: var(--color-input-background-focus);
  box-shadow: 0 0 0 3px rgba(56, 139, 255, 0.1);
}

.text-input::placeholder {
  color: var(--color-text-tertiary);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--color-border-primary);
}

.btn-secondary {
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-interactive-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-secondary:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}
</style>