/**
 * Logging utility that only logs when VITE_SHOW_LOGS environment variable is set
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

interface Logger {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

class ConditionalLogger implements Logger {
  private isEnabled: boolean

  constructor() {
    // Check if logging is enabled via environment variable
    this.isEnabled = import.meta.env.VITE_SHOW_LOGS === 'true'
  }

  private shouldLog(): boolean {
    return this.isEnabled
  }

  log(...args: unknown[]): void {
    if (this.shouldLog()) {
      console.log(...args)
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog()) {
      console.warn(...args)
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog()) {
      console.error(...args)
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog()) {
      console.info(...args)
    }
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog()) {
      console.debug(...args)
    }
  }
}

// Export a singleton instance
export const logger = new ConditionalLogger()

// Export the type for use in other files
export type { Logger }