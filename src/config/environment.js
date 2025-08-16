module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL || 'file:./data/database.db',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL: process.env.GITHUB_CALLBACK_URL,
  TENANT_GITHUB_USERNAME: process.env.TENANT_GITHUB_USERNAME,
  WORKSPACE_CLEANUP_DAYS: parseInt(process.env.WORKSPACE_CLEANUP_DAYS) || 30,
  FRONTEND_URL: process.env.FRONTEND_URL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  
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