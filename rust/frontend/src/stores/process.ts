import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '@/services/api'
import { useUIStore } from '@/stores/ui'

export interface Process {
  id: string
  name: string
  pid?: number
  command: string
  args?: string[]
  working_directory: string
  environment_variables?: Record<string, string>
  status: string
  exit_code?: number
  start_time: string
  end_time?: string
  cpu_usage: number
  memory_usage: number
  restart_count: number
  max_restarts: number
  auto_restart: boolean
  user_id: string
  workspace_id?: string
  session_id?: string
  tags?: string[]
  data?: any
  created_at: string
  updated_at: string
}

export type ProcessStatus = 'Starting' | 'Running' | 'Stopped' | 'Failed' | 'Crashed' | 'Restarting' | 'Terminated'

export const useProcessStore = defineStore('process', () => {
  const processes = ref<Process[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const outputCache = ref<Map<string, string>>(new Map())
  
  const uiStore = useUIStore()

  // Computed properties
  const processesByWorkspace = computed(() => {
    const result: Record<string, Process[]> = {}
    processes.value.forEach(process => {
      if (process.workspace_id) {
        if (!result[process.workspace_id]) {
          result[process.workspace_id] = []
        }
        result[process.workspace_id].push(process)
      }
    })
    return result
  })

  const processesBySession = computed(() => {
    const result: Record<string, Process[]> = {}
    processes.value.forEach(process => {
      if (process.session_id) {
        if (!result[process.session_id]) {
          result[process.session_id] = []
        }
        result[process.session_id].push(process)
      }
    })
    return result
  })

  const runningProcesses = computed(() => {
    return processes.value.filter(p => p.status === 'Running')
  })

  const stoppedProcesses = computed(() => {
    return processes.value.filter(p => ['Stopped', 'Failed', 'Crashed', 'Terminated'].includes(p.status))
  })

  const workspaceProcesses = computed(() => {
    return (workspaceId: string) => processesByWorkspace.value[workspaceId] || []
  })

  const sessionProcesses = computed(() => {
    return (sessionId: string) => processesBySession.value[sessionId] || []
  })

  const processById = computed(() => {
    return (id: string) => processes.value.find(p => p.id === id) || null
  })

  // Actions
  const fetchProcesses = async (workspaceId?: string, sessionId?: string, status?: string) => {
    try {
      loading.value = true
      error.value = null
      const response = await apiService.getProcesses(workspaceId, sessionId, status)
      processes.value = response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch processes'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Load Processes',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const createProcess = async (processData: {
    name: string
    command: string
    args?: string[]
    working_directory: string
    environment_variables?: Record<string, string>
    max_restarts?: number
    auto_restart?: boolean
    workspace_id?: string
    session_id?: string
    tags?: string[]
  }) => {
    try {
      loading.value = true
      error.value = null
      
      const newProcess = await apiService.createProcess(processData)
      processes.value.push(newProcess)
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Process Created',
        message: `Process "${processData.name}" has been created successfully.`
      })
      
      return newProcess
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create process'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Create Process',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateProcess = async (id: string, updates: {
    name?: string
    command?: string
    args?: string[]
    working_directory?: string
    environment_variables?: Record<string, string>
    max_restarts?: number
    auto_restart?: boolean
    tags?: string[]
  }) => {
    try {
      loading.value = true
      error.value = null
      
      const updatedProcess = await apiService.updateProcess(id, updates)
      const index = processes.value.findIndex(p => p.id === id)
      
      if (index !== -1) {
        processes.value[index] = updatedProcess
      }
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Process Updated',
        message: `Process "${updatedProcess.name}" has been updated successfully.`
      })
      
      return updatedProcess
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update process'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Update Process',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteProcess = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      
      const processToDelete = processes.value.find(p => p.id === id)
      await apiService.deleteProcess(id)
      
      processes.value = processes.value.filter(p => p.id !== id)
      outputCache.value.delete(id)
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Process Deleted',
        message: processToDelete ? `Process "${processToDelete.name}" has been deleted.` : 'Process has been deleted.'
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete process'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Delete Process',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const stopProcess = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      
      await apiService.stopProcess(id)
      
      // Update local state
      const process = processes.value.find(p => p.id === id)
      if (process) {
        process.status = 'Stopped'
      }
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Process Stopped',
        message: process ? `Process "${process.name}" has been stopped.` : 'Process has been stopped.'
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop process'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Stop Process',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const restartProcess = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      
      await apiService.restartProcess(id)
      
      // Update local state
      const process = processes.value.find(p => p.id === id)
      if (process) {
        process.status = 'Restarting'
        process.restart_count += 1
      }
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Process Restarting',
        message: process ? `Process "${process.name}" is restarting...` : 'Process is restarting...'
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to restart process'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Restart Process',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const getProcessOutput = async (id: string, forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && outputCache.value.has(id)) {
        return outputCache.value.get(id)!
      }
      
      const output = await apiService.getProcessOutput(id)
      outputCache.value.set(id, output)
      
      return output
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get process output'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Get Process Output',
        message: error.value
      })
      throw err
    }
  }

  const refreshProcessStatus = async (id: string) => {
    try {
      const process = await apiService.getProcess(id)
      const index = processes.value.findIndex(p => p.id === id)
      
      if (index !== -1) {
        processes.value[index] = process
      }
      
      return process
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to refresh process status'
      console.error('Failed to refresh process status:', err)
      throw err
    }
  }

  const refreshAllProcesses = async () => {
    try {
      await fetchProcesses()
    } catch (err) {
      console.error('Failed to refresh all processes:', err)
    }
  }

  const clearError = () => {
    error.value = null
  }

  const clearProcesses = () => {
    processes.value = []
    outputCache.value.clear()
    error.value = null
  }

  const getStatusColor = (status: ProcessStatus): string => {
    switch (status) {
      case 'Running':
        return 'text-green-600'
      case 'Starting':
      case 'Restarting':
        return 'text-blue-600'
      case 'Stopped':
        return 'text-gray-600'
      case 'Failed':
      case 'Crashed':
        return 'text-red-600'
      case 'Terminated':
        return 'text-orange-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: ProcessStatus): string => {
    switch (status) {
      case 'Running':
        return '▶️'
      case 'Starting':
      case 'Restarting':
        return '⏳'
      case 'Stopped':
        return '⏸️'
      case 'Failed':
      case 'Crashed':
        return '❌'
      case 'Terminated':
        return '⏹️'
      default:
        return '❓'
    }
  }

  return {
    // State
    processes,
    loading,
    error,
    outputCache,
    
    // Computed
    processesByWorkspace,
    processesBySession,
    runningProcesses,
    stoppedProcesses,
    workspaceProcesses,
    sessionProcesses,
    processById,
    
    // Actions
    fetchProcesses,
    createProcess,
    updateProcess,
    deleteProcess,
    stopProcess,
    restartProcess,
    getProcessOutput,
    refreshProcessStatus,
    refreshAllProcesses,
    clearError,
    clearProcesses,
    
    // Utility methods
    getStatusColor,
    getStatusIcon
  }
})