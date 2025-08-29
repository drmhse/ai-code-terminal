const { socketAuthMiddleware } = require('./auth.socket');
const shellService = require('../services/multiplex-shell.service');
const terminalLayoutService = require('../services/terminal-layout.service');
const workspaceService = require('../services/workspace.service');
const githubService = require('../services/github.service');
const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');

class SocketHandler {
  initialize(io) {
    // Initialize shell service with Socket.IO instance for room-based communication
    shellService.setSocketIO(io);
    
    // JWT authentication middleware
    io.use(socketAuthMiddleware);

    // Connection handler
    io.on('connection', (socket) => {
      logger.info(`User ${socket.user.username} connected (${socket.id})`);

      // Load workspaces on connection
      this.loadWorkspaces(socket);

      // Register terminal handlers
      this.registerTerminalHandlers(socket);

      // Register workspace event handlers
      this.registerWorkspaceHandlers(socket);

      // Disconnect handler
      socket.on('disconnect', async (reason) => {
        logger.info(`User ${socket.user.username} disconnected (${socket.id}): ${reason}`);
        // Detach socket from session but keep process alive
        await shellService.handleSocketDisconnect(socket.id);
      });
    });
  }

  registerTerminalHandlers(socket) {
    // Create terminal session (with optional sessionId for multiplexing)
    socket.on('create-terminal', async (data) => {
      try {
        const { workspaceId, sessionId, recoveryToken } = data || {};
        const result = await shellService.createPtyForSocket(socket, workspaceId, sessionId, recoveryToken);
        
        // Emit session layout information
        if (result) {
          const workspaceSessions = shellService.getWorkspaceSessions(workspaceId);
          socket.emit('terminal-sessions-updated', { 
            workspaceId, 
            sessions: workspaceSessions 
          });
        }
      } catch (error) {
        logger.error('Error creating terminal:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Handle terminal input (with optional sessionId)
    socket.on('terminal-input', async (data) => {
      try {
        const { input, sessionId } = data;
        await shellService.writeToPty(socket.id, input || data, sessionId);
      } catch (error) {
        logger.error('Error handling terminal input:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Handle terminal resize (with optional sessionId)
    socket.on('terminal-resize', async (data) => {
      try {
        const { cols, rows, sessionId } = data;
        await shellService.resizePty(socket.id, cols, rows, sessionId);
      } catch (error) {
        logger.error('Error resizing terminal:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Get terminal session info
    socket.on('get-terminal-info', () => {
      try {
        const sessionInfo = shellService.getSessionInfo(socket.id);
        socket.emit('terminal-info', sessionInfo);
      } catch (error) {
        logger.error('Error getting terminal info:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Get all sessions for a workspace
    socket.on('get-workspace-sessions', async (data) => {
      try {
        const { workspaceId } = data || {};
        if (workspaceId) {
          const sessions = shellService.getWorkspaceSessions(workspaceId);
          
          // If there are existing sessions, connect to the default one (or first one) with history replay for workspace switching
          if (sessions.length > 0) {
            const defaultSession = sessions.find(s => s.isDefault) || sessions[0];
            const success = await shellService.switchSocketToSession(socket, workspaceId, defaultSession.sessionId, true); // true = replay history for workspace switching
            
            if (success) {
              socket.emit('terminal-session-switched', { 
                workspaceId, 
                sessionId: defaultSession.sessionId,
                success: true 
              });
            }
          }
          
          socket.emit('workspace-sessions', { workspaceId, sessions });
        }
      } catch (error) {
        logger.error('Error getting workspace sessions:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Create new terminal tab
    socket.on('create-terminal-tab', async (data) => {
      try {
        const { workspaceId, tabName } = data || {};
        if (workspaceId) {
          const tabInfo = await shellService.createNewTab(workspaceId, tabName);
          
          // Update session list
          const sessions = shellService.getWorkspaceSessions(workspaceId);
          socket.emit('terminal-tab-created', { 
            workspaceId, 
            tab: tabInfo,
            sessions 
          });
        }
      } catch (error) {
        logger.error('Error creating terminal tab:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Switch to a specific session (no history replay)
    socket.on('switch-terminal-session', async (data) => {
      try {
        const { workspaceId, sessionId } = data || {};
        if (workspaceId && sessionId) {
          const success = await shellService.switchSocketToSession(socket, workspaceId, sessionId);
          socket.emit('terminal-session-switched', { 
            workspaceId, 
            sessionId,
            success 
          });
        }
      } catch (error) {
        logger.error('Error switching terminal session:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Kill terminal session explicitly (with optional sessionId)
    socket.on('kill-terminal', async (data) => {
      try {
        const { workspaceId, sessionId } = data || {};
        if (workspaceId) {
          await shellService.killSession(workspaceId, sessionId);
          
          // Update session list
          const sessions = shellService.getWorkspaceSessions(workspaceId);
          socket.emit('terminal-killed', { workspaceId, sessionId });
          socket.emit('terminal-sessions-updated', { 
            workspaceId, 
            sessions 
          });
        }
      } catch (error) {
        logger.error('Error killing terminal:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Terminal layout management
    socket.on('get-terminal-layout', async (data) => {
      try {
        const { workspaceId } = data || {};
        if (workspaceId) {
          const layout = await terminalLayoutService.getDefaultLayout(workspaceId);
          socket.emit('terminal-layout', { workspaceId, layout });
        }
      } catch (error) {
        logger.error('Error getting terminal layout:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    socket.on('update-terminal-layout', async (data) => {
      try {
        const { layoutId, configuration } = data || {};
        if (layoutId && configuration) {
          const layout = await terminalLayoutService.updateLayoutConfiguration(layoutId, configuration);
          socket.emit('terminal-layout-updated', { layout });
        }
      } catch (error) {
        logger.error('Error updating terminal layout:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Convert to split layout
    socket.on('convert-to-split', async (data) => {
      try {
        const { workspaceId, layoutType, viewportWidth } = data || {};
        if (!workspaceId || !layoutType) {
          return socket.emit('terminal-error', { error: 'Missing workspaceId or layoutType' });
        }

        const result = await shellService.convertToSplitLayout(workspaceId, layoutType, viewportWidth || 1024);
        
        socket.emit('layout-converted', {
          workspaceId,
          layoutType,
          layout: result.layout,
          configuration: result.configuration,
          sessions: result.sessions
        });

        // Notify all clients in the workspace room
        socket.to(`workspace:${workspaceId}`).emit('layout-changed', {
          workspaceId,
          layoutType,
          configuration: result.configuration
        });

      } catch (error) {
        logger.error('Error converting to split layout:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Convert back to single pane layout
    socket.on('convert-to-single', async (data) => {
      try {
        const { workspaceId } = data || {};
        if (!workspaceId) {
          return socket.emit('terminal-error', { error: 'Missing workspaceId' });
        }

        const result = await shellService.convertToSingleLayout(workspaceId);
        
        socket.emit('layout-converted', {
          workspaceId,
          layoutType: 'single',
          layout: result.layout,
          sessions: result.sessions
        });

        // Notify all clients in the workspace room
        socket.to(`workspace:${workspaceId}`).emit('layout-changed', {
          workspaceId,
          layoutType: 'single'
        });

      } catch (error) {
        logger.error('Error converting to single pane layout:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Switch to a specific pane in split layout
    socket.on('switch-to-pane', async (data) => {
      try {
        const { workspaceId, paneId } = data || {};
        if (!workspaceId || !paneId) {
          return socket.emit('terminal-error', { error: 'Missing workspaceId or paneId' });
        }

        const paneInfo = await shellService.switchToPane(workspaceId, paneId);
        
        // Switch the socket to the pane's session
        if (paneInfo.sessionId) {
          const success = await shellService.switchSocketToSession(socket, workspaceId, paneInfo.sessionId, false);
          
          if (success) {
            socket.emit('pane-switched', {
              workspaceId,
              paneId,
              sessionId: paneInfo.sessionId,
              position: paneInfo.position
            });
          }
        }

      } catch (error) {
        logger.error('Error switching to pane:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Get layout recommendations based on viewport size
    socket.on('get-layout-recommendations', async (data) => {
      try {
        const { workspaceId, viewportWidth, sessionCount } = data || {};
        if (!workspaceId || !viewportWidth) {
          return socket.emit('terminal-error', { error: 'Missing workspaceId or viewportWidth' });
        }

        const currentSessions = shellService.getWorkspaceSessions(workspaceId);
        const actualSessionCount = sessionCount || currentSessions.length;
        
        const recommendedLayout = terminalLayoutService.getRecommendedLayout(viewportWidth, actualSessionCount);
        
        // Check which layouts are supported for this viewport
        const supportedLayouts = ['single', 'horizontal-split', 'vertical-split', 'three-pane', 'grid-2x2']
          .filter(layout => terminalLayoutService.isSplitLayoutSupported(viewportWidth, layout));

        socket.emit('layout-recommendations', {
          workspaceId,
          viewportWidth,
          sessionCount: actualSessionCount,
          recommended: recommendedLayout,
          supported: supportedLayouts
        });

      } catch (error) {
        logger.error('Error getting layout recommendations:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // IDE-Style Pane Tab Management

    // Move tab between panes
    socket.on('move-tab-between-panes', async (data) => {
      try {
        const { workspaceId, sessionId, sourcePaneId, targetPaneId, targetIndex } = data || {};
        if (!workspaceId || !sessionId || !sourcePaneId || !targetPaneId) {
          return socket.emit('terminal-error', { error: 'Missing required parameters for tab move' });
        }

        const layout = await terminalLayoutService.getDefaultLayout(workspaceId);
        const updatedLayout = await terminalLayoutService.moveTabBetweenPanes(
          layout.id, sessionId, sourcePaneId, targetPaneId, targetIndex
        );

        socket.emit('tab-moved', {
          workspaceId,
          sessionId,
          sourcePaneId,
          targetPaneId,
          layout: updatedLayout
        });

        // Notify all clients in the workspace room
        socket.to(`workspace:${workspaceId}`).emit('pane-layout-updated', {
          workspaceId,
          layout: updatedLayout
        });

      } catch (error) {
        logger.error('Error moving tab between panes:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Set active tab within a pane
    socket.on('set-active-pane-tab', async (data) => {
      try {
        const { workspaceId, paneId, sessionId } = data || {};
        if (!workspaceId || !paneId || !sessionId) {
          return socket.emit('terminal-error', { error: 'Missing workspaceId, paneId, or sessionId' });
        }

        const layout = await terminalLayoutService.getDefaultLayout(workspaceId);
        const updatedLayout = await terminalLayoutService.setActivePaneTab(layout.id, paneId, sessionId);

        // Switch the socket to the active tab's session
        const success = await shellService.switchSocketToSession(socket, workspaceId, sessionId, false);
        
        if (success) {
          socket.emit('pane-tab-activated', {
            workspaceId,
            paneId,
            sessionId,
            layout: updatedLayout
          });

          // Notify other clients about the layout change
          socket.to(`workspace:${workspaceId}`).emit('pane-layout-updated', {
            workspaceId,
            layout: updatedLayout
          });
        }

      } catch (error) {
        logger.error('Error setting active pane tab:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Add new tab to specific pane
    socket.on('add-tab-to-pane', async (data) => {
      try {
        const { workspaceId, paneId, tabName } = data || {};
        if (!workspaceId || !paneId) {
          return socket.emit('terminal-error', { error: 'Missing workspaceId or paneId' });
        }

        // Create new terminal session
        const tabInfo = await shellService.createNewTab(workspaceId, tabName || 'Terminal');
        
        // Add the new session to the specified pane
        const layout = await terminalLayoutService.getDefaultLayout(workspaceId);
        const updatedLayout = await terminalLayoutService.addTabToPane(layout.id, paneId, tabInfo.sessionId, true);

        socket.emit('tab-added-to-pane', {
          workspaceId,
          paneId,
          tab: tabInfo,
          layout: updatedLayout,
          sessions: shellService.getWorkspaceSessions(workspaceId)
        });

        // Notify all clients in the workspace room
        socket.to(`workspace:${workspaceId}`).emit('pane-layout-updated', {
          workspaceId,
          layout: updatedLayout,
          sessions: shellService.getWorkspaceSessions(workspaceId)
        });

      } catch (error) {
        logger.error('Error adding tab to pane:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Remove tab from pane
    socket.on('remove-tab-from-pane', async (data) => {
      try {
        const { workspaceId, paneId, sessionId } = data || {};
        if (!workspaceId || !paneId || !sessionId) {
          return socket.emit('terminal-error', { error: 'Missing workspaceId, paneId, or sessionId' });
        }

        // Remove tab from layout first
        const layout = await terminalLayoutService.getDefaultLayout(workspaceId);
        const updatedLayout = await terminalLayoutService.removeTabFromPane(layout.id, paneId, sessionId);

        // Kill the terminal session
        await shellService.killSession(workspaceId, sessionId);

        socket.emit('tab-removed-from-pane', {
          workspaceId,
          paneId,
          sessionId,
          layout: updatedLayout,
          sessions: shellService.getWorkspaceSessions(workspaceId)
        });

        // Notify all clients in the workspace room
        socket.to(`workspace:${workspaceId}`).emit('pane-layout-updated', {
          workspaceId,
          layout: updatedLayout,
          sessions: shellService.getWorkspaceSessions(workspaceId)
        });

      } catch (error) {
        logger.error('Error removing tab from pane:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });
  }

  async loadWorkspaces(socket) {
    try {
      const workspaces = await workspaceService.listWorkspaces();
      socket.emit('workspaces-list', { workspaces });
    } catch (error) {
      logger.error('Error loading workspaces:', error);
      socket.emit('error', { message: 'Failed to load workspaces' });
    }
  }

  registerWorkspaceHandlers(socket) {
    // Create workspace from repository
    socket.on('create-workspace', async (data) => {
      try {
        logger.info('Received create-workspace request:', data);
        const { githubRepo, githubUrl } = data;

        if (!githubRepo || !githubUrl) {
          logger.error('Missing required parameters for workspace creation');
          return socket.emit('workspace-error', {
            error: 'Missing required parameters: githubRepo and githubUrl'
          });
        }

        // Emit progress update
        logger.info('Emitting workspace-progress: creating');
        socket.emit('workspace-progress', {
          status: 'creating',
          message: `Creating workspace for ${githubRepo}...`
        });

        const workspace = await workspaceService.createWorkspace(
          githubRepo,
          githubUrl
        );
        logger.info('Workspace created successfully:', workspace.id);

        logger.info('Emitting workspace-created event');
        socket.emit('workspace-created', { workspace });

        // Auto-trigger repository cloning
        logger.info('Emitting workspace-progress: cloning');
        socket.emit('workspace-progress', {
          status: 'cloning',
          workspaceId: workspace.id,
          message: `Cloning repository ${githubRepo}...`
        });

        try {
          logger.info('Starting repository clone for workspace:', workspace.id);
          const clonedWorkspace = await workspaceService.cloneRepository(workspace.id);
          logger.info('Repository cloned successfully, emitting workspace-cloned');
          socket.emit('workspace-cloned', { workspace: clonedWorkspace });
        } catch (cloneError) {
          logger.error('Auto-clone failed:', cloneError);
          socket.emit('workspace-error', {
            error: `Workspace created but clone failed: ${cloneError.message}`
          });
        }

        // Reload workspaces list
        logger.info('Reloading workspaces list');
        await this.loadWorkspaces(socket);

      } catch (error) {
        logger.error('Error creating workspace:', error);
        socket.emit('workspace-error', {
          error: error.message || 'Failed to create workspace'
        });
      }
    });

    // Clone repository to workspace
    socket.on('clone-workspace', async (data) => {
      try {
        const { workspaceId } = data;

        if (!workspaceId) {
          return socket.emit('workspace-error', {
            error: 'Missing workspaceId parameter'
          });
        }

        // Get workspace (no ownership check needed for single user)
        const workspace = await workspaceService.getWorkspace(workspaceId);
        if (!workspace) {
          return socket.emit('workspace-error', {
            error: 'Workspace not found'
          });
        }

        // Emit progress update
        socket.emit('workspace-progress', {
          status: 'cloning',
          workspaceId,
          message: `Cloning repository ${workspace.githubRepo}...`
        });

        const updatedWorkspace = await workspaceService.cloneRepository(workspaceId);

        socket.emit('workspace-cloned', { workspace: updatedWorkspace });

        // Reload workspaces list
        await this.loadWorkspaces(socket);

      } catch (error) {
        logger.error('Error cloning workspace:', error);
        socket.emit('workspace-error', {
          error: error.message || 'Failed to clone repository'
        });
      }
    });

    // Delete workspace
    socket.on('delete-workspace', async (data) => {
      try {
        const { workspaceId, deleteFiles = false } = data;

        if (!workspaceId) {
          return socket.emit('workspace-error', {
            error: 'Missing workspaceId parameter'
          });
        }

        // Get workspace to ensure it exists before proceeding
        const workspace = await workspaceService.getWorkspace(workspaceId);
        if (!workspace) {
          return socket.emit('workspace-error', {
            error: 'Workspace not found'
          });
        }

        // First, kill any active shell session for this workspace
        shellService.killSession(workspaceId);

        // Then, proceed with deleting the workspace record and files
        await workspaceService.deleteWorkspace(workspaceId, deleteFiles);

        socket.emit('workspace-deleted', { workspaceId });

        // Reload workspaces list for the client
        await this.loadWorkspaces(socket);

      } catch (error) {
        logger.error('Error deleting workspace:', error);
        socket.emit('workspace-error', {
          error: error.message || 'Failed to delete workspace'
        });
      }
    });

    // Sync workspace with GitHub
    socket.on('sync-workspace', async (data) => {
      try {
        const { workspaceId } = data;

        if (!workspaceId) {
          return socket.emit('workspace-error', {
            error: 'Missing workspaceId parameter'
          });
        }

        // Get workspace (no ownership check needed for single user)
        const workspace = await workspaceService.getWorkspace(workspaceId);
        if (!workspace) {
          return socket.emit('workspace-error', {
            error: 'Workspace not found'
          });
        }

        // Emit progress update
        socket.emit('workspace-progress', {
          status: 'syncing',
          workspaceId,
          message: `Syncing workspace ${workspace.githubRepo}...`
        });

        const updatedWorkspace = await workspaceService.syncWithGitHub(workspaceId);

        socket.emit('workspace-synced', { workspace: updatedWorkspace });

        // Reload workspaces list
        await this.loadWorkspaces(socket);

      } catch (error) {
        logger.error('Error syncing workspace:', error);
        socket.emit('workspace-error', {
          error: error.message || 'Failed to sync workspace'
        });
      }
    });

    // Get GitHub repositories
    socket.on('get-repositories', async (data) => {
      try {
        const { page = 1, per_page = 100, sort = 'updated', search = '' } = data || {};

        const githubToken = await settingsService.getGithubToken();
        if (!githubToken) {
          logger.info('No GitHub token found, emitting auth-required event');
          return socket.emit('auth-required', {
            error: 'GitHub authentication required',
            message: 'Please authenticate with GitHub to access repositories',
            action: 'redirect_to_auth'
          });
        }

        // Emit loading state
        socket.emit('repositories-loading', { loading: true });

        // Get repositories with proper pagination
        const result = await githubService.getUserRepositories({
          page,
          per_page,
          sort
        });

        // Apply client-side search filtering if search term provided
        let repositories = result.repositories;
        if (search && search.trim()) {
          const searchTerm = search.toLowerCase().trim();
          repositories = repositories.filter(repo =>
            repo.name.toLowerCase().includes(searchTerm) ||
            repo.full_name.toLowerCase().includes(searchTerm) ||
            (repo.description && repo.description.toLowerCase().includes(searchTerm))
          );
        }

        socket.emit('repositories-list', {
          repositories,
          pagination: {
            ...result.pagination,
            has_more: result.pagination.has_next, // Use proper Link header info
            search_applied: !!search
          }
        });

      } catch (error) {
        logger.error('Error getting repositories:', error);
        logger.debug('Error message for auth check:', JSON.stringify(error.message));
        logger.debug('Error contains re-authenticate?', error.message && error.message.includes('Please re-authenticate'));
        
        // Classify error types for better frontend handling
        if (error.message && error.message.includes('Please re-authenticate')) {
          logger.info('Emitting auth-required event for authentication error');
          // Authentication required - emit specific event for auto-recovery
          socket.emit('auth-required', {
            error: 'GitHub authentication expired',
            message: 'Please re-authenticate with GitHub to continue',
            action: 'redirect_to_auth'
          });
        } else {
          logger.info('Emitting repositories-error event for generic error');
          // Generic error - emit standard error event
          socket.emit('repositories-error', {
            error: error.message || 'Failed to load repositories'
          });
        }
      } finally {
        socket.emit('repositories-loading', { loading: false });
      }
    });

    // Get workspace status
    socket.on('get-workspace-status', async (data) => {
      try {
        const { workspaceId } = data;

        if (!workspaceId) {
          return socket.emit('workspace-status-error', {
            error: 'Missing workspaceId parameter'
          });
        }

        const status = await workspaceService.getWorkspaceStatus(workspaceId);
        
        if (status === null) {
          return socket.emit('workspace-status-error', {
            error: 'Workspace not found'
          });
        }

        socket.emit('workspace-status', { workspaceId, status });

      } catch (error) {
        logger.error('Error getting workspace status:', error);
        socket.emit('workspace-status-error', {
          error: error.message || 'Failed to get workspace status'
        });
      }
    });

    // Fix workspace Git authentication (remove embedded tokens, configure credential helper)
    socket.on('fix-workspace-auth', async (data) => {
      try {
        const { workspaceId } = data;
        if (!workspaceId) {
          return socket.emit('workspace-auth-fix-error', {
            error: 'Missing workspaceId parameter'
          });
        }

        const success = await workspaceService.fixWorkspaceGitAuth(workspaceId);
        
        if (success) {
          socket.emit('workspace-auth-fixed', { 
            workspaceId,
            message: 'Git authentication configured successfully'
          });
        } else {
          socket.emit('workspace-auth-fix-error', {
            error: 'Failed to fix workspace Git authentication'
          });
        }

      } catch (error) {
        logger.error('Error fixing workspace Git auth:', error);
        socket.emit('workspace-auth-fix-error', {
          error: error.message || 'Failed to fix workspace authentication'
        });
      }
    });
  }
}

module.exports = new SocketHandler();
