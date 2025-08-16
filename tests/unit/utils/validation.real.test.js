import { describe, it, expect } from 'vitest';

describe('Validation Utilities - Real Implementation', () => {
  let validator;

  beforeEach(async () => {
    const validation = await import('../../../src/utils/validation.js');
    validator = validation.default;
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
        'a@b.co',
      ];

      validEmails.forEach(email => {
        expect(validator.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        '',
        'user@',
        'user name@example.com',
        'user@example',
        null,
        undefined,
        123,
      ];

      invalidEmails.forEach(email => {
        expect(validator.isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('isValidUsername', () => {
    it('should validate correct usernames', () => {
      const validUsernames = [
        'validuser',
        'user123',
        'user_name',
        'valid_user_123',
        'abc',
      ];

      validUsernames.forEach(username => {
        expect(validator.isValidUsername(username)).toBe(true);
      });
    });

    it('should reject invalid usernames', () => {
      const invalidUsernames = [
        '',
        'a', // Too short
        'ab', // Too short
        'user name', // Space
        'user-name', // Dash
        'user@name', // Special chars
        'a'.repeat(51), // Too long
        null,
        undefined,
        123,
      ];

      invalidUsernames.forEach(username => {
        expect(validator.isValidUsername(username)).toBe(false);
      });
    });
  });

  describe('isValidPassword', () => {
    it('should validate correct passwords', () => {
      const validPasswords = [
        'password123',
        '123456',
        'simplepass',
        'complex!@#$%^&*()',
        'a'.repeat(100),
      ];

      validPasswords.forEach(password => {
        expect(validator.isValidPassword(password)).toBe(true);
      });
    });

    it('should reject invalid passwords', () => {
      const invalidPasswords = [
        '',
        '12345', // Too short
        'abc', // Too short
        null,
        undefined,
        123,
      ];

      invalidPasswords.forEach(password => {
        expect(validator.isValidPassword(password)).toBe(false);
      });
    });
  });

  describe('isValidGitHubToken', () => {
    it('should validate correct GitHub tokens', () => {
      const validTokens = [
        'ghp_1234567890abcdef1234567890abcdef12345678',
        'github_pat_1234567890abcdef1234567890abcdef',
        'ghp_' + 'a'.repeat(36),
        'github_pat_' + 'a'.repeat(20),
      ];

      validTokens.forEach(token => {
        expect(validator.isValidGitHubToken(token)).toBe(true);
      });
    });

    it('should reject invalid GitHub tokens', () => {
      const invalidTokens = [
        'invalid-token',
        'gho_123', // Wrong prefix
        'ghp_123', // Too short
        'github_pat_abc', // Too short
        '',
        null,
        undefined,
        123,
      ];

      invalidTokens.forEach(token => {
        expect(validator.isValidGitHubToken(token)).toBe(false);
      });
    });
  });

  describe('isValidRepoUrl', () => {
    it('should validate correct repository URLs', () => {
      const validUrls = [
        'https://github.com/owner/repo',
        'https://github.com/user-name/repo-name',
        'https://github.com/org123/project-123',
        'https://github.com/owner/repo.git',
      ];

      validUrls.forEach(url => {
        expect(validator.isValidRepoUrl(url)).toBe(true);
      });
    });

    it('should reject invalid repository URLs', () => {
      const invalidUrls = [
        'invalid',
        'http://example.com',
        'https://gitlab.com/owner/repo',
        'github.com/owner/repo',
        '',
        null,
        undefined,
        123,
      ];

      invalidUrls.forEach(url => {
        expect(validator.isValidRepoUrl(url)).toBe(false);
      });
    });
  });

  describe('isValidPath', () => {
    it('should validate correct paths', () => {
      const validPaths = [
        '/valid/path',
        '/home/user/documents',
        './relative/path',
        '../parent/path',
        'simple-path',
      ];

      validPaths.forEach(path => {
        expect(validator.isValidPath(path)).toBe(true);
      });
    });

    it('should reject paths with dangerous characters', () => {
      const invalidPaths = [
        'path<with>invalid:chars',
        'path|with|pipes',
        'path"with"quotes',
        'path?with?question',
        'path*with*asterisk',
        null,
        undefined,
        123,
      ];

      invalidPaths.forEach(path => {
        expect(validator.isValidPath(path)).toBe(false);
      });
    });
  });

  describe('validation helpers', () => {
    it('should create validation errors', () => {
      const error = validator.createValidationError('username', 'Username is required');
      
      expect(error).toBeDefined();
      expect(error.field).toBe('username');
      expect(error.message).toBe('Username is required');
      expect(error.valid).toBe(false);
    });

    it('should create validation success', () => {
      const success = validator.createValidationSuccess();
      
      expect(success).toBeDefined();
      expect(success.valid).toBe(true);
    });
  });

  describe('validateObject', () => {
    it('should validate objects with schema', () => {
      const testObject = {
        username: 'validuser',
        email: 'test@example.com',
      };

      const schema = {
        username: (value) => validator.isValidUsername(value) ? { valid: true } : { valid: false, message: 'Invalid username' },
        email: (value) => validator.isValidEmail(value) ? { valid: true } : { valid: false, message: 'Invalid email' },
      };

      const result = validator.validateObject(testObject, schema);
      
      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return validation errors for invalid objects', () => {
      const invalidObject = {
        username: 'ab', // Too short
        email: 'invalid-email',
      };

      const schema = {
        username: (value) => validator.isValidUsername(value) ? { valid: true } : { valid: false, message: 'Invalid username' },
        email: (value) => validator.isValidEmail(value) ? { valid: true } : { valid: false, message: 'Invalid email' },
      };

      const result = validator.validateObject(invalidObject, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});