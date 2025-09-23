<template>
  <div
    :class="splitterClass"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
  >
    <div class="splitter-line"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  direction: 'horizontal' | 'vertical'
  index: number
}

interface Emits {
  (e: 'resize', payload: { index: number, delta: number }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const splitterClass = computed(() => ({
  'splitter': true,
  'splitter-horizontal': props.direction === 'horizontal',
  'splitter-vertical': props.direction === 'vertical'
}))

let isDragging = false
let startPos = 0

const handleMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return // Only handle left mouse button

  event.preventDefault()
  isDragging = true
  startPos = props.direction === 'horizontal' ? event.clientY : event.clientX

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const currentPos = props.direction === 'horizontal' ? e.clientY : e.clientX
    const delta = currentPos - startPos

    emit('resize', { index: props.index, delta })
    startPos = currentPos
  }

  const handleMouseUp = () => {
    isDragging = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.body.style.cursor = props.direction === 'horizontal' ? 'row-resize' : 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length !== 1) return

  event.preventDefault()
  isDragging = true
  const touch = event.touches[0]
  startPos = props.direction === 'horizontal' ? touch.clientY : touch.clientX

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return

    const touch = e.touches[0]
    const currentPos = props.direction === 'horizontal' ? touch.clientY : touch.clientX
    const delta = currentPos - startPos

    emit('resize', { index: props.index, delta })
    startPos = currentPos
  }

  const handleTouchEnd = () => {
    isDragging = false
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
  }

  document.addEventListener('touchmove', handleTouchMove)
  document.addEventListener('touchend', handleTouchEnd)
}
</script>

<style scoped>
/* Seamless splitter design like VS Code/Zed */
.splitter {
  position: relative;
  flex-shrink: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  z-index: 10;
}

/* Horizontal splitter (between vertically stacked panes) */
.splitter-horizontal {
  width: 100%;
  height: 6px; /* Larger hit area but minimal visual space */
  cursor: row-resize;
  margin: 0; /* Remove margins for seamless appearance */
}

/* Vertical splitter (between horizontally arranged panes) */
.splitter-vertical {
  height: 100%;
  width: 6px; /* Larger hit area but minimal visual space */
  cursor: col-resize;
  margin: 0; /* Remove margins for seamless appearance */
}

/* The actual visible line - invisible by default */
.splitter-line {
  position: absolute;
  background: transparent;
  transition: all 0.2s ease;
  opacity: 0;
  z-index: 1;
}

/* Horizontal line styling */
.splitter-horizontal .splitter-line {
  width: 100%;
  height: 1px;
  top: 50%;
  transform: translateY(-50%);
}

/* Vertical line styling */
.splitter-vertical .splitter-line {
  height: 100%;
  width: 1px;
  left: 50%;
  transform: translateX(-50%);
}

/* Show subtle line on hover */
.splitter:hover .splitter-line {
  background: var(--border-color, rgba(255, 255, 255, 0.3));
  opacity: 1;
}

/* Show more prominent line when dragging */
.splitter:active .splitter-line {
  background: var(--primary, #007bcc);
  opacity: 1;
  box-shadow: 0 0 4px var(--primary, #007bcc);
}

/* Hover area expansion for easier interaction */
.splitter::before {
  content: '';
  position: absolute;
  background: transparent;
  z-index: -1;
}

/* Expand horizontal splitter hover area */
.splitter-horizontal::before {
  width: 100%;
  height: 12px; /* 6px extra on each side for easier targeting */
  top: 50%;
  transform: translateY(-50%);
}

/* Expand vertical splitter hover area */
.splitter-vertical::before {
  height: 100%;
  width: 12px; /* 6px extra on each side for easier targeting */
  left: 50%;
  transform: translateX(-50%);
}

/* Subtle background highlight on hover for visual feedback */
.splitter:hover::before {
  background: var(--bg-hover, rgba(255, 255, 255, 0.02));
}

.splitter:active::before {
  background: var(--primary-alpha, rgba(0, 123, 204, 0.1));
}

/* Ensure proper pointer events */
.splitter {
  pointer-events: auto;
}

.splitter * {
  pointer-events: none;
}
</style>