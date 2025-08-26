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
    const files = await fs.readdir(this.contextDir);
    const contextFiles = files.filter(f => f.match(/^\d+_.*\.json$/));
    
    if (contextFiles.length === 0) {
      return 1;
    }
    
    const ids = contextFiles.map(f => parseInt(f.split('_')[0]));
    return Math.max(...ids) + 1;
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
   * List all context items
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
    for (const file of contextFiles) {
      const filePath = path.join(this.contextDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      items.push(JSON.parse(content));
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
   * Remove context items by indices
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
    
    // Remove files for specified indices (in reverse order to maintain indices)
    const sortedIndices = [...new Set(indices)].sort((a, b) => b - a);
    
    for (const index of sortedIndices) {
      if (index >= 0 && index < contextFiles.length) {
        const filePath = path.join(this.contextDir, contextFiles[index]);
        await fs.remove(filePath);
      }
    }
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