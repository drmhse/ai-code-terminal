const fs = require('fs').promises;

// Mock fs and dependencies
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn()
  }
}));

jest.mock('../../src/config/constants', () => ({
  PATHS: {
    DATA_DIR: '/test/data',
    SESSIONS_DIR: '/test/data/sessions',
    WORKSPACES_DIR: '/test/workspaces'
  }
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const { initializeDirectories } = require('../../src/utils/init');
const logger = require('../../src/utils/logger');
const { PATHS } = require('../../src/config/constants');

describe('init utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeDirectories', () => {
    it('should create all required directories successfully', async () => {
      fs.mkdir.mockResolvedValue();

      await initializeDirectories();

      expect(fs.mkdir).toHaveBeenCalledTimes(3);
      expect(fs.mkdir).toHaveBeenCalledWith(PATHS.DATA_DIR, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(PATHS.SESSIONS_DIR, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(PATHS.WORKSPACES_DIR, { recursive: true });
      expect(logger.info).toHaveBeenCalledWith('Data directories initialized successfully');
    });

    it('should log error and throw when directory creation fails', async () => {
      const error = new Error('Permission denied');
      fs.mkdir.mockRejectedValue(error);

      await expect(initializeDirectories()).rejects.toThrow('Permission denied');

      expect(fs.mkdir).toHaveBeenCalledWith(PATHS.DATA_DIR, { recursive: true });
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize directories:', error);
    });

    it('should create directories in correct order', async () => {
      const mkdirCalls = [];
      fs.mkdir.mockImplementation((path) => {
        mkdirCalls.push(path);
        return Promise.resolve();
      });

      await initializeDirectories();

      expect(mkdirCalls).toEqual([
        PATHS.DATA_DIR,
        PATHS.SESSIONS_DIR,
        PATHS.WORKSPACES_DIR
      ]);
    });

    it('should handle partial failures gracefully', async () => {
      fs.mkdir
        .mockResolvedValueOnce() // DATA_DIR succeeds
        .mockRejectedValueOnce(new Error('Sessions dir error')) // SESSIONS_DIR fails
        .mockResolvedValueOnce(); // WORKSPACES_DIR would succeed but won't be reached

      await expect(initializeDirectories()).rejects.toThrow('Sessions dir error');

      expect(fs.mkdir).toHaveBeenCalledTimes(2); // Should stop after first failure
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize directories:', expect.any(Error));
    });

    it('should use recursive option for all directories', async () => {
      fs.mkdir.mockResolvedValue();

      await initializeDirectories();

      // Verify all calls used recursive: true
      expect(fs.mkdir).toHaveBeenCalledWith(PATHS.DATA_DIR, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(PATHS.SESSIONS_DIR, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(PATHS.WORKSPACES_DIR, { recursive: true });
    });

    it('should handle different types of filesystem errors', async () => {
      const testCases = [
        new Error('EACCES: permission denied'),
        new Error('ENOTDIR: not a directory'),
        new Error('EEXIST: file already exists'),
        new Error('ENOSPC: no space left on device')
      ];

      for (const error of testCases) {
        jest.clearAllMocks();
        fs.mkdir.mockRejectedValue(error);

        await expect(initializeDirectories()).rejects.toThrow(error.message);
        expect(logger.error).toHaveBeenCalledWith('Failed to initialize directories:', error);
      }
    });

    it('should work when directories already exist', async () => {
      // fs.mkdir with recursive: true should not throw if directory exists
      fs.mkdir.mockResolvedValue();

      await initializeDirectories();

      expect(fs.mkdir).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith('Data directories initialized successfully');
    });
  });

  describe('module exports', () => {
    it('should export initializeDirectories function', () => {
      const initModule = require('../../src/utils/init');
      
      expect(typeof initModule.initializeDirectories).toBe('function');
      expect(initModule.initializeDirectories).toBe(initializeDirectories);
    });
  });
});