const crypto = require('crypto');
const environment = require('../config/environment');

// Simple encryption utilities for token storage
// Future: Enhanced encryption for GitHub tokens in database

class EncryptionUtil {
  constructor() {
    // Use JWT_SECRET as encryption key base (not ideal, but sufficient for now)
    this.algorithm = 'aes-256-cbc';
    this.keyBuffer = crypto.scryptSync(environment.JWT_SECRET, 'salt', 32);
  }

  encrypt(text) {
    if (!text) return null;
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.keyBuffer, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        iv: iv.toString('hex'),
        data: encrypted
      };
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }

  decrypt(encryptedData) {
    if (!encryptedData || !encryptedData.data || !encryptedData.iv) return null;
    
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.keyBuffer, iv);
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  // Secure token encryption for database storage
  encryptToken(token) {
    if (!token) return null;
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.keyBuffer, iv);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return as JSON string for database storage
      return JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted
      });
    } catch (error) {
      console.error('Token encryption error:', error);
      return null;
    }
  }

  decryptToken(encryptedToken) {
    if (!encryptedToken) return null;
    
    try {
      // Handle both old base64 format and new encrypted format
      let encryptedData;
      
      // Try to parse as JSON (new encrypted format)
      try {
        encryptedData = JSON.parse(encryptedToken);
      } catch {
        // Fallback to old base64 format
        try {
          return Buffer.from(encryptedToken, 'base64').toString('utf8');
        } catch {
          return null;
        }
      }
      
      // Decrypt using new format
      if (encryptedData && encryptedData.data && encryptedData.iv) {
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, this.keyBuffer, iv);
        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
      
      return null;
    } catch (error) {
      console.error('Token decryption error:', error);
      return null;
    }
  }

  // Generate secure random strings
  generateSecureId(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Hash utilities
  hashSensitiveData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  verifyHash(data, hash) {
    const dataHash = this.hashSensitiveData(data);
    return crypto.timingSafeEqual(Buffer.from(dataHash), Buffer.from(hash));
  }
}

module.exports = new EncryptionUtil();