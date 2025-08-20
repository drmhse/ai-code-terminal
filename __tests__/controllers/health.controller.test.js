// Mock services before requiring them
jest.mock('../../src/services/shell.service', () => ({
  activeSessions: new Map(),
  socketToWorkspace: new Map(),
  createPtyForSocket: jest.fn(),
  attachSocketToSession: jest.fn(),
  detachSocketFromSession: jest.fn(),
  terminateSession: jest.fn(),
  getAllSessions: jest.fn(() => []),
  performPeriodicCleanup: jest.fn(),
  restoreSessions: jest.fn(),
  cleanup: jest.fn(),
  getActiveSessionCount: jest.fn(() => 0),
  getSessionForWorkspace: jest.fn(() => null),
  getSessionStats: jest.fn()
}));

jest.mock('../../src/services/workspace.service');
jest.mock('../../src/services/resource.service');
jest.mock('../../src/services/github.service', () => ({
  validateToken: jest.fn()
}));
jest.mock('../../src/services/settings.service', () => ({
  getSettings: jest.fn()
}));
// Mock fs module properly for require('fs').promises and require('fs').constants pattern
const mockFsAccess = jest.fn();

jest.mock('fs', () => ({
  promises: {
    access: mockFsAccess
  },
  constants: {
    W_OK: 2
  }
}));
jest.mock('../../src/config/database', () => ({
  prisma: {
    $queryRaw: jest.fn()
  }
}));

const HealthController = require('../../src/controllers/health.controller');
const environment = require('../../src/config/environment');

const shellService = require('../../src/services/shell.service');
const workspaceService = require('../../src/services/workspace.service');
const resourceService = require('../../src/services/resource.service');
const githubService = require('../../src/services/github.service');
const settingsService = require('../../src/services/settings.service');
const { prisma } = require('../../src/config/database');
// fs will be mocked, but we need the reference for test setup

describe('HealthController', () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mocks
    prisma.$queryRaw.mockResolvedValue([{}]);
    settingsService.getSettings.mockResolvedValue({ githubToken: 'test-token' });
    githubService.validateToken.mockResolvedValue(true);
    mockFsAccess.mockResolvedValue(); // Mock successful filesystem access
    shellService.getSessionStats.mockReturnValue({ totalSessions: 0, sessions: [] });
  });

  describe('getHealthStatus', () => {
    it('should return health status with correct properties', async () => {
      const uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(100);

      await HealthController.getHealthStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status', 'healthy');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('uptime', 100);
      expect(response).toHaveProperty('services');
      expect(response).toHaveProperty('sessions');
      expect(response).toHaveProperty('memory');
      expect(response).toHaveProperty('env', environment.NODE_ENV);
      expect(response.services).toHaveProperty('database', 'healthy');
      expect(response.services).toHaveProperty('github', 'healthy');
      expect(response.services).toHaveProperty('filesystem', 'healthy');
      
      uptimeSpy.mockRestore();
    });

    it('should return error status when exception occurs', async () => {
      // Mock console.error to avoid output during test  
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Force an error by mocking database to throw
      prisma.$queryRaw.mockRejectedValue(new Error('Test error'));

      await HealthController.getHealthStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(207); // 207 because database error sets status to 'degraded'
      expect(res.json).toHaveBeenCalled();
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status', 'degraded'); // Database error sets status to 'degraded'
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('errors');
      expect(response.errors).toContain('Database: Test error');
      expect(response.services).toHaveProperty('database', 'unhealthy');
      expect(response.services).toHaveProperty('github', 'healthy'); // Other services should still work
      expect(response.services).toHaveProperty('filesystem', 'healthy');
      
      consoleSpy.mockRestore();
    });
  });

  describe('getDetailedHealth', () => {
    it('should return detailed health status', () => {
      // Save original values
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      const originalVersion = Object.getOwnPropertyDescriptor(process, 'version');
      
      // Mock process properties
      Object.defineProperty(process, 'platform', {
        value: 'test-platform',
        writable: true,
        configurable: true
      });
      
      Object.defineProperty(process, 'version', {
        value: 'v16.0.0',
        writable: true,
        configurable: true
      });
      
      const uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(100);

      HealthController.getDetailedHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status', 'healthy');
      expect(response).toHaveProperty('timestamp');
      expect(response.services).toEqual({
        userService: 'operational',
        sessionService: 'operational',
        claudeService: 'operational'
      });
      expect(response.system).toEqual({
        uptime: 100,
        memory: expect.any(Object),
        platform: 'test-platform',
        nodeVersion: 'v16.0.0'
      });
      
      // Restore original values
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
      
      if (originalVersion) {
        Object.defineProperty(process, 'version', originalVersion);
      }
      
      uptimeSpy.mockRestore();
    });

    it('should return error status when exception occurs', () => {
      // Mock console.error to avoid output during test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock process.platform to throw an error
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', {
        get: function() {
          throw new Error('Test error');
        },
        configurable: true
      });

      HealthController.getDetailedHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('status', 'unhealthy');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('error', 'Test error');
      
      // Restore original values
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      } else {
        delete process.platform;
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('getSystemStats', () => {
    it('should return system stats', async () => {
      // Mock service responses
      shellService.getSessionStats.mockReturnValue({
        totalSessions: 2,
        sessions: [{ id: 'session1' }, { id: 'session2' }]
      });
      
      workspaceService.listWorkspaces.mockResolvedValue([
        { id: 'workspace1', isActive: true },
        { id: 'workspace2', isActive: false }
      ]);
      
      resourceService.getResourceStats.mockResolvedValue({
        memory: {
          used: 100,
          limit: 1000,
          available: 900,
          percentage: 10,
          formatted: '10%'
        },
        cpu: {
          cores: 4,
          limitCores: 2,
          percentage: 50,
          formatted: '50%'
        },
        disk: {
          workspaces: {
            used: 500,
            available: 1500,
            percentage: 25,
            formatted: '25%'
          }
        }
      });
      
      const uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(100);

      await HealthController.getSystemStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('system');
      expect(response).toHaveProperty('resources');
      expect(response).toHaveProperty('sessions');
      expect(response).toHaveProperty('workspaces');
      expect(response).toHaveProperty('timestamp');
      
      expect(response.system.uptime).toBe(100);
      expect(response.sessions.active).toBe(2);
      expect(response.workspaces.total).toBe(2);
      expect(response.workspaces.active).toBe(1);
      
      uptimeSpy.mockRestore();
    });

    it('should return error when service fails', async () => {
      // Mock console.error to avoid output during test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock service to throw error
      shellService.getSessionStats.mockImplementation(() => {
        throw new Error('Service error');
      });

      await HealthController.getSystemStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('error', 'Failed to get system stats');
      expect(response).toHaveProperty('message', 'Service error');
      
      consoleSpy.mockRestore();
    });
  });

  describe('formatUptime', () => {
    it('should format uptime with days when >= 1 day', () => {
      const result = HealthController.formatUptime(90061); // 1 day, 1 hour, 1 minute
      expect(result).toBe('1d 1h 1m');
    });

    it('should format uptime with hours when >= 1 hour but < 1 day', () => {
      const result = HealthController.formatUptime(3661); // 1 hour, 1 minute
      expect(result).toBe('1h 1m');
    });

    it('should format uptime with minutes when < 1 hour', () => {
      const result = HealthController.formatUptime(59); // 59 seconds
      expect(result).toBe('0m');
    });
  });
});