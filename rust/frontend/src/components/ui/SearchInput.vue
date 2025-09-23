<template>
  <div class="search-input-container">
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="search-icon"
    >
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>

    <input
      v-model="localValue"
      @input="handleInput"
      @keydown.enter="handleEnter"
      @keydown.escape="handleEscape"
      type="text"
      :placeholder="placeholder"
      class="search-input"
      :disabled="disabled"
      :class="{ 'has-value': hasValue }"
    >

    <button
      v-if="hasValue && showClear"
      @click="handleClear"
      class="search-clear"
      :disabled="disabled"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
  showClear?: boolean
  debounceMs?: number
  maxWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search...',
  showClear: true,
  debounceMs: 300,
  maxWidth: '500px'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [value: string]
  enter: [value: string]
  clear: []
  escape: []
}>()

const localValue = ref(props.modelValue)
let debounceTimeout: ReturnType<typeof setTimeout> | null = null

const hasValue = computed(() => localValue.value.length > 0)

const handleInput = () => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }

  debounceTimeout = setTimeout(() => {
    emit('update:modelValue', localValue.value)
    emit('input', localValue.value)
  }, props.debounceMs)
}

const handleEnter = () => {
  emit('enter', localValue.value)
}

const handleEscape = () => {
  emit('escape')
}

const handleClear = () => {
  localValue.value = ''
  emit('update:modelValue', '')
  emit('clear')
}

// Sync with external changes
watch(() => props.modelValue, (newValue) => {
  localValue.value = newValue
})
</script>

<style scoped>
.search-input-container {
  position: relative;
  max-width: v-bind('props.maxWidth');
  width: 100%;
}

.search-icon {
  position: absolute;
  left: var(--space-lg, 16px);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
  z-index: 2;
  transition: color 0.2s ease;
}

.search-input {
  width: 100%;
  padding: var(--space-lg, 16px) var(--space-lg, 16px) var(--space-lg, 16px) var(--space-4xl, 40px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg, 12px);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-base, 14px);
  outline: none;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  font-family: inherit;
}

.search-input:focus {
  border-color: var(--primary);
  box-shadow:
    0 0 0 3px rgba(var(--primary-rgb, 59, 130, 246), 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1);
  background: var(--bg-primary);
}

.search-input:focus + .search-icon {
  color: var(--primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-tertiary);
}

.search-input.has-value {
  padding-right: var(--space-4xl, 40px);
}

.search-clear {
  position: absolute;
  right: var(--space-lg, 16px);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-xs, 4px);
  border-radius: var(--radius-sm, 6px);
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  z-index: 2;
  width: 24px;
  height: 24px;
}

.search-clear:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transform: translateY(-50%) scale(1.1);
}

.search-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Focus states */
.search-input-container:focus-within .search-icon {
  color: var(--primary);
}

/* Responsive Design */
@media (max-width: 480px) {
  .search-input-container {
    max-width: none;
  }

  .search-input {
    padding: var(--space-md, 12px) var(--space-md, 12px) var(--space-md, 12px) var(--space-3xl, 32px);
  }

  .search-input.has-value {
    padding-right: var(--space-3xl, 32px);
  }

  .search-icon {
    left: var(--space-md, 12px);
  }

  .search-clear {
    right: var(--space-md, 12px);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .search-input {
    border-width: 2px;
  }

  .search-input:focus {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .search-input,
  .search-icon,
  .search-clear {
    transition: none !important;
  }
}
</style>