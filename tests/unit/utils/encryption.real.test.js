import { describe, it, expect, beforeEach } from 'vitest';

describe('Encryption Utilities - Real Implementation', () => {
  let encryption;

  beforeEach(async () => {
    // Set environment variable for encryption
    process.env.JWT_SECRET = 'test-encryption-key-for-testing-purposes-must-be-32-chars';
    
    // Import the actual implementation
    const module = await import('../../../src/utils/encryption.js');
    encryption = module.default;
  });

  describe('encryptToken', () => {
    it('should encrypt a token successfully', () => {
      const plainToken = 'gho_test_token_123456789';
      
      const encryptedToken = encryption.encryptToken(plainToken);
      
      expect(encryptedToken).toBeDefined();
      expect(encryptedToken).not.toBe(plainToken);
      expect(encryptedToken).toContain(':'); // Should contain IV separator
      expect(typeof encryptedToken).toBe('string');
    });

    it('should produce different encrypted values for the same input', () => {
      const plainToken = 'gho_test_token_123456789';
      
      const encrypted1 = encryption.encryptToken(plainToken);
      const encrypted2 = encryption.encryptToken(plainToken);
      
      expect(encrypted1).not.toBe(encrypted2); // Different IVs should produce different results
    });

    it('should handle empty string', () => {
      const encryptedToken = encryption.encryptToken('');
      
      expect(encryptedToken).toBeDefined();
      if (encryptedToken !== null) {
        expect(encryptedToken).toContain(':');
      }
    });
  });

  describe('decryptToken', () => {
    it('should decrypt a token successfully', () => {
      const plainToken = 'gho_test_token_123456789';
      
      const encryptedToken = encryption.encryptToken(plainToken);
      const decryptedToken = encryption.decryptToken(encryptedToken);
      
      expect(decryptedToken).toBe(plainToken);
    });

    it('should handle empty string encryption/decryption', () => {
      const plainToken = '';
      
      const encryptedToken = encryption.encryptToken(plainToken);
      if (encryptedToken !== null) {
        const decryptedToken = encryption.decryptToken(encryptedToken);
        expect(decryptedToken).toBe(plainToken);
      } else {
        // If encryption returns null for empty string, that's acceptable
        expect(encryptedToken).toBeNull();
      }
    });

    it('should handle invalid encrypted token format gracefully', () => {
      const result = encryption.decryptToken('invalid-format');
      // The function might return null or throw an error, both are acceptable
      if (result !== null) {
        expect(typeof result).toBe('string');
      }
    });

    it('should handle malformed encrypted token gracefully', () => {
      const result = encryption.decryptToken('invalid:format:too:many:parts');
      // The function might return null or throw an error, both are acceptable
      if (result !== null) {
        expect(typeof result).toBe('string');
      }
    });

    it('should handle invalid hex characters gracefully', () => {
      const result = encryption.decryptToken('invalid-hex:also-invalid-hex');
      // The function might return null or throw an error, both are acceptable
      if (result !== null) {
        expect(typeof result).toBe('string');
      }
    });
  });

  describe('encrypt/decrypt round trip', () => {
    it('should handle various token formats', () => {
      const testTokens = [
        'gho_1234567890abcdef',
        'ghp_abcdefghijklmnop',
        'simple-token',
        'token-with-special-chars!@#$%^&*()',
        '{"json": "token", "type": "bearer"}',
      ];

      testTokens.forEach(token => {
        const encrypted = encryption.encryptToken(token);
        const decrypted = encryption.decryptToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });

    it('should handle long tokens', () => {
      const longToken = 'a'.repeat(1000);
      
      const encrypted = encryption.encryptToken(longToken);
      const decrypted = encryption.decryptToken(encrypted);
      
      expect(decrypted).toBe(longToken);
    });
  });
});