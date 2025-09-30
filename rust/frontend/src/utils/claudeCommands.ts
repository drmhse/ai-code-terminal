/**
 * Claude CLI Command Bridge Utilities
 *
 * This module provides utilities for intelligent command detection,
 * formatting, and execution targeting Claude CLI integration.
 */

export interface CommandDetectionResult {
  type: 'question' | 'dangerous' | 'claude' | 'command'
  confidence: number
  message: string
  suggestedAction: 'askClaude' | 'sendCommand' | 'startClaude'
}

export interface CommandFormatOptions {
  skipPermissions?: boolean
  useJson?: boolean
  continueSession?: boolean
}

/**
 * Smart command detection - determines the intent behind user input
 */
export class CommandDetector {
  // Question indicators - suggests user wants to ask Claude
  private static readonly QUESTION_PATTERNS = [
    // Question words
    /^(what|how|why|when|where|who|which|can|could|should|would|will|is|are|does|do|did)\b/i,
    // Question phrases
    /(can you|could you|help me|explain|analyze|tell me|show me|find|search|look for)/i,
    // Interrogative patterns
    /\?$/,
    // Help requests
    /^(help|assist|guide)/i,
  ]

  // Dangerous operation indicators - suggests requiring permissions
  private static readonly DANGEROUS_PATTERNS = [
    // File operations
    /(fix|update|modify|change|edit|write|create|delete|remove|refactor)/i,
    // Installation/management
    /(install|upgrade|downgrade|add|remove|uninstall)/i,
    // Code changes
    /(implement|generate|build|compile|optimize|improve)/i,
    // System operations
    /(configure|setup|initialize|reset|clean)/i,
  ]

  // Claude CLI command indicators
  private static readonly CLAUDE_PATTERNS = [
    /^claude\b/i,
    /^(start|launch|open)\s+(claude|ai|assistant)/i,
  ]

  // Regular command indicators
  private static readonly COMMAND_PATTERNS = [
    // Git commands
    /^git\b/i,
    // NPM/Node commands
    /^(npm|yarn|node|npx)\b/i,
    // System commands
    /^(ls|cd|pwd|mkdir|rmdir|cp|mv|chmod|chown)\b/i,
    // Development commands
    /^(cargo|rustc|python|pip|java|javac|gcc|make)\b/i,
  ]

  static detect(input: string): CommandDetectionResult {
    const cleanInput = input.trim()

    if (!cleanInput) {
      return {
        type: 'command',
        confidence: 0,
        message: 'No input detected',
        suggestedAction: 'sendCommand'
      }
    }

    // Check for Claude CLI commands first
    if (this.matchesPatterns(cleanInput, this.CLAUDE_PATTERNS)) {
      return {
        type: 'claude',
        confidence: 0.95,
        message: 'Detected: Claude CLI command',
        suggestedAction: 'startClaude'
      }
    }

    // Check for questions
    if (this.matchesPatterns(cleanInput, this.QUESTION_PATTERNS)) {
      const isDangerous = this.matchesPatterns(cleanInput, this.DANGEROUS_PATTERNS)
      return {
        type: 'question',
        confidence: 0.85,
        message: isDangerous
          ? 'Detected: Question requiring permissions'
          : 'Detected: Question for Claude',
        suggestedAction: 'askClaude'
      }
    }

    // Check for dangerous operations
    if (this.matchesPatterns(cleanInput, this.DANGEROUS_PATTERNS)) {
      return {
        type: 'dangerous',
        confidence: 0.8,
        message: 'Detected: Operation requiring permissions',
        suggestedAction: 'askClaude'
      }
    }

    // Check for regular commands
    if (this.matchesPatterns(cleanInput, this.COMMAND_PATTERNS)) {
      return {
        type: 'command',
        confidence: 0.9,
        message: 'Detected: Terminal command',
        suggestedAction: 'sendCommand'
      }
    }

    // Default to question if it contains natural language patterns
    if (this.containsNaturalLanguage(cleanInput)) {
      return {
        type: 'question',
        confidence: 0.6,
        message: 'Detected: Likely question for Claude',
        suggestedAction: 'askClaude'
      }
    }

    // Default to command
    return {
      type: 'command',
      confidence: 0.5,
      message: 'Detected: Terminal command',
      suggestedAction: 'sendCommand'
    }
  }

