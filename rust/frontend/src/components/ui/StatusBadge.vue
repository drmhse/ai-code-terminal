<template>
  <span class="status-badge" :class="[variant, size]">
    <component
      v-if="icon"
      :is="icon"
      class="badge-icon"
    />
    <svg
      v-else-if="iconSvg"
      v-html="iconSvg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="badge-icon"
    />
    <span class="badge-text">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
interface Props {
  text: string
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'private' | 'fork' | 'archived'
  size?: 'small' | 'medium'
  icon?: Component
  iconSvg?: string
}

withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'medium'
})
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs, 4px);
  border-radius: var(--radius-md, 8px);
  font-weight: var(--font-weight-medium, 500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  border: 1px solid transparent;
}

/* Size variants */
.status-badge.small {
  font-size: var(--font-size-xs, 11px);
  padding: var(--space-xs, 4px) var(--space-sm, 8px);
}

.status-badge.medium {
  font-size: var(--font-size-sm, 12px);
  padding: var(--space-sm, 8px) var(--space-md, 12px);
}

.badge-icon {
  flex-shrink: 0;
}

.status-badge.small .badge-icon {
  width: 10px;
  height: 10px;
}

.status-badge.medium .badge-icon {
  width: 12px;
  height: 12px;
}

/* Color variants */
.status-badge.primary {
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-interactive-primary);
}

.status-badge.secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border-color: var(--color-border-primary);
}

.status-badge.success {
  background: var(--color-semantic-success-bg);
  color: var(--color-semantic-success);
  border-color: var(--color-semantic-success-border);
}

.status-badge.warning {
  background: var(--color-semantic-warning-bg);
  color: var(--color-semantic-warning);
  border-color: var(--color-semantic-warning-border);
}

.status-badge.error {
  background: var(--color-semantic-error-bg);
  color: var(--color-semantic-error);
  border-color: var(--color-semantic-error-border);
}

.status-badge.info {
  background: var(--color-semantic-info-bg);
  color: var(--color-semantic-info);
  border-color: var(--color-semantic-info-border);
}

/* Repository-specific variants */
.status-badge.private {
  background: var(--color-semantic-warning-bg);
  color: var(--color-semantic-warning);
  border-color: var(--color-semantic-warning-border);
}

.status-badge.fork {
  background: var(--color-semantic-info-bg);
  color: var(--color-semantic-info);
  border-color: var(--color-semantic-info-border);
}

.status-badge.archived {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  border-color: var(--color-border-secondary);
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .status-badge {
    border-width: 2px;
    font-weight: var(--font-weight-semibold, 600);
  }
}
</style>