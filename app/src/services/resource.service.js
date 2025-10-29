const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Docker-aware resource monitoring service
 * Reads container limits and usage from cgroups v2
 */
class ResourceService {
  constructor() {
    this.cgroupV2Base = '/sys/fs/cgroup';
    this.cgroupV1Base = '/sys/fs/cgroup';
  }

  /**
   * Get container memory statistics
   */
  async getMemoryStats() {
    try {
      // Try cgroups v2 first (modern Docker)
      const memoryMax = await this.readCgroupFile('memory.max');
      const memoryCurrent = await this.readCgroupFile('memory.current');
      
      if (memoryMax && memoryCurrent) {
        const limit = parseInt(memoryMax);
        const used = parseInt(memoryCurrent);
        
        // Check if limit is the system max (no limit set)
        const systemMemory = os.totalmem();
        const actualLimit = limit >= systemMemory ? systemMemory : limit;
        
        return {
          limit: actualLimit,
          used: used,
          available: actualLimit - used,
          percentage: Math.round((used / actualLimit) * 100),
          formatted: {
            limit: this.formatBytes(actualLimit),
            used: this.formatBytes(used),
            available: this.formatBytes(actualLimit - used)
          }
        };
      }
      
      // Fallback to cgroups v1
      const memoryLimitV1 = await this.readCgroupFile('memory/memory.limit_in_bytes');
      const memoryUsageV1 = await this.readCgroupFile('memory/memory.usage_in_bytes');
      
      if (memoryLimitV1 && memoryUsageV1) {
        const limit = parseInt(memoryLimitV1);
        const used = parseInt(memoryUsageV1);
        const systemMemory = os.totalmem();
        const actualLimit = limit >= systemMemory ? systemMemory : limit;
        
        return {
          limit: actualLimit,
          used: used,
          available: actualLimit - used,
          percentage: Math.round((used / actualLimit) * 100),
          formatted: {
            limit: this.formatBytes(actualLimit),
            used: this.formatBytes(used),
            available: this.formatBytes(actualLimit - used)
          }
        };
      }
      
      // Fallback to Node.js process memory
      const memUsage = process.memoryUsage();
      const systemMemory = os.totalmem();
      
      return {
        limit: systemMemory,
        used: memUsage.rss,
        available: systemMemory - memUsage.rss,
        percentage: Math.round((memUsage.rss / systemMemory) * 100),
        formatted: {
          limit: this.formatBytes(systemMemory),
          used: this.formatBytes(memUsage.rss),
          available: this.formatBytes(systemMemory - memUsage.rss)
        }
      };
      
    } catch (error) {
      console.warn('Failed to read container memory stats, using system stats:', error);
      
      // Final fallback to system memory
      const memUsage = process.memoryUsage();
      const systemMemory = os.totalmem();
      
      return {
        limit: systemMemory,
        used: memUsage.rss,
        available: systemMemory - memUsage.rss,
        percentage: Math.round((memUsage.rss / systemMemory) * 100),
        formatted: {
          limit: this.formatBytes(systemMemory),
          used: this.formatBytes(memUsage.rss),
          available: this.formatBytes(systemMemory - memUsage.rss)
        }
      };
    }
  }

  /**
   * Get container CPU statistics
   */
  async getCpuStats() {
    try {
      // Try cgroups v2
      const cpuMax = await this.readCgroupFile('cpu.max');
      
      if (cpuMax && cpuMax !== 'max') {
        const [quota, period] = cpuMax.split(' ').map(Number);
        const cpuLimit = quota / period;
        
        return {
          limit: cpuLimit,
          cores: os.cpus().length,
          limitCores: cpuLimit,
          percentage: await this.getCurrentCpuUsage(),
          formatted: {
            limit: `${cpuLimit.toFixed(2)} cores`,
            available: `${os.cpus().length} system cores`
          }
        };
      }
      
      // Try cgroups v1
      const cpuQuota = await this.readCgroupFile('cpu/cpu.cfs_quota_us');
      const cpuPeriod = await this.readCgroupFile('cpu/cpu.cfs_period_us');
      
      if (cpuQuota && cpuPeriod && cpuQuota !== '-1') {
        const cpuLimit = parseInt(cpuQuota) / parseInt(cpuPeriod);
        
        return {
          limit: cpuLimit,
          cores: os.cpus().length,
          limitCores: cpuLimit,
          percentage: await this.getCurrentCpuUsage(),
          formatted: {
            limit: `${cpuLimit.toFixed(2)} cores`,
            available: `${os.cpus().length} system cores`
          }
        };
      }
      
      // No CPU limit set
      const cores = os.cpus().length;
      return {
        limit: cores,
        cores: cores,
        limitCores: cores,
        percentage: await this.getCurrentCpuUsage(),
        formatted: {
          limit: `${cores} cores (no limit)`,
          available: `${cores} system cores`
        }
      };
      
    } catch (error) {
      console.warn('Failed to read container CPU stats, using system stats:', error);
      
      const cores = os.cpus().length;
      return {
        limit: cores,
        cores: cores,
        limitCores: cores,
        percentage: await this.getCurrentCpuUsage(),
        formatted: {
          limit: `${cores} cores`,
          available: `${cores} system cores`
        }
      };
    }
  }

  /**
   * Get disk usage for workspaces
   */
  async getDiskStats() {
    try {
      const workspacesPath = path.join(process.cwd(), 'workspaces');
      const workspacesSize = await this.getDirectorySize(workspacesPath);
      
      // Try to get container disk limit (usually not set)
      // For now, just return workspace usage
      return {
        workspaces: {
          used: workspacesSize,
          formatted: this.formatBytes(workspacesSize)
        }
      };
      
    } catch (error) {
      console.warn('Failed to get disk stats:', error);
      return {
        workspaces: {
          used: 0,
          formatted: '0 B'
        }
      };
    }
  }

  /**
   * Get current CPU usage percentage
   */
  async getCurrentCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const elapsedTime = Date.now() - startTime;
        
        const totalUsage = (currentUsage.user + currentUsage.system) / 1000; // Convert to ms
        const percentage = Math.round((totalUsage / elapsedTime) * 100);
        
        resolve(Math.min(percentage, 100)); // Cap at 100%
      }, 100);
    });
  }

  /**
   * Read a cgroup file safely
   */
  async readCgroupFile(filename) {
    try {
      // Try cgroups v2 first
      const v2Path = path.join(this.cgroupV2Base, filename);
      try {
        const content = await fs.readFile(v2Path, 'utf8');
        return content.trim();
      } catch (v2Error) {
        // Try cgroups v1
        const v1Path = path.join(this.cgroupV1Base, filename);
        const content = await fs.readFile(v1Path, 'utf8');
        return content.trim();
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Get directory size recursively
   */
  async getDirectorySize(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        return stat.size;
      }
      
      let totalSize = 0;
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        totalSize += await this.getDirectorySize(itemPath);
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
    
    return `${size} ${sizes[i]}`;
  }

  /**
   * Get comprehensive resource statistics
   */
  async getResourceStats() {
    const [memory, cpu, disk] = await Promise.all([
      this.getMemoryStats(),
      this.getCpuStats(),
      this.getDiskStats()
    ]);

    return {
      memory,
      cpu,
      disk,
      timestamp: Date.now()
    };
  }
}

module.exports = new ResourceService();