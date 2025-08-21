---
title: "Testing"
description: "Comprehensive testing strategies for AI Code Terminal including unit, integration, and end-to-end tests"
weight: 20
layout: "docs"
---

# Testing

AI Code Terminal uses a comprehensive testing strategy with Jest as the primary testing framework. This guide covers unit tests, integration tests, and end-to-end testing approaches.

## Testing Framework Overview

### Technology Stack

- **Test Runner:** Jest 30.x
- **Assertion Library:** Jest built-in matchers
- **Mocking:** Jest mocks and manual mocks
- **Coverage:** Jest coverage with c8
- **Database Testing:** In-memory SQLite with Prisma
- **HTTP Testing:** Supertest
- **WebSocket Testing:** Socket.IO client testing utilities

### Test Configuration

**`jest.config.js`:**

```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/config/**',
    '!src/utils/logger.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000,
  maxWorkers: 1 // SQLite doesn't support concurrent connections
};
```

**`jest.setup.js`:**

```javascript
const { PrismaClient } = require('@prisma/client');

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
  process.env.TENANT_GITHUB_USERNAME = 'testuser';
});

afterAll(async () => {
  // Global cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
});
```

## Unit Testing

### Service Layer Testing

#### GitHub Service Tests

**`__tests__/services/github.service.test.js`:**

```javascript
const GitHubService = require('../../src/services/github.service');
const { Octokit } = require('@octokit/rest');

// Mock GitHub API
jest.mock('@octokit/rest');

describe('GitHubService', () => {
  let mockOctokit;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        users: {
          getAuthenticated: jest.fn()
        },
        repos: {
          listForAuthenticatedUser: jest.fn()
        }
      }
    };
    Octokit.mockImplementation(() => mockOctokit);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserInfo', () => {
    it('should return user information', async () => {
      // Arrange
      const mockUser = {
        id: 12345,
        login: 'testuser',
        email: 'test@example.com',
        avatar_url: 'https://github.com/avatar.jpg'
      };
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({ data: mockUser });

      // Act
      const result = await GitHubService.getUserInfo('test-token');

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      // Arrange
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(
        new Error('GitHub API Error')
      );

      // Act & Assert
      await expect(GitHubService.getUserInfo('invalid-token'))
        .rejects.toThrow('GitHub API Error');
    });
  });

  describe('getRepositories', () => {
    it('should return paginated repositories', async () => {
      // Arrange
      const mockRepos = [
        { id: 1, name: 'repo1', full_name: 'testuser/repo1' },
        { id: 2, name: 'repo2', full_name: 'testuser/repo2' }
      ];
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: mockRepos,
        headers: {}
      });

      // Act
      const result = await GitHubService.getRepositories('test-token');

      // Assert
      expect(result.repositories).toEqual(mockRepos);
      expect(result.repositories).toHaveLength(2);
    });

    it('should handle pagination', async () => {
      // Arrange
      const page1Repos = [{ id: 1, name: 'repo1' }];
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: page1Repos,
        headers: {
          link: '<https://api.github.com/repos?page=2>; rel="next"'
        }
      });

      // Act
      const result = await GitHubService.getRepositories('test-token', 1, 30);

      // Assert
      expect(result.has_next).toBe(true);
      expect(mockOctokit.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        page: 1,
        per_page: 30,
        sort: 'updated',
        direction: 'desc'
      });
    });
  });
});
```

#### Workspace Service Tests

**`__tests__/services/workspace.service.test.js`:**

