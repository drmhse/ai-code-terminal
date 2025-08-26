module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**/*.js',  // Config files don't need testing
    '!src/app.js',          // Main app file is integration
    '!src/**/index.js',     // Index files
    '!src/socket/**/*.js'   // Socket handlers are integration
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleDirectories: ['node_modules', 'src'],
  // Ignore coverage for node_modules and test files
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/test/'
  ],
  // Use manual mocks for ES modules
  automock: false,
  resetModules: false
};