const ContextManager = require('../src/context-manager');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const path = require('path');
const os = require('os');

describe('ContextManager', () => {
  let testDir, contextManager;
  
  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'act-test-'));
    process.chdir(testDir);
    contextManager = new ContextManager();
    await contextManager.clear();
  });

  afterEach(async () => {
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('addFile', () => {
    test('should add a file to context', async () => {
      await fs.writeFile('test.js', 'console.log("test");');
      await contextManager.addFile('test.js');
      
      const items = await contextManager.list();
      expect(items).toHaveLength(1);
      expect(items[0].metadata.type).toBe('file');
      expect(items[0].metadata.source).toBe('test.js');
      expect(items[0].content).toBe('console.log("test");');
    });

    test('should reject non-existent files', async () => {
      await expect(contextManager.addFile('nonexistent.js'))
        .rejects.toThrow('File not found: nonexistent.js');
    });

    test('should reject directories', async () => {
      await fs.mkdir('testdir');
      await expect(contextManager.addFile('testdir'))
        .rejects.toThrow('Path is a directory');
    });

    test('should reject files larger than 5MB', async () => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB
      await fs.writeFile('large.txt', largeContent);
      
      await expect(contextManager.addFile('large.txt'))
        .rejects.toThrow('File too large');
    });

    test('should handle files at exactly 5MB limit', async () => {
      const exactContent = 'x'.repeat(5 * 1024 * 1024); // Exactly 5MB
      await fs.writeFile('exact.txt', exactContent);
      
      await contextManager.addFile('exact.txt');
      const items = await contextManager.list();
      expect(items).toHaveLength(1);
    });
  });

  describe('addCommandOutput', () => {
    test('should add command output to context', async () => {
      await contextManager.addCommandOutput('echo "hello world"');
      
      const items = await contextManager.list();
      expect(items).toHaveLength(1);
      expect(items[0].metadata.type).toBe('exec');
      expect(items[0].content).toContain('hello world');
    });

    test('should reject dangerous commands', async () => {
      const dangerousCommands = [
        'ls; rm -rf /',
        'echo test | cat',
        'echo test && rm file',
        'echo `whoami`',
        'echo $HOME',
        'cat file > output',
        'cat file < input'
      ];

      for (const cmd of dangerousCommands) {
        await expect(contextManager.addCommandOutput(cmd))
          .rejects.toThrow('Command contains unsafe characters');
      }
    });

    test('should handle empty command output', async () => {
      await expect(contextManager.addCommandOutput('false'))
        .rejects.toThrow();
    });
  });

  describe('addGitDiff', () => {
    test('should handle git diff when not in git repo', async () => {
      await expect(contextManager.addGitDiff())
        .rejects.toThrow();
    });

    test('should add git diff when in git repo with changes', async () => {
      // Initialize git repo
      await execAsync('git init');
      await execAsync('git config user.email "test@example.com"');
      await execAsync('git config user.name "Test User"');
      
      // Create and stage a file
      await fs.writeFile('test.js', 'console.log("test");');
      await execAsync('git add test.js');
      
      await contextManager.addGitDiff();
      const items = await contextManager.list();
      expect(items).toHaveLength(1);
      expect(items[0].metadata.type).toBe('diff');
    });
  });

  describe('list and management', () => {
    test('should return empty list initially', async () => {
      const items = await contextManager.list();
      expect(items).toHaveLength(0);
    });

    test('should list multiple items in order', async () => {
      await fs.writeFile('file1.js', 'content1');
      await fs.writeFile('file2.js', 'content2');
      
      await contextManager.addFile('file1.js');
      await contextManager.addFile('file2.js');
      
      const items = await contextManager.list();
      expect(items).toHaveLength(2);
      expect(items[0].metadata.source).toBe('file1.js');
      expect(items[1].metadata.source).toBe('file2.js');
    });
  });

  describe('get', () => {
    test('should get specific item by index', async () => {
      await fs.writeFile('test.js', 'content');
      await contextManager.addFile('test.js');
      
      const item = await contextManager.get(0);
      expect(item).toBeTruthy();
      expect(item.metadata.source).toBe('test.js');
      expect(item.content).toBe('content');
    });

    test('should return null for invalid index', async () => {
      const item = await contextManager.get(999);
      expect(item).toBeNull();
    });
  });

  describe('remove', () => {
    test('should remove items by index', async () => {
      await fs.writeFile('file1.js', 'content1');
      await fs.writeFile('file2.js', 'content2');
      await fs.writeFile('file3.js', 'content3');
      
      await contextManager.addFile('file1.js');
      await contextManager.addFile('file2.js');
      await contextManager.addFile('file3.js');
      
      const removedCount = await contextManager.remove([1]); // Remove middle item
      expect(removedCount).toBe(1);
      
      const items = await contextManager.list();
      expect(items).toHaveLength(2);
      expect(items[0].metadata.source).toBe('file1.js');
      expect(items[1].metadata.source).toBe('file3.js');
    });

    test('should handle invalid indices gracefully', async () => {
      await fs.writeFile('test.js', 'content');
      await contextManager.addFile('test.js');
      
      const removedCount = await contextManager.remove([999]); // Invalid index
      expect(removedCount).toBe(0);
      
      const items = await contextManager.list();
      expect(items).toHaveLength(1); // Item should still be there
    });
  });

  describe('removeItems', () => {
    test('should auto-detect numeric indices', async () => {
      await fs.writeFile('file1.js', 'content1');
      await fs.writeFile('file2.js', 'content2');
      
      await contextManager.addFile('file1.js');
      await contextManager.addFile('file2.js');
      
      const removedCount = await contextManager.removeItems(['1']);
      expect(removedCount).toBe(1);
      const items = await contextManager.list();
      expect(items).toHaveLength(1);
      expect(items[0].metadata.source).toBe('file2.js');
    });
    
    test('should handle exact filename patterns', async () => {
      await fs.writeFile('test1.txt', 'content1');
      await fs.writeFile('test2.txt', 'content2');
      
      await contextManager.addFile('test1.txt');
      await contextManager.addFile('test2.txt');
      
      const removedCount = await contextManager.removeItems(['test1.txt']);
      expect(removedCount).toBe(1);
      const items = await contextManager.list();
      expect(items).toHaveLength(1);
      expect(items[0].metadata.source).toBe('test2.txt');
    });
    
    test('should handle glob patterns', async () => {
      await fs.writeFile('test1.txt', 'content1');
      await fs.writeFile('test2.txt', 'content2');
      
      await contextManager.addFile('test1.txt');
      await contextManager.addFile('test2.txt');
      
      const removedCount = await contextManager.removeItems(['*.txt']);
      expect(removedCount).toBe(2);
      const items = await contextManager.list();
      expect(items).toHaveLength(0);
    });
    
    test('should handle mixed indices and patterns', async () => {
      await fs.writeFile('test1.txt', 'content1');
      await fs.writeFile('test2.txt', 'content2');
      await fs.writeFile('test.yml', 'yaml: content');
      
      await contextManager.addFile('test1.txt');
      await contextManager.addFile('test2.txt');
      await contextManager.addFile('test.yml');
      
      // Remove index 1 (test1.txt - 1-indexed) and *.yml (test.yml)
      // Should leave test2.txt
      const removedCount = await contextManager.removeItems(['1', '*.yml']);
      expect(removedCount).toBe(2);
      const items = await contextManager.list();
      expect(items).toHaveLength(1);
      expect(items[0].metadata.source).toBe('test2.txt');
    });
    
    test('should throw error for non-matching patterns', async () => {
      await fs.writeFile('test.txt', 'content');
      await contextManager.addFile('test.txt');
      
      await expect(contextManager.removeItems(['nonexistent.file']))
        .rejects.toThrow('No items found matching patterns: nonexistent.file');
    });
  });

  describe('deduplication and integrity', () => {
    test('should automatically deduplicate identical items', async () => {
      await fs.writeFile('test.txt', 'content');
      
      // Add same file twice
      await contextManager.addFile('test.txt');
      await contextManager.addFile('test.txt');
      
      const items = await contextManager.list();
      expect(items).toHaveLength(1);
    });
    
    test('should clean up corrupted files', async () => {
      await fs.writeFile('test.txt', 'content');
      await contextManager.addFile('test.txt');
      
      // Manually corrupt a file
      const contextDir = contextManager.contextDir;
      const files = await fs.readdir(contextDir);
      const contextFiles = files.filter(f => f.match(/^\d+_.*\.json$/));
      const corruptFile = path.join(contextDir, contextFiles[0]);
      await fs.writeFile(corruptFile, 'invalid json{');
      
      const items = await contextManager.list();
      expect(items).toHaveLength(0);
      
      // Verify corrupted file was cleaned up
      const filesAfter = await fs.readdir(contextDir);
      const contextFilesAfter = filesAfter.filter(f => f.match(/^\d+_.*\.json$/));
      expect(contextFilesAfter).toHaveLength(0);
    });
  });

  describe('clear', () => {
    test('should clear all context items', async () => {
      await fs.writeFile('test1.js', 'content1');
      await fs.writeFile('test2.js', 'content2');
      
      await contextManager.addFile('test1.js');
      await contextManager.addFile('test2.js');
      
      let items = await contextManager.list();
      expect(items).toHaveLength(2);
      
      await contextManager.clear();
      
      items = await contextManager.list();
      expect(items).toHaveLength(0);
    });
  });

  describe('getNextId', () => {
    test('should generate incremental IDs', async () => {
      const id1 = await contextManager.getNextId();
      const id2 = await contextManager.getNextId();
      const id3 = await contextManager.getNextId();
      
      expect(id2).toBe(id1 + 1);
      expect(id3).toBe(id2 + 1);
    });

    test('should persist ID counter across instances', async () => {
      const id1 = await contextManager.getNextId();
      
      // Create new instance
      const newContextManager = new ContextManager();
      const id2 = await newContextManager.getNextId();
      
      expect(id2).toBe(id1 + 1);
    });
  });
});