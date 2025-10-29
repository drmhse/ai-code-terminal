// Mock environment before requiring cors config
const mockEnvironment = {
  FRONTEND_URL: '',
  ALLOWED_ORIGINS: ''
};

jest.mock('../../src/config/environment', () => mockEnvironment);

describe('CORS Configuration', () => {
  let corsConfig, socketCorsConfig, allowedOrigins;

  beforeEach(() => {
    // Reset mocked environment
    mockEnvironment.FRONTEND_URL = '';
    mockEnvironment.ALLOWED_ORIGINS = '';
    
    // Clear require cache to get fresh instance
    delete require.cache[require.resolve('../../src/config/cors')];
    
    // Console warn/log mocking
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with no environment variables', () => {
    beforeEach(() => {
      const corsModule = require('../../src/config/cors');
      corsConfig = corsModule.corsConfig;
      socketCorsConfig = corsModule.socketCorsConfig;
      allowedOrigins = corsModule.allowedOrigins;
    });

    it('should have empty allowed origins', () => {
      expect(allowedOrigins).toEqual([]);
    });

    it('should allow requests with no origin', (done) => {
      corsConfig.origin(null, (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      });
    });

    it('should block requests with unknown origin', (done) => {
      corsConfig.origin('https://malicious-site.com', (err, allowed) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Not allowed by CORS');
        expect(console.warn).toHaveBeenCalledWith(
          'CORS blocked origin: https://malicious-site.com. Allowed origins:',
          []
        );
        done();
      });
    });
  });

  describe('with FRONTEND_URL set', () => {
    beforeEach(() => {
      mockEnvironment.FRONTEND_URL = 'https://myapp.com';
      
      const corsModule = require('../../src/config/cors');
      corsConfig = corsModule.corsConfig;
      socketCorsConfig = corsModule.socketCorsConfig;
      allowedOrigins = corsModule.allowedOrigins;
    });

    it('should include frontend URL in allowed origins', () => {
      expect(allowedOrigins).toContain('https://myapp.com');
    });

    it('should allow requests from frontend URL', (done) => {
      corsConfig.origin('https://myapp.com', (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      });
    });

    it('should block requests from other origins', (done) => {
      corsConfig.origin('https://other-site.com', (err, allowed) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Not allowed by CORS');
        done();
      });
    });
  });

  describe('with ALLOWED_ORIGINS set', () => {
    beforeEach(() => {
      mockEnvironment.ALLOWED_ORIGINS = 'https://app1.com, https://app2.com,https://app3.com';
      
      const corsModule = require('../../src/config/cors');
      corsConfig = corsModule.corsConfig;
      socketCorsConfig = corsModule.socketCorsConfig;
      allowedOrigins = corsModule.allowedOrigins;
    });

    it('should parse comma-separated origins correctly', () => {
      expect(allowedOrigins).toEqual(['https://app1.com', 'https://app2.com', 'https://app3.com']);
    });

    it('should allow requests from any allowed origin', (done) => {
      corsConfig.origin('https://app2.com', (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      });
    });
  });

  describe('with both FRONTEND_URL and ALLOWED_ORIGINS set', () => {
    beforeEach(() => {
      mockEnvironment.FRONTEND_URL = 'https://frontend.com';
      mockEnvironment.ALLOWED_ORIGINS = 'https://api.com,https://admin.com';
      
      const corsModule = require('../../src/config/cors');
      corsConfig = corsModule.corsConfig;
      socketCorsConfig = corsModule.socketCorsConfig;
      allowedOrigins = corsModule.allowedOrigins;
    });

    it('should include both frontend URL and additional origins', () => {
      expect(allowedOrigins).toEqual([
        'https://frontend.com',
        'https://api.com',
        'https://admin.com'
      ]);
    });

    it('should allow requests from frontend URL', (done) => {
      corsConfig.origin('https://frontend.com', (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      });
    });

    it('should allow requests from additional origins', (done) => {
      corsConfig.origin('https://admin.com', (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      });
    });
  });

  describe('corsConfig structure', () => {
    beforeEach(() => {
      const corsModule = require('../../src/config/cors');
      corsConfig = corsModule.corsConfig;
    });

    it('should have correct HTTP methods', () => {
      expect(corsConfig.methods).toEqual(["GET", "POST", "PUT", "DELETE", "OPTIONS"]);
    });

    it('should have correct allowed headers', () => {
      expect(corsConfig.allowedHeaders).toEqual(["Content-Type", "Authorization", "X-Requested-With"]);
    });

    it('should enable credentials', () => {
      expect(corsConfig.credentials).toBe(true);
    });

    it('should have correct options success status', () => {
      expect(corsConfig.optionsSuccessStatus).toBe(200);
    });

    it('should have an origin function', () => {
      expect(typeof corsConfig.origin).toBe('function');
    });
  });

  describe('socketCorsConfig structure', () => {
    beforeEach(() => {
      const corsModule = require('../../src/config/cors');
      socketCorsConfig = corsModule.socketCorsConfig;
    });

    it('should have correct HTTP methods for socket', () => {
      expect(socketCorsConfig.methods).toEqual(["GET", "POST"]);
    });

    it('should enable credentials for socket', () => {
      expect(socketCorsConfig.credentials).toBe(true);
    });

    it('should have an origin function for socket', () => {
      expect(typeof socketCorsConfig.origin).toBe('function');
    });

    it('should allow requests with no origin for socket', (done) => {
      socketCorsConfig.origin(undefined, (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      });
    });

    it('should block unknown origins for socket', (done) => {
      socketCorsConfig.origin('https://unknown.com', (err, allowed) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Not allowed by CORS');
        expect(console.warn).toHaveBeenCalledWith(
          'Socket.IO CORS blocked origin: https://unknown.com. Allowed origins:',
          []
        );
        done();
      });
    });
  });
});