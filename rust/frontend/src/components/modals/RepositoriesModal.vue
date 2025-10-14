<template>
  <BaseModal
    :show="true"
    title="Create Workspace"
    size="large"
    @close="handleClose"
  >
    <template #header>
      <div class="workspace-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          @click="activeTab = tab.value"
          :class="['tab', { active: activeTab === tab.value }]"
        >
          <component :is="tab.icon" />
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </template>

    <!-- Search (Clone tab only) -->
    <div v-if="activeTab === 'clone'" class="search-container">
      <SearchInput
        v-model="searchTerm"
        placeholder="Search repositories..."
        @input="handleSearch"
        @clear="handleClearSearch"
      />
    </div>

    <!-- Tab Content -->
    <div class="modal-body">
      <!-- Empty Workspace -->
      <EmptyWorkspaceForm
        v-if="activeTab === 'empty'"
        ref="emptyFormRef"
        :loading="emptyLoading"
        :error="emptyError"
        @submit="handleEmptySubmit"
      />

      <!-- Open Folder -->
      <OpenFolderForm
        v-else-if="activeTab === 'open'"
        ref="openFormRef"
        :loading="openLoading"
        :error="openError"
        @submit="handleOpenSubmit"
      />

      <!-- Clone Repository -->
      <RepositoryList
        v-else-if="activeTab === 'clone'"
        :repositories="repositories"
        :loading="repositoriesLoading"
        :error="repositoryError"
        :has-more="repositoryHasMore"
        :loading-more="repositoryLoadingMore"
        :cloning-repository-id="cloningRepository?.id"
        @repository-click="handleRepositoryClick"
        @repository-clone="handleRepositoryClone"
        @load-more="handleLoadMore"
        @retry="handleRetryLoad"
      />
    </div>

    <!-- Clone Progress -->
    <CloneProgress
      v-if="cloneProgress"
      :progress="cloneProgressData"
      :allow-cancel="true"
      @cancel="handleCancelClone"
    />

    <!-- Error Display -->
    <div v-if="cloneError" class="error-banner">
      <ExclamationCircleIcon />
      <span>{{ cloneError }}</span>
    </div>

    <template #footer>
      <button @click="handleClose" class="btn-secondary">
        Cancel
      </button>

      <button
        v-if="activeTab === 'empty'"
        type="submit"
        form="empty-workspace-form"
        class="btn-primary"
        :disabled="!canSubmitEmpty"
      >
        <LoadingSpinner v-if="emptyLoading" size="small" />
        <span v-else>Create Workspace</span>
      </button>

      <button
        v-if="activeTab === 'open'"
        type="submit"
        form="open-folder-form"
        class="btn-primary"
        :disabled="!canSubmitOpen"
      >
        <LoadingSpinner v-if="openLoading" size="small" />
        <span v-else>Open Folder</span>
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUIStore } from '@/stores/ui'
import type { Repository } from '@/stores/workspace'
import {
  FolderPlusIcon,
  FolderOpenIcon,
  ArrowDownTrayIcon,
  ExclamationCircleIcon
} from '@heroicons/vue/24/outline'

import BaseModal from '@/components/ui/BaseModal.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyWorkspaceForm, { type EmptyWorkspaceFormData } from '@/components/forms/EmptyWorkspaceForm.vue'
import OpenFolderForm, { type OpenFolderFormData } from '@/components/forms/OpenFolderForm.vue'
import RepositoryList from '@/components/repository/RepositoryList.vue'
import CloneProgress, { type CloneProgressData } from '@/components/repository/CloneProgress.vue'

const workspaceStore = useWorkspaceStore()
const uiStore = useUIStore()

const {
  repositories,
  repositoriesLoading,
  repositoryError,
  repositoryHasMore,
  repositoryLoadingMore,
  cloningRepository,
  cloneProgress,
  cloneError
} = storeToRefs(workspaceStore)

// State
const activeTab = ref<'empty' | 'open' | 'clone'>('empty')
const searchTerm = ref('')
const emptyLoading = ref(false)
const emptyError = ref<string | null>(null)
const emptyFormRef = ref<InstanceType<typeof EmptyWorkspaceForm>>()
const openLoading = ref(false)
const openError = ref<string | null>(null)
const openFormRef = ref<InstanceType<typeof OpenFolderForm>>()

