const path = require('path');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/github.service');
jest.mock('../../src/services/settings.service');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    access: jest.fn(),
    writeFile: jest.fn(),
    rm: jest.fn()
  }
}));
jest.mock('child_process');

const { prisma } = require('../../src/config/database');
const logger = require('../../src/utils/logger');
const settingsService = require('.././../src/services/settings.service');
const { exec } = require('child_process');

const WorkspaceService = require('../../src/services/workspace.service');

describe('WorkspaceService', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock exec to simulate a successful callback for promisify
    exec.mockImplementation((command, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      callback(null, { stdout: 'mock stdout', stderr: '' });
    });

    // Set up default successful mocks for prisma
    prisma.workspace.findMany.mockResolvedValue([]);
    prisma.workspace.findUnique.mockResolvedValue(null);
    prisma.workspace.create.mockResolvedValue({});
    prisma.workspace.update.mockResolvedValue({});
    prisma.workspace.delete.mockResolvedValue({});
    prisma.session.updateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('listWorkspaces', () => {
    it('should return all workspaces when includeInactive is true', async () => {
      const mockWorkspaces = [
        { id: '1', name: 'workspace1', isActive: true },
        { id: '2', name: 'workspace2', isActive: false }
      ];

      prisma.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await WorkspaceService.listWorkspaces(true);

      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { updatedAt: 'desc' },
        include: {
          sessions: {
            where: { status: 'active' },
            select: { id: true, socketId: true, status: true, lastActivityAt: true }
          }
        }
      });
      expect(result).toEqual(mockWorkspaces);
    });

    it('should return only active workspaces when includeInactive is false', async () => {
      const mockWorkspaces = [
        { id: '1', name: 'workspace1', isActive: true }
      ];

      prisma.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await WorkspaceService.listWorkspaces(false);

      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        include: {
          sessions: {
            where: { status: 'active' },
            select: { id: true, socketId: true, status: true, lastActivityAt: true }
          }
        }
      });
      expect(result).toEqual(mockWorkspaces);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.workspace.findMany.mockRejectedValue(error);

      await expect(WorkspaceService.listWorkspaces()).rejects.toThrow('Failed to list workspaces');
      expect(logger.error).toHaveBeenCalledWith('Failed to list workspaces:', error);
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace by ID', async () => {
      const mockWorkspace = { id: '1', name: 'workspace1' };
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      const result = await WorkspaceService.getWorkspace('1');

      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          sessions: {
            where: { status: 'active' }
          }
        }
      });
      expect(result).toEqual(mockWorkspace);
    });

    it('should return null when workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      const result = await WorkspaceService.getWorkspace('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.workspace.findUnique.mockRejectedValue(error);
      const result = await WorkspaceService.getWorkspace('1');
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to get workspace:', error);
    });
  });

  describe('createWorkspace', () => {
    it('should create new workspace successfully', async () => {
      const githubRepo = 'user/test-repo';
      const githubUrl = 'https://github.com/user/test-repo.git';
      const expectedWorkspace = {
        id: '1',
        name: 'test-repo',
        githubRepo,
        githubUrl,
        localPath: expect.stringContaining('test-repo')
      };

      prisma.workspace.findUnique.mockResolvedValue(null);
      prisma.workspace.create.mockResolvedValue(expectedWorkspace);

      const result = await WorkspaceService.createWorkspace(githubRepo, githubUrl);

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: {
          name: 'test-repo',
          githubRepo,
          githubUrl,
          localPath: expect.stringContaining('test-repo')
        }
      });
      expect(result).toEqual(expectedWorkspace);
    });

    it('should throw error if active workspace already exists', async () => {
      const githubRepo = 'user/test-repo';
      const existingWorkspace = { id: '1', githubRepo, isActive: true };
      prisma.workspace.findUnique.mockResolvedValue(existingWorkspace);
      await expect(WorkspaceService.createWorkspace(githubRepo, 'url'))
        .rejects.toThrow('Workspace for user/test-repo already exists');
    });
  });

  describe('cloneRepository', () => {
    const mockWorkspace = {
      id: '1',
      githubRepo: 'user/test-repo',
      githubUrl: 'https://github.com/user/test-repo.git',
      localPath: '/workspaces/test-repo'
    };

    it('should clone repository successfully', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      settingsService.getGithubToken.mockResolvedValue('github-token');
      fs.access.mockRejectedValue(new Error('Directory not found'));

      const updatedWorkspace = { ...mockWorkspace, lastSyncAt: new Date() };
      prisma.workspace.update.mockResolvedValue(updatedWorkspace);

      const result = await WorkspaceService.cloneRepository('1');
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { lastSyncAt: expect.any(Date) }
      });
      expect(result).toEqual(updatedWorkspace);
    });

    it('should throw error if workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      await expect(WorkspaceService.cloneRepository('nonexistent'))
        .rejects.toThrow('Workspace not found');
    });
  });

  describe('syncWithGitHub', () => {
    const mockWorkspace = {
      id: '1',
      githubRepo: 'user/test-repo',
      localPath: '/workspaces/test-repo'
    };

    it('should sync repository successfully', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      fs.access.mockResolvedValue();

      const updatedWorkspace = { ...mockWorkspace, lastSyncAt: new Date() };
      prisma.workspace.update.mockResolvedValue(updatedWorkspace);

      const result = await WorkspaceService.syncWithGitHub('1');

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { lastSyncAt: expect.any(Date) }
      });
      expect(result).toEqual(updatedWorkspace);
    });
  });

  describe('deleteWorkspace', () => {
    const mockWorkspace = {
      id: '1',
      githubRepo: 'user/test-repo',
      localPath: '/workspaces/test-repo',
    };

    it('should delete workspace successfully (hard delete)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-01-01'));

      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      const result = await WorkspaceService.deleteWorkspace('1', false);

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { workspaceId: '1' },
        data: { status: 'terminated', endedAt: new Date() }
      });

      expect(prisma.workspace.delete).toHaveBeenCalledWith({
        where: { id: '1' }
      });

      expect(fs.rm).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle file deletion errors gracefully', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      fs.rm.mockRejectedValue(new Error('Permission denied'));

      const result = await WorkspaceService.deleteWorkspace('1', true);

      expect(logger.warn).toHaveBeenCalledWith(`Failed to delete workspace files for ${mockWorkspace.localPath}:`, expect.any(Error));
      expect(prisma.workspace.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toBe(true);
    });

    it('should throw error if workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      await expect(WorkspaceService.deleteWorkspace('nonexistent'))
        .rejects.toThrow('Workspace not found');
    });
  });
});
