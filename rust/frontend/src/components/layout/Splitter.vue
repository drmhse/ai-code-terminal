<template>
  <div
    :class="splitterClass"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
  >
    <div class="splitter-handle">
      <div class="splitter-grip">
        <div class="grip-dot"></div>
        <div class="grip-dot"></div>
        <div class="grip-dot"></div>
      </div>
    </div>
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
.splitter {
  position: relative;
  flex-shrink: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.splitter-horizontal {
  width: 100%;
  height: 8px;
  cursor: row-resize;
  margin: 2px 0;
}

.splitter-vertical {
  height: 100%;
  width: 8px;
  cursor: col-resize;
  margin: 0 2px;
}

.splitter:hover {
  background-color: var(--border-hover, rgba(255, 255, 255, 0.1));
}

.splitter:active,
.splitter:hover .splitter-handle {
  background-color: var(--primary, #007bcc);
}

.splitter-handle {
  position: relative;
  background-color: var(--border-color, rgba(255, 255, 255, 0.2));
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.splitter-horizontal .splitter-handle {
  width: 60px;
  height: 4px;
}

.splitter-vertical .splitter-handle {
  width: 4px;
  height: 60px;
}

.splitter-grip {
  display: flex;
  gap: 3px;
}

.splitter-horizontal .splitter-grip {
  flex-direction: row;
}

.splitter-vertical .splitter-grip {
  flex-direction: column;
}

.grip-dot {
  width: 4px;
  height: 4px;
  background-color: var(--text-muted, rgba(255, 255, 255, 0.4));
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.splitter:hover .grip-dot,
.splitter:active .grip-dot {
  background-color: var(--text-primary, #ffffff);
}

/* Ensure splitter doesn't interfere with content */
.splitter * {
  pointer-events: none;
}

.splitter {
  pointer-events: auto;
}

/* Visual feedback during resize */
.splitter:active {
  background-color: var(--primary-alpha, rgba(0, 123, 204, 0.1));
}

.splitter:active .splitter-handle {
  transform: scale(1.1);
  box-shadow: 0 0 8px var(--primary-alpha, rgba(0, 123, 204, 0.3));
}
</style>