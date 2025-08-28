const ConfigManager = require('../src/config-manager');
const fs = require('fs-extra');
const os = require('os');

// Mock fs-extra
jest.mock('fs-extra');
// Mock os
jest.mock('os');

describe('ConfigManager', () => {
  let configManager;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock os.homedir to return predictable path
    os.homedir.mockReturnValue('/mock/home');
    
    // Create fresh ConfigManager instance
    configManager = new ConfigManager();
  });

  describe('constructor', () => {
    test('should set correct paths', () => {
      expect(configManager.configDir).toBe('/mock/home/.act');
      expect(configManager.configPath).toBe('/mock/home/.act/config.json');
    });
  });

  describe('loadConfig', () => {
    test('should load default config when no config file exists', async () => {
      // Mock file doesn't exist
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      const config = await configManager.loadConfig();
      
      expect(config).toBeDefined();
      expect(config.version).toBe(1);
      expect(config.ai_backend.command).toBe('claude');
      expect(config.ai_backend.args).toEqual(['--no-user-config']);
      expect(config.golden_paths).toBeDefined();
      
      // Should have tried to save default config
      expect(fs.writeJson).toHaveBeenCalledWith(
        '/mock/home/.act/config.json',
        expect.objectContaining({
          version: 1,
          ai_backend: { command: 'claude', args: ['--no-user-config'] }
        }),
        { spaces: 2 }
      );
    });

    test('should load existing config file', async () => {
      const mockConfig = {
        version: 1,
        ai_backend: {
          command: 'openai',
          args: ['chat']
        },
        golden_paths: {
          commit: 'Custom commit prompt',
          review: 'Custom review prompt',
          test: 'Custom test prompt',
          explain: 'Custom explain prompt',
          fix: 'Custom fix prompt'
        }
      };

      // Mock file exists and has content
      fs.pathExists.mockResolvedValue(true);
      fs.ensureDir.mockResolvedValue();
      fs.readJson.mockResolvedValue(mockConfig);
      
      const config = await configManager.loadConfig();
      
      expect(config.ai_backend.command).toBe('openai');
      expect(config.ai_backend.args).toEqual(['chat']);
      expect(config.golden_paths.commit).toBe('Custom commit prompt');
      
      // Should have read from the mock path
      expect(fs.readJson).toHaveBeenCalledWith('/mock/home/.act/config.json');
    });

    test('should handle corrupted config file', async () => {
      // Mock file exists but reading throws error
      fs.pathExists.mockResolvedValue(true);
      fs.ensureDir.mockResolvedValue();
      fs.readJson.mockRejectedValue(new Error('Invalid JSON'));
      
      const config = await configManager.loadConfig();
      
      // Should fall back to default config
      expect(config.version).toBe(1);
      expect(config.ai_backend.command).toBe('claude');
    });
  });

  describe('saveConfig', () => {
    test('should save config to file', async () => {
      const customConfig = {
        version: 1,
        ai_backend: {
          command: 'gemini',
          args: ['chat']
        },
        golden_paths: {
          commit: 'Test commit prompt',
          review: 'Test review prompt',
          test: 'Test test prompt',
          explain: 'Test explain prompt',
          fix: 'Test fix prompt'
        }
      };

      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await configManager.saveConfig(customConfig);

      expect(fs.ensureDir).toHaveBeenCalledWith('/mock/home/.act');
      expect(fs.writeJson).toHaveBeenCalledWith(
        '/mock/home/.act/config.json',
        customConfig,
        { spaces: 2 }
      );
    });
  });

  describe('getGoldenPath', () => {
    test('should return configured golden path prompt', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      const prompt = await configManager.getGoldenPath('commit');
      
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).not.toBe('Please help with commit');
    });

    test('should return fallback for unknown path', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      const prompt = await configManager.getGoldenPath('unknown');
      expect(prompt).toBe('Please help with unknown');
    });

    test('should load from custom config', async () => {
      const mockConfig = {
        version: 1,
        ai_backend: { command: 'claude', args: ['--no-user-config'] },
        golden_paths: {
          commit: 'Custom commit message generator',
          review: 'Custom review',
          test: 'Custom test',
          explain: 'Custom explain',
          fix: 'Custom fix'
        }
      };

      fs.pathExists.mockResolvedValue(true);
      fs.ensureDir.mockResolvedValue();
      fs.readJson.mockResolvedValue(mockConfig);
      
      const prompt = await configManager.getGoldenPath('commit');
      expect(prompt).toBe('Custom commit message generator');
    });
  });

  describe('getAIBackend', () => {
    test('should return default AI backend configuration', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      const backend = await configManager.getAIBackend();
      
      expect(backend).toBeDefined();
      expect(backend.command).toBe('claude');
      expect(backend.args).toEqual(['--no-user-config']);
    });

    test('should return custom AI backend configuration', async () => {
      const mockConfig = {
        version: 1,
        ai_backend: {
          command: 'openai',
          args: ['chat']
        },
        golden_paths: {
          commit: 'Custom commit',
          review: 'Custom review',
          test: 'Custom test',
          explain: 'Custom explain',
          fix: 'Custom fix'
        }
      };

      fs.pathExists.mockResolvedValue(true);
      fs.ensureDir.mockResolvedValue();
      fs.readJson.mockResolvedValue(mockConfig);
      
      const backend = await configManager.getAIBackend();
      expect(backend.command).toBe('openai');
      expect(backend.args).toEqual(['chat']);
    });
  });

  describe('get', () => {
    test('should get specific config value', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      const value = await configManager.get('ai_backend');
      expect(value).toBeDefined();
      expect(value.command).toBe('claude');
    });

    test('should return undefined for non-existent key', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      const value = await configManager.get('nonexistent');
      expect(value).toBeUndefined();
    });

    test('should handle nested path', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      const value = await configManager.get('ai_backend.command');
      expect(value).toBe('claude');
    });
  });

  describe('set', () => {
    test('should set and persist config value', async () => {
      // Mock loading existing config
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      await configManager.set('ai_backend.command', 'gemini');
      
      // Should have called writeJson to save the updated config
      expect(fs.writeJson).toHaveBeenCalledWith(
        '/mock/home/.act/config.json',
        expect.objectContaining({
          ai_backend: expect.objectContaining({
            command: 'gemini'
          })
        }),
        { spaces: 2 }
      );
    });

    test('should handle nested config updates', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      await configManager.set('golden_paths.commit', 'Updated commit prompt');
      
      expect(fs.writeJson).toHaveBeenCalledWith(
        '/mock/home/.act/config.json',
        expect.objectContaining({
          golden_paths: expect.objectContaining({
            commit: 'Updated commit prompt'
          })
        }),
        { spaces: 2 }
      );
    });
  });

  describe('getAll', () => {
    test('should return complete config object', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();
      
      const config = await configManager.getAll();
      
      expect(config).toBeDefined();
      expect(config.version).toBe(1);
      expect(config.ai_backend).toBeDefined();
      expect(config.ai_backend.command).toBeDefined();
      expect(config.golden_paths).toBeDefined();
      expect(typeof config.golden_paths).toBe('object');
    });
  });

  describe('ensureConfigDir', () => {
    test('should create config directory', async () => {
      fs.ensureDir.mockResolvedValue();
      
      await configManager.ensureConfigDir();
      
      expect(fs.ensureDir).toHaveBeenCalledWith('/mock/home/.act');
    });
  });
});