<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

onMounted(async () => {
  // Initialize authentication state
  await authStore.checkAuthStatus()
})
</script>

<style>
/* Dynamic Theme Variables - Updated via JavaScript */
:root {
  /* Background Colors */
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d30;
  --bg-sidebar: #181818;

  /* Text Colors */
  --text-primary: #cccccc;
  --text-secondary: #969696;
  --text-muted: #6a6a6a;

  /* Border & Divider Colors */
  --border-color: #3c3c3c;
  --shadow: rgba(0, 0, 0, 0.3);

  /* Semantic Action Colors */
  --primary: #007acc;
  --primary-hover: #1177bb;
  --success: #16825d;
  --success-hover: #1a9854;
  --error: #f14c4c;
  --error-hover: #e03e3e;
  --warning: #ff8c00;
  --info: #c678dd;

  /* Component-specific Variables */
  --button-bg: var(--bg-tertiary);
  --button-hover: color-mix(in srgb, var(--border-color) 20%, var(--bg-tertiary) 80%);
  --button-secondary-bg: var(--bg-tertiary);
  --button-secondary-hover: var(--bg-secondary);
  --input-bg: var(--bg-tertiary);
  --terminal-bg: var(--bg-primary);

  /* Interactive States */
  --sidebar-item-hover-bg: var(--bg-secondary);
  --sidebar-item-selected-bg: var(--text-primary);
  --sidebar-item-bg: var(--bg-secondary);

  /* Enhanced Variables for Comprehensive Theming */
  --scrollbar-slider: #79797966;
  --scrollbar-slider-hover: #646464b3;
  --modal-backdrop: rgba(0, 0, 0, 0.6);

  /* Component-specific Variables */
  --tab-border: var(--border-color);
  --tab-bg: var(--bg-tertiary);
  --tab-active-bg: var(--text-primary);
}

/* Global Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.4;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  transition: opacity 0.3s ease-in-out;
}

/* Enhanced focus styles */
*:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Smooth transitions for all interactive elements */
button, input, select, textarea, a {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Enhanced scroll behavior */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-slider) transparent;
}

*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

*::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 4px;
}

*::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-slider);
  border-radius: 4px;
  border: 1px solid transparent;
  background-clip: content-box;
}

*::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-slider-hover);
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-slider);
  border-radius: 6px;
  border: 2px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-slider-hover);
}

/* Enhanced Button Styles */
.btn {
  padding: 10px 18px;
  border: 1px solid var(--border-color);
  background: var(--button-bg);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s;
}

.btn:hover {
  background: var(--button-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn:hover::before {
  left: 100%;
}

.btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  border-color: var(--primary);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 123, 204, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--primary-hover) 0%, var(--primary) 100%);
  border-color: var(--primary-hover);
  box-shadow: 0 6px 16px rgba(0, 123, 204, 0.4);
}

.btn-github {
  background: #24292e;
  border-color: #24292e;
  color: white;
}

.btn-github:hover {
  background: #2f363d;
  border-color: #2f363d;
}

/* Input Styles */
.input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-primary);
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.input:focus {
  border-color: var(--primary);
}

/* Enhanced Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 32px;
  min-width: 420px;
  max-width: 640px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  animation: slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Error Styles */
.error-message {
  background: color-mix(in srgb, var(--error) 20%, transparent);
  border: 1px solid var(--error);
  color: var(--error);
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 13px;
}

/* Success Styles */
.success-message {
  background: color-mix(in srgb, var(--success) 20%, transparent);
  border: 1px solid var(--success);
  color: var(--success);
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 13px;
}
</style>