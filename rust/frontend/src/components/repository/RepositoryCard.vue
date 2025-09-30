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
    <!-- Card Header with Icon -->
    <div class="repository-header">
      <div class="repository-icon-wrapper">
        <FolderIcon class="repository-icon" />
      </div>

      <div class="repository-content">
        <!-- Name & Badges Row -->
        <div class="repository-title-row">
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

        <!-- Description -->
        <p v-if="repository.description" class="repository-description">
          {{ repository.description }}
        </p>

        <!-- Metadata Footer -->
        <div class="repository-footer">
          <div class="metadata-row">
            <div v-if="repository.language" class="metadata-item language">
              <CodeBracketIcon class="metadata-icon" />
              <span
                class="language-indicator"
                :style="{ backgroundColor: getLanguageColor(repository.language) }"
              />
              <span>{{ repository.language }}</span>
            </div>

            <div class="metadata-item stars">
              <StarIcon class="metadata-icon" />
              <span>{{ formatCount(repository.stargazers_count || 0) }}</span>
            </div>

            <div class="metadata-item forks">
              <svg class="metadata-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="12" r="2"></circle>
                <circle cx="4" cy="4" r="2"></circle>
                <circle cx="12" cy="4" r="2"></circle>
                <path d="M12 6v0.67c0 .73-.6 1.33-1.33 1.33H5.33C4.6 8 4 7.4 4 6.67V6"></path>
                <path d="M8 8v2"></path>
              </svg>
              <span>{{ formatCount(repository.forks_count || 0) }}</span>
            </div>

            <div class="metadata-item size">
              <CircleStackIcon class="metadata-icon" />
              <span>{{ formatRepositorySize(repository.size) }}</span>
            </div>

            <div class="metadata-item updated">
              <ClockIcon class="metadata-icon" />
              <span>{{ formatLastUpdated(repository.updated_at) }}</span>
            </div>
          </div>

          <!-- Action Button -->
          <div class="repository-actions">
            <div v-if="isCloning" class="clone-status">
              <LoadingSpinner size="small" />
              <span class="status-text">Cloning...</span>
            </div>
            <button
              v-else-if="repository.archived !== true && !repository.disabled"
              @click.stop="handleClone"
              class="clone-btn"
              :disabled="disabled"
              :aria-label="`Clone ${repository.name}`"
            >
              <ArrowDownTrayIcon class="btn-icon" />
              <span>Clone</span>
            </button>
            <div v-else-if="repository.archived" class="archived-indicator">
              <ArchiveBoxIcon class="archived-icon" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import {
  FolderIcon,
  CodeBracketIcon,
  StarIcon,
  CircleStackIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  ArchiveBoxIcon
} from '@heroicons/vue/24/outline'

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
const formatLastUpdated = (updatedAt: string | undefined) => {
  if (!updatedAt) return 'Unknown'

  const date = new Date(updatedAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}w ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}mo ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years}y ago`
  }
}

// Format numbers with k/m suffixes
const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}m`
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}
</script>

<style scoped>
/* ===== ATLASSIAN-INSPIRED CARD ===== */
.repository-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base, 8px);
  padding: var(--space-4, 16px);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  box-shadow: var(--shadow-sm);
}

.repository-card:hover:not(.is-archived, .is-disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.repository-card.is-cloning {
  border-color: var(--color-border-brand);
  background: var(--color-bg-brand-subtle);
}

.repository-card.is-archived {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-bg-tertiary);
}

.repository-card.is-archived:hover {
  transform: none;
  box-shadow: var(--shadow-sm);
}

.repository-card.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== HEADER SECTION ===== */
.repository-header {
  display: flex;
  gap: var(--space-3, 12px);
}

.repository-icon-wrapper {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-brand-subtle);
  border-radius: var(--radius-base, 8px);
  color: var(--color-text-brand);
}

.repository-icon {
  width: 20px;
  height: 20px;
}

/* ===== CONTENT SECTION ===== */
.repository-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.repository-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
}

.repository-name {
  margin: 0;
  font-size: var(--font-size-md, 15px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight, 1.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repository-badges {
  display: flex;
  gap: var(--space-2, 8px);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.repository-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm, 13px);
  line-height: var(--line-height-normal, 1.5);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ===== FOOTER SECTION ===== */
.repository-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  margin-top: var(--space-1, 4px);
}

.metadata-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4, 16px);
  align-items: center;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-tertiary);
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  font-weight: var(--font-weight-medium, 500);
}

.metadata-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.language-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ===== ACTIONS ===== */
.repository-actions {
  flex-shrink: 0;
}

.clone-status {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  color: var(--color-text-brand);
  font-size: var(--font-size-xs, 12px);
  font-weight: var(--font-weight-medium, 500);
  padding: var(--space-1, 4px) var(--space-2, 8px);
}

.status-text {
  white-space: nowrap;
}

.clone-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-base, 8px);
  font-size: var(--font-size-xs, 12px);
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.clone-btn:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
  box-shadow: var(--shadow-sm);
}

.clone-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.clone-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.archived-indicator {
  display: flex;
  align-items: center;
  padding: var(--space-2, 8px);
  color: var(--color-text-tertiary);
}

.archived-icon {
  width: 16px;
  height: 16px;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .repository-card {
    padding: var(--space-3, 12px);
  }

  .repository-header {
    flex-direction: column;
  }

  .repository-icon-wrapper {
    width: 36px;
    height: 36px;
  }

  .repository-icon {
    width: 18px;
    height: 18px;
  }

  .repository-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2, 8px);
  }

  .metadata-row {
    width: 100%;
    gap: var(--space-3, 12px);
  }

  .repository-actions {
    width: 100%;
  }

  .clone-btn {
    width: 100%;
    justify-content: center;
  }
}

/* ===== ACCESSIBILITY ===== */
.clone-btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* ===== REDUCED MOTION ===== */
@media (prefers-reduced-motion: reduce) {
  .repository-card,
  .clone-btn {
    transition: none !important;
  }
}
</style>