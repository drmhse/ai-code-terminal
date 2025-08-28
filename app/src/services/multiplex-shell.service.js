const os = require('os');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs').promises;
const workspaceService = require('./workspace.service');
const sessionManager = require('./session-manager.service');
const terminalLayoutService = require('./terminal-layout.service');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const RingBuffer = require('../utils/RingBuffer');

/**
 * Persistent terminal session history with disk storage (per session)
 */
class SessionHistory {
    constructor(sessionId, workspaceId) {
        this.sessionId = sessionId;
        this.workspaceId = workspaceId;
        this.historyDir = '/home/claude/.terminal_history';
        this.historyFile = path.join(this.historyDir, `${workspaceId}_${sessionId}.log`);
        
        // Keep in-memory buffer for fast access
        this.memoryBuffer = new RingBuffer(2000);
        
        // Initialize and restore previous session - expose promise for awaiting
        this.initializationPromise = this.initialize();
    }
    
    async initialize() {
        try {
            await this.ensureHistoryDir();
            await this.restoreFromDisk();
        } catch (error) {
            logger.warn(`Failed to initialize history for session ${this.sessionId}:`, error);
        }
    }
    
    async ensureHistoryDir() {
        try {
            await fs.mkdir(this.historyDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    
    async write(data) {
        this.memoryBuffer.push(data);
        
        // Debug logging for history writes  
        if (data.trim()) {
            logger.debug(`SessionHistory: Writing ${data.length} chars to session ${this.sessionId} (buffer entries: ${this.memoryBuffer.getAll().length})`);
        }
        
        // Append to disk asynchronously
        this.writeToDisk(data).catch(error => {
            logger.warn(`SessionHistory: Failed to write history to disk for session ${this.sessionId}:`, error);
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
            const lines = content.split('\n').filter(line => line.trim()).slice(-2000);
            
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
                        logger.debug(`Skipping corrupted history entry for session ${this.sessionId}`);
                    }
                }
            }
            
            logger.info(`SessionHistory: Restored ${lines.length} history entries for session ${this.sessionId} from ${this.historyFile}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.warn(`SessionHistory: Failed to restore history from disk for session ${this.sessionId}:`, error);
            } else {
                logger.info(`SessionHistory: No existing history file for session ${this.sessionId} (new session)`);
            }
        }
    }
    
    getRecent() {
        return this.memoryBuffer.getAll();
    }
    
    clear() {
        this.memoryBuffer.clear();
        fs.unlink(this.historyFile).catch(() => {
            // File might not exist, that's fine
        });
    }
}

/**
 * Extended Shell Service with terminal multiplexing support
 * Supports multiple terminal sessions per workspace with tabs and splits
 */
class MultiplexShellService {
    constructor() {
        // Map: workspaceId -> { sessions: Map(sessionId -> sessionData), defaultSessionId, layout }
        this.workspaceSessions = new Map();
        // Map: socket.id -> { workspaceId, sessionId }
        this.socketToSession = new Map();
        // Map: socket.id -> Set(sessionIds) - tracks which sessions this socket has connected to in current workspace session
        this.socketSessionHistory = new Map();
        // Socket.IO instance for room-based emissions
        this.io = null;

        // Start periodic cleanup of dead processes every 5 minutes
        this.cleanupInterval = setInterval(() => this.performPeriodicCleanup(), 5 * 60 * 1000);

        // Restore sessions on startup
        this.restoreSessions();
    }

    /**
     * Initialize the service with Socket.IO instance
     * @param {Object} io - Socket.IO instance
     */
    setSocketIO(io) {
        this.io = io;
        logger.info('MultiplexShellService initialized with Socket.IO instance');
    }

    /**
     * Create or resume a terminal session for a socket
     * @param {Object} socket - Socket.IO socket
     * @param {string} workspaceId - Workspace ID
     * @param {string} sessionId - Optional specific session ID
     * @param {string} recoveryToken - Optional recovery token
     */
    async createPtyForSocket(socket, workspaceId, sessionId = null, recoveryToken = null) {
        try {
            // Handle previous session cleanup
            await this.handleSocketSessionChange(socket, workspaceId, sessionId);

            const workspace = await this.getWorkspaceForSession(socket, workspaceId);
            if (!workspace) return;

            // Join the workspace-specific room
            socket.join(`workspace:${workspace.id}`);
            
            // Get or create workspace session container
            let workspaceContainer = this.workspaceSessions.get(workspace.id);
            if (!workspaceContainer) {
                workspaceContainer = {
                    sessions: new Map(),
                    defaultSessionId: null,
                    layout: await terminalLayoutService.getDefaultLayout(workspace.id)
                };
                this.workspaceSessions.set(workspace.id, workspaceContainer);
            }

            let targetSessionId = sessionId;
            
            // If no specific session requested, use default or create one
            if (!targetSessionId) {
                if (workspaceContainer.defaultSessionId && 
                    workspaceContainer.sessions.has(workspaceContainer.defaultSessionId)) {
                    targetSessionId = workspaceContainer.defaultSessionId;
                } else {
                    // Create new default session
                    targetSessionId = await this.createNewSession(socket, workspace, 'Terminal', true);
                    workspaceContainer.defaultSessionId = targetSessionId;
                }
            }

            // Check if session exists in memory
            const existingSession = workspaceContainer.sessions.get(targetSessionId);
            if (existingSession) {
                await this.resumeSession(socket, existingSession, targetSessionId, false); // No history replay for existing sessions
                return { sessionId: targetSessionId, resumed: true };
            }

            // Try to recover session from database
            let dbSession = null;
            if (recoveryToken) {
                dbSession = await sessionManager.findSessionByRecoveryToken(recoveryToken);
            } else {
                dbSession = await prisma.session.findUnique({
                    where: { id: targetSessionId }
                });
            }

            if (dbSession && dbSession.workspaceId === workspace.id) {
                await this.recoverSession(socket, workspace, dbSession, targetSessionId);
                return { sessionId: targetSessionId, recovered: true };
            }

            // Create new session with the specified ID
            if (sessionId) {
                await this.createNewSessionWithId(socket, workspace, sessionId, 'Terminal');
                return { sessionId: sessionId, created: true };
            }

            // This shouldn't happen, but fallback
            const newSessionId = await this.createNewSession(socket, workspace, 'Terminal', !workspaceContainer.defaultSessionId);
            if (!workspaceContainer.defaultSessionId) {
                workspaceContainer.defaultSessionId = newSessionId;
            }
            
            return { sessionId: newSessionId, created: true };

        } catch (error) {
            logger.error('Failed to create/resume PTY session:', error);
            socket.emit('terminal-error', { error: `Error creating terminal session: ${error.message}` });
        }
    }

    /**
     * Create a new terminal session
     * @param {Object} socket - Socket.IO socket
     * @param {Object} workspace - Workspace object
     * @param {string} sessionName - Name for the session
     * @param {boolean} isDefault - Whether this is the default session
     * @returns {string} Session ID
     */
    async createNewSession(socket, workspace, sessionName = 'Terminal', isDefault = false) {
        const sessionData = await this.createPtyProcess(workspace, sessionName, isDefault);
        const sessionId = sessionData.sessionId;

        // Add to workspace container
        const workspaceContainer = this.workspaceSessions.get(workspace.id);
        workspaceContainer.sessions.set(sessionId, sessionData);

        // Set up socket relationship
        this.socketToSession.set(socket.id, { workspaceId: workspace.id, sessionId });
        sessionData.sockets.add(socket.id);

        // Set up PTY event handlers
        this.setupPtyHandlers(sessionData, workspace, sessionId);

        // Send creation confirmation
        socket.emit('terminal-created', {
            workspaceId: workspace.id,
            sessionId: sessionId,
            sessionName: sessionName,
            recoveryToken: sessionData.recoveryToken
        });

        logger.info(`New PTY session ${sessionId} created for workspace ${workspace.id} (PID: ${sessionData.ptyProcess.pid})`);
        return sessionId;
    }

    /**
     * Create a new session with a specific ID
     */
    async createNewSessionWithId(socket, workspace, sessionId, sessionName = 'Terminal') {
        const sessionData = await this.createPtyProcess(workspace, sessionName, false, sessionId);

        // Add to workspace container
        const workspaceContainer = this.workspaceSessions.get(workspace.id);
        workspaceContainer.sessions.set(sessionId, sessionData);

        // Set up socket relationship
        this.socketToSession.set(socket.id, { workspaceId: workspace.id, sessionId });
        sessionData.sockets.add(socket.id);

        // Set up PTY event handlers
        this.setupPtyHandlers(sessionData, workspace, sessionId);

        // Send creation confirmation
        socket.emit('terminal-created', {
            workspaceId: workspace.id,
            sessionId: sessionId,
            sessionName: sessionName,
            recoveryToken: sessionData.recoveryToken
        });

        logger.info(`New PTY session ${sessionId} created for workspace ${workspace.id} (PID: ${sessionData.ptyProcess.pid})`);
    }

    /**
     * Create PTY process and session data
     */
    async createPtyProcess(workspace, sessionName, isDefault, providedSessionId = null) {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        const shellArgs = os.platform() === 'win32' ? [] : ['--login'];
        
        const ptyProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color',
            cols: 80,
            rows: 30,
            cwd: workspace.localPath,
            env: {
                ...process.env,
                HOME: '/home/claude',
                USER: 'claude',
                SHELL: '/bin/bash',
                PS1: '\\[\\033[1;32m\\]\\u@\\h\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]$ ',
                PATH: `${process.env.PATH}:/home/claude/.local/bin`
            },
        });

        // Create session in database
        const dbSession = await sessionManager.createSession(
            workspace.id,
            ptyProcess.pid,
            null, // socket will be attached later
            { cols: 80, rows: 30 },
            sessionName,
            isDefault,
            providedSessionId
        );

        // Create and await SessionHistory initialization
        logger.info(`Creating SessionHistory for session ${dbSession.id} in workspace ${workspace.id}`);
        const history = new SessionHistory(dbSession.id, workspace.id);
        await history.initializationPromise; // Wait for history to be fully loaded
        logger.info(`SessionHistory initialization completed for session ${dbSession.id}`);

        const sessionData = {
            sessionId: dbSession.id,
            ptyProcess,
            workspace,
            sockets: new Set(),
            history: history,
            sessionManagerId: dbSession.id,
            recoveryToken: dbSession.recoveryToken,
            sessionName: sessionName,
            isDefault: isDefault
        };

        return sessionData;
    }

    /**
     * Resume an existing session
     */
    async resumeSession(socket, sessionData, sessionId, replayHistory = true) {
        logger.info(`Resuming session ${sessionId} for workspace ${sessionData.workspace.id}`);
        
        // Check if this is the first socket connecting to this session
        const isFirstConnection = sessionData.sockets.size === 0;
        
        sessionData.sockets.add(socket.id);
        this.socketToSession.set(socket.id, { 
            workspaceId: sessionData.workspace.id, 
            sessionId 
        });

        // Update session manager
        if (sessionData.sessionManagerId) {
            await sessionManager.attachSocketToSession(sessionData.sessionManagerId, socket.id);
        }

        // Only replay history if this is the first connection OR explicitly requested
        if (replayHistory && isFirstConnection) {
            this.replayHistory(socket, sessionData);
        }

        socket.emit('terminal-resumed', { 
            workspaceId: sessionData.workspace.id,
            sessionId: sessionId,
            sessionName: sessionData.sessionName,
            recoveryToken: sessionData.recoveryToken 
        });
    }

    /**
     * Recover session from database
     */
    async recoverSession(socket, workspace, dbSession, targetSessionId) {
        try {
            logger.info(`Attempting to recover session ${dbSession.id} for workspace ${workspace.id}`);

            // Parse recovered state
            const recoveredState = {
                currentDir: dbSession.currentWorkingDir || workspace.localPath,
                envVars: dbSession.environmentVars ? JSON.parse(dbSession.environmentVars) : {},
                terminalSize: dbSession.terminalSize ? JSON.parse(dbSession.terminalSize) : { cols: 80, rows: 30 }
            };

            const sessionData = await this.createPtyProcess(workspace, dbSession.sessionName, dbSession.isDefaultSession, targetSessionId);

            // Add to workspace container
            const workspaceContainer = this.workspaceSessions.get(workspace.id);
            workspaceContainer.sessions.set(targetSessionId, sessionData);

            // Set up socket relationship
            this.socketToSession.set(socket.id, { workspaceId: workspace.id, sessionId: targetSessionId });
            sessionData.sockets.add(socket.id);

            // Update database with new PID
            await prisma.session.update({
                where: { id: dbSession.id },
                data: { shellPid: sessionData.ptyProcess.pid }
            });

            // Set up PTY event handlers
            this.setupPtyHandlers(sessionData, workspace, targetSessionId);

            // Send recovery notification
            socket.emit('terminal-output', '\r\n\x1b[32m--- Session recovered ---\x1b[0m\r\n');
            
            socket.emit('terminal-recovered', {
                workspaceId: workspace.id,
                sessionId: targetSessionId,
                sessionName: dbSession.sessionName,
                recoveryToken: dbSession.recoveryToken,
                recoveredState
            });

            logger.info(`Successfully recovered session ${targetSessionId}`);

        } catch (error) {
            logger.error(`Failed to recover session ${dbSession.id}:`, error);
            throw error;
        }
    }

    /**
     * Set up PTY event handlers
     */
    setupPtyHandlers(sessionData, workspace, sessionId) {
        // Handle data output
        sessionData.ptyProcess.onData(data => {
            sessionData.history.write(data);

            // Emit to session-specific room
            if (this.io) {
                this.io.to(`workspace:${workspace.id}`).emit('terminal-output', {
                    sessionId: sessionId,
                    data: data
                });
            }

            // Update session activity
            if (sessionData.sessionManagerId) {
                sessionManager.updateSessionState(sessionData.sessionManagerId, {
                    lastCommand: data.trim()
                }).catch(error => {
                    logger.debug(`Failed to update session state: ${error.message}`);
                });
            }
        });

        // Handle pty exit
        sessionData.ptyProcess.onExit(async ({ exitCode, signal }) => {
            logger.info(`PTY process exited for session ${sessionId}: code=${exitCode}, signal=${signal}`);
            
            const message = `\r\nShell exited.\r\n`;
            
            if (this.io) {
                this.io.to(`workspace:${workspace.id}`).emit('terminal-output', {
                    sessionId: sessionId,
                    data: message
                });
                this.io.to(`workspace:${workspace.id}`).emit('terminal-killed', { 
                    workspaceId: workspace.id,
                    sessionId: sessionId
                });
            }

            // Terminate session in database
            if (sessionData.sessionManagerId) {
                await sessionManager.terminateSession(sessionData.sessionManagerId, 'process_exit');
            }

            // Clean up the session from memory
            this.closeSession(workspace.id, sessionId);
        });
    }

    /**
     * Handle socket session changes (switching sessions)
     */
    async handleSocketSessionChange(socket, newWorkspaceId, newSessionId) {
        const currentMapping = this.socketToSession.get(socket.id);
        
        if (currentMapping) {
            const { workspaceId: currentWorkspaceId, sessionId: currentSessionId } = currentMapping;
            
            // If switching workspaces or sessions
            if (currentWorkspaceId !== newWorkspaceId || 
                (newSessionId && currentSessionId !== newSessionId)) {
                
                // Leave previous workspace room
                socket.leave(`workspace:${currentWorkspaceId}`);
                
                // Remove socket from previous session
                const workspaceContainer = this.workspaceSessions.get(currentWorkspaceId);
                if (workspaceContainer && workspaceContainer.sessions.has(currentSessionId)) {
                    const sessionData = workspaceContainer.sessions.get(currentSessionId);
                    sessionData.sockets.delete(socket.id);
                    
                    // Update session manager
                    if (sessionData.sessionManagerId && sessionData.sockets.size === 0) {
                        await sessionManager.detachSocketFromSession(sessionData.sessionManagerId);
                    }
                }
                
                // Clear socket mapping (but keep session history tracking - it gets reset in switchSocketToSession)
                this.socketToSession.delete(socket.id);
                
                logger.info(`Socket ${socket.id} switched from ${currentWorkspaceId}:${currentSessionId} to ${newWorkspaceId}:${newSessionId || 'default'}`);
            }
        }
    }

    /**
     * Switch socket to an existing session
     * @param {Object} socket - Socket.IO socket
     * @param {string} workspaceId - Workspace ID
     * @param {string} sessionId - Target session ID
     * @param {boolean} replayHistory - Whether to replay session history (default: false for tab switching, true for workspace switching)
     */
    async switchSocketToSession(socket, workspaceId, sessionId, replayHistory = false) {
        try {
            const workspaceContainer = this.workspaceSessions.get(workspaceId);
            if (!workspaceContainer || !workspaceContainer.sessions.has(sessionId)) {
                logger.warn(`Session ${sessionId} not found for workspace ${workspaceId}`);
                return false;
            }

            // Handle previous session cleanup
            const currentMapping = this.socketToSession.get(socket.id);
            const isWorkspaceSwitch = !currentMapping || currentMapping.workspaceId !== workspaceId;
            
            // Check if this is the first time this socket connects to this session in this workspace session
            const socketSessions = this.socketSessionHistory.get(socket.id) || new Set();
            const isFirstSessionConnection = isWorkspaceSwitch || !socketSessions.has(sessionId);
            
            await this.handleSocketSessionChange(socket, workspaceId, sessionId);

            // Join the workspace room
            socket.join(`workspace:${workspaceId}`);

            // Get the target session
            const sessionData = workspaceContainer.sessions.get(sessionId);
            
            // Add socket to the session
            sessionData.sockets.add(socket.id);
            this.socketToSession.set(socket.id, { workspaceId, sessionId });

            // Track this session connection for this socket
            if (isWorkspaceSwitch) {
                // Clear previous workspace's session history
                this.socketSessionHistory.set(socket.id, new Set([sessionId]));
            } else {
                // Add this session to current workspace session history
                if (!this.socketSessionHistory.has(socket.id)) {
                    this.socketSessionHistory.set(socket.id, new Set());
                }
                this.socketSessionHistory.get(socket.id).add(sessionId);
            }

            // Update session manager
            if (sessionData.sessionManagerId) {
                await sessionManager.attachSocketToSession(sessionData.sessionManagerId, socket.id);
            }

            // Replay history if requested or if this is first connection to this session in this workspace session
            if (replayHistory || isFirstSessionConnection) {
                this.replayHistory(socket, sessionData);
                logger.info(`Socket ${socket.id} switched to session ${sessionId} with history replay (workspace switch: ${isWorkspaceSwitch}, first session connection: ${isFirstSessionConnection})`);
            } else {
                logger.info(`Socket ${socket.id} switched to session ${sessionId} (repeat tab switch, no history replay)`);
            }

            return true;

        } catch (error) {
            logger.error(`Failed to switch socket to session ${sessionId}:`, error);
            return false;
        }
    }

    /**
     * Write data to a specific session's PTY
     */
    async writeToPty(socketId, data, sessionId = null) {
        const mapping = this.socketToSession.get(socketId);
        if (!mapping) {
            logger.warn(`No session mapping found for socket ${socketId}`);
            return;
        }

        const targetSessionId = sessionId || mapping.sessionId;
        const workspaceContainer = this.workspaceSessions.get(mapping.workspaceId);
        
        if (!workspaceContainer || !workspaceContainer.sessions.has(targetSessionId)) {
            logger.warn(`Session ${targetSessionId} not found for socket ${socketId}`);
            return;
        }

        const sessionData = workspaceContainer.sessions.get(targetSessionId);
        if (sessionData?.ptyProcess) {
            sessionData.ptyProcess.write(data);

            // Track command input
            if (sessionData.sessionManagerId && data.trim()) {
                if (data.includes('\r') || data.includes('\n')) {
                    const command = data.replace(/[\r\n]/g, '').trim();
                    if (command) {
                        try {
                            await sessionManager.updateSessionState(sessionData.sessionManagerId, {
                                lastCommand: command
                            });
                        } catch (error) {
                            logger.debug(`Failed to track command: ${error.message}`);
                        }
                    }
                }
            }
        }
    }

    /**
     * Resize PTY for a specific session
     */
    async resizePty(socketId, cols, rows, sessionId = null) {
        const mapping = this.socketToSession.get(socketId);
        if (!mapping) return;

        const targetSessionId = sessionId || mapping.sessionId;
        const workspaceContainer = this.workspaceSessions.get(mapping.workspaceId);
        
        if (!workspaceContainer || !workspaceContainer.sessions.has(targetSessionId)) {
            return;
        }

        const sessionData = workspaceContainer.sessions.get(targetSessionId);
        if (sessionData && sessionData.ptyProcess) {
            sessionData.ptyProcess.resize(cols, rows);
            
            // Update session state
            if (sessionData.sessionManagerId) {
                try {
                    await sessionManager.updateSessionState(sessionData.sessionManagerId, {
                        terminalSize: { cols, rows }
                    });
                } catch (error) {
                    logger.debug(`Failed to update terminal size: ${error.message}`);
                }
            }
            
            logger.debug(`PTY resized for session ${targetSessionId}: ${cols}x${rows}`);
        }
    }

    /**
     * Get session information
     */
    getSessionInfo(socketId) {
        const mapping = this.socketToSession.get(socketId);
        if (!mapping) return null;

        const workspaceContainer = this.workspaceSessions.get(mapping.workspaceId);
        if (!workspaceContainer) return null;

        const sessionData = workspaceContainer.sessions.get(mapping.sessionId);
        if (!sessionData) return null;

        return {
            sessionId: mapping.sessionId,
            workspaceId: mapping.workspaceId,
            sessionName: sessionData.sessionName,
            pid: sessionData.ptyProcess.pid,
            isDefault: sessionData.isDefault,
            connectedSockets: sessionData.sockets.size
        };
    }

    /**
     * Get all sessions for a workspace
     */
    getWorkspaceSessions(workspaceId) {
        const workspaceContainer = this.workspaceSessions.get(workspaceId);
        if (!workspaceContainer) return [];

        return Array.from(workspaceContainer.sessions.entries()).map(([sessionId, sessionData]) => ({
            sessionId,
            sessionName: sessionData.sessionName,
            pid: sessionData.ptyProcess.pid,
            isDefault: sessionData.isDefault,
            connectedSockets: sessionData.sockets.size,
            status: sessionData.ptyProcess.killed ? 'killed' : 'active'
        }));
    }

    /**
     * Create a new terminal tab/session for a workspace
     */
    async createNewTab(workspaceId, tabName = 'Terminal') {
        try {
            const workspace = await workspaceService.getWorkspace(workspaceId);
            if (!workspace) {
                throw new Error('Workspace not found');
            }

            let workspaceContainer = this.workspaceSessions.get(workspaceId);
            if (!workspaceContainer) {
                workspaceContainer = {
                    sessions: new Map(),
                    defaultSessionId: null,
                    layout: await terminalLayoutService.getDefaultLayout(workspaceId)
                };
                this.workspaceSessions.set(workspaceId, workspaceContainer);
            }

            // Create new session without socket initially
            const sessionData = await this.createPtyProcess(workspace, tabName, false);
            const sessionId = sessionData.sessionId;
            
            workspaceContainer.sessions.set(sessionId, sessionData);

            // Set up PTY handlers
            this.setupPtyHandlers(sessionData, workspace, sessionId);

            // Add tab to layout
            await terminalLayoutService.addTabToLayout(workspaceContainer.layout.id, tabName);

            logger.info(`Created new tab ${sessionId} for workspace ${workspaceId}`);
            
            return {
                sessionId,
                sessionName: tabName,
                pid: sessionData.ptyProcess.pid
            };

        } catch (error) {
            logger.error(`Error creating new tab for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Close a specific session
     */
    async closeSession(workspaceId, sessionId) {
        const workspaceContainer = this.workspaceSessions.get(workspaceId);
        if (!workspaceContainer || !workspaceContainer.sessions.has(sessionId)) {
            return;
        }

        const sessionData = workspaceContainer.sessions.get(sessionId);
        
        // Kill PTY process
        if (sessionData.ptyProcess && !sessionData.ptyProcess.killed) {
            sessionData.ptyProcess.kill();
        }

        // Clean up socket mappings
        sessionData.sockets.forEach(socketId => {
            this.socketToSession.delete(socketId);
        });

        // Terminate session in database
        if (sessionData.sessionManagerId) {
            await sessionManager.terminateSession(sessionData.sessionManagerId, 'manual_close');
        }

        // Remove from workspace container
        workspaceContainer.sessions.delete(sessionId);

        // If this was the default session, reset default
        if (workspaceContainer.defaultSessionId === sessionId) {
            workspaceContainer.defaultSessionId = null;
            // Set another session as default if available
            if (workspaceContainer.sessions.size > 0) {
                workspaceContainer.defaultSessionId = workspaceContainer.sessions.keys().next().value;
            }
        }

        logger.info(`Closed session ${sessionId} for workspace ${workspaceId}`);
    }

    /**
     * Helper methods (similar to original shell service)
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
            const workspaces = await workspaceService.listWorkspaces();
            if (workspaces.length === 0) {
                socket.emit('terminal-error', { error: 'No workspaces exist. Please clone a repository first.' });
                return null;
            }
            workspace = workspaces[0];
        }
        return workspace;
    }

    replayHistory(socket, sessionData) {
        if (!sessionData.history) {
            logger.warn(`No history object available for session ${sessionData.sessionId}`);
            return;
        }

        const bufferedChunks = sessionData.history.getRecent();
        const totalChars = bufferedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        
        logger.info(`HISTORY REPLAY: Session ${sessionData.sessionId} - ${bufferedChunks.length} chunks, ${totalChars} total characters`);
        
        if (bufferedChunks.length > 0) {
            const replayOutput = bufferedChunks.join('');
            
            // Send history replay messages with session ID
            socket.emit('terminal-output', {
                sessionId: sessionData.sessionId,
                data: '\r\n\x1b[2m--- Replaying recent session history ---\x1b[0m\r\n'
            });
            socket.emit('terminal-output', {
                sessionId: sessionData.sessionId,
                data: replayOutput
            });
            socket.emit('terminal-output', {
                sessionId: sessionData.sessionId,
                data: '\r\n\x1b[2m--- End of history ---\x1b[0m\r\n'
            });
            
            logger.info(`HISTORY REPLAY COMPLETED: Session ${sessionData.sessionId} - sent ${replayOutput.length} characters to frontend`);
        } else {
            logger.info(`HISTORY REPLAY: No history chunks to replay for session ${sessionData.sessionId}`);
        }
    }

    async handleSocketDisconnect(socketId) {
        const mapping = this.socketToSession.get(socketId);
        if (mapping) {
            const { workspaceId, sessionId } = mapping;
            const workspaceContainer = this.workspaceSessions.get(workspaceId);
            
            if (workspaceContainer && workspaceContainer.sessions.has(sessionId)) {
                const sessionData = workspaceContainer.sessions.get(sessionId);
                sessionData.sockets.delete(socketId);
                
                logger.info(`Socket ${socketId} detached from session ${sessionId}. Remaining sockets: ${sessionData.sockets.size}`);

                // Update session manager if no more sockets
                if (sessionData.sessionManagerId && sessionData.sockets.size === 0) {
                    await sessionManager.detachSocketFromSession(sessionData.sessionManagerId);
                }
            }
            
            this.socketToSession.delete(socketId);
            this.socketSessionHistory.delete(socketId); // Clean up session history tracking
        }
    }

    async killSession(workspaceId, sessionId = null) {
        if (sessionId) {
            await this.closeSession(workspaceId, sessionId);
        } else {
            // Kill all sessions for workspace
            const workspaceContainer = this.workspaceSessions.get(workspaceId);
            if (workspaceContainer) {
                const sessionIds = Array.from(workspaceContainer.sessions.keys());
                for (const sid of sessionIds) {
                    await this.closeSession(workspaceId, sid);
                }
                this.workspaceSessions.delete(workspaceId);
            }
        }
    }

    getSessionStats() {
        const stats = {
            totalWorkspaces: this.workspaceSessions.size,
            totalSessions: 0,
            workspaces: []
        };

        for (const [workspaceId, container] of this.workspaceSessions) {
            const workspaceStats = {
                workspaceId,
                sessionCount: container.sessions.size,
                defaultSessionId: container.defaultSessionId,
                sessions: Array.from(container.sessions.entries()).map(([sessionId, sessionData]) => ({
                    sessionId,
                    sessionName: sessionData.sessionName,
                    pid: sessionData.ptyProcess.pid,
                    connectedSockets: sessionData.sockets.size,
                    isDefault: sessionData.isDefault
                }))
            };
            
            stats.workspaces.push(workspaceStats);
            stats.totalSessions += container.sessions.size;
        }

        return stats;
    }

    async performPeriodicCleanup() {
        let cleanedCount = 0;
        
        for (const [workspaceId, container] of this.workspaceSessions) {
            for (const [sessionId, sessionData] of container.sessions) {
                if (!this.isProcessAlive(sessionData.ptyProcess.pid)) {
                    logger.warn(`Found dead PTY process (PID: ${sessionData.ptyProcess.pid}) for session ${sessionId}. Cleaning up.`);
                    await this.closeSession(workspaceId, sessionId);
                    cleanedCount++;
                }
            }
        }
        
        if (cleanedCount > 0) {
            logger.info(`Periodic cleanup removed ${cleanedCount} stale sessions.`);
        }
    }

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

    isProcessAlive(pid) {
        if (!pid) return false;
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return error.code === 'EPERM';
        }
    }

    async cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Terminate all active sessions
        for (const [workspaceId, container] of this.workspaceSessions) {
            for (const [sessionId, sessionData] of container.sessions) {
                try {
                    if (sessionData.ptyProcess && !sessionData.ptyProcess.killed) {
                        sessionData.ptyProcess.kill();
                    }
                    if (sessionData.sessionManagerId) {
                        await sessionManager.terminateSession(sessionData.sessionManagerId, 'shutdown');
                    }
                } catch (error) {
                    logger.warn(`Failed to cleanup session ${sessionId}:`, error);
                }
            }
        }
        
        this.workspaceSessions.clear();
        this.socketToSession.clear();
        sessionManager.cleanup();
    }
}

module.exports = new MultiplexShellService();