  private static matchesPatterns(input: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(input))
  }

  private static containsNaturalLanguage(input: string): boolean {
    // Check for common natural language indicators
    const naturalLanguageIndicators = [
      /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/i,
      /\b(this|that|these|those|my|your|our|their)\b/i,
      /\b(please|thanks|thank you)\b/i,
      /[.!?]/, // Sentence punctuation
    ]

    return this.matchesPatterns(input, naturalLanguageIndicators)
  }
}

/**
 * Claude CLI command formatter
 */
export class ClaudeCommandFormatter {
  /**
   * Format input as a Claude question command
   */
  static formatAsQuestion(input: string, options: CommandFormatOptions = {}): string {
    const { skipPermissions = false, useJson = false } = options

    const baseCmd = 'claude'
    const flags = []

    if (skipPermissions) {
      flags.push('--permission-mode acceptEdits')
    }

    if (useJson) {
      flags.push('--output-format json')
    }

    flags.push('-p')

    const flagStr = flags.length > 0 ? ` ${flags.join(' ')}` : ''
    return `${baseCmd}${flagStr} "${this.escapeQuotes(input)}"`
  }

  /**
   * Format input as a Claude continuation command
   */
  static formatAsContinuation(input: string): string {
    return `claude --continue "${this.escapeQuotes(input)}"`
  }

  /**
   * Format as a simple Claude CLI start command
   */
  static formatAsSessionStart(dangerous: boolean = false): string {
    return dangerous
      ? 'claude --permission-mode acceptEdits'
      : 'claude'
  }

  /**
   * Auto-format based on detected command type
   */
  static autoFormat(input: string): string {
    const detection = CommandDetector.detect(input)

    switch (detection.type) {
      case 'claude':
        return input // Already a Claude command

      case 'question':
        const isDangerous = detection.message.includes('permissions')
        return this.formatAsQuestion(input, { skipPermissions: isDangerous })

      case 'dangerous':
        return this.formatAsQuestion(input, { skipPermissions: true })

      case 'command':
      default:
        return input // Regular command, no formatting needed
    }
  }

  /**
   * Escape quotes in command strings
   */
  private static escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"')
  }
}

/**
 * Context builder for providing Claude with workspace information
 */
export class ContextBuilder {
  /**
   * Build a comprehensive context string for Claude
   */
  static buildWorkspaceContext(options: {
    currentDirectory?: string
    recentOutput?: string
    gitBranch?: string
    openFiles?: string[]
    recentCommands?: string[]
    errorState?: boolean
  }): string {
    const context = []

    if (options.currentDirectory) {
      context.push(`# Current Directory: ${options.currentDirectory}`)
    }

    if (options.gitBranch) {
      context.push(`# Git Branch: ${options.gitBranch}`)
    }

    if (options.openFiles && options.openFiles.length > 0) {
      context.push(`# Open Files: ${options.openFiles.join(', ')}`)
    }

    if (options.recentCommands && options.recentCommands.length > 0) {
      context.push(`# Recent Commands: ${options.recentCommands.slice(0, 5).join(', ')}`)
    }

    if (options.recentOutput) {
      context.push(`# Recent Terminal Output:`)
      context.push(this.cleanTerminalOutput(options.recentOutput))
    }

    if (options.errorState) {
      context.push(`# Status: Error detected in recent output`)
    }

    return context.join('\n')
  }

  /**
   * Clean terminal output for context
   */
  private static cleanTerminalOutput(output: string): string {
    return output
      .split('\n')
      .slice(-20) // Last 20 lines
      .filter(line => line.trim().length > 0) // Remove empty lines
      .filter(line => !line.includes('\x1b')) // Remove ANSI escape sequences
      .join('\n')
  }
}

/**
 * Command history management utilities
 */
export class CommandHistory {
  private static readonly STORAGE_KEY = 'quickCommandHistory'
  private static readonly MAX_HISTORY = 50

