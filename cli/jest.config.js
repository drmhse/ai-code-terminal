module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js', // Simple export file
    '!bin/**/*.js', // CLI binary has integration complexity
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 60,
      lines: 50,
      statements: 50
    }
  },
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  testTimeout: 30000, // 30 seconds for integration tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  verbose: true,
  maxWorkers: 1 // Force single worker to avoid Node path issues
};