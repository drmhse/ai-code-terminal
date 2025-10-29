// Jest setup file for global test configuration
const fs = require('fs-extra');

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console output during tests unless explicitly testing console output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Mock console methods to reduce noise during tests
  // Tests can still explicitly test console output by checking these mocks
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Add custom matchers or global test utilities here if needed
global.testHelpers = {
  async createTempFile(filename, content) {
    await fs.writeFile(filename, content);
    return filename;
  },
  
  async createTempDir(dirname) {
    await fs.ensureDir(dirname);
    return dirname;
  },
  
  expectConsoleOutput(expectedOutput) {
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(expectedOutput));
  },
  
  expectConsoleError(expectedError) {
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(expectedError));
  }
};

// Global error handler for unhandled rejections during tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process during tests
});

// Clean up any global state between tests
afterEach(() => {
  // Clear any environment variable changes
  if (global.originalEnv) {
    Object.keys(process.env).forEach(key => {
      if (!(key in global.originalEnv)) {
        delete process.env[key];
      }
    });
    Object.keys(global.originalEnv).forEach(key => {
      process.env[key] = global.originalEnv[key];
    });
    delete global.originalEnv;
  }
});