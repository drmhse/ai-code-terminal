<template>
  <div class="mobile-interface">
    <!-- Mobile Actions Menu -->
    <Transition name="mobile-menu" appear>
      <div 
        v-if="uiStore.showMobileActionsMenu" 
        class="mobile-actions-menu"
        @click.stop
      >
        <div class="mobile-menu-header">
          <h3>Quick Actions</h3>
          <button @click="uiStore.closeMobileActionsMenu" class="close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="mobile-menu-tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="uiStore.setActiveTab(tab.id)"
            class="tab-btn"
            :class="{ active: uiStore.activeTab === tab.id }"
          >
            <component :is="tab.icon" />
            {{ tab.label }}
          </button>
        </div>
        
        <div class="mobile-menu-content">
          <!-- Actions Tab -->
          <div v-if="uiStore.activeTab === 'actions'" class="tab-content">
            <div class="quick-actions-grid">
              <button 
                v-for="action in uiStore.quickActions" 
                :key="action.key"
                @click="sendKey(action.key)"
                class="quick-action-btn"
                :title="action.description"
              >
                <span class="action-label">{{ action.label }}</span>
                <span class="action-desc">{{ action.description }}</span>
              </button>
            </div>
          </div>
          
          <!-- Commands Tab -->
          <div v-if="uiStore.activeTab === 'commands'" class="tab-content">
            <div class="command-search">
              <input 
                v-model="commandSearch"
                type="text" 
                placeholder="Search commands..." 
                class="search-input"
              >
            </div>
            <div class="commands-list">
              <button 
                v-for="command in filteredCommands" 
                :key="command.command"
                @click="runCommand(command.command)"
                class="command-btn"
              >
                <span class="command-text">{{ command.command }}</span>
                <span class="command-desc">{{ command.description }}</span>
              </button>
            </div>
          </div>
          
          <!-- Keys Tab -->
          <div v-if="uiStore.activeTab === 'keys'" class="tab-content">
            <div class="modifier-keys">
              <button 
                v-for="modifier in (['ctrl', 'alt', 'shift'] as const)" 
                :key="modifier"
                @click="uiStore.toggleModifier(modifier)"
                class="modifier-btn"
                :class="{ active: uiStore.activeModifiers[modifier] }"
              >
                {{ modifier.toUpperCase() }}
              </button>
            </div>
            
            <div class="letter-grid">
              <button 
                v-for="letter in uiStore.frequentLetters" 
                :key="letter"
                @click="sendLetter(letter)"
                class="letter-btn"
              >
                {{ letter }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- Mobile Input Proxy -->
    <Transition name="mobile-input" appear>
      <div 
        v-if="uiStore.mobileInputOpen"
        class="mobile-input-proxy"
        @click.stop
      >
        <div class="input-header">
          <span class="input-title">Terminal Input</span>
          <button @click="uiStore.closeMobileInput" class="input-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="input-modifiers">
          <button 
            v-for="modifier in (['ctrl', 'alt', 'shift'] as const)" 
            :key="modifier"
            @click="uiStore.toggleModifier(modifier)"
            class="modifier-chip"
            :class="{ active: uiStore.activeModifiers[modifier] }"
          >
            {{ modifier }}
          </button>
        </div>
        
        <textarea 
          v-model="uiStore.mobileInputText"
          @input="handleInputChange"
          @keydown="handleKeyDown"
          class="mobile-textarea"
          placeholder="Type here and tap Send..."
          autofocus
        ></textarea>
        
        <div class="input-actions">
          <button @click="clearInput" class="input-btn secondary">
            Clear
          </button>
          <button @click="sendInput" class="input-btn primary">
            Send
          </button>
        </div>
      </div>
    </Transition>
    
    <!-- Floating Action Buttons -->
    <div class="fab-container">
      <!-- Secondary FABs -->
      <Transition name="fab-secondary" appear>
        <div v-if="uiStore.showSecondaryFAB" class="secondary-fabs">
          <button @click="uiStore.openMobileInput" class="fab secondary" title="Open Input">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </button>
          
          <button @click="uiStore.toggleSidebar" class="fab secondary" title="Toggle Sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
          
          <button @click="refreshFiles" class="fab secondary" title="Refresh Files">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23,4 23,10 17,10"></polyline>
              <polyline points="1,20 1,14 7,14"></polyline>
              <path d="m3.51,9a9,9 0 0,1,14.85-3.36L23,10M1,14l4.64,4.36A9,9 0 0,0,20.49,15"></path>
            </svg>
          </button>
        </div>
      </Transition>
      
      <!-- Primary FAB -->
      <button 
        @click="uiStore.toggleMobileActionsMenu" 
        class="fab primary"
        :class="{ 'fab-rotated': uiStore.showMobileActionsMenu }"
        title="Quick Actions"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
    
    <!-- Touch Gesture Overlay -->
    <div 
      v-if="uiStore.contextualMode"
      class="gesture-overlay"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      @touchmove.prevent
    >
      <div v-if="uiStore.overlayExpanded" class="overlay-hint">
        <span>Swipe down to collapse</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useFileOperations } from '@/composables/useFileOperations'

