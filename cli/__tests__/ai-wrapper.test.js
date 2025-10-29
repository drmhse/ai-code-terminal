const AIWrapper = require('../src/ai-wrapper');
const { spawn } = require('child_process');
const EventEmitter = require('events');

// Mock child_process
jest.mock('child_process');

describe('AIWrapper', () => {
  let aiWrapper;
  let mockProcess;

  beforeEach(() => {
    // Mock ConfigManager to return consistent test backend
    const ConfigManager = require('../src/config-manager');
    jest.spyOn(ConfigManager.prototype, 'getAIBackend').mockResolvedValue({
      command: 'claude',
      args: ['--print']
    });
    
    aiWrapper = new AIWrapper();
    
    // Create a mock process that extends EventEmitter
    mockProcess = new EventEmitter();
    mockProcess.stdin = {
      write: jest.fn(),
      end: jest.fn()
    };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    
    // Mock spawn to return our mock process
    spawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('query', () => {
    test('should spawn AI process with correct command and args', async () => {
      const queryPromise = aiWrapper.query('test prompt');
      
      // Simulate successful process completion
      setTimeout(() => mockProcess.emit('close', 0), 10);
      
      await queryPromise;
      
      expect(spawn).toHaveBeenCalledWith('claude', ['--print'], {
        stdio: ['pipe', 'inherit', 'inherit']
      });
    });

    test('should send formatted prompt to AI process', async () => {
      const contextItems = [
        {
          metadata: { type: 'file', source: 'test.js' },
          content: 'console.log("test");'
        }
      ];

      const queryPromise = aiWrapper.query('test prompt', contextItems);
      
      // Simulate successful process completion
      setTimeout(() => mockProcess.emit('close', 0), 10);
      
      await queryPromise;
      
      expect(mockProcess.stdin.write).toHaveBeenCalled();
      expect(mockProcess.stdin.end).toHaveBeenCalled();
      
      const writtenData = mockProcess.stdin.write.mock.calls[0][0];
      expect(writtenData).toContain('### CONTEXT ###');
      expect(writtenData).toContain('--- file: test.js ---');
      expect(writtenData).toContain('console.log("test");');
      expect(writtenData).toContain('### PROMPT ###');
      expect(writtenData).toContain('test prompt');
    });

    test('should handle process error when command not found', async () => {
      const queryPromise = aiWrapper.query('test prompt');
      
      // Simulate command not found error
      const error = new Error('spawn claude ENOENT');
      error.code = 'ENOENT';
      setTimeout(() => mockProcess.emit('error', error), 10);
      
      await expect(queryPromise).rejects.toThrow(
        "AI backend 'claude' not found"
      );
    });

    test('should handle process error for other errors', async () => {
      const queryPromise = aiWrapper.query('test prompt');
      
      // Simulate other error
      const error = new Error('Some other error');
      setTimeout(() => mockProcess.emit('error', error), 10);
      
      await expect(queryPromise).rejects.toThrow('Some other error');
    });

    test('should handle non-zero exit code', async () => {
      const queryPromise = aiWrapper.query('test prompt');
      
      // Simulate non-zero exit
      setTimeout(() => mockProcess.emit('close', 1), 10);
      
      await expect(queryPromise).rejects.toThrow('AI backend exited with code 1');
    });

    test('should resolve on successful completion', async () => {
      const queryPromise = aiWrapper.query('test prompt');
      
      // Simulate successful completion
      setTimeout(() => mockProcess.emit('close', 0), 10);
      
      await expect(queryPromise).resolves.toBeUndefined();
    });
  });

  describe('formatPrompt', () => {
    test('should return prompt as-is when no context', () => {
      const formatted = aiWrapper.formatPrompt('test prompt', []);
      expect(formatted).toBe('test prompt');
    });

    test('should format prompt with single context item', () => {
      const contextItems = [
        {
          metadata: { type: 'file', source: 'test.js' },
          content: 'console.log("test");'
        }
      ];

      const formatted = aiWrapper.formatPrompt('test prompt', contextItems);
      
      expect(formatted).toContain('### CONTEXT ###');
      expect(formatted).toContain('--- file: test.js ---');
      expect(formatted).toContain('console.log("test");');
      expect(formatted).toContain('### END CONTEXT ###');
      expect(formatted).toContain('### PROMPT ###');
      expect(formatted).toContain('test prompt');
    });

    test('should format prompt with multiple context items', () => {
      const contextItems = [
        {
          metadata: { type: 'file', source: 'file1.js' },
          content: 'content1'
        },
        {
          metadata: { type: 'command', source: 'ls -la' },
          content: 'command output'
        }
      ];

      const formatted = aiWrapper.formatPrompt('test prompt', contextItems);
      
      expect(formatted).toContain('--- file: file1.js ---');
      expect(formatted).toContain('content1');
      expect(formatted).toContain('--- command: ls -la ---');
      expect(formatted).toContain('command output');
    });

    test('should handle empty content', () => {
      const contextItems = [
        {
          metadata: { type: 'file', source: 'empty.js' },
          content: ''
        }
      ];

      const formatted = aiWrapper.formatPrompt('test prompt', contextItems);
      
      expect(formatted).toContain('--- file: empty.js ---');
      expect(formatted).toContain('test prompt');
    });
  });

  describe('checkBackend', () => {
    test('should return true for successful version check', async () => {
      const checkPromise = aiWrapper.checkBackend();
      
      // Simulate successful version command
      setTimeout(() => mockProcess.emit('close', 0), 10);
      
      const result = await checkPromise;
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith('claude', ['--version'], {
        stdio: 'pipe'
      });
    });

    test('should return false for failed version check', async () => {
      const checkPromise = aiWrapper.checkBackend();
      
      // Simulate failed version command
      setTimeout(() => mockProcess.emit('close', 1), 10);
      
      const result = await checkPromise;
      expect(result).toBe(false);
    });

    test('should return false for command not found', async () => {
      const checkPromise = aiWrapper.checkBackend();
      
      // Simulate command not found
      setTimeout(() => mockProcess.emit('error', new Error('ENOENT')), 10);
      
      const result = await checkPromise;
      expect(result).toBe(false);
    });
  });

  describe('getAvailableBackends', () => {
    test('should return list of available backends', () => {
      const backends = aiWrapper.getAvailableBackends();
      
      expect(Array.isArray(backends)).toBe(true);
      expect(backends).toContain('claude');
      expect(backends).toContain('openai');
      expect(backends).toContain('gemini');
      expect(backends).toContain('ollama');
      expect(backends.length).toBeGreaterThan(0);
    });
  });
});