const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const GitHubService = require('./github.service');

const execAsync = promisify(exec);

// Retry utility for git operations
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      logger.warn(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}

class WorkspaceService {
  constructor() {
    this.workspaceBaseDir = path.join(process.cwd(), 'workspaces');
  }

  /**
   * Create a new workspace from GitHub repository
   * @param {string} githubRepo - Repository name (owner/repo)
   * @param {string} githubUrl - Repository clone URL
   * @returns {Promise<Object>} Created workspace
   */
  async createWorkspace(githubRepo, githubUrl) {
    if (!githubRepo || typeof githubRepo !== 'string') {
      throw new Error('GitHub repository must be a non-empty string');
    }
    if (!githubUrl || typeof githubUrl !== 'string') {
      throw new Error('GitHub URL must be a non-empty string');
    }

    try {
      // Check if workspace already exists
      const existingWorkspace = await prisma.workspace.findUnique({
        where: { githubRepo }
      });

      if (existingWorkspace && existingWorkspace.isActive) {
        throw new Error(`Workspace for ${githubRepo} already exists`);
      }

      // Extract repository name for local path
      const repoName = githubRepo.split('/')[1];
      const localPath = path.join(this.workspaceBaseDir, repoName);

      // Create workspace record (no user relation needed)
      const workspace = await prisma.workspace.create({
        data: {
          name: repoName,
          githubRepo,
          githubUrl,
          localPath
        }
      });

      logger.info(`Workspace created: ${workspace.id} for ${githubRepo}`);
      return workspace;

    } catch (error) {
      logger.error('Failed to create workspace:', error);
      throw error;
    }
  }

