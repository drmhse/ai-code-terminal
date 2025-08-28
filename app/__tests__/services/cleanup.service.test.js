// Mock Prisma client
const mockPrismaClient = {
  csrfToken: {
    deleteMany: jest.fn()
  },
  rateLimit: {
    deleteMany: jest.fn()
  },
  session: {
    deleteMany: jest.fn()
  },
  userProcess: {
    deleteMany: jest.fn()
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient)
}));

jest.mock('../../src/utils/logger');

const logger = require('../../src/utils/logger');

// Mock timers
jest.useFakeTimers();

describe('CleanupService', () => {
  let cleanupService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Re-require the service to get a fresh instance
    delete require.cache[require.resolve('../../src/services/cleanup.service')];
    cleanupService = require('../../src/services/cleanup.service');
    
    // Reset service state
    cleanupService.stop();
  });

  afterEach(() => {
    cleanupService.stop();
    jest.clearAllTimers();
  });

  describe('start', () => {
    it('should start the cleanup service successfully', () => {
      cleanupService.start();

      expect(cleanupService.isRunning).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Starting cleanup service');
      expect(logger.info).toHaveBeenCalledWith('Cleanup service started successfully');
      
      // Check that jobs are scheduled
      const status = cleanupService.getStatus();
      expect(status.activeJobs).toContain('csrf-tokens');
      expect(status.activeJobs).toContain('rate-limits');
      expect(status.activeJobs).toContain('sessions');
      expect(status.activeJobs).toContain('processes');
    });

    it('should not start if already running', () => {
      cleanupService.start();
      logger.info.mockClear();

      cleanupService.start();

      expect(logger.warn).toHaveBeenCalledWith('Cleanup service already running');
      expect(logger.info).not.toHaveBeenCalledWith('Starting cleanup service');
    });

    it('should run jobs immediately after scheduling', async () => {
      mockPrismaClient.csrfToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.rateLimit.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.userProcess.deleteMany.mockResolvedValue({ count: 0 });

      cleanupService.start();

      // Fast-forward time to trigger initial job execution
      jest.advanceTimersByTime(1100);

      // Wait for async operations
      await Promise.resolve();

      expect(mockPrismaClient.csrfToken.deleteMany).toHaveBeenCalled();
      expect(mockPrismaClient.rateLimit.deleteMany).toHaveBeenCalled();
      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalled();
      expect(mockPrismaClient.userProcess.deleteMany).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the cleanup service successfully', () => {
      cleanupService.start();
      cleanupService.stop();

      expect(cleanupService.isRunning).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Stopping cleanup service');
      expect(logger.info).toHaveBeenCalledWith('Cleanup service stopped');
    });

    it('should not stop if not running', () => {
      cleanupService.stop();

      // Should not log anything when already stopped
      expect(logger.info).not.toHaveBeenCalledWith('Stopping cleanup service');
    });
  });

  describe('cleanupExpiredCSRFTokens', () => {
    it('should clean up expired CSRF tokens successfully', async () => {
      const mockResult = { count: 5 };
      mockPrismaClient.csrfToken.deleteMany.mockResolvedValue(mockResult);

      const result = await cleanupService.cleanupExpiredCSRFTokens();

      expect(result).toBe(5);
      expect(mockPrismaClient.csrfToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) }
        }
      });
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 5 expired CSRF tokens');
    });

    it('should not log if no tokens were cleaned up', async () => {
      const mockResult = { count: 0 };
      mockPrismaClient.csrfToken.deleteMany.mockResolvedValue(mockResult);

      const result = await cleanupService.cleanupExpiredCSRFTokens();

      expect(result).toBe(0);
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned up'));
    });

    it('should handle errors and rethrow', async () => {
      const error = new Error('Database error');
      mockPrismaClient.csrfToken.deleteMany.mockRejectedValue(error);

      await expect(cleanupService.cleanupExpiredCSRFTokens()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Failed to clean up expired CSRF tokens:', error);
    });
  });

  describe('cleanupExpiredRateLimits', () => {
    it('should clean up expired rate limit entries successfully', async () => {
      const mockResult = { count: 3 };
      mockPrismaClient.rateLimit.deleteMany.mockResolvedValue(mockResult);

      const result = await cleanupService.cleanupExpiredRateLimits();

      expect(result).toBe(3);
      expect(mockPrismaClient.rateLimit.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) }
        }
      });
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 3 expired rate limit entries');
    });

    it('should handle errors and rethrow', async () => {
      const error = new Error('Database error');
      mockPrismaClient.rateLimit.deleteMany.mockRejectedValue(error);

      await expect(cleanupService.cleanupExpiredRateLimits()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Failed to clean up expired rate limit entries:', error);
    });
  });

  describe('cleanupOldSessions', () => {
    it('should clean up old sessions successfully', async () => {
      const mockResult = { count: 2 };
      mockPrismaClient.session.deleteMany.mockResolvedValue(mockResult);

      const result = await cleanupService.cleanupOldSessions();

      expect(result).toBe(2);
      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              status: 'terminated',
              endedAt: { lt: expect.any(Date) }
            },
            {
              status: 'paused',
              lastActivityAt: { lt: expect.any(Date) }
            }
          ]
        }
      });
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 2 old sessions');
    });

    it('should use correct date threshold (7 days ago)', async () => {
      const mockResult = { count: 1 };
      mockPrismaClient.session.deleteMany.mockResolvedValue(mockResult);

      const now = new Date('2023-01-08T10:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      await cleanupService.cleanupOldSessions();

      const expectedDate = new Date('2023-01-01T10:00:00Z');
      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              status: 'terminated',
              endedAt: { lt: expectedDate }
            },
            {
              status: 'paused',
              lastActivityAt: { lt: expectedDate }
            }
          ]
        }
      });
    });

    it('should handle errors and rethrow', async () => {
      const error = new Error('Database error');
      mockPrismaClient.session.deleteMany.mockRejectedValue(error);

      await expect(cleanupService.cleanupOldSessions()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Failed to clean up old sessions:', error);
    });
  });

  describe('cleanupOldProcesses', () => {
    it('should clean up old process records successfully', async () => {
      const mockResult = { count: 4 };
      mockPrismaClient.userProcess.deleteMany.mockResolvedValue(mockResult);

      const result = await cleanupService.cleanupOldProcesses();

      expect(result).toBe(4);
      expect(mockPrismaClient.userProcess.deleteMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { status: 'stopped' },
                { status: 'crashed' },
                { status: 'killed' }
              ]
            },
            {
              endedAt: { lt: expect.any(Date) }
            }
          ]
        }
      });
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 4 old process records');
    });

    it('should handle errors and rethrow', async () => {
      const error = new Error('Database error');
      mockPrismaClient.userProcess.deleteMany.mockRejectedValue(error);

      await expect(cleanupService.cleanupOldProcesses()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Failed to clean up old process records:', error);
    });
  });

  describe('runAllCleanupJobs', () => {
    it('should run all cleanup jobs immediately', async () => {
      mockPrismaClient.csrfToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaClient.rateLimit.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 3 });
      mockPrismaClient.userProcess.deleteMany.mockResolvedValue({ count: 4 });

      const results = await cleanupService.runAllCleanupJobs();

      expect(results).toEqual({
        csrfTokens: 1,
        rateLimits: 2,
        sessions: 3,
        processes: 4
      });
      expect(logger.info).toHaveBeenCalledWith('Running all cleanup jobs immediately');
      expect(logger.info).toHaveBeenCalledWith('Cleanup results:', results);
    });
  });

  describe('getStatus', () => {
    it('should return status when stopped', () => {
      const status = cleanupService.getStatus();

      expect(status).toEqual({
        isRunning: false,
        activeJobs: [],
        jobCount: 0
      });
    });

    it('should return status when running', () => {
      cleanupService.start();
      const status = cleanupService.getStatus();

      expect(status).toEqual({
        isRunning: true,
        activeJobs: ['csrf-tokens', 'rate-limits', 'sessions', 'processes'],
        jobCount: 4
      });
    });
  });

  describe('scheduleJob', () => {
    it('should handle job function errors gracefully', async () => {
      const mockJobFunction = jest.fn().mockRejectedValue(new Error('Job error'));
      
      cleanupService.scheduleJob('test-job', mockJobFunction, 1000);

      // Fast-forward to trigger job
      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      expect(logger.error).toHaveBeenCalledWith("Cleanup job 'test-job' failed:", expect.any(Error));
    });

    it('should handle initial job function errors gracefully', async () => {
      const mockJobFunction = jest.fn().mockRejectedValue(new Error('Initial job error'));
      
      cleanupService.scheduleJob('test-job', mockJobFunction, 1000);

      // Fast-forward to trigger initial job
      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      expect(logger.error).toHaveBeenCalledWith("Initial cleanup job 'test-job' failed:", expect.any(Error));
    });
  });
});