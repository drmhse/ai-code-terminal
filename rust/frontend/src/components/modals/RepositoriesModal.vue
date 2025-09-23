<template>
  <BaseModal
    :show="true"
    title="Create Workspace"
    @close="closeModal"
  >
    <!-- Tab Selection -->
    <template #header>
      <TabSelector
        v-model="activeTab"
        :tabs="workspaceTabs"
      />
    </template>

    <!-- Search Input (Clone Tab Only) -->
    <div v-if="activeTab === 'clone'" class="search-section">
      <SearchInput
        v-model="searchTerm"
        placeholder="Search repositories..."
        @input="handleSearch"
        @clear="handleClearSearch"
      />
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Empty Workspace Tab -->
      <EmptyWorkspaceForm
        v-if="activeTab === 'empty'"
        ref="emptyFormRef"
        :loading="creatingEmptyWorkspace"
        :error="emptyWorkspaceError"
        @submit="handleEmptyWorkspaceSubmit"
      />

      <!-- Clone Repository Tab -->
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
      :progress="cloneProgressData"
      :allow-cancel="true"
      @cancel="handleCancelClone"
    />

    <!-- Clone Error -->
    <div v-if="cloneError" class="clone-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>{{ cloneError }}</span>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <button @click="closeModal" class="btn btn-secondary">
        Cancel
      </button>

      <button
        v-if="activeTab === 'empty'"
        type="submit"
        form="empty-workspace-form"
        class="btn btn-primary"
        :disabled="!canCreateWorkspace"
      >
        <LoadingSpinner v-if="creatingEmptyWorkspace" size="small" />
        <span v-else>Create Workspace</span>
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

// Component imports
import BaseModal from '@/components/ui/BaseModal.vue'
import TabSelector, { type Tab } from '@/components/ui/TabSelector.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyWorkspaceForm, { type EmptyWorkspaceFormData } from '@/components/forms/EmptyWorkspaceForm.vue'
import RepositoryList from '@/components/repository/RepositoryList.vue'
import CloneProgress, { type CloneProgressData } from '@/components/repository/CloneProgress.vue'

// Store integration
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

// Local state
const activeTab = ref<'empty' | 'clone'>('empty')
const searchTerm = ref('')
const creatingEmptyWorkspace = ref(false)
const emptyWorkspaceError = ref<string | null>(null)
const emptyFormRef = ref<InstanceType<typeof EmptyWorkspaceForm>>()

// Tab configuration
const workspaceTabs = computed<Tab[]>(() => [
  {
    value: 'empty',
    label: 'Empty Workspace',
    iconSvg: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>'
  },
  {
    value: 'clone',
    label: 'Clone Repository',
    iconSvg: '<path d="M15 14c-2.5-1-3.7-3-3.7-3-.8 1.5-3.3 3-3.3 3h7zm-7.5 2c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5h-5zm10 0c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5h-5z"></path>'
  }
])

// Computed properties
const canCreateWorkspace = computed(() => {
  return !creatingEmptyWorkspace.value && emptyFormRef.value?.isValid
})

const cloneProgressData = computed<CloneProgressData | null>(() => {
  if (!cloneProgress.value?.repository) {
    return null
  }

  return {
    repository: cloneProgress.value.repository,
    progress: cloneProgress.value.progress || 0,
    stage: cloneProgress.value.stage || 'Initializing',
    message: cloneProgress.value.message,
    startTime: cloneProgress.value.startTime,
    estimatedDuration: cloneProgress.value.estimatedDuration
  }
})

// Event handlers
const closeModal = () => {
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


const handleEmptyWorkspaceSubmit = async (data: EmptyWorkspaceFormData) => {
  creatingEmptyWorkspace.value = true
  emptyWorkspaceError.value = null

  try {
    await workspaceStore.createEmptyWorkspace({
      name: data.name,
      description: data.description || undefined,
      path: data.path || undefined
    })

    // Reset form and close modal on success
    emptyFormRef.value?.resetForm()
    closeModal()
  } catch (err) {
    emptyWorkspaceError.value = err instanceof Error ? err.message : 'Failed to create workspace'
    console.error('Failed to create empty workspace:', err)
  } finally {
    creatingEmptyWorkspace.value = false
  }
}

const handleCancelClone = () => {
  // Implement clone cancellation if supported by the store
  console.log('Clone cancellation requested')
}

// Lifecycle
onMounted(async () => {
  // Setup initial data loading if needed
  nextTick(() => {
    // Any initialization that needs to happen after component mount
  })
})
</script>

<style scoped>
.search-section {
  padding: 0 var(--space-3xl, 32px) var(--space-2xl, 24px);
  border-bottom: 1px solid var(--border-color);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.clone-error {
  display: flex;
  align-items: center;
  gap: var(--space-md, 12px);
  padding: var(--space-lg, 16px) var(--space-3xl, 32px);
  background: var(--error);
  color: white;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: var(--space-md, 12px) var(--space-xl, 20px);
  border-radius: var(--radius-lg, 12px);
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: var(--space-sm, 8px);
  min-height: 44px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  justify-content: center;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Responsive Design */
@media (max-width: 768px) {
  .search-section {
    padding: 0 var(--space-2xl, 24px) var(--space-xl, 20px);
  }
}

@media (max-width: 480px) {
  .search-section {
    padding: 0 var(--space-lg, 16px) var(--space-lg, 16px);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .btn {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none !important;
  }
}
</style>