const environment = require('./environment');

// Helper function to get allowed origins
function getAllowedOrigins() {
  const origins = [];

  // Add frontend URL from environment
  if (environment.FRONTEND_URL) {
    origins.push(environment.FRONTEND_URL);
  }

  // Add additional allowed origins from environment
  if (environment.ALLOWED_ORIGINS) {
    const additionalOrigins = environment.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    origins.push(...additionalOrigins);
  }

  return origins;
}

const allowedOrigins = getAllowedOrigins();

const corsConfig = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true, // Allow cookies/auth headers
  optionsSuccessStatus: 200
};

const socketCorsConfig = {
  origin: function (origin, callback) {
    // Allow requests with no origin
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Socket.IO CORS blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST"],
  credentials: true
};

module.exports = {
  corsConfig,
  socketCorsConfig,
  allowedOrigins
};
