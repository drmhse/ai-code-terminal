const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { prisma } = require('../config/database');
const environment = require('../config/environment');

class GitHubService {
  constructor() {
    this.clientId = environment.GITHUB_CLIENT_ID;
    this.clientSecret = environment.GITHUB_CLIENT_SECRET;
    this.callbackUrl = environment.GITHUB_CALLBACK_URL;

    // Validate required configuration
    if (!this.clientId || !this.clientSecret || !this.callbackUrl) {
      logger.warn('GitHub OAuth configuration incomplete. GitHub integration will not be available.');
    }
  }

  /**
   * Generate GitHub OAuth authorization URL with state parameter
   * @param {string} userId - User ID for state verification
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(userId) {
    if (!this.isConfigured()) {
      throw new Error('GitHub OAuth is not configured');
    }

    const state = this.generateState(userId);
    const scopes = ['user:email', 'repo', 'read:org'];

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: scopes.join(' '),
      state: state,
      response_type: 'code'
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    logger.info(`Generated GitHub OAuth URL for user: ${userId}`);
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from GitHub
   * @param {string} state - State parameter for verification
   * @returns {Promise<Object>} Token response with user info
   */
  async exchangeCodeForToken(code, state) {
    if (!this.isConfigured()) {
      throw new Error('GitHub OAuth is not configured');
    }

    try {
      // Verify state parameter
      const userId = this.verifyState(state);
      if (!userId) {
        throw new Error('Invalid state parameter');
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'claude-code-web-interface'
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          redirect_uri: this.callbackUrl
        })
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      if (!tokenData.access_token) {
        throw new Error('No access token received from GitHub');
      }

      // Calculate expiration date
      const expiresIn = tokenData.expires_in || 28800; // Default to 8 hours if not provided
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Get user information
      const userInfo = await this.getUserInfo(tokenData.access_token);

      logger.info(`Successfully exchanged OAuth code for user: ${userInfo.login} (ID: ${userInfo.id})`);

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: expiresAt,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        user: userInfo,
        userId: userId
      };

    } catch (error) {
      logger.error('Failed to exchange GitHub code for token:', error);
      throw error;
    }
  }

  /**
   * Get GitHub user information
   * @param {string} accessToken - GitHub access token
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(accessToken) {
    try {
      const octokit = new Octokit({
        auth: accessToken,
        userAgent: 'claude-code-web-interface'
      });

      const { data: user } = await octokit.rest.users.getAuthenticated();

      // Get user's primary email
      const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
      const primaryEmail = emails.find(email => email.primary)?.email || user.email;

      return {
        id: user.id,
        login: user.login,
        name: user.name,
        email: primaryEmail,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        company: user.company,
        location: user.location,
        public_repos: user.public_repos,
        followers: user.followers,
        following: user.following
      };

    } catch (error) {
      logger.error('Failed to get GitHub user info:', error);
      throw new Error('Failed to retrieve GitHub user information');
    }
  }

  /**
   * Get user's repositories (updated to use centralized token management)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of repositories
   */
  async getUserRepositories(options = {}) {
    try {
      const octokit = await this.getOctokit();

      const {
        page = 1,
        per_page = 100, // Use max per_page for efficiency
        sort = 'updated',
        direction = 'desc',
        type = 'all'
      } = options;

      // Capture full response including headers for pagination
      const response = await octokit.rest.repos.listForAuthenticatedUser({
        page,
        per_page,
        sort,
        direction,
        type
      });

      const repos = response.data;
      const linkHeader = response.headers.link;

      // Parse Link header for pagination info
      const pagination = this.parseLinkHeader(linkHeader);

      // Return simplified repository information with pagination
      return {
        repositories: repos.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: {
            login: repo.owner.login,
            avatar_url: repo.owner.avatar_url
          },
          description: repo.description,
          html_url: repo.html_url,
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          private: repo.private,
          fork: repo.fork,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          updated_at: repo.updated_at,
          pushed_at: repo.pushed_at,
          size: repo.size,
          default_branch: repo.default_branch
        })),
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          has_next: pagination.hasNext,
          has_prev: pagination.hasPrev,
          total_count: repos.length,
          next_url: pagination.nextUrl,
          prev_url: pagination.prevUrl
        }
      };

    } catch (error) {
      logger.error('Failed to get GitHub repositories:', error);
      throw new Error('Failed to retrieve GitHub repositories');
    }
  }

  /**
   * Parse GitHub Link header for pagination information
   * @param {string} linkHeader - The Link header from GitHub API response
   * @returns {Object} Parsed pagination information
   */
  parseLinkHeader(linkHeader) {
    const pagination = {
      hasNext: false,
      hasPrev: false,
      nextUrl: null,
      prevUrl: null,
      firstUrl: null,
      lastUrl: null
    };

    if (!linkHeader) {
      return pagination;
    }

    // Parse Link header format: <url>; rel="type", <url>; rel="type"
    const links = linkHeader.split(',').map(link => link.trim());

    for (const link of links) {
      const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match) {
        const url = match[1];
        const rel = match[2];

        switch (rel) {
          case 'next':
            pagination.hasNext = true;
            pagination.nextUrl = url;
            break;
          case 'prev':
            pagination.hasPrev = true;
            pagination.prevUrl = url;
            break;
          case 'first':
            pagination.firstUrl = url;
            break;
          case 'last':
            pagination.lastUrl = url;
            break;
        }
      }
    }

    return pagination;
  }

  /**
   * Get specific repository information (updated to use centralized token management)
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository information
   */
  async getRepositoryInfo(owner, repo) {
    try {
      const octokit = await this.getOctokit();

      const { data: repository } = await octokit.rest.repos.get({
        owner,
        repo
      });

      return {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: {
          login: repository.owner.login,
          avatar_url: repository.owner.avatar_url
        },
        description: repository.description,
        html_url: repository.html_url,
        clone_url: repository.clone_url,
        ssh_url: repository.ssh_url,
        private: repository.private,
        fork: repository.fork,
        language: repository.language,
        stargazers_count: repository.stargazers_count,
        forks_count: repository.forks_count,
        updated_at: repository.updated_at,
        pushed_at: repository.pushed_at,
        size: repository.size,
        default_branch: repository.default_branch,
        permissions: repository.permissions
      };

    } catch (error) {
      logger.error('Failed to get repository info:', error);
      throw new Error('Failed to retrieve repository information');
    }
  }

  /**
   * Validate GitHub access token
   * @param {string} accessToken - GitHub access token
   * @returns {Promise<boolean>} Token validity
   */
  async validateToken(accessToken) {
    try {
      const octokit = new Octokit({
        auth: accessToken,
        userAgent: 'claude-code-web-interface'
      });

      await octokit.rest.users.getAuthenticated();
      return true;

    } catch (error) {
      logger.warn('GitHub token validation failed:', error.message);
      return false;
    }
  }

  /**
   * Refresh an expired access token using the stored refresh token
   * @returns {Promise<string>} The new, valid access token
   */
  async refreshToken() {
    logger.info('GitHub access token expired or invalid. Attempting to refresh...');

    // Import SettingsService here to avoid circular dependency
    const SettingsService = require('./settings.service');
    const currentSettings = await SettingsService.getRawSettings();

    if (!currentSettings?.githubRefreshToken) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    // Decrypt the refresh token before using it
    const encryption = require('../utils/encryption');
    const refreshToken = encryption.decryptToken(currentSettings.githubRefreshToken);

    const refreshResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const tokenData = await refreshResponse.json();

    if (tokenData.error) {
      logger.error('Failed to refresh GitHub token:', tokenData.error_description);
      // If refresh fails, clear the tokens to force re-authentication
      await SettingsService.updateGithubTokens(null, null, null);
      throw new Error(`Could not refresh GitHub token: ${tokenData.error_description}. Please re-authenticate.`);
    }

    const expiresIn = tokenData.expires_in || 28800;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await SettingsService.updateGithubTokens(
      tokenData.access_token,
      tokenData.refresh_token,
      expiresAt
    );

    logger.info('Successfully refreshed GitHub token.');
    return tokenData.access_token;
  }

  /**
   * Get a valid Octokit instance, refreshing the token if needed
   * This is the centralized method for all GitHub API operations
   * @returns {Promise<Octokit>} An authenticated Octokit instance
   */
  async getOctokit() {
    // Import SettingsService here to avoid circular dependency
    const SettingsService = require('./settings.service');
    const settings = await SettingsService.getSettings();

    if (!settings?.githubToken || !settings.githubTokenExpiresAt) {
      throw new Error('GitHub not authenticated.');
    }

    let accessToken = settings.githubToken;

    // Check if token is expired (with a 5-minute buffer)
    if (new Date() > new Date(settings.githubTokenExpiresAt.getTime() - 5 * 60 * 1000)) {
      accessToken = await this.refreshToken();
    }

    return new Octokit({
      auth: accessToken,
      userAgent: 'claude-code-web-interface'
    });
  }

  /**
   * Get authenticated user information using centralized token management
   * @returns {Promise<Object>} User information
   */
  async getAuthenticatedUserInfo() {
    try {
      const octokit = await this.getOctokit();
      const { data: user } = await octokit.rest.users.getAuthenticated();

      // Get user's primary email
      const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
      const primaryEmail = emails.find(email => email.primary)?.email || user.email;

      return {
        id: user.id,
        login: user.login,
        name: user.name,
        email: primaryEmail,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        company: user.company,
        location: user.location,
        public_repos: user.public_repos,
        followers: user.followers,
        following: user.following
      };

    } catch (error) {
      logger.error('Failed to get authenticated GitHub user info:', error);
      throw new Error('Failed to retrieve GitHub user information');
    }
  }

  /**
   * Revoke the GitHub OAuth grant and clear local tokens
   * This provides secure logout functionality
   */
  async revokeToken() {
    logger.info('Attempting to revoke GitHub token...');

    // Import SettingsService here to avoid circular dependency
    const SettingsService = require('./settings.service');
    const settings = await SettingsService.getSettings();

    if (!settings?.githubToken) {
      logger.warn('No GitHub token found to revoke. Clearing local tokens anyway.');
      await SettingsService.clearGithubTokens();
      return;
    }

    // Step 1: Tell GitHub to revoke the grant (best-effort)
    try {
      const response = await fetch(`https://api.github.com/applications/${this.clientId}/grant`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: settings.githubToken,
        }),
      });

      if (response.status === 204) {
        logger.info('Successfully revoked GitHub application grant.');
      } else {
        const errorBody = await response.json();
        logger.warn(`Failed to revoke GitHub grant (Status: ${response.status}):`, errorBody.message);
      }
    } catch (error) {
      logger.error('Error while trying to revoke GitHub grant:', error);
      // Do not re-throw; we must proceed to clear local tokens regardless
    }

    // Step 2: Clear tokens from our database (critical step)
    await SettingsService.clearGithubTokens();
  }

  /**
   * Generate state parameter for OAuth flow
   * @param {string} userId - User ID
   * @returns {string} Base64 encoded state
   */
  generateState(userId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    const payload = JSON.stringify({ userId, timestamp, random });
    return Buffer.from(payload).toString('base64');
  }

  /**
   * Verify state parameter and extract user ID
   * @param {string} state - Base64 encoded state
   * @returns {string|null} User ID if valid, null otherwise
   */
  verifyState(state) {
    try {
      const payload = JSON.parse(Buffer.from(state, 'base64').toString());
      const { userId, timestamp } = payload;

      // Check if state is not older than 10 minutes
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (Date.now() - timestamp > maxAge) {
        logger.warn('GitHub OAuth state parameter expired');
        return null;
      }

      return userId;

    } catch (error) {
      logger.warn('Invalid GitHub OAuth state parameter:', error.message);
      return null;
    }
  }

  /**
   * Check if GitHub OAuth is properly configured
   * @returns {boolean} Configuration status
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.callbackUrl);
  }

  /**
   * Store GitHub token for user
   * @param {string} userId - User ID
   * @param {string} accessToken - GitHub access token
   * @param {Object} userInfo - GitHub user information
   * @returns {Promise<Object>} Updated user
   */
  async storeUserToken(userId, accessToken, userInfo) {
    try {
      // Encrypt the access token before storing
      const encryptedToken = this.encryptToken(accessToken);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          githubId: userInfo.id.toString(),
          githubToken: encryptedToken,
          email: userInfo.email || undefined
        }
      });

      logger.info(`Stored GitHub token for user: ${updatedUser.username}`);
      return updatedUser;

    } catch (error) {
      logger.error('Failed to store GitHub token:', error);
      throw new Error('Failed to store GitHub token');
    }
  }

  /**
   * Get decrypted GitHub token for user
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Decrypted token or null
   */
  async getUserToken(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubToken: true }
      });

      if (!user?.githubToken) {
        return null;
      }

      return this.decryptToken(user.githubToken);

    } catch (error) {
      logger.error('Failed to get GitHub token:', error);
      return null;
    }
  }

  /**
   * Encrypt GitHub token for storage
   * @param {string} token - Plain text token
   * @returns {string} Encrypted token with IV
   */
  encryptToken(token) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(environment.JWT_SECRET, 'salt', 32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Token encryption failed:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt GitHub token from storage
   * @param {string} encryptedToken - Encrypted token with IV
   * @returns {string} Plain text token
   */
  decryptToken(encryptedToken) {
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format');
    }

    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(environment.JWT_SECRET, 'salt', 32);

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Token decryption failed:', error);
      throw new Error('Failed to decrypt token');
    }
  }
}

module.exports = new GitHubService();
