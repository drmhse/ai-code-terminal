/**
 * CodeMirror 6 Setup Module
 * Unified file editor/viewer with Vue.js integration
 */

// Import from CDN for better reliability and caching
import { EditorState, StateEffect } from 'https://esm.sh/@codemirror/state@6';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from 'https://esm.sh/@codemirror/view@6';
import { defaultKeymap, history, historyKeymap, indentWithTab } from 'https://esm.sh/@codemirror/commands@6';
import { foldGutter, indentOnInput, bracketMatching, foldKeymap } from 'https://esm.sh/@codemirror/language@6';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6';
import { highlightSelectionMatches } from 'https://esm.sh/@codemirror/search@6';

// Language imports
import { javascript } from 'https://esm.sh/@codemirror/lang-javascript@6';
import { python } from 'https://esm.sh/@codemirror/lang-python@6';
import { json } from 'https://esm.sh/@codemirror/lang-json@6';
import { css } from 'https://esm.sh/@codemirror/lang-css@6';
import { html } from 'https://esm.sh/@codemirror/lang-html@6';
import { markdown } from 'https://esm.sh/@codemirror/lang-markdown@6';
import { xml } from 'https://esm.sh/@codemirror/lang-xml@6';
import { yaml } from 'https://esm.sh/@codemirror/lang-yaml@6';
import { sql } from 'https://esm.sh/@codemirror/lang-sql@6';
import { php } from 'https://esm.sh/@codemirror/lang-php@6';
import { rust } from 'https://esm.sh/@codemirror/lang-rust@6';
import { cpp } from 'https://esm.sh/@codemirror/lang-cpp@6';
import { java } from 'https://esm.sh/@codemirror/lang-java@6';
import { go } from 'https://esm.sh/@codemirror/lang-go@6';

/**
 * Language support mapping
 */
const LANGUAGE_MAP = {
  'js': javascript,
  'jsx': () => javascript({ jsx: true }),
  'ts': () => javascript({ typescript: true }),
  'tsx': () => javascript({ typescript: true, jsx: true }),
  'json': json,
  'py': python,
  'css': css,
  'scss': css,
  'sass': css,
  'less': css,
  'html': html,
  'htm': html,
  'md': markdown,
  'markdown': markdown,
  'xml': xml,
  'yaml': yaml,
  'yml': yaml,
  'sql': sql,
  'php': php,
  'rs': rust,
  'cpp': cpp,
  'cxx': cpp,
  'cc': cpp,
  'c': cpp,
  'h': cpp,
  'hpp': cpp,
  'java': java,
  'go': go,
  'sh': () => javascript(), // Basic shell highlighting
  'bash': () => javascript(),
  'zsh': () => javascript(),
  'fish': () => javascript(),
  'toml': () => javascript(),
  'ini': () => javascript(),
  'conf': () => javascript(),
  'config': () => javascript()
};

/**
 * Get language extension for file
 */
function getLanguageExtension(fileExtension) {
  if (!fileExtension) return null;
  
  const ext = fileExtension.toLowerCase();
  const languageSupport = LANGUAGE_MAP[ext];
  
  if (typeof languageSupport === 'function') {
    try {
      return languageSupport();
    } catch (error) {
      console.warn(`Failed to load language support for ${ext}:`, error);
      return null;
    }
  }
  
  return languageSupport || null;
}

/**
 * Basic setup extensions
 */
const basicSetup = [
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
  // Minimal theme for proper container integration
  EditorView.theme({
    '&': {
      height: '100%'
    },
    '.cm-scroller': {
      overflow: 'auto'
    }
  })
];

/**
 * Create unified editor extensions
 */
function createEditorExtensions(options = {}) {
  const {
    readonly = false,
    theme = 'light',
    language = null,
    fileExtension = null
  } = options;

  const extensions = [...basicSetup];

  // Add language support
  const languageExt = getLanguageExtension(fileExtension);
  if (languageExt) {
    extensions.push(languageExt);
  }

  // Add theme
  if (theme === 'dark') {
    extensions.push(oneDark);
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
    );
  }

  return extensions;
}

/**
 * Create unified file editor/viewer
 */
function createUnifiedEditor(container, options = {}) {
  const {
    content = '',
    readonly = false,
    theme = 'light',
    fileExtension = null,
    onChange = null
  } = options;

  const extensions = createEditorExtensions({
    readonly,
    theme,
    fileExtension
  });

  // Add change handler if provided and not readonly
  if (onChange && !readonly) {
    extensions.push(EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }));
  }

  const state = EditorState.create({
    doc: content,
    extensions
  });

  const view = new EditorView({
    state,
    parent: container
  });

  return {
    view,
    
    // Update content
    setContent(newContent) {
      const transaction = view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newContent
        }
      });
      view.dispatch(transaction);
    },

    // Get current content
    getContent() {
      return view.state.doc.toString();
    },

    // Toggle readonly mode
    setReadonly(readonly) {
      const newExtensions = createEditorExtensions({
        readonly,
        theme: options.theme,
        fileExtension: options.fileExtension
      });

      if (onChange && !readonly) {
        newExtensions.push(EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }));
      }

      view.dispatch({
        effects: StateEffect.reconfigure.of(newExtensions)
      });
    },

    // Update theme
    setTheme(theme) {
      options.theme = theme;
      const newExtensions = createEditorExtensions({
        readonly,
        theme,
        fileExtension: options.fileExtension
      });

      if (onChange && !readonly) {
        newExtensions.push(EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }));
      }

      view.dispatch({
        effects: StateEffect.reconfigure.of(newExtensions)
      });
    },

    // Focus editor
    focus() {
      view.focus();
    },

    // Destroy editor
    destroy() {
      view.destroy();
    }
  };
}

// Make globally available
window.CodeMirrorSetup = {
  createUnifiedEditor,
  createEditorExtensions,
  getLanguageExtension,
  LANGUAGE_MAP
};

console.log('CodeMirror 6 setup loaded');