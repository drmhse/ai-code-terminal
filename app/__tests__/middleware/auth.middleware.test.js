const jwt = require('jsonwebtoken');
const { authenticateToken, authenticateSocket } = require('../../src/middleware/auth.middleware');

// Mock environment
jest.mock('../../src/config/environment', () => ({
  JWT_SECRET: 'test-secret-key'
}));

// Mock jwt
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let req, res, next, socket;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    socket = {
      handshake: {
        auth: {}
      }
    };
    
    jest.clearAllMocks();
    
    // Mock console.error to avoid test output noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('authenticateToken', () => {
    it('should return 401 when no authorization header is provided', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is malformed', () => {
      req.headers.authorization = 'InvalidHeader';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when token verification fails', () => {
      req.headers.authorization = 'Bearer invalid-token';
      const error = new Error('Invalid token');
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(error, null);
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(console.error).toHaveBeenCalledWith('Token verification failed:', 'Invalid token');
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next and set req.user when token is valid', () => {
      req.headers.authorization = 'Bearer valid-token';
      const mockUser = { id: '123', username: 'testuser' };
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, mockUser);
      });

      authenticateToken(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('authenticateSocket', () => {
    it('should call next with error when no token is provided', () => {
      authenticateSocket(socket, next);

      expect(next).toHaveBeenCalledWith(new Error('Authentication error'));
    });

    it('should call next with error when token verification fails', () => {
      socket.handshake.auth.token = 'invalid-token';
      const error = new Error('Invalid token');
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(error, null);
      });

      authenticateSocket(socket, next);

      expect(next).toHaveBeenCalledWith(new Error('Authentication error'));
      expect(console.error).toHaveBeenCalledWith('Socket authentication failed:', 'Invalid token');
    });

    it('should call next without error and set socket.user when token is valid', () => {
      socket.handshake.auth.token = 'valid-token';
      const mockUser = { id: '123', username: 'testuser' };
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, mockUser);
      });

      authenticateSocket(socket, next);

      expect(socket.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith();
    });
  });
});