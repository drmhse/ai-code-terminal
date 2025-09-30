<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
        <Transition name="modal-scale">
          <div v-if="show" class="modal-container" :class="sizeClass" @click.stop>
            <!-- Header -->
            <div v-if="showHeader" class="modal-header">
              <div class="modal-header-content">
                <slot name="header-icon">
                  <div v-if="headerIcon" class="header-icon" v-html="headerIcon"></div>
                </slot>
                <div class="header-text">
                  <h2 v-if="title" class="modal-title">{{ title }}</h2>
                  <slot name="header" />
                  <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
                </div>
              </div>
              <button
                v-if="showCloseButton"
                class="close-button"
                @click="handleClose"
                :aria-label="closeLabel"
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- Tabs/Subtabs (optional) -->
            <div v-if="$slots.tabs" class="modal-tabs">
              <slot name="tabs" />
            </div>

            <!-- Body -->
            <div class="modal-body" :class="{ 'has-footer': showFooter && $slots.footer }">
              <slot />
            </div>

            <!-- Footer -->
            <div v-if="showFooter && $slots.footer" class="modal-footer">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'

interface Props {
  show: boolean
  title?: string
  subtitle?: string
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  showHeader?: boolean
  showFooter?: boolean
  showCloseButton?: boolean
  closeOnOverlay?: boolean
  closeLabel?: string
  headerIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  subtitle: undefined,
  size: 'medium',
  showHeader: true,
  showFooter: true,
  showCloseButton: true,
  closeOnOverlay: true,
  closeLabel: 'Close modal',
  headerIcon: undefined
})

const emit = defineEmits<{
  close: []
}>()

const sizeClass = computed(() => `modal-${props.size}`)

const handleClose = () => {
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    handleClose()
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    handleClose()
  }
}

watch(() => props.show, (newShow) => {
  if (newShow) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* ===== MODAL OVERLAY (Atlassian-style backdrop) ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

/* ===== MODAL CONTAINER (Atlassian card design) ===== */
.modal-container {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--space-8));
  width: 100%;
  overflow: hidden;
}

/* Modal sizes - Atlassian standard widths */
.modal-small {
  max-width: 400px;
}

.modal-medium {
  max-width: 560px;
}

.modal-large {
  max-width: 720px;
}

.modal-xlarge {
  max-width: 960px;
}

/* ===== MODAL HEADER (Atlassian style) ===== */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--color-border-secondary);
  flex-shrink: 0;
  gap: var(--space-4);
}

.modal-header-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.header-icon {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  width: 24px;
  height: 24px;
}

.header-icon svg {
  width: 20px;
  height: 20px;
}

.header-text {
  flex: 1;
  min-width: 0;
}

.modal-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.modal-subtitle {
  margin: var(--space-1) 0 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.close-button {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-base);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.close-button:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}

.close-button:active {
  transform: scale(0.95);
}

/* ===== MODAL TABS ===== */
.modal-tabs {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-secondary);
  background: var(--color-bg-secondary);
}

/* ===== MODAL BODY ===== */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  min-height: 0;
}

.modal-body.has-footer {
  padding-bottom: var(--space-5);
}

/* ===== MODAL FOOTER (Atlassian action bar) ===== */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--color-border-secondary);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}

/* ===== ANIMATIONS ===== */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--transition-smooth);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: all var(--transition-smooth);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .modal-overlay {
    padding: var(--space-2);
  }

  .modal-container {
    max-height: calc(100vh - var(--space-4));
  }

  .modal-header {
    padding: var(--space-4);
  }

  .modal-body {
    padding: var(--space-4);
  }

  .modal-footer {
    padding: var(--space-4);
    flex-direction: column-reverse;
  }

  .modal-footer > * {
    width: 100%;
  }
}

/* ===== ACCESSIBILITY ===== */
.close-button:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-scale-enter-active,
  .modal-scale-leave-active,
  .close-button {
    transition: none !important;
  }
}
</style>