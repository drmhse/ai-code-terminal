<template>
  <div class="resource-alerts">
    <Transition
      v-for="alert in uiStore.activeResourceAlerts"
      :key="alert.id"
      name="alert"
      appear
    >
      <div 
        class="alert" 
        :class="[`alert-${alert.type}`, { 'alert-mobile': uiStore.isMobile }]"
      >
        <div class="alert-icon">
          <!-- Info icon -->
          <svg v-if="alert.type === 'info'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12,16v-4"></path>
            <path d="M12,8h.01"></path>
          </svg>
          
          <!-- Warning icon -->
          <svg v-else-if="alert.type === 'warning'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m21.73,18-8-14a2,2 0 0,0-3.48,0l-8,14A2,2 0 0,0,4,21H20a2,2 0 0,0,1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="m12 17h.01"/>
          </svg>
          
          <!-- Error icon -->
          <svg v-else-if="alert.type === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        
        <div class="alert-content">
          <div class="alert-title">{{ alert.title }}</div>
          <div v-if="alert.message" class="alert-message">{{ alert.message }}</div>
        </div>
        
        <button 
          @click="dismissAlert(alert.id)" 
          class="alert-dismiss"
          :aria-label="'Dismiss ' + alert.title"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()

const dismissAlert = (alertId: string) => {
  uiStore.removeResourceAlert(alertId)
}
</script>

<style scoped>
.resource-alerts {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
  pointer-events: none;
}

.alert {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 300px;
  pointer-events: auto;
  font-size: 14px;
  position: relative;
}

.alert-mobile {
  min-width: 280px;
  max-width: calc(100vw - 40px);
}

/* Alert type styles */
.alert-info {
  border-left: 4px solid var(--info);
}

.alert-info .alert-icon {
  color: var(--info);
}

.alert-warning {
  border-left: 4px solid var(--warning);
  background: color-mix(in srgb, var(--warning) 5%, var(--bg-secondary));
}

.alert-warning .alert-icon {
  color: var(--warning);
}

.alert-error {
  border-left: 4px solid var(--error);
  background: color-mix(in srgb, var(--error) 5%, var(--bg-secondary));
}

.alert-error .alert-icon {
  color: var(--error);
}

.alert-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  margin-bottom: 4px;
}

.alert-message {
  color: var(--text-secondary);
  line-height: 1.4;
  word-wrap: break-word;
}

.alert-dismiss {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-dismiss:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Animations */
.alert-enter-active,
.alert-leave-active {
  transition: all 0.3s ease;
}

.alert-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.alert-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.alert-enter-to,
.alert-leave-from {
  opacity: 1;
  transform: translateX(0) scale(1);
}

/* Progress bar for auto-dismiss */
.alert::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--primary);
  border-radius: 0 0 8px 8px;
  animation: alertProgress 5s linear forwards;
}

@keyframes alertProgress {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

/* Mobile adaptations */
@media (max-width: 768px) {
  .resource-alerts {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
  
  .alert {
    min-width: auto;
    width: 100%;
  }
  
  .alert-mobile {
    min-width: auto;
    max-width: none;
  }
}

/* Dark theme adaptations */
@media (prefers-color-scheme: dark) {
  .alert {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }
  
  .alert-warning {
    background: color-mix(in srgb, var(--warning) 8%, var(--bg-secondary));
  }
  
  .alert-error {
    background: color-mix(in srgb, var(--error) 8%, var(--bg-secondary));
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .alert-enter-active,
  .alert-leave-active {
    transition: opacity 0.2s ease;
  }
  
  .alert-enter-from,
  .alert-leave-to {
    transform: none;
  }
  
  .alert::after {
    animation: none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .alert {
    border-width: 2px;
  }
  
  .alert-info {
    border-left-width: 6px;
  }
  
  .alert-warning {
    border-left-width: 6px;
  }
  
  .alert-error {
    border-left-width: 6px;
  }
}
</style>