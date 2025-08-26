const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced Session Management Service
 * Handles session persistence, recovery, and state management
 */
class SessionManager {
    constructor() {
        // Active session memory cache: sessionId -> sessionData
        this.activeSessionCache = new Map();
        
        // Recovery token mapping: recoveryToken -> sessionId
        this.recoveryTokenMap = new Map();
        
        // Session timeout handlers
        this.timeoutHandlers = new Map();
        
        // Start periodic cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => this.performSessionCleanup(), 5 * 60 * 1000);
        
        // Initialize recovery token mapping from database
        this.initializeRecoveryMapping();
    }

    /**
     * Initialize recovery token mapping from existing database sessions
     */
    async initializeRecoveryMapping() {
        try {
            const activeSessions = await prisma.session.findMany({
                where: {
                    status: 'active',
                    recoveryToken: { not: null }
                },
                select: {
                    id: true,
                    recoveryToken: true
                }
            });

            for (const session of activeSessions) {
                if (session.recoveryToken) {
                    this.recoveryTokenMap.set(session.recoveryToken, session.id);
                }
            }

            logger.info(`Initialized recovery mapping for ${activeSessions.length} active sessions`);
        } catch (error) {
            logger.error('Failed to initialize recovery mapping:', error);
        }
    }

    /**
     * Create a new session with enhanced state tracking
     */
    async createSession(workspaceId, shellPid, socketId, terminalSize = { cols: 80, rows: 30 }, options = {}) {
        try {
            const recoveryToken = uuidv4();
            
            // Default session configuration
            const sessionConfig = {
                maxIdleTime: options.maxIdleTime || 1440, // 24 hours default
                sessionTimeout: options.sessionTimeout || 120, // 2 hours for active timeout
                autoCleanup: options.autoCleanup !== false, // default true
                canRecover: options.canRecover !== false // default true
            };
            
            const session = await prisma.session.create({
                data: {
                    workspaceId,
                    shellPid,
                    socketId,
                    status: 'active',
                    recoveryToken,
                    terminalSize: JSON.stringify(terminalSize),
                    lastActivityAt: new Date(),
                    sessionTimeout: sessionConfig.sessionTimeout,
                    canRecover: sessionConfig.canRecover,
                    maxIdleTime: sessionConfig.maxIdleTime,
                    autoCleanup: sessionConfig.autoCleanup
                },
                include: {
                    workspace: true
                }
            });

            // Add to recovery mapping
            this.recoveryTokenMap.set(recoveryToken, session.id);
            
            // Cache session data
            this.activeSessionCache.set(session.id, {
                ...session,
                currentEnv: process.env,
                currentDir: session.workspace?.localPath || process.cwd()
            });

            // Set up idle timeout
            this.setupIdleTimeout(session.id, session.maxIdleTime);

            logger.info(`Created new session ${session.id} for workspace ${workspaceId} with recovery token (idle timeout: ${sessionConfig.maxIdleTime}min)`);
            return session;
        } catch (error) {
            logger.error('Failed to create session:', error);
            throw error;
        }
    }

