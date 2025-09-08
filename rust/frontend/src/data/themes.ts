import type { Theme } from '@/types/theme'

/**
 * Comprehensive theme definitions for AI Code Terminal
 * Frontend-driven theme system with complete color coverage
 */

export const themes: Theme[] = [
  {
    id: 'vscode-dark',
    name: 'VS Code Dark',
    description: 'The classic VS Code dark theme with balanced contrast',
    category: 'dark',
    author: 'Microsoft',
    colors: {
      background: {
        primary: '#1e1e1e',
        secondary: '#252526', 
        tertiary: '#2d2d30',
        quaternary: '#37373d',
        overlay: 'rgba(0, 0, 0, 0.4)'
      },
      text: {
        primary: '#cccccc',
        secondary: '#969696',
        tertiary: '#6a6a6a',
        disabled: '#4a4a4a',
        inverse: '#ffffff'
      },
      border: {
        primary: '#3c3c3c',
        secondary: '#2d2d30',
        focus: '#007acc',
        hover: '#464647'
      },
      interactive: {
        primary: '#007acc',
        primaryHover: '#1177bb', 
        primaryActive: '#0e639c',
        primaryDisabled: '#004578',
        secondary: '#5a5d5e',
        secondaryHover: '#6c6e70',
        tertiary: 'transparent',
        tertiaryHover: '#2a2d2e',
        link: '#3794ff',
        linkHover: '#4dabf7',
        linkVisited: '#b180d7'
      },
      semantic: {
        success: '#16825d',
        successBg: '#042f1a',
        successBorder: '#164e3c',
        warning: '#ff8c00',
        warningBg: '#332600',
        warningBorder: '#665100',
        error: '#f14c4c',
        errorBg: '#330a0a',
        errorBorder: '#661414',
        info: '#007acc',
        infoBg: '#002b44',
        infoBorder: '#005577'
      },
      sidebar: {
        background: '#252526',
        text: '#cccccc',
        textSecondary: '#969696',
        border: '#2d2d30',
        itemHover: '#2a2d2e',
        itemActive: '#37373d',
        itemActiveBorder: '#007acc'
      },
      editor: {
        background: '#1e1e1e',
        gutter: '#1e1e1e',
        gutterText: '#858585',
        selection: '#264f78',
        selectionInactive: '#3a3d41',
        cursor: '#aeafad',
        currentLine: '#2d2d30',
        matchingBracket: '#0e4b73',
        findMatch: '#515c6a',
        findMatchActive: '#613214'
      },
      input: {
        background: '#3c3c3c',
        backgroundFocus: '#404040',
        text: '#cccccc',
        placeholder: '#6a6a6a',
        border: '#5a5d5e',
        borderFocus: '#007acc',
        borderError: '#f14c4c'
      },
      scrollbar: {
        track: 'transparent',
        thumb: '#424242',
        thumbHover: '#4e4e4e'
      },
      tooltip: {
        background: '#252526',
        text: '#cccccc',
        border: '#454545'
      }
    },
    terminal: {
      background: '#1e1e1e',
      foreground: '#cccccc',
      cursor: '#aeafad',
      selection: 'rgba(255, 255, 255, 0.2)',
      selectionForeground: '#cccccc',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#16825d',
      brightYellow: '#f9f1a5',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b7da',
      brightWhite: '#ffffff'
    },
    syntax: {
      keyword: '#569cd6',
      keywordControl: '#c586c0',
      keywordOperator: '#d4d4d4',
      string: '#ce9178',
      stringEscape: '#d7ba7d',
      number: '#b5cea8',
      boolean: '#569cd6',
      null: '#569cd6',
      comment: '#6a9955',
      commentBlock: '#6a9955',
      commentDoc: '#6a9955',
      variable: '#9cdcfe',
      variableBuiltin: '#4fc1ff',
      parameter: '#9cdcfe',
      property: '#9cdcfe',
      function: '#dcdcaa',
      functionBuiltin: '#4fc1ff',
      method: '#dcdcaa',
      type: '#4ec9b0',
      typeBuiltin: '#4ec9b0',
      class: '#4ec9b0',
      interface: '#4ec9b0',
      enum: '#4ec9b0',
      operator: '#d4d4d4',
      punctuation: '#d4d4d4',
      bracket: '#ffd700',
      tag: '#569cd6',
      tagPunctuation: '#808080',
      attribute: '#92c5f3',
      attributeValue: '#ce9178',
      constant: '#4fc1ff',
      macro: '#bd63c5',
      label: '#c586c0',
      namespace: '#4ec9b0',
      error: '#f14c4c',
      warning: '#ffcc02',
      deprecated: '#808080'
    }
  },

  {
    id: 'github-dark',
    name: 'GitHub Dark',
    description: 'GitHub\'s refined dark theme with excellent readability',
    category: 'dark',
    author: 'GitHub',
    colors: {
      background: {
        primary: '#0d1117',
        secondary: '#21262d',
        tertiary: '#30363d',
        quaternary: '#282e33',
        overlay: 'rgba(0, 0, 0, 0.5)'
      },
      text: {
        primary: '#e6edf3',
        secondary: '#7d8590',
        tertiary: '#656d76',
        disabled: '#484f58',
        inverse: '#ffffff'
      },
      border: {
        primary: '#30363d',
        secondary: '#21262d',
        focus: '#0969da',
        hover: '#40464e'
      },
      interactive: {
        primary: '#238636',
        primaryHover: '#2ea043',
        primaryActive: '#1a7f37',
        primaryDisabled: '#1b5e20',
        secondary: '#6e7681',
        secondaryHover: '#8b949e',
        tertiary: 'transparent',
        tertiaryHover: '#30363d',
        link: '#58a6ff',
        linkHover: '#79c0ff',
        linkVisited: '#bc8cff'
      },
      semantic: {
        success: '#238636',
        successBg: '#0f2419',
        successBorder: '#1a7f37',
        warning: '#9e6a03',
        warningBg: '#332700',
        warningBorder: '#7d4e00',
        error: '#da3633',
        errorBg: '#330c0c',
        errorBorder: '#a40e26',
        info: '#0969da',
        infoBg: '#0c1f3d',
        infoBorder: '#1f6feb'
      },
      sidebar: {
        background: '#0d1117',
        text: '#e6edf3',
        textSecondary: '#7d8590',
        border: '#30363d',
        itemHover: '#21262d',
        itemActive: '#282e33',
        itemActiveBorder: '#fd7e14'
      },
      editor: {
        background: '#0d1117',
        gutter: '#0d1117',
        gutterText: '#7d8590',
        selection: '#264f78',
        selectionInactive: '#30363d',
        cursor: '#e6edf3',
        currentLine: '#21262d',
        matchingBracket: '#0c2d6b',
        findMatch: '#4c4c19',
        findMatchActive: '#ffd33d'
      },
      input: {
        background: '#21262d',
        backgroundFocus: '#30363d',
        text: '#e6edf3',
        placeholder: '#7d8590',
        border: '#30363d',
        borderFocus: '#0969da',
        borderError: '#da3633'
      },
      scrollbar: {
        track: 'transparent',
        thumb: '#30363d',
        thumbHover: '#40464e'
      },
      tooltip: {
        background: '#21262d',
        text: '#e6edf3',
        border: '#30363d'
      }
    },
    terminal: {
      background: '#0d1117',
      foreground: '#e6edf3',
      cursor: '#e6edf3',
      selection: 'rgba(158, 203, 255, 0.2)',
      selectionForeground: '#e6edf3',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc'
    },
    syntax: {
      keyword: '#ff7b72',
      keywordControl: '#ff7b72',
      keywordOperator: '#ff7b72',
      string: '#a5c261',
      stringEscape: '#79c0ff',
      number: '#79c0ff',
      boolean: '#79c0ff',
      null: '#79c0ff',
      comment: '#8b949e',
      commentBlock: '#8b949e',
      commentDoc: '#8b949e',
      variable: '#e6edf3',
      variableBuiltin: '#79c0ff',
      parameter: '#e6edf3',
      property: '#e6edf3',
      function: '#d2a8ff',
      functionBuiltin: '#79c0ff',
      method: '#d2a8ff',
      type: '#f0883e',
      typeBuiltin: '#f0883e',
      class: '#f0883e',
      interface: '#f0883e',
      enum: '#f0883e',
      operator: '#ff7b72',
      punctuation: '#e6edf3',
      bracket: '#e6edf3',
      tag: '#7ee787',
      tagPunctuation: '#e6edf3',
      attribute: '#79c0ff',
      attributeValue: '#a5c261',
      constant: '#79c0ff',
      macro: '#d2a8ff',
      label: '#d2a8ff',
      namespace: '#f0883e',
      error: '#ff7b72',
      warning: '#d29922',
      deprecated: '#8b949e'
    }
  },

  {
    id: 'github-light',
    name: 'GitHub Light',
    description: 'GitHub\'s clean light theme for daytime coding',
    category: 'light',
    author: 'GitHub',
    colors: {
      background: {
        primary: '#ffffff',
        secondary: '#f6f8fa',
        tertiary: '#f1f3f4',
        quaternary: '#e1e4e8',
        overlay: 'rgba(140, 149, 159, 0.2)'
      },
      text: {
        primary: '#24292f',
        secondary: '#656d76',
        tertiary: '#8c959f',
        disabled: '#d0d7de',
        inverse: '#ffffff'
      },
      border: {
        primary: '#d0d7de',
        secondary: '#e1e4e8',
        focus: '#0969da',
        hover: '#c9d1d9'
      },
      interactive: {
        primary: '#1f883d',
        primaryHover: '#1a7f37',
        primaryActive: '#18723b',
        primaryDisabled: '#94d3a2',
        secondary: '#656d76',
        secondaryHover: '#24292f',
        tertiary: 'transparent',
        tertiaryHover: '#f1f3f4',
        link: '#0969da',
        linkHover: '#0550ae',
        linkVisited: '#8250df'
      },
      semantic: {
        success: '#1f883d',
        successBg: '#dcffe4',
        successBorder: '#1f883d',
        warning: '#9a6700',
        warningBg: '#fff8c5',
        warningBorder: '#9a6700',
        error: '#cf222e',
        errorBg: '#ffebe9',
        errorBorder: '#cf222e',
        info: '#0969da',
        infoBg: '#ddf4ff',
        infoBorder: '#0969da'
      },
      sidebar: {
        background: '#f6f8fa',
        text: '#24292f',
        textSecondary: '#656d76',
        border: '#d0d7de',
        itemHover: '#f1f3f4',
        itemActive: '#e1e4e8',
        itemActiveBorder: '#fd7e14'
      },
      editor: {
        background: '#ffffff',
        gutter: '#f6f8fa',
        gutterText: '#656d76',
        selection: '#b6d6fe',
        selectionInactive: '#e1e4e8',
        cursor: '#24292f',
        currentLine: '#f6f8fa',
        matchingBracket: '#b6d6fe',
        findMatch: '#ffdf5d',
        findMatchActive: '#ffcc02'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#24292f',
        placeholder: '#8c959f',
        border: '#d0d7de',
        borderFocus: '#0969da',
        borderError: '#cf222e'
      },
      scrollbar: {
        track: 'transparent',
        thumb: '#d0d7de',
        thumbHover: '#c9d1d9'
      },
      tooltip: {
        background: '#24292f',
        text: '#ffffff',
        border: '#24292f'
      }
    },
    terminal: {
      background: '#ffffff',
      foreground: '#24292f',
      cursor: '#24292f',
      selection: 'rgba(54, 129, 250, 0.2)',
      selectionForeground: '#24292f',
      black: '#24292f',
      red: '#cf222e',
      green: '#1a7f37',
      yellow: '#9a6700',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#0598bc',
      white: '#656d76',
      brightBlack: '#8c959f',
      brightRed: '#a40e26',
      brightGreen: '#1f883d',
      brightYellow: '#bf8700',
      brightBlue: '#0550ae',
      brightMagenta: '#6f42c1',
      brightCyan: '#0598bc',
      brightWhite: '#8c959f'
    },
    syntax: {
      keyword: '#cf222e',
      keywordControl: '#cf222e',
      keywordOperator: '#cf222e',
      string: '#0a3069',
      stringEscape: '#0550ae',
      number: '#0550ae',
      boolean: '#0550ae',
      null: '#0550ae',
      comment: '#6e7781',
      commentBlock: '#6e7781',
      commentDoc: '#6e7781',
      variable: '#24292f',
      variableBuiltin: '#0550ae',
      parameter: '#24292f',
      property: '#24292f',
      function: '#8250df',
      functionBuiltin: '#0550ae',
      method: '#8250df',
      type: '#953800',
      typeBuiltin: '#953800',
      class: '#953800',
      interface: '#953800',
      enum: '#953800',
      operator: '#cf222e',
      punctuation: '#24292f',
      bracket: '#24292f',
      tag: '#116329',
      tagPunctuation: '#24292f',
      attribute: '#0550ae',
      attributeValue: '#0a3069',
      constant: '#0550ae',
      macro: '#8250df',
      label: '#8250df',
      namespace: '#953800',
      error: '#cf222e',
      warning: '#9a6700',
      deprecated: '#6e7781'
    }
  },

  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'A clean, dark blue theme inspired by Tokyo\'s skyline',
    category: 'dark',
    author: 'enkia',
    colors: {
      background: {
        primary: '#1a1b26',
        secondary: '#24283b',
        tertiary: '#414868',
        quaternary: '#3b4261',
        overlay: 'rgba(0, 0, 0, 0.4)'
      },
      text: {
        primary: '#a9b1d6',
        secondary: '#9aa5ce',
        tertiary: '#565f89',
        disabled: '#414868',
        inverse: '#ffffff'
      },
      border: {
        primary: '#414868',
        secondary: '#24283b',
        focus: '#7aa2f7',
        hover: '#3b4261'
      },
      interactive: {
        primary: '#7aa2f7',
        primaryHover: '#82aaff',
        primaryActive: '#6889de',
        primaryDisabled: '#4a5578',
        secondary: '#565f89',
        secondaryHover: '#6b7394',
        tertiary: 'transparent',
        tertiaryHover: '#24283b',
        link: '#73daca',
        linkHover: '#82aaff',
        linkVisited: '#bb9af7'
      },
      semantic: {
        success: '#9ece6a',
        successBg: '#1a2b1a',
        successBorder: '#449944',
        warning: '#e0af68',
        warningBg: '#2b251a',
        warningBorder: '#cc9c33',
        error: '#f7768e',
        errorBg: '#2b1a1a',
        errorBorder: '#cc4455',
        info: '#7aa2f7',
        infoBg: '#1a1b2b',
        infoBorder: '#4477cc'
      },
      sidebar: {
        background: '#1a1b26',
        text: '#a9b1d6',
        textSecondary: '#9aa5ce',
        border: '#414868',
        itemHover: '#24283b',
        itemActive: '#3b4261',
        itemActiveBorder: '#ff9e64'
      },
      editor: {
        background: '#1a1b26',
        gutter: '#1a1b26',
        gutterText: '#565f89',
        selection: '#3d59a1',
        selectionInactive: '#414868',
        cursor: '#c0caf5',
        currentLine: '#24283b',
        matchingBracket: '#3d59a1',
        findMatch: '#515c6a',
        findMatchActive: '#e0af68'
      },
      input: {
        background: '#414868',
        backgroundFocus: '#3b4261',
        text: '#a9b1d6',
        placeholder: '#565f89',
        border: '#565f89',
        borderFocus: '#7aa2f7',
        borderError: '#f7768e'
      },
      scrollbar: {
        track: 'transparent',
        thumb: '#414868',
        thumbHover: '#3b4261'
      },
      tooltip: {
        background: '#24283b',
        text: '#a9b1d6',
        border: '#414868'
      }
    },
    terminal: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      cursor: '#c0caf5',
      selection: 'rgba(125, 162, 247, 0.2)',
      selectionForeground: '#a9b1d6',
      black: '#1a1b26',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#73daca',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#73daca',
      brightWhite: '#c0caf5'
    },
    syntax: {
      keyword: '#bb9af7',
      keywordControl: '#bb9af7',
      keywordOperator: '#bb9af7',
      string: '#9ece6a',
      stringEscape: '#e0af68',
      number: '#ff9e64',
      boolean: '#ff9e64',
      null: '#ff9e64',
      comment: '#565f89',
      commentBlock: '#565f89',
      commentDoc: '#565f89',
      variable: '#c0caf5',
      variableBuiltin: '#7aa2f7',
      parameter: '#c0caf5',
      property: '#73daca',
      function: '#7dcfff',
      functionBuiltin: '#7aa2f7',
      method: '#7dcfff',
      type: '#2ac3de',
      typeBuiltin: '#2ac3de',
      class: '#2ac3de',
      interface: '#2ac3de',
      enum: '#2ac3de',
      operator: '#89ddff',
      punctuation: '#89ddff',
      bracket: '#89ddff',
      tag: '#f7768e',
      tagPunctuation: '#89ddff',
      attribute: '#bb9af7',
      attributeValue: '#9ece6a',
      constant: '#ff9e64',
      macro: '#bb9af7',
      label: '#bb9af7',
      namespace: '#2ac3de',
      error: '#f7768e',
      warning: '#e0af68',
      deprecated: '#565f89'
    }
  }
]

// Theme utilities
export function getThemeById(id: string): Theme | undefined {
  return themes.find(theme => theme.id === id)
}

export function getThemesByCategory(category: Theme['category']): Theme[] {
  return themes.filter(theme => theme.category === category)
}

export function getDefaultTheme(): Theme {
  return themes.find(theme => theme.id === 'vscode-dark') || themes[0]
}

export function getSystemPreferredTheme(): Theme {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const category = prefersDark ? 'dark' : 'light'
  const categoryThemes = getThemesByCategory(category)
  
  if (category === 'dark') {
    return categoryThemes.find(t => t.id === 'github-dark') || categoryThemes[0]
  } else {
    return categoryThemes.find(t => t.id === 'github-light') || categoryThemes[0]
  }
}