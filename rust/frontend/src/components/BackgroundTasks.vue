<template>
  <div class="background-tasks">
    <!-- Header -->
    <div class="tasks-header">
      <h3>Background Tasks</h3>
      <button 
        class="btn btn-icon btn-sm"
        @click="showCreateModal = true"
        title="Create new process"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
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
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading processes...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <div class="error-icon">⚠️</div>
        <p>{{ error }}</p>
        <button @click="refreshProcesses" class="btn btn-sm">Retry</button>
      </div>

      <div v-else-if="filteredProcesses.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No background tasks found</p>
        <button @click="showCreateModal = true" class="btn btn-primary btn-sm">Create First Task</button>
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12"></rect>
              </svg>
            </button>
            <button 
              v-if="process.status === 'Stopped' || process.status === 'Failed'"
              @click.stop="restartProcess(process.id)"
              class="action-btn restart"
              title="Restart process"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
            <button 
              @click.stop="deleteProcess(process.id)"
              class="action-btn delete"
              title="Delete process"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
            <span class="label">Working Directory:</span>
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
          <div class="detail-row">
            <span class="label">Restarts:</span>
            <span>{{ process.restart_count }} / {{ process.max_restarts }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Started:</span>
            <span>{{ formatTime(process.start_time) }}</span>
          </div>
          <div v-if="process.end_time" class="detail-row">
            <span class="label">Ended:</span>
            <span>{{ formatTime(process.end_time) }}</span>
          </div>
          <div v-if="process.tags && process.tags.length > 0" class="detail-row">
            <span class="label">Tags:</span>
            <div class="tags">
              <span v-for="tag in process.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
          <div class="detail-actions">
            <button @click="viewOutput(process.id)" class="btn btn-sm">
              View Output
            </button>
            <button @click="editProcess(process)" class="btn btn-sm">
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Process Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal-content" @click.stop>
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
            <label>Environment Variables (optional)</label>
            <textarea 
              v-model="newProcess.envText" 
              placeholder="PORT=3000&#10;NODE_ENV=development"
              class="form-textarea"
              rows="3"
            ></textarea>
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
          <div class="form-group">
            <label>Max Restarts</label>
            <input 
              v-model.number="newProcess.max_restarts" 
              type="number" 
              min="0" 
              max="100"
              class="form-input"
              style="width: 100px;"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showCreateModal = false" class="btn btn-secondary">Cancel</button>
          <button @click="createProcess" class="btn btn-primary" :disabled="!canCreateProcess">
            Create Task
          </button>
        </div>
      </div>
    </div>

    <!-- Output Modal -->
    <div v-if="showOutputModal" class="modal-overlay" @click="showOutputModal = false">
      <div class="modal-content modal-output" @click.stop>
        <div class="modal-header">
          <h3>Process Output - {{ selectedProcess?.name }}</h3>
          <button @click="showOutputModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div v-if="outputLoading" class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading output...</p>
          </div>
          <div v-else-if="outputError" class="error-state">
            <p>{{ outputError }}</p>
            <button @click="loadOutput" class="btn btn-sm">Retry</button>
          </div>
          <pre v-else class="process-output">{{ processOutput || 'No output available' }}</pre>
        </div>
        <div class="modal-footer">
          <button @click="refreshOutput" class="btn btn-sm">Refresh</button>
          <button @click="showOutputModal = false" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useProcessStore } from '@/stores/process'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Process } from '@/stores/process'

const processStore = useProcessStore()
const workspaceStore = useWorkspaceStore()

// State
const activeTab = ref<'all' | 'running' | 'stopped'>('all')
const expandedProcesses = ref<Set<string>>(new Set())
const showCreateModal = ref(false)
const showOutputModal = ref(false)
const selectedProcess = ref<Process | null>(null)
const processOutput = ref('')
const outputLoading = ref(false)
const outputError = ref('')

