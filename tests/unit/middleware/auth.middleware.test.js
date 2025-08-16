import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock environment - use the correct module format
vi.mock('@/config/environment', () => ({
  JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only-must-be-at-least-32-chars',
}));

describe('Auth Middleware', () => {
  let authMiddleware;
  let mockReq, mockRes, mockNext, mockSocket;

  beforeEach(async () => {
    // Import after mocks are set up
    const module = await import('@/middleware/auth.middleware.js');
    authMiddleware = module.default;

    mockReq = {
      headers: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();

    mockSocket = {
      handshake: {
        auth: {},
      },
    };

    vi.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const validToken = jwt.sign({ id: 'user123', username: 'testuser' }, 'test-jwt-secret-key-for-testing-purposes-only-must-be-at-least-32-chars');
      mockReq.headers['authorization'] = `Bearer ${validToken}`;

      authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        id: 'user123',
        username: 'testuser',
        iat: expect.any(Number),
      });
    });

    it('should reject request without token', () => {
      authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      mockReq.headers['authorization'] = 'Bearer invalid-token';

      authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', () => {
      mockReq.headers['authorization'] = 'invalid-format';

      authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired token', () => {
      const expiredToken = jwt.sign(
        { id: 'user123', username: 'testuser', exp: Math.floor(Date.now() / 1000) - 60 },
        'test-jwt-secret-key-for-testing-purposes-only-must-be-at-least-32-chars'
      );
      mockReq.headers['authorization'] = `Bearer ${expiredToken}`;

      authMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authenticateSocket', () => {
    it('should authenticate valid socket token', () => {
      const validToken = jwt.sign({ id: 'user123', username: 'testuser' }, 'test-jwt-secret-key-for-testing-purposes-only-must-be-at-least-32-chars');
      mockSocket.handshake.auth.token = validToken;

      authMiddleware.authenticateSocket(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toEqual({
        id: 'user123',
        username: 'testuser',
        iat: expect.any(Number),
      });
    });

    it('should reject socket without token', () => {
      authMiddleware.authenticateSocket(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Authentication error');
    });

    it('should reject socket with invalid token', () => {
      mockSocket.handshake.auth.token = 'invalid-token';

      authMiddleware.authenticateSocket(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Authentication error');
    });

    it('should reject socket with expired token', () => {
      const expiredToken = jwt.sign(
        { id: 'user123', username: 'testuser', exp: Math.floor(Date.now() / 1000) - 60 },
        'test-jwt-secret-key-for-testing-purposes-only-must-be-at-least-32-chars'
      );
      mockSocket.handshake.auth.token = expiredToken;

      authMiddleware.authenticateSocket(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Authentication error');
    });
  });
});