export interface TerminalTab {
  id: string
  sessionId: string
  name: string
  isActive: boolean
  order: number
  buffer: string
  cwd?: string
  size: {
    cols: number
    rows: number
  }
  pid?: number
}

export type SplitDirection = 'horizontal' | 'vertical'

export interface PaneNode {
  id: string
  type: 'container' | 'terminal'
  size: number // percentage of parent space (0-100)

  // Container properties
  direction?: SplitDirection
  children?: PaneNode[]

  // Terminal properties
  tabs?: TerminalTab[]
  activeTabId?: string | null
  isActive?: boolean
  name?: string
}

export interface PaneLayout {
  root: PaneNode
  activeNodeId: string
}

export interface PaneTreeState {
  layout: PaneLayout
  currentWorkspaceId: string | null
}

// Helper type for tree traversal results
export interface TraversalResult {
  node: PaneNode
  parent?: PaneNode
  parentIndex?: number
  path: number[]
}

// Split operation result
export interface SplitResult {
  success: boolean
  newLayout: PaneLayout
  newPaneId?: string
  error?: string
}

// Tree manipulation options
export interface SplitOptions {
  nodeId: string
  direction: SplitDirection
  newPaneData?: {
    name?: string
    initialTab?: Partial<TerminalTab>
  }
}

export interface MergeOptions {
  nodeId: string
}

// Node creation helpers
export interface CreateTerminalNodeOptions {
  id?: string
  name?: string
  tabs?: TerminalTab[]
  size?: number
  isActive?: boolean
}

export interface CreateContainerNodeOptions {
  id?: string
  direction: SplitDirection
  children: PaneNode[]
  size?: number
}