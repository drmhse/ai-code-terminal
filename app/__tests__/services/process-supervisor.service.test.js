// Mock Prisma client with comprehensive methods
const mockPrismaClient = {
  userProcess: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn()
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient)
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    pid: 12345,
    kill: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock('../../src/utils/logger');

const { spawn } = require('child_process');
const logger = require('../../src/utils/logger');

describe('ProcessSupervisorService', () => {
  let processSupervisorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Fresh require
    delete require.cache[require.resolve('../../src/services/process-supervisor.service')];
    processSupervisorService = require('../../src/services/process-supervisor.service');
    
    await processSupervisorService.stop();
    processSupervisorService.processes.clear();
  });

  afterEach(async () => {
    await processSupervisorService.stop();
  });

  describe('start', () => {
    it('should start the supervisor', async () => {
      mockPrismaClient.userProcess.findMany.mockResolvedValue([]);
      
      await processSupervisorService.start();
      
      expect(processSupervisorService.isRunning).toBe(true);
    });
  });

  describe('trackProcess', () => {
    it('should track a process', async () => {
      const mockRecord = { id: 'proc1', pid: 12345 };
      mockPrismaClient.userProcess.create.mockResolvedValue(mockRecord);
      
      const result = await processSupervisorService.trackProcess('echo', ['hello']);
      
      expect(result.pid).toBe(12345);
      expect(result.id).toBe('proc1');
    });

    it('should handle spawn failure', async () => {
      spawn.mockReturnValueOnce({ pid: null });
      
      await expect(
        processSupervisorService.trackProcess('invalid')
      ).rejects.toThrow('Failed to start process - no PID assigned');
    });
  });

  describe('stopProcess', () => {
    it('should stop a process', async () => {
      const mockRecord = { id: 'proc1', pid: 12345 };
      mockPrismaClient.userProcess.findUnique.mockResolvedValue(mockRecord);
      
      await processSupervisorService.stopProcess('proc1');
      
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc1' },
        data: { status: 'killed', endedAt: expect.any(Date) }
      });
    });
  });

  describe('getProcesses', () => {
    it('should return processes', async () => {
      const mockProcesses = [{ id: 'proc1', command: 'echo' }];
      mockPrismaClient.userProcess.findMany.mockResolvedValue(mockProcesses);
      
      const result = await processSupervisorService.getProcesses();
      
      expect(result).toEqual(mockProcesses);
    });
  });

  describe('isProcessAlive', () => {
    it('should check if process is alive', () => {
      const killSpy = jest.spyOn(process, 'kill');
      killSpy.mockImplementation(() => true);
      
      const result = processSupervisorService.isProcessAlive(123);
      
      expect(result).toBe(true);
      killSpy.mockRestore();
    });

    it('should return false for dead process', () => {
      const killSpy = jest.spyOn(process, 'kill');
      killSpy.mockImplementation(() => { throw new Error('ESRCH'); });
      
      const result = processSupervisorService.isProcessAlive(123);
      
      expect(result).toBe(false);
      killSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    it('should return status', () => {
      const status = processSupervisorService.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('trackedProcesses');
      expect(status).toHaveProperty('monitoringActive');
    });
  });

  describe('stop', () => {
    it('should stop the supervisor', async () => {
      mockPrismaClient.userProcess.updateMany.mockResolvedValue({ count: 2 });
      
      processSupervisorService.isRunning = true;
      processSupervisorService.monitoringInterval = setInterval(() => {}, 1000);
      
      await processSupervisorService.stop();
      
      expect(processSupervisorService.isRunning).toBe(false);
      expect(processSupervisorService.monitoringInterval).toBeNull();
      expect(mockPrismaClient.userProcess.updateMany).toHaveBeenCalledWith({
        where: { status: 'running' },
        data: { status: 'stopped', endedAt: expect.any(Date) }
      });
    });

    it('should handle already stopped supervisor', async () => {
      processSupervisorService.isRunning = false;
      
      await processSupervisorService.stop();
      
      expect(mockPrismaClient.userProcess.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring interval', () => {
      processSupervisorService.startMonitoring();
      
      expect(processSupervisorService.monitoringInterval).toBeTruthy();
    });

    it('should setup monitoring function', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      processSupervisorService.startMonitoring();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
      setIntervalSpy.mockRestore();
    });
  });

  describe('setupProcessHandlers', () => {
    it('should set up exit handler with normal exit', async () => {
      const mockProcess = { pid: 12345, on: jest.fn() };
      const mockRecord = { id: 'proc1', autoRestart: false };
      
      processSupervisorService.processes.set(12345, { record: mockRecord });
      mockPrismaClient.userProcess.update.mockResolvedValue({});
      
      processSupervisorService.setupProcessHandlers(mockProcess, mockRecord);
      
      // Get the exit handler function
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      
      await exitHandler(0, 'SIGTERM');
      
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc1' },
        data: {
          status: 'stopped',
          exitCode: 0,
          endedAt: expect.any(Date)
        }
      });
      expect(processSupervisorService.processes.has(12345)).toBe(false);
    });

    it('should set up exit handler with crash and auto-restart', async () => {
      const mockProcess = { pid: 12345, on: jest.fn() };
      const mockRecord = { id: 'proc1', autoRestart: true };
      
      processSupervisorService.processes.set(12345, { record: mockRecord });
      mockPrismaClient.userProcess.update.mockResolvedValue({});
      jest.spyOn(processSupervisorService, 'restartProcess').mockResolvedValue();
      
      processSupervisorService.setupProcessHandlers(mockProcess, mockRecord);
      
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      
      await exitHandler(1, null);
      
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc1' },
        data: {
          status: 'crashed',
          exitCode: 1,
          endedAt: expect.any(Date)
        }
      });
      expect(processSupervisorService.restartProcess).toHaveBeenCalledWith('proc1');
    });

    it('should set up error handler', async () => {
      const mockProcess = { pid: 12345, on: jest.fn() };
      const mockRecord = { id: 'proc1' };
      
      mockPrismaClient.userProcess.update.mockResolvedValue({});
      
      processSupervisorService.setupProcessHandlers(mockProcess, mockRecord);
      
      const errorHandler = mockProcess.on.mock.calls.find(call => call[0] === 'error')[1];
      
      await errorHandler(new Error('Process error'));
      
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc1' },
        data: {
          status: 'crashed',
          endedAt: expect.any(Date)
        }
      });
    });

    it('should handle database errors in exit handler', async () => {
      const mockProcess = { pid: 12345, on: jest.fn() };
      const mockRecord = { id: 'proc1', autoRestart: false };
      
      processSupervisorService.processes.set(12345, { record: mockRecord });
      mockPrismaClient.userProcess.update.mockRejectedValue(new Error('DB error'));
      
      processSupervisorService.setupProcessHandlers(mockProcess, mockRecord);
      
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      
      await exitHandler(0, 'SIGTERM');
      
      expect(logger.error).toHaveBeenCalledWith('Error handling process exit for PID 12345:', expect.any(Error));
    });
  });


  describe('checkProcessHealth', () => {
    it('should mark dead processes as crashed', async () => {
      const mockProcesses = [
        { id: 'proc1', pid: 12345 },
        { id: 'proc2', pid: 54321 }
      ];
      
      mockPrismaClient.userProcess.findMany.mockResolvedValue(mockProcesses);
      mockPrismaClient.userProcess.update.mockResolvedValue({});
      
      jest.spyOn(processSupervisorService, 'isProcessAlive')
        .mockReturnValueOnce(false) // proc1 is dead
        .mockReturnValueOnce(true);  // proc2 is alive
      
      await processSupervisorService.checkProcessHealth();
      
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc1' },
        data: {
          status: 'crashed',
          endedAt: expect.any(Date)
        }
      });
      
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc2' },
        data: {
          lastSeen: expect.any(Date)
        }
      });
    });
  });

  describe('cleanupDeadProcesses', () => {
    it('should cleanup old process records', async () => {
      const mockResult = { count: 5 };
      mockPrismaClient.userProcess.deleteMany.mockResolvedValue(mockResult);
      
      await processSupervisorService.cleanupDeadProcesses();
      
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
              endedAt: {
                lt: expect.any(Date)
              }
            }
          ]
        }
      });
      
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 5 old process records');
    });

    it('should not log when no processes cleaned', async () => {
      const mockResult = { count: 0 };
      mockPrismaClient.userProcess.deleteMany.mockResolvedValue(mockResult);
      
      await processSupervisorService.cleanupDeadProcesses();
      
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned up'));
    });
  });

  describe('restoreProcesses', () => {
    it('should restore running processes and restart failed ones', async () => {
      const mockProcesses = [
        { id: 'proc1', pid: 12345, autoRestart: false },
        { id: 'proc2', pid: 54321, autoRestart: true },
        { id: 'proc3', pid: 99999, autoRestart: false }
      ];
      
      mockPrismaClient.userProcess.findMany.mockResolvedValue(mockProcesses);
      mockPrismaClient.userProcess.update.mockResolvedValue({});
      const restartSpy = jest.spyOn(processSupervisorService, 'restartProcess').mockResolvedValue();
      
      jest.spyOn(processSupervisorService, 'isProcessAlive')
        .mockReturnValueOnce(true)  // proc1 is alive
        .mockReturnValueOnce(false) // proc2 is dead (will restart)
        .mockReturnValueOnce(false); // proc3 is dead (no restart)
      
      await processSupervisorService.restoreProcesses();
      
      // Check that dead processes are marked as crashed
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc2' },
        data: {
          status: 'crashed',
          endedAt: expect.any(Date)
        }
      });
      
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc3' },
        data: {
          status: 'crashed',
          endedAt: expect.any(Date)
        }
      });
      
      expect(restartSpy).toHaveBeenCalledWith('proc2');
      expect(restartSpy).not.toHaveBeenCalledWith('proc3');
    });

    it('should handle restore errors gracefully', async () => {
      mockPrismaClient.userProcess.findMany.mockRejectedValue(new Error('Restore error'));
      
      await processSupervisorService.restoreProcesses();
      
      expect(logger.error).toHaveBeenCalledWith('Error restoring processes:', expect.any(Error));
    });
  });

  describe('updateAllProcessesStatus', () => {
    it('should update all running processes', async () => {
      const mockResult = { count: 3 };
      mockPrismaClient.userProcess.updateMany.mockResolvedValue(mockResult);
      
      await processSupervisorService.updateAllProcessesStatus('stopped');
      
      expect(mockPrismaClient.userProcess.updateMany).toHaveBeenCalledWith({
        where: { status: 'running' },
        data: {
          status: 'stopped',
          endedAt: expect.any(Date)
        }
      });
      
      expect(logger.info).toHaveBeenCalledWith('Updated 3 running processes to status: stopped');
    });

    it('should handle update errors', async () => {
      mockPrismaClient.userProcess.updateMany.mockRejectedValue(new Error('Update error'));
      
      await processSupervisorService.updateAllProcessesStatus('crashed');
      
      expect(logger.error).toHaveBeenCalledWith('Error updating process statuses:', expect.any(Error));
    });
  });

  describe('error handling scenarios', () => {
    it('should handle start errors', async () => {
      processSupervisorService.isRunning = true;
      
      await processSupervisorService.start();
      
      expect(logger.warn).toHaveBeenCalledWith('Process supervisor already running');
    });


    it('should handle stopProcess not found', async () => {
      mockPrismaClient.userProcess.findUnique.mockResolvedValue(null);
      
      await expect(processSupervisorService.stopProcess('nonexistent'))
        .rejects.toThrow('Process nonexistent not found');
    });

    it('should handle stopProcess database error', async () => {
      const mockRecord = { id: 'proc1', pid: 12345 };
      mockPrismaClient.userProcess.findUnique.mockResolvedValue(mockRecord);
      mockPrismaClient.userProcess.update.mockRejectedValue(new Error('DB error'));
      
      await expect(processSupervisorService.stopProcess('proc1'))
        .rejects.toThrow('DB error');
    });

    it('should handle getProcesses database error', async () => {
      mockPrismaClient.userProcess.findMany.mockRejectedValue(new Error('DB error'));
      
      await expect(processSupervisorService.getProcesses())
        .rejects.toThrow('DB error');
      
      expect(logger.error).toHaveBeenCalledWith('Error getting processes:', expect.any(Error));
    });

    it('should handle force kill timeout logic', async () => {
      const mockRecord = { id: 'proc1', pid: 12345 };
      const mockProcess = { kill: jest.fn() };
      
      mockPrismaClient.userProcess.findUnique.mockResolvedValue(mockRecord);
      mockPrismaClient.userProcess.update.mockResolvedValue({});
      
      processSupervisorService.processes.set(12345, { process: mockProcess });
      
      await processSupervisorService.stopProcess('proc1');
      
      // Verify initial SIGTERM was sent
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Verify database was updated
      expect(mockPrismaClient.userProcess.update).toHaveBeenCalledWith({
        where: { id: 'proc1' },
        data: { status: 'killed', endedAt: expect.any(Date) }
      });
    });
  });
});