import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock the authenticateToken middleware to skip authentication in tests
const mockAuthMiddleware = (req, res, next) => {
  req.user = { id: 'test-user', username: 'test' };
  next();
};

vi.mock('@/middleware/auth.middleware', () => ({
  authenticateToken: mockAuthMiddleware
}));

describe('Theme Controller', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create express app for testing
    const express = await import('express');
    app = express.default();
    app.use(express.json());
    
    // Import controller and auth middleware
    const themeControllerModule = await import('@/controllers/theme.controller.js');
    const themeController = themeControllerModule.default;
    const authMiddleware = await import('@/middleware/auth.middleware');
    
    // Apply auth middleware to theme routes
    app.use('/api/themes', authMiddleware.authenticateToken);
    
    // Setup routes
    app.get('/api/themes', themeController.getAllThemes.bind(themeController));
    app.get('/api/themes/:themeId', themeController.getThemeById.bind(themeController));
    app.get('/api/themes/default', themeController.getDefaultTheme.bind(themeController));
    app.post('/api/themes/reload', themeController.reloadThemes.bind(themeController));
  });

  describe('Theme Routes Debug', () => {
    it('should return all themes', async () => {
      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return a specific theme by ID', async () => {
      const response = await request(app)
        .get('/api/themes/vscode-dark')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.theme.id).toBe('vscode-dark');
    });

    it('should handle non-existent theme', async () => {
      const response = await request(app)
        .get('/api/themes/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return the default theme', async () => {
      // First let's try to see what happens with a direct request
      const response = await request(app)
        .get('/api/themes/default')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});