```javascript
const WorkspaceService = require('../../src/services/workspace.service');
const prisma = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

// Mock file system operations
jest.mock('fs');
jest.mock('simple-git');

describe('WorkspaceService', () => {
  beforeEach(async () => {
    // Clear database
    await prisma.session.deleteMany();
    await prisma.workspace.deleteMany();
  });

  describe('createWorkspace', () => {
    it('should create a new workspace', async () => {
      // Arrange
      const workspaceData = {
        name: 'test-workspace',
        githubRepo: 'testuser/test-repo',
        githubUrl: 'https://github.com/testuser/test-repo',
        description: 'Test workspace'
      };

      fs.existsSync.mockReturnValue(false);
      fs.promises.mkdir = jest.fn().mockResolvedValue();
      fs.promises.chmod = jest.fn().mockResolvedValue();

      // Act
      const result = await WorkspaceService.createWorkspace(workspaceData);

      // Assert
      expect(result).toMatchObject({
        name: workspaceData.name,
        githubRepo: workspaceData.githubRepo,
        isActive: true
      });
      expect(result.id).toBeDefined();
      expect(result.localPath).toContain(workspaceData.name);
    });

    it('should prevent duplicate workspace names', async () => {
      // Arrange
      await prisma.workspace.create({
        data: {
          name: 'existing-workspace',
          githubRepo: 'testuser/existing',
          githubUrl: 'https://github.com/testuser/existing',
          localPath: '/tmp/existing'
        }
      });

      const duplicateData = {
        name: 'existing-workspace',
        githubRepo: 'testuser/different',
        githubUrl: 'https://github.com/testuser/different'
      };

      // Act & Assert
      await expect(WorkspaceService.createWorkspace(duplicateData))
        .rejects.toThrow('Workspace with name "existing-workspace" already exists');
    });

    it('should prevent duplicate GitHub repositories', async () => {
      // Arrange
      await prisma.workspace.create({
        data: {
          name: 'existing-workspace',
          githubRepo: 'testuser/existing',
          githubUrl: 'https://github.com/testuser/existing',
          localPath: '/tmp/existing'
        }
      });

      const duplicateData = {
        name: 'different-name',
        githubRepo: 'testuser/existing',
        githubUrl: 'https://github.com/testuser/existing'
      };

      // Act & Assert
      await expect(WorkspaceService.createWorkspace(duplicateData))
        .rejects.toThrow('Workspace for repository "testuser/existing" already exists');
    });
  });

  describe('getWorkspaces', () => {
    it('should return all active workspaces', async () => {
      // Arrange
      await prisma.workspace.createMany({
        data: [
          {
            name: 'workspace1',
            githubRepo: 'testuser/repo1',
            githubUrl: 'https://github.com/testuser/repo1',
            localPath: '/tmp/workspace1',
            isActive: true
          },
          {
            name: 'workspace2',
            githubRepo: 'testuser/repo2',
            githubUrl: 'https://github.com/testuser/repo2',
            localPath: '/tmp/workspace2',
            isActive: false
          }
        ]
      });

      // Act
      const result = await WorkspaceService.getWorkspaces();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('workspace1');
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace and cleanup filesystem', async () => {
      // Arrange
      const workspace = await prisma.workspace.create({
        data: {
          name: 'test-workspace',
          githubRepo: 'testuser/test',
          githubUrl: 'https://github.com/testuser/test',
          localPath: '/tmp/test-workspace'
        }
      });

      fs.existsSync.mockReturnValue(true);
      fs.promises.rm = jest.fn().mockResolvedValue();

      // Act
      await WorkspaceService.deleteWorkspace(workspace.id);

      // Assert
      const deletedWorkspace = await prisma.workspace.findUnique({
        where: { id: workspace.id }
      });
      expect(deletedWorkspace).toBeNull();
      expect(fs.promises.rm).toHaveBeenCalledWith(workspace.localPath, { recursive: true });
    });
  });
});
```

### Controller Testing

#### Authentication Controller Tests

**`__tests__/controllers/auth.controller.test.js`:**

```javascript
const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');

describe('Auth Controller', () => {
  describe('GET /api/auth/status', () => {
    it('should return authentication status for valid token', async () => {
      // Arrange
      const token = jwt.sign(
        { userId: 12345, username: 'testuser' },
        process.env.JWT_SECRET
      );

      // Act
      const response = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        authenticated: true,
        user: {
          userId: 12345,
          username: 'testuser'
        }
      });
    });

    it('should return 401 for missing token', async () => {
      // Act
      const response = await request(app)
        .get('/api/auth/status');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Access token required'
      });
    });

    it('should return 403 for invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/auth/status')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Invalid or expired token'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout user', async () => {
      // Arrange
      const token = jwt.sign(
        { userId: 12345, username: 'testuser' },
        process.env.JWT_SECRET
      );

      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ revokeGitHubToken: false });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Successfully logged out'
      });
    });
  });
});
```

