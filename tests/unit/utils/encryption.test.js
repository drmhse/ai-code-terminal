import { describe, it, expect, beforeEach } from 'vitest';

describe('Encryption Utilities', () => {
  let encryption;

  beforeEach(async () => {
    // Set environment variable for encryption
    process.env.JWT_SECRET = 'test-encryption-key-for-testing-purposes-must-be-32-chars';
    
    // Import after setting environment
    const module = await import('@/utils/encryption.js');
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
      expect(encryptedToken).toContain(':');
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
      const decryptedToken = encryption.decryptToken(encryptedToken);
      
      expect(decryptedToken).toBe(plainToken);
    });

    it('should throw error for invalid encrypted token format', () => {
      expect(() => encryption.decryptToken('invalid-format')).toThrow(
        'Failed to decrypt token'
      );
    });

    it('should throw error for malformed encrypted token', () => {
      expect(() => encryption.decryptToken('invalid:format:too:many:parts')).toThrow(
        'Failed to decrypt token'
      );
    });

    it('should throw error for invalid hex characters', () => {
      expect(() => encryption.decryptToken('invalid-hex:also-invalid-hex')).toThrow(
        'Failed to decrypt token'
      );
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