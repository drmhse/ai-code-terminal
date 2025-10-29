const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Manages the AI context buffer for a workspace
 * Handles adding, removing, and listing context items
 */
class ContextManager {
  constructor() {
    this.contextDir = this.getContextDir();
  }

  /**
   * Get the context directory for the current workspace
   */
  getContextDir() {
    const workspaceRoot = this.getWorkspaceRoot();
    const workspaceHash = crypto.createHash('md5').update(workspaceRoot).digest('hex');

    // Use container-specific path if we're in the AI coding terminal
    const homeDir = process.env.HOME || '/home/user';
    const actDir = path.join(homeDir, '.act');

    return path.join(actDir, 'context', workspaceHash);
  }

  /**
   * Get the workspace root directory
   */
  getWorkspaceRoot() {
    try {
      // Try to find git root first
      const gitRoot = execSync('git rev-parse --show-toplevel 2>/dev/null', { encoding: 'utf8' }).trim();
      return gitRoot;
    } catch (error) {
      // Fall back to current working directory
      return process.cwd();
    }
  }

  /**
   * Ensure context directory exists
   */
  async ensureContextDir() {
    await fs.ensureDir(this.contextDir);
  }

  /**
   * Get the next available context item ID
   */
  async getNextId() {
    await this.ensureContextDir();
    const counterFile = path.join(this.contextDir, '.counter');

    let counter = 1;
    if (await fs.pathExists(counterFile)) {
      try {
        counter = parseInt(await fs.readFile(counterFile, 'utf8'));
      } catch (error) {
        // If counter file is corrupted, start from 1
        counter = 1;
      }
    }

    const nextId = counter;
    await fs.writeFile(counterFile, (counter + 1).toString());
    return nextId;
  }

