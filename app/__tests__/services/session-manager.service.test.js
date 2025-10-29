// Mock all dependencies before any imports to prevent memory issues
const mockPrisma = {
    session: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn()
    },
    userProcess: {
        findMany: jest.fn(),
        update: jest.fn()
    }
};

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
};

const mockUuid = jest.fn(() => 'mock-uuid-123');

// Mock modules before imports
jest.mock('../../src/config/database', () => ({
    prisma: mockPrisma
}));

jest.mock('../../src/utils/logger', () => mockLogger);

jest.mock('uuid', () => ({
    v4: mockUuid
}));

// Mock global process and timer functions
global.process = {
    ...global.process,
    env: { TEST: 'value' },
    cwd: jest.fn(() => '/mock/cwd'),
    kill: jest.fn()
};

// Create spy functions for global timer functions
const mockSetInterval = jest.fn(() => 'mock-interval-id');
const mockClearInterval = jest.fn();
const mockSetTimeout = jest.fn(() => 'mock-timeout-id');
const mockClearTimeout = jest.fn();

global.setInterval = mockSetInterval;
global.clearInterval = mockClearInterval;
global.setTimeout = mockSetTimeout;
global.clearTimeout = mockClearTimeout;

const SessionManager = require('../../src/services/session-manager.service');

