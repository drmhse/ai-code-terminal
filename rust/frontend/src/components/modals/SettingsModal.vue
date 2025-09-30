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
            <Cog6ToothIcon class="icon-accent" />
          </div>
          <h2 class="header-title">Settings</h2>
        </div>

        <button @click="close" title="Close" class="btn-close">
          <XMarkIcon class="icon-base" />
        </button>
      </div>

      <!-- Navigation & Content -->
      <div class="sidesheet-body">
        <!-- Sidebar Navigation -->
        <nav class="settings-nav">
          <button
            v-for="item in navItems"
            :key="item.id"
            @click="activeSection = item.id"
            :class="['nav-item', { active: activeSection === item.id }]"
          >
            <component :is="item.icon" class="nav-icon" />
            <span class="nav-label">{{ item.label }}</span>
            <ChevronRightIcon v-if="activeSection === item.id" class="nav-arrow" />
          </button>
        </nav>

        <!-- Content Area -->
        <div class="settings-content">
          <!-- Integrations Section -->
          <div v-if="activeSection === 'integrations'" class="content-section">
            <div class="section-header">
              <h3 class="section-title">Integrations</h3>
              <p class="section-subtitle">Connect external services to enhance your workflow</p>
            </div>

            <!-- Microsoft To Do Card -->
            <div class="integration-card">
              <div class="card-header">
                <div class="card-icon microsoft">
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M0 0h11v11H0z"/>
                    <path fill="currentColor" opacity="0.8" d="M12 0h11v11H12z"/>
                    <path fill="currentColor" opacity="0.6" d="M0 12h11v11H0z"/>
                    <path fill="currentColor" opacity="0.9" d="M12 12h11v11H12z"/>
                  </svg>
                </div>
                <div class="card-info">
                  <h4 class="card-title">Microsoft To Do</h4>
                  <p class="card-description">Sync tasks and create todos from code context</p>
                </div>
                <div v-if="todoStore.hasValidAuth" class="card-badge connected">
                  <CheckCircleIcon class="badge-icon" />
                  Connected
                </div>
              </div>

              <div class="card-content">
                <MicrosoftConnectButton />

                <!-- Connection Details -->
                <div v-if="todoStore.hasValidAuth" class="connection-details">
                  <div class="detail-group">
                    <div class="detail-item">
                      <UserCircleIcon class="detail-icon" />
                      <div class="detail-content">
                        <span class="detail-label">Account</span>
                        <span class="detail-value">{{ todoStore.microsoftEmail }}</span>
                      </div>
                    </div>

                    <div v-if="todoStore.syncStatus" class="detail-item">
                      <CloudIcon class="detail-icon" />
                      <div class="detail-content">
                        <span class="detail-label">Workspaces</span>
                        <span class="detail-value">
                          {{ todoStore.syncStatus.synced_workspaces }}/{{ todoStore.syncStatus.total_workspaces }} synced
                        </span>
                      </div>
                    </div>

                    <div v-if="todoStore.syncStatus" class="detail-item">
                      <ChartBarIcon class="detail-icon" />
                      <div class="detail-content">
                        <span class="detail-label">Cache Performance</span>
                        <span class="detail-value">
                          {{ Math.round(todoStore.syncStatus.cache_stats.cache_hit_rate * 100) }}% hit rate
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Appearance Section -->
          <div v-if="activeSection === 'appearance'" class="content-section">
            <div class="section-header">
              <h3 class="section-title">Appearance</h3>
              <p class="section-subtitle">Customize the look and feel of your workspace</p>
            </div>

            <!-- Theme Card -->
            <div class="settings-card">
              <div class="card-row">
                <div class="card-row-left">
                  <SwatchIcon class="card-row-icon" />
                  <div class="card-row-content">
                    <h4 class="card-row-title">Theme</h4>
                    <p class="card-row-description">Choose a color theme for the interface</p>
                  </div>
                </div>
                <button @click="openThemeModal" class="btn-action">
                  <span>Choose Theme</span>
                  <ChevronRightIcon class="btn-action-icon" />
                </button>
              </div>
            </div>
          </div>

          <!-- General Section -->
          <div v-if="activeSection === 'general'" class="content-section">
            <div class="section-header">
              <h3 class="section-title">General</h3>
              <p class="section-subtitle">General application settings and preferences</p>
            </div>

            <div class="settings-card">
              <div class="card-info-message">
                <InformationCircleIcon class="info-icon" />
                <span>Additional settings will be available soon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTodoStore } from '@/stores/todo'