## Integration Testing

### Database Integration Tests

**`__tests__/integration/database.test.js`:**

```javascript
const prisma = require('../../src/config/database');

describe('Database Integration', () => {
  beforeEach(async () => {
    // Clean database
    await prisma.session.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.settings.deleteMany();
  });

  describe('Settings Model', () => {
    it('should implement singleton pattern', async () => {
      // Act
      await prisma.settings.create({
        data: {
          id: 'singleton',
          theme: 'dark'
        }
      });

      // Try to create another settings record
      await expect(prisma.settings.create({
        data: {
          id: 'another',
          theme: 'light'
        }
      })).rejects.toThrow();

      // Assert
      const settings = await prisma.settings.findMany();
      expect(settings).toHaveLength(1);
      expect(settings[0].id).toBe('singleton');
    });
  });

  describe('Workspace and Session Relations', () => {
    it('should create workspace with sessions', async () => {
      // Arrange
      const workspace = await prisma.workspace.create({
        data: {
          name: 'test-workspace',
          githubRepo: 'testuser/test',
          githubUrl: 'https://github.com/testuser/test',
          localPath: '/tmp/test'
        }
      });

      // Act
      const session = await prisma.session.create({
        data: {
          workspaceId: workspace.id,
          shell: 'bash',
          socketId: 'test-socket-id'
        }
      });

      // Assert
      const workspaceWithSessions = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: { sessions: true }
      });

      expect(workspaceWithSessions.sessions).toHaveLength(1);
      expect(workspaceWithSessions.sessions[0].id).toBe(session.id);
    });

    it('should cascade delete sessions when workspace is deleted', async () => {
      // Arrange
      const workspace = await prisma.workspace.create({
        data: {
          name: 'test-workspace',
          githubRepo: 'testuser/test',
          githubUrl: 'https://github.com/testuser/test',
          localPath: '/tmp/test'
        }
      });

      await prisma.session.create({
        data: {
          workspaceId: workspace.id,
          shell: 'bash'
        }
      });

      // Act
      await prisma.workspace.delete({
        where: { id: workspace.id }
      });

      // Assert
      const remainingSessions = await prisma.session.findMany({
        where: { workspaceId: workspace.id }
      });
      expect(remainingSessions).toHaveLength(0);
    });
  });
});
```

### API Integration Tests

**`__tests__/integration/api.test.js`:**

```javascript
const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');

describe('API Integration', () => {
  let authToken;

  beforeAll(async () => {
    // Create auth token
    authToken = jwt.sign(
      { userId: 12345, username: 'testuser' },
      process.env.JWT_SECRET
    );
  });

  beforeEach(async () => {
    // Clean database
    await prisma.session.deleteMany();
    await prisma.workspace.deleteMany();
  });

  describe('Workspace API', () => {
    it('should create, list, and delete workspace', async () => {
      // Create workspace
      const createResponse = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'integration-test',
          githubRepo: 'testuser/integration-test',
          githubUrl: 'https://github.com/testuser/integration-test'
        });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.workspace.name).toBe('integration-test');

      const workspaceId = createResponse.body.workspace.id;

      // List workspaces
      const listResponse = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.workspaces).toHaveLength(1);
      expect(listResponse.body.workspaces[0].id).toBe(workspaceId);

      // Delete workspace
      const deleteResponse = await request(app)
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);

      // Verify deletion
      const finalListResponse = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalListResponse.body.workspaces).toHaveLength(0);
    });
  });
});
```

## WebSocket Testing

### Socket.IO Event Testing

**`__tests__/socket/terminal.test.js`:**

