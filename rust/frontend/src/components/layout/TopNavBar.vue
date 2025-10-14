<template>
  <div class="top-nav">
    <!-- Left Section: Brand & Navigation -->
    <div class="nav-left">
      <!-- App Home -->
      <div class="app-brand">
        <CommandLineIcon class="brand-icon" />
        <span class="brand-name">ACT</span>
      </div>

      <div class="nav-divider"></div>

      <!-- Workspace Breadcrumb -->
      <div v-if="workspaceStore.selectedWorkspace" class="workspace-breadcrumb">
        <button @click="openWorkspaceSelector" class="workspace-selector">
          <FolderOpenIcon class="workspace-icon" />
          <span class="workspace-name">{{ workspaceStore.selectedWorkspace.name }}</span>
          <ChevronDownIcon class="chevron-icon" />
        </button>
      </div>
      <div v-else class="workspace-breadcrumb">
        <button @click="openWorkspaceSelector" class="workspace-selector empty">
          <FolderIcon class="workspace-icon" />
          <span class="workspace-name">Select workspace</span>
          <ChevronDownIcon class="chevron-icon" />
        </button>
      </div>
    </div>

    <!-- Center Section: Quick Actions -->
    <div class="nav-center">
      <!-- Search placeholder - future feature -->
      <div class="search-container">
        <MagnifyingGlassIcon class="search-icon" />
        <input
          type="text"
          placeholder="Search files, commands..."
          class="search-input"
          readonly
          @click="handleSearchClick"
        />
        <kbd class="search-kbd">⌘K</kbd>
      </div>
    </div>

    <!-- Right Section: Actions & User -->
    <div class="nav-right">
      <!-- Background Processes -->
      <button
        v-if="workspaceStore.selectedWorkspace"
        @click="toggleBackgroundTasks"
        class="nav-action-btn"
        :class="{ active: uiStore.showBackgroundTasks }"
        title="Background Processes"
      >
        <CpuChipIcon />
      </button>

      <!-- Tasks -->
      <button
        @click="toggleTodoTasks"
        class="nav-action-btn"
        :class="{ active: uiStore.showTodoTasks, 'has-badge': hasTasks }"
        title="Microsoft Tasks"
      >
        <ClipboardDocumentListIcon />
        <span v-if="hasTasks" class="task-badge">{{ taskCount }}</span>
      </button>

      <div class="nav-divider"></div>

      <!-- Theme Toggle -->
      <button
        @click="uiStore.toggleThemeModal()"
        class="nav-action-btn"
        title="Change theme"
      >
        <component :is="themeIcon" />
      </button>

      <!-- Settings -->
      <button
        @click="openSettings"
        class="nav-action-btn"
        title="Settings"
      >
        <Cog6ToothIcon />
      </button>

      <div class="nav-divider"></div>

      <!-- User Menu -->
      <div v-if="authStore.user" class="user-menu" @click.stop>
        <button
          @click="toggleUserDropdown"
          class="user-avatar-btn"
          :class="{ active: showUserDropdown }"
          :title="authStore.user.login"
        >
          <img
            v-if="authStore.user.avatar_url"
            :src="authStore.user.avatar_url"
            :alt="authStore.user.login"
            class="user-avatar"
          />
          <div v-else class="user-avatar-placeholder">
            {{ (authStore.user.login || 'U')[0].toUpperCase() }}
          </div>
        </button>

        <!-- User Dropdown -->
        <Transition name="dropdown">
          <div v-if="showUserDropdown" class="user-dropdown">
            <div class="dropdown-header">
              <img
                v-if="authStore.user.avatar_url"
                :src="authStore.user.avatar_url"
                :alt="authStore.user.login"
                class="dropdown-avatar"
              />
              <div v-else class="dropdown-avatar-placeholder">
                {{ (authStore.user.login || 'U')[0].toUpperCase() }}
              </div>
              <div class="dropdown-user-info">
                <div class="dropdown-name">{{ authStore.user.login }}</div>
                <div class="dropdown-email">{{ authStore.user.email || 'No email' }}</div>
              </div>
            </div>

            <div class="dropdown-divider"></div>

            <button @click="openSettings" class="dropdown-item">
              <Cog6ToothIcon />
              <span>Settings</span>
            </button>

            <div class="dropdown-divider"></div>

            <button @click="handleLogout" class="dropdown-item danger">
              <ArrowRightOnRectangleIcon />
              <span>Logout</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { useTodoStore } from '@/stores/todo'
import {
  CommandLineIcon,
  FolderIcon,
  FolderOpenIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  CpuChipIcon,
  ClipboardDocumentListIcon,
  SunIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/vue/24/outline'

const uiStore = useUIStore()
const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const todoStore = useTodoStore()

// Dropdown state
const showUserDropdown = ref(false)

// Computed
const themeIcon = computed(() => {
  // You can detect theme here if needed
  return SunIcon
})

const hasTasks = computed(() => todoStore.pendingTasks.length > 0)
const taskCount = computed(() => {
  const count = todoStore.pendingTasks.length
  return count > 99 ? '99+' : count.toString()
})

// Actions
const openWorkspaceSelector = () => {
  // TODO: Implement workspace selector modal
  console.log('Open workspace selector')
}

const handleSearchClick = () => {
  // TODO: Implement command palette / search
  console.log('Open search')
}

const toggleBackgroundTasks = () => {
  uiStore.setShowBackgroundTasks(!uiStore.showBackgroundTasks)
}

const toggleTodoTasks = () => {
  uiStore.setShowTodoTasks(!uiStore.showTodoTasks)
}

const toggleUserDropdown = () => {
  showUserDropdown.value = !showUserDropdown.value
}

const closeUserDropdown = () => {
  showUserDropdown.value = false
}

const openSettings = () => {
  uiStore.openSettingsModal()
  closeUserDropdown()
}

const handleLogout = () => {
  authStore.logout()
  closeUserDropdown()
}

// Close dropdown when clicking outside
const handleClickOutside = (event: Event) => {
  const target = event.target as Element
  if (!target.closest('.user-menu')) {
    closeUserDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* ========================================
   Atlassian-Inspired Navigation
   ======================================== */

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 var(--space-4);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  font-family: var(--font-family-sans);
  transition: all 0.2s ease;
}

/* ========================================
   Layout Sections
   ======================================== */

.nav-left,
.nav-center,
.nav-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.nav-left {
  flex-shrink: 0;
}

.nav-center {
  flex: 1;
  max-width: 600px;
  margin: 0 var(--space-6);
}

.nav-right {
  flex-shrink: 0;
  gap: var(--space-1);
}

/* ========================================
   Dividers
   ======================================== */

.nav-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border-primary);
  margin: 0 var(--space-2);
}

