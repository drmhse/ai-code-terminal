import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logger Utility', () => {
  let logger;
  let originalConsole;

  beforeEach(async () => {
    // Store original console methods
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };

    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();
    console.debug = vi.fn();

    // Set test environment
    process.env.NODE_ENV = 'test';

    // Import logger after mocking console
    const module = await import('@/utils/logger.js');
    logger = module.default;
  });

  afterEach(() => {
    // Restore original console methods
    Object.assign(console, originalConsole);
  });

  describe('info logging', () => {
    it('should log info messages with timestamp', () => {
      const message = 'Test info message';
      const metadata = { userId: '123', action: 'test' };

      logger.info(message, metadata);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test info message/),
        metadata
      );
    });

    it('should log info messages without metadata', () => {
      const message = 'Simple info message';

      logger.info(message);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Simple info message/)
      );
    });
  });

  describe('error logging', () => {
    it('should log error messages with stack trace', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      logger.error(message, error);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Test error message/),
        expect.objectContaining({
          message: 'Test error',
          stack: expect.any(String),
        })
      );
    });

    it('should log error messages with metadata', () => {
      const message = 'Database error';
      const metadata = { query: 'SELECT * FROM users', duration: 150 };

      logger.error(message, metadata);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Database error/),
        metadata
      );
    });
  });

  describe('warn logging', () => {
    it('should log warning messages', () => {
      const message = 'Test warning message';
      const metadata = { deprecated: true, replacement: 'newMethod' };

      logger.warn(message, metadata);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARN: Test warning message/),
        metadata
      );
    });
  });

  describe('debug logging', () => {
    it('should log debug messages in development', () => {
      process.env.NODE_ENV = 'development';
      
      // Re-import logger to pick up environment change
      vi.resetModules();
      
      const message = 'Debug information';
      const metadata = { variable: 'value' };

      logger.debug(message, metadata);

      expect(console.debug).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] DEBUG: Debug information/),
        metadata
      );
    });

    it('should not log debug messages in production', () => {
      process.env.NODE_ENV = 'production';
      
      // Re-import logger to pick up environment change
      vi.resetModules();
      
      const message = 'Debug information';

      logger.debug(message);

      expect(console.debug).not.toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should format timestamps consistently', () => {
      logger.info('Message 1');
      logger.warn('Message 2');
      logger.error('Message 3');

      const calls = [
        ...console.info.mock.calls,
        ...console.warn.mock.calls,
        ...console.error.mock.calls,
      ];

      calls.forEach(call => {
        const logMessage = call[0];
        expect(logMessage).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      });
    });

    it('should include correct log level in messages', () => {
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Info message')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Warn message')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Error message')
      );
    });
  });

  describe('metadata handling', () => {
    it('should handle complex metadata objects', () => {
      const complexMetadata = {
        user: { id: 123, name: 'John Doe' },
        request: { method: 'POST', url: '/api/users' },
        response: { status: 201, data: { created: true } },
      };

      logger.info('Complex operation completed', complexMetadata);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Complex operation completed'),
        complexMetadata
      );
    });

    it('should handle null and undefined metadata', () => {
      logger.info('Message with null', null);
      logger.info('Message with undefined', undefined);

      expect(console.info).toHaveBeenCalledTimes(2);
    });
  });
});