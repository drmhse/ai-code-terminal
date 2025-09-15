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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid var(--border-secondary);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.loading-themes {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-primary);
  border-top: 2px solid var(--interactive-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.theme-card {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  background: var(--bg-secondary);
}

.theme-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-tertiary);
}

.theme-card.selected {
  border-color: var(--interactive-primary);
  background: var(--bg-tertiary);
}

.theme-preview {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  height: 32px;
}

.color-swatch {
  flex: 1;
  border-radius: 4px;
  border: 1px solid var(--border-secondary);
}

.theme-info {
  text-align: center;
}

.theme-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-size: 14px;
}

.theme-description {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  line-height: 1.3;
}

.theme-type {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.selected-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  background: var(--interactive-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-options {
  border-top: 1px solid var(--border-secondary);
  padding-top: 20px;
}

.auto-switch-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 8px;
}

.auto-switch-toggle input {
  display: none;
}

.toggle-slider {
  width: 40px;
  height: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  position: relative;
  transition: all 0.2s ease;
  margin-right: 12px;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: var(--text-primary);
  border-radius: 50%;
  top: 1px;
  left: 1px;
  transition: all 0.2s ease;
}

.auto-switch-toggle input:checked + .toggle-slider {
  background: var(--interactive-primary);
  border-color: var(--interactive-primary);
}

.auto-switch-toggle input:checked + .toggle-slider::after {
  transform: translateX(20px);
  background: white;
}

.toggle-label {
  color: var(--text-primary);
  font-weight: 500;
}

.toggle-description {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border-secondary);
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.btn-secondary:hover {
  background: var(--bg-quaternary);
  border-color: var(--border-hover);
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