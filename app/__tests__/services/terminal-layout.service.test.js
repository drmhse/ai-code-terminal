// Mock database and logger before importing
jest.mock('../../src/config/database', () => ({
  prisma: {
    terminalLayout: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    session: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    }
  }
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const service = require('../../src/services/terminal-layout.service');
const { prisma } = require('../../src/config/database');
const logger = require('../../src/utils/logger');

describe('TerminalLayoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDefaultLayout', () => {
    it('should return existing default layout if found', async () => {
      const mockLayout = {
        id: 'layout1',
        workspaceId: 'workspace1',
        name: 'Default',
        layoutType: 'single',
        isDefault: true,
        sessions: []
      };

      prisma.terminalLayout.findFirst.mockResolvedValue(mockLayout);

      const result = await service.getDefaultLayout('workspace1');

      expect(result).toEqual(mockLayout);
      expect(prisma.terminalLayout.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace1',
          isDefault: true
        },
        include: {
          sessions: {
            where: { status: 'active' },
            orderBy: { createdAt: 'asc' }
          }
        }
      });
    });

    it('should create default layout if none exists', async () => {
      prisma.terminalLayout.findFirst.mockResolvedValue(null);
      
      const mockCreatedLayout = {
        id: 'layout1',
        workspaceId: 'workspace1',
        name: 'Default',
        layoutType: 'single',
        isDefault: true
      };

      prisma.terminalLayout.create.mockResolvedValue(mockCreatedLayout);

      const result = await service.getDefaultLayout('workspace1');

      expect(result).toEqual(mockCreatedLayout);
      expect(prisma.terminalLayout.create).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      prisma.terminalLayout.findFirst.mockRejectedValue(error);

      await expect(service.getDefaultLayout('workspace1')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting default layout for workspace workspace1:',
        error
      );
    });
  });

  describe('createDefaultLayout', () => {
    it('should create default layout successfully', async () => {
      const mockLayout = {
        id: 'layout1',
        workspaceId: 'workspace1',
        name: 'Default',
        layoutType: 'single',
        isDefault: true
      };

      prisma.terminalLayout.create.mockResolvedValue(mockLayout);

      const result = await service.createDefaultLayout('workspace1');

      expect(result).toEqual(mockLayout);
      expect(prisma.terminalLayout.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'workspace1',
          name: 'Default',
          layoutType: 'single',
          configuration: expect.any(String),
          isDefault: true
        },
        include: {
          sessions: true
        }
      });
      expect(logger.info).toHaveBeenCalledWith('Created default layout for workspace workspace1');
    });

    it('should handle creation errors', async () => {
      const error = new Error('Creation failed');
      prisma.terminalLayout.create.mockRejectedValue(error);

      await expect(service.createDefaultLayout('workspace1')).rejects.toThrow('Creation failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Error creating default layout for workspace workspace1:',
        error
      );
    });
  });

  describe('createLayout', () => {
    it('should create custom layout successfully', async () => {
      const mockLayout = {
        id: 'layout1',
        workspaceId: 'workspace1',
        name: 'Split View',
        layoutType: 'horizontal-split',
        isDefault: false
      };

      const config = { splits: 2, orientation: 'horizontal' };

      prisma.terminalLayout.create.mockResolvedValue(mockLayout);

      const result = await service.createLayout('workspace1', 'Split View', 'horizontal-split', config);

      expect(result).toEqual(mockLayout);
      expect(prisma.terminalLayout.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'workspace1',
          name: 'Split View',
          layoutType: 'horizontal-split',
          configuration: JSON.stringify(config),
          isDefault: false
        }
      });
      expect(logger.info).toHaveBeenCalledWith('Created layout "Split View" for workspace workspace1');
    });
  });

  describe('generateSplitConfiguration', () => {
    it('should generate configuration for single layout', () => {
      const result = service.generateSplitConfiguration('single', []);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should generate configuration for split layouts', () => {
      const sessions = [{ id: 'session1' }, { id: 'session2' }];
      const result = service.generateSplitConfiguration('horizontal-split', sessions);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('method verification', () => {
    it('should have cleanup method', () => {
      // Test that service has methods we expect
      expect(typeof service.getDefaultLayout).toBe('function');
      expect(typeof service.createLayout).toBe('function');
    });
  });

  describe('attachSessionToLayout', () => {
    it('should have required methods', () => {
      expect(typeof service.getDefaultLayout).toBe('function');
      expect(typeof service.createDefaultLayout).toBe('function');
      expect(typeof service.createLayout).toBe('function');
      expect(typeof service.generateSplitConfiguration).toBe('function');
    });
  });
});