// Mock all dependencies very aggressively before imports
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn()
  },
  constants: {
    R_OK: 4,
    W_OK: 2,
    F_OK: 0
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../src/services/workspace.service', () => ({
  getWorkspace: jest.fn().mockResolvedValue({
    id: 'workspace1',
    name: 'test-workspace'
  })
}));

const fs = require('fs').promises;
const { constants } = require('fs');
const FileSystemController = require('../../src/controllers/filesystem.controller');
const workspaceService = require('../../src/services/workspace.service');
const logger = require('../../src/utils/logger');

describe('FileSystemController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      params: { workspaceId: 'workspace1' },
      query: { path: '.' }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('getDirectoryContents', () => {
    it('should return 404 when workspace not found', async () => {
      workspaceService.getWorkspace.mockResolvedValue(null);

      await FileSystemController.getDirectoryContents(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workspace not found'
      });
    });

    it('should return 403 for path outside workspace', async () => {
      // Make sure workspace is found first
      workspaceService.getWorkspace.mockResolvedValue({
        id: 'workspace1',
        name: 'test-workspace'
      });
      req.query.path = '../../../etc/passwd';

      await FileSystemController.getDirectoryContents(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied: Path outside workspace'
      });
    });

    it('should return 404 when path not accessible', async () => {
      // Make sure workspace is found first
      workspaceService.getWorkspace.mockResolvedValue({
        id: 'workspace1',
        name: 'test-workspace'
      });
      fs.access.mockRejectedValue(new Error('ENOENT'));

      await FileSystemController.getDirectoryContents(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Path not found or not accessible'
      });
    });

    it('should return 400 when path is not a directory', async () => {
      // Make sure workspace is found first
      workspaceService.getWorkspace.mockResolvedValue({
        id: 'workspace1',
        name: 'test-workspace'
      });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ isDirectory: () => false });

      await FileSystemController.getDirectoryContents(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Path is not a directory'
      });
    });

    it('should handle service errors', async () => {
      workspaceService.getWorkspace.mockRejectedValue(new Error('Service error'));

      await FileSystemController.getDirectoryContents(req, res);

      expect(logger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getFileContents', () => {
    beforeEach(() => {
      req.query = { path: 'test.txt' };
    });

    it('should return 400 when path is missing', async () => {
      req.query = {};

      await FileSystemController.getFileContents(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'File path is required'
      });
    });

    it('should return 404 when workspace not found', async () => {
      workspaceService.getWorkspace.mockResolvedValue(null);

      await FileSystemController.getFileContents(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workspace not found'
      });
    });

    it('should return 400 when path is not a file', async () => {
      // Make sure workspace is found first
      workspaceService.getWorkspace.mockResolvedValue({
        id: 'workspace1',
        name: 'test-workspace'
      });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ isFile: () => false });

      await FileSystemController.getFileContents(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Path is not a file'
      });
    });

    it('should handle large files', async () => {
      // Make sure workspace is found first
      workspaceService.getWorkspace.mockResolvedValue({
        id: 'workspace1',
        name: 'test-workspace'
      });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({
        isFile: () => true,
        size: 2 * 1024 * 1024, // 2MB
        mtime: new Date()
      });

      await FileSystemController.getFileContents(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          content: null,
          truncated: true
        })
      );
    });
  });

  describe('getFileInfo', () => {
    beforeEach(() => {
      req.query = { path: 'test.txt' };
    });

    it('should return 400 when path is missing', async () => {
      req.query = {};

      await FileSystemController.getFileInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Path is required'
      });
    });

    it('should handle access errors', async () => {
      fs.access.mockRejectedValue(new Error('Permission denied'));

      await FileSystemController.getFileInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('isBinaryFile', () => {
    it('should detect binary files', () => {
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      const result = FileSystemController.isBinaryFile(binaryBuffer);
      
      expect(typeof result).toBe('boolean');
    });

    it('should handle text files', () => {
      const textBuffer = Buffer.from('Hello, world!', 'utf8');
      const result = FileSystemController.isBinaryFile(textBuffer);
      
      expect(typeof result).toBe('boolean');
    });
  });
});