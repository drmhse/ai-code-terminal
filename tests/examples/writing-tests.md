# Writing Tests - Examples and Patterns

This guide provides practical examples for writing tests in the claude-code-terminal project using Vitest.

## Test Structure Patterns

### Basic Service Test

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UserService', () => {
  let userService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    userService = new UserService();
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Arrange
      const userData = { name: 'John Doe', email: 'john@example.com' };
      mockPrismaClient.user.create.mockResolvedValue({ id: '1', ...userData });

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toEqual({ id: '1', ...userData });
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: userData
      });
    });

    it('should throw error for invalid email', async () => {
      // Arrange
      const userData = { name: 'John Doe', email: 'invalid-email' };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Invalid email format');
    });
  });
});
```

### Controller Test with Express

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('UserController', () => {
  let app;
  let controller;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import after mocks are set up
    const { default: UserController } = await import('@/controllers/user.controller.js');
    controller = UserController;

    // Setup Express app
    app = express();
    app.use(express.json());
    app.post('/users', controller.createUser.bind(controller));
    app.get('/users/:id', controller.getUser.bind(controller));
  });

  it('should create user via POST /users', async () => {
    const userData = { name: 'John Doe', email: 'john@example.com' };
    mockUserService.createUser.mockResolvedValue({ id: '1', ...userData });

    await request(app)
      .post('/users')
      .send(userData)
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.user.name).toBe('John Doe');
      });
  });

  it('should handle validation errors', async () => {
    await request(app)
      .post('/users')
      .send({ name: 'John' }) // Missing email
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toContain('email is required');
      });
  });
});
```

### Async Function Testing

```javascript
describe('Async Operations', () => {
  it('should handle async operations with await', async () => {
    const result = await asyncFunction();
    expect(result).toBe('expected value');
  });

  it('should handle promises with resolves', async () => {
    await expect(promiseFunction()).resolves.toBe('success');
  });

  it('should handle promise rejections', async () => {
    await expect(failingFunction()).rejects.toThrow('Expected error');
  });

  it('should test async function with timeout', async () => {
    const slowFunction = () => new Promise(resolve => 
      setTimeout(() => resolve('done'), 100)
    );
    
    await expect(slowFunction()).resolves.toBe('done');
  }, 200); // Custom timeout
});
```

## Mocking Patterns

### Mocking External Modules

```javascript
// Mock at the top of the file, before imports
vi.mock('@/services/external.service', () => ({
  default: {
    fetchData: vi.fn(),
    sendEmail: vi.fn(),
  }
}));

describe('Service with external dependencies', () => {
  it('should use mocked external service', async () => {
    const mockExternalService = await import('@/services/external.service');
    mockExternalService.default.fetchData.mockResolvedValue('mocked data');

    const result = await myService.processData();
    
    expect(result).toBe('processed mocked data');
    expect(mockExternalService.default.fetchData).toHaveBeenCalledTimes(1);
  });
});
```

### Partial Mocking

```javascript
vi.mock('@/utils/logger', async () => {
  const actual = await vi.importActual('@/utils/logger');
  return {
    ...actual,
    error: vi.fn(), // Only mock the error method
  };
});
```

### Function Mocking

```javascript
describe('Function mocking examples', () => {
  it('should mock function implementation', () => {
    const mockCallback = vi.fn();
    mockCallback.mockImplementation((x) => x * 2);

    const result = processWithCallback(5, mockCallback);
    
    expect(result).toBe(10);
    expect(mockCallback).toHaveBeenCalledWith(5);
  });

  it('should mock function return values', () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({ data: 'first call' });
    mockFetch.mockResolvedValueOnce({ data: 'second call' });

    // First call returns 'first call'
    // Second call returns 'second call'
  });

  it('should verify mock call arguments', () => {
    const mockFn = vi.fn();
    
    myService.callFunction(mockFn, 'arg1', 'arg2');
    
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn.mock.calls[0]).toEqual(['arg1', 'arg2']);
  });
});
```

