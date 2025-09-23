<template>
  <div class="top-nav">
    <div class="nav-left">
      <!-- Mobile Menu Toggle -->
      <button
        v-if="uiStore.isMobile"
        @click="toggleSidebar"
        class="mobile-menu-btn"
        title="Toggle sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <div class="app-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4,17 10,11 4,5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        AI Code Terminal
      </div>
    </div>

    <div class="nav-center">
      <!-- Current Workspace Info -->
      <div v-if="workspaceStore.selectedWorkspace" class="workspace-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
        {{ workspaceStore.selectedWorkspace.name }}
      </div>
    </div>

    <div class="nav-right">
      <!-- Background Tasks Button -->
      <button
        v-if="workspaceStore.selectedWorkspace"
        @click="toggleBackgroundTasks"
        class="nav-btn"
        :class="{ active: uiStore.showBackgroundTasks }"
        title="Background Tasks"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="9" x2="15" y2="9"></line>
          <line x1="9" y1="13" x2="15" y2="13"></line>
          <line x1="9" y1="17" x2="13" y2="17"></line>
        </svg>
        <span class="btn-text">Tasks</span>
      </button>

      <!-- Theme Toggle -->
      <button
        @click="uiStore.toggleThemeModal()"
        class="nav-btn"
        title="Change theme"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      </button>

      <!-- User Menu -->
      <div v-if="authStore.user" class="user-menu" @click.stop>
        <button
          @click="toggleUserDropdown"
          class="user-button"
          :class="{ active: showUserDropdown }"
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
        <div v-if="showUserDropdown" class="user-dropdown">
          <div class="user-dropdown-header">
            <img
              v-if="authStore.user.avatar_url"
              :src="authStore.user.avatar_url"
              :alt="authStore.user.login"
              class="user-avatar-large"
            />
            <div v-else class="user-avatar-placeholder-large">
              {{ (authStore.user.login || 'U')[0].toUpperCase() }}
            </div>
            <div class="user-info">
              <div class="user-login">{{ authStore.user.login }}</div>
              <div class="user-email">{{ authStore.user.email || 'No email' }}</div>
            </div>
          </div>

          <div class="user-dropdown-divider"></div>

          <button @click="handleLogout" class="user-dropdown-item danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16,17 21,12 16,7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'

const uiStore = useUIStore()
const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()

// User dropdown state
const showUserDropdown = ref(false)

const toggleSidebar = () => {
  uiStore.toggleSidebar()
}

const toggleBackgroundTasks = () => {
  uiStore.setShowBackgroundTasks(!uiStore.showBackgroundTasks)
}

const toggleUserDropdown = () => {
  showUserDropdown.value = !showUserDropdown.value
}

const closeUserDropdown = () => {
  showUserDropdown.value = false
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
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  height: var(--space-10); /* 40px */
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
  position: relative;
  z-index: var(--z-sticky);
  font-family: var(--font-family-sans);
}

.nav-left,
.nav-center,
.nav-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.nav-center {
  flex: 1;
  justify-content: center;
}

.mobile-menu-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--button-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-colors);
  height: var(--button-height-sm);
  width: var(--button-height-sm);
}

.mobile-menu-btn:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}

.app-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.025em;
}

.workspace-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--button-border-radius);
  border: 1px solid var(--color-border-secondary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: var(--transition-colors);
}

.nav-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--button-border-radius);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  transition: var(--transition-colors);
  height: var(--button-height-sm);
  min-width: var(--button-height-sm);
}

.nav-btn:hover {
  background: var(--color-interactive-tertiary-hover);
  color: var(--color-text-primary);
}

.nav-btn.active {
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-sm);
}

.nav-btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 1px;
}

.btn-text {
  font-weight: var(--font-weight-medium);
  line-height: 1;
}

.user-menu {
  position: relative;
  display: flex;
  align-items: center;
}

.user-button {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: var(--radius-full);
  transition: var(--transition-colors);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-button:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 1px;
}

.user-button.active .user-avatar,
.user-button.active .user-avatar-placeholder {
  border-color: var(--color-interactive-primary);
  box-shadow: 0 0 0 2px var(--color-interactive-primary-hover);
}

.user-avatar {
  width: var(--space-6);
  height: var(--space-6);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border-secondary);
  transition: var(--transition-colors);
}

.user-button:hover .user-avatar {
  border-color: var(--color-border-hover);
}

.user-avatar-placeholder {
  width: var(--space-6);
  height: var(--space-6);
  border-radius: var(--radius-full);
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  transition: var(--transition-colors);
  border: 1px solid var(--color-border-secondary);
}

.user-button:hover .user-avatar-placeholder {
  background: var(--color-interactive-primary-hover);
  border-color: var(--color-border-hover);
}

/* User Dropdown */
.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: var(--space-2) 0;
  min-width: 200px;
  z-index: 2000;
  animation: dropdownIn 0.15s ease-out;
}

.user-dropdown-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-1);
}

.user-avatar-large {
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border-secondary);
  flex-shrink: 0;
}

.user-avatar-placeholder-large {
  width: var(--space-8);
  height: var(--space-8);
  border-radius: var(--radius-full);
  background: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border: 1px solid var(--color-border-secondary);
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.user-login {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-dropdown-divider {
  height: 1px;
  background: var(--color-border-primary);
  margin: var(--space-1) 0;
}

.user-dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: none;
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  text-align: left;
  transition: var(--transition-colors);
}

.user-dropdown-item:hover {
  background: var(--color-interactive-tertiary-hover);
}

.user-dropdown-item:active {
  background: var(--color-bg-tertiary);
}

.user-dropdown-item.danger {
  color: var(--color-semantic-danger);
}

.user-dropdown-item.danger:hover {
  background: var(--color-semantic-danger);
  color: var(--color-text-inverse);
}

.user-dropdown-item svg {
  flex-shrink: 0;
  color: currentColor;
}

.user-dropdown-item span {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@media (max-width: 768px) {
  .nav-center {
    display: none;
  }

  .btn-text {
    display: none;
  }

  .workspace-info {
    max-width: 120px;
  }
}
</style>