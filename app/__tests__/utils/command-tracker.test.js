// Mock dependencies
jest.mock('../../src/services/process-supervisor.service');
jest.mock('../../src/utils/logger');

const commandTracker = require('../../src/utils/command-tracker');
const processSupervisorService = require('../../src/services/process-supervisor.service');
const logger = require('../../src/utils/logger');

describe('CommandTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldTrackCommand', () => {
    it('should track long-running commands', () => {
      expect(commandTracker.shouldTrackCommand('npm run dev')).toBe(true);
      expect(commandTracker.shouldTrackCommand('npm start')).toBe(true);
      expect(commandTracker.shouldTrackCommand('yarn dev')).toBe(true);
      expect(commandTracker.shouldTrackCommand('next dev --port 3000')).toBe(true);
      expect(commandTracker.shouldTrackCommand('nodemon server.js')).toBe(true);
      expect(commandTracker.shouldTrackCommand('docker-compose up -d')).toBe(true);
    });

    it('should track watchable commands with watch flags', () => {
      expect(commandTracker.shouldTrackCommand('jest --watch')).toBe(true);
      expect(commandTracker.shouldTrackCommand('npm test -- --watch')).toBe(true);
      expect(commandTracker.shouldTrackCommand('vitest --watch --coverage')).toBe(true);
      expect(commandTracker.shouldTrackCommand('tsc -w')).toBe(true);
    });

    it('should not track watchable commands without watch flags', () => {
      expect(commandTracker.shouldTrackCommand('jest')).toBe(false);
      expect(commandTracker.shouldTrackCommand('npm test')).toBe(false);
      expect(commandTracker.shouldTrackCommand('mocha test/*.js')).toBe(false);
    });

    it('should track commands with long-running patterns', () => {
      expect(commandTracker.shouldTrackCommand('webpack --watch --hot')).toBe(true);
      expect(commandTracker.shouldTrackCommand('some-command --reload')).toBe(true);
      expect(commandTracker.shouldTrackCommand('custom-server --dev --port 8080')).toBe(true);
      expect(commandTracker.shouldTrackCommand('python -m http.server 8000')).toBe(true);
      expect(commandTracker.shouldTrackCommand('tail -f /var/log/app.log')).toBe(true);
      expect(commandTracker.shouldTrackCommand('watch ls -la')).toBe(true);
    });

    it('should not track short or invalid commands', () => {
      expect(commandTracker.shouldTrackCommand('ls')).toBe(false);
      expect(commandTracker.shouldTrackCommand('cd')).toBe(false);
      expect(commandTracker.shouldTrackCommand('pwd')).toBe(false);
      expect(commandTracker.shouldTrackCommand('')).toBe(false);
      expect(commandTracker.shouldTrackCommand(null)).toBe(false);
      expect(commandTracker.shouldTrackCommand(undefined)).toBe(false);
      expect(commandTracker.shouldTrackCommand(123)).toBe(false);
    });

    it('should not track common non-long-running commands', () => {
      expect(commandTracker.shouldTrackCommand('git status')).toBe(false);
      expect(commandTracker.shouldTrackCommand('npm install')).toBe(false);
      expect(commandTracker.shouldTrackCommand('cat file.txt')).toBe(false);
      expect(commandTracker.shouldTrackCommand('echo hello')).toBe(false);
    });

    it('should handle commands with extra whitespace', () => {
      expect(commandTracker.shouldTrackCommand('  npm run dev  ')).toBe(true);
      expect(commandTracker.shouldTrackCommand('\tnpm start\n')).toBe(true);
    });
  });

  describe('hasLongRunningPatterns', () => {
    it('should detect watch patterns', () => {
      expect(commandTracker.hasLongRunningPatterns('command --watch')).toBe(true);
      expect(commandTracker.hasLongRunningPatterns('command --hot')).toBe(true);
      expect(commandTracker.hasLongRunningPatterns('command --reload')).toBe(true);
      expect(commandTracker.hasLongRunningPatterns('command --dev')).toBe(true);
    });

    it('should detect server patterns', () => {
      expect(commandTracker.hasLongRunningPatterns('python -m http.server')).toBe(true);
      expect(commandTracker.hasLongRunningPatterns('python -m uvicorn')).toBe(true);
      expect(commandTracker.hasLongRunningPatterns('python -m gunicorn')).toBe(true);
    });

    it('should detect port specifications', () => {
      expect(commandTracker.hasLongRunningPatterns('server -p 3000 --dev')).toBe(true);
      expect(commandTracker.hasLongRunningPatterns('app --port 8080')).toBe(true);
    });

    it('should detect tail and watch commands', () => {
      expect(commandTracker.hasLongRunningPatterns('tail -f logfile')).toBe(true);
      expect(commandTracker.hasLongRunningPatterns('watch ls -la')).toBe(true);
    });

    it('should not detect patterns in regular commands', () => {
      expect(commandTracker.hasLongRunningPatterns('ls -la')).toBe(false);
      expect(commandTracker.hasLongRunningPatterns('npm install')).toBe(false);
    });
  });

  describe('parseCommand', () => {
    it('should parse simple commands', () => {
      const result = commandTracker.parseCommand('npm start');
      expect(result).toEqual({
        command: 'npm',
        args: ['start']
      });
    });

    it('should parse commands with multiple arguments', () => {
      const result = commandTracker.parseCommand('node server.js --port 3000 --env production');
      expect(result).toEqual({
        command: 'node',
        args: ['server.js', '--port', '3000', '--env', 'production']
      });
    });

    it('should handle commands with extra whitespace', () => {
      const result = commandTracker.parseCommand('  npm   run   dev  ');
      expect(result).toEqual({
        command: 'npm',
        args: ['run', 'dev']
      });
    });

    it('should handle single word commands', () => {
      const result = commandTracker.parseCommand('nodemon');
      expect(result).toEqual({
        command: 'nodemon',
        args: []
      });
    });
  });

  describe('getTrackingOptions', () => {
    it('should return basic tracking options', () => {
      const result = commandTracker.getTrackingOptions('echo hello', 'session1', 'workspace1');
      
      expect(result).toEqual({
        command: 'echo',
        args: ['hello'],
        options: {
          sessionId: 'session1',
          workspaceId: 'workspace1',
          autoRestart: false,
          cwd: process.cwd()
        }
      });
    });

    it('should enable auto-restart for development servers', () => {
      const result = commandTracker.getTrackingOptions('npm run dev', 'session1', 'workspace1');
      
      expect(result.options.autoRestart).toBe(true);
    });

    it('should not enable auto-restart for non-development commands', () => {
      const result = commandTracker.getTrackingOptions('docker-compose up', 'session1', 'workspace1');
      
      expect(result.options.autoRestart).toBe(false);
    });

    it('should handle null session and workspace IDs', () => {
      const result = commandTracker.getTrackingOptions('npm start');
      
      expect(result.options.sessionId).toBeNull();
      expect(result.options.workspaceId).toBeNull();
    });
  });

  describe('isDevelopmentServer', () => {
    it('should identify development servers', () => {
      expect(commandTracker.isDevelopmentServer('npm run dev')).toBe(true);
      expect(commandTracker.isDevelopmentServer('yarn dev --port 3000')).toBe(true);
      expect(commandTracker.isDevelopmentServer('next dev')).toBe(true);
      expect(commandTracker.isDevelopmentServer('vite --host 0.0.0.0')).toBe(true);
      expect(commandTracker.isDevelopmentServer('nodemon server.js')).toBe(true);
      expect(commandTracker.isDevelopmentServer('ts-node-dev --respawn server.ts')).toBe(true);
      expect(commandTracker.isDevelopmentServer('tsx watch server.ts')).toBe(true);
    });

    it('should not identify non-development commands as dev servers', () => {
      expect(commandTracker.isDevelopmentServer('npm start')).toBe(false);
      expect(commandTracker.isDevelopmentServer('docker-compose up')).toBe(false);
      expect(commandTracker.isDevelopmentServer('python manage.py runserver')).toBe(false);
      expect(commandTracker.isDevelopmentServer('jest --watch')).toBe(false);
    });
  });

  describe('autoTrackCommand', () => {
    beforeEach(() => {
      processSupervisorService.trackProcess.mockReset();
    });

    it('should auto-track trackable commands successfully', async () => {
      const mockResult = { pid: 12345, id: 'proc1' };
      processSupervisorService.trackProcess.mockResolvedValue(mockResult);

      const result = await commandTracker.autoTrackCommand('npm run dev', 'session1', 'workspace1');

      expect(result).toEqual(mockResult);
      expect(processSupervisorService.trackProcess).toHaveBeenCalledWith('npm', ['run', 'dev'], {
        sessionId: 'session1',
        workspaceId: 'workspace1',
        autoRestart: true,
        cwd: process.cwd()
      });
      expect(logger.info).toHaveBeenCalledWith('Auto-tracking command: npm run dev');
      expect(logger.info).toHaveBeenCalledWith('Command auto-tracked successfully: npm run dev (PID: 12345)');
    });

    it('should return null for non-trackable commands', async () => {
      const result = await commandTracker.autoTrackCommand('ls -la');

      expect(result).toBeNull();
      expect(processSupervisorService.trackProcess).not.toHaveBeenCalled();
    });

    it('should handle tracking errors gracefully', async () => {
      processSupervisorService.trackProcess.mockRejectedValue(new Error('Tracking failed'));

      const result = await commandTracker.autoTrackCommand('npm run dev');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Error auto-tracking command:', expect.any(Error));
    });

    it('should handle null/undefined session and workspace IDs', async () => {
      const mockResult = { pid: 12345, id: 'proc1' };
      processSupervisorService.trackProcess.mockResolvedValue(mockResult);

      await commandTracker.autoTrackCommand('npm start');

      expect(processSupervisorService.trackProcess).toHaveBeenCalledWith('npm', ['start'], {
        sessionId: null,
        workspaceId: null,
        autoRestart: false,
        cwd: process.cwd()
      });
    });
  });

  describe('getTrackableCommandExamples', () => {
    it('should return categorized examples of trackable commands', () => {
      const examples = commandTracker.getTrackableCommandExamples();

      expect(examples).toHaveProperty('Development Servers');
      expect(examples).toHaveProperty('Test Watchers');
      expect(examples).toHaveProperty('Build Watchers');
      expect(examples).toHaveProperty('Other Long-Running');

      expect(examples['Development Servers']).toContain('npm run dev');
      expect(examples['Test Watchers']).toContain('jest --watch');
      expect(examples['Build Watchers']).toContain('tsc --watch');
      expect(examples['Other Long-Running']).toContain('docker-compose up');

      // Verify all examples are arrays
      Object.values(examples).forEach(categoryExamples => {
        expect(Array.isArray(categoryExamples)).toBe(true);
        expect(categoryExamples.length).toBeGreaterThan(0);
      });
    });

    it('should include realistic command examples', () => {
      const examples = commandTracker.getTrackableCommandExamples();
      const allExamples = Object.values(examples).flat();

      // Check that examples would actually be tracked
      allExamples.forEach(example => {
        expect(commandTracker.shouldTrackCommand(example)).toBe(true);
      });
    });
  });
});