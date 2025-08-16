import { describe, it, expect } from 'vitest';

// Simple utility functions to test
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/<script.*?>.*?<\/script>/gi, '');
}

function formatDate(date) {
  if (!date || !(date instanceof Date)) return '';
  return date.toISOString().split('T')[0];
}

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const malicious = '<script>alert("xss")</script>Hello World';
      const safe = sanitizeInput(malicious);
      expect(safe).toBe('Hello World');
      expect(safe).not.toContain('<script>');
    });

    it('should handle normal text', () => {
      const normal = 'This is normal text';
      expect(sanitizeInput(normal)).toBe(normal);
    });

    it('should handle empty or null input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T12:30:45Z');
      const formatted = formatDate(date);
      expect(formatted).toBe('2024-01-15');
    });

    it('should handle invalid date', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate('invalid')).toBe('');
    });
  });
});

describe('Async Testing Examples', () => {
  it('should handle promises', async () => {
    const asyncFunction = () => Promise.resolve('success');
    await expect(asyncFunction()).resolves.toBe('success');
  });

  it('should handle promise rejections', async () => {
    const failingFunction = () => Promise.reject(new Error('test error'));
    await expect(failingFunction()).rejects.toThrow('test error');
  });

  it('should handle timeout operations', async () => {
    const delayedFunction = () => new Promise(resolve => 
      setTimeout(() => resolve('done'), 10)
    );
    
    const result = await delayedFunction();
    expect(result).toBe('done');
  });
});

describe('Error Testing Examples', () => {
  function divide(a, b) {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  }

  it('should throw error for division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  it('should calculate division correctly', () => {
    expect(divide(10, 2)).toBe(5);
    expect(divide(15, 3)).toBe(5);
  });
});

describe('Data-driven tests', () => {
  const testCases = [
    { input: 'test@example.com', expected: true },
    { input: 'invalid-email', expected: false },
    { input: 'user@domain.org', expected: true },
    { input: '@domain.com', expected: false },
  ];

  testCases.forEach(({ input, expected }) => {
    it(`should validate "${input}" as ${expected}`, () => {
      expect(isValidEmail(input)).toBe(expected);
    });
  });
});