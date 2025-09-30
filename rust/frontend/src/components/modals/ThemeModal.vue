<template>
  <div v-if="show" class="sidesheet-overlay">
    <!-- Backdrop -->
    <div class="backdrop" @click="close"></div>

    <!-- Sidesheet Panel -->
    <div class="sidesheet-panel">
      <!-- Header -->
      <div class="sidesheet-header">
        <div class="header-left">
          <div class="icon-wrapper">
            <SwatchIcon class="icon-accent" />
          </div>
          <div class="header-content">
            <h2 class="header-title">Choose Theme</h2>
            <p class="header-subtitle">Customize your workspace appearance</p>
          </div>
        </div>

        <button @click="close" title="Close" class="btn-close">
          <XMarkIcon class="icon-base" />
        </button>
      </div>

      <!-- Body -->
      <div class="sidesheet-body">
        <!-- Loading State -->
        <div v-if="isLoading || !currentTheme" class="loading-state">
          <div class="loading-spinner">
            <ArrowPathIcon class="spinner-icon" />
          </div>
          <p class="loading-text">Loading themes...</p>
        </div>

        <!-- Theme Content -->
        <div v-else class="theme-content">
          <!-- Current Theme Banner -->
          <div class="current-theme-banner">
            <div class="banner-left">
              <div class="current-indicator">
                <CheckCircleIcon class="current-icon" />
              </div>
              <div class="banner-info">
                <div class="banner-label">Active Theme</div>
                <div class="banner-title">{{ currentTheme.name }}</div>
              </div>
            </div>
            <div class="theme-category-badge" :class="currentTheme.category">
              <component :is="getCategoryIcon(currentTheme.category)" class="badge-icon" />
              {{ getCategoryLabel(currentTheme.category) }}
            </div>
          </div>

          <!-- Theme Categories -->
          <div class="category-section">
            <div class="section-title">
              <SunIcon class="section-icon" />
              <h3>Light Themes</h3>
            </div>
            <div class="theme-grid">
              <div
                v-for="theme in lightThemes"
                :key="theme.id"
                class="theme-card"
                :class="{ selected: currentTheme?.id === theme.id }"
                @click="selectTheme(theme)"
              >
                <div class="theme-preview-container">
                  <div class="theme-preview">
                    <div class="preview-window" :style="getPreviewStyles(theme)">
                      <div class="preview-header">
                        <div class="preview-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                      <div class="preview-body">
                        <div class="preview-sidebar"></div>
                        <div class="preview-content">
                          <div class="preview-line accent"></div>
                          <div class="preview-line"></div>
                          <div class="preview-line"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="currentTheme?.id === theme.id" class="selected-overlay">
                    <div class="selected-badge">
                      <CheckCircleIcon class="selected-icon" />
                    </div>
                  </div>
                </div>

                <div class="theme-info">
                  <div class="theme-name">{{ theme.name }}</div>
                  <div v-if="theme.description" class="theme-description">{{ theme.description }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Dark Themes -->
          <div class="category-section">
            <div class="section-title">
              <MoonIcon class="section-icon" />
              <h3>Dark Themes</h3>
            </div>
            <div class="theme-grid">
              <div
                v-for="theme in darkThemes"
                :key="theme.id"
                class="theme-card"
                :class="{ selected: currentTheme?.id === theme.id }"
                @click="selectTheme(theme)"
              >
                <div class="theme-preview-container">
                  <div class="theme-preview">
                    <div class="preview-window" :style="getPreviewStyles(theme)">
                      <div class="preview-header">
                        <div class="preview-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                      <div class="preview-body">
                        <div class="preview-sidebar"></div>
                        <div class="preview-content">
                          <div class="preview-line accent"></div>
                          <div class="preview-line"></div>
                          <div class="preview-line"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="currentTheme?.id === theme.id" class="selected-overlay">
                    <div class="selected-badge">
                      <CheckCircleIcon class="selected-icon" />
                    </div>
                  </div>
                </div>

                <div class="theme-info">
                  <div class="theme-name">{{ theme.name }}</div>
                  <div v-if="theme.description" class="theme-description">{{ theme.description }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- High Contrast Themes -->
          <div v-if="highContrastThemes.length > 0" class="category-section">
            <div class="section-title">
              <EyeIcon class="section-icon" />
              <h3>High Contrast</h3>
            </div>
            <div class="theme-grid">
              <div
                v-for="theme in highContrastThemes"
                :key="theme.id"
                class="theme-card"
                :class="{ selected: currentTheme?.id === theme.id }"
                @click="selectTheme(theme)"
              >
                <div class="theme-preview-container">
                  <div class="theme-preview">
                    <div class="preview-window" :style="getPreviewStyles(theme)">
                      <div class="preview-header">
                        <div class="preview-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                      <div class="preview-body">
                        <div class="preview-sidebar"></div>
                        <div class="preview-content">
                          <div class="preview-line accent"></div>
                          <div class="preview-line"></div>
                          <div class="preview-line"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="currentTheme?.id === theme.id" class="selected-overlay">
                    <div class="selected-badge">
                      <CheckCircleIcon class="selected-icon" />
                    </div>
                  </div>
                </div>

                <div class="theme-info">
                  <div class="theme-name">{{ theme.name }}</div>
                  <div v-if="theme.description" class="theme-description">{{ theme.description }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Preferences Section -->
          <div class="preferences-section">
            <div class="section-title">
              <AdjustmentsHorizontalIcon class="section-icon" />
              <h3>Preferences</h3>
            </div>

            <div class="preference-card">
              <div class="preference-content">
                <div class="preference-info">
                  <ComputerDesktopIcon class="preference-icon" />
                  <div class="preference-text">
                    <div class="preference-title">Follow system theme</div>
                    <div class="preference-description">
                      Automatically switch between light and dark themes based on your system preferences
                    </div>
                  </div>
                </div>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    :checked="themePreferences?.autoSwitch || false"
                    @change="handleAutoSwitchChange"
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTheme } from '@/composables/useTheme'
import type { Theme } from '@/types/theme'
import {
  SwatchIcon,
  XMarkIcon,
  CheckCircleIcon,
  SunIcon,
  MoonIcon,
  EyeIcon,
  AdjustmentsHorizontalIcon,
  ComputerDesktopIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline'

const uiStore = useUIStore()
const {
  currentTheme,
  availableThemes,
  switchToTheme,
  setAutoSwitch,
  getThemePreferences,
  isLoading
} = useTheme()

const show = computed(() => uiStore.showThemeModal)
const themePreferences = computed(() => getThemePreferences())

// Categorize themes
const lightThemes = computed(() =>
  availableThemes.value.filter(t => t.category === 'light')
)

const darkThemes = computed(() =>
  availableThemes.value.filter(t => t.category === 'dark')
)

const highContrastThemes = computed(() =>
  availableThemes.value.filter(t => t.category === 'high-contrast')
)

const close = () => {
  uiStore.closeThemeModal()
}

const selectTheme = async (theme: Theme) => {
  if (isLoading.value || currentTheme.value?.id === theme.id) return

  try {
    await switchToTheme(theme.id)
  } catch (error) {
    console.error('Failed to switch theme:', error)
  }
}

const handleAutoSwitchChange = async (event: Event) => {
  const target = event.target as HTMLInputElement

  try {
    await setAutoSwitch(target.checked)
  } catch (error) {
    console.error('Failed to set auto switch:', error)
    target.checked = !target.checked
  }
}

const getCategoryLabel = (category: Theme['category']): string => {
  switch (category) {
    case 'dark':
      return 'Dark'
    case 'light':
      return 'Light'
    case 'high-contrast':
      return 'High Contrast'
    default:
      return 'Theme'
  }
}

const getCategoryIcon = (category: Theme['category']) => {
  switch (category) {
    case 'dark':
      return MoonIcon
    case 'light':
      return SunIcon
    case 'high-contrast':
      return EyeIcon
    default:
      return SwatchIcon
  }
}

const getPreviewStyles = (theme: Theme) => {
  return {
    '--preview-bg': theme.colors.background.primary,
    '--preview-secondary': theme.colors.background.secondary,
    '--preview-tertiary': theme.colors.background.tertiary,
    '--preview-border': theme.colors.border.primary,
    '--preview-text': theme.colors.text.primary,
    '--preview-accent': theme.colors.interactive.primary
  }
}
</script>

<style scoped>
/* Overlay */
.sidesheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-modal);
  display: flex;
  justify-content: flex-end;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

/* Panel */
.sidesheet-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 800px;
  height: 100%;
  background: var(--color-bg-primary);
  border-left: 1px solid var(--color-border-primary);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  animation: slideIn 300ms ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Header */
.sidesheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-primary);
  flex-shrink: 0;
  background: var(--color-bg-primary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-accent {
  width: 24px;
  height: 24px;
  color: var(--color-interactive-primary);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.header-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.2;
}

.header-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--color-text-tertiary);
  background: none;
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.btn-close:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.icon-base {
  width: 20px;
  height: 20px;
}

/* Body */
.sidesheet-body {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg-primary);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  color: var(--color-text-secondary);
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: var(--space-4);
}

