<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Choose Theme</h3>
        <button @click="closeModal" class="close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div v-if="isLoading || !currentTheme" class="loading-themes">
          <div class="loading-spinner"></div>
          <p>Loading themes...</p>
        </div>

        <div v-else class="theme-grid">
          <div 
            v-for="theme in availableThemes" 
            :key="theme.id"
            class="theme-card"
            :class="{ 
              selected: currentTheme?.id === theme.id,
              'dark-theme': theme.category === 'dark'
            }"
            @click="selectTheme(theme)"
          >
            <div class="theme-preview">
              <div 
                class="color-swatch bg" 
                :style="{ backgroundColor: theme.colors.background.primary }"
              ></div>
              <div 
                class="color-swatch secondary" 
                :style="{ backgroundColor: theme.colors.background.secondary }"
              ></div>
              <div 
                class="color-swatch accent" 
                :style="{ backgroundColor: theme.colors.interactive.primary }"
              ></div>
            </div>
            
            <div class="theme-info">
              <div class="theme-name">{{ theme.name }}</div>
              <div v-if="theme.description" class="theme-description">{{ theme.description }}</div>
              <div class="theme-type">{{ getThemeTypeLabel(theme.category) }}</div>
            </div>
            
            <div v-if="currentTheme?.id === theme.id" class="selected-indicator">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <!-- Auto-switch toggle -->
        <div class="theme-options">
          <label class="auto-switch-toggle">
            <input 
              type="checkbox" 
              :checked="themePreferences?.autoSwitch || false"
              @change="handleAutoSwitchChange"
            />
            <span class="toggle-slider"></span>
            <span class="toggle-label">Follow system theme</span>
          </label>
          <p class="toggle-description">
            Automatically switch between light and dark themes based on your system preferences
          </p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTheme } from '@/composables/useTheme'
import type { Theme } from '@/types/theme'

const uiStore = useUIStore()
const { 
  currentTheme, 
  availableThemes, 
  switchToTheme, 
  setAutoSwitch,
  getThemePreferences,
  isLoading 
} = useTheme()

const themePreferences = computed(() => getThemePreferences())

const closeModal = () => {
  uiStore.closeThemeModal()
}

const selectTheme = async (theme: Theme) => {
  if (isLoading.value || currentTheme.value?.id === theme.id) return
  
  try {
    await switchToTheme(theme.id)
  } catch (error) {
    console.error('Failed to switch theme:', error)
    // Could add error toast here
  }
}

const handleAutoSwitchChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  
  try {
    await setAutoSwitch(target.checked)
  } catch (error) {
    console.error('Failed to set auto switch:', error)
    // Revert checkbox state on error
    target.checked = !target.checked
  }
}

const getThemeTypeLabel = (category: Theme['category']): string => {
  switch (category) {
    case 'dark':
      return 'Dark Theme'
    case 'light':
      return 'Light Theme'
    case 'high-contrast':
      return 'High Contrast Theme'
    default:
      return 'Theme'
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(2px);
}

.modal-content {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--modal-border-radius);
  width: 90%;
  max-width: var(--modal-max-width);
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  font-family: var(--font-family-sans);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--modal-padding);
  border-bottom: 1px solid var(--color-border-secondary);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: var(--transition-colors);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
}

.close-btn:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--modal-padding);
}

.loading-themes {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-12);
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: var(--space-6);
  height: var(--space-6);
  border: 2px solid var(--color-border-primary);
  border-top: 2px solid var(--color-interactive-primary);
  border-radius: var(--radius-full);
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-4);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.theme-card {
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  cursor: pointer;
  transition: var(--transition-colors);
  position: relative;
  background: var(--color-bg-secondary);
}

.theme-card:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-tertiary);
  box-shadow: var(--shadow-sm);
}

.theme-card.selected {
  border-color: var(--color-interactive-primary);
  background: var(--color-bg-tertiary);
  box-shadow: var(--shadow-md);
}

.theme-preview {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  height: var(--space-8);
}

.color-swatch {
  flex: 1;
  border-radius: var(--radius-base);
  border: 1px solid var(--color-border-secondary);
}

.theme-info {
  text-align: center;
}

.theme-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-tight);
}

.theme-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-1);
  line-height: var(--line-height-normal);
}

.theme-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
}

.selected-indicator {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: var(--space-5);
  height: var(--space-5);
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.theme-options {
  border-top: 1px solid var(--color-border-secondary);
  padding-top: var(--space-5);
}

.auto-switch-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: var(--space-2);
  gap: var(--space-3);
}

.auto-switch-toggle input {
  display: none;
}

.toggle-slider {
  width: var(--space-10);
  height: var(--space-5);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--space-10);
  position: relative;
  transition: var(--transition-colors);
  flex-shrink: 0;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  width: var(--space-4);
  height: var(--space-4);
  background: var(--color-text-primary);
  border-radius: var(--radius-full);
  top: 1px;
  left: 1px;
  transition: var(--transition-transform);
}

.auto-switch-toggle input:checked + .toggle-slider {
  background: var(--color-interactive-primary);
  border-color: var(--color-interactive-primary);
}

.auto-switch-toggle input:checked + .toggle-slider::after {
  transform: translateX(var(--space-5));
  background: var(--color-text-inverse);
}

.toggle-label {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
}

.toggle-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
  margin: 0;
}

.modal-footer {
  padding: var(--modal-padding);
  border-top: 1px solid var(--color-border-secondary);
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--button-border-radius);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-colors);
  border: none;
  height: var(--button-height-base);
  display: flex;
  align-items: center;
  font-family: var(--font-family-sans);
}

.btn-secondary {
  background: var(--color-interactive-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
}

.btn-secondary:hover {
  background: var(--color-interactive-tertiary-hover);
  border-color: var(--color-border-hover);
}

@media (max-width: 640px) {
  .theme-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  
  .theme-card {
    padding: 10px;
  }
  
  .theme-preview {
    height: 28px;
  }
}
</style>