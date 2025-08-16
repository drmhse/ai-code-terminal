# Testing Guide

This project uses [Vitest](https://vitest.dev/) as the modern testing framework with comprehensive test coverage for all critical components.

## Overview

The test suite is organized into several categories:
- **Unit Tests**: Test individual functions, classes, and modules in isolation
- **Integration Tests**: Test API endpoints and service interactions
- **Mocks**: Reusable mocks for external dependencies
- **Fixtures**: Test data and sample objects

## Directory Structure

```
tests/
├── README.md                     # This file
├── setup.js                      # Global test setup and configuration
├── unit/                         # Unit tests
│   ├── middleware/               # Middleware tests
│   │   └── auth.middleware.test.js
│   └── services/                 # Service layer tests
│       ├── shell.service.test.js
│       ├── github.service.test.js
│       └── settings.service.test.js
├── integration/                  # Integration tests
│   └── github.controller.test.js # API endpoint tests
├── mocks/                        # Mock implementations
│   ├── prisma.js                 # Database mocks
│   ├── node-pty.js              # Terminal process mocks
│   └── socket.io.js              # WebSocket mocks
└── fixtures/                     # Test data
    └── github-user.js            # Sample GitHub user data
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI interface
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Advanced Usage

```bash
# Run specific test file
npx vitest tests/unit/services/shell.service.test.js

# Run tests matching a pattern
npx vitest --grep "authentication"

# Run tests in a specific directory
npx vitest tests/unit/middleware/

# Generate coverage report in different formats
npx vitest --coverage --reporter=html
npx vitest --coverage --reporter=json
```

## Test Configuration

### Environment Variables

Tests automatically use the following environment variables:
- `NODE_ENV=test`
- `JWT_SECRET=test-jwt-secret-key-for-testing-purposes-only`
- `TENANT_GITHUB_USERNAME=test-user`
- `DATABASE_URL=file:./tests/test.db`

### Global Setup

The `tests/setup.js` file provides:
- Mock environment variables
- Global mock functions for console methods
- Test database initialization
- Cleanup helpers

## Writing Tests

### Unit Test Example

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyService', () => {
  let myService;

  beforeEach(() => {
    vi.clearAllMocks();
    myService = new MyService();
  });

  it('should perform operation correctly', () => {
    const result = myService.performOperation('input');
    expect(result).toBe('expected output');
  });

  it('should handle errors gracefully', () => {
    expect(() => myService.performOperation(null)).toThrow('Invalid input');
  });
});
```

### Integration Test Example

```javascript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('API Endpoints', () => {
  it('should return health status', async () => {
    await request(app)
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('healthy');
      });
  });
});
```

### Mock Usage

```javascript
import { mockPrismaClient } from '../tests/mocks/prisma.js';
import { createMockSocket } from '../tests/mocks/socket.io.js';

// Use mocked database
mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

// Use mocked socket
const socket = createMockSocket();
socket.emit('test-event', data);
```

## Test Coverage

The test suite aims for high coverage across:
- **Services**: Business logic and data operations
- **Controllers**: API endpoints and request handling
- **Middleware**: Authentication and request processing
- **Utilities**: Helper functions and shared code

### Coverage Reports

Coverage reports are generated in multiple formats:
- **Terminal**: Summary displayed after running tests
- **HTML**: Detailed interactive report in `coverage/index.html`
- **JSON**: Machine-readable report in `coverage/coverage.json`

### Coverage Thresholds

The project maintains these coverage thresholds:
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

## Mocking Strategy

### External Dependencies

- **Database (Prisma)**: Mocked to avoid real database operations
- **Node-pty**: Mocked to simulate terminal processes
- **Socket.IO**: Mocked for WebSocket communication testing
- **GitHub API**: Mocked to avoid external API calls during tests

### File System Operations

File system operations are mocked where appropriate to:
- Avoid creating real files during tests
- Ensure tests are fast and isolated
- Prevent side effects between tests

## Best Practices

### Test Organization

1. **Group related tests**: Use `describe` blocks to group related functionality
2. **Clear test names**: Use descriptive test names that explain the expected behavior
3. **One assertion per test**: Keep tests focused on a single behavior
4. **Setup and teardown**: Use `beforeEach`/`afterEach` for test isolation

### Mocking Guidelines

1. **Mock external dependencies**: Don't let tests depend on external services
2. **Mock at the module boundary**: Mock at the interface level, not implementation details
3. **Verify mock interactions**: Assert that mocks are called with expected parameters
4. **Reset mocks between tests**: Use `vi.clearAllMocks()` in `beforeEach`

### Error Testing

1. **Test error conditions**: Verify that functions handle errors appropriately
2. **Test edge cases**: Include tests for boundary conditions and invalid inputs
3. **Verify error messages**: Assert that error messages are helpful and accurate

## Continuous Integration

Tests are configured to run in CI/CD pipelines with:
- Automatic test execution on pull requests
- Coverage reporting and enforcement
- Performance regression detection
- Cross-platform compatibility testing

## Debugging Tests

### Running Individual Tests

```bash
# Run a specific test file
npx vitest tests/unit/services/shell.service.test.js

# Run tests matching a pattern
npx vitest --grep "should create PTY session"
```

### Debug Mode

```bash
# Run tests with debug output
npx vitest --reporter=verbose

# Run tests with detailed stack traces
npx vitest --reporter=verbose --stack-trace
```

### Using the UI

The Vitest UI provides a graphical interface for:
- Running and filtering tests
- Viewing test results and coverage
- Debugging failed tests
- Exploring test file structure

Access it with: `npm run test:ui`

## Contributing

When adding new features:

1. **Write tests first**: Follow TDD principles where possible
2. **Maintain coverage**: Ensure new code is adequately tested
3. **Update mocks**: Add new mocks for any new external dependencies
4. **Document test cases**: Include comments for complex test scenarios

When fixing bugs:

1. **Add regression tests**: Create tests that would have caught the bug
2. **Verify the fix**: Ensure the new test fails before the fix and passes after
3. **Test edge cases**: Consider what other scenarios might cause similar issues