<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="app-container">
    <!-- Loading State -->
    <div v-if="appStatus === 'initializing'" class="app-loading">
      <div class="loading-spinner"></div>
      <p>Initializing AI Code Terminal...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="appStatus === 'error'" class="app-error">
      <div class="error-icon">⚠️</div>
      <h3>Initialization Failed</h3>
      <p>{{ initializationError }}</p>
      <button @click="tryInitializeApp" class="retry-button">Retry</button>
    </div>

    <!-- Unauthenticated State -->
    <div v-else-if="appStatus === 'unauthenticated'" class="app-login">
      <div class="login-container">
        <h2>AI Code Terminal</h2>
        <p>Please log in to continue</p>
        <a :href="getGitHubAuthUrl()" class="github-login-button">
          <ArrowRightOnRectangleIcon class="icon-base" />
          Login with GitHub
        </a>
      </div>
    </div>

    <!-- Main Application -->
    <template v-else-if="appStatus === 'ready'">
      <MainLayout />

      <!-- Modals and Overlays -->
      <ThemeModal v-if="uiStore.showThemeModal" />
      <SettingsModal v-if="uiStore.showSettingsModal" />
      <RepositoriesModal v-if="uiStore.showRepositoriesModal" />
      <DeleteWorkspaceModal v-if="uiStore.showDeleteModal" />
      <DiscardChangesModal v-if="fileStore.showDiscardModal" />
      <TodoTasksSidesheet />
      <CreateItemModal
        v-if="uiStore.showCreateItemModal"
        :is-open="uiStore.showCreateItemModal"
        :parent-path="uiStore.createItemModalData?.parentPath || ''"
        @close="uiStore.closeCreateItemModal"
        @create="handleCreateItem"
      />
      <ConfirmDeleteModal
        v-if="uiStore.showConfirmDeleteModal"
        :is-open="uiStore.showConfirmDeleteModal"
        :item-name="uiStore.confirmDeleteModalData?.itemName || ''"
        :item-type="uiStore.confirmDeleteModalData?.itemType || 'file'"
        :additional-info="uiStore.confirmDeleteModalData?.additionalInfo"
        :show-confirmation-input="uiStore.confirmDeleteModalData?.showConfirmationInput"
        :confirmation-text="uiStore.confirmDeleteModalData?.confirmationText"
        @close="uiStore.closeConfirmDeleteModal"
        @confirm="handleConfirmDelete"
      />

      <!-- Mobile Interface -->
      <MobileInterface v-if="uiStore.isMobile" />

      <!-- Context Menu -->
      <ContextMenu v-if="uiStore.showContextMenu" />

      <!-- Resource Alerts -->
      <ResourceAlerts />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { useFileStore } from '@/stores/file'
import { useUIStore } from '@/stores/ui'
import { useLayoutStore } from '@/stores/layout'
import { ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'
import { useAppCore } from '@/composables/useAppCore'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useTheme } from '@/composables/useTheme'
import { useAppInitialization } from '@/composables/useAppInitialization'
import MainLayout from '@/components/MainLayout.vue'

// Import modal components (to be created)
import ThemeModal from '@/components/modals/ThemeModal.vue'
import SettingsModal from '@/components/modals/SettingsModal.vue'
import RepositoriesModal from '@/components/modals/RepositoriesModal.vue'
import DeleteWorkspaceModal from '@/components/modals/DeleteWorkspaceModal.vue'
import DiscardChangesModal from '@/components/modals/DiscardChangesModal.vue'
import TodoTasksSidesheet from '@/components/modals/TodoTasksSidesheet.vue'
import CreateItemModal from '@/components/CreateItemModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import MobileInterface from '@/components/mobile/MobileInterface.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import ResourceAlerts from '@/components/ui/ResourceAlerts.vue'
import { apiService } from '@/services/api'
import { logger } from '@/utils/logger'

// Stores
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const fileStore = useFileStore()
const uiStore = useUIStore()
const layoutStore = useLayoutStore()

// Composables
const {
  appStatus,
  initializationError,
  tryInitializeApp,
  cleanup
} = useAppCore()

const { isInitialized: isGlobalAppInitialized, resetInitialization } = useAppInitialization()

// Setup keyboard shortcuts
useKeyboardShortcuts()

// Initialize theme system (automatically handled by useTheme composable)
useTheme()

// GitHub auth URL
const getGitHubAuthUrl = () => authStore.getGitHubAuthUrl()

