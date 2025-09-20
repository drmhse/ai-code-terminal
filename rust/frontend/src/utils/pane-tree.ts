import type {
  PaneNode,
  PaneLayout,
  SplitDirection,
  TraversalResult,
  SplitResult,
  SplitOptions,
  CreateTerminalNodeOptions,
  CreateContainerNodeOptions,
  TerminalTab
} from '@/types/pane-tree'

/**
 * Generate a unique pane ID
 */
export function generatePaneId(): string {
  return `pane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate a unique tab ID
 */
export function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a terminal node
 */
export function createTerminalNode(options: CreateTerminalNodeOptions = {}): PaneNode {
  const {
    id = generatePaneId(),
    name = 'Terminal',
    tabs = [],
    size = 100,
    isActive = false
  } = options

  return {
    id,
    type: 'terminal',
    size,
    tabs,
    activeTabId: tabs.find(tab => tab.isActive)?.id || tabs[0]?.id || null,
    isActive,
    name
  }
}

/**
 * Create a container node
 */
export function createContainerNode(options: CreateContainerNodeOptions): PaneNode {
  const { id = generatePaneId(), direction, children, size = 100 } = options

  return {
    id,
    type: 'container',
    size,
    direction,
    children
  }
}

/**
 * Find a node by ID in the tree
 */
export function findNode(root: PaneNode, targetId: string): TraversalResult | null {
  function traverse(node: PaneNode, parent?: PaneNode, parentIndex?: number, path: number[] = []): TraversalResult | null {
    if (node.id === targetId) {
      return { node, parent, parentIndex, path }
    }

    if (node.type === 'container' && node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const result = traverse(node.children[i], node, i, [...path, i])
        if (result) return result
      }
    }

    return null
  }

  return traverse(root)
}

/**
 * Find the active terminal node in the tree
 */
export function findActiveTerminalNode(root: PaneNode): TraversalResult | null {
  function traverse(node: PaneNode, parent?: PaneNode, parentIndex?: number, path: number[] = []): TraversalResult | null {
    if (node.type === 'terminal' && node.isActive) {
      return { node, parent, parentIndex, path }
    }

    if (node.type === 'container' && node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const result = traverse(node.children[i], node, i, [...path, i])
        if (result) return result
      }
    }

    return null
  }

  return traverse(root)
}

/**
 * Get all terminal nodes from the tree
 */
export function getAllTerminalNodes(root: PaneNode): PaneNode[] {
  const terminals: PaneNode[] = []

  function traverse(node: PaneNode) {
    if (node.type === 'terminal') {
      terminals.push(node)
    } else if (node.type === 'container' && node.children) {
      node.children.forEach(traverse)
    }
  }

  traverse(root)
  return terminals
}

/**
 * Set active node and deactivate others
 */
export function setActiveNode(layout: PaneLayout, nodeId: string): PaneLayout {
  const newLayout = JSON.parse(JSON.stringify(layout)) as PaneLayout

  // Deactivate all terminal nodes
  function deactivateAll(node: PaneNode) {
    if (node.type === 'terminal') {
      node.isActive = false
    } else if (node.type === 'container' && node.children) {
      node.children.forEach(deactivateAll)
    }
  }

  deactivateAll(newLayout.root)

  // Activate the target node
  const targetResult = findNode(newLayout.root, nodeId)
  if (targetResult && targetResult.node.type === 'terminal') {
    targetResult.node.isActive = true
    newLayout.activeNodeId = nodeId
  }

  return newLayout
}

/**
 * Split a terminal node into a container with two terminal children
 */
export function splitNode(layout: PaneLayout, options: SplitOptions): SplitResult {
  const { nodeId, direction, newPaneData = {} } = options

  try {
    // Deep clone the layout to avoid mutations
    const newLayout = JSON.parse(JSON.stringify(layout)) as PaneLayout

    // Find the node to split
    const nodeResult = findNode(newLayout.root, nodeId)
    if (!nodeResult) {
      return { success: false, newLayout: layout, error: 'Node not found' }
    }

    const { node, parent, parentIndex } = nodeResult

    // Can only split terminal nodes
    if (node.type !== 'terminal') {
      return { success: false, newLayout: layout, error: 'Can only split terminal nodes' }
    }

    // Create new terminal node for the split
    const newTerminalId = generatePaneId()
    const newTerminalNode = createTerminalNode({
      id: newTerminalId,
      name: newPaneData.name || 'Terminal',
      tabs: newPaneData.initialTab ? [newPaneData.initialTab as TerminalTab] : [],
      size: 50,
      isActive: false
    })

    // Modify the existing terminal node
    const existingTerminal = { ...node, size: 50 }

    // Create container node to hold both terminals
    const containerNode = createContainerNode({
      direction,
      children: [existingTerminal, newTerminalNode],
      size: node.size // Inherit the original node's size
    })

    // Replace the original node with the container
    if (!parent) {
      // Splitting the root node
      newLayout.root = containerNode
    } else if (parent.type === 'container' && parent.children && parentIndex !== undefined) {
      // Replace in parent's children array
      parent.children[parentIndex] = containerNode
    } else {
      return { success: false, newLayout: layout, error: 'Invalid parent structure' }
    }

    return {
      success: true,
      newLayout,
      newPaneId: newTerminalId
    }
  } catch (error) {
    return {
      success: false,
      newLayout: layout,
      error: `Split operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Calculate CSS flex properties for a container's children
 */
export function calculateFlexProperties(container: PaneNode): Array<{ flex: string }> {
  if (container.type !== 'container' || !container.children) {
    return []
  }

  return container.children.map(child => ({
    flex: `${child.size} 1 0%`
  }))
}

/**
 * Get CSS flex direction from split direction
 */
export function getFlexDirection(direction: SplitDirection): 'row' | 'column' {
  return direction === 'horizontal' ? 'column' : 'row'
}

/**
 * Redistribute sizes when a node is removed (for future merge functionality)
 */
export function redistributeSizes(siblings: PaneNode[], removedSize: number): PaneNode[] {
  if (siblings.length === 0) return siblings

  const totalCurrentSize = siblings.reduce((sum, sibling) => sum + sibling.size, 0)
  const availableSize = totalCurrentSize + removedSize

  // Distribute proportionally
  return siblings.map(sibling => ({
    ...sibling,
    size: (sibling.size / totalCurrentSize) * availableSize
  }))
}

/**
 * Validate that a pane tree is structurally correct
 */
export function validatePaneTree(root: PaneNode): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  function validate(node: PaneNode, path: string = 'root') {
    // Check node type
    if (node.type !== 'terminal' && node.type !== 'container') {
      errors.push(`Invalid node type at ${path}: ${node.type}`)
      return
    }

    // Check size
    if (typeof node.size !== 'number' || node.size < 0 || node.size > 100) {
      errors.push(`Invalid size at ${path}: ${node.size}`)
    }

    if (node.type === 'container') {
      // Container must have direction and children
      if (!node.direction) {
        errors.push(`Container at ${path} missing direction`)
      }
      if (!node.children || !Array.isArray(node.children)) {
        errors.push(`Container at ${path} missing children array`)
      } else if (node.children.length === 0) {
        errors.push(`Container at ${path} has empty children array`)
      } else {
        // Validate children
        node.children.forEach((child, index) => {
          validate(child, `${path}.children[${index}]`)
        })

        // Check that children sizes approximately sum to 100
        const totalSize = node.children.reduce((sum, child) => sum + child.size, 0)
        if (Math.abs(totalSize - 100) > 1) { // Allow 1% tolerance for floating point errors
          errors.push(`Children sizes at ${path} don't sum to 100: ${totalSize}`)
        }
      }
    } else if (node.type === 'terminal') {
      // Terminal must have tabs array
      if (!node.tabs || !Array.isArray(node.tabs)) {
        errors.push(`Terminal at ${path} missing tabs array`)
      }
    }
  }

  validate(root)
  return { valid: errors.length === 0, errors }
}

/**
 * Create initial layout with a single terminal pane
 */
export function createInitialLayout(workspaceId: string, initialTab?: TerminalTab): PaneLayout {
  const terminalId = generatePaneId()
  const tabs = initialTab ? [initialTab] : []

  const root = createTerminalNode({
    id: terminalId,
    name: 'Terminal',
    tabs,
    size: 100,
    isActive: true
  })

  return {
    root,
    activeNodeId: terminalId
  }
}

