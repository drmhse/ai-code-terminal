import type { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

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
  fileExtension?: string
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
}

export interface LanguageSupport {
  name: string
  extension: Extension
  fileExtensions: string[]
}

export interface EditorTheme {
  name: string
  type: 'light' | 'dark'
  extension?: Extension
}

export type SupportedLanguage = 
  | 'javascript' 
  | 'typescript' 
  | 'python' 
  | 'json' 
  | 'css' 
  | 'html' 
  | 'markdown' 
  | 'xml' 
  | 'yaml' 
  | 'sql' 
  | 'php' 
  | 'rust' 
  | 'cpp' 
  | 'java' 
  | 'go'