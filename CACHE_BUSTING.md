# 🚀 Cache Busting & Asset Management Guide

This document explains how the AI Coding Terminal handles browser caching and asset versioning to ensure users always get the latest updates without manual cache clearing.

## 🎯 The Problem We Solve

**Before**: Users with cached JavaScript would experience:
- ❌ Stale CodeMirror code with new backend APIs
- ❌ Mixed versions causing JavaScript errors  
- ❌ Broken functionality after deployments
- ❌ Need to manually hard refresh (Ctrl+F5)

**After**: Automatic cache management ensures:
- ✅ Always loads latest assets automatically
- ✅ Smart cache busting with content hashes
- ✅ Graceful version transitions
- ✅ User-friendly update notifications

## 🏗️ Architecture Overview

### 1. Build-Time Hash Generation
```
Vite Build:
main.ts → main.abc123def.es.js  (content hash)
         → main.abc123def.umd.js (same content hash)
```

### 2. Manifest-Based Asset Resolution
```json
{
  "src/main.ts": {
    "file": "main.abc123def.es.js",
    "imports": [...]
  }
}
```

### 3. Dynamic Template Rendering
```html
<!-- EJS Template -->
<script type="module" src="<%= assets.esModule %>"></script>
<!-- Renders as: -->
<script type="module" src="/dist/main.abc123def.es.js"></script>
```

### 4. Client-Side Version Checking
```javascript
// Automatically checks for updates every 30 seconds
// Shows user-friendly notification when new version available
// Handles cache clearing and soft refresh
```

## 🔧 Implementation Details

### Content Hash Strategy

**File Naming Pattern**: `main.[contenthash].js`
- Hash changes only when file content changes
- Unchanged files keep same hash (better caching)
- Perfect cache invalidation

### Cache Headers Strategy

**Hashed Files** (Production):
```http
Cache-Control: public, max-age=31536000, immutable
```
- 1 year cache (safe because hash changes with content)
- `immutable` tells browser file will never change

**Non-Hashed Files** (Production):
```http
Cache-Control: public, max-age=300, must-revalidate
```
- 5 minute cache with revalidation
- Ensures HTML/templates update reasonably quickly

**Development**:
```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```
- No caching for immediate feedback during development

### Version Checking Flow

1. **On Page Load**:
   ```javascript
   // Compare stored version with current
   if (storedVersion !== currentVersion) {
     clearBrowserCaches()
   }
   storeCurrentVersion()
   ```

2. **Periodic Checks**:
   ```javascript
   // Every 30 seconds (when page visible)
   checkServerVersion()
   if (newVersionAvailable) {
     showUpdateNotification() // or auto-refresh
   }
   ```

3. **Smart Refresh Logic**:
   ```javascript
   if (timeSinceLastUpdate > 24hours) {
     showUserNotification() // "New version available!"
   } else {
     performSoftRefresh() // Automatic refresh
   }
   ```

## 📝 Usage Examples

### Building for Production

```bash
# Frontend build with content hashes
cd frontend
npm run build

# Output:
# dist/main.abc123def.es.js
# dist/main.abc123def.umd.js  
# dist/.vite/manifest.json
```

### Development Workflow

```bash
# Development (no hashes, no caching)
cd frontend
npm run dev

# Production build
npm run build

# Test with Express app
cd ../app
npm start
```

### Deployment Process

1. **Build Frontend**:
   ```bash
   cd frontend && npm run build
   ```

2. **New Assets Generated**:
   ```
   dist/main.xyz789abc.es.js  # New hash!
   dist/main.xyz789abc.umd.js
   ```

3. **Express App Reads Manifest**:
   ```javascript
   // Automatically serves new URLs
   assets.esModule = "/dist/main.xyz789abc.es.js"
   ```

4. **Client Detects Change**:
   ```javascript
   // Browser loads page with new version info
   window.APP_ASSET_VERSION = {
     version: "xyz789abc",
     timestamp: 1638360000000
   }
   
   // Cache manager compares versions
   if (stored !== current) {
     // Clear caches and refresh
   }
   ```

## 🛠️ Configuration Options

### Vite Configuration (`vite.config.ts`)

```typescript
build: {
  lib: {
    fileName: (format) => `main.[hash].${format}.js`
  },
  manifest: true, // Generate manifest.json
  rollupOptions: {
    output: {
      assetFileNames: '[name].[hash][extname]'
    }
  }
}
```

### Express Asset Middleware

```javascript
// Provides dynamic asset URLs to templates
app.use(assetMiddleware)

// Templates get:
res.locals.assets = {
  esModule: "/dist/main.abc123.es.js",
  umd: "/dist/main.abc123.umd.js"
}
```

### Cache Headers Customization

```javascript
// Different strategies per environment
if (hasHash && isProduction) {
  res.set('Cache-Control', 'public, max-age=31536000, immutable')
} else if (isProduction) {
  res.set('Cache-Control', 'public, max-age=300, must-revalidate')
} else {
  res.set('Cache-Control', 'no-cache')
}
```

## 🔍 Debugging & Monitoring

### Browser Console Logs

```javascript
// Version checking
🔄 Initializing cache management...
📦 Asset version check: {current: "abc123", stored: "xyz789"}
🔄 New version detected, clearing old caches...
✅ Asset versions match, no cache clear needed

// Update detection  
🔍 Checking for asset updates...
🆕 New asset version available! {current: "abc123", server: "def456"}
🔄 Performing soft refresh...
🧹 Browser caches cleared
```

### Network Tab Inspection

```
✅ main.abc123def.es.js - 200 (from cache)
✅ main.xyz789abc.es.js - 200 (new version)
✅ /api/asset-version - 200 (version check)
```

### Server Logs

```
✅ Asset manifest loaded successfully
⚠️  Asset manifest not found, using fallback URLs
🔄 Asset version requested: {version: "abc123", strategy: "content-hash"}
```

## 🚨 Troubleshooting

### Issue: Users Still Getting Old Code

**Cause**: Manifest not found or asset middleware not working
**Solution**: 
```bash
# Check manifest exists
ls -la app/public/dist/.vite/manifest.json

# Check symlink
ls -la app/public/dist/
# Should point to: ../../frontend/dist
```

### Issue: Infinite Refresh Loop

**Cause**: Version detection logic error
**Solution**: Check browser console for version comparison logs

### Issue: Assets Not Loading

**Cause**: Hash format mismatch or manifest parsing error
**Solution**: 
```bash
# Rebuild frontend
cd frontend && npm run build

# Check generated files match manifest
cat app/public/dist/.vite/manifest.json
```

## 🎯 Benefits Achieved

1. **🚀 Zero-Downtime Updates**: Users get new code automatically
2. **⚡ Optimal Performance**: Long cache for unchanged files  
3. **🛡️ Version Safety**: No mixed-version bugs
4. **👤 Better UX**: Users never need to manually clear cache
5. **🔧 Developer Friendly**: Simple build process with automatic cache busting

## 📈 Advanced Features

### Service Worker Integration (Future)
```javascript
// Advanced caching strategies with service workers
// Precache critical assets
// Background updates
// Offline support
```

### A/B Testing Support (Future)
```javascript
// Version-specific feature flags
// Gradual rollouts
// Rollback capabilities
```

### Analytics Integration (Future)
```javascript
// Track cache hit rates
// Monitor version adoption
// Performance metrics
```

This cache busting system ensures your users always have the latest, most stable version of the AI Coding Terminal without any manual intervention! 🎉