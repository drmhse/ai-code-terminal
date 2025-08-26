// Input validation helper functions

class ValidationUtil {
  // User validation
  isValidUsername(username) {
    if (typeof username !== 'string') return false;
    if (username.length < 3 || username.length > 50) return false;
    return /^[a-zA-Z0-9_]+$/.test(username);
  }

  isValidPassword(password) {
    if (typeof password !== 'string') return false;
    return password.length >= 6;
  }

  isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Token validation
  isValidClaudeToken(token) {
    if (typeof token !== 'string') return false;
    return token.startsWith('sk-') && token.length > 10;
  }

  isValidGitHubToken(token) {
    if (typeof token !== 'string') return false;
    // GitHub tokens can be classic (ghp_) or fine-grained (github_pat_)
    return (token.startsWith('ghp_') || token.startsWith('github_pat_')) && token.length > 20;
  }

  // Path validation
  isValidPath(path) {
    if (typeof path !== 'string') return false;
    // Basic path validation - no dangerous characters
    const dangerousPattern = /[<>:"|?*\x00-\x1f]/;
    return !dangerousPattern.test(path);
  }

  isValidProjectPath(path) {
    if (!this.isValidPath(path)) return false;
    // Project paths should be absolute
    return path.startsWith('/');
  }

  // Repository validation
  isValidRepoUrl(url) {
    if (typeof url !== 'string') return false;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'github.com' && urlObj.pathname.split('/').length >= 3;
    } catch {
      return false;
    }
  }

  isValidRepoName(name) {
    if (typeof name !== 'string') return false;
    if (name.length < 1 || name.length > 100) return false;
    // GitHub repo names can contain letters, numbers, hyphens, underscores, and dots
    return /^[a-zA-Z0-9._-]+$/.test(name);
  }

  // Session validation
  isValidSessionId(sessionId) {
    if (typeof sessionId !== 'string') return false;
    return sessionId.startsWith('session_') && sessionId.length > 20;
  }

  // Generic validation helpers
  isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
  }

  isValidUUID(uuid) {
    if (typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Sanitization helpers
  sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '')
              .trim();
  }

  sanitizeFilename(filename) {
    if (typeof filename !== 'string') return '';
    return filename.replace(/[<>:"|?*\x00-\x1f]/g, '_')
                   .replace(/\.\./g, '_')
                   .trim();
  }

  // Validation result helpers
  createValidationError(field, message) {
    return {
      field,
      message,
      valid: false
    };
  }

  createValidationSuccess() {
    return {
      valid: true
    };
  }

  // Batch validation
  validateObject(obj, schema) {
    const errors = [];
    
    for (const [field, validator] of Object.entries(schema)) {
      const value = obj[field];
      const result = validator(value);
      
      if (result && !result.valid) {
        errors.push({
          field,
          message: result.message
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new ValidationUtil();