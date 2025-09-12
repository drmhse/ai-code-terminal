import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
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
