import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock database
const mockPrismaClient = {
  $connect: vi.fn(),
  settings: {
    findFirst: vi.fn(),
  },
};

vi.mock('@/config/database', () => ({
  prisma: mockPrismaClient,
  testConnection: vi.fn(),
}));

describe('Health Controller', () => {
  let app;
  let healthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import app after mocks are set up
    const appModule = await import('@/app.js');
    app = appModule.default;
  });

  describe('GET /health', () => {
    it('should return healthy status when database is connected', async () => {
      mockPrismaClient.$connect.mockResolvedValue();

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        database: 'connected',
      });
    });

    it('should return unhealthy status when database connection fails', async () => {
      mockPrismaClient.$connect.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body).toEqual({
        status: 'unhealthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        database: 'disconnected',
        error: 'Database error',
      });
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      mockPrismaClient.$connect.mockResolvedValue();
      mockPrismaClient.settings.findFirst.mockResolvedValue({
        id: 'singleton',
        githubToken: 'encrypted-token',
      });

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        database: 'connected',
        services: {
          github: 'configured',
        },
        system: {
          memory: expect.any(Object),
          platform: expect.any(String),
          nodeVersion: expect.any(String),
        },
      });
    });
  });
});