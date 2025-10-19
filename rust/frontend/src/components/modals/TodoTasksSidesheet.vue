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
            <ClipboardDocumentListIcon class="icon-accent" />
          </div>
          <h2 class="header-title">Microsoft Tasks</h2>
        </div>

        <div class="header-right">
          <!-- Auth Status -->
          <div v-if="!todoStore.hasValidAuth">
            <button @click="connectMicrosoft" :disabled="todoStore.authLoading" class="btn-connect">
              <UserPlusIcon class="icon-sm" />
              {{ todoStore.authLoading ? 'Connecting...' : 'Connect' }}
            </button>
          </div>

          <div v-else class="auth-status">
            <span class="user-email">{{ todoStore.microsoftEmail }}</span>
            <button @click="syncTasks" :disabled="todoStore.syncLoading" title="Sync all workspaces" class="btn-icon">
              <ArrowPathIcon class="icon-base" :class="{ 'animate-spin': todoStore.syncLoading }" />
            </button>
          </div>

          <!-- Close -->
          <button @click="close" title="Close" class="btn-icon">
            <XMarkIcon class="icon-base" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="sidesheet-content">
        <!-- Not Authenticated -->
        <div v-if="!todoStore.hasValidAuth" class="empty-state">
          <div class="empty-icon">
            <ClipboardDocumentListIcon />
          </div>
          <h3 class="empty-title">Connect Microsoft Account</h3>
          <p class="empty-text">Connect your Microsoft account to manage tasks across your workspaces</p>
          <button @click="connectMicrosoft" :disabled="todoStore.authLoading" class="btn-primary">
            <UserPlusIcon />
            {{ todoStore.authLoading ? 'Connecting...' : 'Connect Microsoft' }}
          </button>
        </div>

        <!-- Tasks Board -->
        <TasksBoard v-else />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { useUIStore } from '@/stores/ui'
import TasksBoard from '@/components/tasks/TasksBoard.vue'
import { logger } from '@/utils/logger'
import ssoClient from '@/services/sso'
import {
  ClipboardDocumentListIcon,
  UserPlusIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

const todoStore = useTodoStore()
const uiStore = useUIStore()

const show = computed(() => uiStore.showTodoTasks)

const close = () => {
  uiStore.setShowTodoTasks(false)
}

const connectMicrosoft = async () => {
  try {
    logger.log('🔄 Starting Microsoft identity linking via SSO...')
    const { authorization_url } = await ssoClient.user.identities.startLink('microsoft')
    logger.log('✅ Redirecting to SSO for Microsoft linking...')
    window.location.href = authorization_url
  } catch (error) {
    logger.error('Failed to start Microsoft identity linking:', error)
  }
}

const syncTasks = async () => {
  try {
    await todoStore.syncAllWorkspaces()
    logger.log('All workspaces synced successfully')
  } catch (error) {
    logger.error('Failed to sync workspaces:', error)
  }
}

onMounted(async () => {
  await todoStore.checkAuthStatus()
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
  max-width: 1400px;
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
  padding: var(--space-4) var(--space-6);
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

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Auth */
.btn-connect {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: white;
  background: var(--color-interactive-primary);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-connect svg {
  width: 18px;
  height: 18px;
}

.btn-connect:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
}

.btn-connect:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.user-email {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-icon {
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

.btn-icon svg {
  width: 20px;
  height: 20px;
}

.btn-icon:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Content */
.sidesheet-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-6);
  color: var(--color-text-tertiary);
}

.empty-icon svg {
  width: 40px;
  height: 40px;
}

.empty-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
}

.empty-text {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-6) 0;
  max-width: 400px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: white;
  background: var(--color-interactive-primary);
  border: none;
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-primary svg {
  width: 20px;
  height: 20px;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-interactive-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 1200px) {
  .sidesheet-panel {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .user-email {
    display: none;
  }

  .sidesheet-header {
    padding: var(--space-3) var(--space-4);
  }

  .header-title {
    font-size: var(--font-size-lg);
  }
}
</style>