// Modal handlers
const handleCreateItem = async (data: { name: string; type: 'file' | 'directory'; content?: string | undefined }) => {
  if (!uiStore.createItemModalData) return

  try {
    const parentPath = uiStore.createItemModalData.parentPath

    if (data.type === 'file') {
      await apiService.createFile(parentPath, data.name, data.content || '')
    } else {
      await apiService.createDirectory(parentPath, data.name)
    }

    // Refresh the file listing
    await fileStore.refreshFiles(fileStore.currentPath, false)

    uiStore.addResourceAlert({
      type: 'info',
      title: 'Item Created',
      message: `${data.type === 'file' ? 'File' : 'Folder'} "${data.name}" created successfully`
    })
  } catch (error) {
    uiStore.addResourceAlert({
      type: 'error',
      title: 'Creation Failed',
      message: error instanceof Error ? error.message : `Failed to create ${data.type}`
    })
  }

  uiStore.closeCreateItemModal()
}

const handleConfirmDelete = async () => {
  if (!uiStore.confirmDeleteModalData?.onConfirm) return

  try {
    await uiStore.confirmDeleteModalData.onConfirm()
    uiStore.closeConfirmDeleteModal()
  } catch (error) {
    uiStore.addResourceAlert({
      type: 'error',
      title: 'Delete Failed',
      message: error instanceof Error ? error.message : 'Failed to delete item'
    })
  }
}

onMounted(async () => {
  logger.log('🚀 TRACE: Dashboard.vue onMounted() called')
  logger.log('🚀 TRACE: isGlobalAppInitialized.value =', isGlobalAppInitialized.value)
  logger.log('🚀 TRACE: Dashboard mounted, initializing application...')

  // Always ensure workspaces are loaded when dashboard mounts
  if (authStore.isAuthenticated) {
    logger.log('🚀 TRACE: Loading workspaces for authenticated user')
    try {
      await workspaceStore.fetchWorkspaces()
      logger.log('✅ TRACE: Workspaces loaded successfully')

      // If there's a selected workspace, fetch its layouts
      if (workspaceStore.selectedWorkspace) {
        await layoutStore.fetchLayouts(workspaceStore.selectedWorkspace.id)
        logger.log('✅ TRACE: Layouts loaded for selected workspace')
      }
    } catch (wsError) {
      logger.error('❌ TRACE: Failed to load workspaces on dashboard mount:', wsError)
    }
  }

  // Skip initialization if global app is already initialized
  if (isGlobalAppInitialized.value) {
    logger.log('⚠️ TRACE: Global app already initialized, skipping Dashboard initialization')
    return
  }

  logger.log('🚀 TRACE: Calling tryInitializeApp()...')
  // Initialize the application using the core composable
  // Theme system is automatically initialized by useTheme composable
  await tryInitializeApp()
  logger.log('🚀 TRACE: tryInitializeApp() completed')
})

onBeforeUnmount(() => {
  logger.log('🧹 Dashboard unmounting, cleaning up...')
  cleanup()

  // Reset global initialization state if needed
  // This allows re-initialization if the Dashboard component is remounted
  resetInitialization()

  // Theme system cleanup is automatically handled by useTheme composable
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* Loading State */
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 24px;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

.app-loading p {
  color: var(--text-secondary);
  font-size: 16px;
  animation: pulse 2s ease-in-out infinite alternate;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid transparent;
  border-top: 3px solid var(--primary);
  border-right: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
  box-shadow: 0 0 20px rgba(0, 123, 204, 0.3);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0% { opacity: 0.6; }
  100% { opacity: 1; }
}

/* Error State */
.app-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 15px;
  padding: 20px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
}

.app-error h3 {
  margin: 0;
  color: var(--error);
  font-size: 24px;
}

.app-error p {
  margin: 0;
  color: var(--text-secondary);
  max-width: 400px;
}

.retry-button {
  background: var(--primary);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background: var(--primary-hover);
}

/* Login State */
.app-login {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

.login-container {
  text-align: center;
  padding: 48px;
  background: var(--bg-secondary);
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px var(--border-color);
  backdrop-filter: blur(20px);
  max-width: 420px;
  transform: translateY(0);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px var(--border-color);
}

.login-container h2 {
  margin: 0 0 10px 0;
  font-size: 28px;
  color: var(--text-primary);
}

.login-container p {
  margin: 0 0 30px 0;
  color: var(--text-secondary);
  font-size: 16px;
}

.github-login-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--primary);
  color: white;
  text-decoration: none;
  padding: 14px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.github-login-button:hover {
  background: var(--primary-hover);
}

.github-login-button svg {
  flex-shrink: 0;
}
</style>
