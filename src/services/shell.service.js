const os = require('os');
const pty = require('node-pty');
const workspaceService = require('./workspace.service');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const RingBuffer = require('../utils/RingBuffer'); // Import the Ring Buffer utility

class ShellService {
    constructor() {
        // Map: workspaceId -> { ptyProcess, workspace, sockets: Set(), buffer: RingBuffer }
        this.activeSessions = new Map();
        // Map: socket.id -> workspaceId
        this.socketToWorkspace = new Map();

        // Configuration
        this.REPLAY_BUFFER_CAPACITY = 500; // Store last 500 data chunks. A good balance.

        // Start periodic cleanup of dead processes every 5 minutes
        this.cleanupInterval = setInterval(() => this.performPeriodicCleanup(), 5 * 60 * 1000);

        // Attempt to clean up sessions from DB on startup (for processes that died unexpectedly)
        this.restoreSessions();
    }

    /**
     * Main entry point for a socket connection requesting a terminal.
     * It intelligently decides whether to create a new session or resume an existing one.
     */
    async createPtyForSocket(socket, workspaceId) {
        try {
            // CRITICAL FIX: Detach socket from any previous workspace to prevent accumulation
            const previousWorkspaceId = this.socketToWorkspace.get(socket.id);
            if (previousWorkspaceId && previousWorkspaceId !== workspaceId) {
                const previousSession = this.activeSessions.get(previousWorkspaceId);
                if (previousSession) {
                    previousSession.sockets.delete(socket.id);
                    logger.info(`Socket ${socket.id} detached from previous workspace ${previousWorkspaceId} before switching to ${workspaceId}`);
                }
            }

            const workspace = await this.getWorkspaceForSession(socket, workspaceId);
            if (!workspace) return; // Error was already sent to the socket

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

        socket.emit('terminal-resumed', { workspaceId: session.workspace.id });
    }

    /**
     * Creates a brand new terminal session for a workspace.
     */
    async createNewSession(socket, workspace) {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: workspace.localPath,
            env: process.env,
        });

        const sessionData = {
            ptyProcess,
            workspace,
            sockets: new Set([socket.id]),
            buffer: new RingBuffer(this.REPLAY_BUFFER_CAPACITY) // Use RingBuffer
        };

        this.activeSessions.set(workspace.id, sessionData);
        this.socketToWorkspace.set(socket.id, workspace.id);

        // Pipe all data from the pty to connected sockets and the buffer
        ptyProcess.onData(data => {
            sessionData.buffer.push(data); // Always buffer recent output

            // Emit to all sockets currently viewing this session
            logger.info(`[PTY-DATA] Emitting terminal-output to ${sessionData.sockets.size} sockets: [${Array.from(sessionData.sockets).join(', ')}]`);
            sessionData.sockets.forEach(socketId => {
                const liveSocket = socket.server.sockets.sockets.get(socketId);
                liveSocket?.emit('terminal-output', data);
            });
        });

        // Handle pty exit
        ptyProcess.onExit(({ exitCode, signal }) => {
            logger.info(`PTY process exited for workspace ${workspace.id}: code=${exitCode}, signal=${signal}`);
            const message = `\r\nShell exited.\r\n`;

            sessionData.sockets.forEach(socketId => {
                const liveSocket = socket.server.sockets.sockets.get(socketId);
                liveSocket?.emit('terminal-output', message);
                liveSocket?.emit('terminal-killed', { workspaceId: workspace.id });
            });

            // Clean up the session from memory
            this.closeSession(workspace.id);
        });

        logger.info(`New PTY session created for workspace ${workspace.id} (PID: ${ptyProcess.pid}) with socket ${socket.id}`);
    }

    /**
     * Sends the content of the ring buffer to a newly connected socket.
     */
    replayHistory(socket, session) {
        if (!session.buffer) return;

        const bufferedChunks = session.buffer.getAll();
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
     * but keeps the PTY process alive.
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
            return error.code !== 'ESRCH';
        }
    }
}

module.exports = new ShellService();
