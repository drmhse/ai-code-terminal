import type { EditorView } from '@codemirror/view'

export interface ThemeColors {
  primary: string
  secondary: string
  tertiary: string
  sidebar: string
  border: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accentBlue: string
  accentBlueHover: string
  accentGreen: string
  accentGreenHover: string
  accentRed: string
  accentRedHover: string
  accentOrange: string
  accentPurple: string
  terminalBg: string
}

export interface EditorThemeData {
  type: 'light' | 'dark'
  colors: ThemeColors
}

export interface EditorOptions {
  content?: string
  readonly?: boolean
  theme?: EditorThemeData
  fileExtension?: string | undefined
  onChange?: (content: string) => void
}

export interface EditorInstance {
  view: EditorView
  setContent(content: string): void
  getContent(): string
  setReadonly(readonly: boolean): void
  setTheme(theme: EditorThemeData): void
  focus(): void
  destroy(): void
  // Optional CodeMirror-specific methods
  setValue?(content: string): void
  autoFormatSelection?(): void
  openDialog?(query: string): void
  findNext?(): void
  findPrev?(): void
  replaceAll?(text: string): void
  setCursor?(line: number, column: number): void
  undo?(): void
  redo?(): void
}

export interface CodeMirrorSetup {
  createUnifiedEditor: (container: HTMLElement, options?: EditorOptions) => EditorInstance
  getAvailableLanguages: () => string[]
  isLanguageSupported: (fileExtension: string) => boolean
  isLoaded: () => boolean
  error?: Error
}

declare global {
  interface Window {
    CodeMirrorSetup: CodeMirrorSetup
  }
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: Date
  children?: FileNode[]
  extension?: string
}