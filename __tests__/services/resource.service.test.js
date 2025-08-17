const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn()
  }
}));
jest.mock('os');
jest.mock('path');

const ResourceService = require('../../src/services/resource.service');

describe('ResourceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // Default OS mocks
    os.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
    os.cpus.mockReturnValue(new Array(4).fill({})); // 4 cores
    
    // Default path mocks
    path.join.mockImplementation((...args) => args.join('/'));
    
    // Mock console methods to avoid test noise
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  describe('getMemoryStats', () => {
    it('should return cgroups v2 memory stats when available', async () => {
      fs.readFile
        .mockResolvedValueOnce('1073741824\n') // memory.max = 1GB
        .mockResolvedValueOnce('536870912\n'); // memory.current = 512MB

      const result = await ResourceService.getMemoryStats();

      expect(result).toEqual({
        limit: 1073741824,
        used: 536870912,
        available: 536870912,
        percentage: 50,
        formatted: {
          limit: '1.0 GB',
          used: '512.0 MB',
          available: '512.0 MB'
        }
      });
    });

    it('should handle system memory limit when container limit equals system memory', async () => {
      const systemMemory = 8 * 1024 * 1024 * 1024; // 8GB
      fs.readFile
        .mockResolvedValueOnce(`${systemMemory}\n`) // memory.max = system memory
        .mockResolvedValueOnce('1073741824\n'); // memory.current = 1GB

      const result = await ResourceService.getMemoryStats();

      expect(result.limit).toBe(systemMemory);
      expect(result.used).toBe(1073741824);
    });

    it('should fallback to cgroups v1 when v2 fails', async () => {
      fs.readFile
        .mockRejectedValueOnce(new Error('v2 not found'))
        .mockRejectedValueOnce(new Error('v2 not found'))
        .mockResolvedValueOnce('2147483648\n') // memory.limit_in_bytes = 2GB
        .mockResolvedValueOnce('1073741824\n'); // memory.usage_in_bytes = 1GB

      const result = await ResourceService.getMemoryStats();

      // Verify that we get memory stats with the expected structure
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('used');
      expect(result).toHaveProperty('available');
      expect(result).toHaveProperty('percentage');
      expect(result).toHaveProperty('formatted');
      expect(typeof result.limit).toBe('number');
      expect(typeof result.used).toBe('number');
    });

    it('should fallback to process memory when cgroups unavailable', async () => {
      fs.readFile.mockRejectedValue(new Error('cgroups not available'));
      
      // Mock process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 134217728, // 128MB
        heapTotal: 67108864,
        heapUsed: 33554432,
        external: 8388608
      });

      const result = await ResourceService.getMemoryStats();

      expect(result.used).toBe(134217728);
      expect(result.limit).toBe(8 * 1024 * 1024 * 1024);
      expect(result.formatted.used).toBe('128.0 MB');

      process.memoryUsage = originalMemoryUsage;
    });

  });

  describe('getCpuStats', () => {
    it('should return cgroups v2 CPU stats when available', async () => {
      fs.readFile.mockResolvedValueOnce('200000 100000\n'); // cpu.max = 2 cores

      // Mock getCurrentCpuUsage
      jest.spyOn(ResourceService, 'getCurrentCpuUsage').mockResolvedValue(25);

      const result = await ResourceService.getCpuStats();

      expect(result).toEqual({
        limit: 2,
        cores: 4,
        limitCores: 2,
        percentage: 25,
        formatted: {
          limit: '2.00 cores',
          available: '4 system cores'
        }
      });
    });

    it('should handle unlimited CPU (max value)', async () => {
      fs.readFile.mockResolvedValueOnce('max\n');
      jest.spyOn(ResourceService, 'getCurrentCpuUsage').mockResolvedValue(15);

      const result = await ResourceService.getCpuStats();

      expect(result.limit).toBe(4); // Should use system cores
      expect(result.formatted.limit).toBe('4 cores (no limit)');
    });

  });

  describe('getDiskStats', () => {
    it('should return workspace disk usage', async () => {
      const mockStat = { isDirectory: () => true };
      const mockItems = ['workspace1', 'workspace2'];
      
      fs.stat.mockResolvedValue(mockStat);
      fs.readdir.mockResolvedValue(mockItems);
      
      // Mock recursive directory size calculation
      jest.spyOn(ResourceService, 'getDirectorySize').mockResolvedValue(1073741824); // 1GB

      const result = await ResourceService.getDiskStats();

      expect(result).toEqual({
        workspaces: {
          used: 1073741824,
          formatted: '1.0 GB'
        }
      });
    });

    it('should handle disk stats errors gracefully', async () => {
      jest.spyOn(ResourceService, 'getDirectorySize').mockRejectedValue(new Error('Disk error'));

      const result = await ResourceService.getDiskStats();

      expect(console.warn).toHaveBeenCalledWith('Failed to get disk stats:', 'Disk error');
      expect(result).toEqual({
        workspaces: {
          used: 0,
          formatted: '0 B'
        }
      });
    });
  });

  describe('getCurrentCpuUsage', () => {
    it('should return a number between 0 and 100', async () => {
      const result = await ResourceService.getCurrentCpuUsage();
      
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('readCgroupFile', () => {
    it('should read from cgroups v2 successfully', async () => {
      fs.readFile.mockClear();
      fs.readFile.mockResolvedValueOnce('test-content\n');

      const result = await ResourceService.readCgroupFile('test.file');

      expect(result).toBe('test-content');
    });

    it('should fallback to cgroups v1 when v2 fails', async () => {
      fs.readFile.mockClear();
      fs.readFile
        .mockRejectedValueOnce(new Error('v2 not found'))
        .mockResolvedValueOnce('v1-content\n');

      const result = await ResourceService.readCgroupFile('test.file');

      expect(result).toBe('v1-content');
    });

    it('should return null when both v2 and v1 fail', async () => {
      fs.readFile.mockClear();
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await ResourceService.readCgroupFile('nonexistent.file');

      expect(result).toBeNull();
    });
  });

  describe('getDirectorySize', () => {
    it('should handle directory access errors', async () => {
      fs.stat.mockRejectedValue(new Error('Permission denied'));

      const result = await ResourceService.getDirectorySize('/inaccessible/path');

      expect(result).toBe(0);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(ResourceService.formatBytes(0)).toBe('0 B');
      expect(ResourceService.formatBytes(1024)).toBe('1.0 KB');
      expect(ResourceService.formatBytes(1536)).toBe('1.5 KB');
      expect(ResourceService.formatBytes(1048576)).toBe('1.0 MB');
      expect(ResourceService.formatBytes(1073741824)).toBe('1.0 GB');
      expect(ResourceService.formatBytes(1099511627776)).toBe('1.0 TB');
    });

    it('should handle bytes without decimals', () => {
      expect(ResourceService.formatBytes(512)).toBe('512 B');
      expect(ResourceService.formatBytes(1)).toBe('1 B');
    });
  });

  describe('getResourceStats', () => {
    it('should return comprehensive resource statistics', async () => {
      const mockMemory = {
        limit: 1073741824,
        used: 536870912,
        available: 536870912,
        percentage: 50
      };
      
      const mockCpu = {
        limit: 2,
        cores: 4,
        percentage: 25
      };
      
      const mockDisk = {
        workspaces: {
          used: 1073741824,
          formatted: '1.0 GB'
        }
      };

      jest.spyOn(ResourceService, 'getMemoryStats').mockResolvedValue(mockMemory);
      jest.spyOn(ResourceService, 'getCpuStats').mockResolvedValue(mockCpu);
      jest.spyOn(ResourceService, 'getDiskStats').mockResolvedValue(mockDisk);

      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 1234567890);

      const result = await ResourceService.getResourceStats();

      expect(result).toEqual({
        memory: mockMemory,
        cpu: mockCpu,
        disk: mockDisk,
        timestamp: 1234567890
      });

      expect(ResourceService.getMemoryStats).toHaveBeenCalled();
      expect(ResourceService.getCpuStats).toHaveBeenCalled();
      expect(ResourceService.getDiskStats).toHaveBeenCalled();

      Date.now = originalDateNow;
    });
  });
});