```javascript
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Terminal WebSocket', () => {
  let server, clientSocket, serverSocket;
  const port = 3015;

  beforeAll((done) => {
    server = app.listen(port, () => {
      done();
    });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach((done) => {
    const token = jwt.sign(
      { userId: 12345, username: 'testuser' },
      process.env.JWT_SECRET
    );

    clientSocket = io(`http://localhost:${port}`, {
      auth: { token }
    });

    server.on('connection', (socket) => {
      serverSocket = socket;
    });

    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Terminal Creation', () => {
    it('should create terminal session', (done) => {
      // Arrange
      const workspaceId = 'test-workspace-id';

      // Act
      clientSocket.emit('create-terminal', {
        workspaceId,
        cols: 80,
        rows: 24
      });

      // Assert
      clientSocket.on('terminal-created', (data) => {
        expect(data).toMatchObject({
          sessionId: expect.any(String),
          workspaceId,
          shell: 'bash'
        });
        done();
      });
    });

    it('should handle terminal input', (done) => {
      let sessionId;

      // Create terminal first
      clientSocket.emit('create-terminal', {
        workspaceId: 'test-workspace',
        cols: 80,
        rows: 24
      });

      clientSocket.on('terminal-created', (data) => {
        sessionId = data.sessionId;

        // Send terminal input
        clientSocket.emit('terminal-input', {
          sessionId,
          data: 'ls -la\r'
        });
      });

      // Expect terminal output
      clientSocket.on('terminal-output', (data) => {
        expect(data).toMatchObject({
          sessionId,
          output: expect.any(String)
        });
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid workspace', (done) => {
      // Act
      clientSocket.emit('create-terminal', {
        workspaceId: 'non-existent-workspace',
        cols: 80,
        rows: 24
      });

      // Assert
      clientSocket.on('terminal-error', (error) => {
        expect(error).toMatchObject({
          code: 'WORKSPACE_NOT_FOUND',
          message: expect.stringContaining('Workspace not found')
        });
        done();
      });
    });
  });
});
```

## Test Utilities and Helpers

### Test Database Setup

**`__tests__/utils/test-db.js`:**

```javascript
const { PrismaClient } = require('@prisma/client');

class TestDatabase {
  constructor() {
    this.prisma = new PrismaClient({
      datasource: {
        url: 'file:./test.db'
      },
      log: process.env.DEBUG_TESTS ? ['query', 'error'] : ['error']
    });
  }

  async setup() {
    // Push schema to test database
    const { execSync } = require('child_process');
    execSync('npx prisma db push --schema=./prisma/schema.prisma', {
      env: { ...process.env, DATABASE_URL: 'file:./test.db' }
    });
  }

  async cleanup() {
    // Clean all tables
    await this.prisma.session.deleteMany();
    await this.prisma.workspace.deleteMany();
    await this.prisma.settings.deleteMany();
    await this.prisma.authLog.deleteMany();
    await this.prisma.systemMetric.deleteMany();
  }

  async teardown() {
    await this.prisma.$disconnect();
  }

  // Helper methods for test data creation
  async createTestWorkspace(overrides = {}) {
    return await this.prisma.workspace.create({
      data: {
        name: 'test-workspace',
        githubRepo: 'testuser/test-repo',
        githubUrl: 'https://github.com/testuser/test-repo',
        localPath: '/tmp/test-workspace',
        ...overrides
      }
    });
  }

  async createTestSession(workspaceId, overrides = {}) {
    return await this.prisma.session.create({
      data: {
        workspaceId,
        shell: 'bash',
        socketId: 'test-socket-id',
        ...overrides
      }
    });
  }
}

module.exports = TestDatabase;
```

### Mock Helpers

**`__tests__/utils/mocks.js`:**

```javascript
// Mock GitHub API responses
const createMockGitHubUser = (overrides = {}) => ({
  id: 12345,
  login: 'testuser',
  email: 'test@example.com',
  avatar_url: 'https://github.com/avatar.jpg',
  ...overrides
});

const createMockRepository = (overrides = {}) => ({
  id: 123456,
  name: 'test-repo',
  full_name: 'testuser/test-repo',
  clone_url: 'https://github.com/testuser/test-repo.git',
  default_branch: 'main',
  private: false,
  ...overrides
});

