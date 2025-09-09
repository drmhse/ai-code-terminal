import './assets/main.css'
import './assets/migrated-styles.css'
import './styles/global.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

async function initializeApp() {
  const app = createApp(App)
  
  app.use(createPinia())
  
  // Initialize auth store from localStorage before router
  const authStore = useAuthStore()
  await authStore.checkAuthStatus()
  
  app.use(router)
  
  app.mount('#app')
}

initializeApp().catch(console.error)
