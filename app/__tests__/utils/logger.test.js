const originalConsole = { ...console };

describe('Logger Utility', () => {
  let logger;
  let consoleSpy;

  beforeEach(() => {
    // Mock console methods to capture actual logger output
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {})
    };
    
    // Reset modules to get fresh logger instance
    jest.resetModules();
    logger = require('../../src/utils/logger');
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Test info message')
      );
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Test warning message');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Test warning message')
      );
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Test error message');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Test error message')
      );
    });

    it('should log error objects with stack trace', () => {
      const error = new Error('Test error');
      logger.error('Test error with object', error);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Test error with object'),
        error
      );
    });
  });

  describe('debug', () => {
    it('should log debug messages when enabled', () => {
      // Set NODE_ENV to development to enable debug logging
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Reset modules to get fresh logger instance
      jest.resetModules();
      const debugLogger = require('../../src/utils/logger');
      
      debugLogger.debug('Test debug message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] Test debug message')
      );
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should not log debug messages when disabled', () => {
      // Set NODE_ENV to production to disable debug logging
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Reset modules to get fresh logger instance
      jest.resetModules();
      const prodLogger = require('../../src/utils/logger');
      
      prodLogger.debug('Test debug message');
      
      expect(consoleSpy.log).not.toHaveBeenCalled();
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});