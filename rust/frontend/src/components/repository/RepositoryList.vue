<template>
  <div class="repository-list" ref="listRef">
    <!-- Loading State -->
    <div v-if="loading" class="empty-state">
      <LoadingSpinner size="large" />
      <p class="state-text">Loading repositories...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="empty-state error">
      <ExclamationCircleIcon class="state-icon error-icon" />
      <p class="state-title">Failed to load repositories</p>
      <p class="state-text">{{ error }}</p>
      <button @click="handleRetry" class="retry-btn">
        <ArrowPathIcon class="btn-icon" />
        <span>Try again</span>
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="repositories.length === 0" class="empty-state">
      <FolderIcon class="state-icon" />
      <p class="state-title">No repositories found</p>
      <p class="state-text">{{ emptyMessage }}</p>
    </div>

    <!-- Repository List -->
    <div v-else class="repository-grid">
      <RepositoryCard
        v-for="repository in repositories"
        :key="repository?.id || Math.random()"
        :repository="repository"
        :is-cloning="cloningRepositoryId === repository.id"
        :disabled="!!cloningRepositoryId"
        @click="handleRepositoryClick"
        @clone="handleRepositoryClone"
      />

      <!-- Load More Button -->
      <div v-if="hasMore" class="load-more-container">
        <button
          @click="handleLoadMore"
          class="load-more-btn"
          :disabled="loadingMore"
        >
          <LoadingSpinner v-if="loadingMore" size="small" />
          <ChevronDownIcon v-else class="btn-icon" />
          <span v-if="!loadingMore">Load more repositories</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import RepositoryCard, { type Repository } from './RepositoryCard.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import {
  FolderIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon
} from '@heroicons/vue/24/outline'

interface Props {
  repositories: Repository[]
  loading?: boolean
  error?: string | null
  hasMore?: boolean
  loadingMore?: boolean
  cloningRepositoryId?: string | number | null
  emptyMessage?: string
  enableInfiniteScroll?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  hasMore: false,
  loadingMore: false,
  cloningRepositoryId: null,
  emptyMessage: 'No repositories found',
  enableInfiniteScroll: true
})

const emit = defineEmits<{
  repositoryClick: [repository: Repository]
  repositoryClone: [repository: Repository]
  loadMore: []
  retry: []
}>()

const listRef = ref<HTMLElement>()

const handleRepositoryClick = (repository: Repository) => {
  emit('repositoryClick', repository)
}

const handleRepositoryClone = (repository: Repository) => {
  emit('repositoryClone', repository)
}

const handleLoadMore = () => {
  emit('loadMore')
}

const handleRetry = () => {
  emit('retry')
}

// Infinite scroll handling
const handleScroll = () => {
  if (!listRef.value || !props.enableInfiniteScroll) return

  const { scrollTop, scrollHeight, clientHeight } = listRef.value

  // Load more when 200px from bottom
  if (scrollHeight - scrollTop <= clientHeight + 200) {
    if (props.hasMore && !props.loadingMore) {
      handleLoadMore()
    }
  }
}

const setupInfiniteScroll = () => {
  if (!listRef.value || !props.enableInfiniteScroll) return

  listRef.value.addEventListener('scroll', handleScroll)
}

const cleanupInfiniteScroll = () => {
  if (!listRef.value) return

  listRef.value.removeEventListener('scroll', handleScroll)
}

onMounted(() => {
  nextTick(() => {
    setupInfiniteScroll()
  })
})

onUnmounted(() => {
  cleanupInfiniteScroll()
})
</script>

<style scoped>
/* ===== CONTAINER ===== */
.repository-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4, 16px);
  min-height: 0;
}

/* ===== EMPTY STATES ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12, 48px) var(--space-6, 24px);
  gap: var(--space-3, 12px);
  text-align: center;
  min-height: 320px;
}

.state-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-2, 8px);
}

.error-icon {
  color: var(--color-text-danger);
}

.state-title {
  margin: 0;
  font-size: var(--font-size-lg, 16px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
}

.state-text {
  margin: 0;
  font-size: var(--font-size-sm, 13px);
  color: var(--color-text-secondary);
  max-width: 400px;
}

.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  margin-top: var(--space-4, 16px);
  background: var(--color-interactive-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base, 8px);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
  transition: all 0.15s ease;
}

.retry-btn:hover {
  background: var(--color-interactive-secondary-hover);
  border-color: var(--color-border-focus);
}

.retry-btn:active {
  transform: scale(0.98);
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* ===== REPOSITORY GRID ===== */
.repository-grid {
  display: grid;
  gap: var(--space-3, 12px);
}

/* ===== LOAD MORE ===== */
.load-more-container {
  display: flex;
  justify-content: center;
  padding: var(--space-4, 16px) 0;
}

.load-more-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-6, 24px);
  background: var(--color-interactive-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base, 8px);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
  transition: all 0.15s ease;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--color-interactive-secondary-hover);
  border-color: var(--color-border-focus);
}

.load-more-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .repository-list {
    padding: var(--space-3, 12px);
  }

  .empty-state {
    padding: var(--space-8, 32px) var(--space-4, 16px);
    min-height: 280px;
  }

  .state-icon {
    width: 40px;
    height: 40px;
  }
}

/* ===== ACCESSIBILITY ===== */
.retry-btn:focus-visible,
.load-more-btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* ===== REDUCED MOTION ===== */
@media (prefers-reduced-motion: reduce) {
  .retry-btn,
  .load-more-btn {
    transition: none !important;
  }
}
</style>