// Production-ready logging utility with Winston
// Features: File persistence, log rotation, structured logging, multiple transports

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const environment = require('../config/environment');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Human-readable format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let output = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (Object.keys(meta).length > 0) {
      output += ` ${JSON.stringify(meta)}`;
    }
    return output;
  })
);

// Create Winston logger instance with environment-based configuration
const logger = winston.createLogger({
  level: environment.LOG_LEVEL,
  format: structuredFormat,
  defaultMeta: {
    service: 'ai-code-terminal',
    environment: environment.NODE_ENV,
    version: '2.0.0'
  },
  transports: [
    // Error log - only errors and fatals
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: Math.floor(parseInt(environment.LOG_MAX_SIZE || '20m') / 2) + 'm',
      maxFiles: environment.LOG_MAX_FILES,
      auditFile: path.join(logsDir, 'error-audit.json'),
      zippedArchive: environment.LOG_COMPRESS
    }),
    
    // Combined log - all levels
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: environment.LOG_MAX_SIZE,
      maxFiles: environment.LOG_MAX_FILES,
      auditFile: path.join(logsDir, 'combined-audit.json'),
      zippedArchive: environment.LOG_COMPRESS
    }),
    
    // Application log - info and above (excludes debug)
    new DailyRotateFile({
      filename: path.join(logsDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxSize: Math.floor(parseInt(environment.LOG_MAX_SIZE || '20m') * 0.75) + 'm',
      maxFiles: environment.LOG_MAX_FILES,
      auditFile: path.join(logsDir, 'app-audit.json'),
      zippedArchive: environment.LOG_COMPRESS
    }),
    
    // Performance log - for specific performance metrics
    new DailyRotateFile({
      filename: path.join(logsDir, 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxSize: Math.floor(parseInt(environment.LOG_MAX_SIZE || '20m') / 4) + 'm',
      maxFiles: Math.min(parseInt(environment.LOG_MAX_FILES || '30'), 14) + 'd',
      auditFile: path.join(logsDir, 'performance-audit.json'),
      zippedArchive: environment.LOG_COMPRESS
    })
  ]
});

// Add console transport for non-production environments
if (environment.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
} else {
  // In production, add console for errors only
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'error'
  }));
}

// Enhanced Logger class with Winston integration
class ProductionLogger {
  constructor() {
    this.winston = logger;
    this.isDevelopment = environment.NODE_ENV !== 'production';
  }

  // Core logging methods
  info(message, meta = {}) {
    this.winston.info(message, meta);
  }

  warn(message, meta = {}) {
    this.winston.warn(message, meta);
  }

  error(message, error = null, meta = {}) {
    const errorMeta = { ...meta };
    if (error instanceof Error) {
      errorMeta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    } else if (error) {
      errorMeta.error = error;
    }
    this.winston.error(message, errorMeta);
  }

  debug(message, meta = {}) {
    if (this.isDevelopment) {
      this.winston.debug(message, meta);
    }
  }

  // Structured logging for specific events
  userAction(username, action, details = {}) {
    this.info(`User action: ${action}`, {
      eventType: 'user_action',
      username,
      action,
      ...details
    });
  }

  sessionEvent(sessionId, event, details = {}) {
    this.info(`Session event: ${event}`, {
      eventType: 'session_event',
      sessionId,
      event,
      ...details
    });
  }

  claudeProcess(sessionId, event, details = {}) {
    this.info(`Claude process event: ${event}`, {
      eventType: 'claude_process',
      sessionId,
      event,
      ...details
    });
  }

  securityEvent(event, details = {}) {
    this.warn(`Security event: ${event}`, {
      eventType: 'security_event',
      event,
      ...details
    });
  }

  // Performance logging
  performance(metric, value, details = {}) {
    const perfTransport = this.winston.transports.find(t => 
      t.filename && t.filename.includes('performance')
    );
    
    if (perfTransport) {
      this.winston.info(`Performance metric: ${metric}`, {
        eventType: 'performance',
        metric,
        value,
        timestamp: Date.now(),
        ...details
      });
    }
  }

  // HTTP request logging
  httpRequest(req, res, duration) {
    const logData = {
      eventType: 'http_request',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      timestamp: Date.now()
    };

    if (res.statusCode >= 400) {
      this.warn(`HTTP ${res.statusCode}: ${req.method} ${req.url}`, logData);
    } else {
      this.info(`HTTP ${res.statusCode}: ${req.method} ${req.url}`, logData);
    }
  }

  // Database operation logging
  dbOperation(operation, table, duration, error = null) {
    const logData = {
      eventType: 'database_operation',
      operation,
      table,
      duration,
      timestamp: Date.now()
    };

    if (error) {
      this.error(`Database operation failed: ${operation} on ${table}`, error, logData);
    } else {
      this.info(`Database operation: ${operation} on ${table}`, logData);
    }
  }

  // System resource logging
  systemResource(resource, value, unit = '') {
    this.performance(`system_${resource}`, value, {
      resource,
      unit,
      timestamp: Date.now()
    });
  }

  // Graceful shutdown for log flushing
  async shutdown() {
    return new Promise((resolve) => {
      this.winston.end(() => {
        resolve();
      });
    });
  }

  // Get log file paths for debugging
  getLogFiles() {
    return {
      error: path.join(logsDir, 'error-*.log'),
      combined: path.join(logsDir, 'combined-*.log'),
      app: path.join(logsDir, 'app-*.log'),
      performance: path.join(logsDir, 'performance-*.log')
    };
  }
}

// Export singleton instance
module.exports = new ProductionLogger();