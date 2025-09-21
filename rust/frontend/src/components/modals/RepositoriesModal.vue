<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Create Workspace</h3>
        <button @click="closeModal" class="close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Workspace Type Selection -->
      <div class="workspace-tabs">
        <button
          @click="activeTab = 'empty'"
          class="tab-button"
          :class="{ active: activeTab === 'empty' }"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          Empty Workspace
        </button>
        <button
          @click="activeTab = 'clone'"
          class="tab-button"
          :class="{ active: activeTab === 'clone' }"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 14c-2.5-1-3.7-3-3.7-3-.8 1.5-3.3 3-3.3 3h7zm-7.5 2c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5h-5zm10 0c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5h-5z"></path>
          </svg>
          Clone Repository
        </button>
      </div>
      
      <!-- Search Bar (Clone Tab Only) -->
      <div v-if="activeTab === 'clone'" class="search-section">
        <div class="search-input-container">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            v-model="searchTerm"
            @input="handleSearch"
            type="text"
            placeholder="Search repositories..."
            class="search-input"
          >
          <button v-if="searchTerm" @click="clearSearch" class="search-clear">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="modal-body">
        <!-- Empty Workspace Tab -->
        <div v-if="activeTab === 'empty'" class="empty-workspace-form">
          <div class="form-section">
            <label for="workspace-name" class="form-label">Workspace Name</label>
            <input
              id="workspace-name"
              v-model="emptyWorkspaceForm.name"
              type="text"
              placeholder="Enter workspace name..."
              class="form-input"
              :class="{ 'error': emptyWorkspaceError && !emptyWorkspaceForm.name }"
            >
            <p v-if="emptyWorkspaceError && !emptyWorkspaceForm.name" class="form-error">
              Workspace name is required
            </p>
          </div>

          <div class="form-section">
            <label for="workspace-description" class="form-label">Description</label>
            <textarea
              id="workspace-description"
              v-model="emptyWorkspaceForm.description"
              placeholder="Enter workspace description (optional)..."
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-section">
            <label for="workspace-path" class="form-label">Location</label>
            <input
              id="workspace-path"
              v-model="emptyWorkspaceForm.path"
              type="text"
              placeholder="Leave empty for default location..."
              class="form-input"
            >
            <p class="form-hint">
              Leave empty to create workspace in the default location
            </p>
          </div>

          <div v-if="creatingEmptyWorkspace" class="creating-state">
            <div class="loading-spinner"></div>
            <p>Creating workspace...</p>
          </div>

          <div v-if="emptyWorkspaceError" class="error-message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {{ emptyWorkspaceError }}
          </div>
        </div>

        <!-- Clone Repository Tab -->
        <div v-else-if="activeTab === 'clone'">
          <!-- Loading State -->
          <div v-if="repositoriesLoading" class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading repositories...</p>
          </div>
        
        <!-- Error State -->
        <div v-else-if="repositoryError" class="error-state">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>{{ repositoryError }}</p>
          <button @click="loadRepositories" class="retry-btn">Retry</button>
        </div>
        
        <!-- Empty State -->
        <div v-else-if="repositories.length === 0" class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>No repositories found</p>
        </div>
        
        <!-- Repository List -->
        <div v-else class="repository-list" ref="repositoryListRef">
          <div 
            v-for="repository in repositories" 
            :key="repository?.id || Math.random()"
            class="repository-item"
            :class="{ 
              'is-cloning': cloningRepository?.id === repository.id,
              'is-private': repository.private,
              'is-fork': repository.fork,
              'is-archived': repository.archived
            }"
            @click="!repository.archived && !repository.disabled ? selectRepository(repository) : null"
          >
            <!-- Repository Info -->
            <div class="repository-header">
              <div class="repository-name-section">
                <svg 
                  :width="16" 
                  :height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2"
                  class="repo-icon"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                
                <div class="repository-name">{{ repository.name }}</div>
                
                <!-- Repository badges -->
                <div class="repository-badges">
                  <span v-if="repository.private" class="badge private">Private</span>
                  <span v-if="repository.fork" class="badge fork">Fork</span>
                  <span v-if="repository.archived" class="badge archived">Archived</span>
                </div>
              </div>
              
              <!-- Clone button or progress -->
              <div class="repository-actions">
                <div v-if="cloningRepository?.id === repository.id" class="clone-progress">
                  <div class="progress-spinner"></div>
                  <span class="progress-text">Cloning...</span>
                </div>
                <button 
                  v-else-if="!repository.archived && !repository.disabled"
                  @click.stop="cloneRepository(repository)" 
                  class="clone-btn"
                  :disabled="!!cloningRepository"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7,10 12,15 17,10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Clone
                </button>
              </div>
            </div>
            
            <!-- Repository description -->
            <div v-if="repository.description" class="repository-description">
              {{ repository.description }}
            </div>
            
            <!-- Repository metadata -->
            <div class="repository-metadata">
              <div v-if="repository.language" class="metadata-item language">
                <span class="language-dot" :style="{ backgroundColor: getLanguageColor(repository.language) }"></span>
                {{ repository.language }}
              </div>
              
              <div class="metadata-item stars">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
                </svg>
                {{ repository.stargazers_count || 0 }}
              </div>
              
              <div class="metadata-item forks">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="18" r="3"></circle>
                  <circle cx="6" cy="6" r="3"></circle>
                  <circle cx="18" cy="6" r="3"></circle>
                  <path d="m18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path>
                  <path d="m12 12v3"></path>
                </svg>
                {{ repository.forks_count || 0 }}
              </div>
              
              <div class="metadata-item size">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                </svg>
                {{ formatRepositorySize(repository.size) }}
              </div>
              
              <div class="metadata-item updated">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12,6 12,12 16,14"></polyline>
                </svg>
                Updated {{ formatLastUpdated(repository.updated_at) }}
              </div>
            </div>
          </div>
          
          <!-- Load More Button -->
          <div v-if="repositoryHasMore" class="load-more-container">
            <button 
              @click="loadMoreRepositories" 
              class="load-more-btn"
              :disabled="repositoryLoadingMore"
            >
              <div v-if="repositoryLoadingMore" class="loading-spinner small"></div>
              <span v-else>Load More</span>
            </button>
          </div>
        </div>
        
        <!-- Clone Progress -->
        <div v-if="cloneProgress && cloneProgress.repository" class="clone-progress-section">
          <div class="progress-header">
            <h4>Cloning {{ cloneProgress.repository.name }}</h4>
          </div>
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${cloneProgress.progress}%` }"
            ></div>
          </div>
          <div class="progress-info">
            <span class="progress-stage">{{ cloneProgress.stage }}</span>
            <span class="progress-message">{{ cloneProgress.message }}</span>
          </div>
        </div>
        
          <!-- Clone Error -->
          <div v-if="cloneError" class="clone-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{{ cloneError }}</span>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary">Cancel</button>
        <button
          v-if="activeTab === 'empty'"
          @click="createEmptyWorkspace"
          class="btn btn-primary"
          :disabled="creatingEmptyWorkspace || !emptyWorkspaceForm.name.trim()"
        >
          <div v-if="creatingEmptyWorkspace" class="loading-spinner small"></div>
          <span v-else>Create Workspace</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUIStore } from '@/stores/ui'
import type { Repository } from '@/stores/workspace'

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

// Tab management
const activeTab = ref<'empty' | 'clone'>('empty')

// Search functionality (for clone tab)
const searchTerm = ref('')
const repositoryListRef = ref<HTMLElement>()

// Empty workspace form
const emptyWorkspaceForm = ref({
  name: '',
  description: '',
  path: ''
})
const creatingEmptyWorkspace = ref(false)
const emptyWorkspaceError = ref<string | null>(null)

const closeModal = () => {
  uiStore.closeRepositoriesModal()
}

const handleSearch = () => {
  workspaceStore.searchRepositories(searchTerm.value)
}

const clearSearch = () => {
  searchTerm.value = ''
  workspaceStore.searchRepositories('')
}

const loadRepositories = async () => {
  await workspaceStore.loadRepositories(1, false)
}

const loadMoreRepositories = async () => {
  await workspaceStore.loadMoreRepositories()
}

const selectRepository = (repository: Repository) => {
  console.log('Repository selected:', repository.full_name)
}

const cloneRepository = async (repository: Repository) => {
  try {
    await workspaceStore.cloneRepository(repository)
  } catch (err) {
    console.error('Failed to clone repository:', err)
  }
}

const createEmptyWorkspace = async () => {
  // Validate form
  if (!emptyWorkspaceForm.value.name.trim()) {
    emptyWorkspaceError.value = 'Workspace name is required'
    return
  }

  creatingEmptyWorkspace.value = true
  emptyWorkspaceError.value = null

  try {
    await workspaceStore.createEmptyWorkspace({
      name: emptyWorkspaceForm.value.name.trim(),
      description: emptyWorkspaceForm.value.description.trim() || undefined,
      path: emptyWorkspaceForm.value.path.trim() || undefined
    })

    // Reset form and close modal on success
    emptyWorkspaceForm.value = { name: '', description: '', path: '' }
    closeModal()
  } catch (err) {
    emptyWorkspaceError.value = err instanceof Error ? err.message : 'Failed to create workspace'
    console.error('Failed to create empty workspace:', err)
  } finally {
    creatingEmptyWorkspace.value = false
  }
}

// Get language color (simplified version)
const getLanguageColor = (language: string): string => {
  const colors: Record<string, string> = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#2b7489',
    'Python': '#3572A5',
    'Java': '#b07219',
    'C++': '#f34b7d',
    'C#': '#239120',
    'Go': '#00ADD8',
    'Rust': '#dea584',
    'PHP': '#4F5D95',
    'Ruby': '#701516',
    'Swift': '#ffac45',
    'Kotlin': '#F18E33',
    'HTML': '#e34c26',
    'CSS': '#1572B6',
    'Vue': '#4FC08D',
    'React': '#61DAFB',
    'Shell': '#89e051'
  }
  
  return colors[language] || '#858585'
}

// Setup infinite scrolling
// Format repository size
const formatRepositorySize = (sizeKb: number) => {
  if (sizeKb < 1024) {
    return `${sizeKb} KB`
  } else if (sizeKb < 1024 * 1024) {
    return `${Math.round(sizeKb / 1024)} MB`
  } else {
    return `${Math.round(sizeKb / (1024 * 1024))} GB`
  }
}

// Format last updated time
const formatLastUpdated = (updatedAt: string) => {
  const date = new Date(updatedAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years} year${years > 1 ? 's' : ''} ago`
  }
}

