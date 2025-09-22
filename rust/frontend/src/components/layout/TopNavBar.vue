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
      <div v-if="authStore.user" class="user-menu">
        <img
          v-if="authStore.user.avatar_url"
          :src="authStore.user.avatar_url"
          :alt="authStore.user.login"
          class="user-avatar"
        />
        <div v-else class="user-avatar-placeholder">
          {{ (authStore.user.login || 'U')[0].toUpperCase() }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'

const uiStore = useUIStore()
const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()

const toggleSidebar = () => {
  uiStore.toggleSidebar()
}

const toggleBackgroundTasks = () => {
  uiStore.setShowBackgroundTasks(!uiStore.showBackgroundTasks)
}
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
  display: flex;
  align-items: center;
}

.user-avatar {
  width: var(--space-6);
  height: var(--space-6);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border-secondary);
  transition: var(--transition-colors);
}

.user-avatar:hover {
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
  cursor: pointer;
}

.user-avatar-placeholder:hover {
  background: var(--color-interactive-primary-hover);
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