### Mocking with spyOn

```javascript
describe('Spying on methods', () => {
  it('should spy on existing methods', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    myService.logMessage('test');
    
    expect(consoleSpy).toHaveBeenCalledWith('test');
    
    consoleSpy.mockRestore(); // Restore original implementation
  });

  it('should spy on object methods', () => {
    const user = { getName: () => 'John' };
    const spy = vi.spyOn(user, 'getName');
    
    const name = user.getName();
    
    expect(spy).toHaveBeenCalled();
    expect(name).toBe('John');
  });
});
```

## Error Testing Patterns

### Testing Error Conditions

```javascript
describe('Error handling', () => {
  it('should throw specific error for invalid input', () => {
    expect(() => validateEmail('invalid')).toThrow('Invalid email format');
  });

  it('should throw error with specific message', () => {
    expect(() => divide(10, 0)).toThrow(/division by zero/i);
  });

  it('should handle async errors', async () => {
    await expect(asyncFunctionThatFails()).rejects.toThrow('Async error');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    await expect(fetchUserData()).rejects.toThrow('Network error');
  });
});
```

### Testing Error Recovery

```javascript
describe('Error recovery', () => {
  it('should retry on failure', async () => {
    const mockService = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValueOnce('Success');

    const result = await retryableService(mockService, 3);
    
    expect(result).toBe('Success');
    expect(mockService).toHaveBeenCalledTimes(3);
  });

  it('should fallback to default value', async () => {
    mockExternalService.getData.mockRejectedValue(new Error('Service unavailable'));
    
    const result = await getDataWithFallback();
    
    expect(result).toBe('default value');
  });
});
```

## Database Testing Patterns

### Testing with Mocked Prisma

```javascript
import { mockPrismaClient } from '../../mocks/prisma.js';

describe('Database operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create record', async () => {
    const newUser = { id: '1', name: 'John', email: 'john@example.com' };
    mockPrismaClient.user.create.mockResolvedValue(newUser);

    const result = await userService.create({ name: 'John', email: 'john@example.com' });

    expect(result).toEqual(newUser);
    expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
      data: { name: 'John', email: 'john@example.com' }
    });
  });

  it('should handle database constraints', async () => {
    mockPrismaClient.user.create.mockRejectedValue(
      new Error('Unique constraint violation')
    );

    await expect(userService.create({ 
      name: 'John', 
      email: 'existing@example.com' 
    })).rejects.toThrow('Unique constraint violation');
  });

  it('should test complex queries', async () => {
    const users = [{ id: '1', name: 'John' }, { id: '2', name: 'Jane' }];
    mockPrismaClient.user.findMany.mockResolvedValue(users);

    const result = await userService.findByFilter({ active: true });

    expect(result).toEqual(users);
    expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith({
      where: { active: true }
    });
  });
});
```

### Testing Transactions

```javascript
describe('Database transactions', () => {
  it('should handle transaction success', async () => {
    const mockTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(mockPrismaClient);
    });
    
    mockPrismaClient.$transaction = mockTransaction;
    mockPrismaClient.user.create.mockResolvedValue({ id: '1' });
    mockPrismaClient.profile.create.mockResolvedValue({ id: '1' });

    await userService.createUserWithProfile(userData);

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockPrismaClient.user.create).toHaveBeenCalled();
    expect(mockPrismaClient.profile.create).toHaveBeenCalled();
  });
});
```

## Socket.IO Testing Patterns

### Testing Socket Events

