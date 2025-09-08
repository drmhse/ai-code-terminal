import { createUnifiedEditor, getAvailableLanguages, isLanguageSupported } from './editor'
import { cacheManager } from './utils/cache-manager'
import type { EditorOptions, EditorInstance } from './types/editor'

// Global interface for the existing EJS templates
interface CodeMirrorSetup {
  createUnifiedEditor: (container: HTMLElement, options?: EditorOptions) => EditorInstance
  getAvailableLanguages: () => string[]
  isLanguageSupported: (fileExtension: string) => boolean
  isLoaded: () => boolean
  error?: Error
}

// Create the global CodeMirrorSetup object
const CodeMirrorSetup: CodeMirrorSetup = {
  createUnifiedEditor,
  getAvailableLanguages,
  isLanguageSupported,
  isLoaded: () => true
}

// Make available globally for existing EJS templates
declare global {
  interface Window {
    CodeMirrorSetup: CodeMirrorSetup
  }
}

// Attach to window object
window.CodeMirrorSetup = CodeMirrorSetup

// Initialize cache management
cacheManager.init()

console.log('🎉 CodeMirror 6 setup loaded successfully with TypeScript!')
console.log('📦 Available languages:', getAvailableLanguages().length)
console.log('🔄 Cache management initialized')

// Export for module usage
export {
  createUnifiedEditor,
  getAvailableLanguages,
  isLanguageSupported
}

export type {
  EditorOptions,
  EditorInstance
}