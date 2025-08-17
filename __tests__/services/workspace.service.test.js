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
jest.mock('util', () => ({
  promisify: jest.fn().mockImplementation((fn) => fn)
}));

const { prisma } = require('../../src/config/database');
const logger = require('../../src/utils/logger');
const GitHubService = require('../../src/services/github.service');
const settingsService = require('../../src/services/settings.service');
const child_process = require('child_process');
const { promisify } = require('util');

const WorkspaceService = require('../../src/services/workspace.service');

describe('WorkspaceService', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock promisify
    promisify.mockImplementation((fn) => fn);
    
    // Set up default successful mocks
    prisma.workspace.findMany.mockResolvedValue([]);
    prisma.workspace.findUnique.mockResolvedValue(null);
    prisma.workspace.create.mockResolvedValue({});
    prisma.workspace.update.mockResolvedValue({});
    prisma.session.updateMany.mockResolvedValue({ count: 0 });
  });

  describe('listWorkspaces', () => {
    it('should return all workspaces when includeInactive is true', async () => {
      const mockWorkspaces = [
        { id: '1', name: 'workspace1', isActive: true },
        { id: '2', name: 'workspace2', isActive: false }
      ];
      
      const { prisma } = require('../../src/config/database');
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
      
      const { prisma } = require('../../src/config/database');
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
      const { prisma } = require('../../src/config/database');
      const loggerSpy = require('../../src/utils/logger');
      prisma.workspace.findMany.mockRejectedValue(error);

      await expect(WorkspaceService.listWorkspaces()).rejects.toThrow('Failed to list workspaces');
      expect(loggerSpy.error).toHaveBeenCalledWith('Failed to list workspaces:', error);
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace by ID', async () => {
      const mockWorkspace = { id: '1', name: 'workspace1' };
      const { prisma } = require('../../src/config/database');
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
      const { prisma } = require('../../src/config/database');
      prisma.workspace.findUnique.mockResolvedValue(null);

      const result = await WorkspaceService.getWorkspace('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      const { prisma } = require('../../src/config/database');
      const loggerSpy = require('../../src/utils/logger');
      prisma.workspace.findUnique.mockRejectedValue(error);

      const result = await WorkspaceService.getWorkspace('1');

      expect(result).toBeNull();
      expect(loggerSpy.error).toHaveBeenCalledWith('Failed to get workspace:', error);
    });
  });

  describe('createWorkspace', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

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

      prisma.workspace.findUnique.mockResolvedValue(null); // No existing workspace
      prisma.workspace.create.mockResolvedValue(expectedWorkspace);

      const result = await WorkspaceService.createWorkspace(githubRepo, githubUrl);

      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { githubRepo }
      });
      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: {
          name: 'test-repo',
          githubRepo,
          githubUrl,
          localPath: expect.stringContaining('test-repo')
        }
      });
      expect(result).toEqual(expectedWorkspace);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Workspace created'));
    });

    it('should throw error if active workspace already exists', async () => {
      const githubRepo = 'user/test-repo';
      const githubUrl = 'https://github.com/user/test-repo.git';
      const existingWorkspace = { id: '1', githubRepo, isActive: true };

      prisma.workspace.findUnique.mockResolvedValue(existingWorkspace);

      await expect(WorkspaceService.createWorkspace(githubRepo, githubUrl))
        .rejects.toThrow('Workspace for user/test-repo already exists');

      expect(prisma.workspace.create).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prisma.workspace.findUnique.mockRejectedValue(error);

      await expect(WorkspaceService.createWorkspace('user/repo', 'url'))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith('Failed to create workspace:', error);
    });
  });

  describe('cloneRepository', () => {
    const mockWorkspace = {
      id: '1',
      githubRepo: 'user/test-repo',
      githubUrl: 'https://github.com/user/test-repo.git',
      localPath: '/workspaces/test-repo'
    };

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock execAsync as a resolved promise
      const mockExecAsync = jest.fn().mockResolvedValue({ 
        stdout: 'Cloning into test-repo...', 
        stderr: 'Cloning into test-repo...' 
      });
      promisify.mockImplementation(() => mockExecAsync);
    });

    it('should clone repository successfully', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      settingsService.getGithubToken.mockResolvedValue('github-token');
      fs.mkdir.mockResolvedValue();
      fs.access.mockRejectedValue(new Error('Directory not found')); // Directory doesn't exist
      fs.writeFile.mockResolvedValue(); // For CLAUDE.md
      
      const updatedWorkspace = { ...mockWorkspace, lastSyncAt: new Date() };
      prisma.workspace.update.mockResolvedValue(updatedWorkspace);

      const result = await WorkspaceService.cloneRepository('1');

      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(settingsService.getGithubToken).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('workspaces'), { recursive: true });
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

    it('should throw error if GitHub token not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      settingsService.getGithubToken.mockResolvedValue(null);

      await expect(WorkspaceService.cloneRepository('1'))
        .rejects.toThrow('GitHub token not found for user');
    });

    it('should sync instead of clone if directory exists', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      settingsService.getGithubToken.mockResolvedValue('github-token');
      fs.mkdir.mockResolvedValue();
      fs.access.mockResolvedValue(); // Directory exists

      // Mock syncWithGitHub method
      const syncSpy = jest.spyOn(WorkspaceService, 'syncWithGitHub').mockResolvedValue(mockWorkspace);

      const result = await WorkspaceService.cloneRepository('1');

      expect(syncSpy).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockWorkspace);

      syncSpy.mockRestore();
    });
  });

  describe('syncWithGitHub', () => {
    const mockWorkspace = {
      id: '1',
      githubRepo: 'user/test-repo',
      localPath: '/workspaces/test-repo'
    };

    beforeEach(() => {
      jest.clearAllMocks();
      const mockExecAsync = jest.fn().mockResolvedValue({ 
        stdout: 'Already up to date.', 
        stderr: '' 
      });
      promisify.mockImplementation(() => mockExecAsync);
    });

    it('should sync repository successfully', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      fs.access.mockResolvedValue(); // Directory exists
      
      const updatedWorkspace = { ...mockWorkspace, lastSyncAt: new Date() };
      prisma.workspace.update.mockResolvedValue(updatedWorkspace);

      const result = await WorkspaceService.syncWithGitHub('1');

      expect(fs.access).toHaveBeenCalledWith('/workspaces/test-repo');
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { lastSyncAt: expect.any(Date) }
      });
      expect(result).toEqual(updatedWorkspace);
    });

    it('should clone if directory does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      fs.access.mockRejectedValue(new Error('Directory not found'));

      const cloneSpy = jest.spyOn(WorkspaceService, 'cloneRepository').mockResolvedValue(mockWorkspace);

      const result = await WorkspaceService.syncWithGitHub('1');

      expect(cloneSpy).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockWorkspace);

      cloneSpy.mockRestore();
    });

    it('should throw error if workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(WorkspaceService.syncWithGitHub('nonexistent'))
        .rejects.toThrow('Workspace not found');
    });
  });

  describe('deleteWorkspace', () => {
    const mockWorkspace = {
      id: '1',
      localPath: '/workspaces/test-repo',
      sessions: [{ id: 'session1', status: 'active' }]
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should delete workspace successfully', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.session.updateMany.mockResolvedValue({ count: 1 });
      prisma.workspace.update.mockResolvedValue({ ...mockWorkspace, isActive: false });

      const result = await WorkspaceService.deleteWorkspace('1', false);

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { workspaceId: '1', status: 'active' },
        data: { status: 'terminated', endedAt: expect.any(Date) }
      });
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false, updatedAt: expect.any(Date) }
      });
      expect(result).toBe(true);
    });

    it('should delete workspace and files', async () => {
      const workspaceWithoutSessions = { ...mockWorkspace, sessions: [] };
      prisma.workspace.findUnique.mockResolvedValue(workspaceWithoutSessions);
      prisma.workspace.update.mockResolvedValue({ ...workspaceWithoutSessions, isActive: false });
      fs.rm.mockResolvedValue();

      const result = await WorkspaceService.deleteWorkspace('1', true);

      expect(fs.rm).toHaveBeenCalledWith('/workspaces/test-repo', { recursive: true, force: true });
      expect(result).toBe(true);
    });

    it('should handle file deletion errors gracefully', async () => {
      const workspaceWithoutSessions = { ...mockWorkspace, sessions: [] };
      prisma.workspace.findUnique.mockResolvedValue(workspaceWithoutSessions);
      prisma.workspace.update.mockResolvedValue({ ...workspaceWithoutSessions, isActive: false });
      fs.rm.mockRejectedValue(new Error('Permission denied'));

      const result = await WorkspaceService.deleteWorkspace('1', true);

      expect(logger.warn).toHaveBeenCalledWith('Failed to delete workspace files:', expect.any(Error));
      expect(result).toBe(true); // Should still succeed
    });

    it('should throw error if workspace not found', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(WorkspaceService.deleteWorkspace('nonexistent'))
        .rejects.toThrow('Workspace not found');
    });
  });

  describe('getWorkspacePath', () => {
    it('should return absolute path', () => {
      const workspace = { localPath: '/workspaces/test-repo' };
      const result = WorkspaceService.getWorkspacePath(workspace);
      
      expect(result).toBe(path.resolve('/workspaces/test-repo'));
    });
  });

  describe('createClaudeMd', () => {
    const mockWorkspace = {
      githubRepo: 'user/test-repo',
      githubUrl: 'https://github.com/user/test-repo.git',
      localPath: '/workspaces/test-repo'
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create CLAUDE.md file successfully', async () => {
      fs.access.mockRejectedValue(new Error('File not found')); // File doesn't exist
      fs.writeFile.mockResolvedValue();

      await WorkspaceService.createClaudeMd(mockWorkspace);

      expect(fs.access).toHaveBeenCalledWith('/workspaces/test-repo/CLAUDE.md');
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/workspaces/test-repo/CLAUDE.md',
        expect.stringContaining('# CLAUDE.md'),
        'utf8'
      );
      expect(logger.info).toHaveBeenCalledWith('Created CLAUDE.md for user/test-repo');
    });

    it('should skip creation if CLAUDE.md already exists', async () => {
      fs.access.mockResolvedValue(); // File exists

      await WorkspaceService.createClaudeMd(mockWorkspace);

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('CLAUDE.md already exists in user/test-repo');
    });

    it('should handle write errors gracefully', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockRejectedValue(new Error('Write error'));

      await WorkspaceService.createClaudeMd(mockWorkspace);

      expect(logger.warn).toHaveBeenCalledWith('Failed to create CLAUDE.md:', expect.any(Error));
    });
  });

  describe('listUserWorkspaces (deprecated)', () => {
    it('should call listWorkspaces and log deprecation warning', async () => {
      const mockWorkspaces = [{ id: '1', name: 'test' }];
      prisma.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await WorkspaceService.listUserWorkspaces('userId', true);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
      expect(result).toEqual(mockWorkspaces);
    });
  });

  describe('getUserName (deprecated)', () => {
    it('should return tenant username and log deprecation warning', async () => {
      const originalEnv = process.env.TENANT_GITHUB_USERNAME;
      process.env.TENANT_GITHUB_USERNAME = 'test-user';

      const result = await WorkspaceService.getUserName('userId');

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
      expect(result).toBe('test-user');

      process.env.TENANT_GITHUB_USERNAME = originalEnv;
    });

    it('should return default if no tenant username set', async () => {
      const originalEnv = process.env.TENANT_GITHUB_USERNAME;
      delete process.env.TENANT_GITHUB_USERNAME;

      const result = await WorkspaceService.getUserName('userId');

      expect(result).toBe('single-user');

      process.env.TENANT_GITHUB_USERNAME = originalEnv;
    });
  });

  describe('cleanupInactiveWorkspaces', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should cleanup inactive workspaces successfully', async () => {
      const inactiveWorkspaces = [
        { id: '1', name: 'old-workspace-1' },
        { id: '2', name: 'old-workspace-2' }
      ];
      
      prisma.workspace.findMany.mockResolvedValue(inactiveWorkspaces);
      
      const deleteSpy = jest.spyOn(WorkspaceService, 'deleteWorkspace')
        .mockResolvedValue(true);

      const result = await WorkspaceService.cleanupInactiveWorkspaces(30);

      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          updatedAt: {
            lt: expect.any(Date)
          },
          sessions: {
            none: {
              status: 'active'
            }
          }
        }
      });
      expect(deleteSpy).toHaveBeenCalledTimes(2);
      expect(deleteSpy).toHaveBeenCalledWith('1', true);
      expect(deleteSpy).toHaveBeenCalledWith('2', true);
      expect(result).toBe(2);
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 2 inactive workspaces');

      deleteSpy.mockRestore();
    });

    it('should handle individual cleanup failures gracefully', async () => {
      const inactiveWorkspaces = [
        { id: '1', name: 'workspace-1' },
        { id: '2', name: 'workspace-2' }
      ];
      
      prisma.workspace.findMany.mockResolvedValue(inactiveWorkspaces);
      
      const deleteSpy = jest.spyOn(WorkspaceService, 'deleteWorkspace')
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Delete failed'));

      const result = await WorkspaceService.cleanupInactiveWorkspaces(30);

      expect(result).toBe(1); // Only one succeeded
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup workspace 2:',
        expect.any(Error)
      );

      deleteSpy.mockRestore();
    });

    it('should handle query errors gracefully', async () => {
      prisma.workspace.findMany.mockRejectedValue(new Error('Database error'));

      const result = await WorkspaceService.cleanupInactiveWorkspaces(30);

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup inactive workspaces:',
        expect.any(Error)
      );
    });
  });
});