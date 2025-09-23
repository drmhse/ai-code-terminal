<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div v-if="showHeader" class="modal-header">
        <h3 v-if="title" class="modal-title">{{ title }}</h3>
        <slot name="header" />
        <button v-if="showCloseButton" @click="handleClose" class="close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <slot />
      </div>

      <div v-if="showFooter" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

interface Props {
  show: boolean
  title?: string
  showHeader?: boolean
  showFooter?: boolean
  showCloseButton?: boolean
  closeOnOverlay?: boolean
  maxWidth?: string
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  showHeader: true,
  showFooter: true,
  showCloseButton: true,
  closeOnOverlay: true,
  maxWidth: '900px',
  maxHeight: '85vh'
})

const emit = defineEmits<{
  close: []
}>()

const handleClose = () => {
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    handleClose()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  if (props.show) {
    document.body.style.overflow = 'hidden'
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 1000;
  animation: fadeIn 0.25s ease-out;
  padding: var(--space-2xl, 24px);
}

.modal-content {
  background: var(--bg-primary);
  border-radius: var(--radius-xl, 16px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 8px 24px rgba(0, 0, 0, 0.2);
  max-width: v-bind('props.maxWidth');
  width: 100%;
  max-height: v-bind('props.maxHeight');
  display: grid;
  grid-template-rows: auto 1fr auto;
  animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2xl, 24px) var(--space-3xl, 32px) var(--space-xl, 20px);
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  margin: 0;
  font-size: var(--font-size-2xl, 20px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary);
  letter-spacing: -0.025em;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-sm, 8px);
  border-radius: var(--radius-md, 8px);
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  width: 32px;
  height: 32px;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  transform: scale(1.05);
}

.modal-body {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md, 12px);
  padding: var(--space-2xl, 24px) var(--space-3xl, 32px);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-content {
    margin: var(--space-lg, 16px);
    max-height: calc(100vh - 32px);
    border-radius: var(--radius-lg, 12px);
  }

  .modal-header {
    padding: var(--space-xl, 20px) var(--space-2xl, 24px) var(--space-lg, 16px);
  }

  .modal-title {
    font-size: var(--font-size-xl, 18px);
  }

  .modal-footer {
    padding: var(--space-xl, 20px) var(--space-2xl, 24px);
    flex-direction: column-reverse;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: var(--space-lg, 16px);
  }
}

/* Dark mode refinements */
@media (prefers-color-scheme: dark) {
  .modal-content {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 20px 40px rgba(0, 0, 0, 0.5),
      0 8px 24px rgba(0, 0, 0, 0.3);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .modal-content,
  .modal-overlay {
    animation-duration: 0.01ms !important;
  }

  .close-btn {
    transition: none !important;
  }
}
</style>