.spinner-icon {
  width: 32px;
  height: 32px;
  color: var(--color-interactive-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-size-base);
  margin: 0;
}

/* Theme Content */
.theme-content {
  padding: var(--space-6);
}

/* Current Theme Banner */
.current-theme-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-8);
}

.banner-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
}

.current-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(34, 197, 94, 0.1);
  border-radius: var(--radius-base);
  flex-shrink: 0;
}

.current-icon {
  width: 24px;
  height: 24px;
  color: rgb(34, 197, 94);
}

.banner-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.banner-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.banner-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.theme-category-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  flex-shrink: 0;
}

.theme-category-badge.light {
  background: rgba(250, 204, 21, 0.1);
  color: rgb(234, 179, 8);
}

.theme-category-badge.dark {
  background: rgba(147, 51, 234, 0.1);
  color: rgb(147, 51, 234);
}

.theme-category-badge.high-contrast {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
}

.badge-icon {
  width: 14px;
  height: 14px;
}

/* Category Section */
.category-section {
  margin-bottom: var(--space-8);
}

.category-section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.section-title h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.section-icon {
  width: 20px;
  height: 20px;
  color: var(--color-text-tertiary);
}

/* Theme Grid */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}

/* Theme Card */
.theme-card {
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.theme-card:hover {
  border-color: var(--color-border-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.theme-card.selected {
  border-color: var(--color-interactive-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Theme Preview Container */
.theme-preview-container {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
}

.theme-preview {
  width: 100%;
  height: 100%;
  padding: var(--space-3);
  background: var(--color-bg-tertiary);
}

.preview-window {
  width: 100%;
  height: 100%;
  background: var(--preview-bg);
  border: 1px solid var(--preview-border);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  background: var(--preview-secondary);
  border-bottom: 1px solid var(--preview-border);
}

.preview-dots {
  display: flex;
  gap: 4px;
}

.preview-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--preview-border);
  opacity: 0.5;
}

.preview-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.preview-sidebar {
  width: 25%;
  background: var(--preview-secondary);
  border-right: 1px solid var(--preview-border);
}

.preview-content {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-line {
  height: 4px;
  background: var(--preview-tertiary);
  border-radius: 2px;
  opacity: 0.6;
}

.preview-line.accent {
  background: var(--preview-accent);
  opacity: 0.8;
  width: 60%;
}

/* Selected Overlay */
.selected-overlay {
  position: absolute;
  inset: 0;
  background: rgba(59, 130, 246, 0.1);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: var(--space-3);
}

.selected-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-interactive-primary);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
}

.selected-icon {
  width: 20px;
  height: 20px;
  color: white;
}

/* Theme Info */
.theme-info {
  padding: var(--space-4) var(--space-4) var(--space-5);
}

.theme-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
  line-height: 1.3;
}

.theme-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.4;
}