// Form state
const newProcess = ref({
  name: '',
  command: '',
  argsText: '',
  working_directory: '',
  envText: '',
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
  return processStore.getStatusColor(status as any)
}

const getStatusIcon = (status: string) => {
  return processStore.getStatusIcon(status as any)
}

const formatMemory = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

const formatTime = (timeString: string) => {
  return new Date(timeString).toLocaleString()
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

    const envVars = newProcess.value.envText.trim()
      ? newProcess.value.envText.split('\n').reduce((acc, line) => {
          const [key, ...valueParts] = line.split('=')
          if (key && valueParts.length > 0) {
            acc[key.trim()] = valueParts.join('=').trim()
          }
          return acc
        }, {} as Record<string, string>)
      : undefined

    const createRequest: any = {
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
    
    if (envVars && Object.keys(envVars).length > 0) {
      createRequest.environment_variables = envVars
    }
    
    await processStore.createProcess(createRequest)

    // Reset form
    newProcess.value = {
      name: '',
      command: '',
      argsText: '',
      working_directory: workspaceStore.selectedWorkspace?.path || '',
      envText: '',
      auto_restart: true,
      max_restarts: 3
    }

    showCreateModal.value = false
  } catch (err) {
    console.error('Failed to create process:', err)
  }
}

const editProcess = (process: Process) => {
  // Pre-fill form with existing process data
  newProcess.value = {
    name: process.name,
    command: process.command,
    argsText: process.args?.join(' ') || '',
    working_directory: process.working_directory,
    envText: Object.entries(process.environment_variables || {})
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
    auto_restart: process.auto_restart,
    max_restarts: process.max_restarts
  }
  showCreateModal.value = true
}

const viewOutput = async (processId: string) => {
  selectedProcess.value = processStore.processById(processId)
  showOutputModal.value = true
  await loadOutput()
}

const loadOutput = async () => {
  if (!selectedProcess.value) return

  outputLoading.value = true
  outputError.value = ''

  try {
    processOutput.value = await processStore.getProcessOutput(selectedProcess.value.id, true)
  } catch (err) {
    outputError.value = err instanceof Error ? err.message : 'Failed to load output'
  } finally {
    outputLoading.value = false
  }
}

const refreshOutput = () => {
  loadOutput()
}

// Lifecycle
let refreshInterval: number

onMounted(async () => {
  // Set default working directory
  if (workspaceStore.selectedWorkspace?.path) {
    newProcess.value.working_directory = workspaceStore.selectedWorkspace.path
  }

  // Load processes
  await refreshProcesses()

  // Auto-refresh processes every 5 seconds
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
.background-tasks {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
}

.tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.tasks-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.filter-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
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

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.process-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
  transition: all 0.2s;
}

.process-item:hover {
  border-color: var(--border-hover);
}

.process-item.is-running {
  border-color: var(--success);
}

.process-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  cursor: pointer;
  user-select: none;
}

.process-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.process-status {
  font-size: 14px;
}

.process-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 13px;
}

.process-status-text {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

.process-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: var(--bg-secondary);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn.stop:hover {
  background: var(--error-bg);
  color: var(--error);
}

.action-btn.restart:hover {
  background: var(--success-bg);
  color: var(--success);
}

.action-btn.delete:hover {
  background: var(--error-bg);
  color: var(--error);
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
  margin-bottom: 8px;
  font-size: 12px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 80px;
}

.command {
  flex: 1;
  background: var(--bg-primary);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.path {
  flex: 1;
  color: var(--text-secondary);
  font-family: monospace;
  font-size: 11px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  background: var(--primary-bg);
  color: var(--primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-output {
  max-width: 800px;
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
  font-size: 16px;
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
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
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
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.form-checkbox {
  margin-right: 8px;
}

.process-output {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  max-height: 400px;
  overflow-y: auto;
  color: var(--text-primary);
}

/* Button Styles */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
}

.btn-icon.btn-sm {
  width: 24px;
  height: 24px;
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
  background: var(--bg-hover);
}
</style>