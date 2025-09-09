import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresAuth: false }
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('../views/AuthCallback.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard'
    }
  ]
})

// Navigation guard for authentication
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  
  // If not authenticated and route requires auth, try to initialize from localStorage
  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) {
    try {
      // Try to initialize auth from localStorage
      await authStore.checkAuthStatus()
    } catch (error) {
      // If initialization fails, clear any invalid tokens and redirect to login
      console.warn('Auth initialization failed:', error)
    }
  }
  
  // Check if route requires authentication after initialization attempt
  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) {
    // Redirect to login if not authenticated
    return '/login'
  }
  
  // Redirect to dashboard if already authenticated and trying to access login
  if (to.name === 'login' && authStore.isAuthenticated) {
    return '/dashboard'
  }
  
  return true
})

export default router