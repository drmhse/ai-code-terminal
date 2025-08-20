const { socketAuthMiddleware } = require('./auth.socket');
const shellService = require('../services/shell.service');
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
          return socket.emit('repositories-error', {
            error: 'GitHub token not found. Please authorize GitHub access first.'
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
        socket.emit('repositories-error', {
          error: error.message || 'Failed to load repositories'
        });
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
  }
}

module.exports = new SocketHandler();
