const jwt = require('jsonwebtoken');
const environment = require('../config/environment');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, environment.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, environment.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Socket authentication failed:', err.message);
      return next(new Error('Authentication error'));
    }
    socket.user = user;
    next();
  });
}

module.exports = {
  authenticateToken,
  authenticateSocket
};