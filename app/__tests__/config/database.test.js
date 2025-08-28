// Mock logger first with explicit methods
const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
};

jest.mock('../../src/utils/logger', () => mockLogger);

// Mock PrismaClient with spy methods
const mockPrismaClient = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $on: jest.fn()
};

// Mock PrismaClient constructor
const MockPrismaClient = jest.fn(() => mockPrismaClient);

jest.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient
}));

const { PrismaClient } = require('@prisma/client');
const logger = require('../../src/utils/logger');

describe('Database Configuration', () => {
  let databaseModule;

  beforeEach(() => {
    // Clear all mocks 
    mockPrismaClient.$connect.mockClear();
    mockPrismaClient.$disconnect.mockClear();
    mockPrismaClient.$on.mockClear();
    MockPrismaClient.mockClear();
    
    // Clear logger mocks
    mockLogger.debug.mockClear();
    mockLogger.error.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    
    // Fresh require
    delete require.cache[require.resolve('../../src/config/database')];
    databaseModule = require('../../src/config/database');
  });

  describe('Prisma Client Initialization', () => {
    it('should initialize PrismaClient with correct logging configuration', () => {
      expect(MockPrismaClient).toHaveBeenCalledWith({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' }
        ]
      });
    });

    it('should set up event listeners when setupEventListeners is called', () => {
      // Create a fresh mock client for this test
      const testClient = {
        $on: jest.fn()
      };
      
      // Call setupEventListeners directly
      databaseModule.setupEventListeners(testClient);
      
      expect(testClient.$on).toHaveBeenCalledWith('query', expect.any(Function));
      expect(testClient.$on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(testClient.$on).toHaveBeenCalledWith('info', expect.any(Function));
      expect(testClient.$on).toHaveBeenCalledWith('warn', expect.any(Function));
    });
  });

  describe('Event Handlers', () => {
    it('should log query events', () => {
      // Create a fresh mock client for this test
      const testClient = { $on: jest.fn() };
      
      // Call setupEventListeners to register handlers
      databaseModule.setupEventListeners(testClient);
      
      // Get the query handler that was registered
      const queryHandler = testClient.$on.mock.calls.find(call => call[0] === 'query')[1];
      
      const mockQueryEvent = {
        query: 'SELECT * FROM users',
        params: ['param1'],
        duration: 123,
        timestamp: new Date()
      };

      queryHandler(mockQueryEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith('Prisma Query', {
        query: mockQueryEvent.query,
        params: mockQueryEvent.params,
        duration: mockQueryEvent.duration,
        timestamp: mockQueryEvent.timestamp
      });
    });

    it('should log error events', () => {
      // Create a fresh mock client for this test
      const testClient = { $on: jest.fn() };
      
      // Call setupEventListeners to register handlers
      databaseModule.setupEventListeners(testClient);
      
      const errorHandler = testClient.$on.mock.calls.find(call => call[0] === 'error')[1];
      
      const mockErrorEvent = {
        message: 'Database error',
        target: 'users',
        timestamp: new Date()
      };

      errorHandler(mockErrorEvent);

      expect(mockLogger.error).toHaveBeenCalledWith('Prisma Error', {
        message: mockErrorEvent.message,
        target: mockErrorEvent.target,
        timestamp: mockErrorEvent.timestamp
      });
    });

    it('should log info events', () => {
      // Create a fresh mock client for this test
      const testClient = { $on: jest.fn() };
      
      // Call setupEventListeners to register handlers
      databaseModule.setupEventListeners(testClient);
      
      const infoHandler = testClient.$on.mock.calls.find(call => call[0] === 'info')[1];
      
      const mockInfoEvent = {
        message: 'Database info',
        timestamp: new Date()
      };

      infoHandler(mockInfoEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Prisma Info', {
        message: mockInfoEvent.message,
        timestamp: mockInfoEvent.timestamp
      });
    });

    it('should log warn events', () => {
      // Create a fresh mock client for this test
      const testClient = { $on: jest.fn() };
      
      // Call setupEventListeners to register handlers
      databaseModule.setupEventListeners(testClient);
      
      const warnHandler = testClient.$on.mock.calls.find(call => call[0] === 'warn')[1];
      
      const mockWarnEvent = {
        message: 'Database warning',
        timestamp: new Date()
      };

      warnHandler(mockWarnEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith('Prisma Warning', {
        message: mockWarnEvent.message,
        timestamp: mockWarnEvent.timestamp
      });
    });
  });

  describe('testConnection', () => {
    it('should return true when connection succeeds', async () => {
      mockPrismaClient.$connect.mockResolvedValue();

      const result = await databaseModule.testConnection();

      expect(result).toBe(true);
      expect(mockPrismaClient.$connect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Database connection established successfully');
    });

    it('should return false and log error when connection fails', async () => {
      const connectionError = new Error('Connection failed');
      mockPrismaClient.$connect.mockRejectedValue(connectionError);

      const result = await databaseModule.testConnection();

      expect(result).toBe(false);
      expect(mockPrismaClient.$connect).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to connect to database', connectionError);
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      mockPrismaClient.$disconnect.mockResolvedValue();

      await databaseModule.disconnect();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Database connection closed successfully');
    });

    it('should handle disconnect errors gracefully', async () => {
      const disconnectError = new Error('Disconnect failed');
      mockPrismaClient.$disconnect.mockRejectedValue(disconnectError);

      await databaseModule.disconnect();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Error disconnecting from database', disconnectError);
    });
  });

  describe('Module Exports', () => {
    it('should export prisma client', () => {
      expect(databaseModule.prisma).toBe(mockPrismaClient);
    });

    it('should export testConnection function', () => {
      expect(typeof databaseModule.testConnection).toBe('function');
    });

    it('should export disconnect function', () => {
      expect(typeof databaseModule.disconnect).toBe('function');
    });
  });
});