<template>
  <div class="background-tasks-drawer">
    <!-- Backdrop -->
    <div class="drawer-backdrop" @click="$emit('close')"></div>

    <!-- Drawer Content -->
    <div class="drawer-content" :class="{ 'drawer-open': true }">
      <div class="drawer-header">
        <div class="header-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="9"></line>
            <line x1="9" y1="13" x2="15" y2="13"></line>
            <line x1="9" y1="17" x2="13" y2="17"></line>
          </svg>
          <h3>Background Tasks</h3>
        </div>
        <div class="header-actions">
          <button class="btn btn-icon btn-small" @click="showCreateModal = true" title="Create new process">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button class="btn btn-icon btn-small" @click="$emit('close')" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'all' }"
          @click="activeTab = 'all'"
        >
          All ({{ processes.length }})
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'running' }"
          @click="activeTab = 'running'"
        >
          Running ({{ runningProcesses.length }})
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'stopped' }"
          @click="activeTab = 'stopped'"
        >
          Stopped ({{ stoppedProcesses.length }})
        </button>
      </div>

      <!-- Process List -->
      <div class="process-list">
        <div v-if="loading" class="state-container">
          <div class="loading-spinner"></div>
          <p>Loading processes...</p>
        </div>

        <div v-else-if="error" class="state-container">
          <div class="error-icon">⚠️</div>
          <p>{{ error }}</p>
          <button @click="refreshProcesses" class="btn btn-small">Retry</button>
        </div>

        <div v-else-if="filteredProcesses.length === 0" class="state-container">
          <div class="empty-icon">📋</div>
          <p>No background tasks found</p>
          <button @click="showCreateModal = true" class="btn btn-primary btn-small">Create First Task</button>
        </div>

        <div
          v-for="process in filteredProcesses"
          :key="process.id"
          class="process-item"
          :class="{ 'is-running': process.status === 'Running' }"
        >
          <!-- Process Header -->
          <div class="process-header" @click="toggleProcessExpand(process.id)">
            <div class="process-info">
              <span class="process-status" :class="getStatusColor(process.status)">
                {{ getStatusIcon(process.status) }}
              </span>
              <span class="process-name">{{ process.name }}</span>
              <span class="process-status-text">{{ process.status }}</span>
            </div>
            <div class="process-actions">
              <button
                v-if="process.status === 'Running'"
                @click.stop="stopProcess(process.id)"
                class="action-btn stop"
                title="Stop process"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
              </button>
              <button
                v-if="process.status === 'Stopped' || process.status === 'Failed'"
                @click.stop="restartProcess(process.id)"
                class="action-btn restart"
                title="Restart process"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>
              <button
                @click.stop="deleteProcess(process.id)"
                class="action-btn delete"
                title="Delete process"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button
                @click.stop="toggleProcessExpand(process.id)"
                class="action-btn expand"
                :class="{ 'is-expanded': expandedProcesses.has(process.id) }"
                title="Toggle details"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
          </div>

          <!-- Process Details (Expanded) -->
          <div v-if="expandedProcesses.has(process.id)" class="process-details">
            <div class="detail-row">
              <span class="label">Command:</span>
              <code class="command">{{ process.command }} {{ process.args?.join(' ') || '' }}</code>
            </div>
            <div class="detail-row">
              <span class="label">Directory:</span>
              <span class="path">{{ process.working_directory }}</span>
            </div>
            <div class="detail-row">
              <span class="label">PID:</span>
              <span>{{ process.pid || 'N/A' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">CPU:</span>
              <span>{{ process.cpu_usage.toFixed(1) }}%</span>
            </div>
            <div class="detail-row">
              <span class="label">Memory:</span>
              <span>{{ formatMemory(process.memory_usage) }}</span>
            </div>
            <div class="detail-actions">
              <button @click="viewOutput(process.id)" class="btn btn-small">
                View Output
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Process Modal -->
      <div v-if="showCreateModal" class="create-modal-overlay" @click="showCreateModal = false">
        <div class="create-modal-content" @click.stop>
          <div class="modal-header">
            <h3>Create Background Task</h3>
            <button @click="showCreateModal = false" class="close-btn">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Name</label>
              <input
                v-model="newProcess.name"
                type="text"
                placeholder="My Dev Server"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Command</label>
              <input
                v-model="newProcess.command"
                type="text"
                placeholder="npm run dev"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Arguments (optional)</label>
              <input
                v-model="newProcess.argsText"
                type="text"
                placeholder="--port 3000 --host 0.0.0.0"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>Working Directory</label>
              <input
                v-model="newProcess.working_directory"
                type="text"
                :placeholder="workspaceStore.selectedWorkspace?.path || '/path/to/project'"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>
                <input
                  v-model="newProcess.auto_restart"
                  type="checkbox"
                  class="form-checkbox"
                />
                Auto-restart on failure
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="showCreateModal = false" class="btn btn-secondary btn-small">Cancel</button>
            <button @click="createProcess" class="btn btn-primary btn-small" :disabled="!canCreateProcess">
              Create Task
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useProcessStore } from '@/stores/process'
import { useWorkspaceStore } from '@/stores/workspace'

defineEmits<{
  close: []
}>()

const processStore = useProcessStore()
const workspaceStore = useWorkspaceStore()

// State
const activeTab = ref<'all' | 'running' | 'stopped'>('all')
const expandedProcesses = ref<Set<string>>(new Set())
const showCreateModal = ref(false)

// Form state
const newProcess = ref({
  name: '',
  command: '',
  argsText: '',
  working_directory: '',
  auto_restart: true,
  max_restarts: 3
})

// Computed
const { processes, loading, error, runningProcesses, stoppedProcesses } = processStore

const filteredProcesses = computed(() => {
  switch (activeTab.value) {
    case 'running':
      return runningProcesses
    case 'stopped':
      return stoppedProcesses
    default:
      return processes
  }
})

const canCreateProcess = computed(() => {
  return newProcess.value.name.trim() &&
         newProcess.value.command.trim() &&
         newProcess.value.working_directory.trim()
})

// Methods
const toggleProcessExpand = (processId: string) => {
  if (expandedProcesses.value.has(processId)) {
    expandedProcesses.value.delete(processId)
  } else {
    expandedProcesses.value.add(processId)
  }
}

const getStatusColor = (status: string) => {
  return processStore.getStatusColor(status as import('@/stores/process').ProcessStatus)
}

const getStatusIcon = (status: string) => {
  return processStore.getStatusIcon(status as import('@/stores/process').ProcessStatus)
}

const formatMemory = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

const refreshProcesses = async () => {
  try {
    await processStore.fetchProcesses(workspaceStore.selectedWorkspace?.id)
  } catch (err) {
    console.error('Failed to refresh processes:', err)
  }
}

const stopProcess = async (processId: string) => {
  try {
    await processStore.stopProcess(processId)
  } catch (err) {
    console.error('Failed to stop process:', err)
  }
}

const restartProcess = async (processId: string) => {
  try {
    await processStore.restartProcess(processId)
  } catch (err) {
    console.error('Failed to restart process:', err)
  }
}

const deleteProcess = async (processId: string) => {
  try {
    await processStore.deleteProcess(processId)
    expandedProcesses.value.delete(processId)
  } catch (err) {
    console.error('Failed to delete process:', err)
  }
}

const createProcess = async () => {
  try {
    const args = newProcess.value.argsText.trim()
      ? newProcess.value.argsText.split(' ').filter(arg => arg.trim())
      : undefined

    const createRequest: {
      name: string
      command: string
      args?: string[]
      working_directory: string
      max_restarts?: number
      auto_restart?: boolean
      workspace_id?: string
    } = {
      name: newProcess.value.name.trim(),
      command: newProcess.value.command.trim(),
      working_directory: newProcess.value.working_directory.trim(),
      max_restarts: newProcess.value.max_restarts,
      auto_restart: newProcess.value.auto_restart,
      workspace_id: workspaceStore.selectedWorkspace?.id
    }

    if (args && args.length > 0) {
      createRequest.args = args
    }

    await processStore.createProcess(createRequest)

    // Reset form
    newProcess.value = {
      name: '',
      command: '',
      argsText: '',
      working_directory: workspaceStore.selectedWorkspace?.path || '',
      auto_restart: true,
      max_restarts: 3
    }

    showCreateModal.value = false
  } catch (err) {
    console.error('Failed to create process:', err)
  }
}

const viewOutput = async (processId: string) => {
  // This would open output in a separate modal or navigate to output view
  console.log('View output for process:', processId)
}

// Lifecycle
let refreshInterval: number

onMounted(async () => {
  if (workspaceStore.selectedWorkspace?.path) {
    newProcess.value.working_directory = workspaceStore.selectedWorkspace.path
  }

  await refreshProcesses()

  refreshInterval = window.setInterval(() => {
    if (runningProcesses.length > 0) {
      refreshProcesses()
    }
  }, 5000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.background-tasks-drawer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.drawer-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.drawer-content {
  width: 400px;
  height: 100vh;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: relative;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
}

.drawer-content.drawer-open {
  transform: translateX(0);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.filter-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: var(--button-hover);
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.process-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.state-container p {
  margin: 8px 0 16px 0;
  font-size: 13px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.process-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 6px;
  overflow: hidden;
  transition: all 0.15s ease;
}

.process-item:hover {
  border-color: var(--border-focus);
}

.process-item.is-running {
  border-color: var(--success);
}

.process-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}

.process-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.process-status {
  font-size: 12px;
  flex-shrink: 0;
}

.process-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.process-status-text {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.process-actions {
  display: flex;
  gap: 2px;
}

.action-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: var(--bg-secondary);
  border-radius: 3px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.action-btn.stop:hover {
  background: var(--error);
  color: white;
}

.action-btn.restart:hover {
  background: var(--success);
  color: white;
}

.action-btn.delete:hover {
  background: var(--error);
  color: white;
}

.action-btn.expand.is-expanded svg {
  transform: rotate(180deg);
}

.process-details {
  padding: 12px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
}

.label {
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 60px;
  flex-shrink: 0;
}

.command {
  flex: 1;
  background: var(--bg-primary);
  padding: 3px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 10px;
  word-break: break-all;
}

.path {
  flex: 1;
  color: var(--text-secondary);
  font-family: monospace;
  font-size: 10px;
  word-break: break-all;
}

.detail-actions {
  margin-top: 8px;
}

/* Modal Styles */
.create-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.create-modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(0, 123, 204, 0.1);
}

.form-checkbox {
  margin-right: 6px;
}

/* Button Styles */
.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-small {
  padding: 4px 8px;
  font-size: 11px;
}

.btn-icon {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 4px;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--button-hover);
}

@media (max-width: 768px) {
  .drawer-content {
    width: 100%;
  }
}
</style>