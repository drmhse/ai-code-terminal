// Command tracker utility
// Helps identify and track long-running commands in shell sessions

const processSupervisorService = require('../services/process-supervisor.service');
const logger = require('./logger');

class CommandTracker {
  constructor() {
    // Commands that typically run servers or long processes
    this.longRunningCommands = new Set([
      'npm run dev',
      'npm start', 
      'yarn dev',
      'yarn start',
      'pnpm dev',
      'pnpm start',
      'next dev',
      'vite',
      'webpack serve',
      'webpack-dev-server',
      'nodemon',
      'ts-node-dev',
      'tsx watch',
      'python manage.py runserver',
      'rails server',
      'php -S',
      'serve',
      'http-server',
      'live-server',
      'docker-compose up',
      'docker run'
    ]);

    // Commands that commonly have --watch or similar flags
    this.watchableCommands = new Set([
      'jest',
      'mocha', 
      'vitest',
      'pytest',
      'cargo test',
      'go test',
      'npm test',
      'yarn test',
      'tsc'
    ]);
  }

  /**
   * Parse a command to determine if it should be tracked
   */
  shouldTrackCommand(commandLine) {
    if (!commandLine || typeof commandLine !== 'string') {
      return false;
    }

    const trimmed = commandLine.trim();
    
    // Skip very short commands
    if (trimmed.length < 3) {
      return false;
    }

    // Check for exact matches with long-running commands
    for (const longCommand of this.longRunningCommands) {
      if (trimmed.startsWith(longCommand)) {
        return true;
      }
    }

    // Check for watchable commands with watch flags
    for (const watchableCommand of this.watchableCommands) {
      if (trimmed.startsWith(watchableCommand) && 
          (trimmed.includes('--watch') || trimmed.includes('-w'))) {
        return true;
      }
    }

    // Check for other common long-running patterns
    if (this.hasLongRunningPatterns(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Check for patterns that indicate long-running processes
   */
  hasLongRunningPatterns(command) {
    const longRunningPatterns = [
      /--watch\b/,
      /--hot\b/,
      /--reload\b/,
      /--dev\b/,
      /--serve\b/,
      /serve.*--/,
      /python.*-m.*http\.server/,
      /python.*-m.*uvicorn/,
      /python.*-m.*gunicorn/,
      /-p\s+\d+.*--/,    // Port specification often indicates servers
      /--port\s+\d+/,
      /tail\s+-f/,        // Following logs
      /watch\s+/,         // Generic watch command
    ];

    return longRunningPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Parse command into command and arguments
   */
  parseCommand(commandLine) {
    const parts = commandLine.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    
    return { command, args };
  }

  /**
   * Get suggested tracking options for a command
   */
  getTrackingOptions(commandLine, sessionId = null, workspaceId = null) {
    const { command, args } = this.parseCommand(commandLine);
    
    const options = {
      sessionId,
      workspaceId,
      autoRestart: false,
      cwd: process.cwd()
    };

    // Enable auto-restart for development servers
    if (this.isDevelopmentServer(commandLine)) {
      options.autoRestart = true;
    }

    return {
      command,
      args,
      options
    };
  }

  /**
   * Check if command is a development server that should auto-restart
   */
  isDevelopmentServer(commandLine) {
    const devServerPatterns = [
      /npm run dev/,
      /yarn dev/,
      /pnpm dev/,
      /next dev/,
      /vite/,
      /nodemon/,
      /ts-node-dev/,
      /tsx watch/
    ];

    return devServerPatterns.some(pattern => pattern.test(commandLine));
  }

  /**
   * Auto-track a command if it should be tracked
   */
  async autoTrackCommand(commandLine, sessionId = null, workspaceId = null) {
    try {
      if (!this.shouldTrackCommand(commandLine)) {
        return null;
      }

      logger.info(`Auto-tracking command: ${commandLine}`);
      
      const { command, args, options } = this.getTrackingOptions(commandLine, sessionId, workspaceId);
      
      const result = await processSupervisorService.trackProcess(command, args, options);
      
      logger.info(`Command auto-tracked successfully: ${commandLine} (PID: ${result.pid})`);
      return result;

    } catch (error) {
      logger.error('Error auto-tracking command:', error);
      return null;
    }
  }

  /**
   * Get examples of trackable commands for user reference
   */
  getTrackableCommandExamples() {
    return {
      'Development Servers': [
        'npm run dev',
        'yarn start',
        'next dev',
        'vite --host 0.0.0.0',
        'nodemon server.js'
      ],
      'Test Watchers': [
        'npm test -- --watch',
        'jest --watch',
        'vitest --watch'
      ],
      'Build Watchers': [
        'tsc --watch',
        'webpack --watch'
      ],
      'Other Long-Running': [
        'docker-compose up',
        'tail -f server.log',
        'python manage.py runserver'
      ]
    };
  }
}

// Export singleton instance
const commandTracker = new CommandTracker();

module.exports = commandTracker;