// Basic logging utility
// Future: Can be enhanced with Winston or other logging libraries

const environment = require('../config/environment');

class Logger {
  constructor() {
    this.isDevelopment = environment.NODE_ENV !== 'production';
  }

  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(formattedMessage, ...args);
    } else if (level === 'warn') {
      console.warn(formattedMessage, ...args);
    } else {
      console.log(formattedMessage, ...args);
    }
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  debug(message, ...args) {
    if (this.isDevelopment) {
      this.log('debug', message, ...args);
    }
  }

  // Structured logging for specific events
  userAction(username, action, details = {}) {
    this.info(`User ${username} performed ${action}`, details);
  }

  sessionEvent(sessionId, event, details = {}) {
    this.info(`Session ${sessionId} ${event}`, details);
  }

  claudeProcess(sessionId, event, details = {}) {
    this.info(`Claude process for session ${sessionId}: ${event}`, details);
  }

  securityEvent(event, details = {}) {
    this.warn(`Security event: ${event}`, details);
  }
}

// Export singleton instance
module.exports = new Logger();