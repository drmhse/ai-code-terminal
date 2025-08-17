// Process management utilities

const { spawn } = require('child_process');
const logger = require('./logger');

class ProcessUtil {
  constructor() {
    this.activeProcesses = new Map(); // Track active processes for cleanup
  }

  // Enhanced process spawning with better error handling
  spawnProcess(command, args = [], options = {}) {
    const defaultOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env }
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    logger.debug(`Spawning process: ${command} ${args.join(' ')}`, { 
      cwd: finalOptions.cwd,
      env: Object.keys(finalOptions.env || {})
    });

    try {
      const childProcess = spawn(command, args, finalOptions);
      
      // Track the process
      const processId = `${command}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.activeProcesses.set(processId, childProcess);

      // Remove from tracking when process ends
      childProcess.on('close', () => {
        this.activeProcesses.delete(processId);
      });

      return { process: childProcess, processId };
    } catch (error) {
      logger.error(`Failed to spawn process: ${command}`, error);
      throw error;
    }
  }

  // Graceful process termination
  killProcess(process, timeout = 5000) {
    return new Promise((resolve) => {
      if (!process || process.killed) {
        resolve(true);
        return;
      }

      const pid = process.pid;
      logger.debug(`Terminating process ${pid}`);

      // First try SIGTERM
      process.kill('SIGTERM');

      const killTimeout = setTimeout(() => {
        if (!process.killed) {
          logger.warn(`Process ${pid} did not terminate gracefully, using SIGKILL`);
          process.kill('SIGKILL');
        }
      }, timeout);

      process.on('close', () => {
        clearTimeout(killTimeout);
        logger.debug(`Process ${pid} terminated`);
        resolve(true);
      });
    });
  }

  // Kill all tracked processes (for graceful shutdown)
  async killAllProcesses() {
    const processes = Array.from(this.activeProcesses.values());
    const killPromises = processes.map(process => this.killProcess(process));
    
    try {
      await Promise.all(killPromises);
      logger.info(`Terminated ${processes.length} active processes`);
    } catch (error) {
      logger.error('Error terminating processes', error);
    }
  }

  // Process monitoring utilities
  isProcessRunning(process) {
    return !!(process && !process.killed && process.exitCode === null);
  }

  getProcessInfo(process) {
    if (!process) return null;
    
    return {
      pid: process.pid,
      killed: process.killed,
      exitCode: process.exitCode,
      signalCode: process.signalCode
    };
  }

  // Timeout wrapper for processes
  withTimeout(process, timeoutMs, onTimeout) {
    const timeout = setTimeout(() => {
      if (this.isProcessRunning(process)) {
        logger.warn(`Process ${process.pid} timed out after ${timeoutMs}ms`);
        if (onTimeout) onTimeout(process);
        this.killProcess(process);
      }
    }, timeoutMs);

    process.on('close', () => {
      clearTimeout(timeout);
    });

    return timeout;
  }

  // Stream handling utilities
  setupStreamHandlers(process, handlers = {}) {
    const { onStdout, onStderr, onClose, onError } = handlers;

    if (onStdout && process.stdout) {
      process.stdout.on('data', onStdout);
    }

    if (onStderr && process.stderr) {
      process.stderr.on('data', onStderr);
    }

    if (onClose) {
      process.on('close', onClose);
    }

    if (onError) {
      process.on('error', onError);
    }
  }

  // Resource monitoring
  getActiveProcessCount() {
    return this.activeProcesses.size;
  }

  getActiveProcessIds() {
    return Array.from(this.activeProcesses.keys());
  }

  // Process factory for common operations
  spawnClaudeProcess(args, options = {}) {
    const claudeOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    };

    return this.spawnProcess('claude', args, claudeOptions);
  }

  spawnGitProcess(args, options = {}) {
    const gitOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    };

    return this.spawnProcess('git', args, gitOptions);
  }

  // Cleanup on process exit
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, cleaning up processes...`);
      await this.killAllProcesses();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

module.exports = new ProcessUtil();