    /**
     * Update session state (current working directory, environment, etc.)
     */
    async updateSessionState(sessionId, stateUpdate) {
        try {
            const updateData = {};
            
            if (stateUpdate.currentWorkingDir) {
                updateData.currentWorkingDir = stateUpdate.currentWorkingDir;
            }
            
            if (stateUpdate.environmentVars) {
                updateData.environmentVars = JSON.stringify(stateUpdate.environmentVars);
            }
            
            if (stateUpdate.terminalSize) {
                updateData.terminalSize = JSON.stringify(stateUpdate.terminalSize);
            }
            
            if (stateUpdate.lastCommand) {
                updateData.lastCommand = stateUpdate.lastCommand;
                
                // Also update shell history
                const session = await this.getSession(sessionId);
                if (session) {
                    const history = session.shellHistory ? JSON.parse(session.shellHistory) : [];
                    history.push({
                        command: stateUpdate.lastCommand,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Keep last 100 commands
                    const trimmedHistory = history.slice(-100);
                    updateData.shellHistory = JSON.stringify(trimmedHistory);
                }
            }

            // Always update last activity
            updateData.lastActivityAt = new Date();

            const updatedSession = await prisma.session.update({
                where: { id: sessionId },
                data: updateData
            });

            // Update cache
            if (this.activeSessionCache.has(sessionId)) {
                const cachedSession = this.activeSessionCache.get(sessionId);
                this.activeSessionCache.set(sessionId, {
                    ...cachedSession,
                    ...updateData
                });
            }

            // Reset idle timeout
            this.setupIdleTimeout(sessionId, updatedSession.maxIdleTime);

            logger.debug(`Updated session state for ${sessionId}`);
            return updatedSession;
        } catch (error) {
            logger.error(`Failed to update session state for ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Attach a socket to an existing session (for recovery)
     */
    async attachSocketToSession(sessionId, socketId) {
        try {
            const updatedSession = await prisma.session.update({
                where: { id: sessionId },
                data: {
                    socketId,
                    lastActivityAt: new Date(),
                    status: 'active'
                },
                include: {
                    workspace: true
                }
            });

            // Reset idle timeout
            this.setupIdleTimeout(sessionId, updatedSession.maxIdleTime);

            logger.info(`Attached socket ${socketId} to session ${sessionId}`);
            return updatedSession;
        } catch (error) {
            logger.error(`Failed to attach socket to session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Detach socket from session (but keep session alive for recovery)
     */
    async detachSocketFromSession(sessionId) {
        try {
            const updatedSession = await prisma.session.update({
                where: { id: sessionId },
                data: {
                    socketId: null,
                    status: 'paused', // Mark as paused instead of terminated
                    lastActivityAt: new Date()
                }
            });

            // Keep idle timeout running for paused sessions
            this.setupIdleTimeout(sessionId, updatedSession.maxIdleTime);

            logger.info(`Detached socket from session ${sessionId}, session paused for recovery`);
            return updatedSession;
        } catch (error) {
            logger.error(`Failed to detach socket from session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Find session by recovery token
     */
    async findSessionByRecoveryToken(recoveryToken) {
        try {
            const sessionId = this.recoveryTokenMap.get(recoveryToken);
            if (!sessionId) {
                return null;
            }

            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                include: { workspace: true }
            });

            return session;
        } catch (error) {
            logger.error(`Failed to find session by recovery token:`, error);
            return null;
        }
    }

    /**
     * Find recoverable session for a workspace
     */
    async findRecoverableSession(workspaceId) {
        try {
            const session = await prisma.session.findFirst({
                where: {
                    workspaceId,
                    status: { in: ['active', 'paused'] },
                    canRecover: true
                },
                include: { workspace: true },
                orderBy: { lastActivityAt: 'desc' }
            });

            return session;
        } catch (error) {
            logger.error(`Failed to find recoverable session for workspace ${workspaceId}:`, error);
            return null;
        }
    }

    /**
     * Get session with state information
     */
    async getSession(sessionId) {
        try {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                include: { workspace: true }
            });

            if (session) {
                // Parse JSON fields
                if (session.environmentVars) {
                    session.parsedEnvironmentVars = JSON.parse(session.environmentVars);
                }
                if (session.shellHistory) {
                    session.parsedShellHistory = JSON.parse(session.shellHistory);
                }
                if (session.terminalSize) {
                    session.parsedTerminalSize = JSON.parse(session.terminalSize);
                }
            }

            return session;
        } catch (error) {
            logger.error(`Failed to get session ${sessionId}:`, error);
            return null;
        }
    }

    /**
     * Terminate session and clean up resources
     */
    async terminateSession(sessionId, reason = 'manual') {
        try {
            const session = await prisma.session.update({
                where: { id: sessionId },
                data: {
                    status: 'terminated',
                    endedAt: new Date(),
                    socketId: null,
                    canRecover: false
                }
            });

            // Clear from caches
            this.activeSessionCache.delete(sessionId);
            
            // Remove from recovery mapping
            if (session.recoveryToken) {
                this.recoveryTokenMap.delete(session.recoveryToken);
            }

            // Clear timeout handler
            if (this.timeoutHandlers.has(sessionId)) {
                clearTimeout(this.timeoutHandlers.get(sessionId));
                this.timeoutHandlers.delete(sessionId);
            }

            logger.info(`Terminated session ${sessionId} (reason: ${reason})`);
            return session;
        } catch (error) {
            logger.error(`Failed to terminate session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Set up idle timeout for a session
     */
    setupIdleTimeout(sessionId, maxIdleTimeMinutes) {
        // Clear existing timeout
        if (this.timeoutHandlers.has(sessionId)) {
            clearTimeout(this.timeoutHandlers.get(sessionId));
        }

        // Set new timeout
        const timeoutMs = maxIdleTimeMinutes * 60 * 1000;
        const timeoutHandler = setTimeout(async () => {
            try {
                const session = await this.getSession(sessionId);
                if (session && session.autoCleanup) {
                    logger.info(`Auto-terminating idle session ${sessionId} after ${maxIdleTimeMinutes} minutes`);
                    await this.terminateSession(sessionId, 'idle_timeout');
                }
            } catch (error) {
                logger.error(`Error auto-terminating session ${sessionId}:`, error);
            }
        }, timeoutMs);

        this.timeoutHandlers.set(sessionId, timeoutHandler);
        logger.debug(`Set idle timeout for session ${sessionId}: ${maxIdleTimeMinutes} minutes`);
    }

    /**
     * Periodic cleanup of expired and orphaned sessions
     */
    async performSessionCleanup() {
        try {
            const now = new Date();
            const expiredThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

            // Find expired sessions
            const expiredSessions = await prisma.session.findMany({
                where: {
                    OR: [
                        {
                            status: 'active',
                            lastActivityAt: { lt: expiredThreshold },
                            autoCleanup: true
                        },
                        {
                            status: 'paused',
                            lastActivityAt: { lt: expiredThreshold },
                            autoCleanup: true
                        }
                    ]
                }
            });

            let cleanedCount = 0;
            for (const session of expiredSessions) {
                try {
                    await this.terminateSession(session.id, 'cleanup_expired');
                    cleanedCount++;
                } catch (error) {
                    logger.error(`Failed to cleanup session ${session.id}:`, error);
                }
            }

            if (cleanedCount > 0) {
                logger.info(`Cleaned up ${cleanedCount} expired sessions`);
            }

            // Also cleanup orphaned processes
            await this.cleanupOrphanedProcesses();

        } catch (error) {
            logger.error('Error during session cleanup:', error);
        }
    }

    /**
     * Cleanup processes that no longer have valid sessions
     */
    async cleanupOrphanedProcesses() {
        try {
            const orphanedProcesses = await prisma.userProcess.findMany({
                where: {
                    status: 'running',
                    session: null
                }
            });

            for (const process of orphanedProcesses) {
                try {
                    // Check if process is still alive
                    let isAlive = false;
                    try {
                        process.kill(process.pid, 0);
                        isAlive = true;
                    } catch (e) {
                        isAlive = false;
                    }

                    if (!isAlive) {
                        await prisma.userProcess.update({
                            where: { id: process.id },
                            data: {
                                status: 'crashed',
                                endedAt: new Date(),
                                exitCode: -1
                            }
                        });
                    }
                } catch (error) {
                    logger.error(`Failed to cleanup orphaned process ${process.id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Error cleaning up orphaned processes:', error);
        }
    }

    /**
     * Get all active sessions
     */
    async getActiveSessions() {
        try {
            const sessions = await prisma.session.findMany({
                where: {
                    status: { in: ['active', 'paused'] }
                },
                include: { workspace: true },
                orderBy: { lastActivityAt: 'desc' }
            });

            return sessions;
        } catch (error) {
            logger.error('Failed to get active sessions:', error);
            return [];
        }
    }

    /**
     * Get detailed session statistics
     */
    async getSessionStatistics() {
        try {
            const stats = await prisma.session.groupBy({
                by: ['status'],
                _count: {
                    status: true
                }
            });

            const totalSessions = await prisma.session.count();
            const activeSessions = await prisma.session.count({
                where: { status: 'active' }
            });
            const pausedSessions = await prisma.session.count({
                where: { status: 'paused' }
            });
            const recoverableSessions = await prisma.session.count({
                where: { 
                    status: { in: ['active', 'paused'] },
                    canRecover: true
                }
            });

            // Find idle sessions (no activity for more than 30 minutes)
            const idleThreshold = new Date(Date.now() - 30 * 60 * 1000);
            const idleSessions = await prisma.session.count({
                where: {
                    status: 'active',
                    lastActivityAt: { lt: idleThreshold }
                }
            });

            return {
                total: totalSessions,
                active: activeSessions,
                paused: pausedSessions,
                recoverable: recoverableSessions,
                idle: idleSessions,
                breakdown: stats,
                memoryCache: {
                    cachedSessions: this.activeSessionCache.size,
                    recoveryTokens: this.recoveryTokenMap.size,
                    timeoutHandlers: this.timeoutHandlers.size
                }
            };
        } catch (error) {
            logger.error('Failed to get session statistics:', error);
            return null;
        }
    }

    /**
     * Get sessions that are idle beyond their configured threshold
     */
    async getIdleSessions(customThresholdMinutes = null) {
        try {
            const now = new Date();
            const sessions = await prisma.session.findMany({
                where: {
                    status: { in: ['active', 'paused'] },
                    autoCleanup: true
                },
                include: { workspace: true }
            });

            const idleSessions = sessions.filter(session => {
                const thresholdMinutes = customThresholdMinutes || session.maxIdleTime || 1440;
                const idleThreshold = new Date(now.getTime() - thresholdMinutes * 60 * 1000);
                return session.lastActivityAt < idleThreshold;
            });

            return idleSessions;
        } catch (error) {
            logger.error('Failed to get idle sessions:', error);
            return [];
        }
    }

    /**
     * Manually cleanup idle sessions beyond threshold
     */
    async cleanupIdleSessions(customThresholdMinutes = null) {
        try {
            const idleSessions = await this.getIdleSessions(customThresholdMinutes);
            let cleanedCount = 0;

            for (const session of idleSessions) {
                try {
                    await this.terminateSession(session.id, 'manual_idle_cleanup');
                    cleanedCount++;
                } catch (error) {
                    logger.error(`Failed to cleanup idle session ${session.id}:`, error);
                }
            }

            if (cleanedCount > 0) {
                logger.info(`Manually cleaned up ${cleanedCount} idle sessions`);
            }

            return { cleanedCount, totalIdle: idleSessions.length };
        } catch (error) {
            logger.error('Failed to cleanup idle sessions:', error);
            return { cleanedCount: 0, totalIdle: 0 };
        }
    }

    /**
     * Cleanup resources when shutting down
     */
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Clear all timeout handlers
        for (const [sessionId, handler] of this.timeoutHandlers) {
            clearTimeout(handler);
        }
        this.timeoutHandlers.clear();

        this.activeSessionCache.clear();
        this.recoveryTokenMap.clear();

        logger.info('Session manager cleanup completed');
    }
}

module.exports = new SessionManager();