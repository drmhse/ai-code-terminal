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
/* Base tokens for spacing and design system */
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
  --space-3xl: 32px;
  --space-4xl: 40px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-2xl: 20px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 1000;
  animation: fadeIn 0.25s ease-out;
  padding: var(--space-2xl);
}

.modal-content {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 8px 24px rgba(0, 0, 0, 0.2);
  max-width: 900px;
  width: 100%;
  max-height: 85vh;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2xl) var(--space-3xl) var(--space-xl);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  letter-spacing: -0.025em;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  width: 32px;
  height: 32px;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transform: scale(1.05);
}

/* Modern Pill Tabs */
.workspace-tabs {
  display: flex;
  gap: var(--space-xs);
  padding: 0 var(--space-3xl);
  margin-bottom: var(--space-lg);
}

.tab-button {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-xl);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  border-radius: var(--radius-lg);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.tab-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: inherit;
}

.tab-button:hover {
  color: var(--text-primary);
  border-color: var(--border-color);
  background: var(--bg-secondary);
  transform: translateY(-1px);
}

.tab-button.active {
  color: white;
  border-color: var(--primary);
  background: var(--primary);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.1),
    0 2px 4px rgba(0, 0, 0, 0.06);
}

.tab-button.active::before {
  opacity: 1;
}

.tab-button svg {
  position: relative;
  z-index: 1;
}

.tab-button span {
  position: relative;
  z-index: 1;
}

/* Enhanced Search */
.search-section {
  padding: 0 var(--space-3xl) var(--space-2xl);
}

.search-input-container {
  position: relative;
  max-width: 500px;
}

.search-icon {
  position: absolute;
  left: var(--space-lg);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
  z-index: 2;
}

.search-input {
  width: 100%;
  padding: var(--space-lg) var(--space-lg) var(--space-lg) var(--space-4xl);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  outline: none;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-input:focus {
  border-color: var(--primary);
  box-shadow:
    0 0 0 3px rgba(var(--primary-rgb, 59, 130, 246), 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1);
  background: var(--bg-primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-clear {
  position: absolute;
  right: var(--space-lg);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  z-index: 2;
}

.search-clear:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Modal Body */
.modal-body {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Empty Workspace Form */
.empty-workspace-form {
  padding: var(--space-3xl);
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.form-input,
.form-textarea {
  padding: var(--space-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  outline: none;
  transition: all 0.2s ease;
  font-family: inherit;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--primary);
  box-shadow:
    0 0 0 3px rgba(var(--primary-rgb, 59, 130, 246), 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1);
  background: var(--bg-primary);
}

.form-input.error {
  border-color: var(--error);
  box-shadow: 0 0 0 3px rgba(var(--error-rgb, 239, 68, 68), 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.5;
}

.form-hint {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.4;
}

.form-error {
  font-size: var(--font-size-sm);
  color: var(--error);
  font-weight: var(--font-weight-medium);
}

.creating-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  padding: var(--space-4xl);
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
  background: var(--error);
  color: white;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4xl) var(--space-2xl);
  color: var(--text-secondary);
  gap: var(--space-lg);
  text-align: center;
  min-height: 300px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.error-state {
  color: var(--error);
}

.retry-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: var(--space-md) var(--space-xl);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.retry-btn:hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Redesigned Repository List */
.repository-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg) var(--space-3xl) var(--space-2xl);
  min-height: 0;
  display: grid;
  gap: var(--space-lg);
}

.repository-item {
  background: var(--bg-secondary);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  padding: var(--space-2xl);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.05),
    0 1px 2px rgba(0, 0, 0, 0.1);
}

.repository-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  opacity: 0;
  transition: opacity 0.2s ease;
}

.repository-item:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow:
    0 8px 25px rgba(0, 0, 0, 0.1),
    0 4px 10px rgba(0, 0, 0, 0.05);
}

.repository-item:hover::before {
  opacity: 1;
}

.repository-item.is-cloning {
  border-color: var(--primary);
  background: var(--bg-tertiary);
  transform: none;
}

.repository-item.is-cloning::before {
  opacity: 1;
}

.repository-item.is-archived {
  opacity: 0.6;
  cursor: not-allowed;
}

.repository-item.is-archived:hover {
  transform: none;
  border-color: transparent;
}

.repository-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.repository-name-section {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex: 1;
  min-width: 0;
}

.repo-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
  opacity: 0.8;
}

.repository-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.repository-badges {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.badge {
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge.private {
  background: rgba(245, 158, 11, 0.1);
  color: rgb(245, 158, 11);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.badge.fork {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.badge.archived {
  background: rgba(107, 114, 128, 0.1);
  color: rgb(107, 114, 128);
  border: 1px solid rgba(107, 114, 128, 0.2);
}

.repository-actions {
  flex-shrink: 0;
}

.clone-progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.progress-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.clone-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.clone-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.clone-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.repository-description {
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  line-height: 1.5;
  margin-bottom: var(--space-lg);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repository-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  align-items: center;
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: var(--font-weight-medium);
}

.language-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: var(--space-2xl);
}

.load-more-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: var(--space-lg) var(--space-2xl);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  display: flex;
  align-items: center;
  gap: var(--space-md);
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.load-more-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Clone Progress Section */
.clone-progress-section {
  padding: var(--space-2xl) var(--space-3xl);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.progress-header h4 {
  margin: 0 0 var(--space-lg) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--space-md);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  transition: width 0.3s ease;
  border-radius: inherit;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.clone-error {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-3xl);
  background: var(--error);
  color: white;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  padding: var(--space-2xl) var(--space-3xl);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.btn {
  padding: var(--space-md) var(--space-xl);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 44px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-content {
    margin: var(--space-lg);
    max-height: calc(100vh - 32px);
    border-radius: var(--radius-lg);
  }

  .modal-header {
    padding: var(--space-xl) var(--space-2xl) var(--space-lg);
  }

  .modal-header h3 {
    font-size: var(--font-size-xl);
  }

  .workspace-tabs {
    padding: 0 var(--space-2xl);
    flex-direction: column;
    gap: var(--space-sm);
  }

  .tab-button {
    justify-content: center;
  }

  .search-section {
    padding: 0 var(--space-2xl) var(--space-xl);
  }

  .repository-list {
    padding: var(--space-lg) var(--space-2xl);
  }

  .repository-item {
    padding: var(--space-xl);
  }

  .repository-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .repository-name-section {
    width: 100%;
  }

  .repository-metadata {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .modal-footer {
    padding: var(--space-xl) var(--space-2xl);
    flex-direction: column-reverse;
  }

  .btn {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: var(--space-lg);
  }

  .empty-workspace-form {
    padding: var(--space-2xl);
  }

  .search-input-container {
    max-width: none;
  }
}

/* Dark mode refinements */
@media (prefers-color-scheme: dark) {
  .modal-content {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 20px 40px rgba(0, 0, 0, 0.5),
      0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .repository-item {
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.2),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .repository-item:hover {
    box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.3),
      0 4px 10px rgba(0, 0, 0, 0.2);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .tab-button.active {
    border: 2px solid var(--primary);
  }

  .repository-item {
    border: 1px solid var(--border-color);
  }

  .repository-item:hover {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>