  /**
   * Load command history from localStorage
   */
  static load(): string[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.warn('Failed to load command history:', error)
      return []
    }
  }

  /**
   * Save command history to localStorage
   */
  static save(history: string[]): void {
    try {
      const trimmedHistory = history.slice(0, this.MAX_HISTORY)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedHistory))
    } catch (error) {
      console.warn('Failed to save command history:', error)
    }
  }

  /**
   * Add a command to history
   */
  static addCommand(command: string): string[] {
    const history = this.load()
    const trimmedCommand = command.trim()

    if (!trimmedCommand) return history

    // Remove duplicate if exists
    const existingIndex = history.indexOf(trimmedCommand)
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1)
    }

    // Add to beginning
    history.unshift(trimmedCommand)

    // Trim to max size
    const trimmedHistory = history.slice(0, this.MAX_HISTORY)

    this.save(trimmedHistory)
    return trimmedHistory
  }

  /**
   * Clear all command history
   */
  static clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear command history:', error)
    }
  }

  /**
   * Search command history
   */
  static search(query: string): string[] {
    const history = this.load()
    const lowercaseQuery = query.toLowerCase()

    return history.filter(command =>
      command.toLowerCase().includes(lowercaseQuery)
    )
  }
}

/**
 * Validation utilities
 */
export class CommandValidator {
  /**
   * Validate if a command is safe to execute
   */
  static isSafeCommand(command: string): boolean {
    const dangerousCommands = [
      /rm\s+-rf\s+\//,  // Dangerous rm commands
      /dd\s+if=/,       // Disk operations
      /mkfs\./,         // Format commands
      /sudo\s+/,        // Sudo operations
      /chmod\s+777/,    // Dangerous permissions
    ]

    return !dangerousCommands.some(pattern => pattern.test(command))
  }

  /**
   * Validate Claude CLI command syntax
   */
  static isValidClaudeCommand(command: string): boolean {
    // Basic Claude CLI command validation
    const validPatterns = [
      /^claude(\s|$)/,
      /^claude\s+--[a-zA-Z-]+/,
      /^claude\s+-[a-zA-Z]/,
    ]

    return validPatterns.some(pattern => pattern.test(command))
  }

  /**
   * Extract potential security issues from command
   */
  static getSecurityWarnings(command: string): string[] {
    const warnings = []

    if (command.includes('--permission-mode acceptEdits')) {
      warnings.push('Command will allow Claude to make changes without confirmation')
    }

    if (command.includes('rm ') && command.includes('-r')) {
      warnings.push('Command includes recursive deletion')
    }

    if (command.includes('sudo')) {
      warnings.push('Command requires elevated privileges')
    }

    return warnings
  }
}

/**
 * Main Claude CLI bridge - high-level interface
 */
export class ClaudeCLIBridge {
  /**
   * Process user input and return formatted command with metadata
   */
  static processUserInput(input: string, context?: Record<string, unknown>): {
    command: string
    detection: CommandDetectionResult
    warnings: string[]
    contextualCommand?: string
  } {
    const detection = CommandDetector.detect(input)
    const command = ClaudeCommandFormatter.autoFormat(input)
    const warnings = CommandValidator.getSecurityWarnings(command)

    // Build contextual command if context is provided
    let contextualCommand: string | undefined
    if (context && (detection.type === 'question' || detection.type === 'dangerous')) {
      const contextStr = ContextBuilder.buildWorkspaceContext(context)
      const fullPrompt = `${contextStr}\n\nQuestion: ${input}`
      contextualCommand = ClaudeCommandFormatter.formatAsQuestion(fullPrompt, {
        skipPermissions: detection.type === 'dangerous'
      })
    }

    return {
      command,
      detection,
      warnings,
      contextualCommand
    }
  }

  /**
   * Quick access methods for common operations
   */
  static askQuestion(question: string, dangerous: boolean = false): string {
    return ClaudeCommandFormatter.formatAsQuestion(question, {
      skipPermissions: dangerous
    })
  }

  static startSession(dangerous: boolean = false): string {
    return ClaudeCommandFormatter.formatAsSessionStart(dangerous)
  }

  static continueConversation(message: string): string {
    return ClaudeCommandFormatter.formatAsContinuation(message)
  }
}

// Default export
export default ClaudeCLIBridge