import MicrosoftConnectButton from '@/components/auth/MicrosoftConnectButton.vue'
import {
  Cog6ToothIcon,
  XMarkIcon,
  ChevronRightIcon,
  PuzzlePieceIcon,
  SwatchIcon,
  Cog8ToothIcon,
  CheckCircleIcon,
  UserCircleIcon,
  CloudIcon,
  ChartBarIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline'

const uiStore = useUIStore()
const todoStore = useTodoStore()

const show = computed(() => uiStore.showSettingsModal)
const activeSection = ref<'general' | 'appearance' | 'integrations'>('integrations')

const navItems = [
  {
    id: 'general' as const,
    label: 'General',
    icon: Cog8ToothIcon
  },
  {
    id: 'appearance' as const,
    label: 'Appearance',
    icon: SwatchIcon
  },
  {
    id: 'integrations' as const,
    label: 'Integrations',
    icon: PuzzlePieceIcon
  }
]

const close = () => {
  uiStore.closeSettingsModal()
}

const openThemeModal = () => {
  uiStore.closeSettingsModal()
  uiStore.openThemeModal()
}

onMounted(async () => {
  try {
    await todoStore.checkAuthStatus()
  } catch (error) {
    console.error('Failed to check Microsoft auth status:', error)
  }
})
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
  max-width: 900px;
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

.header-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
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
  overflow: hidden;
  display: flex;
}

/* Navigation */
.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 240px;
  padding: var(--space-4);
  border-right: 1px solid var(--color-border-primary);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-sans);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
  text-align: left;
  position: relative;
}

.nav-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: var(--color-interactive-secondary);
  color: var(--color-interactive-primary);
  font-weight: var(--font-weight-semibold);
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
}

.nav-arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Content */
.settings-content {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg-primary);
}

.content-section {
  padding: var(--space-8) var(--space-8);
  max-width: 800px;
}

.section-header {
  margin-bottom: var(--space-8);
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
}

.section-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
}

/* Integration Card */
.integration-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-base);
}

.integration-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-hover);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-base);
  background: var(--color-bg-primary);
  flex-shrink: 0;
}

.card-icon.microsoft {
  color: #0078d4;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1) 0;
}

.card-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.card-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  flex-shrink: 0;
}

.card-badge.connected {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.badge-icon {
  width: 16px;
  height: 16px;
}

.card-content {
  padding: var(--space-6);
}

/* Connection Details */
.connection-details {
  margin-top: var(--space-6);
}

.detail-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-base);
}

.detail-icon {
  width: 20px;
  height: 20px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  margin-top: 2px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.detail-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

/* Settings Card */
.settings-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  gap: var(--space-4);
}

.card-row-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
}

.card-row-icon {
  width: 24px;
  height: 24px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.card-row-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.card-row-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.card-row-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-sans);
  color: var(--color-interactive-primary);
  background: transparent;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.btn-action:hover {
  background: var(--color-interactive-secondary);
  border-color: var(--color-interactive-primary);
}

.btn-action-icon {
  width: 16px;
  height: 16px;
}

/* Info Message */
.card-info-message {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.info-icon {
  width: 20px;
  height: 20px;
  color: var(--color-interactive-primary);
  flex-shrink: 0;
}

/* Responsive */
@media (max-width: 1200px) {
  .sidesheet-panel {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .settings-nav {
    width: 200px;
  }

  .content-section {
    padding: var(--space-6) var(--space-4);
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .card-badge {
    align-self: flex-start;
  }
}

@media (max-width: 640px) {
  .sidesheet-body {
    flex-direction: column;
  }

  .settings-nav {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--color-border-primary);
  }

  .nav-arrow {
    display: none;
  }

  .content-section {
    padding: var(--space-4);
  }

  .card-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .btn-action {
    align-self: stretch;
    justify-content: center;
  }
}
</style>