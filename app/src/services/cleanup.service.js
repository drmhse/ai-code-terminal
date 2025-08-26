// Cleanup service for expired tokens and rate limit entries
// Runs periodic cleanup jobs to maintain database health

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class CleanupService {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
  }

  /**
   * Start all cleanup jobs
   */
  start() {
    if (this.isRunning) {
      logger.warn('Cleanup service already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting cleanup service');

    // Clean up expired CSRF tokens every 5 minutes
    this.scheduleJob('csrf-tokens', this.cleanupExpiredCSRFTokens.bind(this), 5 * 60 * 1000);

    // Clean up expired rate limit entries every 10 minutes  
    this.scheduleJob('rate-limits', this.cleanupExpiredRateLimits.bind(this), 10 * 60 * 1000);

    // Clean up old sessions every hour
    this.scheduleJob('sessions', this.cleanupOldSessions.bind(this), 60 * 60 * 1000);

    // Clean up old process records every 30 minutes
    this.scheduleJob('processes', this.cleanupOldProcesses.bind(this), 30 * 60 * 1000);

    logger.info('Cleanup service started successfully');
  }

  /**
   * Stop all cleanup jobs
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping cleanup service');
    
    for (const [jobName, intervalId] of this.intervals.entries()) {
      clearInterval(intervalId);
      logger.info(`Stopped cleanup job: ${jobName}`);
    }
    
    this.intervals.clear();
    this.isRunning = false;
    
    logger.info('Cleanup service stopped');
  }

  /**
   * Schedule a cleanup job
   */
  scheduleJob(name, jobFunction, intervalMs) {
    const intervalId = setInterval(async () => {
      try {
        await jobFunction();
      } catch (error) {
        logger.error(`Cleanup job '${name}' failed:`, error);
      }
    }, intervalMs);

    this.intervals.set(name, intervalId);
    logger.info(`Scheduled cleanup job '${name}' to run every ${intervalMs / 1000} seconds`);

    // Run immediately on start
    setTimeout(async () => {
      try {
        await jobFunction();
      } catch (error) {
        logger.error(`Initial cleanup job '${name}' failed:`, error);
      }
    }, 1000);
  }

  /**
   * Clean up expired CSRF tokens
   */
  async cleanupExpiredCSRFTokens() {
    try {
      const now = new Date();
      const result = await prisma.csrfToken.deleteMany({
        where: {
          expiresAt: { lt: now }
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired CSRF tokens`);
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to clean up expired CSRF tokens:', error);
      throw error;
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  async cleanupExpiredRateLimits() {
    try {
      const now = new Date();
      const result = await prisma.rateLimit.deleteMany({
        where: {
          expiresAt: { lt: now }
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired rate limit entries`);
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to clean up expired rate limit entries:', error);
      throw error;
    }
  }

  /**
   * Clean up old terminated sessions (older than 7 days)
   */
  async cleanupOldSessions() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const result = await prisma.session.deleteMany({
        where: {
          OR: [
            {
              status: 'terminated',
              endedAt: { lt: sevenDaysAgo }
            },
            {
              status: 'paused',
              lastActivityAt: { lt: sevenDaysAgo }
            }
          ]
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} old sessions`);
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to clean up old sessions:', error);
      throw error;
    }
  }

  /**
   * Clean up old process records (older than 7 days and terminated)
   */
  async cleanupOldProcesses() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const result = await prisma.userProcess.deleteMany({
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
              endedAt: { lt: sevenDaysAgo }
            }
          ]
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} old process records`);
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to clean up old process records:', error);
      throw error;
    }
  }

  /**
   * Run all cleanup jobs immediately (for testing/manual execution)
   */
  async runAllCleanupJobs() {
    logger.info('Running all cleanup jobs immediately');
    
    const results = {
      csrfTokens: await this.cleanupExpiredCSRFTokens(),
      rateLimits: await this.cleanupExpiredRateLimits(), 
      sessions: await this.cleanupOldSessions(),
      processes: await this.cleanupOldProcesses()
    };

    logger.info('Cleanup results:', results);
    return results;
  }

  /**
   * Get cleanup service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.intervals.keys()),
      jobCount: this.intervals.size
    };
  }
}

// Export singleton instance
const cleanupService = new CleanupService();

module.exports = cleanupService;