import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Detect if we're building for Tauri
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  // Tauri expects a relative base in production builds
  base: isTauri ? './' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 5173,
    host: true,
    // Only use proxy when NOT running in Tauri (web mode)
    proxy: isTauri ? undefined : {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split vendor libraries
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('axios')) {
              return 'vendor'
            }
            if (id.includes('codemirror')) {
              return 'editor'
            }
            if (id.includes('@tauri-apps')) {
              return 'tauri'
            }
            return 'other-vendor'
          }
          
          // Split application modules
          if (id.includes('/services/api.ts')) {
            return 'api'
          }
          if (id.includes('/stores/')) {
            return 'stores'
          }
          if (id.includes('/composables/')) {
            return 'composables'
          }
          if (id.includes('/components/')) {
            return 'components'
          }
          if (id.includes('/views/')) {
            return 'views'
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
})
