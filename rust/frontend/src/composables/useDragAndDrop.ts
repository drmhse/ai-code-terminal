import { ref, computed } from 'vue'
import { useTerminalStore } from '@/stores/terminal'
import type { TerminalTab } from '@/stores/terminal'

interface DragState {
  isDragging: boolean
  draggedItem: TerminalTab | null
  dragOverTarget: string | null
  dragStartPosition: { x: number; y: number } | null
  dragOffset: { x: number; y: number } | null
}

/**
 * Drag and drop composable for terminal tabs and file operations
 */
export function useDragAndDrop() {
  const terminalStore = useTerminalStore()
  
  const dragState = ref<DragState>({
    isDragging: false,
    draggedItem: null,
    dragOverTarget: null,
    dragStartPosition: null,
    dragOffset: null
  })

  const isDragging = computed(() => dragState.value.isDragging)
  const draggedItem = computed(() => dragState.value.draggedItem)
  const dragOverTarget = computed(() => dragState.value.dragOverTarget)

  // Terminal tab drag handlers
  const startTerminalTabDrag = (event: DragEvent, tab: TerminalTab) => {
    if (!event.dataTransfer) return

    dragState.value = {
      isDragging: true,
      draggedItem: tab,
      dragOverTarget: null,
      dragStartPosition: { x: event.clientX, y: event.clientY },
      dragOffset: null
    }

    // Set drag data
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'terminal-tab',
      tabId: tab.sessionId
    }))

    // Add dragging class to body for global styling
    document.body.classList.add('dragging-terminal-tab')

    // Store drag state for global access
    terminalStore.setDragState({
      isDragging: true,
      draggedTabId: tab.sessionId
    })
  }

  const handleTerminalTabDragOver = (event: DragEvent, targetTabId: string) => {
    event.preventDefault()
    if (!dragState.value.isDragging || !dragState.value.draggedItem) return

    // Don't allow drop on self
    if (dragState.value.draggedItem.sessionId === targetTabId) return

    event.dataTransfer!.dropEffect = 'move'
    dragState.value.dragOverTarget = targetTabId
  }

  const handleTerminalTabDrop = (event: DragEvent, targetTabId: string) => {
    event.preventDefault()
    
    if (!dragState.value.draggedItem) return

    const draggedTabId = dragState.value.draggedItem.sessionId
    
    // Reorder tabs
    terminalStore.reorderTab(draggedTabId, targetTabId)
    
    // Reset drag state
    endDrag()
  }

  const handleTerminalTabDragLeave = () => {
    dragState.value.dragOverTarget = null
  }

  // File drag handlers (for file uploads/moves)
  const handleFileDragEnter = (event: DragEvent, targetPath: string) => {
    event.preventDefault()
    
    // Check if dragging files from outside
    if (event.dataTransfer?.items) {
      const hasFiles = Array.from(event.dataTransfer.items).some(
        item => item.kind === 'file'
      )
      
      if (hasFiles) {
        dragState.value.dragOverTarget = targetPath
      }
    }
  }

  const handleFileDragOver = (event: DragEvent, targetPath: string) => {
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'copy'
    dragState.value.dragOverTarget = targetPath
  }

  const handleFileDrop = async (event: DragEvent, targetPath: string) => {
    event.preventDefault()
    
    if (!event.dataTransfer?.files) return

    const files = Array.from(event.dataTransfer.files)
    
    // Handle file uploads
    for (const file of files) {
      try {
        await uploadFile(file, targetPath)
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
      }
    }
    
    endDrag()
  }

  const handleFileDragLeave = (event: DragEvent) => {
    // Only reset if we're leaving the drop zone entirely
    if (!(event.currentTarget as Element)?.contains(event.relatedTarget as Node)) {
      dragState.value.dragOverTarget = null
    }
  }

  // Drag end handler
  const endDrag = () => {
    dragState.value = {
      isDragging: false,
      draggedItem: null,
      dragOverTarget: null,
      dragStartPosition: null,
      dragOffset: null
    }

    // Remove dragging classes
    document.body.classList.remove('dragging-terminal-tab', 'dragging-file')
    
    // Reset terminal store drag state
    terminalStore.setDragState({
      isDragging: false,
      draggedTabId: null
    })
  }

  // File upload helper
  const uploadFile = async (file: File, targetPath: string): Promise<void> => {
    // Create FormData for file upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('targetPath', targetPath)

    // This would typically make an API call
    // For now, we'll just simulate the upload
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          console.log(`Uploaded ${file.name} to ${targetPath}`)
          resolve()
        } else {
          reject(new Error('Upload failed'))
        }
      }, 1000)
    })
  }

  // Touch support for mobile drag and drop
  const handleTouchStart = (event: TouchEvent, item: TerminalTab) => {
    if (!item) return

    const touch = event.touches[0]
    dragState.value.dragStartPosition = { x: touch.clientX, y: touch.clientY }
    dragState.value.draggedItem = item as TerminalTab

    // Add visual feedback
    (event.currentTarget as Element)?.classList.add('touch-dragging')
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (!dragState.value.draggedItem || !dragState.value.dragStartPosition) return

    event.preventDefault()
    const touch = event.touches[0]
    
    dragState.value.dragOffset = {
      x: touch.clientX - dragState.value.dragStartPosition.x,
      y: touch.clientY - dragState.value.dragStartPosition.y
    }

    // Update dragging state
    dragState.value.isDragging = Math.abs(dragState.value.dragOffset.x) > 10 || 
                                Math.abs(dragState.value.dragOffset.y) > 10
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (!dragState.value.isDragging || !dragState.value.draggedItem) {
      endTouchDrag()
      return
    }

    // Find drop target based on touch position
    const touch = event.changedTouches[0]
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY)
    const dropTarget = elementBelow?.closest('[data-tab-id]')
    
    if (dropTarget && dropTarget.getAttribute('data-tab-id') !== dragState.value.draggedItem.sessionId) {
      const targetTabId = dropTarget.getAttribute('data-tab-id')!
      terminalStore.reorderTab(dragState.value.draggedItem.sessionId, targetTabId)
    }

    endTouchDrag()
  }

  const endTouchDrag = () => {
    // Remove visual feedback
    document.querySelectorAll('.touch-dragging').forEach(el => {
      el.classList.remove('touch-dragging')
    })
    
    endDrag()
  }

  // Keyboard accessibility for drag and drop
  const handleKeyboardDrag = (event: KeyboardEvent, tab: TerminalTab) => {
    if (!['ArrowLeft', 'ArrowRight', 'Enter', 'Space'].includes(event.key)) return

    event.preventDefault()

    switch (event.key) {
      case 'ArrowLeft':
        terminalStore.moveTabLeft(tab.sessionId)
        break
      case 'ArrowRight':
        terminalStore.moveTabRight(tab.sessionId)
        break
      case 'Enter':
      case 'Space':
        // Toggle selection for keyboard users
        terminalStore.selectTab(tab.sessionId)
        break
    }
  }

  // Visual feedback helpers
  const getDragPreviewStyle = () => {
    if (!dragState.value.isDragging || !dragState.value.dragOffset) {
      return {}
    }

    return {
      transform: `translate(${dragState.value.dragOffset.x}px, ${dragState.value.dragOffset.y}px)`,
      opacity: '0.8',
      zIndex: '1000'
    }
  }

  const getDropZoneClasses = (targetId: string) => {
    const classes: string[] = []
    
    if (dragState.value.dragOverTarget === targetId) {
      classes.push('drag-over')
    }
    
    if (dragState.value.isDragging) {
      classes.push('drag-active')
    }
    
    return classes
  }

  return {
    // State
    isDragging,
    draggedItem,
    dragOverTarget,
    dragState: dragState.value,

    // Terminal tab drag handlers
    startTerminalTabDrag,
    handleTerminalTabDragOver,
    handleTerminalTabDrop,
    handleTerminalTabDragLeave,

    // File drag handlers
    handleFileDragEnter,
    handleFileDragOver,
    handleFileDrop,
    handleFileDragLeave,

    // Touch handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,

    // Keyboard accessibility
    handleKeyboardDrag,

    // Utilities
    endDrag,
    getDragPreviewStyle,
    getDropZoneClasses
  }
}

// CSS classes for drag and drop styling
export const dragDropStyles = `
  .dragging-terminal-tab * {
    cursor: move !important;
  }
  
  .drag-over {
    background: var(--primary) !important;
    opacity: 0.3;
  }
  
  .drag-active {
    transition: all 0.2s ease;
  }
  
  .touch-dragging {
    transform: scale(1.05);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    transition: none;
  }
  
  [draggable="true"] {
    cursor: grab;
  }
  
  [draggable="true"]:active {
    cursor: grabbing;
  }
`