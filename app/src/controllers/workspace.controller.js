const WorkspaceService = require('../services/workspace.service');
const logger = require('../utils/logger');

class WorkspaceController {
  async getWorkspaces(req, res, next) {
    try {
      const workspaces = await WorkspaceService.listWorkspaces();
      res.status(200).json({ success: true, workspaces });
    } catch (error) {
      logger.error('Failed to get workspaces:', error);
      next(error);
    }
  }
}

module.exports = new WorkspaceController();
