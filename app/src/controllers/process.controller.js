// Process management controller
// Provides API endpoints for managing user-initiated processes

const processSupervisorService = require('../services/process-supervisor.service');
const logger = require('../utils/logger');

class ProcessController {
  
  /**
   * Get all tracked processes
   */
  async getProcesses(req, res) {
    try {
      const processes = await processSupervisorService.getProcesses();
      
      res.json({
        success: true,
        data: processes,
        count: processes.length
      });
    } catch (error) {
      logger.error('Error getting processes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processes',
        message: error.message
      });
    }
  }

  /**
   * Start tracking a new process
   */
  async startProcess(req, res) {
    try {
      const { command, args = [], options = {} } = req.body;

      if (!command) {
        return res.status(400).json({
          success: false,
          error: 'Command is required'
        });
      }

      // Add user context to options
      options.sessionId = req.body.sessionId || null;
      options.workspaceId = req.body.workspaceId || null;

      const result = await processSupervisorService.trackProcess(command, args, options);
      
      res.json({
        success: true,
        data: result,
        message: `Process started successfully: ${command}`
      });

    } catch (error) {
      logger.error('Error starting process:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start process',
        message: error.message
      });
    }
  }

  /**
   * Stop a tracked process
   */
  async stopProcess(req, res) {
    try {
      const { processId } = req.params;

      if (!processId) {
        return res.status(400).json({
          success: false,
          error: 'Process ID is required'
        });
      }

      await processSupervisorService.stopProcess(processId);
      
      res.json({
        success: true,
        message: `Process ${processId} stopped successfully`
      });

    } catch (error) {
      logger.error('Error stopping process:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop process',
        message: error.message
      });
    }
  }

  /**
   * Restart a tracked process
   */
  async restartProcess(req, res) {
    try {
      const { processId } = req.params;

      if (!processId) {
        return res.status(400).json({
          success: false,
          error: 'Process ID is required'
        });
      }

      const result = await processSupervisorService.restartProcess(processId);
      
      res.json({
        success: true,
        data: result,
        message: `Process ${processId} restarted successfully`
      });

    } catch (error) {
      logger.error('Error restarting process:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restart process',
        message: error.message
      });
    }
  }

  /**
   * Get process supervisor status
   */
  async getStatus(req, res) {
    try {
      const status = processSupervisorService.getStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting process supervisor status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get status',
        message: error.message
      });
    }
  }

  /**
   * Get a specific process by ID
   */
  async getProcess(req, res) {
    try {
      const { processId } = req.params;
      const processes = await processSupervisorService.getProcesses();
      const process = processes.find(p => p.id === processId);

      if (!process) {
        return res.status(404).json({
          success: false,
          error: 'Process not found'
        });
      }

      res.json({
        success: true,
        data: process
      });
    } catch (error) {
      logger.error('Error getting process:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get process',
        message: error.message
      });
    }
  }
}

module.exports = new ProcessController();