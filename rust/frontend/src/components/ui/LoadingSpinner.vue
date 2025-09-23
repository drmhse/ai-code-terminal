<template>
  <div class="loading-spinner" :class="[size, variant]">
    <div class="spinner"></div>
    <span v-if="text" class="loading-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'small' | 'medium' | 'large'
  variant?: 'default' | 'overlay' | 'inline'
  text?: string
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
  variant: 'default'
})
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md, 12px);
}

.loading-spinner.overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--bg-primary-rgb, 255, 255, 255), 0.8);
  backdrop-filter: blur(2px);
  z-index: 10;
}

.loading-spinner.inline {
  flex-direction: row;
  gap: var(--space-sm, 8px);
}

.spinner {
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Size variants */
.loading-spinner.small .spinner {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.loading-spinner.medium .spinner {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

.loading-spinner.large .spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.loading-text {
  color: var(--text-secondary);
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-medium, 500);
}

.loading-spinner.small .loading-text {
  font-size: var(--font-size-xs, 11px);
}

.loading-spinner.large .loading-text {
  font-size: var(--font-size-base, 14px);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2s !important;
  }
}
</style>