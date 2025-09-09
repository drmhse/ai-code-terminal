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
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
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

/* Button Styles */
.btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: var(--button-bg);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  transition: all 0.15s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.btn:hover {
  background: var(--button-hover);
}

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
}

.btn-primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
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

/* Modal Styles */
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
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 24px;
  min-width: 400px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
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