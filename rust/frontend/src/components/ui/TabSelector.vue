<template>
  <div class="tab-selector">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      @click="handleTabChange(tab.value)"
      class="tab-button"
      :class="{ active: tab.value === modelValue }"
      :disabled="tab.disabled"
    >
      <component
        v-if="tab.icon"
        :is="tab.icon"
        class="tab-icon"
      />
      <svg
        v-else-if="tab.iconSvg"
        v-html="tab.iconSvg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="tab-icon"
      />
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
export interface Tab {
  value: string
  label: string
  icon?: Component
  iconSvg?: string
  disabled?: boolean
}

interface Props {
  tabs: Tab[]
  modelValue: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const handleTabChange = (value: string) => {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.tab-selector {
  display: flex;
  gap: var(--space-xs, 4px);
  padding: 0 var(--space-3xl, 32px);
  margin-bottom: var(--space-lg, 16px);
}

.tab-button {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 8px);
  padding: var(--space-md, 12px) var(--space-xl, 20px);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-medium, 500);
  cursor: pointer;
  border-radius: var(--radius-lg, 12px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  white-space: nowrap;
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

.tab-button:hover:not(:disabled) {
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

.tab-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.tab-button:disabled:hover {
  color: var(--text-muted);
  border-color: transparent;
  background: transparent;
  transform: none;
}

.tab-icon,
.tab-label {
  position: relative;
  z-index: 1;
}

.tab-icon {
  flex-shrink: 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .tab-selector {
    padding: 0 var(--space-2xl, 24px);
    flex-direction: column;
    gap: var(--space-sm, 8px);
  }

  .tab-button {
    justify-content: center;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .tab-button.active {
    border: 2px solid var(--primary);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .tab-button {
    transition: none !important;
  }

  .tab-button::before {
    transition: none !important;
  }
}
</style>