// Mock file system operations
const mockFileSystem = {
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    rm: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    chmod: jest.fn()
  }
};

// Mock child process
const mockChildProcess = {
  spawn: jest.fn(() => ({
    pid: 12345,
    stdout: {
      on: jest.fn(),
      pipe: jest.fn()
    },
    stderr: {
      on: jest.fn(),
      pipe: jest.fn()
    },
    on: jest.fn(),
    kill: jest.fn()
  }))
};

module.exports = {
  createMockGitHubUser,
  createMockRepository,
  mockFileSystem,
  mockChildProcess
};
```

## Testing Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "test:unit": "jest __tests__/unit",
    "test:integration": "jest __tests__/integration",
    "test:socket": "jest __tests__/socket",
    "test:e2e": "jest __tests__/e2e",
    "test:db": "jest __tests__/database",
    "test:debug": "DEBUG_TESTS=1 jest --runInBand"
  }
}
```

### CI/CD Testing

**`.github/workflows/test.yml`:**

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test database
        run: npx prisma db push
        env:
          DATABASE_URL: file:./test.db
      
      - name: Run tests
        run: npm run test:ci
        env:
          JWT_SECRET: test-jwt-secret-at-least-32-characters-long
          TENANT_GITHUB_USERNAME: testuser
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Test Coverage Goals

### Coverage Targets

- **Overall Coverage:** 80%+
- **Services:** 90%+
- **Controllers:** 85%+
- **Middleware:** 95%+
- **Utils:** 90%+

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html

# Coverage summary
npm run test:coverage -- --coverageReporters=text-summary
```

## Best Practices

### Writing Good Tests

1. **Follow AAA Pattern**
   ```javascript
   it('should do something', () => {
     // Arrange
     const input = 'test data';
     
     // Act
     const result = functionUnderTest(input);
     
     // Assert
     expect(result).toBe('expected output');
   });
   ```

2. **Use Descriptive Test Names**
   ```javascript
   // Good
   it('should return 401 when JWT token is expired')
   
   // Bad
   it('should handle invalid token')
   ```

3. **Test Edge Cases**
   ```javascript
   describe('validateInput', () => {
     it('should handle null input');
     it('should handle empty string');
     it('should handle special characters');
     it('should handle very long strings');
   });
   ```

4. **Mock External Dependencies**
   ```javascript
   // Mock GitHub API
   jest.mock('@octokit/rest');
   
   // Mock file system
   jest.mock('fs');
   ```

### Common Testing Patterns

#### Async Testing

```javascript
// Async/await
it('should create workspace', async () => {
  const result = await WorkspaceService.createWorkspace(data);
  expect(result.id).toBeDefined();
});

// Promise resolution
it('should resolve promise', () => {
  return expect(asyncFunction()).resolves.toBe(expectedValue);
});

// Promise rejection
it('should reject promise', () => {
  return expect(asyncFunction()).rejects.toThrow('Error message');
});
```

#### Database Testing

```javascript
// Test with clean database
beforeEach(async () => {
  await testDb.cleanup();
});

// Test with seed data
beforeEach(async () => {
  await testDb.cleanup();
  workspace = await testDb.createTestWorkspace();
});
```

## Troubleshooting Tests

### Common Issues

**Tests Timing Out**
```javascript
// Increase timeout for slow tests
describe('Slow operations', () => {
  jest.setTimeout(10000); // 10 seconds
  
  it('should handle slow operation', async () => {
    // test code
  });
});
```

**Database Connection Issues**
```bash
# Ensure test database is clean
rm test.db
npx prisma db push
```

**Mock Issues**
```javascript
// Clear mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Reset modules between tests
afterEach(() => {
  jest.resetModules();
});
```

## Next Steps

- **[Production Setup](/docs/deployment/production/):** Production deployment
- **[Troubleshooting](/docs/troubleshooting/common-issues/):** Common issues
- **[Performance Tips](/docs/troubleshooting/performance-tips/):** Optimization guide