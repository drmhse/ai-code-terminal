const ValidationUtil = require('../../src/utils/validation');

describe('ValidationUtil', () => {
  describe('isValidUsername', () => {
    it('should validate correct usernames', () => {
      expect(ValidationUtil.isValidUsername('user123')).toBe(true);
      expect(ValidationUtil.isValidUsername('test_user')).toBe(true);
      expect(ValidationUtil.isValidUsername('USER')).toBe(true);
      expect(ValidationUtil.isValidUsername('user_123_test')).toBe(true);
    });

    it('should reject invalid usernames', () => {
      expect(ValidationUtil.isValidUsername('ab')).toBe(false); // Too short
      expect(ValidationUtil.isValidUsername('a'.repeat(51))).toBe(false); // Too long
      expect(ValidationUtil.isValidUsername('user-name')).toBe(false); // Contains dash
      expect(ValidationUtil.isValidUsername('user@name')).toBe(false); // Contains @
      expect(ValidationUtil.isValidUsername('user name')).toBe(false); // Contains space
      expect(ValidationUtil.isValidUsername('')).toBe(false); // Empty
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidUsername(123)).toBe(false);
      expect(ValidationUtil.isValidUsername(null)).toBe(false);
      expect(ValidationUtil.isValidUsername(undefined)).toBe(false);
      expect(ValidationUtil.isValidUsername({})).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('should validate correct passwords', () => {
      expect(ValidationUtil.isValidPassword('password123')).toBe(true);
      expect(ValidationUtil.isValidPassword('123456')).toBe(true);
      expect(ValidationUtil.isValidPassword('verylongpassword')).toBe(true);
    });

    it('should reject invalid passwords', () => {
      expect(ValidationUtil.isValidPassword('12345')).toBe(false); // Too short
      expect(ValidationUtil.isValidPassword('')).toBe(false); // Empty
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidPassword(123456)).toBe(false);
      expect(ValidationUtil.isValidPassword(null)).toBe(false);
      expect(ValidationUtil.isValidPassword(undefined)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(ValidationUtil.isValidEmail('test@example.com')).toBe(true);
      expect(ValidationUtil.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(ValidationUtil.isValidEmail('test123@test.org')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(ValidationUtil.isValidEmail('notanemail')).toBe(false);
      expect(ValidationUtil.isValidEmail('test@')).toBe(false);
      expect(ValidationUtil.isValidEmail('@example.com')).toBe(false);
      expect(ValidationUtil.isValidEmail('test@.com')).toBe(false);
      expect(ValidationUtil.isValidEmail('test.example.com')).toBe(false);
      expect(ValidationUtil.isValidEmail('')).toBe(false);
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidEmail(123)).toBe(false);
      expect(ValidationUtil.isValidEmail(null)).toBe(false);
      expect(ValidationUtil.isValidEmail(undefined)).toBe(false);
    });
  });

  describe('isValidClaudeToken', () => {
    it('should validate correct Claude tokens', () => {
      expect(ValidationUtil.isValidClaudeToken('sk-1234567890abcdef')).toBe(true);
      expect(ValidationUtil.isValidClaudeToken('sk-very-long-token-string')).toBe(true);
    });

    it('should reject invalid Claude tokens', () => {
      expect(ValidationUtil.isValidClaudeToken('sk-short')).toBe(false); // Too short
      expect(ValidationUtil.isValidClaudeToken('ak-1234567890abcdef')).toBe(false); // Wrong prefix
      expect(ValidationUtil.isValidClaudeToken('')).toBe(false); // Empty
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidClaudeToken(123)).toBe(false);
      expect(ValidationUtil.isValidClaudeToken(null)).toBe(false);
      expect(ValidationUtil.isValidClaudeToken(undefined)).toBe(false);
    });
  });

  describe('isValidGitHubToken', () => {
    it('should validate correct GitHub tokens', () => {
      expect(ValidationUtil.isValidGitHubToken('ghp_1234567890abcdef1234567890')).toBe(true);
      expect(ValidationUtil.isValidGitHubToken('github_pat_1234567890abcdef1234567890')).toBe(true);
    });

    it('should reject invalid GitHub tokens', () => {
      expect(ValidationUtil.isValidGitHubToken('ghp_short')).toBe(false); // Too short
      expect(ValidationUtil.isValidGitHubToken('invalid_prefix_1234567890abcdef1234567890')).toBe(false);
      expect(ValidationUtil.isValidGitHubToken('')).toBe(false); // Empty
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidGitHubToken(123)).toBe(false);
      expect(ValidationUtil.isValidGitHubToken(null)).toBe(false);
      expect(ValidationUtil.isValidGitHubToken(undefined)).toBe(false);
    });
  });

  describe('isValidPath', () => {
    it('should validate correct paths', () => {
      expect(ValidationUtil.isValidPath('/home/user/project')).toBe(true);
      expect(ValidationUtil.isValidPath('relative/path')).toBe(true);
      expect(ValidationUtil.isValidPath('/valid/path/file.txt')).toBe(true);
    });

    it('should reject invalid paths', () => {
      expect(ValidationUtil.isValidPath('/path<script>')).toBe(false);
      expect(ValidationUtil.isValidPath('/path>danger')).toBe(false);
      expect(ValidationUtil.isValidPath('/path:with:colons')).toBe(false);
      expect(ValidationUtil.isValidPath('/path"with"quotes')).toBe(false);
      expect(ValidationUtil.isValidPath('/path|with|pipes')).toBe(false);
      expect(ValidationUtil.isValidPath('/path?with?questions')).toBe(false);
      expect(ValidationUtil.isValidPath('/path*with*stars')).toBe(false);
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidPath(123)).toBe(false);
      expect(ValidationUtil.isValidPath(null)).toBe(false);
      expect(ValidationUtil.isValidPath(undefined)).toBe(false);
    });
  });

  describe('isValidProjectPath', () => {
    it('should validate correct project paths', () => {
      expect(ValidationUtil.isValidProjectPath('/home/user/project')).toBe(true);
      expect(ValidationUtil.isValidProjectPath('/valid/absolute/path')).toBe(true);
    });

    it('should reject relative paths', () => {
      expect(ValidationUtil.isValidProjectPath('relative/path')).toBe(false);
      expect(ValidationUtil.isValidProjectPath('file.txt')).toBe(false);
    });

    it('should reject invalid paths', () => {
      expect(ValidationUtil.isValidProjectPath('/path<danger>')).toBe(false);
    });
  });

  describe('isValidRepoUrl', () => {
    it('should validate correct GitHub URLs', () => {
      expect(ValidationUtil.isValidRepoUrl('https://github.com/user/repo')).toBe(true);
      expect(ValidationUtil.isValidRepoUrl('https://github.com/org/project-name')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(ValidationUtil.isValidRepoUrl('https://gitlab.com/user/repo')).toBe(false); // Wrong host
      expect(ValidationUtil.isValidRepoUrl('https://github.com/')).toBe(false); // No repo path
      expect(ValidationUtil.isValidRepoUrl('https://github.com/user')).toBe(false); // Incomplete path
      expect(ValidationUtil.isValidRepoUrl('not-a-url')).toBe(false);
      expect(ValidationUtil.isValidRepoUrl('')).toBe(false);
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidRepoUrl(123)).toBe(false);
      expect(ValidationUtil.isValidRepoUrl(null)).toBe(false);
      expect(ValidationUtil.isValidRepoUrl(undefined)).toBe(false);
    });
  });

  describe('isValidRepoName', () => {
    it('should validate correct repo names', () => {
      expect(ValidationUtil.isValidRepoName('my-repo')).toBe(true);
      expect(ValidationUtil.isValidRepoName('project_name')).toBe(true);
      expect(ValidationUtil.isValidRepoName('repo.js')).toBe(true);
      expect(ValidationUtil.isValidRepoName('123-numbers')).toBe(true);
    });

    it('should reject invalid repo names', () => {
      expect(ValidationUtil.isValidRepoName('')).toBe(false); // Empty
      expect(ValidationUtil.isValidRepoName('a'.repeat(101))).toBe(false); // Too long
      expect(ValidationUtil.isValidRepoName('repo name')).toBe(false); // Contains space
      expect(ValidationUtil.isValidRepoName('repo@name')).toBe(false); // Contains @
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidRepoName(123)).toBe(false);
      expect(ValidationUtil.isValidRepoName(null)).toBe(false);
      expect(ValidationUtil.isValidRepoName(undefined)).toBe(false);
    });
  });

  describe('isValidSessionId', () => {
    it('should validate correct session IDs', () => {
      expect(ValidationUtil.isValidSessionId('session_1234567890abcdef')).toBe(true);
      expect(ValidationUtil.isValidSessionId('session_very-long-session-id')).toBe(true);
    });

    it('should reject invalid session IDs', () => {
      expect(ValidationUtil.isValidSessionId('session_short')).toBe(false); // Too short
      expect(ValidationUtil.isValidSessionId('invalid_1234567890abcdef')).toBe(false); // Wrong prefix
      expect(ValidationUtil.isValidSessionId('')).toBe(false); // Empty
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidSessionId(123)).toBe(false);
      expect(ValidationUtil.isValidSessionId(null)).toBe(false);
      expect(ValidationUtil.isValidSessionId(undefined)).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should validate non-empty strings', () => {
      expect(ValidationUtil.isNonEmptyString('hello')).toBe(true);
      expect(ValidationUtil.isNonEmptyString('  text  ')).toBe(true); // Trimmed to non-empty
    });

    it('should reject empty or whitespace-only strings', () => {
      expect(ValidationUtil.isNonEmptyString('')).toBe(false);
      expect(ValidationUtil.isNonEmptyString('   ')).toBe(false); // Only whitespace
      expect(ValidationUtil.isNonEmptyString('\t\n')).toBe(false); // Only whitespace
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isNonEmptyString(123)).toBe(false);
      expect(ValidationUtil.isNonEmptyString(null)).toBe(false);
      expect(ValidationUtil.isNonEmptyString(undefined)).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should validate positive integers', () => {
      expect(ValidationUtil.isPositiveInteger(1)).toBe(true);
      expect(ValidationUtil.isPositiveInteger(100)).toBe(true);
      expect(ValidationUtil.isPositiveInteger(42)).toBe(true);
    });

    it('should reject invalid inputs', () => {
      expect(ValidationUtil.isPositiveInteger(0)).toBe(false); // Zero
      expect(ValidationUtil.isPositiveInteger(-1)).toBe(false); // Negative
      expect(ValidationUtil.isPositiveInteger(1.5)).toBe(false); // Decimal
      expect(ValidationUtil.isPositiveInteger('1')).toBe(false); // String
      expect(ValidationUtil.isPositiveInteger(null)).toBe(false);
      expect(ValidationUtil.isPositiveInteger(undefined)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(ValidationUtil.isValidUUID('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
      expect(ValidationUtil.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(ValidationUtil.isValidUUID('123e4567-e89b-42d3-a456-42661417400')).toBe(false); // Too short
      expect(ValidationUtil.isValidUUID('123e4567-e89b-42d3-a456-4266141740000')).toBe(false); // Too long
      expect(ValidationUtil.isValidUUID('123e4567-e89b-52d3-a456-426614174000')).toBe(false); // Wrong version
      expect(ValidationUtil.isValidUUID('not-a-uuid')).toBe(false);
      expect(ValidationUtil.isValidUUID('')).toBe(false);
    });

    it('should reject non-string inputs', () => {
      expect(ValidationUtil.isValidUUID(123)).toBe(false);
      expect(ValidationUtil.isValidUUID(null)).toBe(false);
      expect(ValidationUtil.isValidUUID(undefined)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove script tags', () => {
      const input = 'Hello <script>alert("xss")</script> World';
      const result = ValidationUtil.sanitizeString(input);
      expect(result).toBe('Hello  World');
    });

    it('should remove javascript: protocols', () => {
      const input = 'Click <a href="javascript:alert()">here</a>';
      const result = ValidationUtil.sanitizeString(input);
      expect(result).toBe('Click <a href="alert()">here</a>');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert()">Click me</div>';
      const result = ValidationUtil.sanitizeString(input);
      expect(result).toBe('<div "alert()">Click me</div>');
    });

    it('should handle non-string inputs', () => {
      expect(ValidationUtil.sanitizeString(123)).toBe('');
      expect(ValidationUtil.sanitizeString(null)).toBe('');
      expect(ValidationUtil.sanitizeString(undefined)).toBe('');
    });

    it('should trim whitespace', () => {
      const input = '  clean text  ';
      const result = ValidationUtil.sanitizeString(input);
      expect(result).toBe('clean text');
    });
  });

  describe('sanitizeFilename', () => {
    it('should replace dangerous characters', () => {
      const input = 'file<name>with:bad|chars?.txt';
      const result = ValidationUtil.sanitizeFilename(input);
      expect(result).toBe('file_name_with_bad_chars_.txt');
    });

    it('should replace directory traversal', () => {
      const input = '../../../etc/passwd';
      const result = ValidationUtil.sanitizeFilename(input);
      expect(result).toBe('_/_/_/etc/passwd'); // Each .. becomes _, slashes remain
    });

    it('should handle non-string inputs', () => {
      expect(ValidationUtil.sanitizeFilename(123)).toBe('');
      expect(ValidationUtil.sanitizeFilename(null)).toBe('');
      expect(ValidationUtil.sanitizeFilename(undefined)).toBe('');
    });

    it('should trim whitespace', () => {
      const input = '  filename.txt  ';
      const result = ValidationUtil.sanitizeFilename(input);
      expect(result).toBe('filename.txt');
    });
  });

  describe('createValidationError', () => {
    it('should create validation error object', () => {
      const result = ValidationUtil.createValidationError('username', 'Username is required');
      
      expect(result).toEqual({
        field: 'username',
        message: 'Username is required',
        valid: false
      });
    });
  });

  describe('createValidationSuccess', () => {
    it('should create validation success object', () => {
      const result = ValidationUtil.createValidationSuccess();
      
      expect(result).toEqual({
        valid: true
      });
    });
  });

  describe('validateObject', () => {
    it('should validate object against schema', () => {
      const obj = {
        username: 'testuser',
        email: 'test@example.com'
      };
      
      const schema = {
        username: (value) => ValidationUtil.isValidUsername(value) ? null : { valid: false, message: 'Invalid username' },
        email: (value) => ValidationUtil.isValidEmail(value) ? null : { valid: false, message: 'Invalid email' }
      };
      
      const result = ValidationUtil.validateObject(obj, schema);
      
      expect(result).toEqual({
        valid: true,
        errors: []
      });
    });

    it('should return errors for invalid fields', () => {
      const obj = {
        username: 'ab', // Too short
        email: 'not-an-email'
      };
      
      const schema = {
        username: (value) => ValidationUtil.isValidUsername(value) ? null : { valid: false, message: 'Invalid username' },
        email: (value) => ValidationUtil.isValidEmail(value) ? null : { valid: false, message: 'Invalid email' }
      };
      
      const result = ValidationUtil.validateObject(obj, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toEqual([
        { field: 'username', message: 'Invalid username' },
        { field: 'email', message: 'Invalid email' }
      ]);
    });

    it('should handle missing fields gracefully', () => {
      const obj = {};
      
      const schema = {
        username: (value) => value ? null : { valid: false, message: 'Username required' }
      };
      
      const result = ValidationUtil.validateObject(obj, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        field: 'username',
        message: 'Username required'
      });
    });
  });
});