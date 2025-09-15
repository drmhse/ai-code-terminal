/**
 * Comprehensive theme system for AI Code Terminal
 * Frontend-driven with complete color definitions
 */

export interface ThemeColors {
  // Background hierarchy (from darkest/lightest to lightest/darkest)
  background: {
    primary: string      // Main application background
    secondary: string    // Panels, sidebars, cards
    tertiary: string     // Elevated surfaces, hover states
    quaternary: string   // Selected/active states
    overlay: string      // Modal overlays, dropdowns
  }

  // Text hierarchy (from most to least prominent)
  text: {
    primary: string      // Main text content
    secondary: string    // Less important text, labels
    tertiary: string     // Muted text, placeholders
    disabled: string     // Disabled text
    inverse: string      // Text on colored backgrounds
  }

  // Border and divider colors
  border: {
    primary: string      // Main borders, dividers
    secondary: string    // Subtle borders, hr elements  
    focus: string        // Focus indicators
    hover: string        // Hover state borders
  }

  // Interactive elements (buttons, links, inputs)
  interactive: {
    primary: string          // Main action color
    primaryHover: string     // Primary hover state
    primaryActive: string    // Primary active/pressed state
    primaryDisabled: string  // Primary disabled state
    
    secondary: string        // Secondary action color
    secondaryHover: string   // Secondary hover state
    
    tertiary: string         // Tertiary/ghost actions
    tertiaryHover: string    // Tertiary hover state
    
    link: string            // Link color
    linkHover: string       // Link hover color
    linkVisited: string     // Visited link color
  }

  // Semantic colors (consistent meaning across themes)
  semantic: {
    success: string          // Success states, positive actions
    successBg: string        // Success background/subtle
    successBorder: string    // Success borders
    
    warning: string          // Warning states, caution
    warningBg: string        // Warning background/subtle  
    warningBorder: string    // Warning borders
    
    error: string            // Error states, destructive actions
    errorBg: string          // Error background/subtle
    errorBorder: string      // Error borders
    
    info: string             // Informational states
    infoBg: string           // Info background/subtle
    infoBorder: string       // Info borders
  }

  // Context-specific areas
  sidebar: {
    background: string       // Sidebar background
    text: string            // Sidebar text
    textSecondary: string   // Sidebar secondary text
    border: string          // Sidebar borders
    itemHover: string       // Sidebar item hover background
    itemHoverText: string   // Sidebar item hover text
    itemActive: string      // Sidebar active item background
    itemActiveText: string  // Sidebar active item text
    itemActiveBorder: string // Active item accent
  }

  // Code editor specific
  editor: {
    background: string       // Editor background
    gutter: string          // Line number gutter
    gutterText: string      // Line numbers
    selection: string       // Text selection
    selectionInactive: string // Selection when not focused
    cursor: string          // Cursor color
    currentLine: string     // Current line highlight
    matchingBracket: string // Bracket matching
    findMatch: string       // Search matches
    findMatchActive: string // Active search match
  }

  // Form inputs
  input: {
    background: string       // Input backgrounds
    backgroundFocus: string  // Focused input background
    text: string            // Input text
    placeholder: string     // Placeholder text
    border: string          // Input borders
    borderFocus: string     // Focused input border
    borderError: string     // Error state border
  }

  // Special UI elements
  scrollbar: {
    track: string           // Scrollbar track
    thumb: string           // Scrollbar thumb
    thumbHover: string      // Scrollbar thumb hover
  }

  tooltip: {
    background: string      // Tooltip background
    text: string           // Tooltip text
    border: string         // Tooltip border
  }
}

export interface TerminalColors {
  // Core terminal colors
  background: string         // Terminal background
  foreground: string        // Default text color
  cursor: string           // Cursor color
  selection: string        // Selection background
  selectionForeground: string // Selection text (optional)

  // Standard 16 ANSI colors
  // Normal intensity
  black: string            // ANSI 0
  red: string              // ANSI 1  
  green: string            // ANSI 2
  yellow: string           // ANSI 3
  blue: string             // ANSI 4
  magenta: string          // ANSI 5
  cyan: string             // ANSI 6
  white: string            // ANSI 7

  // High intensity (bright)
  brightBlack: string      // ANSI 8
  brightRed: string        // ANSI 9
  brightGreen: string      // ANSI 10
  brightYellow: string     // ANSI 11
  brightBlue: string       // ANSI 12
  brightMagenta: string    // ANSI 13
  brightCyan: string       // ANSI 14
  brightWhite: string      // ANSI 15
}

export interface SyntaxColors {
  // Language constructs
  keyword: string          // Keywords (if, for, class, etc.)
  keywordControl: string   // Control keywords (return, break)
  keywordOperator: string  // Operator keywords (and, or, in)
  
  // Literals
  string: string           // String literals
  stringEscape: string     // String escape sequences
  number: string           // Numeric literals
  boolean: string          // Boolean literals
  null: string             // Null/undefined/nil
  
  // Comments
  comment: string          // Single line comments
  commentBlock: string     // Block comments
  commentDoc: string       // Documentation comments
  
  // Identifiers
  variable: string         // Variables
  variableBuiltin: string  // Built-in variables
  parameter: string        // Function parameters
  property: string         // Object properties
  
  // Functions and types
  function: string         // Function names
  functionBuiltin: string  // Built-in functions
  method: string           // Method names
  type: string             // Type names
  typeBuiltin: string      // Built-in types
  class: string            // Class names
  interface: string        // Interface names
  enum: string             // Enum names
  
  // Operators and punctuation  
  operator: string         // Operators (+, -, *, etc.)
  punctuation: string      // Punctuation (., ;, :, etc.)
  bracket: string          // Brackets, braces, parens
  
  // Markup (HTML/XML/Markdown)
  tag: string              // HTML/XML tags
  tagPunctuation: string   // Tag angle brackets
  attribute: string        // HTML/XML attributes
  attributeValue: string   // Attribute values
  
  // Special
  constant: string         // Constants, enums values
  macro: string            // Preprocessor macros
  label: string            // Labels, goto targets
  namespace: string        // Namespaces, modules
  
  // States
  error: string            // Syntax errors
  warning: string          // Warnings
  deprecated: string       // Deprecated elements
}

export interface Theme {
  // Metadata
  id: string
  name: string
  description?: string
  category: 'light' | 'dark' | 'high-contrast'
  author?: string
  version?: string

  // Color schemes
  colors: ThemeColors
  terminal: TerminalColors  
  syntax: SyntaxColors

  // Theme-specific settings
  settings?: {
    fontFamily?: string
    fontSize?: number
    lineHeight?: number
    borderRadius?: number
    shadows?: boolean
    animations?: boolean
  }
}

export interface ThemePreference {
  themeId: string
  autoSwitch: boolean          // Follow system preference
  systemOverride?: string      // Override system preference
  customizations?: Partial<ThemeColors> // User customizations
}