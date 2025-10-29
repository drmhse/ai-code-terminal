const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../src/services/process-supervisor.service');
jest.mock('../../src/utils/logger');

const processController = require('../../src/controllers/process.controller');
const processSupervisorService = require('../../src/services/process-supervisor.service');
const logger = require('../../src/utils/logger');

describe('ProcessController', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.get('/processes', processController.getProcesses.bind(processController));
    app.post('/processes', processController.startProcess.bind(processController));
    app.delete('/processes/:processId', processController.stopProcess.bind(processController));
    app.post('/processes/:processId/restart', processController.restartProcess.bind(processController));
    app.get('/processes/status', processController.getStatus.bind(processController));
    app.get('/processes/:processId', processController.getProcess.bind(processController));

    jest.clearAllMocks();
  });

  describe('getProcesses', () => {
    it('should return all processes successfully', async () => {
      const mockProcesses = [
        { id: 'proc1', command: 'npm start', status: 'running' },
        { id: 'proc2', command: 'node server.js', status: 'stopped' }
      ];

      processSupervisorService.getProcesses.mockResolvedValue(mockProcesses);

      const response = await request(app)
        .get('/processes');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProcesses);
      expect(response.body.count).toBe(2);
    });

    it('should handle errors when getting processes', async () => {
      processSupervisorService.getProcesses.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/processes');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get processes');
      expect(response.body.message).toBe('Service error');
      expect(logger.error).toHaveBeenCalledWith('Error getting processes:', expect.any(Error));
    });
  });

  describe('startProcess', () => {
    it('should start a process successfully', async () => {
      const mockResult = {
        id: 'proc1',
        command: 'npm start',
        status: 'running',
        pid: 1234
      };

      processSupervisorService.trackProcess.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/processes')
        .send({
          command: 'npm start',
          args: ['--production'],
          sessionId: 'session1',
          workspaceId: 'workspace1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(response.body.message).toBe('Process started successfully: npm start');
      expect(processSupervisorService.trackProcess).toHaveBeenCalledWith(
        'npm start',
        ['--production'],
        { sessionId: 'session1', workspaceId: 'workspace1' }
      );
    });

    it('should handle missing command', async () => {
      const response = await request(app)
        .post('/processes')
        .send({
          args: ['--production']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Command is required');
    });

    it('should use default values for optional fields', async () => {
      const mockResult = {
        id: 'proc1',
        command: 'echo hello',
        status: 'running'
      };

      processSupervisorService.trackProcess.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/processes')
        .send({
          command: 'echo hello'
        });

      expect(response.status).toBe(200);
      expect(processSupervisorService.trackProcess).toHaveBeenCalledWith(
        'echo hello',
        [],
        { sessionId: null, workspaceId: null }
      );
    });

    it('should handle errors when starting process', async () => {
      processSupervisorService.trackProcess.mockRejectedValue(new Error('Failed to spawn process'));

      const response = await request(app)
        .post('/processes')
        .send({
          command: 'invalid-command'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to start process');
      expect(response.body.message).toBe('Failed to spawn process');
      expect(logger.error).toHaveBeenCalledWith('Error starting process:', expect.any(Error));
    });
  });

  describe('stopProcess', () => {
    it('should stop a process successfully', async () => {
      processSupervisorService.stopProcess.mockResolvedValue();

      const response = await request(app)
        .delete('/processes/proc1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Process proc1 stopped successfully');
      expect(processSupervisorService.stopProcess).toHaveBeenCalledWith('proc1');
    });

    it('should handle missing process ID', async () => {
      const response = await request(app)
        .delete('/processes/');

      expect(response.status).toBe(404); // Express handles this as not found
    });

    it('should handle errors when stopping process', async () => {
      processSupervisorService.stopProcess.mockRejectedValue(new Error('Process not found'));

      const response = await request(app)
        .delete('/processes/nonexistent');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to stop process');
      expect(response.body.message).toBe('Process not found');
      expect(logger.error).toHaveBeenCalledWith('Error stopping process:', expect.any(Error));
    });
  });

  describe('restartProcess', () => {
    it('should restart a process successfully', async () => {
      const mockResult = {
        id: 'proc1',
        command: 'npm start',
        status: 'running',
        pid: 5678
      };

      processSupervisorService.restartProcess.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/processes/proc1/restart');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(response.body.message).toBe('Process proc1 restarted successfully');
      expect(processSupervisorService.restartProcess).toHaveBeenCalledWith('proc1');
    });

    it('should handle missing process ID', async () => {
      const response = await request(app)
        .post('/processes//restart');

      expect(response.status).toBe(404); // Express handles this as not found
    });

    it('should handle errors when restarting process', async () => {
      processSupervisorService.restartProcess.mockRejectedValue(new Error('Process not found'));

      const response = await request(app)
        .post('/processes/nonexistent/restart');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to restart process');
      expect(response.body.message).toBe('Process not found');
      expect(logger.error).toHaveBeenCalledWith('Error restarting process:', expect.any(Error));
    });
  });

  describe('getStatus', () => {
    it('should return supervisor status successfully', async () => {
      const mockStatus = {
        totalProcesses: 5,
        runningProcesses: 3,
        stoppedProcesses: 2,
        uptime: 3600
      };

      processSupervisorService.getStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/processes/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });

    it('should handle errors when getting status', async () => {
      processSupervisorService.getStatus.mockImplementation(() => {
        throw new Error('Status unavailable');
      });

      const response = await request(app)
        .get('/processes/status');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get status');
      expect(response.body.message).toBe('Status unavailable');
      expect(logger.error).toHaveBeenCalledWith('Error getting process supervisor status:', expect.any(Error));
    });
  });

  describe('getProcess', () => {
    it('should return a specific process successfully', async () => {
      const mockProcesses = [
        { id: 'proc1', command: 'npm start', status: 'running' },
        { id: 'proc2', command: 'node server.js', status: 'stopped' }
      ];

      processSupervisorService.getProcesses.mockResolvedValue(mockProcesses);

      const response = await request(app)
        .get('/processes/proc1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProcesses[0]);
    });

    it('should return 404 if process not found', async () => {
      const mockProcesses = [
        { id: 'proc1', command: 'npm start', status: 'running' }
      ];

      processSupervisorService.getProcesses.mockResolvedValue(mockProcesses);

      const response = await request(app)
        .get('/processes/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Process not found');
    });

    it('should handle errors when getting a specific process', async () => {
      processSupervisorService.getProcesses.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/processes/proc1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get process');
      expect(response.body.message).toBe('Service error');
      expect(logger.error).toHaveBeenCalledWith('Error getting process:', expect.any(Error));
    });
  });
});