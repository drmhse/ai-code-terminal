<template>
  <Splitter
    direction="vertical"
    :index="index"
    @resize="$emit('resize', $event)"
    class="layout-splitter"
  />
</template>

<script setup lang="ts">
import Splitter from './LayoutSplitter.vue'

interface Props {
  index?: number
}

interface Emits {
  (e: 'resize', payload: { index: number, delta: number }): void
}

// Props with default
// Props are defined but not used - keeping for API consistency
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = withDefaults(defineProps<Props>(), {
  index: 0
})

// Emits
defineEmits<Emits>()
</script>

<style scoped>
/* Enhanced styling for main layout splitters */
.layout-splitter {
  /* Override base splitter styles for layout-specific behavior */
  background: var(--color-border-primary);
  transition: all 0.2s ease;
  z-index: 10; /* Ensure splitter is above content but below modals */
}

.layout-splitter:hover {
  background: var(--color-primary);
  box-shadow: 0 0 4px rgba(var(--color-primary-rgb), 0.3);
}

.layout-splitter:active {
  background: var(--color-primary);
  box-shadow: 0 0 6px rgba(var(--color-primary-rgb), 0.5);
}

/* Enhance the splitter line for main layout */
.layout-splitter :deep(.splitter-line) {
  background: var(--color-border-primary);
  transition: all 0.2s ease;
}

.layout-splitter:hover :deep(.splitter-line) {
  background: var(--color-primary);
  box-shadow: 0 0 2px var(--color-primary);
}

.layout-splitter:active :deep(.splitter-line) {
  background: var(--color-primary);
  box-shadow: 0 0 4px var(--color-primary);
}

/* Ensure smooth cursor transitions */
.layout-splitter {
  cursor: col-resize;
}

/* Enhanced hover area for easier interaction (matches parent Splitter component) */
.layout-splitter::before {
  content: '';
  position: absolute;
  width: 8px; /* 4px extra on each side */
  height: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: transparent;
  z-index: -1;
}

.layout-splitter:hover::before {
  background: rgba(var(--color-primary-rgb), 0.05);
}

.layout-splitter:active::before {
  background: rgba(var(--color-primary-rgb), 0.1);
}
</style>