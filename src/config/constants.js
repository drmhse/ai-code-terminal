const path = require('path');

module.exports = {
  PATHS: {
    DATA_DIR: path.join(process.cwd(), 'data'),
    WORKSPACES_DIR: path.join(process.cwd(), 'workspaces'),
    SESSIONS_DIR: path.join(process.cwd(), 'data', 'sessions'),
    USERS_FILE: path.join(process.cwd(), 'data', 'users.json'),
  },
  
  LIMITS: {
    SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
    MAX_TURNS_PER_SESSION: 50,
    REQUEST_SIZE_LIMIT: '10mb',
    BCRYPT_ROUNDS: 12
  },
  
  CLAUDE: {
    DEFAULT_ARGS: ['--output-format', 'stream-json'],
    PROCESS_TIMEOUT_MS: 30 * 60 * 1000
  },
  
  SOCKET: {
    CONNECTION_TIMEOUT_MS: 30000,
    HEARTBEAT_INTERVAL_MS: 25000
  }
};