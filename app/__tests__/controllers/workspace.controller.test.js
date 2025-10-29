const WorkspaceController = require('../../src/controllers/workspace.controller');

// Mock services
jest.mock('../../src/services/workspace.service');
jest.mock('../../src/utils/logger');

const WorkspaceService = require('../../src/services/workspace.service');
const logger = require('../../src/utils/logger');

describe('WorkspaceController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getWorkspaces', () => {
    it('should return workspaces successfully', async () => {
      const mockWorkspaces = [
        { id: '1', name: 'workspace1' },
        { id: '2', name: 'workspace2' }
      ];
      
      WorkspaceService.listWorkspaces.mockResolvedValue(mockWorkspaces);

      await WorkspaceController.getWorkspaces(req, res, next);

      expect(WorkspaceService.listWorkspaces).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        workspaces: mockWorkspaces
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when service fails', async () => {
      const error = new Error('Service error');
      WorkspaceService.listWorkspaces.mockRejectedValue(error);

      await WorkspaceController.getWorkspaces(req, res, next);

      expect(logger.error).toHaveBeenCalledWith('Failed to get workspaces:', error);
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});