```javascript
import { createMockSocket, mockSocketServer } from '../../mocks/socket.io.js';

describe('Socket handling', () => {
  let socket;
  let socketHandler;

  beforeEach(async () => {
    socket = createMockSocket();
    const { default: SocketHandler } = await import('@/socket/socket.handler.js');
    socketHandler = SocketHandler;
  });

  it('should handle connection event', () => {
    const connectSpy = vi.spyOn(socketHandler, 'handleConnection');
    
    mockSocketServer.emit('connection', socket);
    
    expect(connectSpy).toHaveBeenCalledWith(socket);
  });

  it('should emit terminal output', () => {
    const emitSpy = vi.spyOn(socket, 'emit');
    
    socket.emit('terminal-input', 'ls -la');
    
    expect(emitSpy).toHaveBeenCalledWith('terminal-input', 'ls -la');
  });

  it('should handle disconnect', async () => {
    socket.connected = true;
    
    socket.disconnect();
    
    expect(socket.connected).toBe(false);
    expect(socket.listenerCount('disconnect')).toBeGreaterThan(0);
  });
});
```

## Testing Utilities and Helpers

### Testing Pure Functions

```javascript
describe('Utility functions', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    const formatted = formatDate(date);
    expect(formatted).toBe('2024-01-01');
  });

  it('should validate email format', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it('should sanitize user input', () => {
    const malicious = '<script>alert("xss")</script>';
    const safe = sanitizeInput(malicious);
    expect(safe).not.toContain('<script>');
  });
});
```

### Testing with Different Data Sets

```javascript
describe.each([
  { input: 'john@example.com', expected: true },
  { input: 'invalid-email', expected: false },
  { input: '', expected: false },
  { input: 'test@', expected: false },
])('Email validation', ({ input, expected }) => {
  it(`should return ${expected} for "${input}"`, () => {
    expect(isValidEmail(input)).toBe(expected);
  });
});
```

## Performance Testing

### Testing Performance

```javascript
describe('Performance tests', () => {
  it('should complete within time limit', async () => {
    const start = Date.now();
    
    await performanceTestFunction();
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should handle large datasets efficiently', () => {
    const largeArray = new Array(10000).fill().map((_, i) => i);
    
    const start = performance.now();
    const result = processLargeDataset(largeArray);
    const end = performance.now();
    
    expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    expect(result).toHaveLength(10000);
  });
});
```

## Custom Matchers

### Creating Custom Matchers

```javascript
// In setup.js or test file
expect.extend({
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be a valid email`
        : `Expected ${received} to be a valid email`
    };
  }
});

// Usage in tests
describe('Custom matchers', () => {
  it('should validate email with custom matcher', () => {
    expect('test@example.com').toBeValidEmail();
    expect('invalid').not.toBeValidEmail();
  });
});
```

## Common Testing Pitfalls

### Avoiding Common Mistakes

```javascript
// ❌ Don't: Test implementation details
it('should call internal method', () => {
  const spy = vi.spyOn(service, '_internalMethod');
  service.publicMethod();
  expect(spy).toHaveBeenCalled(); // Testing implementation, not behavior
});

// ✅ Do: Test public behavior
it('should return processed result', () => {
  const result = service.publicMethod();
  expect(result).toBe('expected output'); // Testing behavior
});

// ❌ Don't: Write tests that depend on other tests
it('should create user', () => {
  currentUser = createUser(); // Setting global state
});

it('should update user', () => {
  updateUser(currentUser); // Depending on previous test
});

// ✅ Do: Make tests independent
it('should update user', () => {
  const user = createUser(); // Create fresh state
  updateUser(user);
  expect(user.updated).toBe(true);
});

// ❌ Don't: Use real timers in tests
it('should delay execution', async () => {
  setTimeout(() => {
    // This makes tests slow and flaky
  }, 1000);
});

// ✅ Do: Mock timers
it('should delay execution', async () => {
  vi.useFakeTimers();
  const callback = vi.fn();
  
  setTimeout(callback, 1000);
  vi.advanceTimersByTime(1000);
  
  expect(callback).toHaveBeenCalled();
  vi.useRealTimers();
});
```

This guide provides practical patterns for writing effective tests in the claude-code-terminal project. Use these examples as templates and adapt them to your specific testing needs.