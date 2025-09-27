<template>
  <div
    class="repository-card"
    :class="{
      'is-cloning': isCloning,
      'is-archived': repository.archived === true,
      'is-disabled': repository.disabled
    }"
    @click="handleClick"
  >
    <div class="repository-header">
      <div class="repository-name-section">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="repo-icon"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>

        <h3 class="repository-name">{{ repository.name }}</h3>

        <div class="repository-badges">
          <StatusBadge
            v-if="repository.private"
            text="Private"
            variant="private"
            size="small"
          />
          <StatusBadge
            v-if="repository.fork"
            text="Fork"
            variant="fork"
            size="small"
          />
          <StatusBadge
            v-if="repository.archived === true"
            text="Archived"
            variant="archived"
            size="small"
          />
        </div>
      </div>

      <div class="repository-actions">
        <div v-if="isCloning" class="clone-progress">
          <LoadingSpinner size="small" />
          <span class="progress-text">Cloning...</span>
        </div>
        <button
          v-else-if="repository.archived !== true && !repository.disabled"
          @click.stop="handleClone"
          class="clone-btn"
          :disabled="disabled"
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

    <p v-if="repository.description" class="repository-description">
      {{ repository.description }}
    </p>

    <div class="repository-metadata">
      <div v-if="repository.language" class="metadata-item language">
        <span
          class="language-dot"
          :style="{ backgroundColor: getLanguageColor(repository.language) }"
        ></span>
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
</template>

<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

export interface Repository {
  id: string | number
  name: string
  full_name?: string
  description?: string
  html_url?: string
  clone_url?: string
  ssh_url?: string
  private: boolean
  fork: boolean
  archived?: boolean
  disabled?: boolean
  updated_at?: string
  language?: string | null
  stargazers_count?: number
  forks_count?: number
  size?: number
  default_branch?: string
  pushed_at?: string
  owner?: {
    id: number
    login: string
    name?: string | null
    email?: string | null
    avatar_url: string
    html_url: string
    company?: string | null
    location?: string | null
    public_repos: number
    followers: number
  }
}

interface Props {
  repository: Repository
  isCloning?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isCloning: false,
  disabled: false
})

const emit = defineEmits<{
  click: [repository: Repository]
  clone: [repository: Repository]
}>()

const handleClick = () => {
  if (props.repository.archived !== true && !props.repository.disabled) {
    emit('click', props.repository)
  }
}

const handleClone = () => {
  if (!props.disabled) {
    emit('clone', props.repository)
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
</script>

<style scoped>
.repository-card {
  background: var(--bg-secondary);
  border: 1px solid transparent;
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-2xl, 24px);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.05),
    0 1px 2px rgba(0, 0, 0, 0.1);
}

.repository-card::before {
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

.repository-card:hover:not(.is-archived, .is-disabled) {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow:
    0 8px 25px rgba(0, 0, 0, 0.1),
    0 4px 10px rgba(0, 0, 0, 0.05);
}

.repository-card:hover:not(.is-archived, .is-disabled)::before {
  opacity: 1;
}

.repository-card.is-cloning {
  border-color: var(--primary);
  background: var(--bg-tertiary);
  transform: none;
}

.repository-card.is-cloning::before {
  opacity: 1;
}

.repository-card.is-archived {
  opacity: 0.6;
  cursor: not-allowed;
}

.repository-card.is-archived:hover {
  transform: none;
  border-color: transparent;
}

.repository-card.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.repository-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-lg, 16px);
  margin-bottom: var(--space-lg, 16px);
}

.repository-name-section {
  display: flex;
  align-items: center;
  gap: var(--space-md, 12px);
  flex: 1;
  min-width: 0;
}

.repo-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
  opacity: 0.8;
}

.repository-name {
  margin: 0;
  font-size: var(--font-size-lg, 16px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary);
  line-height: 1.4;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repository-badges {
  display: flex;
  gap: var(--space-sm, 8px);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.repository-actions {
  flex-shrink: 0;
}

.clone-progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 8px);
  color: var(--text-secondary);
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-medium, 500);
}

.clone-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: var(--space-sm, 8px) var(--space-lg, 16px);
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-medium, 500);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-xs, 4px);
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
  font-size: var(--font-size-base, 14px);
  line-height: 1.5;
  margin: 0 0 var(--space-lg, 16px) 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repository-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg, 16px);
  align-items: center;
  font-size: var(--font-size-sm, 12px);
  color: var(--text-muted);
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 4px);
  font-weight: var(--font-weight-medium, 500);
}

.language-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .repository-card {
    padding: var(--space-xl, 20px);
  }

  .repository-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md, 12px);
  }

  .repository-name-section {
    width: 100%;
  }

  .repository-metadata {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm, 8px);
  }
}

/* Dark mode refinements */
@media (prefers-color-scheme: dark) {
  .repository-card {
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.2),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .repository-card:hover:not(.is-archived, .is-disabled) {
    box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.3),
      0 4px 10px rgba(0, 0, 0, 0.2);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .repository-card {
    border: 1px solid var(--border-color);
  }

  .repository-card:hover:not(.is-archived, .is-disabled) {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .repository-card,
  .repository-card::before,
  .clone-btn {
    transition: none !important;
  }
}
</style>