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