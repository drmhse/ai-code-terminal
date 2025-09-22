<!--
  ACT BUTTON COMPONENT
  Theme-aware button system that leverages the comprehensive design token system
  Automatically adapts to theme changes via CSS custom properties
-->
<template>
  <component
    :is="as"
    :class="buttonClasses"
    :disabled="disabled"
    :type="type"
    :aria-label="ariaLabel"
    v-bind="$attrs"
    @click="handleClick"
  >
    <span v-if="loading" class="a-button__spinner">
      <div class="spinner"></div>
    </span>
    <span v-if="$slots.icon && !loading" class="a-button__icon">
      <slot name="icon" />
    </span>
    <span v-if="$slots.default && !iconOnly" class="a-button__text">
      <slot />
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** Button visual style variant */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'warning' | 'ghost'
  /** Button size following design system scale */
  size?: 'sm' | 'base' | 'lg'
  /** Show loading state */
  loading?: boolean
  /** Disable button interaction */
  disabled?: boolean
  /** HTML element or component to render */
  as?: string | object
  /** Button type attribute */
  type?: 'button' | 'submit' | 'reset'
  /** Icon-only button (no text) */
  iconOnly?: boolean
  /** Accessibility label */
  ariaLabel?: string
  /** Full width button */
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'base',
  loading: false,
  disabled: false,
  as: 'button',
  type: 'button',
  iconOnly: false,
  fullWidth: false
})

const emit = defineEmits<{
  click: [event: Event]
}>()

const buttonClasses = computed(() => [
  'a-button',
  `a-button--${props.variant}`,
  `a-button--${props.size}`,
  {
    'a-button--loading': props.loading,
    'a-button--disabled': props.disabled,
    'a-button--icon-only': props.iconOnly,
    'a-button--full-width': props.fullWidth
  }
])

const handleClick = (event: Event) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped>
/* ===== BUTTON BASE STYLES ===== */
.a-button {
  /* Layout - inline-flex works for both buttons and anchors */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  position: relative;

  /* Typography - uses design tokens */
  font-family: var(--font-family-sans);
  font-weight: var(--button-font-weight);
  font-size: inherit;
  line-height: inherit;
  text-decoration: none; /* Remove underlines from anchors */
  white-space: nowrap;

  /* Interaction */
  cursor: pointer;
  user-select: none;
  transition: all var(--transition-fast);

  /* Border and radius from design tokens */
  border: 1px solid transparent;
  border-radius: var(--button-border-radius);

  /* Remove default button styles */
  background: none;
  outline: none;

  /* Ensure consistent box model for buttons and anchors */
  box-sizing: border-box;

  /* Focus state using theme-aware colors */
  &:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  /* Ensure anchors behave like buttons */
  &:hover {
    text-decoration: none; /* Prevent anchor hover underlines */
  }

  /* Handle visited state for anchors */
  &:visited {
    color: inherit; /* Don't change color for visited links */
  }
}

/* ===== SIZE VARIANTS ===== */
.a-button--sm {
  height: var(--button-height-sm);
  padding: 0 var(--button-padding-x-sm);
  font-size: var(--button-font-size-sm);
}

.a-button--base {
  height: var(--button-height-base);
  padding: 0 var(--button-padding-x-base);
  font-size: var(--button-font-size-base);
}

.a-button--lg {
  height: var(--button-height-lg);
  padding: 0 var(--button-padding-x-lg);
  font-size: var(--button-font-size-lg);
}

/* Icon-only buttons use square dimensions */
.a-button--icon-only {
  aspect-ratio: 1;
  padding: 0;
}

/* ===== PRIMARY VARIANT ===== */
.a-button--primary {
  background: var(--color-interactive-primary);
  border-color: var(--color-interactive-primary);
  color: var(--color-text-inverse);

  &:hover:not(.a-button--disabled):not(.a-button--loading) {
    background: var(--color-interactive-primary-hover);
    border-color: var(--color-interactive-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(.a-button--disabled):not(.a-button--loading) {
    background: var(--color-interactive-primary-active);
    border-color: var(--color-interactive-primary-active);
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }
}

/* ===== SECONDARY VARIANT ===== */
.a-button--secondary {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-primary);
  color: var(--color-text-primary);

  &:hover:not(.a-button--disabled):not(.a-button--loading) {
    background: var(--color-interactive-tertiary-hover);
    border-color: var(--color-border-hover);
    color: var(--color-text-primary);
  }

  &:active:not(.a-button--disabled):not(.a-button--loading) {
    background: var(--color-bg-quaternary);
    transform: translateY(0);
  }
}

/* ===== TERTIARY VARIANT ===== */
.a-button--tertiary {
  background: transparent;
  border-color: transparent;
  color: var(--color-text-secondary);

  &:hover:not(.a-button--disabled):not(.a-button--loading) {
    background: var(--color-interactive-tertiary-hover);
    color: var(--color-text-primary);
  }
}

/* ===== GHOST VARIANT ===== */
.a-button--ghost {
  background: transparent;
  border-color: var(--color-border-primary);
  color: var(--color-text-secondary);

  &:hover:not(.a-button--disabled):not(.a-button--loading) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
    color: var(--color-text-primary);
  }
}

/* ===== SEMANTIC VARIANTS ===== */
.a-button--danger {
  background: var(--color-semantic-error);
  border-color: var(--color-semantic-error);
  color: var(--color-text-inverse);

  &:hover:not(.a-button--disabled):not(.a-button--loading) {
    background: color-mix(in srgb, var(--color-semantic-error) 85%, black);
    border-color: color-mix(in srgb, var(--color-semantic-error) 85%, black);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
}

.a-button--success {
  background: var(--color-semantic-success);
  border-color: var(--color-semantic-success);
  color: var(--color-text-inverse);

  &:hover:not(.a-button--disabled):not(.a-button--loading) {
    background: color-mix(in srgb, var(--color-semantic-success) 85%, black);
    border-color: color-mix(in srgb, var(--color-semantic-success) 85%, black);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
}

.a-button--warning {
  background: var(--color-semantic-warning);
  border-color: var(--color-semantic-warning);
  color: var(--color-text-inverse);

  &:hover:not(.a-button--disabled):not(.a-button--loading) {
    background: color-mix(in srgb, var(--color-semantic-warning) 85%, black);
    border-color: color-mix(in srgb, var(--color-semantic-warning) 85%, black);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
}

/* ===== STATE VARIANTS ===== */
.a-button--disabled {
  background: var(--color-interactive-primary-disabled) !important;
  border-color: var(--color-interactive-primary-disabled) !important;
  color: var(--color-text-disabled) !important;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.a-button--loading {
  cursor: wait;

  .a-button__text {
    opacity: 0.7;
  }
}

.a-button--full-width {
  width: 100%;
}

/* ===== INTERNAL ELEMENTS ===== */
.a-button__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.a-button__text {
  flex: 1;
  min-width: 0;
}

.a-button__spinner {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

/* ===== LOADING SPINNER ===== */
.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== RESPONSIVE ADAPTATIONS ===== */
@media (max-width: 640px) {
  .a-button--base {
    height: var(--button-height-sm);
    padding: 0 var(--button-padding-x-sm);
    font-size: var(--button-font-size-sm);
  }

  .a-button--lg {
    height: var(--button-height-base);
    padding: 0 var(--button-padding-x-base);
    font-size: var(--button-font-size-base);
  }
}
</style>