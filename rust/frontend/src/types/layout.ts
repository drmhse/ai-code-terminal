export type LayoutType = 'single' | 'horizontal-split' | 'vertical-split' | 'grid-2x2' | 'three-pane'

export interface LayoutConfiguration {
  type: LayoutType
  gridTemplateColumns: string
  gridTemplateRows: string
  minWidth?: number
  minHeight?: number
}

export interface LayoutRecommendations {
  supported: LayoutType[]
  recommended: LayoutType
}

export const LAYOUT_CONFIGS: Record<LayoutType, LayoutConfiguration> = {
  'single': {
    type: 'single',
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr'
  },
  'horizontal-split': {
    type: 'horizontal-split',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr',
    minWidth: 768
  },
  'vertical-split': {
    type: 'vertical-split',
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr 1fr',
    minWidth: 1024
  },
  'three-pane': {
    type: 'three-pane',
    gridTemplateColumns: '2fr 1fr',
    gridTemplateRows: '1fr 1fr',
    minWidth: 1024
  },
  'grid-2x2': {
    type: 'grid-2x2',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    minWidth: 1024
  }
}

export function getLayoutConfig(layout: LayoutType): LayoutConfiguration {
  return LAYOUT_CONFIGS[layout]
}

export function isLayoutSupported(layout: LayoutType, viewportWidth: number): boolean {
  const config = getLayoutConfig(layout)
  return !config.minWidth || viewportWidth >= config.minWidth
}

export function getSupportedLayouts(viewportWidth: number): LayoutType[] {
  return Object.keys(LAYOUT_CONFIGS).filter(layout => 
    isLayoutSupported(layout as LayoutType, viewportWidth)
  ) as LayoutType[]
}

export function getRecommendedLayout(viewportWidth: number, tabCount: number): LayoutType {
  const supported = getSupportedLayouts(viewportWidth)
  
  if (tabCount === 1) return 'single'
  if (tabCount === 2 && supported.includes('horizontal-split')) return 'horizontal-split'
  if (tabCount === 3 && supported.includes('three-pane')) return 'three-pane'
  if (tabCount >= 4 && supported.includes('grid-2x2')) return 'grid-2x2'
  
  return 'single'
}

export function validateLayout(layout: unknown): layout is LayoutType {
  return typeof layout === 'string' && layout in LAYOUT_CONFIGS
}

// =============================================================================
// Main Application Layout Preferences (Draggable Splitters)
// =============================================================================

// Layout preferences for main app layout (sidebar/editor widths)
export interface LayoutPreferences {
  sidebarWidth: number        // 200-400px constraint range
  editorWidth: number         // 300-800px constraint range
  version: string             // For future migrations/compatibility
}

// User preferences matching backend structure
export interface UserPreferences {
  currentWorkspaceId?: string | null
  layoutPreferences: LayoutPreferences
}

// Layout constraints for validation and clamping
export const LAYOUT_CONSTRAINTS = {
  sidebar: {
    min: 200,
    max: 400,
    default: 250
  },
  editor: {
    min: 300,
    max: 800,
    default: 400
  }
} as const

// Default layout preferences
export const DEFAULT_LAYOUT_PREFERENCES: LayoutPreferences = {
  sidebarWidth: LAYOUT_CONSTRAINTS.sidebar.default,
  editorWidth: LAYOUT_CONSTRAINTS.editor.default,
  version: '1.0'
}

// Responsive constraints based on viewport width
export function getResponsiveConstraints() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920

  // Mobile: severely restrict sizes
  if (vw <= 768) {
    return {
      sidebar: { min: 200, max: 250, default: 220 },
      editor: { min: 300, max: 400, default: 350 }
    }
  }

  // Tablet: moderately restrict sizes
  if (vw <= 1024) {
    return {
      sidebar: { min: 200, max: 350, default: 250 },
      editor: { min: 300, max: 600, default: 400 }
    }
  }

  // Desktop: full constraints
  return LAYOUT_CONSTRAINTS
}

// Utility function to clamp values within constraints (supports responsive)
export function clampWidth(value: number, type: 'sidebar' | 'editor', useResponsive = true): number {
  const constraints = useResponsive ? getResponsiveConstraints() : LAYOUT_CONSTRAINTS
  const typeConstraints = constraints[type]
  return Math.max(typeConstraints.min, Math.min(typeConstraints.max, value))
}