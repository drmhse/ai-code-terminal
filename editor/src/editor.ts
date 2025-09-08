import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { EditorState, StateEffect, Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { foldGutter, indentOnInput, bracketMatching, foldKeymap, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { highlightSelectionMatches } from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'
import { tags } from '@lezer/highlight'

// Language imports
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { sql } from '@codemirror/lang-sql'
import { php } from '@codemirror/lang-php'
import { rust } from '@codemirror/lang-rust'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { go } from '@codemirror/lang-go'

import type { EditorOptions, EditorInstance, EditorThemeData, ThemeColors } from './types/editor'

/**
 * Language support mapping with proper TypeScript typing
 */
const LANGUAGE_MAP: Record<string, () => Extension> = {
  // JavaScript family
  'js': () => javascript(),
  'jsx': () => javascript({ jsx: true }),
  'ts': () => javascript({ typescript: true }),
  'tsx': () => javascript({ typescript: true, jsx: true }),
  'mjs': () => javascript(),
  'cjs': () => javascript(),
  
  // Other languages
  'json': () => json(),
  'py': () => python(),
  'css': () => css(),
  'scss': () => css(),
  'sass': () => css(),
  'less': () => css(),
  'html': () => html(),
  'htm': () => html(),
  'md': () => markdown(),
  'markdown': () => markdown(),
  'xml': () => xml(),
  'yaml': () => yaml(),
  'yml': () => yaml(),
  'sql': () => sql(),
  'php': () => php(),
  'rs': () => rust(),
  'cpp': () => cpp(),
  'cxx': () => cpp(),
  'cc': () => cpp(),
  'c': () => cpp(),
  'h': () => cpp(),
  'hpp': () => cpp(),
  'java': () => java(),
  'go': () => go(),
  
  // Shell/config files (fallback to JavaScript highlighting)
  'sh': () => javascript(),
  'bash': () => javascript(),
  'zsh': () => javascript(),
  'fish': () => javascript(),
  'toml': () => javascript(),
  'ini': () => javascript(),
  'conf': () => javascript(),
  'config': () => javascript(),
  'env': () => javascript(),
}

/**
 * Get language extension for file extension
 */
function getLanguageExtension(fileExtension: string | undefined): Extension | null {
  if (!fileExtension) return null
  
  const ext = fileExtension.toLowerCase().replace(/^\./, '') // Remove leading dot
  const languageFactory = LANGUAGE_MAP[ext]
  
  if (languageFactory) {
    try {
      const extension = languageFactory()
      console.log(`✓ Language extension loaded for .${ext}`)
      return extension
    } catch (error) {
      console.error(`Failed to load language support for .${ext}:`, error)
      return null
    }
  }
  
  console.warn(`No language support available for .${ext}`)
  return null
}

/**
 * Basic editor setup with proper extensions
 */
function createBasicSetup(): Extension[] {
  return [
    lineNumbers(),
    foldGutter(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    history(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      indentWithTab
    ]),
    // Container integration theme
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '14px'
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, monospace'
      },
      '.cm-focused': {
        outline: 'none'
      }
    })
  ]
}

/**
 * Generate syntax highlighting style using CodeMirror 6 highlight tags
 */
function generateHighlightStyle(colors: ThemeColors): HighlightStyle {
  return HighlightStyle.define([
    { tag: tags.keyword, color: colors.accentPurple },
    { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: colors.accentRed },
    { tag: [tags.function(tags.variableName), tags.labelName], color: colors.accentBlue },
    { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: colors.accentOrange },
    { tag: [tags.definition(tags.name), tags.separator], color: colors.textPrimary },
    { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: colors.accentOrange },
    { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: colors.accentRed },
    { tag: [tags.meta, tags.comment], color: colors.textMuted, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.link, color: colors.accentBlue, textDecoration: 'underline' },
    { tag: tags.heading, fontWeight: 'bold', color: colors.accentBlue },
    { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: colors.accentBlue },
    { tag: [tags.processingInstruction, tags.string, tags.inserted], color: colors.accentGreen },
    { tag: tags.invalid, color: colors.accentRed }
  ])
}

/**
 * Create editor extensions based on options
 */