const uiStore = useUIStore()
const fileOperations = useFileOperations()

// Component state
const commandSearch = ref('')

// Tab configuration
const tabs = [
  {
    id: 'actions' as const,
    label: 'Actions',
    icon: 'ActionIcon'
  },
  {
    id: 'commands' as const,
    label: 'Commands', 
    icon: 'CommandIcon'
  },
  {
    id: 'keys' as const,
    label: 'Keys',
    icon: 'KeyIcon'
  }
]

// Computed properties
const filteredCommands = computed(() => {
  if (!commandSearch.value.trim()) {
    return uiStore.commonCommands.slice(0, 8) // Show top 8
  }
  
  const search = commandSearch.value.toLowerCase()
  return uiStore.commonCommands.filter(cmd => 
    cmd.command.toLowerCase().includes(search) ||
    cmd.description.toLowerCase().includes(search)
  )
})

// Methods
const sendKey = (key: string) => {
  // This would send the key event to the active terminal
  console.log('Sending key:', key)
  
  // Apply modifiers if active
  const modifiers = uiStore.activeModifiers
  const keyEvent = {
    key,
    ctrlKey: modifiers.ctrl,
    altKey: modifiers.alt,
    shiftKey: modifiers.shift
  }
  
  console.log('Key event:', keyEvent)
  
  // Clear modifiers after use
  uiStore.clearModifiers()
}

const sendLetter = (letter: string) => {
  // Apply modifiers and send letter
  sendKey(letter.toLowerCase())
}

const runCommand = (command: string) => {
  // This would send the command to the active terminal
  console.log('Running command:', command)
  
  uiStore.addToCommandHistory(command)
  uiStore.closeMobileActionsMenu()
  
  // Show notification
  uiStore.addResourceAlert({
    type: 'info',
    title: 'Command Executed',
    message: command
  })
}

const handleInputChange = () => {
  // Real-time input handling if needed
}

const handleKeyDown = (event: KeyboardEvent) => {
  // Handle special keys in mobile input
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    sendInput()
  }
}

const clearInput = () => {
  uiStore.updateMobileInputText('')
}

const sendInput = () => {
  if (!uiStore.mobileInputText.trim()) return
  
  const text = uiStore.mobileInputText
  const modifiers = uiStore.activeModifiers
  
  console.log('Sending input:', text, 'with modifiers:', modifiers)
  
  // Add to command history if it looks like a command
  if (text.trim().split(' ').length <= 3) {
    uiStore.addToCommandHistory(text.trim())
  }
  
  uiStore.closeMobileInput()
  uiStore.clearModifiers()
  
  // Show notification
  uiStore.addResourceAlert({
    type: 'info',
    title: 'Input Sent',
    message: text
  })
}

const refreshFiles = async () => {
  try {
    await fileOperations.refreshFiles()
    uiStore.toggleSecondaryFAB() // Close secondary FABs
    
    uiStore.addResourceAlert({
      type: 'info',
      title: 'Files Refreshed',
      message: 'File tree has been updated'
    })
  } catch (err) {
    console.error('Failed to refresh files:', err)
  }
}

const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length === 1) {
    const touch = event.touches[0]
    uiStore.handleTouchStart(touch.clientY)
  }
}