describe('SessionManager Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        jest.useFakeTimers();
        
        // Reset the singleton instance's state
        SessionManager.activeSessionCache.clear();
        SessionManager.recoveryTokenMap.clear();
        SessionManager.timeoutHandlers.clear();
        
        // Stop the cleanup interval to prevent interference
        if (SessionManager.cleanupInterval) {
            clearInterval(SessionManager.cleanupInterval);
            SessionManager.cleanupInterval = null;
        }
    });

    afterEach(() => {
        jest.useRealTimers();
        SessionManager.cleanup();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize with empty caches and maps', () => {
            expect(SessionManager.activeSessionCache).toBeInstanceOf(Map);
            expect(SessionManager.recoveryTokenMap).toBeInstanceOf(Map);
            expect(SessionManager.timeoutHandlers).toBeInstanceOf(Map);
        });

    });

    describe('initializeRecoveryMapping', () => {
        test('should initialize recovery mapping from database', async () => {
            const mockSessions = [
                { id: 'session1', recoveryToken: 'token1' },
                { id: 'session2', recoveryToken: 'token2' }
            ];
            mockPrisma.session.findMany.mockResolvedValue(mockSessions);

            await SessionManager.initializeRecoveryMapping();

            expect(mockPrisma.session.findMany).toHaveBeenCalledWith({
                where: {
                    status: 'active',
                    recoveryToken: { not: null }
                },
                select: {
                    id: true,
                    recoveryToken: true
                }
            });

            expect(SessionManager.recoveryTokenMap.get('token1')).toBe('session1');
            expect(SessionManager.recoveryTokenMap.get('token2')).toBe('session2');
            expect(mockLogger.info).toHaveBeenCalledWith('Initialized recovery mapping for 2 active sessions');
        });

        test('should handle database error during initialization', async () => {
            const error = new Error('Database error');
            mockPrisma.session.findMany.mockRejectedValue(error);

            await SessionManager.initializeRecoveryMapping();

            expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize recovery mapping:', error);
        });
    });

    describe('createSession', () => {
        const mockSessionData = {
            id: 'session-123',
            workspaceId: 'workspace-1',
            shellPid: 1234,
            socketId: 'socket-123',
            status: 'active',
            recoveryToken: 'mock-uuid-123',
            sessionName: 'Terminal',
            workspace: { localPath: '/test/path' }
        };

        test('should create new session with default options', async () => {
            mockPrisma.session.create.mockResolvedValue(mockSessionData);

            const result = await SessionManager.createSession('workspace-1', 1234, 'socket-123');

            expect(mockPrisma.session.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    workspaceId: 'workspace-1',
                    shellPid: 1234,
                    socketId: 'socket-123',
                    status: 'active',
                    recoveryToken: 'mock-uuid-123',
                    sessionName: 'Terminal',
                    sessionType: 'terminal',
                    isDefaultSession: false,
                    terminalSize: '{"cols":80,"rows":30}',
                    sessionTimeout: 120,
                    canRecover: true,
                    maxIdleTime: 1440,
                    autoCleanup: true
                }),
                include: { workspace: true }
            });

            expect(SessionManager.recoveryTokenMap.get('mock-uuid-123')).toBe('session-123');
            expect(SessionManager.activeSessionCache.has('session-123')).toBe(true);
            expect(result).toEqual(mockSessionData);
        });

        test('should create session with custom options', async () => {
            mockPrisma.session.create.mockResolvedValue(mockSessionData);

            const options = {
                maxIdleTime: 60,
                sessionTimeout: 30,
                autoCleanup: false,
                canRecover: false
            };

            await SessionManager.createSession(
                'workspace-1', 1234, 'socket-123',
                { cols: 100, rows: 40 },
                'Custom Terminal',
                true,
                'custom-session-id',
                options
            );

            expect(mockPrisma.session.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: 'custom-session-id',
                    sessionName: 'Custom Terminal',
                    isDefaultSession: true,
                    terminalSize: '{"cols":100,"rows":40}',
                    maxIdleTime: 60,
                    sessionTimeout: 30,
                    autoCleanup: false,
                    canRecover: false
                }),
                include: { workspace: true }
            });
        });

        test('should handle session creation error', async () => {
            const error = new Error('Creation failed');
            mockPrisma.session.create.mockRejectedValue(error);

            await expect(SessionManager.createSession('workspace-1', 1234, 'socket-123'))
                .rejects.toThrow('Creation failed');

            expect(mockLogger.error).toHaveBeenCalledWith('Failed to create session:', error);
        });
    });

    describe('updateSessionState', () => {
        const mockSession = {
            id: 'session-123',
            shellHistory: '[]',
            maxIdleTime: 60
        };

        test('should update session state with all fields', async () => {
            mockPrisma.session.update.mockResolvedValue({ ...mockSession });
            SessionManager.getSession = jest.fn().mockResolvedValue(mockSession);

            const stateUpdate = {
                currentWorkingDir: '/new/path',
                environmentVars: { NODE_ENV: 'test' },
                terminalSize: { cols: 120, rows: 50 },
                lastCommand: 'ls -la'
            };

            const result = await SessionManager.updateSessionState('session-123', stateUpdate);

            expect(mockPrisma.session.update).toHaveBeenCalledWith({
                where: { id: 'session-123' },
                data: expect.objectContaining({
                    currentWorkingDir: '/new/path',
                    environmentVars: '{"NODE_ENV":"test"}',
                    terminalSize: '{"cols":120,"rows":50}',
                    lastCommand: 'ls -la',
                    shellHistory: expect.stringContaining('ls -la'),
                    lastActivityAt: expect.any(Date)
                })
            });
        });

        test('should handle partial state updates', async () => {
            mockPrisma.session.update.mockResolvedValue({ ...mockSession });

            const stateUpdate = { currentWorkingDir: '/partial/path' };
            await SessionManager.updateSessionState('session-123', stateUpdate);

            expect(mockPrisma.session.update).toHaveBeenCalledWith({
                where: { id: 'session-123' },
                data: expect.objectContaining({
                    currentWorkingDir: '/partial/path',
                    lastActivityAt: expect.any(Date)
                })
            });
        });

        test('should handle update error', async () => {
            const error = new Error('Update failed');
            mockPrisma.session.update.mockRejectedValue(error);

            await expect(SessionManager.updateSessionState('session-123', {}))
                .rejects.toThrow('Update failed');

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to update session state for session-123:', error
            );
        });
    });

    describe('attachSocketToSession', () => {
        test('should attach socket to session', async () => {
            const mockSession = { id: 'session-123', maxIdleTime: 60, workspace: {} };
            mockPrisma.session.update.mockResolvedValue(mockSession);

            const result = await SessionManager.attachSocketToSession('session-123', 'new-socket-123');

            expect(mockPrisma.session.update).toHaveBeenCalledWith({
                where: { id: 'session-123' },
                data: {
                    socketId: 'new-socket-123',
                    lastActivityAt: expect.any(Date),
                    status: 'active'
                },
                include: { workspace: true }
            });

            expect(mockLogger.info).toHaveBeenCalledWith('Attached socket new-socket-123 to session session-123');
            expect(result).toEqual(mockSession);
        });

        test('should handle attach error', async () => {
            const error = new Error('Attach failed');
            mockPrisma.session.update.mockRejectedValue(error);

            await expect(SessionManager.attachSocketToSession('session-123', 'socket-123'))
                .rejects.toThrow('Attach failed');
        });
    });

    describe('detachSocketFromSession', () => {
        test('should detach socket from session', async () => {
            const mockSession = { id: 'session-123', maxIdleTime: 60 };
            mockPrisma.session.update.mockResolvedValue(mockSession);

            const result = await SessionManager.detachSocketFromSession('session-123');

            expect(mockPrisma.session.update).toHaveBeenCalledWith({
                where: { id: 'session-123' },
                data: {
                    socketId: null,
                    status: 'paused',
                    lastActivityAt: expect.any(Date)
                }
            });

            expect(mockLogger.info).toHaveBeenCalledWith('Detached socket from session session-123, session paused for recovery');
        });
    });

    describe('findSessionByRecoveryToken', () => {
        test('should find session by recovery token', async () => {
            const mockSession = { id: 'session-123', workspace: {} };
            SessionManager.recoveryTokenMap.set('recovery-token-123', 'session-123');
            mockPrisma.session.findUnique.mockResolvedValue(mockSession);

            const result = await SessionManager.findSessionByRecoveryToken('recovery-token-123');

            expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
                where: { id: 'session-123' },
                include: { workspace: true }
            });
            expect(result).toEqual(mockSession);
        });

        test('should return null for unknown recovery token', async () => {
            const result = await SessionManager.findSessionByRecoveryToken('unknown-token');
            expect(result).toBeNull();
        });

        test('should handle database error gracefully', async () => {
            SessionManager.recoveryTokenMap.set('recovery-token-123', 'session-123');
            mockPrisma.session.findUnique.mockRejectedValue(new Error('DB error'));

            const result = await SessionManager.findSessionByRecoveryToken('recovery-token-123');

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('terminateSession', () => {
        test('should terminate session and cleanup resources', async () => {
            const mockSession = { id: 'session-123', recoveryToken: 'recovery-123' };
            mockPrisma.session.update.mockResolvedValue(mockSession);
            
            // Setup caches and handlers to test cleanup
            SessionManager.activeSessionCache.set('session-123', {});
            SessionManager.recoveryTokenMap.set('recovery-123', 'session-123');
            const mockTimeout = setTimeout(() => {}, 1000);
            SessionManager.timeoutHandlers.set('session-123', mockTimeout);

            const result = await SessionManager.terminateSession('session-123', 'test');

            expect(mockPrisma.session.update).toHaveBeenCalledWith({
                where: { id: 'session-123' },
                data: {
                    status: 'terminated',
                    endedAt: expect.any(Date),
                    socketId: null,
                    canRecover: false
                }
            });

            expect(SessionManager.activeSessionCache.has('session-123')).toBe(false);
            expect(SessionManager.recoveryTokenMap.has('recovery-123')).toBe(false);
            expect(SessionManager.timeoutHandlers.has('session-123')).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith('Terminated session session-123 (reason: test)');
        });
    });

    describe('getSessionStatistics', () => {
        test('should return comprehensive session statistics', async () => {
            mockPrisma.session.groupBy.mockResolvedValue([
                { status: 'active', _count: { status: 5 } },
                { status: 'paused', _count: { status: 2 } }
            ]);
            
            mockPrisma.session.count
                .mockResolvedValueOnce(10) // total
                .mockResolvedValueOnce(5)  // active
                .mockResolvedValueOnce(2)  // paused
                .mockResolvedValueOnce(6)  // recoverable
                .mockResolvedValueOnce(1); // idle

            SessionManager.activeSessionCache.set('session1', {});
            SessionManager.recoveryTokenMap.set('token1', 'session1');

            const stats = await SessionManager.getSessionStatistics();

            expect(stats).toEqual({
                total: 10,
                active: 5,
                paused: 2,
                recoverable: 6,
                idle: 1,
                breakdown: expect.any(Array),
                memoryCache: {
                    cachedSessions: 1,
                    recoveryTokens: 1,
                    timeoutHandlers: 0
                }
            });
        });

        test('should handle statistics error', async () => {
            mockPrisma.session.groupBy.mockRejectedValue(new Error('Stats error'));

            const result = await SessionManager.getSessionStatistics();

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('setupIdleTimeout', () => {
        test('should set up idle timeout for session', () => {
            SessionManager.getSession = jest.fn().mockResolvedValue({ 
                id: 'session-123', 
                autoCleanup: true 
            });
            SessionManager.terminateSession = jest.fn();

            SessionManager.setupIdleTimeout('session-123', 30);

            expect(SessionManager.timeoutHandlers.has('session-123')).toBe(true);
            
            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(30 * 60 * 1000 + 1000);
            
            expect(mockLogger.debug).toHaveBeenCalledWith('Set idle timeout for session session-123: 30 minutes');
        });

        test('should clear existing timeout before setting new one', () => {
            const mockOldTimeout = 'old-timeout-id';
            SessionManager.timeoutHandlers.set('session-123', mockOldTimeout);

            SessionManager.setupIdleTimeout('session-123', 60);

            expect(mockClearTimeout).toHaveBeenCalledWith(mockOldTimeout);
            expect(SessionManager.timeoutHandlers.has('session-123')).toBe(true);
        });
    });

    describe('performSessionCleanup', () => {
        test('should cleanup expired sessions', async () => {
            const expiredSessions = [
                { id: 'session1' },
                { id: 'session2' }
            ];
            mockPrisma.session.findMany.mockResolvedValue(expiredSessions);
            SessionManager.terminateSession = jest.fn().mockResolvedValue({});
            SessionManager.cleanupOrphanedProcesses = jest.fn().mockResolvedValue();

            await SessionManager.performSessionCleanup();

            expect(SessionManager.terminateSession).toHaveBeenCalledWith('session1', 'cleanup_expired');
            expect(SessionManager.terminateSession).toHaveBeenCalledWith('session2', 'cleanup_expired');
            expect(SessionManager.cleanupOrphanedProcesses).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up 2 expired sessions');
        });

        test('should handle cleanup errors gracefully', async () => {
            mockPrisma.session.findMany.mockRejectedValue(new Error('Cleanup error'));

            await SessionManager.performSessionCleanup();

            expect(mockLogger.error).toHaveBeenCalledWith('Error during session cleanup:', expect.any(Error));
        });
    });

    describe('cleanup', () => {
        test('should cleanup all resources', () => {
            SessionManager.cleanupInterval = setInterval(() => {}, 1000);
            SessionManager.timeoutHandlers.set('session1', setTimeout(() => {}, 1000));
            SessionManager.activeSessionCache.set('session1', {});
            SessionManager.recoveryTokenMap.set('token1', 'session1');

            SessionManager.cleanup();

            expect(SessionManager.cleanupInterval).toBeNull();
            expect(SessionManager.timeoutHandlers.size).toBe(0);
            expect(SessionManager.activeSessionCache.size).toBe(0);
            expect(SessionManager.recoveryTokenMap.size).toBe(0);
            expect(mockLogger.info).toHaveBeenCalledWith('Session manager cleanup completed');
        });
    });
});