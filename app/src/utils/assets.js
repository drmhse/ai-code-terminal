const path = require('path');
const fs = require('fs');

/**
 * Asset management utility for cache-busted assets
 */
class AssetManager {
  constructor() {
    this.manifest = null;
    this.manifestPath = path.join(__dirname, '../../public/dist/.vite/manifest.json');
    this.fallbackAssets = {
      'main.es.js': '/dist/main.es.js',
      'main.umd.js': '/dist/main.umd.js'
    };
    
    this.loadManifest();
  }

  /**
   * Load the Vite manifest file
   */
  loadManifest() {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const manifestContent = fs.readFileSync(this.manifestPath, 'utf8');
        this.manifest = JSON.parse(manifestContent);
        console.log('✅ Asset manifest loaded successfully');
      } else {
        console.warn('⚠️  Asset manifest not found, using fallback URLs');
      }
    } catch (error) {
      console.error('❌ Failed to load asset manifest:', error.message);
      this.manifest = null;
    }
  }

  /**
   * Get the current asset URL for a logical name
   */
  getAssetUrl(logicalName) {
    if (!this.manifest) {
      return this.fallbackAssets[logicalName] || `/dist/${logicalName}`;
    }

    // Get all generated files from dist directory
    try {
      const distPath = path.join(__dirname, '../../public/dist');
      const files = require('fs').readdirSync(distPath);
      
      if (logicalName.includes('es.js')) {
        const esFile = files.find(f => f.includes('.es.js') && f.startsWith('main.'));
        return esFile ? `/dist/${esFile}` : this.fallbackAssets[logicalName];
      }
      
      if (logicalName.includes('umd.js')) {
        const umdFile = files.find(f => f.includes('.umd.js') && f.startsWith('main.'));
        return umdFile ? `/dist/${umdFile}` : this.fallbackAssets[logicalName];
      }
      
      if (logicalName.includes('.css')) {
        const cssFile = files.find(f => f.endsWith('.css') && f.startsWith('main.'));
        return cssFile ? `/dist/${cssFile}` : null;
      }
    } catch (error) {
      console.warn('Failed to read dist directory:', error.message);
    }

    return this.fallbackAssets[logicalName] || `/dist/${logicalName}`;
  }

  /**
   * Get all current asset URLs
   */
  getAllAssetUrls() {
    return {
      esModule: this.getAssetUrl('main.es.js'),
      umd: this.getAssetUrl('main.umd.js'),
      css: this.getAssetUrl('main.css') // If CSS exists
    };
  }

  /**
   * Reload manifest (useful for development)
   */
  reloadManifest() {
    this.loadManifest();
    return this.manifest !== null;
  }

  /**
   * Get cache busting info
   */
  getCacheBustingInfo() {
    if (!this.manifest) {
      return {
        version: 'unknown',
        timestamp: Date.now(),
        strategy: 'fallback'
      };
    }

    return {
      version: this.getVersionFromManifest(),
      timestamp: Date.now(),
      strategy: 'content-hash'
    };
  }

  /**
   * Extract version info from generated files
   */
  getVersionFromManifest() {
    try {
      const distPath = path.join(__dirname, '../../public/dist');
      const files = require('fs').readdirSync(distPath);
      
      // Find any main.*.js file and extract hash
      const mainFile = files.find(f => f.startsWith('main.') && f.endsWith('.js'));
      if (mainFile) {
        // Extract hash from filename like "main.DXJ2-_Xl.es.js"
        const match = mainFile.match(/main\.([^.]+)\.(es|umd)\.js/);
        return match ? match[1] : 'unknown';
      }
    } catch (error) {
      console.warn('Failed to extract version from files:', error.message);
    }
    
    return 'unknown';
  }
}

// Export singleton instance
const assetManager = new AssetManager();

module.exports = {
  assetManager,
  
  // Express middleware to provide asset URLs to templates
  assetMiddleware: (req, res, next) => {
    res.locals.assets = assetManager.getAllAssetUrls();
    res.locals.assetVersion = assetManager.getCacheBustingInfo();
    next();
  },

  // Helper function for templates
  getAssetUrl: (logicalName) => assetManager.getAssetUrl(logicalName),
  
  // Reload assets (useful for development)
  reloadAssets: () => assetManager.reloadManifest()
};