import type { Theme } from '@/types/theme'

/**
 * CREATIVE PREMIUM THEME COLLECTION
 * Production-ready themes with exceptional variety and visual quality
 * Each theme is carefully crafted with proper contrast ratios and accessibility
 */

export const themes: Theme[] = [
  // === MODERN PROFESSIONAL THEMES ===
  {
    id: 'vscode-dark',
    name: 'VS Code Dark',
    description: 'The beloved classic with perfect balance',
    category: 'dark',
    author: 'Microsoft',
    colors: {
      background: {
        primary: '#1e1e1e',
        secondary: '#252526',
        tertiary: '#2d2d30',
        quaternary: '#37373d',
        overlay: '#1e1e1edd'
      },
      text: {
        primary: '#cccccc',
        secondary: '#969696',
        tertiary: '#6a6a6a',
        disabled: '#525252',
        inverse: '#1e1e1e'
      },
      border: {
        primary: '#3c3c3c',
        secondary: '#464647',
        focus: '#007acc',
        hover: '#464647'
      },
      interactive: {
        primary: '#007acc',
        primaryHover: '#1177bb',
        primaryActive: '#005a9e',
        primaryDisabled: '#004578',
        secondary: '#3c3c3c',
        secondaryHover: '#464647',
        tertiary: '#2d2d30',
        tertiaryHover: '#37373d',
        link: '#3794ff',
        linkHover: '#4dabf7',
        linkVisited: '#b197fc'
      },
      semantic: {
        success: '#16825d',
        successBg: '#16825d22',
        successBorder: '#16825d44',
        warning: '#ff8c00',
        warningBg: '#ff8c0022',
        warningBorder: '#ff8c0044',
        error: '#f14c4c',
        errorBg: '#f14c4c22',
        errorBorder: '#f14c4c44',
        info: '#c678dd',
        infoBg: '#c678dd22',
        infoBorder: '#c678dd44'
      },
      sidebar: {
        background: '#181818',
        text: '#cccccc',
        textSecondary: '#969696',
        border: '#2d2d30',
        itemHover: '#2d2d30',
        itemHoverText: '#cccccc',
        itemActive: '#007acc',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#007acc'
      },
      editor: {
        background: '#1e1e1e',
        gutter: '#1e1e1e',
        gutterText: '#858585',
        selection: '#264f78',
        selectionInactive: '#3a3d41',
        cursor: '#aeafad',
        currentLine: '#2a2d2e',
        matchingBracket: '#0064001a',
        findMatch: '#515c6a',
        findMatchActive: '#ea5c00'
      },
      input: {
        background: '#2d2d30',
        backgroundFocus: '#37373d',
        text: '#cccccc',
        placeholder: '#969696',
        border: '#3c3c3c',
        borderFocus: '#007acc',
        borderError: '#f14c4c'
      },
      scrollbar: {
        track: '#1e1e1e',
        thumb: '#424242',
        thumbHover: '#4f4f4f'
      },
      tooltip: {
        background: '#252526',
        text: '#cccccc',
        border: '#464647'
      }
    },
    terminal: {
      background: '#1e1e1e',
      foreground: '#cccccc',
      cursor: '#aeafad',
      selection: '#264f78',
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
      brightBlue: '#3794ff',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#f2f2f2'
    },
    syntax: {
      keyword: '#569cd6',
      keywordControl: '#c586c0',
      keywordOperator: '#569cd6',
      string: '#ce9178',
      stringEscape: '#d7ba7d',
      number: '#b5cea8',
      boolean: '#569cd6',
      null: '#569cd6',
      comment: '#6a9955',
      commentBlock: '#6a9955',
      commentDoc: '#608b4e',
      variable: '#9cdcfe',
      variableBuiltin: '#38a0ff',
      parameter: '#9cdcfe',
      property: '#9cdcfe',
      function: '#dcdcaa',
      functionBuiltin: '#38a0ff',
      method: '#dcdcaa',
      type: '#4ec9b0',
      typeBuiltin: '#38a0ff',
      class: '#4ec9b0',
      interface: '#b8d7a3',
      enum: '#4ec9b0',
      operator: '#d4d4d4',
      punctuation: '#d4d4d4',
      bracket: '#da70d6',
      tag: '#569cd6',
      tagPunctuation: '#808080',
      attribute: '#9cdcfe',
      attributeValue: '#ce9178',
      constant: '#4fc1ff',
      macro: '#bd63c5',
      label: '#c8c8c8',
      namespace: '#4ec9b0',
      error: '#f44747',
      warning: '#ffcc02',
      deprecated: '#d4d4d4'
    }
  },

  // === CREATIVE ARTISTIC THEMES ===
  {
    id: 'synthwave-84',
    name: 'SynthWave \'84',
    description: 'Neon-soaked retro futurism with electric pink highlights',
    category: 'dark',
    author: 'Retro Futures Collective',
    colors: {
      background: {
        primary: '#0a0a23',
        secondary: '#1a1a3a',
        tertiary: '#2d2d5f',
        quaternary: '#404080',
        overlay: '#0a0a23ee'
      },
      text: {
        primary: '#f8f8ff',
        secondary: '#e6e6fa',
        tertiary: '#bdbddb',
        disabled: '#8a8aaa',
        inverse: '#0a0a23'
      },
      border: {
        primary: '#ff007f',
        secondary: '#ff1493',
        focus: '#ff69b4',
        hover: '#ff007f'
      },
      interactive: {
        primary: '#ff007f',
        primaryHover: '#ff1493',
        primaryActive: '#dc143c',
        primaryDisabled: '#8b008b',
        secondary: '#8a2be2',
        secondaryHover: '#9370db',
        tertiary: '#4b0082',
        tertiaryHover: '#6a5acd',
        link: '#00ffff',
        linkHover: '#40e0d0',
        linkVisited: '#da70d6'
      },
      semantic: {
        success: '#00ff7f',
        successBg: '#00ff7f22',
        successBorder: '#00ff7f44',
        warning: '#ffd700',
        warningBg: '#ffd70022',
        warningBorder: '#ffd70044',
        error: '#ff4500',
        errorBg: '#ff450022',
        errorBorder: '#ff450044',
        info: '#00bfff',
        infoBg: '#00bfff22',
        infoBorder: '#00bfff44'
      },
      sidebar: {
        background: '#1a1a3a',
        text: '#f8f8ff',
        textSecondary: '#e6e6fa',
        border: '#2d2d5f',
        itemHover: '#2d2d5f',
        itemHoverText: '#f8f8ff',
        itemActive: '#ff007f',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#ff007f'
      },
      editor: {
        background: '#0a0a23',
        gutter: '#1a1a3a',
        gutterText: '#bdbddb',
        selection: '#ff007f33',
        selectionInactive: '#8a2be244',
        cursor: '#ff69b4',
        currentLine: '#1a1a3a',
        matchingBracket: '#00ffff33',
        findMatch: '#ffd70066',
        findMatchActive: '#ff007f'
      },
      input: {
        background: '#1a1a3a',
        backgroundFocus: '#2d2d5f',
        text: '#f8f8ff',
        placeholder: '#bdbddb',
        border: '#ff007f',
        borderFocus: '#ff69b4',
        borderError: '#ff4500'
      },
      scrollbar: {
        track: '#0a0a23',
        thumb: '#ff007f',
        thumbHover: '#ff1493'
      },
      tooltip: {
        background: '#1a1a3a',
        text: '#f8f8ff',
        border: '#ff007f'
      }
    },
    terminal: {
      background: '#0a0a23',
      foreground: '#f8f8ff',
      cursor: '#ff69b4',
      selection: '#ff007f33',
      selectionForeground: '#f8f8ff',
      black: '#0a0a23',
      red: '#ff4500',
      green: '#00ff7f',
      yellow: '#ffd700',
      blue: '#00bfff',
      magenta: '#ff007f',
      cyan: '#00ffff',
      white: '#f8f8ff',
      brightBlack: '#4b0082',
      brightRed: '#ff6347',
      brightGreen: '#98fb98',
      brightYellow: '#ffffe0',
      brightBlue: '#87ceeb',
      brightMagenta: '#ff69b4',
      brightCyan: '#e0ffff',
      brightWhite: '#ffffff'
    },
    syntax: {
      keyword: '#ff007f',
      keywordControl: '#ff1493',
      keywordOperator: '#ff007f',
      string: '#00ff7f',
      stringEscape: '#98fb98',
      number: '#ffd700',
      boolean: '#ff007f',
      null: '#ff007f',
      comment: '#8a8aaa',
      commentBlock: '#8a8aaa',
      commentDoc: '#9370db',
      variable: '#f8f8ff',
      variableBuiltin: '#00ffff',
      parameter: '#e6e6fa',
      property: '#f8f8ff',
      function: '#00ffff',
      functionBuiltin: '#40e0d0',
      method: '#00ffff',
      type: '#ff69b4',
      typeBuiltin: '#da70d6',
      class: '#ff69b4',
      interface: '#ff1493',
      enum: '#ff69b4',
      operator: '#ff007f',
      punctuation: '#f8f8ff',
      bracket: '#00ffff',
      tag: '#ff1493',
      tagPunctuation: '#bdbddb',
      attribute: '#ffd700',
      attributeValue: '#00ff7f',
      constant: '#00bfff',
      macro: '#8a2be2',
      label: '#f8f8ff',
      namespace: '#ff69b4',
      error: '#ff4500',
      warning: '#ffa500',
      deprecated: '#8a8aaa'
    }
  },

  {
    id: 'forest-whisper',
    name: 'Forest Whisper',
    description: 'Mystical deep greens with golden accents, inspired by ancient woodlands',
    category: 'dark',
    author: 'Nature Collective',
    colors: {
      background: {
        primary: '#0f1419',
        secondary: '#1a2b1f',
        tertiary: '#253d2a',
        quaternary: '#2f4935',
        overlay: '#0f1419dd'
      },
      text: {
        primary: '#e8f5e8',
        secondary: '#c8e6c9',
        tertiary: '#a5d6a7',
        disabled: '#81c784',
        inverse: '#0f1419'
      },
      border: {
        primary: '#388e3c',
        secondary: '#4caf50',
        focus: '#66bb6a',
        hover: '#4caf50'
      },
      interactive: {
        primary: '#66bb6a',
        primaryHover: '#4caf50',
        primaryActive: '#388e3c',
        primaryDisabled: '#2e7d32',
        secondary: '#8bc34a',
        secondaryHover: '#9ccc65',
        tertiary: '#689f38',
        tertiaryHover: '#7cb342',
        link: '#a5d6a7',
        linkHover: '#c8e6c9',
        linkVisited: '#81c784'
      },
      semantic: {
        success: '#4caf50',
        successBg: '#4caf5022',
        successBorder: '#4caf5044',
        warning: '#ffc107',
        warningBg: '#ffc10722',
        warningBorder: '#ffc10744',
        error: '#f44336',
        errorBg: '#f4433622',
        errorBorder: '#f4433644',
        info: '#2196f3',
        infoBg: '#2196f322',
        infoBorder: '#2196f344'
      },
      sidebar: {
        background: '#1a2b1f',
        text: '#e8f5e8',
        textSecondary: '#c8e6c9',
        border: '#253d2a',
        itemHover: '#253d2a',
        itemHoverText: '#e8f5e8',
        itemActive: '#66bb6a',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#66bb6a'
      },
      editor: {
        background: '#0f1419',
        gutter: '#1a2b1f',
        gutterText: '#a5d6a7',
        selection: '#66bb6a33',
        selectionInactive: '#4caf5044',
        cursor: '#ffc107',
        currentLine: '#1a2b1f',
        matchingBracket: '#ffc10733',
        findMatch: '#8bc34a66',
        findMatchActive: '#66bb6a'
      },
      input: {
        background: '#1a2b1f',
        backgroundFocus: '#253d2a',
        text: '#e8f5e8',
        placeholder: '#a5d6a7',
        border: '#388e3c',
        borderFocus: '#66bb6a',
        borderError: '#f44336'
      },
      scrollbar: {
        track: '#0f1419',
        thumb: '#388e3c',
        thumbHover: '#4caf50'
      },
      tooltip: {
        background: '#1a2b1f',
        text: '#e8f5e8',
        border: '#388e3c'
      }
    },
    terminal: {
      background: '#0f1419',
      foreground: '#e8f5e8',
      cursor: '#ffc107',
      selection: '#66bb6a33',
      selectionForeground: '#e8f5e8',
      black: '#0f1419',
      red: '#f44336',
      green: '#4caf50',
      yellow: '#ffc107',
      blue: '#2196f3',
      magenta: '#9c27b0',
      cyan: '#00bcd4',
      white: '#e8f5e8',
      brightBlack: '#2f4935',
      brightRed: '#ef5350',
      brightGreen: '#66bb6a',
      brightYellow: '#ffeb3b',
      brightBlue: '#42a5f5',
      brightMagenta: '#ab47bc',
      brightCyan: '#26c6da',
      brightWhite: '#f1f8e9'
    },
    syntax: {
      keyword: '#66bb6a',
      keywordControl: '#4caf50',
      keywordOperator: '#66bb6a',
      string: '#c8e6c9',
      stringEscape: '#a5d6a7',
      number: '#ffc107',
      boolean: '#66bb6a',
      null: '#66bb6a',
      comment: '#81c784',
      commentBlock: '#81c784',
      commentDoc: '#689f38',
      variable: '#e8f5e8',
      variableBuiltin: '#a5d6a7',
      parameter: '#c8e6c9',
      property: '#e8f5e8',
      function: '#a5d6a7',
      functionBuiltin: '#8bc34a',
      method: '#a5d6a7',
      type: '#8bc34a',
      typeBuiltin: '#66bb6a',
      class: '#8bc34a',
      interface: '#9ccc65',
      enum: '#8bc34a',
      operator: '#66bb6a',
      punctuation: '#e8f5e8',
      bracket: '#ffc107',
      tag: '#4caf50',
      tagPunctuation: '#a5d6a7',
      attribute: '#c8e6c9',
      attributeValue: '#c8e6c9',
      constant: '#2196f3',
      macro: '#7cb342',
      label: '#e8f5e8',
      namespace: '#8bc34a',
      error: '#f44336',
      warning: '#ff9800',
      deprecated: '#81c784'
    }
  },

  {
    id: 'aurora-borealis',
    name: 'Aurora Borealis',
    description: 'Ethereal blues and greens dancing across midnight sky',
    category: 'dark',
    author: 'Arctic Studios',
    colors: {
      background: {
        primary: '#0d1421',
        secondary: '#1a2332',
        tertiary: '#263242',
        quaternary: '#334155',
        overlay: '#0d1421ee'
      },
      text: {
        primary: '#f0f9ff',
        secondary: '#e0f2fe',
        tertiary: '#bae6fd',
        disabled: '#7dd3fc',
        inverse: '#0d1421'
      },
      border: {
        primary: '#0ea5e9',
        secondary: '#38bdf8',
        focus: '#60a5fa',
        hover: '#38bdf8'
      },
      interactive: {
        primary: '#0ea5e9',
        primaryHover: '#0284c7',
        primaryActive: '#0369a1',
        primaryDisabled: '#075985',
        secondary: '#06b6d4',
        secondaryHover: '#0891b2',
        tertiary: '#0f766e',
        tertiaryHover: '#0d9488',
        link: '#67e8f9',
        linkHover: '#a5f3fc',
        linkVisited: '#c084fc'
      },
      semantic: {
        success: '#10b981',
        successBg: '#10b98122',
        successBorder: '#10b98144',
        warning: '#f59e0b',
        warningBg: '#f59e0b22',
        warningBorder: '#f59e0b44',
        error: '#ef4444',
        errorBg: '#ef444422',
        errorBorder: '#ef444444',
        info: '#3b82f6',
        infoBg: '#3b82f622',
        infoBorder: '#3b82f644'
      },
      sidebar: {
        background: '#1a2332',
        text: '#f0f9ff',
        textSecondary: '#e0f2fe',
        border: '#263242',
        itemHover: '#263242',
        itemHoverText: '#f0f9ff',
        itemActive: '#0ea5e9',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#0ea5e9'
      },
      editor: {
        background: '#0d1421',
        gutter: '#1a2332',
        gutterText: '#bae6fd',
        selection: '#0ea5e933',
        selectionInactive: '#38bdf844',
        cursor: '#67e8f9',
        currentLine: '#1a2332',
        matchingBracket: '#67e8f933',
        findMatch: '#06b6d466',
        findMatchActive: '#0ea5e9'
      },
      input: {
        background: '#1a2332',
        backgroundFocus: '#263242',
        text: '#f0f9ff',
        placeholder: '#bae6fd',
        border: '#0ea5e9',
        borderFocus: '#38bdf8',
        borderError: '#ef4444'
      },
      scrollbar: {
        track: '#0d1421',
        thumb: '#0ea5e9',
        thumbHover: '#38bdf8'
      },
      tooltip: {
        background: '#1a2332',
        text: '#f0f9ff',
        border: '#0ea5e9'
      }
    },
    terminal: {
      background: '#0d1421',
      foreground: '#f0f9ff',
      cursor: '#67e8f9',
      selection: '#0ea5e933',
      selectionForeground: '#f0f9ff',
      black: '#0d1421',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#f0f9ff',
      brightBlack: '#334155',
      brightRed: '#f87171',
      brightGreen: '#34d399',
      brightYellow: '#fbbf24',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#f8fafc'
    },
    syntax: {
      keyword: '#60a5fa',
      keywordControl: '#3b82f6',
      keywordOperator: '#60a5fa',
      string: '#34d399',
      stringEscape: '#10b981',
      number: '#fbbf24',
      boolean: '#60a5fa',
      null: '#60a5fa',
      comment: '#7dd3fc',
      commentBlock: '#7dd3fc',
      commentDoc: '#0f766e',
      variable: '#f0f9ff',
      variableBuiltin: '#67e8f9',
      parameter: '#e0f2fe',
      property: '#f0f9ff',
      function: '#67e8f9',
      functionBuiltin: '#0d9488',
      method: '#67e8f9',
      type: '#a5f3fc',
      typeBuiltin: '#06b6d4',
      class: '#a5f3fc',
      interface: '#22d3ee',
      enum: '#a5f3fc',
      operator: '#0ea5e9',
      punctuation: '#f0f9ff',
      bracket: '#67e8f9',
      tag: '#3b82f6',
      tagPunctuation: '#bae6fd',
      attribute: '#34d399',
      attributeValue: '#34d399',
      constant: '#c084fc',
      macro: '#0891b2',
      label: '#f0f9ff',
      namespace: '#a5f3fc',
      error: '#ef4444',
      warning: '#f59e0b',
      deprecated: '#7dd3fc'
    }
  },

  {
    id: 'cyberpunk-2077',
    name: 'Cyberpunk 2077',
    description: 'High-tech low-life aesthetic with neon yellow and electric blue',
    category: 'dark',
    author: 'Night City Collective',
    colors: {
      background: {
        primary: '#0f0f0f',
        secondary: '#1f1f1f',
        tertiary: '#2f2f2f',
        quaternary: '#3f3f3f',
        overlay: '#0f0f0fdd'
      },
      text: {
        primary: '#f0f0f0',
        secondary: '#d0d0d0',
        tertiary: '#b0b0b0',
        disabled: '#808080',
        inverse: '#0f0f0f'
      },
      border: {
        primary: '#fcee0a',
        secondary: '#fcee0a',
        focus: '#00f5ff',
        hover: '#fcee0a'
      },
      interactive: {
        primary: '#fcee0a',
        primaryHover: '#e6d500',
        primaryActive: '#ccbf00',
        primaryDisabled: '#b3a500',
        secondary: '#00f5ff',
        secondaryHover: '#00e6e6',
        tertiary: '#ff073a',
        tertiaryHover: '#e60633',
        link: '#00f5ff',
        linkHover: '#33f7ff',
        linkVisited: '#ff3d71'
      },
      semantic: {
        success: '#00ff41',
        successBg: '#00ff4122',
        successBorder: '#00ff4144',
        warning: '#fcee0a',
        warningBg: '#fcee0a22',
        warningBorder: '#fcee0a44',
        error: '#ff073a',
        errorBg: '#ff073a22',
        errorBorder: '#ff073a44',
        info: '#00f5ff',
        infoBg: '#00f5ff22',
        infoBorder: '#00f5ff44'
      },
      sidebar: {
        background: '#1f1f1f',
        text: '#f0f0f0',
        textSecondary: '#d0d0d0',
        border: '#2f2f2f',
        itemHover: '#2f2f2f',
        itemHoverText: '#f0f0f0',
        itemActive: '#fcee0a',
        itemActiveText: '#000000',
        itemActiveBorder: '#fcee0a'
      },
      editor: {
        background: '#0f0f0f',
        gutter: '#1f1f1f',
        gutterText: '#b0b0b0',
        selection: '#fcee0a33',
        selectionInactive: '#00f5ff44',
        cursor: '#fcee0a',
        currentLine: '#1f1f1f',
        matchingBracket: '#00ff4133',
        findMatch: '#00f5ff66',
        findMatchActive: '#fcee0a'
      },
      input: {
        background: '#1f1f1f',
        backgroundFocus: '#2f2f2f',
        text: '#f0f0f0',
        placeholder: '#b0b0b0',
        border: '#fcee0a',
        borderFocus: '#00f5ff',
        borderError: '#ff073a'
      },
      scrollbar: {
        track: '#0f0f0f',
        thumb: '#fcee0a',
        thumbHover: '#00f5ff'
      },
      tooltip: {
        background: '#1f1f1f',
        text: '#f0f0f0',
        border: '#fcee0a'
      }
    },
    terminal: {
      background: '#0f0f0f',
      foreground: '#f0f0f0',
      cursor: '#fcee0a',
      selection: '#fcee0a33',
      selectionForeground: '#0f0f0f',
      black: '#0f0f0f',
      red: '#ff073a',
      green: '#00ff41',
      yellow: '#fcee0a',
      blue: '#00f5ff',
      magenta: '#ff3d71',
      cyan: '#00f5ff',
      white: '#f0f0f0',
      brightBlack: '#3f3f3f',
      brightRed: '#ff4757',
      brightGreen: '#2ed573',
      brightYellow: '#ffa502',
      brightBlue: '#3742fa',
      brightMagenta: '#ff3838',
      brightCyan: '#70a1ff',
      brightWhite: '#ffffff'
    },
    syntax: {
      keyword: '#fcee0a',
      keywordControl: '#ff073a',
      keywordOperator: '#fcee0a',
      string: '#00ff41',
      stringEscape: '#2ed573',
      number: '#ff3d71',
      boolean: '#fcee0a',
      null: '#fcee0a',
      comment: '#808080',
      commentBlock: '#808080',
      commentDoc: '#b3a500',
      variable: '#f0f0f0',
      variableBuiltin: '#00f5ff',
      parameter: '#d0d0d0',
      property: '#f0f0f0',
      function: '#00f5ff',
      functionBuiltin: '#33f7ff',
      method: '#00f5ff',
      type: '#fcee0a',
      typeBuiltin: '#e6d500',
      class: '#fcee0a',
      interface: '#ffa502',
      enum: '#fcee0a',
      operator: '#fcee0a',
      punctuation: '#f0f0f0',
      bracket: '#00f5ff',
      tag: '#ff073a',
      tagPunctuation: '#b0b0b0',
      attribute: '#00ff41',
      attributeValue: '#00ff41',
      constant: '#ff3d71',
      macro: '#00e6e6',
      label: '#f0f0f0',
      namespace: '#fcee0a',
      error: '#ff073a',
      warning: '#fcee0a',
      deprecated: '#808080'
    }
  },

  // === LIGHT THEMES ===
  {
    id: 'github-light',
    name: 'GitHub Light',
    description: 'Clean, professional light theme with excellent readability',
    category: 'light',
    author: 'GitHub',
    colors: {
      background: {
        primary: '#ffffff',
        secondary: '#f6f8fa',
        tertiary: '#f1f3f4',
        quaternary: '#e9ecef',
        overlay: '#ffffffee'
      },
      text: {
        primary: '#24292f',
        secondary: '#656d76',
        tertiary: '#8b949e',
        disabled: '#afb8c1',
        inverse: '#ffffff'
      },
      border: {
        primary: '#d1d9e0',
        secondary: '#d8dee4',
        focus: '#0969da',
        hover: '#c0c8d0'
      },
      interactive: {
        primary: '#0969da',
        primaryHover: '#0860ca',
        primaryActive: '#0757ba',
        primaryDisabled: '#8cc8ff',
        secondary: '#656d76',
        secondaryHover: '#525960',
        tertiary: '#f6f8fa',
        tertiaryHover: '#e9ecef',
        link: '#0969da',
        linkHover: '#0860ca',
        linkVisited: '#8250df'
      },
      semantic: {
        success: '#1a7f37',
        successBg: '#dafbe1',
        successBorder: '#aceebb',
        warning: '#9a6700',
        warningBg: '#fff8c5',
        warningBorder: '#d4a72c',
        error: '#cf222e',
        errorBg: '#ffebe9',
        errorBorder: '#ff818266',
        info: '#0969da',
        infoBg: '#ddf4ff',
        infoBorder: '#54aeff66'
      },
      sidebar: {
        background: '#f6f8fa',
        text: '#24292f',
        textSecondary: '#656d76',
        border: '#d1d9e0',
        itemHover: '#e9ecef',
        itemHoverText: '#24292f',
        itemActive: '#0969da',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#0969da'
      },
      editor: {
        background: '#ffffff',
        gutter: '#f6f8fa',
        gutterText: '#8b949e',
        selection: '#0969da22',
        selectionInactive: '#656d7644',
        cursor: '#24292f',
        currentLine: '#f6f8fa',
        matchingBracket: '#1a7f3733',
        findMatch: '#ffdf5d66',
        findMatchActive: '#0969da'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#24292f',
        placeholder: '#8b949e',
        border: '#d1d9e0',
        borderFocus: '#0969da',
        borderError: '#cf222e'
      },
      scrollbar: {
        track: '#f6f8fa',
        thumb: '#c0c8d0',
        thumbHover: '#afb8c1'
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
      selection: '#0969da22',
      selectionForeground: '#24292f',
      black: '#24292f',
      red: '#cf222e',
      green: '#1a7f37',
      yellow: '#9a6700',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#1b7c83',
      white: '#656d76',
      brightBlack: '#8b949e',
      brightRed: '#cf222e',
      brightGreen: '#1a7f37',
      brightYellow: '#9a6700',
      brightBlue: '#0969da',
      brightMagenta: '#8250df',
      brightCyan: '#1b7c83',
      brightWhite: '#24292f'
    },
    syntax: {
      keyword: '#cf222e',
      keywordControl: '#d73a49',
      keywordOperator: '#cf222e',
      string: '#032f62',
      stringEscape: '#22863a',
      number: '#005cc5',
      boolean: '#cf222e',
      null: '#cf222e',
      comment: '#6a737d',
      commentBlock: '#6a737d',
      commentDoc: '#6f42c1',
      variable: '#24292e',
      variableBuiltin: '#005cc5',
      parameter: '#e36209',
      property: '#24292e',
      function: '#6f42c1',
      functionBuiltin: '#005cc5',
      method: '#6f42c1',
      type: '#005cc5',
      typeBuiltin: '#cf222e',
      class: '#6f42c1',
      interface: '#005cc5',
      enum: '#005cc5',
      operator: '#d73a49',
      punctuation: '#24292e',
      bracket: '#24292e',
      tag: '#22863a',
      tagPunctuation: '#8b949e',
      attribute: '#6f42c1',
      attributeValue: '#032f62',
      constant: '#005cc5',
      macro: '#d73a49',
      label: '#24292e',
      namespace: '#6f42c1',
      error: '#cf222e',
      warning: '#b08800',
      deprecated: '#8b949e'
    }
  },

  {
    id: 'sakura-bloom',
    name: 'Sakura Bloom',
    description: 'Delicate pink and white theme inspired by cherry blossoms',
    category: 'light',
    author: 'Hanami Studios',
    colors: {
      background: {
        primary: '#fef7f7',
        secondary: '#fdeaea',
        tertiary: '#f8d7da',
        quaternary: '#f1c0c7',
        overlay: '#fef7f7ee'
      },
      text: {
        primary: '#5d4037',
        secondary: '#8d6e63',
        tertiary: '#a1887f',
        disabled: '#bcaaa4',
        inverse: '#fef7f7'
      },
      border: {
        primary: '#e1a3aa',
        secondary: '#f48fb1',
        focus: '#e91e63',
        hover: '#f06292'
      },
      interactive: {
        primary: '#e91e63',
        primaryHover: '#d81b60',
        primaryActive: '#c2185b',
        primaryDisabled: '#f8bbd9',
        secondary: '#f06292',
        secondaryHover: '#ec407a',
        tertiary: '#fce4ec',
        tertiaryHover: '#f8bbd9',
        link: '#e91e63',
        linkHover: '#d81b60',
        linkVisited: '#ab47bc'
      },
      semantic: {
        success: '#66bb6a',
        successBg: '#e8f5e8',
        successBorder: '#c8e6c9',
        warning: '#ffc107',
        warningBg: '#fff8e1',
        warningBorder: '#ffecb3',
        error: '#f44336',
        errorBg: '#ffebee',
        errorBorder: '#ffcdd2',
        info: '#2196f3',
        infoBg: '#e3f2fd',
        infoBorder: '#bbdefb'
      },
      sidebar: {
        background: '#fdeaea',
        text: '#5d4037',
        textSecondary: '#8d6e63',
        border: '#f8d7da',
        itemHover: '#f8d7da',
        itemHoverText: '#5d4037',
        itemActive: '#e91e63',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#e91e63'
      },
      editor: {
        background: '#fef7f7',
        gutter: '#fdeaea',
        gutterText: '#a1887f',
        selection: '#e91e6322',
        selectionInactive: '#f0629244',
        cursor: '#e91e63',
        currentLine: '#fdeaea',
        matchingBracket: '#66bb6a33',
        findMatch: '#ffc10766',
        findMatchActive: '#e91e63'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#5d4037',
        placeholder: '#a1887f',
        border: '#e1a3aa',
        borderFocus: '#e91e63',
        borderError: '#f44336'
      },
      scrollbar: {
        track: '#fdeaea',
        thumb: '#f06292',
        thumbHover: '#e91e63'
      },
      tooltip: {
        background: '#5d4037',
        text: '#fef7f7',
        border: '#5d4037'
      }
    },
    terminal: {
      background: '#fef7f7',
      foreground: '#5d4037',
      cursor: '#e91e63',
      selection: '#e91e6322',
      selectionForeground: '#5d4037',
      black: '#5d4037',
      red: '#f44336',
      green: '#66bb6a',
      yellow: '#ffc107',
      blue: '#2196f3',
      magenta: '#e91e63',
      cyan: '#26c6da',
      white: '#8d6e63',
      brightBlack: '#a1887f',
      brightRed: '#f44336',
      brightGreen: '#66bb6a',
      brightYellow: '#ffc107',
      brightBlue: '#2196f3',
      brightMagenta: '#e91e63',
      brightCyan: '#26c6da',
      brightWhite: '#3e2723'
    },
    syntax: {
      keyword: '#e91e63',
      keywordControl: '#d81b60',
      keywordOperator: '#e91e63',
      string: '#66bb6a',
      stringEscape: '#4caf50',
      number: '#2196f3',
      boolean: '#e91e63',
      null: '#e91e63',
      comment: '#a1887f',
      commentBlock: '#a1887f',
      commentDoc: '#8d6e63',
      variable: '#5d4037',
      variableBuiltin: '#ab47bc',
      parameter: '#8d6e63',
      property: '#5d4037',
      function: '#ab47bc',
      functionBuiltin: '#2196f3',
      method: '#ab47bc',
      type: '#2196f3',
      typeBuiltin: '#e91e63',
      class: '#ab47bc',
      interface: '#2196f3',
      enum: '#2196f3',
      operator: '#e91e63',
      punctuation: '#5d4037',
      bracket: '#5d4037',
      tag: '#66bb6a',
      tagPunctuation: '#a1887f',
      attribute: '#ab47bc',
      attributeValue: '#66bb6a',
      constant: '#2196f3',
      macro: '#ec407a',
      label: '#5d4037',
      namespace: '#ab47bc',
      error: '#f44336',
      warning: '#ff9800',
      deprecated: '#a1887f'
    }
  },

  // === SPECIALTY THEMES ===
  {
    id: 'midnight-oil',
    name: 'Midnight Oil',
    description: 'Deep blues for late-night coding sessions, easy on the eyes',
    category: 'dark',
    author: 'Night Shift Studios',
    colors: {
      background: {
        primary: '#0c1821',
        secondary: '#1b2631',
        tertiary: '#2c3e50',
        quaternary: '#34495e',
        overlay: '#0c1821dd'
      },
      text: {
        primary: '#ecf0f1',
        secondary: '#bdc3c7',
        tertiary: '#95a5a6',
        disabled: '#7f8c8d',
        inverse: '#0c1821'
      },
      border: {
        primary: '#3498db',
        secondary: '#5dade2',
        focus: '#85c1e9',
        hover: '#5dade2'
      },
      interactive: {
        primary: '#3498db',
        primaryHover: '#2e86c1',
        primaryActive: '#2874a6',
        primaryDisabled: '#5dade2',
        secondary: '#85c1e9',
        secondaryHover: '#7fb3d3',
        tertiary: '#2c3e50',
        tertiaryHover: '#34495e',
        link: '#85c1e9',
        linkHover: '#aed6f1',
        linkVisited: '#bb8fce'
      },
      semantic: {
        success: '#27ae60',
        successBg: '#27ae6022',
        successBorder: '#27ae6044',
        warning: '#f39c12',
        warningBg: '#f39c1222',
        warningBorder: '#f39c1244',
        error: '#e74c3c',
        errorBg: '#e74c3c22',
        errorBorder: '#e74c3c44',
        info: '#3498db',
        infoBg: '#3498db22',
        infoBorder: '#3498db44'
      },
      sidebar: {
        background: '#1b2631',
        text: '#ecf0f1',
        textSecondary: '#bdc3c7',
        border: '#2c3e50',
        itemHover: '#2c3e50',
        itemHoverText: '#ecf0f1',
        itemActive: '#3498db',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#3498db'
      },
      editor: {
        background: '#0c1821',
        gutter: '#1b2631',
        gutterText: '#95a5a6',
        selection: '#3498db33',
        selectionInactive: '#5dade244',
        cursor: '#85c1e9',
        currentLine: '#1b2631',
        matchingBracket: '#27ae6033',
        findMatch: '#f39c1266',
        findMatchActive: '#3498db'
      },
      input: {
        background: '#1b2631',
        backgroundFocus: '#2c3e50',
        text: '#ecf0f1',
        placeholder: '#95a5a6',
        border: '#3498db',
        borderFocus: '#85c1e9',
        borderError: '#e74c3c'
      },
      scrollbar: {
        track: '#0c1821',
        thumb: '#3498db',
        thumbHover: '#5dade2'
      },
      tooltip: {
        background: '#1b2631',
        text: '#ecf0f1',
        border: '#3498db'
      }
    },
    terminal: {
      background: '#0c1821',
      foreground: '#ecf0f1',
      cursor: '#85c1e9',
      selection: '#3498db33',
      selectionForeground: '#ecf0f1',
      black: '#0c1821',
      red: '#e74c3c',
      green: '#27ae60',
      yellow: '#f39c12',
      blue: '#3498db',
      magenta: '#9b59b6',
      cyan: '#1abc9c',
      white: '#ecf0f1',
      brightBlack: '#34495e',
      brightRed: '#ec7063',
      brightGreen: '#58d68d',
      brightYellow: '#f7dc6f',
      brightBlue: '#85c1e9',
      brightMagenta: '#bb8fce',
      brightCyan: '#7fb3d3',
      brightWhite: '#ffffff'
    },
    syntax: {
      keyword: '#85c1e9',
      keywordControl: '#3498db',
      keywordOperator: '#85c1e9',
      string: '#58d68d',
      stringEscape: '#27ae60',
      number: '#f7dc6f',
      boolean: '#85c1e9',
      null: '#85c1e9',
      comment: '#7f8c8d',
      commentBlock: '#7f8c8d',
      commentDoc: '#95a5a6',
      variable: '#ecf0f1',
      variableBuiltin: '#bb8fce',
      parameter: '#bdc3c7',
      property: '#ecf0f1',
      function: '#bb8fce',
      functionBuiltin: '#aed6f1',
      method: '#bb8fce',
      type: '#85c1e9',
      typeBuiltin: '#3498db',
      class: '#85c1e9',
      interface: '#aed6f1',
      enum: '#85c1e9',
      operator: '#3498db',
      punctuation: '#ecf0f1',
      bracket: '#85c1e9',
      tag: '#3498db',
      tagPunctuation: '#95a5a6',
      attribute: '#58d68d',
      attributeValue: '#58d68d',
      constant: '#f7dc6f',
      macro: '#2e86c1',
      label: '#ecf0f1',
      namespace: '#85c1e9',
      error: '#e74c3c',
      warning: '#f39c12',
      deprecated: '#7f8c8d'
    }
  },

  {
    id: 'cosmic-latte',
    name: 'Cosmic Latte',
    description: 'Warm beige tones inspired by the average color of the universe',
    category: 'light',
    author: 'Cosmic Studios',
    colors: {
      background: {
        primary: '#fff8dc',
        secondary: '#faf0e6',
        tertiary: '#f5deb3',
        quaternary: '#deb887',
        overlay: '#fff8dcee'
      },
      text: {
        primary: '#3c2415',
        secondary: '#5d4e37',
        tertiary: '#8b7355',
        disabled: '#a0956b',
        inverse: '#fff8dc'
      },
      border: {
        primary: '#cd853f',
        secondary: '#daa520',
        focus: '#b8860b',
        hover: '#daa520'
      },
      interactive: {
        primary: '#b8860b',
        primaryHover: '#daa520',
        primaryActive: '#cd853f',
        primaryDisabled: '#f0e68c',
        secondary: '#cd853f',
        secondaryHover: '#daa520',
        tertiary: '#f5deb3',
        tertiaryHover: '#deb887',
        link: '#b8860b',
        linkHover: '#daa520',
        linkVisited: '#8b4513'
      },
      semantic: {
        success: '#228b22',
        successBg: '#f0fff0',
        successBorder: '#98fb98',
        warning: '#ff8c00',
        warningBg: '#fff8dc',
        warningBorder: '#ffb347',
        error: '#dc143c',
        errorBg: '#ffe4e1',
        errorBorder: '#ffa0a0',
        info: '#4682b4',
        infoBg: '#f0f8ff',
        infoBorder: '#87ceeb'
      },
      sidebar: {
        background: '#faf0e6',
        text: '#3c2415',
        textSecondary: '#5d4e37',
        border: '#f5deb3',
        itemHover: '#f5deb3',
        itemHoverText: '#3c2415',
        itemActive: '#b8860b',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#b8860b'
      },
      editor: {
        background: '#fff8dc',
        gutter: '#faf0e6',
        gutterText: '#8b7355',
        selection: '#b8860b22',
        selectionInactive: '#daa52044',
        cursor: '#3c2415',
        currentLine: '#faf0e6',
        matchingBracket: '#228b2233',
        findMatch: '#ffb34766',
        findMatchActive: '#b8860b'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#3c2415',
        placeholder: '#8b7355',
        border: '#cd853f',
        borderFocus: '#b8860b',
        borderError: '#dc143c'
      },
      scrollbar: {
        track: '#faf0e6',
        thumb: '#cd853f',
        thumbHover: '#b8860b'
      },
      tooltip: {
        background: '#3c2415',
        text: '#fff8dc',
        border: '#3c2415'
      }
    },
    terminal: {
      background: '#fff8dc',
      foreground: '#3c2415',
      cursor: '#b8860b',
      selection: '#b8860b22',
      selectionForeground: '#3c2415',
      black: '#3c2415',
      red: '#dc143c',
      green: '#228b22',
      yellow: '#ff8c00',
      blue: '#4682b4',
      magenta: '#8b4513',
      cyan: '#20b2aa',
      white: '#5d4e37',
      brightBlack: '#8b7355',
      brightRed: '#dc143c',
      brightGreen: '#228b22',
      brightYellow: '#ff8c00',
      brightBlue: '#4682b4',
      brightMagenta: '#8b4513',
      brightCyan: '#20b2aa',
      brightWhite: '#2f1b14'
    },
    syntax: {
      keyword: '#b8860b',
      keywordControl: '#daa520',
      keywordOperator: '#b8860b',
      string: '#228b22',
      stringEscape: '#2e8b57',
      number: '#ff8c00',
      boolean: '#b8860b',
      null: '#b8860b',
      comment: '#8b7355',
      commentBlock: '#8b7355',
      commentDoc: '#a0956b',
      variable: '#3c2415',
      variableBuiltin: '#8b4513',
      parameter: '#5d4e37',
      property: '#3c2415',
      function: '#8b4513',
      functionBuiltin: '#4682b4',
      method: '#8b4513',
      type: '#4682b4',
      typeBuiltin: '#b8860b',
      class: '#8b4513',
      interface: '#4682b4',
      enum: '#4682b4',
      operator: '#b8860b',
      punctuation: '#3c2415',
      bracket: '#3c2415',
      tag: '#228b22',
      tagPunctuation: '#8b7355',
      attribute: '#8b4513',
      attributeValue: '#228b22',
      constant: '#4682b4',
      macro: '#cd853f',
      label: '#3c2415',
      namespace: '#8b4513',
      error: '#dc143c',
      warning: '#ff8c00',
      deprecated: '#8b7355'
    }
  }
]

/**
 * Theme utility functions
 */
export function getThemeById(id: string): Theme | undefined {
  return themes.find(theme => theme.id === id)
}

export function getThemesByCategory(category: 'light' | 'dark'): Theme[] {
  return themes.filter(theme => theme.category === category)
}

export function getDefaultTheme(): Theme {
  return getThemeById('vscode-dark') || themes[0]
}

export function getSystemPreferredTheme(): Theme {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const availableThemes = getThemesByCategory(prefersDark ? 'dark' : 'light')
  return availableThemes[0] || getDefaultTheme()
}

export const totalThemes = themes.length
export const darkThemes = getThemesByCategory('dark').length
export const lightThemes = getThemesByCategory('light').length