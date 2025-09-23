<template>
  <div class="repository-list" ref="listRef">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <LoadingSpinner size="large" text="Loading repositories..." />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>{{ error }}</p>
      <button @click="handleRetry" class="retry-btn">Retry</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="repositories.length === 0" class="empty-state">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <p>{{ emptyMessage }}</p>
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
          <span v-else>Load More</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import RepositoryCard, { type Repository } from './RepositoryCard.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

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
.repository-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg, 16px) var(--space-3xl, 32px) var(--space-2xl, 24px);
  min-height: 0;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4xl, 40px) var(--space-2xl, 24px);
  color: var(--text-secondary);
  gap: var(--space-lg, 16px);
  text-align: center;
  min-height: 300px;
}

.error-state {
  color: var(--error);
}

.error-state p {
  margin: 0;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
}

.retry-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: var(--space-md, 12px) var(--space-xl, 20px);
  border-radius: var(--radius-lg, 12px);
  cursor: pointer;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.retry-btn:hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Repository Grid */
.repository-grid {
  display: grid;
  gap: var(--space-lg, 16px);
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: var(--space-2xl, 24px) 0;
}

.load-more-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: var(--space-lg, 16px) var(--space-2xl, 24px);
  border-radius: var(--radius-lg, 12px);
  cursor: pointer;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
  display: flex;
  align-items: center;
  gap: var(--space-md, 12px);
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 120px;
  justify-content: center;
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

/* Responsive Design */
@media (max-width: 768px) {
  .repository-list {
    padding: var(--space-lg, 16px) var(--space-2xl, 24px);
  }

  .loading-state,
  .error-state,
  .empty-state {
    padding: var(--space-3xl, 32px) var(--space-lg, 16px);
    min-height: 250px;
  }
}

@media (max-width: 480px) {
  .repository-list {
    padding: var(--space-md, 12px) var(--space-lg, 16px);
  }

  .loading-state,
  .error-state,
  .empty-state {
    padding: var(--space-2xl, 24px) var(--space-md, 12px);
    min-height: 200px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .retry-btn,
  .load-more-btn {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .retry-btn,
  .load-more-btn {
    transition: none !important;
  }
}
</style>