// Tabs
const tabs = computed(() => [
  { value: 'empty' as const, label: 'Empty Workspace', icon: FolderPlusIcon },
  { value: 'open' as const, label: 'Open Folder', icon: FolderOpenIcon },
  { value: 'clone' as const, label: 'Clone Repository', icon: ArrowDownTrayIcon }
])

// Computed
const canSubmitEmpty = computed(() => !emptyLoading.value && emptyFormRef.value?.isValid)
const canSubmitOpen = computed(() => !openLoading.value && openFormRef.value?.isValid)

const cloneProgressData = computed<CloneProgressData | null>(() => {
  if (!cloneProgress.value?.repository) return null
  return {
    repository: cloneProgress.value.repository,
    progress: cloneProgress.value.progress || 0,
    stage: cloneProgress.value.stage || 'Initializing',
    message: cloneProgress.value.message,
    startTime: cloneProgress.value.startTime || undefined,
    estimatedDuration: cloneProgress.value.estimatedDuration || undefined
  }
})

// Handlers
const handleClose = () => {
  uiStore.closeRepositoriesModal()
}

const handleSearch = () => {
  workspaceStore.searchRepositories(searchTerm.value)
}

const handleClearSearch = () => {
  searchTerm.value = ''
  workspaceStore.searchRepositories('')
}

const handleRepositoryClick = (repository: Repository) => {
  console.log('Repository selected:', repository.full_name)
}

const handleRepositoryClone = async (repository: Repository) => {
  try {
    await workspaceStore.cloneRepository(repository)
  } catch (err) {
    console.error('Failed to clone repository:', err)
  }
}

const handleLoadMore = async () => {
  await workspaceStore.loadMoreRepositories()
}

const handleRetryLoad = async () => {
  await workspaceStore.loadRepositories(1, false)
}

const handleEmptySubmit = async (data: EmptyWorkspaceFormData) => {
  emptyLoading.value = true
  emptyError.value = null

  try {
    await workspaceStore.createEmptyWorkspace({
      name: data.name,
      description: data.description || undefined,
      path: data.path || undefined
    })
    emptyFormRef.value?.resetForm()
    handleClose()
  } catch (err) {
    emptyError.value = err instanceof Error ? err.message : 'Failed to create workspace'
  } finally {
    emptyLoading.value = false
  }
}

const handleOpenSubmit = async (data: OpenFolderFormData) => {
  openLoading.value = true
  openError.value = null

  try {
    await workspaceStore.openFolder({
      name: data.name,
      path: data.path
    })
    openFormRef.value?.resetForm()
    handleClose()
  } catch (err) {
    openError.value = err instanceof Error ? err.message : 'Failed to open folder'
  } finally {
    openLoading.value = false
  }
}

const handleCancelClone = () => {
  console.log('Clone cancellation requested')
}

onMounted(async () => {
  nextTick(() => {
    // Any initialization
  })
})
</script>

<style scoped>
/* Tabs */
.workspace-tabs {
  display: flex;
  gap: var(--space-2);
  padding: 0 var(--space-6);
  margin-bottom: var(--space-4);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-base);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}

.tab svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.tab:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.tab.active {
  background: var(--color-interactive-primary);
  color: white;
}

/* Search */
.search-container {
  padding: 0 var(--space-6) var(--space-4);
  border-bottom: 1px solid var(--color-border-primary);
}

/* Body */
.modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  background: var(--color-semantic-error-bg);
  border: 1px solid var(--color-semantic-error-border);
  border-radius: var(--radius-base);
  color: var(--color-semantic-error);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin: 0 var(--space-6) var(--space-4);
}

.error-banner svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Buttons */
.btn-secondary,
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  border: 1px solid transparent;
  min-height: 40px;
}

.btn-secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border-color: var(--color-border-primary);
}

.btn-secondary:hover {
  background: var(--color-bg-quaternary);
  border-color: var(--color-border-hover);
}

.btn-primary {
  background: var(--color-interactive-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
  .workspace-tabs {
    padding: 0 var(--space-4);
    flex-wrap: wrap;
  }

  .search-container {
    padding: 0 var(--space-4) var(--space-3);
  }

  .error-banner {
    margin: 0 var(--space-4) var(--space-3);
  }
}
</style>
