const os = require('os');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs').promises;
const workspaceService = require('./workspace.service');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const RingBuffer = require('../utils/RingBuffer'); // Import the Ring Buffer utility

/**
 * Persistent terminal session history with disk storage
 */
class SessionHistory {
    constructor(workspaceId) {
        this.workspaceId = workspaceId;
        this.historyDir = '/home/claude/.terminal_history';
        this.historyFile = path.join(this.historyDir, `${workspaceId}.log`);
        
        // Keep in-memory buffer for fast access
        this.memoryBuffer = new RingBuffer(5000); // Increase to 5000
        
        // Initialize and restore previous session
        this.initialize();
    }
    
    async initialize() {
        try {
            await this.ensureHistoryDir();
            await this.restoreFromDisk();
        } catch (error) {
            logger.warn(`Failed to initialize history for workspace ${this.workspaceId}:`, error);
        }
    }
    
    async ensureHistoryDir() {
        try {
            await fs.mkdir(this.historyDir, { recursive: true });
        } catch (error) {
            // Directory might already exist, that's fine
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    
    async write(data) {
        // Write to memory buffer immediately
        this.memoryBuffer.push(data);
        
        // Append to disk asynchronously (non-blocking)
        this.writeToDisk(data).catch(error => {
            logger.warn(`Failed to write history to disk for workspace ${this.workspaceId}:`, error);
        });
    }
    
    async writeToDisk(data) {
        const timestamp = Date.now();
        const encodedData = Buffer.from(data).toString('base64');
        const logLine = `${timestamp}|${encodedData}\n`;
        
        await fs.appendFile(this.historyFile, logLine);
    }
    
    async restoreFromDisk() {
        try {
            const content = await fs.readFile(this.historyFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim()).slice(-5000); // Last 5000 lines
            
            for (const line of lines) {
                const pipeIndex = line.indexOf('|');
                if (pipeIndex === -1) continue;
                
                const timestamp = line.substring(0, pipeIndex);
                const data = line.substring(pipeIndex + 1);
                
                if (data && !isNaN(timestamp)) {
                    try {
                        const decodedData = Buffer.from(data, 'base64').toString();
                        this.memoryBuffer.push(decodedData);
                    } catch (decodeError) {
                        // Skip corrupted entries
                        logger.debug(`Skipping corrupted history entry for workspace ${this.workspaceId}`);
                    }
                }
            }
            
            logger.debug(`Restored ${lines.length} history entries for workspace ${this.workspaceId}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.warn(`Failed to restore history from disk for workspace ${this.workspaceId}:`, error);
            }
            // File doesn't exist yet, that's fine for new workspaces
        }
    }
    
    getRecent() {
        return this.memoryBuffer.getAll();
    }
    
    clear() {
        this.memoryBuffer.clear();
        // Optionally clear disk file as well
        fs.unlink(this.historyFile).catch(() => {
            // File might not exist, that's fine
        });
    }
}

class ShellService {
    constructor() {
        // Map: workspaceId -> { ptyProcess, workspace, sockets: Set(), buffer: RingBuffer }
        this.activeSessions = new Map();
        // Map: socket.id -> workspaceId
        this.socketToWorkspace = new Map();
        // Socket.IO instance for room-based emissions
        this.io = null;

        // Configuration
        this.REPLAY_BUFFER_CAPACITY = 500; // Store last 500 data chunks. A good balance.

        // Start periodic cleanup of dead processes every 5 minutes
        this.cleanupInterval = setInterval(() => this.performPeriodicCleanup(), 5 * 60 * 1000);

        // Attempt to clean up sessions from DB on startup (for processes that died unexpectedly)
        this.restoreSessions();
    }

    /**
     * Initialize the shell service with Socket.IO instance
     * @param {Object} io - Socket.IO instance
     */
    setSocketIO(io) {
        this.io = io;
        logger.info('ShellService initialized with Socket.IO instance');
    }

    /**
     * Main entry point for a socket connection requesting a terminal.
     * It intelligently decides whether to create a new session or resume an existing one.
     * Uses workspace-scoped socket rooms to prevent output bleeding between workspaces.
     */
    async createPtyForSocket(socket, workspaceId) {
        try {
            // ROOM-BASED FIX: Leave previous workspace room and join new one
            const previousWorkspaceId = this.socketToWorkspace.get(socket.id);
            if (previousWorkspaceId && previousWorkspaceId !== workspaceId) {
                // Leave previous workspace room
                socket.leave(`workspace:${previousWorkspaceId}`);
                
                // Remove socket from previous session tracking
                const previousSession = this.activeSessions.get(previousWorkspaceId);
                if (previousSession) {
                    previousSession.sockets.delete(socket.id);
                    logger.info(`Socket ${socket.id} left workspace room ${previousWorkspaceId} and session tracking`);
                }
            }

            const workspace = await this.getWorkspaceForSession(socket, workspaceId);
            if (!workspace) return; // Error was already sent to the socket

            // Join the workspace-specific room
            socket.join(`workspace:${workspace.id}`);
            logger.info(`Socket ${socket.id} joined workspace room ${workspace.id}`);

            const existingSession = this.activeSessions.get(workspace.id);
            if (existingSession) {
                this.resumeSession(socket, existingSession);
            } else {
                await this.createNewSession(socket, workspace);
            }
        } catch (error) {
            logger.error('Failed to create/resume PTY session:', error);
            socket.emit('terminal-error', { error: `Error creating terminal session: ${error.message}` });
        }
    }

    /**
     * Helper to find the correct workspace or send an error to the client.
     */
    async getWorkspaceForSession(socket, workspaceId) {
        let workspace;
        if (workspaceId) {
            workspace = await workspaceService.getWorkspace(workspaceId);
            if (!workspace) {
                socket.emit('terminal-error', { error: 'Workspace not found.' });
                return null;
            }
        } else {
            // Fallback to the first available workspace if none is specified
            const workspaces = await workspaceService.listWorkspaces();
            if (workspaces.length === 0) {
                socket.emit('terminal-error', { error: 'No workspaces exist. Please clone a repository first.' });
                return null;
            }
            workspace = workspaces[0];
        }
        return workspace;
    }

    /**
     * Attaches a socket to an already running terminal session.
     */
    resumeSession(socket, session) {
        logger.info(`Resuming session for workspace ${session.workspace.id} with socket ${socket.id}`);
        logger.info(`Session sockets before adding: [${Array.from(session.sockets).join(', ')}]`);
        session.sockets.add(socket.id);
        logger.info(`Session sockets after adding: [${Array.from(session.sockets).join(', ')}]`);
        this.socketToWorkspace.set(socket.id, session.workspace.id);

        // **THE FIX: Replay the small, buffered history**
        this.replayHistory(socket, session);

        // Note: terminal-resumed is sent directly to the requesting socket, not the room
        // since it's a response to the specific socket's create-terminal request
        socket.emit('terminal-resumed', { workspaceId: session.workspace.id });
    }

    /**
     * Creates a brand new terminal session for a workspace.
     */
    async createNewSession(socket, workspace) {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        const shellArgs = os.platform() === 'win32' ? [] : ['--login']; // Use login shell for proper initialization
        
        const ptyProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color', // Better color support
            cols: 80,
            rows: 30,
            cwd: workspace.localPath,
            env: {
                ...process.env,
                HOME: '/home/claude',
                USER: 'claude',
                SHELL: '/bin/bash',
                PS1: '\\[\\033[1;32m\\]\\u@\\h\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]$ ', // Colorful prompt
                PATH: `${process.env.PATH}:/home/claude/.local/bin`
            },
        });

        const sessionData = {
            ptyProcess,
            workspace,
            sockets: new Set([socket.id]),
            history: new SessionHistory(workspace.id) // Use persistent history
        };

        this.activeSessions.set(workspace.id, sessionData);
        this.socketToWorkspace.set(socket.id, workspace.id);

        // Pipe all data from the pty to connected sockets and persistent history
        ptyProcess.onData(data => {
            sessionData.history.write(data); // Write to persistent history

            // ROOM-BASED FIX: Emit to workspace room instead of iterating sockets
            if (this.io) {
                this.io.to(`workspace:${workspace.id}`).emit('terminal-output', data);
                logger.debug(`[PTY-DATA] Emitted terminal-output to workspace:${workspace.id} room`);
            } else {
                // Fallback to old method if io not initialized (shouldn't happen)
                logger.warn('[PTY-DATA] Socket.IO instance not available, falling back to socket iteration');
                sessionData.sockets.forEach(socketId => {
                    const liveSocket = socket.server.sockets.sockets.get(socketId);
                    liveSocket?.emit('terminal-output', data);
                });
            }
        });

        // Handle pty exit
        ptyProcess.onExit(({ exitCode, signal }) => {
            logger.info(`PTY process exited for workspace ${workspace.id}: code=${exitCode}, signal=${signal}`);
            const message = `\r\nShell exited.\r\n`;

            // ROOM-BASED FIX: Emit exit messages to workspace room
            if (this.io) {
                this.io.to(`workspace:${workspace.id}`).emit('terminal-output', message);
                this.io.to(`workspace:${workspace.id}`).emit('terminal-killed', { workspaceId: workspace.id });
            } else {
                // Fallback to old method
                sessionData.sockets.forEach(socketId => {
                    const liveSocket = socket.server.sockets.sockets.get(socketId);
                    liveSocket?.emit('terminal-output', message);
                    liveSocket?.emit('terminal-killed', { workspaceId: workspace.id });
                });
            }

            // Clean up the session from memory
            this.closeSession(workspace.id);
        });

        logger.info(`New PTY session created for workspace ${workspace.id} (PID: ${ptyProcess.pid}) with socket ${socket.id}`);
    }

    /**
     * Sends the content of the persistent history to a newly connected socket.
     */
    replayHistory(socket, session) {
        if (!session.history) return;

        const bufferedChunks = session.history.getRecent();
        if (bufferedChunks.length > 0) {
            const replayOutput = bufferedChunks.join('');
            socket.emit('terminal-output', '\r\n\x1b[2m--- Replaying recent session history ---\x1b[0m\r\n');
            socket.emit('terminal-output', replayOutput);
            socket.emit('terminal-output', '\r\n\x1b[2m--- End of history ---\x1b[0m\r\n');
        }
    }

    /**
     * Writes incoming data from a socket to the corresponding PTY process.
     */
    writeToPty(socketId, data) {
        const workspaceId = this.socketToWorkspace.get(socketId);
        const session = this.activeSessions.get(workspaceId);
        session?.ptyProcess.write(data);
    }

    /**
     * Resizes the PTY for a session.
     */
    resizePty(socketId, cols, rows) {
        const workspaceId = this.socketToWorkspace.get(socketId);
        const session = this.activeSessions.get(workspaceId);
        if (session && session.ptyProcess) {
            session.ptyProcess.resize(cols, rows);
            logger.debug(`PTY resized for workspace ${workspaceId}: ${cols}x${rows}`);
        }
    }

    /**
     * Handles a socket disconnecting. Detaches the socket from the session
     * but keeps the PTY process alive. The socket automatically leaves all rooms on disconnect.
     */
    handleSocketDisconnect(socketId) {
        const workspaceId = this.socketToWorkspace.get(socketId);
        if (workspaceId) {
            const session = this.activeSessions.get(workspaceId);
            if (session) {
                session.sockets.delete(socketId);
                logger.info(`Socket ${socketId} detached from workspace ${workspaceId}. Sockets remaining: ${session.sockets.size}`);
            }
            this.socketToWorkspace.delete(socketId);
            
            // Note: Socket automatically leaves all rooms on disconnect, no manual leave needed
            logger.debug(`Socket ${socketId} automatically left workspace:${workspaceId} room on disconnect`);
        }
    }

    /**
     * Kills the PTY process and cleans up the session from memory.
     */
    closeSession(workspaceId) {
        const session = this.activeSessions.get(workspaceId);
        if (session) {
            session.ptyProcess.kill();
            session.sockets.forEach(socketId => {
                this.socketToWorkspace.delete(socketId);
            });
            this.activeSessions.delete(workspaceId);
            logger.info(`Closed and cleaned up terminal session for workspace ${workspaceId}`);
        }
    }

    /**
     * Public method to explicitly kill a session.
     */
    killSession(workspaceId) {
        this.closeSession(workspaceId);
    }

    /**
     * Kills all active sessions, e.g., during a graceful shutdown.
     */
    async killAllSessions() {
        logger.info(`Killing all ${this.activeSessions.size} active sessions.`);
        for (const workspaceId of this.activeSessions.keys()) {
            this.closeSession(workspaceId);
        }
    }

    /**
     * Gathers statistics about currently running sessions.
     */
    getSessionStats() {
        return {
            totalSessions: this.activeSessions.size,
            sessions: Array.from(this.activeSessions.values()).map(s => ({
                workspaceId: s.workspace.id,
                workspaceName: s.workspace.name,
                pid: s.ptyProcess.pid,
                connectedSockets: s.sockets.size,
            }))
        };
    }

    /**
     * Check if there are any active processes for a specific workspace
     * @param {string} workspaceId - Workspace ID to check
     * @returns {boolean} True if workspace has active processes
     */
    hasActiveProcessInWorkspace(workspaceId) {
        const session = this.activeSessions.get(workspaceId);
        return session && session.ptyProcess && !session.ptyProcess.killed;
    }

    /**
     * Periodically checks for and cleans up any "zombie" sessions where the
     * underlying OS process has died but the session object remains in memory.
     */
    async performPeriodicCleanup() {
        let cleanedCount = 0;
        for (const [workspaceId, session] of this.activeSessions.entries()) {
            if (!this.isProcessAlive(session.ptyProcess.pid)) {
                logger.warn(`Found dead PTY process (PID: ${session.ptyProcess.pid}) for workspace ${workspaceId}. Cleaning up.`);
                this.closeSession(workspaceId);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger.info(`Periodic cleanup removed ${cleanedCount} stale sessions.`);
        }
    }

    /**
     * On startup, this method checks the database for any sessions marked as 'active'
     * and terminates them, as the actual processes would have died with the server.
     */
    async restoreSessions() {
        try {
            const staleSessions = await prisma.session.updateMany({
                where: { status: 'active' },
                data: { status: 'terminated', endedAt: new Date() },
            });
            if (staleSessions.count > 0) {
                logger.info(`Cleaned up ${staleSessions.count} stale sessions from the database on startup.`);
            }
        } catch (error) {
            logger.error('Error cleaning up stale sessions on startup:', error);
        }
    }

    /**
     * Checks if a process with the given PID is still running on the system.
     */
    isProcessAlive(pid) {
        if (!pid) return false;
        try {
            // Sending signal 0 to a process tests for its existence without killing it.
            process.kill(pid, 0);
            return true;
        } catch (error) {
            // ESRCH means the process doesn't exist.
            // EPERM means process exists but we don't have permission to signal it.
            // Any other error (EINVAL, etc.) we treat as "unknown/dead" for safety.
            return error.code === 'EPERM';
        }
    }

    /**
     * Clean up resources (for testing or shutdown)
     */
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Terminate all active sessions
        for (const [workspaceId, session] of this.activeSessions) {
            try {
                if (session.ptyProcess && !session.ptyProcess.killed) {
                    session.ptyProcess.kill();
                }
            } catch (error) {
                logger.warn(`Failed to kill process for workspace ${workspaceId}:`, error);
            }
        }
        
        this.activeSessions.clear();
        this.socketToWorkspace.clear();
    }
}

module.exports = new ShellService();
