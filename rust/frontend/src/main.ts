import './assets/main.css'
import './styles/global.css'
import '@xterm/xterm/css/xterm.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useAppInitialization } from './composables/useAppInitialization'

async function initializeApp() {
  const { startInitialization, completeInitialization, failInitialization } = useAppInitialization()
  
  if (!startInitialization()) {
    console.log('⚠️ App initialization already in progress, skipping main.ts initialization')
    return
  }

  try {
    const app = createApp(App)
    
    app.use(createPinia())
    
    // Initialize auth store from localStorage before router
    const authStore = useAuthStore()
    await authStore.checkAuthStatus()
    
    app.use(router)
    
    app.mount('#app')
    
    completeInitialization()
  } catch (error) {
    failInitialization(error as Error)
    throw error
  }
}

initializeApp().catch(console.error)
