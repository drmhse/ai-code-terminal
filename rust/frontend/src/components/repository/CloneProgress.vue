<template>
  <div v-if="progress && progress.repository" class="clone-progress-section">
    <div class="progress-header">
      <h4 class="progress-title">
        Cloning {{ progress.repository.name }}
      </h4>
      <button v-if="allowCancel" @click="handleCancel" class="cancel-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="progress-bar-container">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${progress.progress}%` }"
        ></div>
      </div>
      <span class="progress-percentage">{{ Math.round(progress.progress) }}%</span>
    </div>

    <div class="progress-info">
      <span class="progress-stage">{{ progress.stage }}</span>
      <span v-if="progress.message" class="progress-message">{{ progress.message }}</span>
    </div>

    <div v-if="estimatedTime" class="progress-time">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12,6 12,12 16,14"></polyline>
      </svg>
      <span>{{ estimatedTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface CloneProgressData {
  repository: {
    id: string | number
    name: string
    full_name?: string
  }
  progress: number // 0-100
  stage: string
  message?: string
  startTime?: Date
  estimatedDuration?: number // in seconds
}

interface Props {
  progress: CloneProgressData | null
  allowCancel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  allowCancel: false
})

const emit = defineEmits<{
  cancel: []
}>()

const estimatedTime = computed(() => {
  if (!props.progress?.startTime || !props.progress?.estimatedDuration) {
    return null
  }

  const elapsed = (Date.now() - props.progress.startTime.getTime()) / 1000
  const remaining = Math.max(0, props.progress.estimatedDuration - elapsed)

  if (remaining < 60) {
    return `${Math.round(remaining)}s remaining`
  } else if (remaining < 3600) {
    const minutes = Math.round(remaining / 60)
    return `${minutes}m remaining`
  } else {
    const hours = Math.floor(remaining / 3600)
    const minutes = Math.round((remaining % 3600) / 60)
    return `${hours}h ${minutes}m remaining`
  }
})

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.clone-progress-section {
  padding: var(--space-2xl, 24px) var(--space-3xl, 32px);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg, 16px);
}

.progress-title {
  margin: 0;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary);
}

.cancel-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-xs, 4px);
  border-radius: var(--radius-sm, 6px);
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  width: 24px;
  height: 24px;
}

.cancel-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: var(--space-md, 12px);
  margin-bottom: var(--space-md, 12px);
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--border-color);
  border-radius: var(--radius-sm, 6px);
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  transition: width 0.3s ease;
  border-radius: inherit;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 2s infinite;
}

.progress-percentage {
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary);
  min-width: 40px;
  text-align: right;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md, 12px);
  margin-bottom: var(--space-sm, 8px);
}

.progress-stage {
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary);
  text-transform: capitalize;
}

.progress-message {
  font-size: var(--font-size-sm, 12px);
  color: var(--text-secondary);
  text-align: right;
  opacity: 0.8;
}

.progress-time {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 4px);
  font-size: var(--font-size-xs, 11px);
  color: var(--text-muted);
  font-weight: var(--font-weight-medium, 500);
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .clone-progress-section {
    padding: var(--space-xl, 20px) var(--space-2xl, 24px);
  }

  .progress-info {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs, 4px);
  }

  .progress-message {
    text-align: left;
  }
}

@media (max-width: 480px) {
  .progress-bar-container {
    flex-direction: column;
    gap: var(--space-sm, 8px);
  }

  .progress-percentage {
    align-self: flex-end;
    min-width: auto;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .progress-bar {
    border: 1px solid var(--border-color);
  }

  .progress-fill {
    border: 1px solid var(--primary);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .progress-fill,
  .cancel-btn {
    transition: none !important;
  }

  .progress-fill::after {
    animation: none !important;
  }
}
</style>