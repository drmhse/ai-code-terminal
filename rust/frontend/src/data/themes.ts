import type { Theme } from '@/types/theme'

/**
 * ACT PROFESSIONAL THEME COLLECTION
 * Enterprise-grade themes designed for AI Code Terminal
 * Built on Atlassian design principles with diverse personalities
 * Each theme optimized for productivity, accessibility, and professional use
 */

export const themes: Theme[] = [
  // === ACT FOUNDATION THEMES ===
  {
    id: 'act-light',
    name: 'ACT Light',
    description: 'Professional light theme for focused productivity',
    category: 'light',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#ffffff',
        secondary: '#f7f8f9',
        tertiary: '#ebecf0',
        quaternary: '#dfe1e6',
        overlay: '#ffffffee'
      },
      text: {
        primary: '#172b4d',
        secondary: '#42526e',
        tertiary: '#6b778c',
        disabled: '#97a0af',
        inverse: '#ffffff'
      },
      border: {
        primary: '#dfe1e6',
        secondary: '#ebecf0',
        focus: '#0052cc',
        hover: '#c1c7d0'
      },
      interactive: {
        primary: '#0052cc',
        primaryHover: '#0065ff',
        primaryActive: '#0747a6',
        primaryDisabled: '#b3d4ff',
        secondary: '#42526e',
        secondaryHover: '#344563',
        tertiary: '#f4f5f7',
        tertiaryHover: '#ebecf0',
        link: '#0052cc',
        linkHover: '#0065ff',
        linkVisited: '#403294'
      },
      semantic: {
        success: '#006644',
        successBg: '#e3fcef',
        successBorder: '#abf5d1',
        warning: '#ff8b00',
        warningBg: '#fffae6',
        warningBorder: '#ffe380',
        error: '#de350b',
        errorBg: '#ffebe6',
        errorBorder: '#ffbdad',
        info: '#0065ff',
        infoBg: '#deebff',
        infoBorder: '#b3d4ff'
      },
      sidebar: {
        background: '#f7f8f9',
        text: '#172b4d',
        textSecondary: '#42526e',
        border: '#dfe1e6',
        itemHover: '#ebecf0',
        itemHoverText: '#172b4d',
        itemActive: '#0052cc',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#0052cc'
      },
      editor: {
        background: '#ffffff',
        gutter: '#f7f8f9',
        gutterText: '#6b778c',
        selection: '#0052cc22',
        selectionInactive: '#42526e22',
        cursor: '#172b4d',
        currentLine: '#f7f8f9',
        matchingBracket: '#00664433',
        findMatch: '#ffe38066',
        findMatchActive: '#0052cc'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#172b4d',
        placeholder: '#6b778c',
        border: '#dfe1e6',
        borderFocus: '#0052cc',
        borderError: '#de350b'
      },
      scrollbar: {
        track: '#f7f8f9',
        thumb: '#c1c7d0',
        thumbHover: '#97a0af'
      },
      tooltip: {
        background: '#172b4d',
        text: '#ffffff',
        border: '#172b4d'
      }
    },
    terminal: {
      background: '#ffffff',
      foreground: '#172b4d',
      cursor: '#0052cc',
      selection: '#0052cc22',
      selectionForeground: '#172b4d',
      black: '#172b4d',
      red: '#de350b',
      green: '#006644',
      yellow: '#ff8b00',
      blue: '#0052cc',
      magenta: '#403294',
      cyan: '#008da6',
      white: '#42526e',
      brightBlack: '#6b778c',
      brightRed: '#ff5630',
      brightGreen: '#36b37e',
      brightYellow: '#ffab00',
      brightBlue: '#0065ff',
      brightMagenta: '#6554c0',
      brightCyan: '#00b8d9',
      brightWhite: '#172b4d'
    },
    syntax: {
      keyword: '#0052cc',
      keywordControl: '#403294',
      keywordOperator: '#0052cc',
      string: '#006644',
      stringEscape: '#36b37e',
      number: '#ff8b00',
      boolean: '#0052cc',
      null: '#0052cc',
      comment: '#6b778c',
      commentBlock: '#6b778c',
      commentDoc: '#42526e',
      variable: '#172b4d',
      variableBuiltin: '#403294',
      parameter: '#42526e',
      property: '#172b4d',
      function: '#403294',
      functionBuiltin: '#0052cc',
      method: '#403294',
      type: '#0052cc',
      typeBuiltin: '#0052cc',
      class: '#403294',
      interface: '#0052cc',
      enum: '#0052cc',
      operator: '#0052cc',
      punctuation: '#172b4d',
      bracket: '#42526e',
      tag: '#006644',
      tagPunctuation: '#6b778c',
      attribute: '#403294',
      attributeValue: '#006644',
      constant: '#ff8b00',
      macro: '#0065ff',
      label: '#172b4d',
      namespace: '#403294',
      error: '#de350b',
      warning: '#ff8b00',
      deprecated: '#6b778c'
    }
  },

  {
    id: 'act-dark',
    name: 'ACT Dark',
    description: 'Professional dark theme for focused productivity',
    category: 'dark',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#1d2125',
        secondary: '#22272b',
        tertiary: '#282e33',
        quaternary: '#2c333a',
        overlay: '#1d2125ee'
      },
      text: {
        primary: '#b6c2cf',
        secondary: '#9fadbc',
        tertiary: '#738496',
        disabled: '#596773',
        inverse: '#1d2125'
      },
      border: {
        primary: '#414a53',
        secondary: '#373d45',
        focus: '#388bff',
        hover: '#454f59'
      },
      interactive: {
        primary: '#388bff',
        primaryHover: '#579dff',
        primaryActive: '#1d7afc',
        primaryDisabled: '#0d47a1',
        secondary: '#596773',
        secondaryHover: '#738496',
        tertiary: '#282e33',
        tertiaryHover: '#2c333a',
        link: '#388bff',
        linkHover: '#579dff',
        linkVisited: '#8777d9'
      },
      semantic: {
        success: '#4ade80',
        successBg: '#1f4332',
        successBorder: '#2a5d31',
        warning: '#f59e0b',
        warningBg: '#533f20',
        warningBorder: '#7c4d00',
        error: '#f87171',
        errorBg: '#441c12',
        errorBorder: '#7a2e1d',
        info: '#388bff',
        infoBg: '#1c2b42',
        infoBorder: '#1e3a5f'
      },
      sidebar: {
        background: '#22272b',
        text: '#b6c2cf',
        textSecondary: '#9fadbc',
        border: '#373d45',
        itemHover: '#282e33',
        itemHoverText: '#b6c2cf',
        itemActive: '#388bff',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#388bff'
      },
      editor: {
        background: '#1d2125',
        gutter: '#22272b',
        gutterText: '#738496',
        selection: '#388bff33',
        selectionInactive: '#596773444',
        cursor: '#b6c2cf',
        currentLine: '#22272b',
        matchingBracket: '#4ade8033',
        findMatch: '#f59e0b66',
        findMatchActive: '#388bff'
      },
      input: {
        background: '#22272b',
        backgroundFocus: '#282e33',
        text: '#b6c2cf',
        placeholder: '#738496',
        border: '#414a53',
        borderFocus: '#388bff',
        borderError: '#f87171'
      },
      scrollbar: {
        track: '#1d2125',
        thumb: '#414a53',
        thumbHover: '#454f59'
      },
      tooltip: {
        background: '#22272b',
        text: '#b6c2cf',
        border: '#414a53'
      }
    },
    terminal: {
      background: '#1d2125',
      foreground: '#b6c2cf',
      cursor: '#388bff',
      selection: '#388bff33',
      selectionForeground: '#b6c2cf',
      black: '#1d2125',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#f59e0b',
      blue: '#388bff',
      magenta: '#8777d9',
      cyan: '#06b6d4',
      white: '#b6c2cf',
      brightBlack: '#414a53',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fbbf24',
      brightBlue: '#579dff',
      brightMagenta: '#a78bfa',
      brightCyan: '#22d3ee',
      brightWhite: '#ffffff'
    },
    syntax: {
      keyword: '#388bff',
      keywordControl: '#8777d9',
      keywordOperator: '#388bff',
      string: '#4ade80',
      stringEscape: '#86efac',
      number: '#f59e0b',
      boolean: '#388bff',
      null: '#388bff',
      comment: '#738496',
      commentBlock: '#738496',
      commentDoc: '#596773',
      variable: '#b6c2cf',
      variableBuiltin: '#8777d9',
      parameter: '#9fadbc',
      property: '#b6c2cf',
      function: '#8777d9',
      functionBuiltin: '#388bff',
      method: '#8777d9',
      type: '#388bff',
      typeBuiltin: '#388bff',
      class: '#8777d9',
      interface: '#388bff',
      enum: '#388bff',
      operator: '#388bff',
      punctuation: '#b6c2cf',
      bracket: '#9fadbc',
      tag: '#4ade80',
      tagPunctuation: '#738496',
      attribute: '#8777d9',
      attributeValue: '#4ade80',
      constant: '#f59e0b',
      macro: '#579dff',
      label: '#b6c2cf',
      namespace: '#8777d9',
      error: '#f87171',
      warning: '#f59e0b',
      deprecated: '#738496'
    }
  },

  // === ACT NATURE THEMES ===
  {
    id: 'act-nature-light',
    name: 'ACT Nature Light',
    description: 'Harmonious green theme for balanced productivity',
    category: 'light',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#fefffe',
        secondary: '#f8faf8',
        tertiary: '#f1f5f1',
        quaternary: '#e8f0e8',
        overlay: '#fefffe'
      },
      text: {
        primary: '#0d3818',
        secondary: '#2d5016',
        tertiary: '#4a6b2f',
        disabled: '#7a9c5f',
        inverse: '#ffffff'
      },
      border: {
        primary: '#c8e6c9',
        secondary: '#e1f5fe',
        focus: '#2e7d31',
        hover: '#a5d6a7'
      },
      interactive: {
        primary: '#2e7d31',
        primaryHover: '#43a047',
        primaryActive: '#1b5e20',
        primaryDisabled: '#a5d6a7',
        secondary: '#4a6b2f',
        secondaryHover: '#2d5016',
        tertiary: '#f1f5f1',
        tertiaryHover: '#e8f0e8',
        link: '#2e7d31',
        linkHover: '#43a047',
        linkVisited: '#7b1fa2'
      },
      semantic: {
        success: '#4caf50',
        successBg: '#e8f5e8',
        successBorder: '#c8e6c9',
        warning: '#ffa000',
        warningBg: '#fff8e1',
        warningBorder: '#ffecb3',
        error: '#d32f2f',
        errorBg: '#ffebee',
        errorBorder: '#ffcdd2',
        info: '#1976d2',
        infoBg: '#e3f2fd',
        infoBorder: '#bbdefb'
      },
      sidebar: {
        background: '#f8faf8',
        text: '#0d3818',
        textSecondary: '#2d5016',
        border: '#c8e6c9',
        itemHover: '#f1f5f1',
        itemHoverText: '#0d3818',
        itemActive: '#2e7d31',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#2e7d31'
      },
      editor: {
        background: '#fefffe',
        gutter: '#f8faf8',
        gutterText: '#4a6b2f',
        selection: '#2e7d3122',
        selectionInactive: '#4a6b2f22',
        cursor: '#0d3818',
        currentLine: '#f8faf8',
        matchingBracket: '#4caf5033',
        findMatch: '#ffa00066',
        findMatchActive: '#2e7d31'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#0d3818',
        placeholder: '#4a6b2f',
        border: '#c8e6c9',
        borderFocus: '#2e7d31',
        borderError: '#d32f2f'
      },
      scrollbar: {
        track: '#f8faf8',
        thumb: '#a5d6a7',
        thumbHover: '#81c784'
      },
      tooltip: {
        background: '#0d3818',
        text: '#ffffff',
        border: '#0d3818'
      }
    },
    terminal: {
      background: '#fefffe',
      foreground: '#0d3818',
      cursor: '#2e7d31',
      selection: '#2e7d3122',
      selectionForeground: '#0d3818',
      black: '#0d3818',
      red: '#d32f2f',
      green: '#4caf50',
      yellow: '#ffa000',
      blue: '#1976d2',
      magenta: '#7b1fa2',
      cyan: '#0097a7',
      white: '#2d5016',
      brightBlack: '#4a6b2f',
      brightRed: '#f44336',
      brightGreen: '#66bb6a',
      brightYellow: '#ffb300',
      brightBlue: '#2196f3',
      brightMagenta: '#9c27b0',
      brightCyan: '#00acc1',
      brightWhite: '#0d3818'
    },
    syntax: {
      keyword: '#2e7d31',
      keywordControl: '#7b1fa2',
      keywordOperator: '#2e7d31',
      string: '#4caf50',
      stringEscape: '#66bb6a',
      number: '#ffa000',
      boolean: '#2e7d31',
      null: '#2e7d31',
      comment: '#4a6b2f',
      commentBlock: '#4a6b2f',
      commentDoc: '#2d5016',
      variable: '#0d3818',
      variableBuiltin: '#7b1fa2',
      parameter: '#2d5016',
      property: '#0d3818',
      function: '#7b1fa2',
      functionBuiltin: '#1976d2',
      method: '#7b1fa2',
      type: '#1976d2',
      typeBuiltin: '#2e7d31',
      class: '#7b1fa2',
      interface: '#1976d2',
      enum: '#1976d2',
      operator: '#2e7d31',
      punctuation: '#0d3818',
      bracket: '#2d5016',
      tag: '#4caf50',
      tagPunctuation: '#4a6b2f',
      attribute: '#7b1fa2',
      attributeValue: '#4caf50',
      constant: '#ffa000',
      macro: '#43a047',
      label: '#0d3818',
      namespace: '#7b1fa2',
      error: '#d32f2f',
      warning: '#ff8f00',
      deprecated: '#4a6b2f'
    }
  },

  {
    id: 'act-nature-dark',
    name: 'ACT Nature Dark',
    description: 'Harmonious green theme for balanced night productivity',
    category: 'dark',
    author: 'ACT Design System',
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
        tertiary: '#253d2a',
        tertiaryHover: '#2f4935',
        link: '#a5d6a7',
        linkHover: '#c8e6c9',
        linkVisited: '#ce93d8'
      },
      semantic: {
        success: '#4caf50',
        successBg: '#1f4332',
        successBorder: '#2a5d31',
        warning: '#ff9800',
        warningBg: '#533f20',
        warningBorder: '#7c4d00',
        error: '#f44336',
        errorBg: '#441c12',
        errorBorder: '#7a2e1d',
        info: '#2196f3',
        infoBg: '#1c2b42',
        infoBorder: '#1e3a5f'
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
        cursor: '#e8f5e8',
        currentLine: '#1a2b1f',
        matchingBracket: '#4caf5033',
        findMatch: '#ff980066',
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
      cursor: '#66bb6a',
      selection: '#66bb6a33',
      selectionForeground: '#e8f5e8',
      black: '#0f1419',
      red: '#f44336',
      green: '#4caf50',
      yellow: '#ff9800',
      blue: '#2196f3',
      magenta: '#9c27b0',
      cyan: '#00bcd4',
      white: '#e8f5e8',
      brightBlack: '#2f4935',
      brightRed: '#ef5350',
      brightGreen: '#66bb6a',
      brightYellow: '#ffb74d',
      brightBlue: '#42a5f5',
      brightMagenta: '#ab47bc',
      brightCyan: '#26c6da',
      brightWhite: '#f1f8e9'
    },
    syntax: {
      keyword: '#66bb6a',
      keywordControl: '#9c27b0',
      keywordOperator: '#66bb6a',
      string: '#c8e6c9',
      stringEscape: '#a5d6a7',
      number: '#ff9800',
      boolean: '#66bb6a',
      null: '#66bb6a',
      comment: '#81c784',
      commentBlock: '#81c784',
      commentDoc: '#689f38',
      variable: '#e8f5e8',
      variableBuiltin: '#ce93d8',
      parameter: '#c8e6c9',
      property: '#e8f5e8',
      function: '#ce93d8',
      functionBuiltin: '#2196f3',
      method: '#ce93d8',
      type: '#2196f3',
      typeBuiltin: '#66bb6a',
      class: '#ce93d8',
      interface: '#2196f3',
      enum: '#2196f3',
      operator: '#66bb6a',
      punctuation: '#e8f5e8',
      bracket: '#c8e6c9',
      tag: '#4caf50',
      tagPunctuation: '#a5d6a7',
      attribute: '#ce93d8',
      attributeValue: '#c8e6c9',
      constant: '#ff9800',
      macro: '#4caf50',
      label: '#e8f5e8',
      namespace: '#ce93d8',
      error: '#f44336',
      warning: '#ff9800',
      deprecated: '#81c784'
    }
  },

  // === ACT VOLCANO THEMES ===
  {
    id: 'act-volcano-light',
    name: 'ACT Volcano Light',
    description: 'Energetic red theme for high-performance productivity',
    category: 'light',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#ffffff',
        secondary: '#fef7f7',
        tertiary: '#fdeaea',
        quaternary: '#f8d7da',
        overlay: '#ffffffee'
      },
      text: {
        primary: '#5d1a1a',
        secondary: '#8d2828',
        tertiary: '#b33636',
        disabled: '#cc6666',
        inverse: '#ffffff'
      },
      border: {
        primary: '#ffcdd2',
        secondary: '#ffebee',
        focus: '#c62828',
        hover: '#ef9a9a'
      },
      interactive: {
        primary: '#c62828',
        primaryHover: '#d32f2f',
        primaryActive: '#b71c1c',
        primaryDisabled: '#ffcdd2',
        secondary: '#8d2828',
        secondaryHover: '#5d1a1a',
        tertiary: '#fdeaea',
        tertiaryHover: '#f8d7da',
        link: '#c62828',
        linkHover: '#d32f2f',
        linkVisited: '#7b1fa2'
      },
      semantic: {
        success: '#4caf50',
        successBg: '#e8f5e8',
        successBorder: '#c8e6c9',
        warning: '#ff9800',
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
        background: '#fef7f7',
        text: '#5d1a1a',
        textSecondary: '#8d2828',
        border: '#ffcdd2',
        itemHover: '#fdeaea',
        itemHoverText: '#5d1a1a',
        itemActive: '#c62828',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#c62828'
      },
      editor: {
        background: '#ffffff',
        gutter: '#fef7f7',
        gutterText: '#b33636',
        selection: '#c6282822',
        selectionInactive: '#8d282822',
        cursor: '#5d1a1a',
        currentLine: '#fef7f7',
        matchingBracket: '#4caf5033',
        findMatch: '#ff980066',
        findMatchActive: '#c62828'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#5d1a1a',
        placeholder: '#b33636',
        border: '#ffcdd2',
        borderFocus: '#c62828',
        borderError: '#f44336'
      },
      scrollbar: {
        track: '#fef7f7',
        thumb: '#ef9a9a',
        thumbHover: '#e57373'
      },
      tooltip: {
        background: '#5d1a1a',
        text: '#ffffff',
        border: '#5d1a1a'
      }
    },
    terminal: {
      background: '#ffffff',
      foreground: '#5d1a1a',
      cursor: '#c62828',
      selection: '#c6282822',
      selectionForeground: '#5d1a1a',
      black: '#5d1a1a',
      red: '#f44336',
      green: '#4caf50',
      yellow: '#ff9800',
      blue: '#2196f3',
      magenta: '#c62828',
      cyan: '#00bcd4',
      white: '#8d2828',
      brightBlack: '#b33636',
      brightRed: '#f44336',
      brightGreen: '#66bb6a',
      brightYellow: '#ffb74d',
      brightBlue: '#42a5f5',
      brightMagenta: '#d32f2f',
      brightCyan: '#26c6da',
      brightWhite: '#5d1a1a'
    },
    syntax: {
      keyword: '#c62828',
      keywordControl: '#7b1fa2',
      keywordOperator: '#c62828',
      string: '#4caf50',
      stringEscape: '#66bb6a',
      number: '#ff9800',
      boolean: '#c62828',
      null: '#c62828',
      comment: '#b33636',
      commentBlock: '#b33636',
      commentDoc: '#8d2828',
      variable: '#5d1a1a',
      variableBuiltin: '#7b1fa2',
      parameter: '#8d2828',
      property: '#5d1a1a',
      function: '#7b1fa2',
      functionBuiltin: '#2196f3',
      method: '#7b1fa2',
      type: '#2196f3',
      typeBuiltin: '#c62828',
      class: '#7b1fa2',
      interface: '#2196f3',
      enum: '#2196f3',
      operator: '#c62828',
      punctuation: '#5d1a1a',
      bracket: '#8d2828',
      tag: '#4caf50',
      tagPunctuation: '#b33636',
      attribute: '#7b1fa2',
      attributeValue: '#4caf50',
      constant: '#ff9800',
      macro: '#d32f2f',
      label: '#5d1a1a',
      namespace: '#7b1fa2',
      error: '#f44336',
      warning: '#ff9800',
      deprecated: '#b33636'
    }
  },

  {
    id: 'act-volcano-dark',
    name: 'ACT Volcano Dark',
    description: 'Energetic red theme for high-performance night productivity',
    category: 'dark',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#2c1012',
        secondary: '#3d1a1c',
        tertiary: '#4a2325',
        quaternary: '#5d2d2f',
        overlay: '#2c1012dd'
      },
      text: {
        primary: '#ffcccc',
        secondary: '#ffaaaa',
        tertiary: '#ff8888',
        disabled: '#ff6666',
        inverse: '#2c1012'
      },
      border: {
        primary: '#8b2635',
        secondary: '#a63946',
        focus: '#d93025',
        hover: '#c62d42'
      },
      interactive: {
        primary: '#d93025',
        primaryHover: '#ea4335',
        primaryActive: '#c5221f',
        primaryDisabled: '#8b2635',
        secondary: '#ff6b6b',
        secondaryHover: '#ff5252',
        tertiary: '#4a2325',
        tertiaryHover: '#5d2d2f',
        link: '#ff9999',
        linkHover: '#ffcccc',
        linkVisited: '#ce93d8'
      },
      semantic: {
        success: '#4caf50',
        successBg: '#1f4332',
        successBorder: '#2a5d31',
        warning: '#ff9800',
        warningBg: '#533f20',
        warningBorder: '#7c4d00',
        error: '#f44336',
        errorBg: '#441c12',
        errorBorder: '#7a2e1d',
        info: '#2196f3',
        infoBg: '#1c2b42',
        infoBorder: '#1e3a5f'
      },
      sidebar: {
        background: '#3d1a1c',
        text: '#ffcccc',
        textSecondary: '#ffaaaa',
        border: '#4a2325',
        itemHover: '#4a2325',
        itemHoverText: '#ffcccc',
        itemActive: '#d93025',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#d93025'
      },
      editor: {
        background: '#2c1012',
        gutter: '#3d1a1c',
        gutterText: '#ff8888',
        selection: '#d9302533',
        selectionInactive: '#8b263544',
        cursor: '#ffcccc',
        currentLine: '#3d1a1c',
        matchingBracket: '#4caf5033',
        findMatch: '#ff980066',
        findMatchActive: '#d93025'
      },
      input: {
        background: '#3d1a1c',
        backgroundFocus: '#4a2325',
        text: '#ffcccc',
        placeholder: '#ff8888',
        border: '#8b2635',
        borderFocus: '#d93025',
        borderError: '#f44336'
      },
      scrollbar: {
        track: '#2c1012',
        thumb: '#8b2635',
        thumbHover: '#a63946'
      },
      tooltip: {
        background: '#3d1a1c',
        text: '#ffcccc',
        border: '#8b2635'
      }
    },
    terminal: {
      background: '#2c1012',
      foreground: '#ffcccc',
      cursor: '#d93025',
      selection: '#d9302533',
      selectionForeground: '#ffcccc',
      black: '#2c1012',
      red: '#f44336',
      green: '#4caf50',
      yellow: '#ff9800',
      blue: '#2196f3',
      magenta: '#d93025',
      cyan: '#00bcd4',
      white: '#ffcccc',
      brightBlack: '#5d2d2f',
      brightRed: '#ff5252',
      brightGreen: '#66bb6a',
      brightYellow: '#ffb74d',
      brightBlue: '#42a5f5',
      brightMagenta: '#ff6b6b',
      brightCyan: '#26c6da',
      brightWhite: '#ffffff'
    },
    syntax: {
      keyword: '#d93025',
      keywordControl: '#ce93d8',
      keywordOperator: '#d93025',
      string: '#4caf50',
      stringEscape: '#66bb6a',
      number: '#ff9800',
      boolean: '#d93025',
      null: '#d93025',
      comment: '#ff6666',
      commentBlock: '#ff6666',
      commentDoc: '#ff8888',
      variable: '#ffcccc',
      variableBuiltin: '#ce93d8',
      parameter: '#ffaaaa',
      property: '#ffcccc',
      function: '#ce93d8',
      functionBuiltin: '#2196f3',
      method: '#ce93d8',
      type: '#2196f3',
      typeBuiltin: '#d93025',
      class: '#ce93d8',
      interface: '#2196f3',
      enum: '#2196f3',
      operator: '#d93025',
      punctuation: '#ffcccc',
      bracket: '#ffaaaa',
      tag: '#4caf50',
      tagPunctuation: '#ff8888',
      attribute: '#ce93d8',
      attributeValue: '#4caf50',
      constant: '#ff9800',
      macro: '#ea4335',
      label: '#ffcccc',
      namespace: '#ce93d8',
      error: '#f44336',
      warning: '#ff9800',
      deprecated: '#ff6666'
    }
  },

  // === ACT TITANIUM THEMES ===
  {
    id: 'act-titanium-light',
    name: 'ACT Titanium Light',
    description: 'Precision gray theme for minimalist productivity',
    category: 'light',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#ffffff',
        secondary: '#fafbfc',
        tertiary: '#f4f5f7',
        quaternary: '#ebecf0',
        overlay: '#ffffffee'
      },
      text: {
        primary: '#2c3e50',
        secondary: '#455a64',
        tertiary: '#607d8b',
        disabled: '#90a4ae',
        inverse: '#ffffff'
      },
      border: {
        primary: '#cfd8dc',
        secondary: '#eceff1',
        focus: '#455a64',
        hover: '#b0bec5'
      },
      interactive: {
        primary: '#455a64',
        primaryHover: '#546e7a',
        primaryActive: '#37474f',
        primaryDisabled: '#cfd8dc',
        secondary: '#607d8b',
        secondaryHover: '#546e7a',
        tertiary: '#f4f5f7',
        tertiaryHover: '#ebecf0',
        link: '#455a64',
        linkHover: '#546e7a',
        linkVisited: '#7b1fa2'
      },
      semantic: {
        success: '#4caf50',
        successBg: '#e8f5e8',
        successBorder: '#c8e6c9',
        warning: '#ff9800',
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
        background: '#fafbfc',
        text: '#2c3e50',
        textSecondary: '#455a64',
        border: '#cfd8dc',
        itemHover: '#f4f5f7',
        itemHoverText: '#2c3e50',
        itemActive: '#455a64',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#455a64'
      },
      editor: {
        background: '#ffffff',
        gutter: '#fafbfc',
        gutterText: '#607d8b',
        selection: '#455a6422',
        selectionInactive: '#607d8b22',
        cursor: '#2c3e50',
        currentLine: '#fafbfc',
        matchingBracket: '#4caf5033',
        findMatch: '#ff980066',
        findMatchActive: '#455a64'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#2c3e50',
        placeholder: '#607d8b',
        border: '#cfd8dc',
        borderFocus: '#455a64',
        borderError: '#f44336'
      },
      scrollbar: {
        track: '#fafbfc',
        thumb: '#b0bec5',
        thumbHover: '#90a4ae'
      },
      tooltip: {
        background: '#2c3e50',
        text: '#ffffff',
        border: '#2c3e50'
      }
    },
    terminal: {
      background: '#ffffff',
      foreground: '#2c3e50',
      cursor: '#455a64',
      selection: '#455a6422',
      selectionForeground: '#2c3e50',
      black: '#2c3e50',
      red: '#f44336',
      green: '#4caf50',
      yellow: '#ff9800',
      blue: '#2196f3',
      magenta: '#9c27b0',
      cyan: '#00bcd4',
      white: '#455a64',
      brightBlack: '#607d8b',
      brightRed: '#f44336',
      brightGreen: '#66bb6a',
      brightYellow: '#ffb74d',
      brightBlue: '#42a5f5',
      brightMagenta: '#ab47bc',
      brightCyan: '#26c6da',
      brightWhite: '#2c3e50'
    },
    syntax: {
      keyword: '#455a64',
      keywordControl: '#9c27b0',
      keywordOperator: '#455a64',
      string: '#4caf50',
      stringEscape: '#66bb6a',
      number: '#ff9800',
      boolean: '#455a64',
      null: '#455a64',
      comment: '#607d8b',
      commentBlock: '#607d8b',
      commentDoc: '#546e7a',
      variable: '#2c3e50',
      variableBuiltin: '#9c27b0',
      parameter: '#455a64',
      property: '#2c3e50',
      function: '#9c27b0',
      functionBuiltin: '#2196f3',
      method: '#9c27b0',
      type: '#2196f3',
      typeBuiltin: '#455a64',
      class: '#9c27b0',
      interface: '#2196f3',
      enum: '#2196f3',
      operator: '#455a64',
      punctuation: '#2c3e50',
      bracket: '#455a64',
      tag: '#4caf50',
      tagPunctuation: '#607d8b',
      attribute: '#9c27b0',
      attributeValue: '#4caf50',
      constant: '#ff9800',
      macro: '#546e7a',
      label: '#2c3e50',
      namespace: '#9c27b0',
      error: '#f44336',
      warning: '#ff9800',
      deprecated: '#607d8b'
    }
  },

  {
    id: 'act-titanium-dark',
    name: 'ACT Titanium Dark',
    description: 'Precision gray theme for minimalist night productivity',
    category: 'dark',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#1a1d23',
        secondary: '#232831',
        tertiary: '#2c333a',
        quaternary: '#373e47',
        overlay: '#1a1d23dd'
      },
      text: {
        primary: '#e8eaed',
        secondary: '#bdc1c6',
        tertiary: '#9aa0a6',
        disabled: '#5f6368',
        inverse: '#1a1d23'
      },
      border: {
        primary: '#5f6368',
        secondary: '#4d5156',
        focus: '#8ab4f8',
        hover: '#6e7175'
      },
      interactive: {
        primary: '#8ab4f8',
        primaryHover: '#aecbfa',
        primaryActive: '#669df6',
        primaryDisabled: '#5f6368',
        secondary: '#bdc1c6',
        secondaryHover: '#e8eaed',
        tertiary: '#2c333a',
        tertiaryHover: '#373e47',
        link: '#8ab4f8',
        linkHover: '#aecbfa',
        linkVisited: '#c58af9'
      },
      semantic: {
        success: '#34a853',
        successBg: '#1e3a1e',
        successBorder: '#2d5016',
        warning: '#fbbc04',
        warningBg: '#533f20',
        warningBorder: '#7c4d00',
        error: '#ea4335',
        errorBg: '#441c12',
        errorBorder: '#7a2e1d',
        info: '#4285f4',
        infoBg: '#1c2b42',
        infoBorder: '#1e3a5f'
      },
      sidebar: {
        background: '#232831',
        text: '#e8eaed',
        textSecondary: '#bdc1c6',
        border: '#2c333a',
        itemHover: '#2c333a',
        itemHoverText: '#e8eaed',
        itemActive: '#8ab4f8',
        itemActiveText: '#1a1d23',
        itemActiveBorder: '#8ab4f8'
      },
      editor: {
        background: '#1a1d23',
        gutter: '#232831',
        gutterText: '#9aa0a6',
        selection: '#8ab4f833',
        selectionInactive: '#5f636844',
        cursor: '#e8eaed',
        currentLine: '#232831',
        matchingBracket: '#34a85333',
        findMatch: '#fbbc0466',
        findMatchActive: '#8ab4f8'
      },
      input: {
        background: '#232831',
        backgroundFocus: '#2c333a',
        text: '#e8eaed',
        placeholder: '#9aa0a6',
        border: '#5f6368',
        borderFocus: '#8ab4f8',
        borderError: '#ea4335'
      },
      scrollbar: {
        track: '#1a1d23',
        thumb: '#5f6368',
        thumbHover: '#6e7175'
      },
      tooltip: {
        background: '#232831',
        text: '#e8eaed',
        border: '#5f6368'
      }
    },
    terminal: {
      background: '#1a1d23',
      foreground: '#e8eaed',
      cursor: '#8ab4f8',
      selection: '#8ab4f833',
      selectionForeground: '#e8eaed',
      black: '#1a1d23',
      red: '#ea4335',
      green: '#34a853',
      yellow: '#fbbc04',
      blue: '#4285f4',
      magenta: '#9c27b0',
      cyan: '#00bcd4',
      white: '#e8eaed',
      brightBlack: '#373e47',
      brightRed: '#f28b82',
      brightGreen: '#81c995',
      brightYellow: '#fdd663',
      brightBlue: '#8ab4f8',
      brightMagenta: '#c58af9',
      brightCyan: '#78d9ec',
      brightWhite: '#ffffff'
    },
    syntax: {
      keyword: '#8ab4f8',
      keywordControl: '#c58af9',
      keywordOperator: '#8ab4f8',
      string: '#34a853',
      stringEscape: '#81c995',
      number: '#fbbc04',
      boolean: '#8ab4f8',
      null: '#8ab4f8',
      comment: '#5f6368',
      commentBlock: '#5f6368',
      commentDoc: '#6e7175',
      variable: '#e8eaed',
      variableBuiltin: '#c58af9',
      parameter: '#bdc1c6',
      property: '#e8eaed',
      function: '#c58af9',
      functionBuiltin: '#4285f4',
      method: '#c58af9',
      type: '#4285f4',
      typeBuiltin: '#8ab4f8',
      class: '#c58af9',
      interface: '#4285f4',
      enum: '#4285f4',
      operator: '#8ab4f8',
      punctuation: '#e8eaed',
      bracket: '#bdc1c6',
      tag: '#34a853',
      tagPunctuation: '#9aa0a6',
      attribute: '#c58af9',
      attributeValue: '#34a853',
      constant: '#fbbc04',
      macro: '#aecbfa',
      label: '#e8eaed',
      namespace: '#c58af9',
      error: '#ea4335',
      warning: '#fbbc04',
      deprecated: '#5f6368'
    }
  },

  // === ACT OCEAN THEMES ===
  {
    id: 'act-ocean-light',
    name: 'ACT Ocean Light',
    description: 'Deep teal theme for clarity and flow state',
    category: 'light',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#ffffff',
        secondary: '#f0fdfa',
        tertiary: '#ccfbf1',
        quaternary: '#99f6e4',
        overlay: '#ffffffee'
      },
      text: {
        primary: '#134e4a',
        secondary: '#0f766e',
        tertiary: '#14b8a6',
        disabled: '#5eead4',
        inverse: '#ffffff'
      },
      border: {
        primary: '#99f6e4',
        secondary: '#ccfbf1',
        focus: '#0d9488',
        hover: '#5eead4'
      },
      interactive: {
        primary: '#0d9488',
        primaryHover: '#14b8a6',
        primaryActive: '#0f766e',
        primaryDisabled: '#99f6e4',
        secondary: '#0f766e',
        secondaryHover: '#134e4a',
        tertiary: '#ccfbf1',
        tertiaryHover: '#99f6e4',
        link: '#0d9488',
        linkHover: '#14b8a6',
        linkVisited: '#7c3aed'
      },
      semantic: {
        success: '#059669',
        successBg: '#ecfdf5',
        successBorder: '#a7f3d0',
        warning: '#d97706',
        warningBg: '#fffbeb',
        warningBorder: '#fed7aa',
        error: '#dc2626',
        errorBg: '#fef2f2',
        errorBorder: '#fecaca',
        info: '#0284c7',
        infoBg: '#f0f9ff',
        infoBorder: '#bae6fd'
      },
      sidebar: {
        background: '#f0fdfa',
        text: '#134e4a',
        textSecondary: '#0f766e',
        border: '#99f6e4',
        itemHover: '#ccfbf1',
        itemHoverText: '#134e4a',
        itemActive: '#0d9488',
        itemActiveText: '#ffffff',
        itemActiveBorder: '#0d9488'
      },
      editor: {
        background: '#ffffff',
        gutter: '#f0fdfa',
        gutterText: '#14b8a6',
        selection: '#0d948822',
        selectionInactive: '#0f766e22',
        cursor: '#134e4a',
        currentLine: '#f0fdfa',
        matchingBracket: '#05966933',
        findMatch: '#d9770666',
        findMatchActive: '#0d9488'
      },
      input: {
        background: '#ffffff',
        backgroundFocus: '#ffffff',
        text: '#134e4a',
        placeholder: '#14b8a6',
        border: '#99f6e4',
        borderFocus: '#0d9488',
        borderError: '#dc2626'
      },
      scrollbar: {
        track: '#f0fdfa',
        thumb: '#5eead4',
        thumbHover: '#2dd4bf'
      },
      tooltip: {
        background: '#134e4a',
        text: '#ffffff',
        border: '#134e4a'
      }
    },
    terminal: {
      background: '#ffffff',
      foreground: '#134e4a',
      cursor: '#0d9488',
      selection: '#0d948822',
      selectionForeground: '#134e4a',
      black: '#134e4a',
      red: '#dc2626',
      green: '#059669',
      yellow: '#d97706',
      blue: '#0284c7',
      magenta: '#7c3aed',
      cyan: '#0891b2',
      white: '#0f766e',
      brightBlack: '#14b8a6',
      brightRed: '#dc2626',
      brightGreen: '#10b981',
      brightYellow: '#f59e0b',
      brightBlue: '#0ea5e9',
      brightMagenta: '#8b5cf6',
      brightCyan: '#06b6d4',
      brightWhite: '#134e4a'
    },
    syntax: {
      keyword: '#0d9488',
      keywordControl: '#7c3aed',
      keywordOperator: '#0d9488',
      string: '#059669',
      stringEscape: '#10b981',
      number: '#d97706',
      boolean: '#0d9488',
      null: '#0d9488',
      comment: '#14b8a6',
      commentBlock: '#14b8a6',
      commentDoc: '#0f766e',
      variable: '#134e4a',
      variableBuiltin: '#7c3aed',
      parameter: '#0f766e',
      property: '#134e4a',
      function: '#7c3aed',
      functionBuiltin: '#0284c7',
      method: '#7c3aed',
      type: '#0284c7',
      typeBuiltin: '#0d9488',
      class: '#7c3aed',
      interface: '#0284c7',
      enum: '#0284c7',
      operator: '#0d9488',
      punctuation: '#134e4a',
      bracket: '#0f766e',
      tag: '#059669',
      tagPunctuation: '#14b8a6',
      attribute: '#7c3aed',
      attributeValue: '#059669',
      constant: '#d97706',
      macro: '#14b8a6',
      label: '#134e4a',
      namespace: '#7c3aed',
      error: '#dc2626',
      warning: '#d97706',
      deprecated: '#14b8a6'
    }
  },

  {
    id: 'act-ocean-dark',
    name: 'ACT Ocean Dark',
    description: 'Deep teal theme for clarity and night flow state',
    category: 'dark',
    author: 'ACT Design System',
    colors: {
      background: {
        primary: '#0f1419',
        secondary: '#134e4a',
        tertiary: '#0f766e',
        quaternary: '#0d9488',
        overlay: '#0f1419dd'
      },
      text: {
        primary: '#f0fdfa',
        secondary: '#ccfbf1',
        tertiary: '#99f6e4',
        disabled: '#5eead4',
        inverse: '#0f1419'
      },
      border: {
        primary: '#14b8a6',
        secondary: '#0d9488',
        focus: '#2dd4bf',
        hover: '#14b8a6'
      },
      interactive: {
        primary: '#2dd4bf',
        primaryHover: '#5eead4',
        primaryActive: '#14b8a6',
        primaryDisabled: '#0f766e',
        secondary: '#5eead4',
        secondaryHover: '#99f6e4',
        tertiary: '#0f766e',
        tertiaryHover: '#0d9488',
        link: '#99f6e4',
        linkHover: '#ccfbf1',
        linkVisited: '#c4b5fd'
      },
      semantic: {
        success: '#10b981',
        successBg: '#064e3b',
        successBorder: '#065f46',
        warning: '#f59e0b',
        warningBg: '#533f20',
        warningBorder: '#7c4d00',
        error: '#f87171',
        errorBg: '#441c12',
        errorBorder: '#7a2e1d',
        info: '#0ea5e9',
        infoBg: '#1c2b42',
        infoBorder: '#1e3a5f'
      },
      sidebar: {
        background: '#134e4a',
        text: '#f0fdfa',
        textSecondary: '#ccfbf1',
        border: '#0f766e',
        itemHover: '#0f766e',
        itemHoverText: '#f0fdfa',
        itemActive: '#2dd4bf',
        itemActiveText: '#0f1419',
        itemActiveBorder: '#2dd4bf'
      },
      editor: {
        background: '#0f1419',
        gutter: '#134e4a',
        gutterText: '#99f6e4',
        selection: '#2dd4bf33',
        selectionInactive: '#0d948844',
        cursor: '#f0fdfa',
        currentLine: '#134e4a',
        matchingBracket: '#10b98133',
        findMatch: '#f59e0b66',
        findMatchActive: '#2dd4bf'
      },
      input: {
        background: '#134e4a',
        backgroundFocus: '#0f766e',
        text: '#f0fdfa',
        placeholder: '#99f6e4',
        border: '#14b8a6',
        borderFocus: '#2dd4bf',
        borderError: '#f87171'
      },
      scrollbar: {
        track: '#0f1419',
        thumb: '#14b8a6',
        thumbHover: '#0d9488'
      },
      tooltip: {
        background: '#134e4a',
        text: '#f0fdfa',
        border: '#14b8a6'
      }
    },
    terminal: {
      background: '#0f1419',
      foreground: '#f0fdfa',
      cursor: '#2dd4bf',
      selection: '#2dd4bf33',
      selectionForeground: '#f0fdfa',
      black: '#0f1419',
      red: '#f87171',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#0ea5e9',
      magenta: '#8b5cf6',
      cyan: '#06b6d4',
      white: '#f0fdfa',
      brightBlack: '#0d9488',
      brightRed: '#fca5a5',
      brightGreen: '#34d399',
      brightYellow: '#fbbf24',
      brightBlue: '#38bdf8',
      brightMagenta: '#a78bfa',
      brightCyan: '#22d3ee',
      brightWhite: '#ffffff'
    },
    syntax: {
      keyword: '#2dd4bf',
      keywordControl: '#c4b5fd',
      keywordOperator: '#2dd4bf',
      string: '#10b981',
      stringEscape: '#34d399',
      number: '#f59e0b',
      boolean: '#2dd4bf',
      null: '#2dd4bf',
      comment: '#5eead4',
      commentBlock: '#5eead4',
      commentDoc: '#99f6e4',
      variable: '#f0fdfa',
      variableBuiltin: '#c4b5fd',
      parameter: '#ccfbf1',
      property: '#f0fdfa',
      function: '#c4b5fd',
      functionBuiltin: '#0ea5e9',
      method: '#c4b5fd',
      type: '#0ea5e9',
      typeBuiltin: '#2dd4bf',
      class: '#c4b5fd',
      interface: '#0ea5e9',
      enum: '#0ea5e9',
      operator: '#2dd4bf',
      punctuation: '#f0fdfa',
      bracket: '#ccfbf1',
      tag: '#10b981',
      tagPunctuation: '#99f6e4',
      attribute: '#c4b5fd',
      attributeValue: '#10b981',
      constant: '#f59e0b',
      macro: '#5eead4',
      label: '#f0fdfa',
      namespace: '#c4b5fd',
      error: '#f87171',
      warning: '#f59e0b',
      deprecated: '#5eead4'
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
  return getThemeById('act-dark') || themes[0]
}

export function getSystemPreferredTheme(): Theme {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (prefersDark) {
    return getThemeById('act-dark') || getThemesByCategory('dark')[0] || getDefaultTheme()
  } else {
    return getThemeById('act-light') || getThemesByCategory('light')[0] || getDefaultTheme()
  }
}

export const totalThemes = themes.length
export const darkThemes = getThemesByCategory('dark').length
export const lightThemes = getThemesByCategory('light').length