import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { EventEmitter } from 'events';

// Mock dependencies
const mockPrismaClient = {
  workspace: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('@/config/database', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock child_process for git operations
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

// Mock fs operations
const mockFs = {
  promises: {
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    rm: vi.fn(),
  },
};
vi.mock('fs', () => mockFs);

describe('WorkspaceService', () => {
  let WorkspaceService;
  let workspaceService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all mock functions
    Object.values(mockPrismaClient.workspace).forEach(mock => mock.mockReset());
    Object.values(mockFs.promises).forEach(mock => mock.mockReset());

    // Import service after mocks are set up
    const module = await import('@/services/workspace.service.js');
    WorkspaceService = module.default.constructor;
    workspaceService = new WorkspaceService();
  });

  describe('listWorkspaces', () => {
    it('should return all active workspaces by default', async () => {
      const mockWorkspaces = [
        {
          id: 'workspace-1',
          name: 'test-repo',
          githubRepo: 'user/test-repo',
          githubUrl: 'https://github.com/user/test-repo',
          localPath: '/workspaces/test-repo',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await workspaceService.listWorkspaces();

      expect(mockPrismaClient.workspace.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(mockWorkspaces);
    });

    it('should return all workspaces when includeInactive is true', async () => {
      const mockWorkspaces = [
        {
          id: 'workspace-1',
          name: 'active-repo',
          isActive: true,
        },
        {
          id: 'workspace-2',
          name: 'inactive-repo',
          isActive: false,
        },
      ];

      mockPrismaClient.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await workspaceService.listWorkspaces(true);

      expect(mockPrismaClient.workspace.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(mockWorkspaces);
    });

    it('should handle database errors', async () => {
      mockPrismaClient.workspace.findMany.mockRejectedValue(new Error('Database error'));

      await expect(workspaceService.listWorkspaces()).rejects.toThrow(
        'Failed to list workspaces'
      );
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace by ID', async () => {
      const mockWorkspace = {
        id: 'workspace-1',
        name: 'test-repo',
        githubRepo: 'user/test-repo',
        isActive: true,
      };

      mockPrismaClient.workspace.findUnique.mockResolvedValue(mockWorkspace);

      const result = await workspaceService.getWorkspace('workspace-1');

      expect(mockPrismaClient.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
      });
      expect(result).toEqual(mockWorkspace);
    });

    it('should return null for non-existent workspace', async () => {
      mockPrismaClient.workspace.findUnique.mockResolvedValue(null);

      const result = await workspaceService.getWorkspace('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPrismaClient.workspace.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(workspaceService.getWorkspace('workspace-1')).rejects.toThrow(
        'Failed to get workspace'
      );
    });
  });

  describe('createWorkspace', () => {
    it('should create a new workspace successfully', async () => {
      const repoData = {
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
      };

      const mockWorkspace = {
        id: 'workspace-1',
        name: 'test-repo',
        githubRepo: 'user/test-repo',
        githubUrl: 'https://github.com/user/test-repo',
        localPath: path.resolve(process.cwd(), 'workspaces', 'test-repo'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.workspace.findFirst.mockResolvedValue(null); // No existing workspace
      mockPrismaClient.workspace.create.mockResolvedValue(mockWorkspace);

      const result = await workspaceService.createWorkspace(repoData);

      expect(mockPrismaClient.workspace.findFirst).toHaveBeenCalledWith({
        where: { githubRepo: 'user/test-repo' },
      });
      expect(mockPrismaClient.workspace.create).toHaveBeenCalledWith({
        data: {
          name: 'test-repo',
          githubRepo: 'user/test-repo',
          githubUrl: 'https://github.com/user/test-repo',
          localPath: path.resolve(process.cwd(), 'workspaces', 'test-repo'),
        },
      });
      expect(result).toEqual(mockWorkspace);
    });

    it('should throw error if workspace already exists', async () => {
      const repoData = {
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
      };

      const existingWorkspace = {
        id: 'existing-workspace',
        githubRepo: 'user/test-repo',
        isActive: true,
      };

      mockPrismaClient.workspace.findFirst.mockResolvedValue(existingWorkspace);

      await expect(workspaceService.createWorkspace(repoData)).rejects.toThrow(
        'Workspace already exists for this repository'
      );
    });

    it('should reactivate inactive workspace', async () => {
      const repoData = {
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
      };

      const inactiveWorkspace = {
        id: 'inactive-workspace',
        githubRepo: 'user/test-repo',
        isActive: false,
      };

      const reactivatedWorkspace = {
        ...inactiveWorkspace,
        isActive: true,
        updatedAt: new Date(),
      };

      mockPrismaClient.workspace.findFirst.mockResolvedValue(inactiveWorkspace);
      mockPrismaClient.workspace.update.mockResolvedValue(reactivatedWorkspace);

      const result = await workspaceService.createWorkspace(repoData);

      expect(mockPrismaClient.workspace.update).toHaveBeenCalledWith({
        where: { id: 'inactive-workspace' },
        data: { isActive: true },
      });
      expect(result).toEqual(reactivatedWorkspace);
    });
  });

  describe('validateRepositoryName', () => {
    it('should validate correct repository names', () => {
      const validNames = [
        'user/repo',
        'organization/project-name',
        'github-user/my_repository',
        'org123/repo-123',
      ];

      validNames.forEach(name => {
        expect(() => workspaceService.validateRepositoryName(name)).not.toThrow();
      });
    });

    it('should reject invalid repository names', () => {
      const invalidNames = [
        'invalid',           // No slash
        'user/',            // No repo name
        '/repo',            // No user name
        'user/repo/extra',  // Too many parts
        'us er/repo',       // Space in user
        'user/re po',       // Space in repo
        '',                 // Empty string
        'user//repo',       // Double slash
      ];

      invalidNames.forEach(name => {
        expect(() => workspaceService.validateRepositoryName(name)).toThrow(
          'Invalid repository name format'
        );
      });
    });
  });

  describe('generateLocalPath', () => {
    it('should generate correct local path for repository', () => {
      const repoName = 'test-repo';
      const expectedPath = path.resolve(process.cwd(), 'workspaces', repoName);

      const result = workspaceService.generateLocalPath(repoName);

      expect(result).toBe(expectedPath);
    });

    it('should sanitize repository names for file system', () => {
      const repoName = 'test repo with spaces';
      const expectedPath = path.resolve(process.cwd(), 'workspaces', 'test-repo-with-spaces');

      const result = workspaceService.generateLocalPath(repoName);

      expect(result).toBe(expectedPath);
    });
  });

  describe('deleteWorkspace', () => {
    it('should soft delete workspace by default', async () => {
      const workspaceId = 'workspace-1';
      const updatedWorkspace = {
        id: workspaceId,
        isActive: false,
        updatedAt: new Date(),
      };

      mockPrismaClient.workspace.update.mockResolvedValue(updatedWorkspace);

      const result = await workspaceService.deleteWorkspace(workspaceId);

      expect(mockPrismaClient.workspace.update).toHaveBeenCalledWith({
        where: { id: workspaceId },
        data: { isActive: false },
      });
      expect(result).toEqual(updatedWorkspace);
    });

    it('should hard delete workspace when requested', async () => {
      const workspaceId = 'workspace-1';
      const mockWorkspace = {
        id: workspaceId,
        localPath: '/workspaces/test-repo',
      };

      mockPrismaClient.workspace.findUnique.mockResolvedValue(mockWorkspace);
      mockFs.promises.rm.mockResolvedValue();
      mockPrismaClient.workspace.delete.mockResolvedValue(mockWorkspace);

      const result = await workspaceService.deleteWorkspace(workspaceId, true);

      expect(mockFs.promises.rm).toHaveBeenCalledWith('/workspaces/test-repo', {
        recursive: true,
        force: true,
      });
      expect(mockPrismaClient.workspace.delete).toHaveBeenCalledWith({
        where: { id: workspaceId },
      });
      expect(result).toEqual(mockWorkspace);
    });
  });
});