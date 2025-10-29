const path = require('path');
const constants = require('../../src/config/constants');

describe('Constants Configuration', () => {
  describe('PATHS', () => {
    it('should define correct data directory path', () => {
      expect(constants.PATHS.DATA_DIR).toBe(path.join(process.cwd(), 'data'));
    });

    it('should define correct workspaces directory path', () => {
      expect(constants.PATHS.WORKSPACES_DIR).toBe(path.join(process.cwd(), 'workspaces'));
    });

    it('should define correct sessions directory path', () => {
      expect(constants.PATHS.SESSIONS_DIR).toBe(path.join(process.cwd(), 'data', 'sessions'));
    });

    it('should define correct users file path', () => {
      expect(constants.PATHS.USERS_FILE).toBe(path.join(process.cwd(), 'data', 'users.json'));
    });

    it('should have all required path constants', () => {
      expect(constants.PATHS).toHaveProperty('DATA_DIR');
      expect(constants.PATHS).toHaveProperty('WORKSPACES_DIR');
      expect(constants.PATHS).toHaveProperty('SESSIONS_DIR');
      expect(constants.PATHS).toHaveProperty('USERS_FILE');
    });
  });

  describe('LIMITS', () => {
    it('should define session timeout', () => {
      expect(constants.LIMITS.SESSION_TIMEOUT_MS).toBe(30 * 60 * 1000); // 30 minutes in ms
    });

    it('should define max turns per session', () => {
      expect(constants.LIMITS.MAX_TURNS_PER_SESSION).toBe(50);
    });

    it('should define request size limit', () => {
      expect(constants.LIMITS.REQUEST_SIZE_LIMIT).toBe('10mb');
    });

    it('should define bcrypt rounds', () => {
      expect(constants.LIMITS.BCRYPT_ROUNDS).toBe(12);
    });

    it('should have all required limit constants', () => {
      expect(constants.LIMITS).toHaveProperty('SESSION_TIMEOUT_MS');
      expect(constants.LIMITS).toHaveProperty('MAX_TURNS_PER_SESSION');
      expect(constants.LIMITS).toHaveProperty('REQUEST_SIZE_LIMIT');
      expect(constants.LIMITS).toHaveProperty('BCRYPT_ROUNDS');
    });
  });

  describe('CLAUDE', () => {
    it('should define default arguments', () => {
      expect(constants.CLAUDE.DEFAULT_ARGS).toEqual(['--output-format', 'stream-json']);
    });

    it('should define process timeout', () => {
      expect(constants.CLAUDE.PROCESS_TIMEOUT_MS).toBe(30 * 60 * 1000); // 30 minutes in ms
    });

    it('should have all required Claude constants', () => {
      expect(constants.CLAUDE).toHaveProperty('DEFAULT_ARGS');
      expect(constants.CLAUDE).toHaveProperty('PROCESS_TIMEOUT_MS');
    });
  });

  describe('SOCKET', () => {
    it('should define connection timeout', () => {
      expect(constants.SOCKET.CONNECTION_TIMEOUT_MS).toBe(30000); // 30 seconds
    });

    it('should define heartbeat interval', () => {
      expect(constants.SOCKET.HEARTBEAT_INTERVAL_MS).toBe(25000); // 25 seconds
    });

    it('should have all required socket constants', () => {
      expect(constants.SOCKET).toHaveProperty('CONNECTION_TIMEOUT_MS');
      expect(constants.SOCKET).toHaveProperty('HEARTBEAT_INTERVAL_MS');
    });
  });

  describe('All Constants', () => {
    it('should export all required sections', () => {
      expect(constants).toHaveProperty('PATHS');
      expect(constants).toHaveProperty('LIMITS');
      expect(constants).toHaveProperty('CLAUDE');
      expect(constants).toHaveProperty('SOCKET');
    });

    it('should have reasonable timeout values', () => {
      // Session timeout should be greater than socket heartbeat
      expect(constants.LIMITS.SESSION_TIMEOUT_MS).toBeGreaterThan(constants.SOCKET.HEARTBEAT_INTERVAL_MS);
      
      // Connection timeout should be less than heartbeat interval
      expect(constants.SOCKET.CONNECTION_TIMEOUT_MS).toBeGreaterThan(constants.SOCKET.HEARTBEAT_INTERVAL_MS);
    });

    it('should use absolute paths', () => {
      Object.values(constants.PATHS).forEach(pathValue => {
        expect(path.isAbsolute(pathValue)).toBe(true);
      });
    });
  });
});