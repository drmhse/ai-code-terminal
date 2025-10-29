const fs = require('fs').promises;
const path = require('path');
const { constants } = require('fs');
const logger = require('../utils/logger');
const workspaceService = require('../services/workspace.service');

class FileSystemController {

  /**
   * Get directory contents (files and folders)
   */
  async getDirectoryContents(req, res) {
    try {
      const { workspaceId } = req.params;
      const { path: requestedPath = '.' } = req.query;

      // Validate workspace access
      const workspace = await workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          error: 'Workspace not found'
        });
      }

      // Construct and validate the requested path
      const workspacePath = `/app/workspaces/${workspace.name}`;
      const fullPath = path.resolve(workspacePath, requestedPath);

      // Security check: ensure path is within workspace
      if (!fullPath.startsWith(workspacePath)) {
        return res.status(403).json({
          error: 'Access denied: Path outside workspace'
        });
      }

      // Check if path exists and is accessible
      try {
        await fs.access(fullPath, constants.R_OK);
      } catch (error) {
        return res.status(404).json({
          error: 'Path not found or not accessible'
        });
      }

      // Get directory stats
      const stats = await fs.stat(fullPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({
          error: 'Path is not a directory'
        });
      }

      // Read directory contents
      const items = await fs.readdir(fullPath);
      const contents = [];

      // Process each item
      for (const item of items) {
        try {
          const itemPath = path.join(fullPath, item);
          const itemStats = await fs.stat(itemPath);
          const relativePath = path.relative(workspacePath, itemPath);

          contents.push({
            name: item,
            path: relativePath,
            type: itemStats.isDirectory() ? 'directory' : 'file',
            size: itemStats.isFile() ? itemStats.size : null,
            modified: itemStats.mtime.toISOString(),
            isHidden: item.startsWith('.'),
            extension: itemStats.isFile() ? path.extname(item).slice(1) : null
          });
        } catch (error) {
          // Skip items we can't read (permissions, etc.)
          logger.warn(`Skipping item ${item}: ${error.message}`);
        }
      }

      // Sort contents: directories first, then files, alphabetically
      contents.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      res.json({
        success: true,
        path: path.relative(workspacePath, fullPath),
        contents
      });

    } catch (error) {
      logger.error('Error getting directory contents:', error);
      res.status(500).json({
        error: 'Failed to read directory contents'
      });
    }
  }

  /**
   * Get file contents for preview
   */
  async getFileContents(req, res) {
    try {
      const { workspaceId } = req.params;
      const { path: requestedPath } = req.query;
      const { limit = 1000 } = req.query; // Limit lines for preview

      if (!requestedPath) {
        return res.status(400).json({
          error: 'File path is required'
        });
      }

      // Validate workspace access
      const workspace = await workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          error: 'Workspace not found'
        });
      }

      // Construct and validate the requested path
      const workspacePath = `/app/workspaces/${workspace.name}`;
      const fullPath = path.resolve(workspacePath, requestedPath);

      // Security check: ensure path is within workspace
      if (!fullPath.startsWith(workspacePath)) {
        return res.status(403).json({
          error: 'Access denied: Path outside workspace'
        });
      }

      // Check if file exists and is accessible
      try {
        await fs.access(fullPath, constants.R_OK);
      } catch (error) {
        return res.status(404).json({
          error: 'File not found or not accessible'
        });
      }

      // Get file stats
      const stats = await fs.stat(fullPath);
      if (!stats.isFile()) {
        return res.status(400).json({
          error: 'Path is not a file'
        });
      }

      // Check file size (limit to 1MB for preview)
      const maxSize = 1024 * 1024; // 1MB
      if (stats.size > maxSize) {
        return res.json({
          success: true,
          path: requestedPath,
          content: null,
          truncated: true,
          message: `File too large for preview (${Math.round(stats.size / 1024 / 1024)}MB). Use terminal to view.`,
          size: stats.size,
          modified: stats.mtime.toISOString()
        });
      }

      // Check if file is binary
      const buffer = await fs.readFile(fullPath);
      const isBinary = this.isBinaryFile(buffer);

      if (isBinary) {
        return res.json({
          success: true,
          path: requestedPath,
          content: null,
          binary: true,
          message: 'Binary file - cannot preview',
          size: stats.size,
          modified: stats.mtime.toISOString()
        });
      }

      // Read text content
      let content = buffer.toString('utf8');
      let truncated = false;

      // Limit lines if requested
      const lines = content.split('\n');
      if (lines.length > limit) {
        content = lines.slice(0, limit).join('\n');
        truncated = true;
      }

      res.json({
        success: true,
        path: requestedPath,
        content,
        truncated,
        totalLines: lines.length,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        extension: path.extname(fullPath).slice(1)
      });

    } catch (error) {
      logger.error('Error getting file contents:', error);
      res.status(500).json({
        error: 'Failed to read file contents'
      });
    }
  }

  /**
   * Get file/directory information
   */
  async getFileInfo(req, res) {
    try {
      const { workspaceId } = req.params;
      const { path: requestedPath } = req.query;

      if (!requestedPath) {
        return res.status(400).json({
          error: 'Path is required'
        });
      }

      // Validate workspace access
      const workspace = await workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          error: 'Workspace not found'
        });
      }

      // Construct and validate the requested path
      const workspacePath = `/app/workspaces/${workspace.name}`;
      const fullPath = path.resolve(workspacePath, requestedPath);

      // Security check: ensure path is within workspace
      if (!fullPath.startsWith(workspacePath)) {
        return res.status(403).json({
          error: 'Access denied: Path outside workspace'
        });
      }

      // Check if path exists
      try {
        await fs.access(fullPath, constants.R_OK);
      } catch (error) {
        return res.status(404).json({
          error: 'Path not found or not accessible'
        });
      }

      // Get stats
      const stats = await fs.stat(fullPath);

      res.json({
        success: true,
        path: requestedPath,
        name: path.basename(fullPath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        extension: stats.isFile() ? path.extname(fullPath).slice(1) : null,
        permissions: {
          readable: true, // We already checked this
          writable: await this.isWritable(fullPath),
          executable: await this.isExecutable(fullPath)
        }
      });

    } catch (error) {
      logger.error('Error getting file info:', error);
      res.status(500).json({
        error: 'Failed to get file information'
      });
    }
  }

  /**
   * Check if file is binary by examining the first 512 bytes
   */
  isBinaryFile(buffer) {
    const chunk = buffer.slice(0, 512);
    for (let i = 0; i < chunk.length; i++) {
      const byte = chunk[i];
      // Check for null bytes (common in binary files)
      if (byte === 0) return true;
      // Check for non-printable ASCII characters (excluding common whitespace)
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) return true;
    }
    return false;
  }

  /**
   * Check if file/directory is writable
   */
  async isWritable(fullPath) {
    try {
      await fs.access(fullPath, constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file is executable
   */
  async isExecutable(fullPath) {
    try {
      await fs.access(fullPath, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save file contents (for file editing)
   */
  async saveFileContents(req, res) {
    try {
      const { workspaceId } = req.params;
      const { path: requestedPath, content } = req.body;

      if (!requestedPath) {
        return res.status(400).json({
          error: 'File path is required'
        });
      }

      if (typeof content !== 'string') {
        return res.status(400).json({
          error: 'Content must be a string'
        });
      }

      // Validate content size (prevent memory attacks)
      const maxContentSize = 10 * 1024 * 1024; // 10MB
      if (Buffer.byteLength(content, 'utf8') > maxContentSize) {
        return res.status(413).json({
          error: 'File content too large (10MB limit)'
        });
      }

      // Validate workspace access
      const workspace = await workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          error: 'Workspace not found'
        });
      }

      // Construct and validate the requested path
      const workspacePath = `/app/workspaces/${workspace.name}`;
      const fullPath = path.resolve(workspacePath, requestedPath);

      // Security check: ensure path is within workspace
      if (!fullPath.startsWith(workspacePath)) {
        return res.status(403).json({
          error: 'Access denied: Path outside workspace'
        });
      }

      // Check if file exists and get stats
      let fileExists = true;
      let stats = null;
      try {
        await fs.access(fullPath, constants.F_OK);
        stats = await fs.stat(fullPath);
      } catch (error) {
        fileExists = false;
      }

      // If file exists, validate it's a file and not too large
      if (fileExists) {
        if (stats && !stats.isFile()) {
          return res.status(400).json({
            error: 'Path is not a file'
          });
        }

        // Check if file is writable
        const isWritable = await this.isWritable(fullPath);
        if (!isWritable) {
          return res.status(403).json({
            error: 'File is not writable'
          });
        }

        // Size check - prevent saving very large files
        const maxSize = 10 * 1024 * 1024; // 10MB limit
        if (stats && stats.size > maxSize) {
          return res.status(413).json({
            error: 'File too large to edit (10MB limit)'
          });
        }
      }

      // Create backup of existing file
      let backupCreated = false;
      if (fileExists) {
        try {
          const backupPath = `${fullPath}.bak`;
          await fs.copyFile(fullPath, backupPath);
          backupCreated = true;
        } catch (error) {
          logger.warn(`Failed to create backup for ${fullPath}:`, error);
          // Continue without backup - better to save than fail
        }
      }

      // Write file atomically using temporary file
      const tempPath = `${fullPath}.tmp.${Date.now()}`;
      try {
        // Write to temporary file first
        await fs.writeFile(tempPath, content, 'utf8');
        
        // Atomic rename to final destination
        await fs.rename(tempPath, fullPath);

        // Get updated stats
        const updatedStats = await fs.stat(fullPath);

        res.json({
          success: true,
          path: requestedPath,
          size: updatedStats.size,
          modified: updatedStats.mtime.toISOString(),
          backupCreated
        });

        logger.info(`File saved successfully: ${fullPath}`);

      } catch (writeError) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }

        // If we created a backup and write failed, restore it
        if (backupCreated && fileExists) {
          try {
            const backupPath = `${fullPath}.bak`;
            await fs.copyFile(backupPath, fullPath);
            logger.info(`Restored backup after write failure: ${fullPath}`);
          } catch (restoreError) {
            logger.error(`Failed to restore backup for ${fullPath}:`, restoreError);
          }
        }

        throw writeError;
      }

    } catch (error) {
      logger.error('Error saving file contents:', error);
      
      // Return appropriate error message
      if (error.code === 'ENOSPC') {
        return res.status(507).json({
          error: 'Insufficient storage space'
        });
      } else if (error.code === 'EACCES') {
        return res.status(403).json({
          error: 'Permission denied'
        });
      } else {
        return res.status(500).json({
          error: 'Failed to save file contents'
        });
      }
    }
  }
}

module.exports = new FileSystemController();