  /**
   * Add a file to the context buffer
   */
  async addFile(filePath) {
    const fullPath = path.resolve(filePath);

    if (!await fs.pathExists(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await fs.stat(fullPath);

    // File size protection - 5MB limit
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${Math.round(stats.size/1024/1024)}MB. Max: 5MB`);
    }

    if (stats.isDirectory()) {
      throw new Error(`Path is a directory. Use specific files or --exec "find ${filePath}" to list directory contents`);
    }

    const content = await fs.readFile(fullPath, 'utf8');
    const id = await this.getNextId();

    const contextItem = {
      metadata: {
        type: 'file',
        source: filePath,
        timestamp: new Date().toISOString(),
        size: Buffer.byteLength(content, 'utf8')
      },
      content
    };

    const filename = `${id}_file.json`;
    await this.ensureContextDir();
    await fs.writeFile(path.join(this.contextDir, filename), JSON.stringify(contextItem, null, 2));
  }

  /**
   * Add git diff to the context buffer
   */
  async addGitDiff(baseBranch = null) {
    try {
      let diffCommand;
      if (baseBranch) {
        diffCommand = `git diff ${baseBranch}...HEAD`;
      } else {
        diffCommand = 'git diff --cached';
      }

      const { stdout: diff } = await execAsync(diffCommand, { maxBuffer: 10 * 1024 * 1024 });

      if (!diff.trim()) {
        throw new Error(baseBranch ? `No changes found between ${baseBranch} and HEAD` : 'No staged changes found');
      }

      const id = await this.getNextId();
      const source = baseBranch ? `git diff ${baseBranch}...HEAD` : 'git diff --cached';

      const contextItem = {
        metadata: {
          type: 'diff',
          source,
          timestamp: new Date().toISOString(),
          size: Buffer.byteLength(diff, 'utf8')
        },
        content: diff
      };

      const filename = `${id}_diff.json`;
      await this.ensureContextDir();
      await fs.writeFile(path.join(this.contextDir, filename), JSON.stringify(contextItem, null, 2));
    } catch (error) {
      if (error.code === 'ENOENT' || error.stderr?.includes('not a git repository')) {
        throw new Error('Not in a git repository');
      }
      throw error;
    }
  }

  /**
   * Add command output to the context buffer
   */
  async addCommandOutput(command) {
    // Simple validation - reject dangerous chars
    if (/[;&|`$<>]/.test(command)) {
      throw new Error('Command contains unsafe characters. Use simple commands only.');
    }

    try {
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      const output = stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : '');

      if (!output.trim()) {
        throw new Error(`Command '${command}' produced no output`);
      }

      const id = await this.getNextId();

      const contextItem = {
        metadata: {
          type: 'exec',
          source: command,
          timestamp: new Date().toISOString(),
          size: Buffer.byteLength(output, 'utf8')
        },
        content: output
      };

      const filename = `${id}_exec.json`;
      await this.ensureContextDir();
      await fs.writeFile(path.join(this.contextDir, filename), JSON.stringify(contextItem, null, 2));
    } catch (error) {
      throw new Error(`Failed to execute command '${command}': ${error.message}`);
    }
  }

  /**
   * List all context items with integrity checking
   */
  async list() {
    await this.ensureContextDir();
    const files = await fs.readdir(this.contextDir);
    const contextFiles = files
      .filter(f => f.match(/^\d+_.*\.json$/))
      .sort((a, b) => {
        const aId = parseInt(a.split('_')[0]);
        const bId = parseInt(b.split('_')[0]);
        return aId - bId;
      });

    const items = [];
    const seenSources = new Set();
    const corruptedFiles = [];

    for (const file of contextFiles) {
      const filePath = path.join(this.contextDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const item = JSON.parse(content);

        // Validate required fields
        if (!item.metadata || !item.metadata.source || !item.content) {
          corruptedFiles.push(file);
          continue;
        }

        // Check for duplicates based on source + content hash
        const itemKey = `${item.metadata.source}:${crypto.createHash('md5').update(item.content).digest('hex')}`;
        if (seenSources.has(itemKey)) {
          // Remove duplicate file silently
          await fs.remove(filePath);
          continue;
        }

        seenSources.add(itemKey);
        items.push(item);
      } catch (error) {
        corruptedFiles.push(file);
      }
    }

    // Clean up corrupted files silently in production
    for (const file of corruptedFiles) {
      try {
        await fs.remove(path.join(this.contextDir, file));
      } catch (error) {
        // Ignore cleanup failures
      }
    }

    return items;
  }

  /**
   * Get a specific context item by index
   */
  async get(index) {
    const items = await this.list();
    return items[index] || null;
  }

  /**
   * Remove context items by indices (internal method)
   */
  async remove(indices) {
    await this.ensureContextDir();
    const files = await fs.readdir(this.contextDir);
    const contextFiles = files
      .filter(f => f.match(/^\d+_.*\.json$/))
      .sort((a, b) => {
        const aId = parseInt(a.split('_')[0]);
        const bId = parseInt(b.split('_')[0]);
        return aId - bId;
      });

    // Validate indices and collect files to remove
    const sortedIndices = [...new Set(indices)].sort((a, b) => b - a);
    const filesToRemove = [];

    for (const index of sortedIndices) {
      if (index >= 0 && index < contextFiles.length) {
        filesToRemove.push(path.join(this.contextDir, contextFiles[index]));
      }
    }

    // Atomic removal - if any fail, none are removed
    const backups = [];
    try {
      // Create backup of files to remove
      for (const filePath of filesToRemove) {
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.move(filePath, backupPath);
        backups.push({ original: filePath, backup: backupPath });
      }

      // If we reach here, all moves succeeded
      for (const { backup } of backups) {
        await fs.remove(backup);
      }

      return filesToRemove.length;
    } catch (error) {
      // Restore from backups on any failure
      for (const { original, backup } of backups) {
        if (await fs.pathExists(backup)) {
          await fs.move(backup, original);
        }
      }
      throw error;
    }
  }

  /**
   * Remove items by auto-detecting indices vs patterns
   */
  async removeItems(items) {
    const { minimatch } = require('minimatch');
    await this.ensureContextDir();

    // Get all current items first
    const contextItems = await this.list();
    const indicesToRemove = new Set();

    // Process each item to determine what to remove
    for (const item of items) {
      const asNumber = parseInt(item);
      if (!isNaN(asNumber) && asNumber > 0 && item === asNumber.toString()) {
        // Pure numeric string like "1", "2", "3" (convert to 0-based)
        const index = asNumber - 1;
        if (index >= 0 && index < contextItems.length) {
          indicesToRemove.add(index);
        }
      } else {
        // Pattern like "*.yml", "docker-compose.yml", or invalid numbers
        for (let i = 0; i < contextItems.length; i++) {
          const contextItem = contextItems[i];
          const basename = path.basename(contextItem.metadata.source);

          // Try exact basename match first, then glob pattern
          if (basename === item || minimatch(basename, item)) {
            indicesToRemove.add(i);
          }
        }
      }
    }

    if (indicesToRemove.size === 0) {
      // Check if any patterns were provided that didn't match
      const patterns = items.filter(item => {
        const asNumber = parseInt(item);
        return isNaN(asNumber) || asNumber <= 0 || item !== asNumber.toString();
      });

      if (patterns.length > 0) {
        throw new Error(`No items found matching patterns: ${patterns.join(', ')}`);
      }
      return 0;
    }

    // Convert set to sorted array for removal
    const sortedIndices = Array.from(indicesToRemove).sort((a, b) => a - b);
    return await this.remove(sortedIndices);
  }

  /**
   * Clear all context items
   */
  async clear() {
    await this.ensureContextDir();
    const files = await fs.readdir(this.contextDir);
    const contextFiles = files.filter(f => f.match(/^\d+_.*\.json$/));

    for (const file of contextFiles) {
      await fs.remove(path.join(this.contextDir, file));
    }
  }

  /**
   * Get formatted context for AI
   */
  async getFormattedContext() {
    const items = await this.list();

    if (items.length === 0) {
      return '';
    }

    let formatted = '### CONTEXT ###\n';

    for (const item of items) {
      formatted += `--- ${item.metadata.type}: ${item.metadata.source} ---\n`;
      formatted += `${item.content}\n\n`;
    }

    formatted += '### END CONTEXT ###\n\n';
    return formatted;
  }
}

module.exports = ContextManager;