function createEditorExtensions(options: EditorOptions): Extension[] {
  const {
    readonly = false,
    theme,
    fileExtension = null
  } = options

  const extensions: Extension[] = [...createBasicSetup()]

  // Add language support
  const languageExt = getLanguageExtension(fileExtension || undefined)
  if (languageExt) {
    extensions.push(languageExt)
  }

  // Add theme
  if (theme?.type === 'dark') {
    extensions.push(oneDark)
  } else if (theme?.colors) {
    // Use dynamic theme colors with proper highlight style
    const highlightStyle = generateHighlightStyle(theme.colors)
    
    extensions.push(
      EditorView.theme({
        '&': {
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.primary
        },
        '.cm-content': {
          padding: '10px',
          color: theme.colors.textPrimary
        },
        '.cm-focused .cm-cursor': {
          borderLeftColor: theme.colors.textPrimary
        },
        '.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: theme.colors.accentBlue + '40'
        }
      }),
      syntaxHighlighting(highlightStyle)
    )
  } else {
    // Fallback to basic light theme with proper highlight style
    const fallbackHighlightStyle = HighlightStyle.define([
      { tag: tags.keyword, color: '#a626a4' },
      { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: '#e45649' },
      { tag: [tags.function(tags.variableName), tags.labelName], color: '#4078f2' },
      { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#986801' },
      { tag: [tags.definition(tags.name), tags.separator], color: '#383a42' },
      { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#986801' },
      { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#e45649' },
      { tag: [tags.meta, tags.comment], color: '#a0a1a7', fontStyle: 'italic' },
      { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: '#0184bb' },
      { tag: [tags.processingInstruction, tags.string, tags.inserted], color: '#50a14f' },
      { tag: tags.invalid, color: '#e45649' }
    ])
    
    extensions.push(
      EditorView.theme({
        '&': {
          color: '#383a42',
          backgroundColor: '#fafafa'
        },
        '.cm-content': {
          padding: '10px',
          color: '#383a42'
        }
      }),
      syntaxHighlighting(fallbackHighlightStyle)
    )
  }

  // Add change listener (must be before readonly configuration)
  if (options.onChange && !readonly) {
    extensions.push(EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onChange!(update.state.doc.toString())
      }
    }))
  }

  // Configure readonly mode
  if (readonly) {
    extensions.push(
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      // Hide cursor in readonly mode
      EditorView.theme({
        '&.cm-focused .cm-cursor': { display: 'none' },
        '&.cm-focused .cm-selectionBackground': { backgroundColor: 'transparent' }
      })
    )
  }

  return extensions
}

/**
 * Create a unified file editor/viewer with proper TypeScript support
 */
export function createUnifiedEditor(
  container: HTMLElement,
  options: EditorOptions = {}
): EditorInstance {
  const {
    content = '',
    readonly = false,
    theme,
    fileExtension = null
  } = options

  console.log('🚀 Creating CodeMirror editor with options:', {
    fileExtension,
    readonly,
    themeType: theme?.type || 'light',
    contentLength: content.length
  })

  const extensions = createEditorExtensions(options)
  
  const state = EditorState.create({
    doc: content,
    extensions
  })

  const view = new EditorView({
    state,
    parent: container
  })

  console.log('✅ CodeMirror editor created successfully')

  // Return typed editor instance
  return {
    view,
    
    setContent(newContent: string): void {
      const transaction = view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newContent
        }
      })
      view.dispatch(transaction)
    },

    getContent(): string {
      return view.state.doc.toString()
    },

    setReadonly(readonly: boolean): void {
      const newExtensions = createEditorExtensions({
        ...options,
        readonly
      })

      view.dispatch({
        effects: StateEffect.reconfigure.of(newExtensions)
      })
    },

    setTheme(themeData: EditorThemeData): void {
      const newExtensions = createEditorExtensions({
        ...options,
        theme: themeData
      })

      view.dispatch({
        effects: StateEffect.reconfigure.of(newExtensions)
      })
      
      // Update stored options for future reconfigurations
      options.theme = themeData
    },

    focus(): void {
      view.focus()
    },

    destroy(): void {
      view.destroy()
    }
  }
}

/**
 * Get available languages for debugging
 */
export function getAvailableLanguages(): string[] {
  return Object.keys(LANGUAGE_MAP)
}

/**
 * Test if a file extension is supported
 */
export function isLanguageSupported(fileExtension: string): boolean {
  const ext = fileExtension.toLowerCase().replace(/^\./, '')
  return ext in LANGUAGE_MAP
}