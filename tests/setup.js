import { vi } from 'vitest';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { unlink } from 'fs/promises';
import path from 'path';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only-must-be-at-least-32-chars';
process.env.TENANT_GITHUB_USERNAME = 'test-user';
process.env.DATABASE_URL = 'file:./prisma/data/test-database.db';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/auth/github/callback';
process.env.PORT = '3001';
process.env.FRONTEND_URL = 'https://localhost:3014';

// Global test setup
beforeAll(async () => {
  try {
    // Clean up existing test database
    const testDbPath = path.resolve(process.cwd(), 'prisma/data/test-database.db');
    try {
      await unlink(testDbPath);
    } catch (error) {
      // File might not exist, which is fine
    }

    // Run database migrations for test database
    execSync('npx prisma migrate dev --name test-init', {
      env: { ...process.env, DATABASE_URL: 'file:./prisma/data/test-database.db' },
      stdio: 'pipe'
    });

    // Generate Prisma client
    execSync('npx prisma generate', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to set up test database:', error.message);
    throw error;
  }
});

afterAll(async () => {
  try {
    // Clean up test database
    const testDbPath = path.resolve(process.cwd(), 'prisma/data/test-database.db');
    await unlink(testDbPath);
  } catch (error) {
    // File might not exist, which is fine
  }
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock process.exit
vi.stubGlobal('process', {
  ...process,
  exit: vi.fn(),
});