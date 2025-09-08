import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    // Output to dist directory
    outDir: 'dist',
    
    // Generate library build for integration with existing EJS templates
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'AICodingTerminalFrontend',
      fileName: (format) => {
        // Include content hash for cache busting
        return `main.[hash].${format}.js`
      },
      formats: ['es', 'umd']
    },
    
    // Bundle external dependencies for self-contained build
    rollupOptions: {
      // Don't externalize Vue since we want a complete bundle
      external: [],
      
      output: {
        // Ensure globals are available for UMD build
        globals: {},
        
        // Generate separate CSS file with hash
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'main.[hash].css'
          }
          return '[name].[hash][extname]'
        }
      }
    },
    
    // Generate manifest for asset mapping
    manifest: true,
    
    // Ensure CSS is extracted
    cssCodeSplit: false,
    
    // Enable source maps for debugging
    sourcemap: true,
    
    // Optimize for production
    minify: 'terser',
    
    // Target modern browsers (ES2020)
    target: 'es2020'
  },

  // Development server configuration
  server: {
    port: 5173,
    host: true, // Allow external connections for Docker
    cors: true
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'vue',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/search',
      '@codemirror/theme-one-dark',
      '@codemirror/lang-javascript',
      '@codemirror/lang-python',
      '@codemirror/lang-json',
      '@codemirror/lang-css',
      '@codemirror/lang-html',
      '@codemirror/lang-markdown',
      '@codemirror/lang-xml',
      '@codemirror/lang-yaml',
      '@codemirror/lang-sql',
      '@codemirror/lang-php',
      '@codemirror/lang-rust',
      '@codemirror/lang-cpp',
      '@codemirror/lang-java',
      '@codemirror/lang-go'
    ]
  }
})