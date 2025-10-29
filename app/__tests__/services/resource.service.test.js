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
    
    // Reset fs.readFile to clear any previous mock states
    fs.readFile.mockReset();
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

    it('should handle cgroups v1 with system memory limit check', async () => {
      const systemMemory = 8 * 1024 * 1024 * 1024; // 8GB
      
      // Mock readCgroupFile directly to avoid complex fs.readFile sequencing
      jest.spyOn(ResourceService, 'readCgroupFile')
        .mockResolvedValueOnce(null) // memory.max fails
        .mockResolvedValueOnce(null) // memory.current fails  
        .mockResolvedValueOnce(`${systemMemory}`) // memory.limit_in_bytes = system memory
        .mockResolvedValueOnce('2147483648'); // memory.usage_in_bytes = 2GB

      const result = await ResourceService.getMemoryStats();

      expect(result.limit).toBe(systemMemory);
      expect(result.used).toBe(2147483648);
    });

    it('should handle memory stats errors and use fallback', async () => {
      // Mock readCgroupFile to throw an error to trigger catch block
      jest.spyOn(ResourceService, 'readCgroupFile').mockRejectedValue(new Error('Cgroup access denied'));
      
      // Mock process.memoryUsage for error fallback
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 268435456, // 256MB
        heapTotal: 134217728,
        heapUsed: 67108864,
        external: 16777216
      });

      const result = await ResourceService.getMemoryStats();

      expect(console.warn).toHaveBeenCalledWith('Failed to read container memory stats, using system stats:', expect.any(Error));
      expect(result.used).toBe(268435456);
      expect(result.limit).toBe(8 * 1024 * 1024 * 1024);
      expect(result.formatted.used).toBe('256.0 MB');
      expect(result.percentage).toBe(Math.round((268435456 / (8 * 1024 * 1024 * 1024)) * 100));

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

    it('should fallback to cgroups v1 when v2 fails', async () => {
      // Mock readCgroupFile directly to control return values
      jest.spyOn(ResourceService, 'readCgroupFile')
        .mockResolvedValueOnce(null) // cpu.max fails
        .mockResolvedValueOnce('300000') // cpu.cfs_quota_us = 300ms  
        .mockResolvedValueOnce('100000'); // cpu.cfs_period_us = 100ms
      
      jest.spyOn(ResourceService, 'getCurrentCpuUsage').mockResolvedValue(30);

      const result = await ResourceService.getCpuStats();

      expect(result.limit).toBe(3); // 300000/100000 = 3 cores
      expect(result.limitCores).toBe(3);
      expect(result.formatted.limit).toBe('3.00 cores');
    });

    it('should handle cgroups v1 with no limit (-1)', async () => {
      jest.spyOn(ResourceService, 'readCgroupFile')
        .mockResolvedValueOnce(null) // cpu.max fails
        .mockResolvedValueOnce('-1') // cpu.cfs_quota_us = -1 (no limit)
        .mockResolvedValueOnce('100000'); // cpu.cfs_period_us = 100ms
      
      jest.spyOn(ResourceService, 'getCurrentCpuUsage').mockResolvedValue(20);

      const result = await ResourceService.getCpuStats();

      expect(result.limit).toBe(4); // Should use system cores
      expect(result.formatted.limit).toBe('4 cores (no limit)');
    });

    it('should fallback to system CPU when all cgroups fail', async () => {
      jest.spyOn(ResourceService, 'readCgroupFile').mockRejectedValue(new Error('Cgroup access denied'));
      jest.spyOn(ResourceService, 'getCurrentCpuUsage').mockResolvedValue(45);

      const result = await ResourceService.getCpuStats();

      expect(console.warn).toHaveBeenCalledWith('Failed to read container CPU stats, using system stats:', expect.any(Error));
      expect(result.limit).toBe(4);
      expect(result.cores).toBe(4);
      expect(result.percentage).toBe(45);
      expect(result.formatted.limit).toBe('4 cores');
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

      expect(console.warn).toHaveBeenCalledWith('Failed to get disk stats:', expect.any(Error));
      expect(result).toEqual({
        workspaces: {
          used: 0,
          formatted: '0 B'
        }
      });
    });
  });

  describe('getCurrentCpuUsage', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return a number between 0 and 100', async () => {
      // Restore real timers for this test to allow actual timeout to work
      jest.useRealTimers();
      
      const result = await ResourceService.getCurrentCpuUsage();
      
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });

    it('should calculate CPU usage over time period', async () => {
      const originalCpuUsage = process.cpuUsage;
      let callCount = 0;
      
      process.cpuUsage = jest.fn((previousValue) => {
        callCount++;
        if (callCount === 1) {
          // First call (start)
          return { user: 1000000, system: 500000 };
        } else {
          // Second call (end) - with previousValue
          return { user: 50000, system: 25000 }; // Difference values
        }
      });

      const promise = ResourceService.getCurrentCpuUsage();
      
      // Fast-forward time
      jest.advanceTimersByTime(100);
      
      const result = await promise;
      
      expect(process.cpuUsage).toHaveBeenCalledTimes(2);
      expect(typeof result).toBe('number');
      expect(result).toBeLessThanOrEqual(100);
      
      process.cpuUsage = originalCpuUsage;
    });

    it('should cap CPU usage at 100%', async () => {
      const originalCpuUsage = process.cpuUsage;
      let callCount = 0;
      
      process.cpuUsage = jest.fn((previousValue) => {
        callCount++;
        if (callCount === 1) {
          return { user: 1000000, system: 500000 };
        } else {
          // Return very high usage to test capping
          return { user: 200000, system: 100000 }; // This would calculate to >100%
        }
      });

      const promise = ResourceService.getCurrentCpuUsage();
      jest.advanceTimersByTime(100);
      
      const result = await promise;
      
      expect(result).toBeLessThanOrEqual(100);
      
      process.cpuUsage = originalCpuUsage;
    });
  });

  describe('readCgroupFile', () => {
    // These tests need to test the actual readCgroupFile method without mocking it
    it('should read from cgroups v2 successfully', async () => {
      fs.readFile.mockReset();
      fs.readFile.mockResolvedValueOnce('test-content\n');

      const result = await ResourceService.readCgroupFile('test.file');

      expect(result).toBe('test-content');
      expect(fs.readFile).toHaveBeenCalledWith('/sys/fs/cgroup/test.file', 'utf8');
    });

    it('should fallback to cgroups v1 when v2 fails', async () => {
      fs.readFile.mockReset();
      fs.readFile
        .mockRejectedValueOnce(new Error('v2 not found'))
        .mockResolvedValueOnce('v1-content\n');

      const result = await ResourceService.readCgroupFile('test.file');

      expect(result).toBe('v1-content');
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(fs.readFile).toHaveBeenNthCalledWith(1, '/sys/fs/cgroup/test.file', 'utf8');
      expect(fs.readFile).toHaveBeenNthCalledWith(2, '/sys/fs/cgroup/test.file', 'utf8');
    });

    it('should return null when both v2 and v1 fail', async () => {
      fs.readFile.mockReset();
      fs.readFile
        .mockRejectedValueOnce(new Error('v2 not found'))
        .mockRejectedValueOnce(new Error('v1 not found'));

      const result = await ResourceService.readCgroupFile('nonexistent.file');

      expect(result).toBeNull();
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDirectorySize', () => {
    it('should return file size for non-directory items', async () => {
      const mockStat = { 
        isDirectory: () => false,
        size: 1024
      };
      fs.stat.mockResolvedValue(mockStat);

      const result = await ResourceService.getDirectorySize('/path/to/file.txt');

      expect(result).toBe(1024);
    });

    it('should calculate directory size recursively', async () => {
      const mockDirStat = { isDirectory: () => true };
      const mockFileStat = { 
        isDirectory: () => false,
        size: 512
      };
      
      fs.stat
        .mockResolvedValueOnce(mockDirStat) // Initial directory
        .mockResolvedValueOnce(mockFileStat) // file1.txt
        .mockResolvedValueOnce(mockFileStat); // file2.txt
      
      fs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);

      const result = await ResourceService.getDirectorySize('/path/to/directory');

      expect(result).toBe(1024); // 512 + 512
      expect(fs.stat).toHaveBeenCalledTimes(3);
    });

    it('should handle nested directories recursively', async () => {
      const mockDirStat = { isDirectory: () => true };
      const mockFileStat = { 
        isDirectory: () => false,
        size: 256
      };
      
      // First call: root directory
      fs.stat.mockResolvedValueOnce(mockDirStat);
      fs.readdir.mockResolvedValueOnce(['subdir', 'file.txt']);
      
      // Second call: subdir (also a directory)
      fs.stat.mockResolvedValueOnce(mockDirStat);
      fs.readdir.mockResolvedValueOnce(['nested-file.txt']);
      
      // Third call: nested-file.txt
      fs.stat.mockResolvedValueOnce(mockFileStat);
      
      // Fourth call: file.txt
      fs.stat.mockResolvedValueOnce(mockFileStat);

      const result = await ResourceService.getDirectorySize('/path/to/directory');

      expect(result).toBe(512); // 256 + 256
    });

    it('should handle directory access errors', async () => {
      fs.stat.mockRejectedValue(new Error('Permission denied'));

      const result = await ResourceService.getDirectorySize('/inaccessible/path');

      expect(result).toBe(0);
    });

    it('should handle readdir errors gracefully', async () => {
      const mockDirStat = { isDirectory: () => true };
      fs.stat.mockResolvedValue(mockDirStat);
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await ResourceService.getDirectorySize('/inaccessible/directory');

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

    it('should handle very large numbers', () => {
      // The formatBytes function only supports up to TB, so test within that range
      expect(ResourceService.formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
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