/* ========================================
   Brand
   ======================================== */

.app-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-2);
  user-select: none;
}

.brand-icon {
  width: 20px;
  height: 20px;
  color: var(--color-interactive-primary);
  flex-shrink: 0;
}

.brand-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: 0.5px;
}

/* ========================================
   Workspace Selector
   ======================================== */

.workspace-breadcrumb {
  display: flex;
  align-items: center;
}

.workspace-selector {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1-5) var(--space-3);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.15s ease;
  max-width: 300px;
}

.workspace-selector:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-secondary);
}

.workspace-selector:active {
  transform: scale(0.98);
}

.workspace-selector.empty {
  color: var(--color-text-tertiary);
}

.workspace-selector.empty:hover {
  color: var(--color-text-primary);
}

.workspace-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.workspace-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.chevron-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.6;
  transition: transform 0.2s ease;
}

.workspace-selector:hover .chevron-icon {
  opacity: 1;
}

/* ========================================
   Search
   ======================================== */

.search-container {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
  cursor: pointer;
}

.search-container:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-tertiary);
}

.search-container:focus-within {
  border-color: var(--color-interactive-primary);
  box-shadow: 0 0 0 3px rgba(56, 139, 255, 0.1);
}

.search-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-family: inherit;
  padding: 0;
  cursor: pointer;
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

.search-kbd {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px var(--space-1-5);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-tertiary);
  font-family: var(--font-family-mono);
  line-height: 1;
  flex-shrink: 0;
}

/* ========================================
   Action Buttons
   ======================================== */

.nav-action-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-action-btn svg {
  width: 18px;
  height: 18px;
}

.nav-action-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-secondary);
  color: var(--color-text-primary);
}

.nav-action-btn:active {
  transform: scale(0.95);
}

.nav-action-btn.active {
  background: var(--color-interactive-primary);
  border-color: var(--color-interactive-primary);
  color: white;
}

.nav-action-btn.active:hover {
  background: var(--color-interactive-primary-hover);
  border-color: var(--color-interactive-primary-hover);
}

.nav-action-btn:focus-visible {
  outline: 2px solid var(--color-interactive-primary);
  outline-offset: 2px;
}

/* Task Badge */
.nav-action-btn.has-badge {
  overflow: visible;
}

.task-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--color-semantic-error);
  border: 2px solid var(--color-bg-primary);
  border-radius: 8px;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  color: white;
  line-height: 1;
}

/* ========================================
   User Menu
   ======================================== */

.user-menu {
  position: relative;
}

.user-avatar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: 2px solid transparent;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.15s ease;
}

.user-avatar-btn:hover {
  border-color: var(--color-border-secondary);
}

.user-avatar-btn.active {
  border-color: var(--color-interactive-primary);
}

.user-avatar-btn:focus-visible {
  outline: 2px solid var(--color-interactive-primary);
  outline-offset: 2px;
}

.user-avatar {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  object-fit: cover;
}

.user-avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-interactive-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

/* ========================================
   User Dropdown
   ======================================== */

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 240px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08);
  padding: var(--space-2);
  z-index: 10000;
}

.dropdown-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  margin-bottom: var(--space-1);
}

.dropdown-avatar,
.dropdown-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.dropdown-avatar {
  border: 2px solid var(--color-border-secondary);
  object-fit: cover;
}

.dropdown-avatar-placeholder {
  background: var(--color-interactive-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  border: 2px solid var(--color-border-secondary);
}

.dropdown-user-info {
  flex: 1;
  min-width: 0;
}

.dropdown-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-email {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border-primary);
  margin: var(--space-2) 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: none;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dropdown-item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.dropdown-item:hover {
  background: var(--color-bg-tertiary);
}

.dropdown-item.danger {
  color: var(--color-semantic-error);
}

.dropdown-item.danger:hover {
  background: var(--color-semantic-error);
  color: white;
}

/* ========================================
   Animations
   ======================================== */

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ========================================
   Responsive
   ======================================== */

@media (max-width: 968px) {
  .nav-center {
    max-width: 400px;
  }
}

@media (max-width: 768px) {
  .top-nav {
    height: 44px;
    padding: 0 var(--space-3);
  }

  .nav-center {
    display: none;
  }

  .nav-divider {
    display: none;
  }

  .workspace-selector {
    max-width: 200px;
    padding: var(--space-1) var(--space-2);
  }

  .workspace-name {
    font-size: var(--font-size-xs);
  }

  .nav-action-btn {
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 480px) {
  .brand-name {
    display: none;
  }

  .workspace-selector {
    max-width: 120px;
  }

  .chevron-icon {
    display: none;
  }
}
</style>