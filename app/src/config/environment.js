module.exports = {
  get JWT_SECRET() { return process.env.JWT_SECRET || 'fallback-secret-change-in-production'; },
  get NODE_ENV() { return process.env.NODE_ENV || 'development'; },
  get PORT() { return parseInt(process.env.PORT) || 3014; },
  get DATABASE_URL() { return process.env.DATABASE_URL || 'file:./data/database.db'; },
  get GITHUB_CLIENT_ID() { return process.env.GITHUB_CLIENT_ID; },
  get GITHUB_CLIENT_SECRET() { return process.env.GITHUB_CLIENT_SECRET; },
  get GITHUB_CALLBACK_URL() { return process.env.GITHUB_CALLBACK_URL; },
  get TENANT_GITHUB_USERNAME() { return process.env.TENANT_GITHUB_USERNAME; },
  get WORKSPACE_CLEANUP_DAYS() { return parseInt(process.env.WORKSPACE_CLEANUP_DAYS) || 30; },
  get FRONTEND_URL() { return process.env.FRONTEND_URL; },
  get ALLOWED_ORIGINS() { return process.env.ALLOWED_ORIGINS; },
  
  // Logging Configuration
  get LOG_LEVEL() { return process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'); },
  get LOG_MAX_SIZE() { return process.env.LOG_MAX_SIZE || '20m'; },
  get LOG_MAX_FILES() { return process.env.LOG_MAX_FILES || '30d'; },
  get LOG_COMPRESS() { return process.env.LOG_COMPRESS === 'false' ? false : true; },
  
  validate() {
    if (this.NODE_ENV === 'production' && this.JWT_SECRET === 'fallback-secret-change-in-production') {
      console.error('WARNING: Using fallback JWT secret in production! Set JWT_SECRET environment variable.');
    }
    
    if (this.JWT_SECRET.length < 32) {
      console.warn('JWT_SECRET should be at least 32 characters for production use');
    }
    
    if (!this.TENANT_GITHUB_USERNAME) {
      console.error('ERROR: TENANT_GITHUB_USERNAME is required for single-tenant mode');
      process.exit(1);
    }
    
    if (!this.GITHUB_CLIENT_ID || !this.GITHUB_CLIENT_SECRET) {
      console.error('ERROR: GitHub OAuth credentials (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET) are required');
      process.exit(1);
    }
    
    if (!this.GITHUB_CALLBACK_URL) {
      console.error('ERROR: GITHUB_CALLBACK_URL is required for OAuth flow');
      process.exit(1);
    }
    
    console.log(`Environment validated: ${this.NODE_ENV} mode on port ${this.PORT} for tenant: ${this.TENANT_GITHUB_USERNAME}`);
  }
};