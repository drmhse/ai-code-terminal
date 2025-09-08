import type { Terminal } from '@xterm/xterm'

export interface TerminalPane {
  id: string
  title?: string
  cwd?: string
  terminal?: Terminal
  element?: HTMLElement
}

export interface TerminalSession {
  id: string
  workspaceId: string
  panes: TerminalPane[]
  activePaneId: string
  layout: 'single' | 'horizontal' | 'vertical'
}

export type TerminalLayout = 'single' | 'horizontal' | 'vertical'

export interface TerminalTheme {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}