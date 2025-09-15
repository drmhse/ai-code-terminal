/**
 * Theme converter utility for converting theme system TerminalColors
 * to xterm.js TerminalTheme format
 */

import type { TerminalColors } from '@/types/theme'
import type { TerminalTheme } from '@/types/terminal'

/**
 * Converts theme system TerminalColors to xterm.js TerminalTheme format
 *
 * @param terminalColors - Terminal colors from the theme system
 * @returns TerminalTheme object for xterm.js
 */
export function convertTerminalColors(terminalColors: TerminalColors): TerminalTheme {
  return {
    // Core colors - direct mapping
    background: terminalColors.background,
    foreground: terminalColors.foreground,
    cursor: terminalColors.cursor,
    selection: terminalColors.selection,

    // cursorAccent is required by xterm.js but not in our theme system
    // Use background color as accent for good contrast
    cursorAccent: terminalColors.background,

    // Standard ANSI colors - direct mapping
    black: terminalColors.black,
    red: terminalColors.red,
    green: terminalColors.green,
    yellow: terminalColors.yellow,
    blue: terminalColors.blue,
    magenta: terminalColors.magenta,
    cyan: terminalColors.cyan,
    white: terminalColors.white,

    // Bright ANSI colors - direct mapping
    brightBlack: terminalColors.brightBlack,
    brightRed: terminalColors.brightRed,
    brightGreen: terminalColors.brightGreen,
    brightYellow: terminalColors.brightYellow,
    brightBlue: terminalColors.brightBlue,
    brightMagenta: terminalColors.brightMagenta,
    brightCyan: terminalColors.brightCyan,
    brightWhite: terminalColors.brightWhite
  }
}

/**
 * Gets the current theme's terminal colors converted to xterm.js format
 * This function should be used by terminal components to get properly formatted colors
 *
 * @param currentTheme - The current theme object
 * @returns TerminalTheme object for xterm.js
 */
export function getCurrentTerminalTheme(currentTheme: { terminal: TerminalColors }): TerminalTheme {
  return convertTerminalColors(currentTheme.terminal)
}