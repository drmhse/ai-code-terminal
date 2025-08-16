import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../mocks/prisma.js';
import '../../mocks/node-pty.js';
import { mockPrismaClient } from '../../mocks/prisma.js';
import { mockNodePty } from '../../mocks/node-pty.js';
import { EventEmitter } from 'events';

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock workspace service
const mockWorkspaceService = {
  getWorkspace: vi.fn(),
  listWorkspaces: vi.fn(),
  cloneRepository: vi.fn(),
};
vi.mock('@/services/workspace.service', () => ({ default: mockWorkspaceService }));

// Mock database config
vi.mock('@/config/database', () => ({
  prisma: mockPrismaClient,
}));

// Mock fs promises
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
  },
}));

describe('ShellService', () => {
  let ShellServiceClass;
  let shellService;
  let mockSocket;
  let mockWorkspace;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create mock socket
    mockSocket = new EventEmitter();
    mockSocket.id = 'test-socket-id';
    mockSocket.emit = vi.fn();

    // Create mock workspace
    mockWorkspace = {
      id: 'test-workspace-id',
      name: 'test-repo',
      localPath: '/test/workspace/path',
      createdAt: new Date(),
    };

    // Mock workspace service methods
    mockWorkspaceService.getWorkspace.mockResolvedValue(mockWorkspace);
    mockWorkspaceService.listWorkspaces.mockResolvedValue([mockWorkspace]);

    // Mock database responses
    mockPrismaClient.session.create.mockResolvedValue({
      id: 'test-session-id',
      shellPid: 12345,
      socketId: 'test-socket-id',
      status: 'active',
      workspaceId: 'test-workspace-id',
    });

    mockPrismaClient.session.findFirst.mockResolvedValue(null);
    mockPrismaClient.session.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaClient.session.update.mockResolvedValue({});
    mockPrismaClient.session.findMany.mockResolvedValue([]);

    // Import ShellService class and create fresh instance
    const module = await import('@/services/shell.service.js');
    ShellServiceClass = module.default.constructor;
    shellService = new ShellServiceClass();
  });

  afterEach(() => {
    if (shellService.cleanupInterval) {
      clearInterval(shellService.cleanupInterval);
    }
  });

  describe('createPtyForSocket', () => {
    it('should create a new PTY session when no workspace ID is provided', async () => {
      await shellService.createPtyForSocket(mockSocket);

      expect(mockWorkspaceService.listWorkspaces).toHaveBeenCalled();
      expect(mockNodePty.spawn).toHaveBeenCalledWith('bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: mockWorkspace.localPath,
        env: process.env,
      });
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal-output',
        expect.stringContaining('Connected to workspace: test-repo')
      );
    });

    it('should create a PTY session for specific workspace', async () => {
      // Mock fs.access to succeed
      const fs = await import('fs');
      fs.promises.access.mockResolvedValue();

      await shellService.createPtyForSocket(mockSocket, 'test-workspace-id');

      expect(mockWorkspaceService.getWorkspace).toHaveBeenCalledWith('test-workspace-id');
      expect(mockNodePty.spawn).toHaveBeenCalled();
      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: {
          shellPid: 12345,
          socketId: 'test-socket-id',
          status: 'active',
          workspaceId: 'test-workspace-id',
          lastActivityAt: expect.any(Date),
        },
      });
    });

    it('should handle workspace not found error', async () => {
      mockWorkspaceService.getWorkspace.mockResolvedValue(null);

      await shellService.createPtyForSocket(mockSocket, 'invalid-workspace-id');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal-output',
        '\r\nError: Workspace not found.\r\n'
      );
      expect(mockNodePty.spawn).not.toHaveBeenCalled();
    });

    it('should clone repository if workspace directory does not exist', async () => {
      const fs = await import('fs');
      fs.promises.access.mockRejectedValue(new Error('ENOENT'));
      mockWorkspaceService.cloneRepository.mockResolvedValue();

      await shellService.createPtyForSocket(mockSocket, 'test-workspace-id');

      expect(mockWorkspaceService.cloneRepository).toHaveBeenCalledWith('test-workspace-id');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal-output',
        '\r\nWorkspace directory not found. Cloning repository...\r\n'
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal-output',
        '\r\nRepository cloned successfully.\r\n'
      );
    });

    it('should handle no workspaces available', async () => {
      mockWorkspaceService.listWorkspaces.mockResolvedValue([]);

      await shellService.createPtyForSocket(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal-output',
        '\r\nNo workspace found. Please select or clone a repository first.\r\n'
      );
      expect(mockNodePty.spawn).not.toHaveBeenCalled();
    });
  });

  describe('writeToPty', () => {
    it('should write data to PTY process', async () => {
      await shellService.createPtyForSocket(mockSocket, 'test-workspace-id');
      const session = shellService.activeSessions.get('test-workspace-id');
      const writeSpy = vi.spyOn(session.ptyProcess, 'write');

      shellService.writeToPty('test-socket-id', 'ls -la\n');

      expect(writeSpy).toHaveBeenCalledWith('ls -la\n');
    });

    it('should handle writing to non-existent session', () => {
      const loggerWarn = vi.fn();
      shellService.writeToPty('invalid-socket-id', 'test data');

      // Should not throw error, just log warning
      expect(() => shellService.writeToPty('invalid-socket-id', 'test data')).not.toThrow();
    });
  });

  describe('resizePty', () => {
    it('should resize PTY process', async () => {
      await shellService.createPtyForSocket(mockSocket, 'test-workspace-id');
      const session = shellService.activeSessions.get('test-workspace-id');
      const resizeSpy = vi.spyOn(session.ptyProcess, 'resize');

      shellService.resizePty('test-socket-id', 120, 40);

      expect(resizeSpy).toHaveBeenCalledWith(120, 40);
    });
  });

  describe('handleSocketDisconnect', () => {
    it('should detach socket from session but keep process alive', async () => {
      await shellService.createPtyForSocket(mockSocket, 'test-workspace-id');

      await shellService.handleSocketDisconnect('test-socket-id');

      const session = shellService.activeSessions.get('test-workspace-id');
      expect(session.sockets.has('test-socket-id')).toBe(false);
      expect(shellService.socketToWorkspace.has('test-socket-id')).toBe(false);
      expect(mockPrismaClient.session.updateMany).toHaveBeenCalledWith({
        where: { workspaceId: 'test-workspace-id', status: 'active' },
        data: {
          socketId: null,
          lastActivityAt: expect.any(Date),
        },
      });
    });
  });

  describe('killSession', () => {
    it('should kill session and clean up resources', async () => {
      await shellService.createPtyForSocket(mockSocket, 'test-workspace-id');
      const session = shellService.activeSessions.get('test-workspace-id');
      const killSpy = vi.spyOn(session.ptyProcess, 'kill');

      await shellService.killSession('test-workspace-id');

      expect(killSpy).toHaveBeenCalledWith('SIGTERM');
      expect(shellService.activeSessions.has('test-workspace-id')).toBe(false);
      expect(mockPrismaClient.session.updateMany).toHaveBeenCalledWith({
        where: { workspaceId: 'test-workspace-id', status: 'active' },
        data: { status: 'terminated', endedAt: expect.any(Date) },
      });
    });
  });

  describe('getSessionInfo', () => {
    it('should return session information for socket', async () => {
      await shellService.createPtyForSocket(mockSocket, 'test-workspace-id');

      const info = shellService.getSessionInfo('test-socket-id');

      expect(info).toEqual({
        workspace: mockWorkspace,
        isAlive: true,
        connectedSockets: 1,
      });
    });

    it('should return null for invalid socket', () => {
      const info = shellService.getSessionInfo('invalid-socket-id');
      expect(info).toBeNull();
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      await shellService.createPtyForSocket(mockSocket, 'test-workspace-id');

      const stats = shellService.getSessionStats();

      expect(stats).toEqual({
        totalSessions: 1,
        sessions: [
          {
            workspaceId: 'test-workspace-id',
            workspace: 'test-repo',
            pid: 12345,
            connectedSockets: 1,
          },
        ],
      });
    });
  });

  describe('isProcessAlive', () => {
    it('should return true for alive process', () => {
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => {});
      
      const result = shellService.isProcessAlive(12345);
      
      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 0);
      
      mockKill.mockRestore();
    });

    it('should return false for dead process', () => {
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });
      
      const result = shellService.isProcessAlive(99999);
      
      expect(result).toBe(false);
      
      mockKill.mockRestore();
    });
  });

  describe('addToBuffer', () => {
    it('should add data to session buffer', () => {
      const sessionData = { outputBuffer: [] };
      
      shellService.addToBuffer(sessionData, 'test data 1');
      shellService.addToBuffer(sessionData, 'test data 2');
      
      expect(sessionData.outputBuffer).toEqual(['test data 1', 'test data 2']);
    });

    it('should trim buffer when it exceeds max size', () => {
      const sessionData = { outputBuffer: [] };
      shellService.MAX_BUFFER_SIZE = 20; // Small buffer for testing
      
      // Add data that exceeds buffer size
      for (let i = 0; i < 10; i++) {
        shellService.addToBuffer(sessionData, 'test data ' + i);
      }
      
      expect(sessionData.outputBuffer.length).toBeLessThan(10);
    });
  });
});