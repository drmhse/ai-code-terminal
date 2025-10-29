// Process supervisor service for tracking and managing user-initiated processes
// Handles process lifecycle, persistence, and auto-restart capabilities

const { PrismaClient } = require('@prisma/client');
const { spawn } = require('child_process');
const fs = require('fs');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class ProcessSupervisorService {
  constructor() {
    this.processes = new Map(); // pid -> { process, metadata }
    this.isRunning = false;
    this.monitoringInterval = null;
  }

  /**
   * Start the process supervisor
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Process supervisor already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting process supervisor service');

    // Restore processes from database on startup
    await this.restoreProcesses();

    // Start monitoring loop
    this.startMonitoring();

    logger.info('Process supervisor service started');
  }

  /**
   * Stop the process supervisor
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping process supervisor service');
    this.isRunning = false;

    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Update all tracked processes as stopped in database
    await this.updateAllProcessesStatus('stopped');

    // Clean up in-memory tracking
    this.processes.clear();

    logger.info('Process supervisor service stopped');
  }

  /**
   * Start monitoring processes
   */
  startMonitoring() {
    // Check process health every 10 seconds
    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.checkProcessHealth();
        await this.cleanupDeadProcesses();
      } catch (error) {
        logger.error('Error in process monitoring:', error);
      }
    }, 10000);
  }

  /**
   * Track a new user process
   */
  async trackProcess(command, args = [], options = {}) {
    try {
      const {
        cwd = process.cwd(),
        sessionId = null,
        workspaceId = null,
        autoRestart = false,
        env = process.env
      } = options;

      logger.info(`Starting tracked process: ${command} ${args.join(' ')}`);

      // Spawn the process
      const childProcess = spawn(command, args, {
        cwd,
        env,
        detached: false, // Keep attached so we can manage it
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const pid = childProcess.pid;
      
      if (!pid) {
        throw new Error('Failed to start process - no PID assigned');
      }

      // Store in database
      const processRecord = await prisma.userProcess.create({
        data: {
          pid,
          command,
          args: JSON.stringify(args),
          cwd,
          status: 'running',
          autoRestart,
          sessionId,
          workspaceId
        }
      });

      // Track in memory
      this.processes.set(pid, {
        process: childProcess,
        record: processRecord,
        command,
        args,
        startTime: Date.now()
      });

      // Set up process event handlers
      this.setupProcessHandlers(childProcess, processRecord);

      logger.info(`Process tracked successfully: PID ${pid}, ID ${processRecord.id}`);
      
      return {
        pid,
        id: processRecord.id,
        process: childProcess
      };

    } catch (error) {
      logger.error('Error tracking process:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers for a process
   */
  setupProcessHandlers(childProcess, processRecord) {
    const pid = childProcess.pid;

    childProcess.on('exit', async (code, signal) => {
      logger.info(`Process ${pid} exited with code ${code}, signal ${signal}`);
      
      try {
        // Update database
        await prisma.userProcess.update({
          where: { id: processRecord.id },
          data: {
            status: code === 0 ? 'stopped' : 'crashed',
            exitCode: code,
            endedAt: new Date()
          }
        });

        // Handle auto-restart
        if (processRecord.autoRestart && code !== 0) {
          logger.info(`Auto-restarting process ${pid}`);
          await this.restartProcess(processRecord.id);
        }

      } catch (error) {
        logger.error(`Error handling process exit for PID ${pid}:`, error);
      }

      // Remove from memory tracking
      this.processes.delete(pid);
    });

    childProcess.on('error', async (error) => {
      logger.error(`Process ${pid} error:`, error);
      
      try {
        await prisma.userProcess.update({
          where: { id: processRecord.id },
          data: {
            status: 'crashed',
            endedAt: new Date()
          }
        });
      } catch (dbError) {
        logger.error(`Error updating process status for PID ${pid}:`, dbError);
      }
    });
  }

  /**
   * Stop a tracked process
   */
  async stopProcess(processId) {
    try {
      const processRecord = await prisma.userProcess.findUnique({
        where: { id: processId }
      });

      if (!processRecord) {
        throw new Error(`Process ${processId} not found`);
      }

      const trackedProcess = this.processes.get(processRecord.pid);
      
      if (trackedProcess && trackedProcess.process) {
        // Try graceful shutdown first
        trackedProcess.process.kill('SIGTERM');
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (this.processes.has(processRecord.pid)) {
            logger.warn(`Force killing process ${processRecord.pid}`);
            trackedProcess.process.kill('SIGKILL');
          }
        }, 5000);
      }

      // Update database
      await prisma.userProcess.update({
        where: { id: processId },
        data: {
          status: 'killed',
          endedAt: new Date()
        }
      });

      logger.info(`Stopped process ${processId} (PID: ${processRecord.pid})`);

    } catch (error) {
      logger.error('Error stopping process:', error);
      throw error;
    }
  }

  /**
   * Restart a process
   */
  async restartProcess(processId) {
    try {
      const processRecord = await prisma.userProcess.findUnique({
        where: { id: processId }
      });

      if (!processRecord) {
        throw new Error(`Process ${processId} not found`);
      }

      // Stop existing process if running
      const trackedProcess = this.processes.get(processRecord.pid);
      if (trackedProcess) {
        trackedProcess.process.kill('SIGTERM');
      }

      // Parse args and restart
      const args = processRecord.args ? JSON.parse(processRecord.args) : [];
      
      const newProcess = await this.trackProcess(processRecord.command, args, {
        cwd: processRecord.cwd,
        sessionId: processRecord.sessionId,
        workspaceId: processRecord.workspaceId,
        autoRestart: processRecord.autoRestart
      });

      // Update restart count
      await prisma.userProcess.update({
        where: { id: processId },
        data: {
          status: 'stopped', // Mark old process as stopped
          endedAt: new Date()
        }
      });

      await prisma.userProcess.update({
        where: { id: newProcess.id },
        data: {
          restartCount: processRecord.restartCount + 1
        }
      });

      logger.info(`Restarted process ${processId} as new process ${newProcess.id}`);
      return newProcess;

    } catch (error) {
      logger.error('Error restarting process:', error);
      throw error;
    }
  }

  /**
   * Get all tracked processes
   */
  async getProcesses() {
    try {
      return await prisma.userProcess.findMany({
        include: {
          session: true,
          workspace: true
        },
        orderBy: {
          startedAt: 'desc'
        }
      });
    } catch (error) {
      logger.error('Error getting processes:', error);
      throw error;
    }
  }

  /**
   * Check if processes are still running
   */
  async checkProcessHealth() {
    const activeProcesses = await prisma.userProcess.findMany({
      where: {
        status: 'running'
      }
    });

    for (const processRecord of activeProcesses) {
      const isAlive = this.isProcessAlive(processRecord.pid);
      
      if (!isAlive) {
        logger.warn(`Process ${processRecord.pid} is no longer running`);
        
        await prisma.userProcess.update({
          where: { id: processRecord.id },
          data: {
            status: 'crashed',
            endedAt: new Date()
          }
        });

        // Remove from memory if tracked
        this.processes.delete(processRecord.pid);
      } else {
        // Update last seen
        await prisma.userProcess.update({
          where: { id: processRecord.id },
          data: {
            lastSeen: new Date()
          }
        });
      }
    }
  }

  /**
   * Check if a process is alive by PID
   */
  isProcessAlive(pid) {
    try {
      // Sending signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up old process records
   */
  async cleanupDeadProcesses() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await prisma.userProcess.deleteMany({
      where: {
        AND: [
          {
            OR: [
              { status: 'stopped' },
              { status: 'crashed' },
              { status: 'killed' }
            ]
          },
          {
            endedAt: {
              lt: oneDayAgo
            }
          }
        ]
      }
    });

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} old process records`);
    }
  }

  /**
   * Restore processes from database on startup
   */
  async restoreProcesses() {
    try {
      const runningProcesses = await prisma.userProcess.findMany({
        where: {
          status: 'running'
        }
      });

      logger.info(`Checking ${runningProcesses.length} processes from previous session`);

      for (const processRecord of runningProcesses) {
        const isAlive = this.isProcessAlive(processRecord.pid);
        
        if (!isAlive) {
          // Mark as crashed since it's not running anymore
          await prisma.userProcess.update({
            where: { id: processRecord.id },
            data: {
              status: 'crashed',
              endedAt: new Date()
            }
          });
          
          logger.warn(`Process ${processRecord.pid} was not restored - marked as crashed`);
          
          // Auto-restart if enabled
          if (processRecord.autoRestart) {
            logger.info(`Auto-restarting process ${processRecord.id}`);
            await this.restartProcess(processRecord.id);
          }
        } else {
          logger.info(`Process ${processRecord.pid} is still running - restored to tracking`);
          // Note: We don't fully restore the child_process object since we can't 
          // re-attach to existing processes, but we can monitor them
        }
      }

    } catch (error) {
      logger.error('Error restoring processes:', error);
    }
  }

  /**
   * Update all processes status (used during shutdown)
   */
  async updateAllProcessesStatus(status) {
    try {
      const result = await prisma.userProcess.updateMany({
        where: {
          status: 'running'
        },
        data: {
          status,
          endedAt: new Date()
        }
      });

      if (result.count > 0) {
        logger.info(`Updated ${result.count} running processes to status: ${status}`);
      }
    } catch (error) {
      logger.error('Error updating process statuses:', error);
    }
  }

  /**
   * Get process supervisor status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      trackedProcesses: this.processes.size,
      monitoringActive: !!this.monitoringInterval
    };
  }
}

// Export singleton instance
const processSupervisorService = new ProcessSupervisorService();

module.exports = processSupervisorService;