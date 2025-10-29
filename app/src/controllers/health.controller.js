const environment = require('../config/environment');
const { prisma } = require('../config/database');
const shellService = require('../services/multiplex-shell.service');
const workspaceService = require('../services/workspace.service');
const resourceService = require('../services/resource.service');
const githubService = require('../services/github.service');
const settingsService = require('../services/settings.service');
const fs = require('fs').promises;
const { constants } = require('fs');

class HealthController {
  async getHealthStatus(req, res) {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'unknown',
        github: 'unknown',
        filesystem: 'unknown'
      },
      errors: []
    };

    try {
      // Check database connectivity
      try {
        await prisma.$queryRaw`SELECT 1`;
        healthData.services.database = 'healthy';
      } catch (error) {
        healthData.services.database = 'unhealthy';
        healthData.errors.push(`Database: ${error.message}`);
        healthData.status = 'degraded';
      }

      // Check GitHub token validity
      try {
        const settings = await settingsService.getSettings();
        if (settings?.githubToken) {
          const isValid = await githubService.validateToken(settings.githubToken);
          healthData.services.github = isValid ? 'healthy' : 'token-expired';
          if (!isValid) {
            healthData.errors.push('GitHub: Token expired or invalid');
            healthData.status = 'degraded';
          }
        } else {
          healthData.services.github = 'not-configured';
        }
      } catch (error) {
        healthData.services.github = 'error';
        healthData.errors.push(`GitHub: ${error.message}`);
        healthData.status = 'degraded';
      }

      // Check filesystem access
      try {
        await fs.access('/app/workspaces', constants.W_OK);
        healthData.services.filesystem = 'healthy';
      } catch (error) {
        healthData.services.filesystem = 'unhealthy';
        healthData.errors.push(`Filesystem: ${error.message}`);
        healthData.status = 'unhealthy';
      }

      // Add session statistics
      healthData.sessions = shellService.getSessionStats();

      // Add memory usage
      healthData.memory = process.memoryUsage();
      healthData.env = environment.NODE_ENV;

      const statusCode = healthData.status === 'healthy' ? 200 : 
                        healthData.status === 'degraded' ? 207 : 503;
      
      res.status(statusCode).json(healthData);
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        services: {
          database: 'unknown',
          github: 'unknown',
          filesystem: 'unknown'
        }
      });
    }
  }

  // Future: More detailed health checks
  getDetailedHealth(req, res) {
    try {
      const detailedHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          userService: 'operational',
          sessionService: 'operational',
          claudeService: 'operational'
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version
        }
      };

      res.status(200).json(detailedHealth);
    } catch (error) {
      console.error('Detailed health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  /**
   * Get system stats for UI display
   */
  async getSystemStats(req, res) {
    try {
      // Get shell session stats from multiplex service
      const sessionStats = shellService.getSessionStats();
      
      // Flatten all sessions from all workspaces into a single list
      const allSessions = sessionStats.workspaces.reduce((acc, workspace) => {
        const workspaceSessions = workspace.sessions.map(session => ({
          ...session,
          workspaceId: workspace.workspaceId
        }));
        return acc.concat(workspaceSessions);
      }, []);
      
      // Get workspace count
      const workspaces = await workspaceService.listWorkspaces();
      
      // Get Docker-aware resource stats
      const resources = await resourceService.getResourceStats();
      
      // System metrics
      const uptime = process.uptime();
      
      const stats = {
        system: {
          uptime: Math.floor(uptime),
          uptimeFormatted: this.formatUptime(uptime),
          platform: process.platform,
          nodeVersion: process.version,
          containerized: true
        },
        resources: {
          memory: {
            used: resources.memory.used,
            limit: resources.memory.limit,
            available: resources.memory.available,
            percentage: resources.memory.percentage,
            formatted: resources.memory.formatted
          },
          cpu: {
            cores: resources.cpu.cores,
            limitCores: resources.cpu.limitCores,
            percentage: resources.cpu.percentage,
            formatted: resources.cpu.formatted
          },
          disk: {
            workspaces: resources.disk.workspaces
          }
        },
        sessions: {
          active: sessionStats.totalSessions,
          list: allSessions
        },
        workspaces: {
          total: workspaces.length,
          active: workspaces.filter(w => w.isActive).length
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(stats);
    } catch (error) {
      console.error('System stats error:', error);
      res.status(500).json({
        error: 'Failed to get system stats',
        message: error.message
      });
    }
  }

  /**
   * Format uptime in human readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}

module.exports = new HealthController();