const GitHubService = require('../services/github.service');
const WorkspaceService = require('../services/workspace.service');
const SettingsService = require('../services/settings.service');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const environment = require('../config/environment');

class GitHubController {
  /**
   * Start GitHub OAuth authorization flow for single-tenant auth
   */
  async startAuthorization(req, res) {
    try {
      if (!GitHubService.isConfigured()) {
        return res.status(503).send('GitHub OAuth is not configured. Please check your environment variables.');
      }

      const authUrl = GitHubService.getAuthorizationUrl('single-tenant');
      
      // Redirect directly to GitHub
      res.redirect(authUrl);

    } catch (error) {
      logger.error('GitHub authorization start failed:', error);
      res.status(500).send('GitHub authorization failed: ' + error.message);
    }
  }

  /**
   * Handle GitHub OAuth callback for single-tenant authentication
   */
  async handleCallback(req, res) {
    try {
      const { code, state, error: oauthError } = req.query;

      // Handle OAuth errors
      if (oauthError) {
        logger.warn('GitHub OAuth error:', oauthError);
        return res.redirect(`/?error=${encodeURIComponent(oauthError)}`);
      }

      if (!code || !state) {
        return res.status(400).json({
          error: 'Invalid callback parameters',
          message: 'Missing code or state parameter'
        });
      }

      // Exchange code for token
      const tokenResult = await GitHubService.exchangeCodeForToken(code, state);
      
      // Get GitHub user info from the token result
      const githubUser = tokenResult.user;
      
      const allowedUsers = environment.TENANT_GITHUB_USERNAMES;
      if (!allowedUsers.includes(githubUser.login)) {
        logger.warn(`Unauthorized GitHub user attempted login: ${githubUser.login}`);
        return res.redirect(`/?error=${encodeURIComponent('Unauthorized user')}`);
      }

      // Store GitHub tokens (access token, refresh token, and expiration) in settings
      await SettingsService.updateGithubTokens(
        tokenResult.accessToken,
        tokenResult.refreshToken,
        tokenResult.expiresAt
      );
      
      // Generate simple JWT token (no user ID needed)
      const accessToken = jwt.sign(
        { authorized: true, username: githubUser.login },
        environment.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Redirect to main page with token
      res.redirect(`/?token=${accessToken}`);

    } catch (error) {
      logger.error('GitHub OAuth callback failed:', error);
      res.redirect(`/?error=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Get GitHub repositories (single user)
   */
  async getRepositories(req, res) {
    try {
      const { page = 1, per_page = 30, sort = 'updated', type = 'all' } = req.query;

      // The service now handles token validation and refresh internally
      const repositories = await GitHubService.getUserRepositories({
        page: parseInt(page),
        per_page: parseInt(per_page),
        sort,
        type
      });

      res.json({
        success: true,
        repositories,
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          has_more: repositories.length === parseInt(per_page)
        }
      });

    } catch (error) {
      logger.error('Failed to get repositories:', error);
      // Handle specific re-authentication error
      if (error.message.includes('Please re-authenticate')) {
        return res.status(401).json({ 
          error: 'Re-authentication required', 
          message: error.message 
        });
      }
      res.status(500).json({
        error: 'Failed to get repositories',
        message: error.message
      });
    }
  }

  /**
   * Get specific repository information
   */
  async getRepository(req, res) {
    try {
      const { owner, repo } = req.params;

      if (!owner || !repo) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'Owner and repo parameters are required'
        });
      }

      // The service now handles token validation and refresh internally
      const repository = await GitHubService.getRepositoryInfo(owner, repo);

      res.json({
        success: true,
        repository
      });

    } catch (error) {
      logger.error('Failed to get repository info:', error);
      // Handle specific re-authentication error
      if (error.message.includes('Please re-authenticate')) {
        return res.status(401).json({ 
          error: 'Re-authentication required', 
          message: error.message 
        });
      }
      res.status(500).json({
        error: 'Failed to get repository information',
        message: error.message
      });
    }
  }

  /**
   * Create workspace from GitHub repository (single user)
   */
  async createWorkspace(req, res) {
    try {
      const { githubRepo, githubUrl } = req.body;

      if (!githubRepo || !githubUrl) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'githubRepo and githubUrl are required'
        });
      }

      // Validate GitHub repository format (owner/repo)
      if (!githubRepo.match(/^[\w\-\.]+\/[\w\-\.]+$/)) {
        return res.status(400).json({
          error: 'Invalid repository format',
          message: 'Repository must be in format: owner/repo'
        });
      }

      // Create workspace (no user ID needed)
      const workspace = await WorkspaceService.createWorkspace(githubRepo, githubUrl);

      res.status(201).json({
        success: true,
        workspace,
        message: 'Workspace created successfully'
      });

    } catch (error) {
      logger.error('Failed to create workspace:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Workspace already exists',
          message: error.message
        });
      }

      if (error.message.includes('Maximum workspace limit')) {
        return res.status(429).json({
          error: 'Workspace limit reached',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to create workspace',
        message: error.message
      });
    }
  }

  /**
   * Clone repository to workspace
   */
  async cloneRepository(req, res) {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'Workspace ID is required'
        });
      }

      // Get workspace (single tenant - no ownership check needed)
      const workspace = await WorkspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          error: 'Workspace not found',
          message: 'Workspace not found'
        });
      }

      // Clone repository
      const updatedWorkspace = await WorkspaceService.cloneRepository(workspaceId);

      res.json({
        success: true,
        workspace: updatedWorkspace,
        message: 'Repository cloned successfully'
      });

    } catch (error) {
      logger.error('Failed to clone repository:', error);
      res.status(500).json({
        error: 'Failed to clone repository',
        message: error.message
      });
    }
  }

  /**
   * Get workspaces (single user)
   */
  async getWorkspaces(req, res) {
    try {
      const { include_inactive = 'false' } = req.query;

      const workspaces = await WorkspaceService.listWorkspaces(
        include_inactive === 'true'
      );

      res.json({
        success: true,
        workspaces,
        count: workspaces.length
      });

    } catch (error) {
      logger.error('Failed to get workspaces:', error);
      res.status(500).json({
        error: 'Failed to get workspaces',
        message: error.message
      });
    }
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(req, res) {
    try {
      const { workspaceId } = req.params;
      const { delete_files = 'false' } = req.query;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'Workspace ID is required'
        });
      }

      // Get workspace (single tenant - no ownership check needed)
      const workspace = await WorkspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          error: 'Workspace not found',
          message: 'Workspace not found'
        });
      }

      await WorkspaceService.deleteWorkspace(workspaceId, delete_files === 'true');

      res.json({
        success: true,
        message: 'Workspace deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete workspace:', error);
      res.status(500).json({
        error: 'Failed to delete workspace',
        message: error.message
      });
    }
  }

  /**
   * Sync workspace with GitHub
   */
  async syncWorkspace(req, res) {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'Workspace ID is required'
        });
      }

      // Get workspace (single tenant - no ownership check needed)
      const workspace = await WorkspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          error: 'Workspace not found',
          message: 'Workspace not found'
        });
      }

      const updatedWorkspace = await WorkspaceService.syncWithGitHub(workspaceId);

      res.json({
        success: true,
        workspace: updatedWorkspace,
        message: 'Workspace synced successfully'
      });

    } catch (error) {
      logger.error('Failed to sync workspace:', error);
      res.status(500).json({
        error: 'Failed to sync workspace',
        message: error.message
      });
    }
  }

  /**
   * Get GitHub authorization status
   */
  async getAuthStatus(req, res) {
    try {
      const settings = await SettingsService.getSettings();
      const isAuthorized = !!(settings?.githubToken && settings?.githubTokenExpiresAt);
      let userInfo = null;

      if (isAuthorized) {
        try {
          // This will automatically refresh the token if needed
          userInfo = await GitHubService.getAuthenticatedUserInfo();
        } catch (error) {
          // If we can't get user info, the tokens are invalid
          if (error.message.includes('Please re-authenticate')) {
            return res.json({
              success: true,
              authorized: false,
              message: 'GitHub token expired, re-authorization required'
            });
          }
          throw error; // Re-throw other errors
        }
      }

      res.json({
        success: true,
        authorized: isAuthorized && !!userInfo,
        userInfo,
        githubConfigured: GitHubService.isConfigured()
      });

    } catch (error) {
      logger.error('Failed to get auth status:', error);
      res.status(500).json({
        error: 'Failed to get authorization status',
        message: error.message
      });
    }
  }

  /**
   * Get user theme preferences
   */
  async getTheme(req, res) {
    try {
      const theme = await SettingsService.getTheme();
      
      res.json({
        success: true,
        theme
      });

    } catch (error) {
      logger.error('Failed to get theme preferences:', error);
      res.status(500).json({
        error: 'Failed to get theme preferences',
        message: error.message
      });
    }
  }

  /**
   * Update user theme preferences
   */
  async updateTheme(req, res) {
    try {
      const { theme } = req.body;

      if (!theme || typeof theme !== 'object') {
        return res.status(400).json({
          error: 'Invalid theme data',
          message: 'Theme data is required and must be an object'
        });
      }

      await SettingsService.updateTheme(theme);

      res.json({
        success: true,
        message: 'Theme preferences updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update theme preferences:', error);
      res.status(500).json({
        error: 'Failed to update theme preferences',
        message: error.message
      });
    }
  }

  /**
   * Handle user logout
   * Revokes the GitHub token and clears it from the database
   */
  async logout(req, res) {
    try {
      await GitHubService.revokeToken();
      
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout failed:', error);
      // Even if revocation fails, we proceed, but we should let the client know
      // The critical part (clearing our DB) happens in the service
      res.status(500).json({
        error: 'Logout failed',
        message: error.message
      });
    }
  }
}

module.exports = new GitHubController();