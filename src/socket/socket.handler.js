const { socketAuthMiddleware } = require('./auth.socket');
const shellService = require('../services/shell.service');
const workspaceService = require('../services/workspace.service');
const githubService = require('../services/github.service');
const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');

class SocketHandler {
  initialize(io) {
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
      socket.on('disconnect', (reason) => {
        logger.info(`User ${socket.user.username} disconnected (${socket.id}): ${reason}`);
        // Detach socket from session but keep process alive
        shellService.handleSocketDisconnect(socket.id);
      });
    });
  }
  
  registerTerminalHandlers(socket) {
    // Create terminal session
    socket.on('create-terminal', async (data) => {
      try {
        const { workspaceId } = data || {};
        await shellService.createPtyForSocket(socket, workspaceId);
      } catch (error) {
        logger.error('Error creating terminal:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Handle terminal input
    socket.on('terminal-input', (data) => {
      try {
        shellService.writeToPty(socket.id, data);
      } catch (error) {
        logger.error('Error handling terminal input:', error);
        socket.emit('terminal-error', { error: error.message });
      }
    });

    // Handle terminal resize
    socket.on('terminal-resize', (data) => {
      try {
        const { cols, rows } = data;
        shellService.resizePty(socket.id, cols, rows);
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
    
    // Kill terminal session explicitly
    socket.on('kill-terminal', async (data) => {
      try {
        const { workspaceId } = data || {};
        if (workspaceId) {
          await shellService.killSession(workspaceId);
          socket.emit('terminal-killed', { workspaceId });
        }
      } catch (error) {
        logger.error('Error killing terminal:', error);
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
        const { githubRepo, githubUrl } = data;
        
        if (!githubRepo || !githubUrl) {
          return socket.emit('workspace-error', { 
            error: 'Missing required parameters: githubRepo and githubUrl' 
          });
        }

        // Emit progress update
        socket.emit('workspace-progress', { 
          status: 'creating',
          message: `Creating workspace for ${githubRepo}...`
        });

        const workspace = await workspaceService.createWorkspace(
          githubRepo, 
          githubUrl
        );

        socket.emit('workspace-created', { workspace });
        
        // Auto-trigger repository cloning
        socket.emit('workspace-progress', { 
          status: 'cloning',
          workspaceId: workspace.id,
          message: `Cloning repository ${githubRepo}...`
        });

        try {
          const clonedWorkspace = await workspaceService.cloneRepository(workspace.id);
          socket.emit('workspace-cloned', { workspace: clonedWorkspace });
        } catch (cloneError) {
          logger.error('Auto-clone failed:', cloneError);
          socket.emit('workspace-error', { 
            error: `Workspace created but clone failed: ${cloneError.message}` 
          });
        }
        
        // Reload workspaces list
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

        // Get workspace (no ownership check needed for single user)
        const workspace = await workspaceService.getWorkspace(workspaceId);
        if (!workspace) {
          return socket.emit('workspace-error', { 
            error: 'Workspace not found' 
          });
        }

        await workspaceService.deleteWorkspace(workspaceId, deleteFiles);
        
        socket.emit('workspace-deleted', { workspaceId });
        
        // Reload workspaces list
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
        const { page = 1, per_page = 20, sort = 'updated' } = data || {};
        
        const githubToken = await settingsService.getGithubToken();
        if (!githubToken) {
          return socket.emit('repositories-error', { 
            error: 'GitHub token not found. Please authorize GitHub access first.' 
          });
        }

        // Emit loading state
        socket.emit('repositories-loading', { loading: true });

        const repositories = await githubService.getUserRepositories(githubToken, {
          page,
          per_page,
          sort
        });

        socket.emit('repositories-list', { 
          repositories,
          pagination: { page, per_page, has_more: repositories.length === per_page }
        });
        
      } catch (error) {
        logger.error('Error getting repositories:', error);
        socket.emit('repositories-error', { 
          error: error.message || 'Failed to load repositories' 
        });
      } finally {
        socket.emit('repositories-loading', { loading: false });
      }
    });
  }
}

module.exports = new SocketHandler();