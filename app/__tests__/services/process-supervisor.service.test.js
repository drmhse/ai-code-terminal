// Mock Prisma client
const mockPrismaClient = {
  userProcess: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
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
});