import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '@/services/api'
import { useUIStore } from '@/stores/ui'

export interface Layout {
  id: string
  name: string
  layout_type: string
  tree_structure: string
  is_default: boolean
  workspace_id: string
  created_at: string
  updated_at: string
}

export const useLayoutStore = defineStore('layout', () => {
  const layouts = ref<Layout[]>([])
  const currentLayout = ref<Layout | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const saveTimeout = ref<number | null>(null)
  
  const uiStore = useUIStore()

  // Computed properties
  const layoutsByWorkspace = computed(() => {
    const result: Record<string, Layout[]> = {}
    layouts.value.forEach(layout => {
      if (!result[layout.workspace_id]) {
        result[layout.workspace_id] = []
      }
      result[layout.workspace_id].push(layout)
    })
    return result
  })

  const defaultLayout = computed(() => {
    return layouts.value.find(layout => layout.is_default) || null
  })

  const workspaceLayouts = computed(() => {
    return (workspaceId: string) => layoutsByWorkspace.value[workspaceId] || []
  })

  // Actions
  const fetchLayouts = async (workspaceId?: string) => {
    try {
      loading.value = true
      error.value = null
      const response = await apiService.getLayouts(workspaceId)
      layouts.value = response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch layouts'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Load Layouts',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const createLayout = async (layoutData: {
    name: string
    layout_type: string
    tree_structure: string
    workspace_id: string
    is_default?: boolean
  }) => {
    try {
      loading.value = true
      error.value = null
      
      const newLayout = await apiService.createLayout(layoutData)
      layouts.value.push(newLayout)
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Layout Created',
        message: `Layout "${layoutData.name}" has been created successfully.`
      })
      
      return newLayout
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create layout'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Create Layout',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateLayout = async (id: string, updates: {
    name?: string
    tree_structure?: string
    is_default?: boolean
  }) => {
    try {
      loading.value = true
      error.value = null
      
      const updatedLayout = await apiService.updateLayout(id, updates)
      const index = layouts.value.findIndex(l => l.id === id)
      
      if (index !== -1) {
        // If setting as default, unset other defaults for the same workspace
        if (updates.is_default) {
          const workspaceId = layouts.value[index].workspace_id
          layouts.value.forEach(layout => {
            if (layout.workspace_id === workspaceId && layout.id !== id) {
              layout.is_default = false
            }
          })
        }
        
        layouts.value[index] = updatedLayout
      }
      
      if (currentLayout.value?.id === id) {
        currentLayout.value = updatedLayout
      }
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Layout Updated',
        message: `Layout "${updatedLayout.name}" has been updated successfully.`
      })
      
      return updatedLayout
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update layout'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Update Layout',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteLayout = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      
      const layoutToDelete = layouts.value.find(l => l.id === id)
      await apiService.deleteLayout(id)
      
      layouts.value = layouts.value.filter(l => l.id !== id)
      
      if (currentLayout.value?.id === id) {
        currentLayout.value = null
      }
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Layout Deleted',
        message: layoutToDelete ? `Layout "${layoutToDelete.name}" has been deleted.` : 'Layout has been deleted.'
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete layout'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Delete Layout',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const setDefaultLayout = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      
      await apiService.setDefaultLayout(id)
      
      // Update local state
      const layout = layouts.value.find(l => l.id === id)
      if (layout) {
        const workspaceId = layout.workspace_id
        layouts.value.forEach(l => {
          if (l.workspace_id === workspaceId) {
            l.is_default = l.id === id
          }
        })
      }
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Default Layout Set',
        message: layout ? `"${layout.name}" has been set as the default layout.` : 'Default layout has been updated.'
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to set default layout'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Set Default Layout',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const duplicateLayout = async (id: string, name?: string) => {
    try {
      loading.value = true
      error.value = null
      
      const duplicatedLayout = await apiService.duplicateLayout(id, name)
      layouts.value.push(duplicatedLayout)
      
      uiStore.addResourceAlert({
        type: 'info',
        title: 'Layout Duplicated',
        message: `Layout "${duplicatedLayout.name}" has been created successfully.`
      })
      
      return duplicatedLayout
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to duplicate layout'
      uiStore.addResourceAlert({
        type: 'error',
        title: 'Failed to Duplicate Layout',
        message: error.value
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  const setCurrentLayout = (layout: Layout | null) => {
    currentLayout.value = layout
  }

  const saveCurrentLayout = async (name: string, workspaceId: string, treeStructure: string, layoutType = 'hierarchical', isDefault = false) => {
    try {
      if (currentLayout.value) {
        // Update existing layout
        await updateLayout(currentLayout.value.id, {
          name,
          tree_structure: treeStructure,
          is_default: isDefault
        })
      } else {
        // Create new layout
        const newLayout = await createLayout({
          name,
          layout_type: layoutType,
          tree_structure: treeStructure,
          workspace_id: workspaceId,
          is_default: isDefault
        })
        setCurrentLayout(newLayout)
      }
    } catch (err) {
      console.error('Failed to save current layout:', err)
      throw err
    }
  }

  const debouncedSaveLayout = (name: string, workspaceId: string, treeStructure: string, layoutType = 'hierarchical', isDefault = false) => {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value)
    }

    saveTimeout.value = window.setTimeout(() => {
      saveCurrentLayout(name, workspaceId, treeStructure, layoutType, isDefault)
    }, 1000) // 1 second debounce
  }

  const clearError = () => {
    error.value = null
  }

  const clearLayouts = () => {
    layouts.value = []
    currentLayout.value = null
    error.value = null
  }

  return {
    // State
    layouts,
    currentLayout,
    loading,
    error,
    
    // Computed
    layoutsByWorkspace,
    defaultLayout,
    workspaceLayouts,
    
    // Actions
    fetchLayouts,
    createLayout,
    updateLayout,
    deleteLayout,
    setDefaultLayout,
    duplicateLayout,
    setCurrentLayout,
    saveCurrentLayout,
    debouncedSaveLayout,
    clearError,
    clearLayouts
  }
})