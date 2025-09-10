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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Login with GitHub
        </a>
      </div>
    </div>
    
    <!-- Main Application -->
    <template v-else-if="appStatus === 'ready'">
      <TitleBar />
      <MainContent />
      <StatusBar />
      
      <!-- Modals and Overlays -->
      <ThemeModal v-if="uiStore.showThemeModal" />
      <RepositoriesModal v-if="workspaceStore.showRepositoriesModal" />
      <DeleteWorkspaceModal v-if="workspaceStore.showDeleteModal" />
      <FilePreviewModal v-if="fileStore.showFilePreviewModal" />
      <DiscardChangesModal v-if="fileStore.showDiscardModal" />
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
      <ContextMenu v-if="fileStore.showContextMenu" />
      
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
import { useAppCore } from '@/composables/useAppCore'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useTheme } from '@/composables/useTheme'
import { useAppInitialization } from '@/composables/useAppInitialization'
import TitleBar from '@/components/TitleBar.vue'
import MainContent from '@/components/MainContent.vue'
import StatusBar from '@/components/StatusBar.vue'

// Import modal components (to be created)
import ThemeModal from '@/components/modals/ThemeModal.vue'
import RepositoriesModal from '@/components/modals/RepositoriesModal.vue'
import DeleteWorkspaceModal from '@/components/modals/DeleteWorkspaceModal.vue'
import FilePreviewModal from '@/components/modals/FilePreviewModal.vue'
import DiscardChangesModal from '@/components/modals/DiscardChangesModal.vue'
import CreateItemModal from '@/components/CreateItemModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import MobileInterface from '@/components/mobile/MobileInterface.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import ResourceAlerts from '@/components/ui/ResourceAlerts.vue'
import { apiService } from '@/services/api'

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
const handleCreateItem = async (data: { name: string; type: 'file' | 'directory'; content?: string }) => {
  if (!uiStore.createItemModalData) return
  
  try {
    const parentPath = uiStore.createItemModalData.parentPath
    
    if (data.type === 'file') {
      await apiService.createFile(parentPath, data.name, data.content || '')
    } else {
      await apiService.createDirectory(parentPath, data.name)
    }
    
    // Refresh the file listing
    await fileStore.loadDirectoryContents(fileStore.currentPath)
    
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
  console.log('🚀 TRACE: Dashboard.vue onMounted() called')
  console.log('🚀 TRACE: isGlobalAppInitialized.value =', isGlobalAppInitialized.value)
  console.log('🚀 TRACE: Dashboard mounted, initializing application...')
  
  // Always ensure workspaces are loaded when dashboard mounts
  if (authStore.isAuthenticated) {
    const ownerId = authStore.user?.id || authStore.user?.login
    console.log('🚀 TRACE: Loading workspaces for authenticated user:', ownerId)
    try {
      await workspaceStore.fetchWorkspaces(ownerId)
      console.log('✅ TRACE: Workspaces loaded successfully')
      
      // If there's a selected workspace, fetch its layouts
      if (workspaceStore.selectedWorkspace) {
        await layoutStore.fetchLayouts(workspaceStore.selectedWorkspace.id)
        console.log('✅ TRACE: Layouts loaded for selected workspace')
      }
    } catch (wsError) {
      console.error('❌ TRACE: Failed to load workspaces on dashboard mount:', wsError)
    }
  }
  
  // Skip initialization if global app is already initialized
  if (isGlobalAppInitialized.value) {
    console.log('⚠️ TRACE: Global app already initialized, skipping Dashboard initialization')
    return
  }
  
  console.log('🚀 TRACE: Calling tryInitializeApp()...')
  // Initialize the application using the core composable
  // Theme system is automatically initialized by useTheme composable
  await tryInitializeApp()
  console.log('🚀 TRACE: tryInitializeApp() completed')
})

onBeforeUnmount(() => {
  console.log('🧹 Dashboard unmounting, cleaning up...')
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
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* Loading State */
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
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
  height: 100vh;
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
  height: 100vh;
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