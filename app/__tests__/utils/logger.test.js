const winston = require('winston');

// Mock winston to avoid file system operations in tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    end: jest.fn((callback) => callback()),
    add: jest.fn() // Add the missing add method
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    printf: jest.fn(() => ({}))
  },
  transports: {
    Console: jest.fn()
  }
}));

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    filename: 'test.log'
  }));
});

describe('Logger Utility', () => {
  let logger;
  let mockWinston;

  beforeEach(() => {
    // Reset modules to get fresh logger instance
    jest.resetModules();
    
    // Create mock winston logger
    mockWinston = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      end: jest.fn((callback) => callback())
    };
    
    winston.createLogger.mockReturnValue(mockWinston);
    
    logger = require('../../src/utils/logger');
    logger.winston = mockWinston;
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      
      expect(mockWinston.info).toHaveBeenCalledWith('Test info message', {});
    });

    it('should log info messages with meta', () => {
      const meta = { userId: 123 };
      logger.info('Test info message', meta);
      
      expect(mockWinston.info).toHaveBeenCalledWith('Test info message', meta);
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Test warning message');
      
      expect(mockWinston.warn).toHaveBeenCalledWith('Test warning message', {});
    });

    it('should log warning messages with meta', () => {
      const meta = { action: 'test' };
      logger.warn('Test warning message', meta);
      
      expect(mockWinston.warn).toHaveBeenCalledWith('Test warning message', meta);
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Test error message');
      
      expect(mockWinston.error).toHaveBeenCalledWith('Test error message', {});
    });

    it('should log error objects with stack trace', () => {
      const error = new Error('Test error');
      logger.error('Test error with object', error);
      
      expect(mockWinston.error).toHaveBeenCalledWith('Test error with object', {
        error: {
          message: 'Test error',
          stack: error.stack,
          name: 'Error'
        }
      });
    });

    it('should log error messages with meta', () => {
      const meta = { component: 'test' };
      logger.error('Test error message', null, meta);
      
      expect(mockWinston.error).toHaveBeenCalledWith('Test error message', meta);
    });
  });

  describe('debug', () => {
    it('should log debug messages when in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Reset modules to get fresh logger instance
      jest.resetModules();
      const debugLogger = require('../../src/utils/logger');
      debugLogger.winston = mockWinston;
      
      debugLogger.debug('Test debug message');
      
      expect(mockWinston.debug).toHaveBeenCalledWith('Test debug message', {});
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not log debug messages in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Reset modules to get fresh logger instance
      jest.resetModules();
      const prodLogger = require('../../src/utils/logger');
      prodLogger.winston = mockWinston;
      
      prodLogger.debug('Test debug message');
      
      expect(mockWinston.debug).not.toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('structured logging methods', () => {
    it('should log user actions', () => {
      logger.userAction('testuser', 'login', { ip: '127.0.0.1' });
      
      expect(mockWinston.info).toHaveBeenCalledWith('User action: login', {
        eventType: 'user_action',
        username: 'testuser',
        action: 'login',
        ip: '127.0.0.1'
      });
    });

    it('should log session events', () => {
      logger.sessionEvent('session123', 'created');
      
      expect(mockWinston.info).toHaveBeenCalledWith('Session event: created', {
        eventType: 'session_event',
        sessionId: 'session123',
        event: 'created'
      });
    });

    it('should log security events', () => {
      logger.securityEvent('failed_login', { ip: '127.0.0.1' });
      
      expect(mockWinston.warn).toHaveBeenCalledWith('Security event: failed_login', {
        eventType: 'security_event',
        event: 'failed_login',
        ip: '127.0.0.1'
      });
    });
  });

  describe('shutdown', () => {
    it('should gracefully shutdown the logger', async () => {
      await logger.shutdown();
      
      expect(mockWinston.end).toHaveBeenCalled();
    });
  });
});