  /**
   * Clone GitHub repository to workspace
   * @param {string} workspaceId - Workspace ID
   * @returns {Promise<Object>} Updated workspace
   */
  async cloneRepository(workspaceId) {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId }
      });

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Verify GitHub token exists (needed for credential helper)
      const settingsService = require('./settings.service');
      const githubToken = await settingsService.getGithubToken();
      if (!githubToken) {
        throw new Error('GitHub token not found. Please authenticate with GitHub first.');
      }

      // Create workspace directory if it doesn't exist
      await fs.mkdir(this.workspaceBaseDir, { recursive: true });

      // Check if directory already exists
      try {
        await fs.access(workspace.localPath);
        logger.warn(`Directory already exists: ${workspace.localPath}`);
        // If directory exists, try to pull latest changes instead
        return await this.syncWithGitHub(workspaceId);
      } catch (error) {
        // Directory doesn't exist, proceed with clone
      }

      // Use clean HTTPS URL (no embedded tokens) - credentials handled by Git credential helper
      const cleanUrl = workspace.githubUrl;

      // Clone repository with retry logic
      logger.info(`Cloning repository: ${workspace.githubRepo} to ${workspace.localPath}`);

      const { stdout, stderr } = await retryOperation(async () => {
        const credentialHelper = path.join(process.cwd(), 'scripts', 'git-credential-oauth');
        
        return await execAsync(
          `git clone "${cleanUrl}" "${workspace.localPath}"`,
          {
            timeout: 300000, // 5 minute timeout
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            env: {
              ...process.env,
              GIT_CONFIG_COUNT: '2',
              GIT_CONFIG_KEY_0: 'credential.https://github.com.helper',
              GIT_CONFIG_VALUE_0: credentialHelper,
              GIT_CONFIG_KEY_1: 'credential.https://github.com.UseHttpPath',
              GIT_CONFIG_VALUE_1: 'true'
            }
          }
        );
      }, 3, 2000);

      if (stderr && !stderr.includes('Cloning into')) {
        logger.warn('Git clone warnings:', stderr);
      }

      logger.info('Repository cloned successfully:', stdout);

      // Configure Git credential helper for OAuth token authentication
      await this.configureGitCredentials(workspace.localPath);

      // Create CLAUDE.md file for the project
      await this.createClaudeMd(workspace);

      // Update workspace with sync time
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { lastSyncAt: new Date() }
      });

      logger.info(`Repository cloned successfully: ${workspace.githubRepo}`);
      return updatedWorkspace;

    } catch (error) {
      logger.error('Failed to clone repository:', error);
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * List all workspaces (single user system)
   * @param {boolean} includeInactive - Include inactive workspaces
   * @returns {Promise<Array>} Array of workspaces
   */
  async listWorkspaces(includeInactive = false) {
    try {
      const whereClause = includeInactive ? {} : { isActive: true };

      const workspaces = await prisma.workspace.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        include: {
          sessions: {
            where: { status: 'active' },
            select: { id: true, socketId: true, status: true, lastActivityAt: true }
          }
        }
      });

      logger.debug(`Found ${workspaces.length} workspaces`);
      return workspaces;
    } catch (error) {
      logger.error('Failed to list workspaces:', error);
      throw new Error('Failed to list workspaces');
    }
  }

  /**
   * Sync workspace with GitHub repository
   * @param {string} workspaceId - Workspace ID
   * @returns {Promise<Object>} Updated workspace
   */
  async syncWithGitHub(workspaceId) {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId }
      });

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check if local directory exists
      try {
        await fs.access(workspace.localPath);
      } catch (error) {
        // Directory doesn't exist, clone instead
        return await this.cloneRepository(workspaceId);
      }

      // Pull latest changes with retry logic
      logger.info(`Syncing workspace: ${workspace.githubRepo}`);

      const { stdout, stderr } = await retryOperation(async () => {
        return await execAsync('git pull origin', {
          cwd: workspace.localPath,
          timeout: 60000 // 1 minute timeout
        });
      }, 3, 1000);

      if (stderr && !stderr.includes('Already up to date')) {
        logger.warn('Git pull warnings:', stderr);
      }

      logger.info('Repository synced:', stdout);

      // Update workspace sync time
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { lastSyncAt: new Date() }
      });

      return updatedWorkspace;

    } catch (error) {
      logger.error('Failed to sync with GitHub:', error);
      throw new Error(`Failed to sync repository: ${error.message}`);
    }
  }

  /**
   * Get user's workspaces (deprecated - single user system)
   * @deprecated Use listWorkspaces() instead
   */
  async listUserWorkspaces(userId, includeInactive = false) {
    logger.warn('listUserWorkspaces is deprecated in single-user system, use listWorkspaces');
    return this.listWorkspaces(includeInactive);
  }

  /**
   * Delete workspace. This is a hard delete.
   * @param {string} workspaceId - Workspace ID
   * @param {boolean} deleteFiles - Whether to delete local files
   * @returns {Promise<boolean>} Success status
   */
  async deleteWorkspace(workspaceId, deleteFiles = false) {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Terminate any sessions associated with this workspace in the database.
      // This is for logical cleanup; the shell service handles killing the live process.
      await prisma.session.updateMany({
        where: { workspaceId: workspaceId },
        data: {
          status: 'terminated',
          endedAt: new Date(),
        },
      });

      // Delete local files if requested. Do this before deleting the DB record.
      if (deleteFiles) {
        try {
          await fs.rm(workspace.localPath, { recursive: true, force: true });
          logger.info(`Deleted workspace files: ${workspace.localPath}`);
        } catch (error) {
          logger.warn(`Failed to delete workspace files for ${workspace.localPath}:`, error);
          // Continue even if file deletion fails, but log it.
        }
      }

      // Now, delete the workspace record from the database.
      // This will free up the unique constraint on `githubRepo`.
      await prisma.workspace.delete({
        where: { id: workspaceId },
      });

      logger.info(`Workspace ${workspace.githubRepo} (ID: ${workspaceId}) deleted from database.`);
      return true;

    } catch (error) {
      logger.error('Failed to delete workspace:', error);
      throw error;
    }
  }

  /**
   * Get workspace by ID
   * @param {string} workspaceId - Workspace ID
   * @returns {Promise<Object|null>} Workspace or null
   */
  async getWorkspace(workspaceId) {
    try {
      return await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          sessions: {
            where: { status: 'active' }
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get workspace:', error);
      return null;
    }
  }

  /**
   * Get workspace path
   * @param {Object} workspace - Workspace object
   * @returns {string} Absolute path to workspace
   */
  getWorkspacePath(workspace) {
    return path.resolve(workspace.localPath);
  }

  /**
   * Get comprehensive workspace status including git status and active processes
   * @param {string} workspaceId - Workspace ID
   * @returns {Promise<Object|null>} Workspace status information
   */
  async getWorkspaceStatus(workspaceId) {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) return null;
    
    try {
      // Check if workspace directory exists
      try {
        await fs.access(workspace.localPath);
      } catch (error) {
        return {
          hasUncommittedChanges: false,
          currentBranch: 'unknown',
          hasActiveProcess: false,
          error: 'Workspace directory not found'
        };
      }

      // Get git status
      let hasUncommittedChanges = false;
      let fileCount = 0;
      try {
        const { stdout: statusOut } = await execAsync('git status --porcelain', {
          cwd: workspace.localPath,
          timeout: 5000
        });
        
        const statusLines = statusOut.trim().split('\n').filter(line => line.trim());
        hasUncommittedChanges = statusLines.length > 0;
        fileCount = statusLines.length;
      } catch (error) {
        logger.debug(`Git status failed for workspace ${workspaceId}:`, error.message);
      }
      
      // Get current branch
      let currentBranch = 'unknown';
      try {
        const { stdout: branchOut } = await execAsync('git branch --show-current', {
          cwd: workspace.localPath,
          timeout: 5000
        });
        currentBranch = branchOut.trim() || 'main';
      } catch (error) {
        logger.debug(`Git branch check failed for workspace ${workspaceId}:`, error.message);
      }

      // Get git remote status
      let behindAhead = null;
      try {
        const { stdout: remoteStatus } = await execAsync('git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0	0"', {
          cwd: workspace.localPath,
          timeout: 5000
        });
        const [behind, ahead] = remoteStatus.trim().split('\t').map(Number);
        behindAhead = { behind: behind || 0, ahead: ahead || 0 };
      } catch (error) {
        logger.debug(`Git remote status failed for workspace ${workspaceId}:`, error.message);
      }

      // Check if any processes are running (import shell service to avoid circular dependency)
      let hasActiveProcess = false;
      try {
        const shellService = require('./shell.service');
        hasActiveProcess = shellService.hasActiveProcessInWorkspace && 
                          shellService.hasActiveProcessInWorkspace(workspaceId);
      } catch (error) {
        logger.debug(`Process check failed for workspace ${workspaceId}:`, error.message);
      }
      
      return {
        hasUncommittedChanges,
        currentBranch,
        hasActiveProcess,
        fileCount,
        behindAhead,
        lastSyncAt: workspace.lastSyncAt,
        repositoryUrl: workspace.githubUrl
      };
    } catch (error) {
      logger.warn(`Failed to get status for workspace ${workspaceId}:`, error);
      return {
        hasUncommittedChanges: false,
        currentBranch: 'unknown',
        hasActiveProcess: false,
        error: error.message
      };
    }
  }

  /**
   * Create CLAUDE.md file for workspace
   * @param {Object} workspace - Workspace object
   */
  async createClaudeMd(workspace) {
    try {
      const claudeMdPath = path.join(workspace.localPath, 'CLAUDE.md');

      // Check if CLAUDE.md already exists
      try {
        await fs.access(claudeMdPath);
        logger.info(`CLAUDE.md already exists in ${workspace.githubRepo}`);
        return;
      } catch (error) {
        // File doesn't exist, create it
      }

      const claudeMdContent = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub repository cloned via the Claude Code Web Interface.

**Repository**: ${workspace.githubRepo}
**Clone URL**: ${workspace.githubUrl}
**Local Path**: ${workspace.localPath}
**Created**: ${new Date().toISOString()}

## Development Guidelines

Add project-specific instructions for Claude Code here:

- Build commands
- Test commands
- Development workflow
- Architecture notes
- Important files and directories
- Coding standards
- Dependencies

## Getting Started

1. Explore the codebase structure
2. Read any existing README.md files
3. Check package.json, Cargo.toml, or other dependency files
4. Look for existing documentation

## Notes

This CLAUDE.md file was automatically created by the Claude Code Web Interface.
You can customize it with project-specific information to help Claude Code work more effectively with your codebase.
`;

      await fs.writeFile(claudeMdPath, claudeMdContent, 'utf8');
      logger.info(`Created CLAUDE.md for ${workspace.githubRepo}`);

    } catch (error) {
      logger.warn('Failed to create CLAUDE.md:', error);
    }
  }

  /**
   * Configure Git credential helper for OAuth token authentication
   * @param {string} workspacePath - Path to the workspace directory
   */
  async configureGitCredentials(workspacePath) {
    try {
      const credentialHelper = path.join(process.cwd(), 'scripts', 'git-credential-oauth');
      
      // Configure Git credential helper specifically for GitHub
      const commands = [
        `git config credential.https://github.com.helper "${credentialHelper}"`,
        `git config credential.https://github.com.UseHttpPath true`
      ];

      for (const command of commands) {
        await execAsync(command, { cwd: workspacePath });
      }

      logger.info(`Configured Git credential helper for workspace: ${workspacePath}`);
    } catch (error) {
      logger.warn('Failed to configure Git credentials:', error);
      // Don't throw - this is not critical for basic functionality
    }
  }

  /**
   * Fix existing workspaces that have embedded tokens in their Git remote URLs
   * @param {string} workspaceId - Workspace ID to fix
   */
  async fixWorkspaceGitAuth(workspaceId) {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId }
      });

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // Check if workspace directory exists
      try {
        await fs.access(workspace.localPath);
      } catch (error) {
        logger.warn(`Workspace directory not found: ${workspace.localPath}`);
        return false;
      }

      // Get current remote URL
      let currentRemoteUrl;
      try {
        const { stdout } = await execAsync('git remote get-url origin', {
          cwd: workspace.localPath
        });
        currentRemoteUrl = stdout.trim();
      } catch (error) {
        logger.warn(`No Git repository found in workspace: ${workspace.localPath}`);
        return false;
      }

      // Check if URL has embedded token (contains @ before github.com)
      const hasEmbeddedToken = currentRemoteUrl.includes('@github.com') && 
                               currentRemoteUrl.startsWith('https://') &&
                               !currentRemoteUrl.startsWith('https://github.com');

      if (hasEmbeddedToken) {
        // Clean the URL by removing the embedded token
        const cleanUrl = currentRemoteUrl.replace(
          /https:\/\/[^@]+@github\.com/,
          'https://github.com'
        );

        // Update the remote URL
        await execAsync(`git remote set-url origin "${cleanUrl}"`, {
          cwd: workspace.localPath
        });

        logger.info(`Cleaned embedded token from remote URL in workspace: ${workspace.githubRepo}`);
      }

      // Configure Git credential helper
      await this.configureGitCredentials(workspace.localPath);

      logger.info(`Fixed Git authentication for workspace: ${workspace.githubRepo}`);
      return true;

    } catch (error) {
      logger.error(`Failed to fix Git authentication for workspace ${workspaceId}:`, error);
      return false;
    }
  }

  /**
   * Get username for user ID (deprecated - single user system)
   * @deprecated Single-user system doesn't need user lookup
   */
  async getUserName(userId) {
    logger.warn('getUserName is deprecated in single-user system');
    return process.env.TENANT_GITHUB_USERNAME || 'single-user';
  }

  /**
   * Cleanup inactive workspaces
   * @param {number} cleanupDays - Days of inactivity before cleanup
   * @returns {Promise<number>} Number of workspaces cleaned up
   */
  async cleanupInactiveWorkspaces(cleanupDays = 30) {
    try {
      const cutoffDate = new Date(Date.now() - (cleanupDays * 24 * 60 * 60 * 1000));

      // Find inactive workspaces
      const inactiveWorkspaces = await prisma.workspace.findMany({
        where: {
          isActive: true,
          updatedAt: {
            lt: cutoffDate
          },
          sessions: {
            none: {
              status: 'active'
            }
          }
        }
      });

      let cleanedUp = 0;

      for (const workspace of inactiveWorkspaces) {
        try {
          await this.deleteWorkspace(workspace.id, true);
          cleanedUp++;
        } catch (error) {
          logger.error(`Failed to cleanup workspace ${workspace.id}:`, error);
        }
      }

      logger.info(`Cleaned up ${cleanedUp} inactive workspaces`);
      return cleanedUp;

    } catch (error) {
      logger.error('Failed to cleanup inactive workspaces:', error);
      return 0;
    }
  }
}

module.exports = new WorkspaceService();
