const environment = require('../config/environment');
const { prisma } = require('../config/database');
const shellService = require('../services/shell.service');
const workspaceService = require('../services/workspace.service');
const resourceService = require('../services/resource.service');

class HealthController {
  getHealthStatus(req, res) {
    try {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: environment.NODE_ENV
      };

      // Add additional health checks if needed
      // Future: Database connectivity check
      // if (prisma) {
      //   healthData.database = 'connected';
      // }

      res.status(200).json(healthData);
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
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
      // Get shell session stats
      const sessionStats = shellService.getSessionStats();
      
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
          list: sessionStats.sessions
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