/* Preferences Section */
.preferences-section {
  margin-top: var(--space-8);
  padding-top: var(--space-8);
  border-top: 1px solid var(--color-border-secondary);
}

.preference-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.preference-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  gap: var(--space-4);
}

.preference-info {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
}

.preference-icon {
  width: 24px;
  height: 24px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  margin-top: 2px;
}

.preference-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.preference-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.preference-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

/* Toggle Switch */
.toggle-switch {
  display: inline-flex;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--color-bg-tertiary);
  border: 2px solid var(--color-border-primary);
  border-radius: 24px;
  transition: all var(--transition-base);
}

.toggle-slider::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: var(--color-text-primary);
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: all var(--transition-base);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--color-interactive-primary);
  border-color: var(--color-interactive-primary);
}

.toggle-switch input:checked + .toggle-slider::after {
  transform: translateX(20px);
  background: white;
}

/* Responsive */
@media (max-width: 1024px) {
  .sidesheet-panel {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .theme-content {
    padding: var(--space-4);
  }

  .theme-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-3);
  }

  .current-theme-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .theme-category-badge {
    align-self: flex-start;
  }
}

@media (max-width: 640px) {
  .header-subtitle {
    display: none;
  }

  .sidesheet-header {
    padding: var(--space-4) var(--space-4);
  }

  .theme-grid {
    grid-template-columns: 1fr;
  }

  .preference-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .toggle-switch {
    align-self: flex-start;
  }
}
</style>