const setupInfiniteScroll = () => {
  if (!repositoryListRef.value) return
  
  const handleScroll = () => {
    const container = repositoryListRef.value!
    const { scrollTop, scrollHeight, clientHeight } = container
    
    // Load more when 200px from bottom
    if (scrollHeight - scrollTop <= clientHeight + 200) {
      if (repositoryHasMore.value && !repositoryLoadingMore.value) {
        loadMoreRepositories()
      }
    }
  }
  
  repositoryListRef.value.addEventListener('scroll', handleScroll)
}

onMounted(async () => {
  // Setup infinite scrolling - repositories are loaded by openRepositoriesModal in store
  nextTick(() => {
    setupInfiniteScroll()
  })
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
  max-width: 800px;
  width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: scaleIn 0.2s ease-out;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Workspace Tabs */
.workspace-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 2px solid transparent;
}

.tab-button:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.tab-button.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  background: var(--bg-secondary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Search Section */
.search-section {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: var(--primary);
}

.search-clear {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Empty Workspace Form */
.empty-workspace-form {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.form-section {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--primary);
}

.form-input.error {
  border-color: var(--error);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.form-error {
  margin-top: 4px;
  font-size: 12px;
  color: var(--error);
}

.creating-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 14px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--error);
  color: white;
  border-radius: 6px;
  font-size: 14px;
  margin-top: 16px;
}

/* Modal Body */
.modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  gap: 12px;
  text-align: center;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.error-state {
  color: var(--error);
}

.retry-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.retry-btn:hover {
  background: var(--button-hover);
}

/* Repository List */
.repository-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.repository-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.repository-item:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.repository-item.is-cloning {
  border-color: var(--primary);
  background: var(--bg-tertiary);
}

.repository-item.is-archived {
  opacity: 0.6;
  cursor: not-allowed;
}

.repository-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.repository-name-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.repo-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.repository-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repository-badges {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge.private {
  background: var(--warning);
  color: white;
}

.badge.fork {
  background: var(--info);
  color: white;
}

.badge.archived {
  background: var(--text-muted);
  color: white;
}

.repository-actions {
  flex-shrink: 0;
}

.clone-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.progress-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.clone-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}

.clone-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.clone-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.repository-description {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 12px;
}

.repository-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.language-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.load-more-btn {
  background: var(--button-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--button-hover);
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Clone Progress Section */
.clone-progress-section {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.progress-header h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-primary);
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

.clone-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--error);
  color: white;
  font-size: 14px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.15s ease;
}

.btn-secondary {
  background: var(--button-secondary-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-secondary:hover {
  background: var(--button-secondary-hover);
}

.btn-primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.9);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .modal-content {
    margin: 20px;
    max-height: calc(100vh - 40px);
  }
  
  .repository-metadata {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  
  .repository-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .repository-name-section {
    width: 100%;
  }
}
</style>