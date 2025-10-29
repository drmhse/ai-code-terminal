// Mock all heavy dependencies BEFORE any imports
jest.mock('node-pty', () => ({
  spawn: jest.fn(() => ({
    pid: 1234,
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    exitCode: null
  }))
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
    writeFile: jest.fn().mockResolvedValue(),
    appendFile: jest.fn().mockResolvedValue()
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

jest.mock('../../src/services/workspace.service', () => ({
  getWorkspace: jest.fn().mockResolvedValue({
    id: 'workspace1',
    name: 'test-workspace',
    path: '/app/workspaces/test-workspace'
  })
}));

jest.mock('../../src/services/session-manager.service', () => ({
  createSession: jest.fn().mockResolvedValue({ sessionId: 'session1' }),
  getSession: jest.fn().mockResolvedValue(null),
  updateSession: jest.fn().mockResolvedValue({}),
  deleteSession: jest.fn().mockResolvedValue({}),
  cleanup: jest.fn().mockResolvedValue({})
}));

jest.mock('../../src/services/terminal-layout.service', () => ({
  createLayout: jest.fn().mockResolvedValue({ id: 'layout1' })
}));

jest.mock('../../src/config/database', () => ({
  prisma: {
    session: {
      create: jest.fn().mockResolvedValue({ id: 'session1' }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({})
    }
  }
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../src/utils/RingBuffer', () => {
  return jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
    clear: jest.fn()
  }));
});

const service = require('../../src/services/multiplex-shell.service');

describe('MultiplexShellService', () => {
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state
    service.workspaceSessions.clear();
    if (service.socketToSession) {
      service.socketToSession.clear();
    }
    
    mockSocket = {
      id: 'socket1',
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
      join: jest.fn(),
      leave: jest.fn()
    };
  });

  describe('constructor', () => {
    it('should initialize with empty workspace sessions', () => {
      expect(service.workspaceSessions).toBeDefined();
      expect(service.workspaceSessions.size).toBe(0);
    });
  });

  describe('setSocketIO', () => {
    it('should set socket.io instance', () => {
      const mockIO = { emit: jest.fn() };
      service.setSocketIO(mockIO);
      expect(service.io).toBe(mockIO);
    });
  });

  describe('getSessionStats', () => {
    it('should return empty stats when no sessions', () => {
      const stats = service.getSessionStats();
      
      expect(stats).toEqual({
        totalWorkspaces: 0,
        totalSessions: 0,
        workspaces: []
      });
    });

    it('should return stats with workspace data when sessions exist', () => {
      // Manually add a mock workspace session
      const mockSessionData = {
        sessionName: 'Terminal',
        ptyProcess: { pid: 1234 },
        sockets: new Set(),
        isDefault: true
      };
      
      const mockContainer = {
        sessions: new Map([['session1', mockSessionData]]),
        defaultSessionId: 'session1'
      };
      
      service.workspaceSessions.set('workspace1', mockContainer);

      const stats = service.getSessionStats();
      
      expect(stats.totalWorkspaces).toBe(1);
      expect(stats.totalSessions).toBe(1);
      expect(stats.workspaces).toHaveLength(1);
      expect(stats.workspaces[0]).toEqual({
        workspaceId: 'workspace1',
        sessionCount: 1,
        defaultSessionId: 'session1',
        sessions: [{
          sessionId: 'session1',
          sessionName: 'Terminal',
          pid: 1234,
          connectedSockets: 0,
          isDefault: true
        }]
      });
    });
  });

  describe('createPtyForSocket', () => {
    it('should create pty for socket without error', async () => {
      await expect(service.createPtyForSocket(mockSocket, 'workspace1')).resolves.not.toThrow();
    });
  });

  describe('createNewSession', () => {
    it('should handle session creation', () => {
      // Test that method exists
      expect(typeof service.createNewSession).toBe('function');
    });
  });

  describe('closeSession', () => {
    it('should close session', async () => {
      await service.closeSession('workspace1', 'session1');
      // Should complete without error
    });
  });

  describe('cleanup', () => {
    it('should cleanup all sessions', async () => {
      await service.cleanup();
      // Should complete without error
    });
  });

  describe('getWorkspaceContainer', () => {
    it('should return undefined for non-existent workspace', () => {
      const result = service.workspaceSessions.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('restoreSessions', () => {
    it('should restore sessions from database', async () => {
      await service.restoreSessions();
      // Should complete without error
    });
  });

  describe('performPeriodicCleanup', () => {
    it('should perform periodic cleanup', async () => {
      await service.performPeriodicCleanup();
      // Should complete without error
    });
  });

  describe('isProcessAlive', () => {
    it('should check if process is alive', () => {
      const result = service.isProcessAlive(1234);
      expect(typeof result).toBe('boolean');
    });
  });
});