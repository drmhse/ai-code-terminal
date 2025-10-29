// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn()
}));

const fs = require('fs');
const assets = require('../../src/utils/assets');

describe('Assets', () => {
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };

    // Reset fs mocks
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('{}');
    fs.readdirSync.mockReturnValue([]);
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('getAssetUrl', () => {
    it('should return asset URL for known assets', () => {
      const result = assets.getAssetUrl('main.es.js');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/\.js$/);
    });

    it('should handle unknown assets', () => {
      const result = assets.getAssetUrl('unknown.js');
      expect(typeof result).toBe('string');
    });
  });

  describe('reloadAssets', () => {
    it('should reload assets', () => {
      const result = assets.reloadAssets();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('basic functionality', () => {
    it('should export getAssetUrl function', () => {
      expect(typeof assets.getAssetUrl).toBe('function');
    });

    it('should export reloadAssets function', () => {
      expect(typeof assets.reloadAssets).toBe('function');
    });
  });
});