const handleTouchEnd = (event: TouchEvent) => {
  if (event.changedTouches.length === 1) {
    const touch = event.changedTouches[0]
    uiStore.handleTouchEnd(touch.clientY)
  }
}
</script>

<style scoped>
.mobile-interface {
  position: relative;
  pointer-events: none;
}

.mobile-interface > * {
  pointer-events: auto;
}

/* Mobile Actions Menu */
.mobile-actions-menu {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.1);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  z-index: 2000;
}

.mobile-menu-header {
  display: flex;
  align-items: center;
  justify-content: between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.mobile-menu-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.mobile-menu-tabs {
  display: flex;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 12px 16px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.tab-btn.active {
  color: var(--primary);
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--primary);
}

.mobile-menu-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tab-content {
  height: 100%;
}

/* Quick Actions Grid */
.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.quick-action-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.quick-action-btn:active {
  transform: scale(0.95);
  background: var(--bg-tertiary);
}

.action-label {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.action-desc {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}

/* Commands */
.command-search {
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 16px;
}

.commands-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.command-btn:active {
  transform: scale(0.98);
  background: var(--bg-tertiary);
}

.command-text {
  display: block;
  font-family: monospace;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
  margin-bottom: 4px;
}

.command-desc {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
}

/* Keys Tab */
.modifier-keys {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.modifier-btn {
  flex: 1;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.modifier-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.letter-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.letter-btn {
  aspect-ratio: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.letter-btn:active {
  transform: scale(0.9);
  background: var(--bg-tertiary);
}

/* Mobile Input Proxy */
.mobile-input-proxy {
  position: fixed;
  top: 20px;
  left: 20px;
  right: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow);
  z-index: 2100;
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.input-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.input-title {
  font-weight: 600;
  color: var(--text-primary);
}

.input-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.input-modifiers {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.modifier-chip {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modifier-chip.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.mobile-textarea {
  flex: 1;
  border: none;
  outline: none;
  padding: 16px;
  background: transparent;
  color: var(--text-primary);
  font-size: 16px;
  font-family: monospace;
  resize: none;
  min-height: 120px;
}

.input-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.input-btn {
  flex: 1;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.input-btn.secondary {
  background: var(--button-secondary-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.input-btn.primary {
  background: var(--primary);
  border: 1px solid var(--primary);
  color: white;
}

.input-btn:active {
  transform: scale(0.95);
}

/* Floating Action Buttons */
.fab-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  z-index: 1500;
}

.secondary-fabs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.fab:active {
  transform: scale(0.9);
}

.fab.primary {
  background: var(--primary);
  color: white;
  width: 64px;
  height: 64px;
}

.fab.primary.fab-rotated {
  transform: rotate(45deg);
}

.fab.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  width: 48px;
  height: 48px;
}

/* Gesture Overlay */
.gesture-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  pointer-events: auto;
}

.overlay-hint {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 16px;
  font-size: 12px;
}

/* Animations */
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: transform 0.3s ease;
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  transform: translateY(100%);
}

.mobile-input-enter-active,
.mobile-input-leave-active {
  transition: all 0.3s ease;
}

.mobile-input-enter-from,
.mobile-input-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.fab-secondary-enter-active,
.fab-secondary-leave-active {
  transition: all 0.2s ease;
}

.fab-secondary-enter-from,
.fab-secondary-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.8);
}

/* Dark theme optimizations */
@media (prefers-color-scheme: dark) {
  .mobile-actions-menu,
  .mobile-input-proxy {
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
  }
  
  .fab {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

/* Reduce motion */
@media (prefers-reduced-motion: reduce) {
  .mobile-menu-enter-active,
  .mobile-menu-leave-active,
  .mobile-input-enter-active,
  .mobile-input-leave-active,
  .fab-secondary-enter-active,
  .fab-secondary-leave-active {
    transition: opacity 0.2s ease;
  }
  
  .fab.primary.fab-rotated {
    transform: none;
  }
  
  .quick-action-btn:active,
  .command-btn:active,
  .letter-btn:active,
  .fab:active,
  .input-btn:active {
    transform: none;
  }
}
</style>