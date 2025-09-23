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
interface Props {
  text: string
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'private' | 'fork' | 'archived'
  size?: 'small' | 'medium'
  icon?: any
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
  background: rgba(var(--primary-rgb, 59, 130, 246), 0.1);
  color: var(--primary);
  border-color: rgba(var(--primary-rgb, 59, 130, 246), 0.2);
}

.status-badge.secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-color: var(--border-color);
}

.status-badge.success {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  border-color: rgba(34, 197, 94, 0.2);
}

.status-badge.warning {
  background: rgba(245, 158, 11, 0.1);
  color: rgb(245, 158, 11);
  border-color: rgba(245, 158, 11, 0.2);
}

.status-badge.error {
  background: rgba(var(--error-rgb, 239, 68, 68), 0.1);
  color: var(--error);
  border-color: rgba(var(--error-rgb, 239, 68, 68), 0.2);
}

.status-badge.info {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  border-color: rgba(59, 130, 246, 0.2);
}

/* Repository-specific variants */
.status-badge.private {
  background: rgba(245, 158, 11, 0.1);
  color: rgb(245, 158, 11);
  border-color: rgba(245, 158, 11, 0.2);
}

.status-badge.fork {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  border-color: rgba(59, 130, 246, 0.2);
}

.status-badge.archived {
  background: rgba(107, 114, 128, 0.1);
  color: rgb(107, 114, 128);
  border-color: rgba(107, 114, 128, 0.2);
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .status-badge {
    border-width: 2px;
    font-weight: var(--font-weight-semibold, 600);
  }
}
</style>