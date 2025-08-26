describe('Process Utility', () => {
  let processUtil;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('child_process', () => ({
      spawn: jest.fn(() => ({
        on: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 1234,
        kill: jest.fn(),
      }))
    }));
    child_process = require('child_process');
    processUtil = require('../../src/utils/process');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.unmock('child_process');
  });

  describe('spawnProcess', () => {
    it('should spawn a process successfully', () => {
      const mockProcess = {
        on: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 1234
      };
      
      child_process.spawn.mockReturnValue(mockProcess);
      
      const result = processUtil.spawnProcess('node', ['--version']);
      
      expect(child_process.spawn).toHaveBeenCalledWith('node', ['--version'], expect.objectContaining({
        stdio: ['pipe', 'pipe', 'pipe']
      }));
      
      expect(result).toHaveProperty('process');
      expect(result).toHaveProperty('processId');
      expect(result.process).toBe(mockProcess);
    });

    it('should spawn a process with options', () => {
      const mockProcess = {
        on: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 1234
      };
      
      child_process.spawn.mockReturnValue(mockProcess);
      
      const options = { cwd: '/tmp' };
      const result = processUtil.spawnProcess('node', ['--version'], options);
      
      expect(child_process.spawn).toHaveBeenCalledWith('node', ['--version'], expect.objectContaining({
        cwd: '/tmp',
        stdio: ['pipe', 'pipe', 'pipe']
      }));
      
      expect(result).toHaveProperty('process');
      expect(result).toHaveProperty('processId');
    });
  });

  describe('isProcessRunning', () => {
    it('should return false for null process', () => {
      expect(processUtil.isProcessRunning(null)).toBe(false);
    });

    it('should return false for killed process', () => {
      const mockProcess = { killed: true };
      expect(processUtil.isProcessRunning(mockProcess)).toBe(false);
    });

    it('should return true for running process', () => {
      const mockProcess = { killed: false, exitCode: null };
      expect(processUtil.isProcessRunning(mockProcess)).toBe(true);
    });
  });

  describe('getProcessInfo', () => {
    it('should return null for null process', () => {
      expect(processUtil.getProcessInfo(null)).toBeNull();
    });

    it('should return process info', () => {
      const mockProcess = {
        pid: 1234,
        killed: false,
        exitCode: null,
        signalCode: null
      };
      
      const info = processUtil.getProcessInfo(mockProcess);
      
      expect(info).toEqual({
        pid: 1234,
        killed: false,
        exitCode: null,
        signalCode: null
      });
    });
  });
});