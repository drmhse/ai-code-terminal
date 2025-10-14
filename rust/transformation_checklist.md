# AI Code Terminal → SSO Authentication Transformation Checklist

**Document Version:** 1.0
**Date:** 2025-10-04
**Purpose:** Complete migration plan from internal GitHub OAuth to externalized SSO service

---

## Executive Summary

### Current State Analysis
The AI Code Terminal currently implements:
- **Direct GitHub OAuth** integration with manual token management
- **User-centric authentication** without organization/service abstractions
- **JWT tokens** stored in localStorage with 7-day expiration
- **Microsoft OAuth** for To Do integration (separate flow)
- **SQLite database** with user authentication tables
- **Frontend Pinia store** managing auth state and WebSocket connections

### Target State with SSO
After transformation, the system will use:
- **Centralized SSO service** for all authentication
- **Multi-provider support** (GitHub, Google, Microsoft) via SSO
- **Organization and Service** abstractions for multi-tenancy
- **Device Flow** for desktop/CLI authentication
- **Subscription-aware** JWT tokens with feature flags
- **Unified authentication** for both app access and Microsoft To Do

---

## Phase 1: SSO Service Preparation

### 1.1 SSO Configuration
- [ ] **Create organization** in SSO for AI Code Terminal
  - Organization slug: `ai-code-terminal` or `act`
  - Owner: Primary admin user

- [ ] **Register service** in SSO
  - Service slug: `terminal` or `workspace`
  - Service type: `web_app` or `desktop_app`
  - Generate `client_id` and `client_secret`

- [ ] **Configure OAuth providers** in SSO
  - Enable GitHub OAuth (required - existing flow)
  - Enable Microsoft OAuth (for To Do integration)
  - Optional: Enable Google OAuth

- [ ] **Set up redirect URIs** in SSO
  - Web callback: `http://localhost:5173/auth/callback`
  - Desktop callback: `http://127.0.0.1:3001/api/v1/auth/callback`
  - Device activation: `{SSO_BASE_URL}/activate`

### 1.2 Subscription Plans (Optional but Recommended)
- [ ] **Create free plan** in SSO
  - Features: `["basic_workspace", "github_repos"]`

- [ ] **Create pro plan** in SSO (future)
  - Features: `["basic_workspace", "github_repos", "microsoft_todo", "unlimited_terminals"]`

- [ ] **Configure Stripe integration** (if using paid plans)
  - Set up webhook endpoint in SSO
  - Configure price IDs in SSO database

---

## Phase 2: Backend Transformation

### 2.1 Database Schema Migration

#### 2.1.1 New Tables (SSO Integration)
- [ ] **Create `sso_config` table**
  ```sql
  CREATE TABLE sso_config (
      id TEXT PRIMARY KEY,
      sso_base_url TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_secret_encrypted BLOB NOT NULL,
      org_slug TEXT NOT NULL,
      service_slug TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
  );
  ```

- [ ] **Create `sso_sessions` table**
  ```sql
  CREATE TABLE sso_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sso_token TEXT NOT NULL,
      sso_token_hash TEXT NOT NULL,
      provider TEXT NOT NULL, -- 'github', 'microsoft', 'google'
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_sso_sessions_user_id ON sso_sessions(user_id);
  CREATE INDEX idx_sso_sessions_expires_at ON sso_sessions(expires_at);
  ```

#### 2.1.2 Table Modifications
- [ ] **Modify `users` table**
  - Keep: `id`, `email`, `avatar_url`, `created_at`, `updated_at`
  - Remove: `github_id` (moved to SSO identities)
  - Add: `sso_user_id TEXT` (maps to SSO's user.id)
  - Add: `username TEXT` (provider-agnostic username)

- [ ] **Modify `user_settings` table**
  - Remove: `github_token`, `github_refresh_token`, `github_token_expires_at`
  - Keep: `theme`, `current_workspace_id`, `layout_preferences`
  - Add: `default_provider TEXT` (user's preferred auth provider)

#### 2.1.3 Data Migration Script
- [ ] **Create migration script** `migrate_to_sso.rs`
  - Map existing GitHub users to SSO users
  - Preserve user data and workspace associations
  - Handle edge cases (duplicate emails, missing data)

### 2.2 Backend Code Refactoring

#### 2.2.1 Remove Old Authentication Code
- [ ] **Delete files:**
  - `crates/act-server/src/services/auth.rs` (old GitHub auth service)
  - `crates/act-server/src/services/github.rs` (direct GitHub integration)
  - `crates/act-persistence/src/auth_repository.rs` (old auth repository)

#### 2.2.2 Create SSO Client Module
- [ ] **Create** `crates/act-server/src/sso/mod.rs`
  - SSO API client
  - Token validation
  - User info retrieval

- [ ] **Create** `crates/act-server/src/sso/client.rs`
  ```rust
  pub struct SsoClient {
      base_url: String,
      client_id: String,
      client_secret: String,
      org_slug: String,
      service_slug: String,
      http_client: reqwest::Client,
  }

  impl SsoClient {
      // Device flow methods
      pub async fn request_device_code(&self) -> Result<DeviceCodeResponse>;
      pub async fn poll_for_token(&self, device_code: &str) -> Result<TokenResponse>;

      // Web OAuth methods
      pub async fn get_auth_url(&self, provider: &str, redirect_uri: &str) -> Result<String>;
      pub async fn exchange_code(&self, code: &str, state: &str) -> Result<TokenResponse>;

      // Token validation
      pub async fn validate_token(&self, token: &str) -> Result<SsoTokenClaims>;

      // User info
      pub async fn get_user_info(&self, token: &str) -> Result<SsoUserInfo>;
      pub async fn get_subscription(&self, token: &str) -> Result<SsoSubscription>;
  }
  ```

- [ ] **Create** `crates/act-server/src/sso/types.rs`
  ```rust
  pub struct SsoTokenClaims {
      pub sub: String,           // user_id
      pub org: String,           // organization slug
      pub service: String,       // service slug
      pub plan: String,          // subscription plan
      pub features: Vec<String>, // enabled features
      pub exp: usize,           // expiration
      pub iat: usize,           // issued at
  }

  pub struct SsoUserInfo {
      pub id: String,
      pub email: String,
      pub username: String,
      pub avatar_url: Option<String>,
      pub provider: String,
  }

  pub struct SsoSubscription {
      pub plan: String,
      pub features: Vec<String>,
      pub status: String,
      pub current_period_end: String,
  }
  ```

#### 2.2.3 Update Middleware
- [ ] **Replace** `crates/act-server/src/middleware/auth.rs`
  ```rust
  // Old: Validate JWT with local secret
  // New: Validate JWT from SSO (verify signature with SSO's public key OR forward validate to SSO)

  pub async fn from_request_parts(
      parts: &mut Parts,
      state: &AppState,
  ) -> Result<Self, Self::Rejection> {
      let token = extract_bearer_token(parts)?;

      // Validate token with SSO
      let claims = state.sso_client
          .validate_token(&token)
          .await
          .map_err(|_| StatusCode::UNAUTHORIZED)?;

      // Check session in local database
      let session = sqlx::query_as::<_, SsoSession>(
          "SELECT * FROM sso_sessions WHERE sso_token_hash = ? AND expires_at > datetime('now')"
      )
      .bind(hash_token(&token))
      .fetch_optional(&state.pool)
      .await
      .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

      if session.is_none() {
          return Err(StatusCode::UNAUTHORIZED);
      }

      Ok(AuthenticatedUser {
          user_id: claims.sub,
          username: claims.email,
          org: claims.org,
          service: claims.service,
          features: claims.features,
      })
  }
  ```

#### 2.2.4 New Authentication Routes
- [ ] **Create** `crates/act-server/src/routes/sso_auth.rs`
  ```rust
  // Device Flow (for Desktop/CLI)
  POST   /api/v1/auth/device/start       -> request device code from SSO
  GET    /api/v1/auth/device/poll/{code} -> poll for token

  // Web OAuth Flow
  GET    /api/v1/auth/{provider}/start   -> redirect to SSO auth URL
  GET    /api/v1/auth/{provider}/callback -> handle SSO callback, exchange code

  // Session Management
  GET    /api/v1/auth/me                  -> get current user (from SSO token)
  POST   /api/v1/auth/logout              -> revoke session
  GET    /api/v1/auth/subscription        -> get subscription info from SSO
  ```

- [ ] **Implement route handlers**
  ```rust
  pub async fn device_start(
      State(state): State<AppState>,
  ) -> Result<Json<DeviceCodeResponse>> {
      let response = state.sso_client.request_device_code().await?;
      Ok(Json(response))
  }

  pub async fn device_poll(
      State(state): State<AppState>,
      Path(device_code): Path<String>,
  ) -> Result<Json<TokenResponse>> {
      let token_response = state.sso_client.poll_for_token(&device_code).await?;

      // Store session locally
      store_sso_session(&state.pool, &token_response).await?;

      Ok(Json(token_response))
  }

  pub async fn provider_start(
      State(state): State<AppState>,
      Path(provider): Path<String>,
  ) -> Result<Redirect> {
      let redirect_uri = format!("{}/api/v1/auth/{}/callback", state.base_url, provider);
      let auth_url = state.sso_client.get_auth_url(&provider, &redirect_uri).await?;
      Ok(Redirect::to(&auth_url))
  }

  pub async fn provider_callback(
      State(state): State<AppState>,
      Path(provider): Path<String>,
      Query(params): Query<CallbackParams>,
  ) -> Result<Redirect> {
      let token_response = state.sso_client.exchange_code(&params.code, &params.state).await?;

      // Store session locally
      store_sso_session(&state.pool, &token_response).await?;

      // Redirect to frontend with token
      Ok(Redirect::to(&format!("http://localhost:5173/auth/success?token={}", token_response.access_token)))
  }
  ```

#### 2.2.5 Microsoft To Do Integration Update
- [ ] **Update** `crates/act-server/src/routes/microsoft_auth.rs`
  - Remove: Direct Microsoft OAuth flow
  - Add: Use SSO's Microsoft identity for To Do API access

  ```rust
  // Old: Start OAuth flow directly with Microsoft
  // New: Check if user authenticated via SSO with Microsoft provider

  pub async fn get_auth_status(
      State(state): State<AppState>,
      auth_user: AuthenticatedUser,
  ) -> Result<Json<ApiResponse<MicrosoftAuthStatus>>> {
      // Check if user's SSO session uses Microsoft provider
      let session = sqlx::query_as::<_, SsoSession>(
          "SELECT * FROM sso_sessions WHERE user_id = ? AND provider = 'microsoft'"
      )
      .bind(&auth_user.user_id)
      .fetch_optional(&state.pool)
      .await?;

      if let Some(session) = session {
          // User authenticated via Microsoft SSO - can use To Do
          // Get Microsoft access token from SSO
          let microsoft_token = state.sso_client
              .get_provider_token(&session.sso_token, "microsoft")
              .await?;

          // Store in microsoft_auth table for To Do API access
          store_microsoft_auth(&state.pool, &auth_user.user_id, &microsoft_token).await?;

          Ok(Json(ApiResponse::success(MicrosoftAuthStatus {
              authenticated: true,
              microsoft_email: Some(auth_user.username.clone()),
              connected_at: Some(session.created_at.to_string()),
          })))
      } else {
          // User needs to authenticate via SSO with Microsoft
          Ok(Json(ApiResponse::success(MicrosoftAuthStatus {
              authenticated: false,
              microsoft_email: None,
              connected_at: None,
          })))
      }
  }
  ```

### 2.3 Configuration Management
- [ ] **Update** `crates/act-server/src/config.rs`
  ```rust
  pub struct Config {
      // Remove old auth config
      // pub auth: AuthConfig,

      // Add SSO config
      pub sso: SsoConfig,

      // Keep other config
      pub server: ServerConfig,
      pub database: DatabaseConfig,
      pub cors: CorsConfig,
  }

  pub struct SsoConfig {
      pub base_url: String,
      pub client_id: String,
      pub client_secret: String,
      pub org_slug: String,
      pub service_slug: String,
  }
  ```

- [ ] **Update** `.env.example`
  ```
  # SSO Configuration (REQUIRED)
  ACT_SSO_BASE_URL=http://localhost:3000
  ACT_SSO_CLIENT_ID=your-sso-client-id
  ACT_SSO_CLIENT_SECRET=your-sso-client-secret
  ACT_SSO_ORG_SLUG=ai-code-terminal
  ACT_SSO_SERVICE_SLUG=terminal

  # Remove old GitHub OAuth config
  # ACT_AUTH_GITHUB_CLIENT_ID=...
  # ACT_AUTH_GITHUB_CLIENT_SECRET=...
  ```

---

## Phase 3: Frontend Transformation

### 3.1 Frontend Dependencies & Configuration
- [ ] **Update** `frontend/package.json`
  - No new dependencies needed (using existing axios, vue-router)

- [ ] **Update environment variables** `frontend/.env`
  ```
  VITE_SSO_BASE_URL=http://localhost:3000
  VITE_API_BASE_URL=http://localhost:3001
  VITE_SSO_ORG_SLUG=ai-code-terminal
  VITE_SSO_SERVICE_SLUG=terminal
  ```

### 3.2 Frontend Authentication Store Refactoring

#### 3.2.1 Update Auth Store
- [ ] **Refactor** `frontend/src/stores/auth.ts`
  ```typescript
  export const useAuthStore = defineStore('auth', () => {
      const user = ref<User | null>(null)
      const token = ref<string | null>(null)
      const subscription = ref<Subscription | null>(null)

      // Remove: getGitHubAuthUrl()
      // Remove: Direct GitHub OAuth logic

      // Add: SSO authentication methods
      const getSsoAuthUrl = (provider: 'github' | 'microsoft' | 'google') => {
          const redirectUri = `${window.location.origin}/auth/callback`
          return `${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/${provider}/start?redirect_uri=${encodeURIComponent(redirectUri)}`
      }

      const startDeviceFlow = async () => {
          const response = await apiService.startDeviceFlow()
          return response // { device_code, user_code, verification_uri, expires_in }
      }

      const pollDeviceToken = async (deviceCode: string) => {
          const response = await apiService.pollDeviceToken(deviceCode)
          if (response.access_token) {
              await setToken(response.access_token)
          }
          return response
      }

      const fetchSubscription = async () => {
          if (!token.value) return
          const sub = await apiService.getSubscription()
          subscription.value = sub
      }

      return {
          // ... existing exports
          getSsoAuthUrl,
          startDeviceFlow,
          pollDeviceToken,
          subscription,
          fetchSubscription,
      }
  })
  ```

#### 3.2.2 Update API Service
- [ ] **Update** `frontend/src/services/api.ts`
  ```typescript
  class ApiService {
      // Remove: GitHub-specific auth methods

      // Add: SSO auth methods
      async startDeviceFlow(): Promise<DeviceCodeResponse> {
          const response = await this.client.post('/api/v1/auth/device/start')
          return response.data
      }

      async pollDeviceToken(deviceCode: string): Promise<TokenResponse> {
          const response = await this.client.get(`/api/v1/auth/device/poll/${deviceCode}`)
          return response.data
      }

      async getSubscription(): Promise<SubscriptionInfo> {
          const response = await this.client.get('/api/v1/auth/subscription')
          return response.data
      }

      async getCurrentUser(): Promise<User> {
          const response = await this.client.get('/api/v1/auth/me')
          return response.data
      }
  }
  ```

### 3.3 Frontend View Updates

#### 3.3.1 Login Page
- [ ] **Update** `frontend/src/views/Login.vue`
  ```vue
  <template>
    <div class="login-container">
      <div class="login-card">
        <h1>AI Code Terminal</h1>
        <p>Sign in with your provider</p>

        <!-- Provider selection -->
        <div class="provider-buttons">
          <button @click="loginWithProvider('github')" class="btn-provider btn-github">
            <GithubIcon />
            <span>Continue with GitHub</span>
          </button>

          <button @click="loginWithProvider('microsoft')" class="btn-provider btn-microsoft">
            <MicrosoftIcon />
            <span>Continue with Microsoft</span>
          </button>

          <button @click="loginWithProvider('google')" class="btn-provider btn-google">
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
        </div>

        <!-- Device/Desktop flow for Tauri app -->
        <div v-if="isTauriApp" class="device-flow">
          <button @click="startDeviceAuth" class="btn-device">
            Or use device code
          </button>
        </div>
      </div>
    </div>
  </template>

  <script setup lang="ts">
  import { useAuthStore } from '@/stores/auth'
  import { isDesktopApp } from '@/utils/backendPort'

  const authStore = useAuthStore()
  const isTauriApp = isDesktopApp()

  const loginWithProvider = (provider: 'github' | 'microsoft' | 'google') => {
      const authUrl = authStore.getSsoAuthUrl(provider)
      window.location.href = authUrl
  }

  const startDeviceAuth = async () => {
      const response = await authStore.startDeviceFlow()
      // Show device code UI
      router.push({
          name: 'device-activate',
          params: { deviceCode: response.device_code, userCode: response.user_code }
      })
  }
  </script>
  ```

#### 3.3.2 Auth Callback Page
- [ ] **Update** `frontend/src/views/AuthCallback.vue`
  ```vue
  <script setup lang="ts">
  // Remove: Direct GitHub callback handling
  // The backend now handles SSO callback and redirects with token

  onMounted(async () => {
      try {
          // Get token from query params (set by backend redirect)
          const token = route.query.token as string

          if (!token) {
              throw new Error('No token received')
          }

          // Set token in store
          await authStore.setToken(token)

          // Fetch subscription info
          await authStore.fetchSubscription()

          // Redirect to dashboard
          router.push('/dashboard')
      } catch (err) {
          error.value = err.message
      }
  })
  </script>
  ```

#### 3.3.3 Device Activation View (New)
- [ ] **Create** `frontend/src/views/DeviceActivate.vue`
  ```vue
  <template>
    <div class="device-activate-container">
      <div class="activate-card">
        <h1>Device Activation</h1>
        <p>Enter this code on your device:</p>
        <div class="user-code">{{ userCode }}</div>
        <div class="verification-url">
          Or visit: <a :href="verificationUrl" target="_blank">{{ verificationUrl }}</a>
        </div>
        <div class="polling-status">
          {{ pollingMessage }}
        </div>
      </div>
    </div>
  </template>

  <script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'

  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()

  const deviceCode = ref(route.params.deviceCode as string)
  const userCode = ref(route.params.userCode as string)
  const verificationUrl = ref(`${import.meta.env.VITE_SSO_BASE_URL}/activate`)
  const pollingMessage = ref('Waiting for authorization...')

  let pollInterval: NodeJS.Timeout

  onMounted(() => {
      // Start polling for token
      pollInterval = setInterval(async () => {
          try {
              const response = await authStore.pollDeviceToken(deviceCode.value)

              if (response.access_token) {
                  pollingMessage.value = 'Authorization successful! Redirecting...'
                  clearInterval(pollInterval)

                  await authStore.fetchSubscription()
                  router.push('/dashboard')
              }
          } catch (err) {
              if (err.code === 'authorization_pending') {
                  // Still waiting
              } else if (err.code === 'expired_token') {
                  pollingMessage.value = 'Code expired. Please try again.'
                  clearInterval(pollInterval)
              } else {
                  pollingMessage.value = 'Authentication failed. Please try again.'
                  clearInterval(pollInterval)
              }
          }
      }, 5000) // Poll every 5 seconds
  })

  onUnmounted(() => {
      if (pollInterval) {
          clearInterval(pollInterval)
      }
  })
  </script>
  ```

### 3.4 Microsoft To Do Integration Update
- [ ] **Update** `frontend/src/services/microsoft-auth.ts`
  ```typescript
  // Remove: Direct Microsoft OAuth flow methods
  // Remove: startOAuthFlow(), handleOAuthCallback()

  // Add: SSO-based Microsoft auth check
  async checkMicrosoftAuth(): Promise<boolean> {
      // Check if current SSO session uses Microsoft provider
      const status = await this.client.get('/api/v1/microsoft/status')
      return status.data.authenticated
  }

  async promptMicrosoftAuth(): Promise<void> {
      // Redirect to SSO Microsoft login
      const authUrl = authStore.getSsoAuthUrl('microsoft')
      window.location.href = authUrl
  }
  ```

- [ ] **Update** `frontend/src/components/auth/MicrosoftConnectButton.vue`
  ```vue
  <template>
    <button @click="connectMicrosoft" class="btn-microsoft">
      <MicrosoftIcon />
      <span v-if="isAuthenticated">Connected to Microsoft</span>
      <span v-else>Connect Microsoft Account for To Do</span>
    </button>
  </template>

  <script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useAuthStore } from '@/stores/auth'
  import microsoftAuthService from '@/services/microsoft-auth'

  const authStore = useAuthStore()
  const isAuthenticated = ref(false)

  onMounted(async () => {
      isAuthenticated.value = await microsoftAuthService.checkMicrosoftAuth()
  })

  const connectMicrosoft = () => {
      if (!isAuthenticated.value) {
          const authUrl = authStore.getSsoAuthUrl('microsoft')
          window.location.href = authUrl
      }
  }
  </script>
  ```

### 3.5 Router Updates
- [ ] **Update** `frontend/src/router/index.ts`
  ```typescript
  const routes = [
      // ... existing routes

      // Add device activation route
      {
          path: '/auth/device-activate',
          name: 'device-activate',
          component: () => import('@/views/DeviceActivate.vue'),
      },

      // Update callback route (now handles SSO callback)
      {
          path: '/auth/callback',
          name: 'auth-callback',
          component: () => import('@/views/AuthCallback.vue'),
      },
  ]
  ```

---

## Phase 4: Desktop/Tauri Integration

### 4.1 Tauri Deep Links (for OAuth callback)
- [ ] **Update** `desktop/src-tauri/tauri.conf.json`
  ```json
  {
      "tauri": {
          "allowlist": {
              "protocol": {
                  "asset": true,
                  "assetScope": ["**"]
              }
          },
          "bundle": {
              "identifier": "com.aicodeterminal.app",
              "deepLink": {
                  "protocol": ["act"],
                  "enabled": true
              }
          }
      }
  }
  ```

- [ ] **Update** `desktop/src-tauri/src/main.rs`
  ```rust
  use tauri::Manager;

  fn main() {
      tauri::Builder::default()
          .plugin(tauri_plugin_deep_link::init())
          .setup(|app| {
              // Register deep link handler
              #[cfg(target_os = "macos")]
              app.listen_global("deep-link://new-url", |event| {
                  if let Some(url) = event.payload() {
                      // Extract token from SSO callback URL
                      if url.starts_with("act://auth/callback") {
                          // Parse URL and extract token
                          // Send to frontend via Tauri event
                          app.emit_all("sso-callback", url).unwrap();
                      }
                  }
              });

              Ok(())
          })
          .run(tauri::generate_context!())
          .expect("error while running tauri application");
  }
  ```

### 4.2 Device Flow for Desktop
- [ ] **Implement device flow** in desktop app
  - Preferred method for desktop authentication
  - Better UX than deep links (no browser redirect needed)
  - User opens SSO activation page in browser
  - Desktop app polls SSO for token

  ```typescript
  // In frontend for Tauri app
  if (window.__TAURI__) {
      // Use device flow for desktop
      const startDesktopAuth = async () => {
          const deviceResponse = await authStore.startDeviceFlow()

          // Show user code in app
          showUserCodeModal(deviceResponse.user_code)

          // Open browser to activation page
          await invoke('open_url', {
              url: deviceResponse.verification_uri
          })

          // Start polling
          pollForToken(deviceResponse.device_code)
      }
  }
  ```

---

## Phase 5: Testing & Validation

### 5.1 Backend Testing
- [ ] **Unit tests** for SSO client
  - Token validation
  - Device flow polling
  - User info retrieval

- [ ] **Integration tests** for auth routes
  - Device flow end-to-end
  - Web OAuth flow end-to-end
  - Token expiration handling
  - Session revocation

- [ ] **Database migration tests**
  - Data integrity after migration
  - User-workspace associations preserved
  - Microsoft auth tokens migrated correctly

### 5.2 Frontend Testing
- [ ] **Component tests** for auth views
  - Login page provider buttons
  - Device activation flow
  - Callback handling

- [ ] **E2E tests** with Playwright
  - Complete login flow (GitHub)
  - Complete login flow (Microsoft)
  - Device flow activation
  - Token refresh
  - Logout and re-login

### 5.3 Desktop Testing
- [ ] **Tauri-specific tests**
  - Device flow in desktop app
  - Deep link handling (if implemented)
  - Token storage security

### 5.4 Microsoft To Do Integration Testing
- [ ] **Verify Microsoft auth** via SSO works
- [ ] **Test To Do API** calls with SSO-provided tokens
- [ ] **Test workspace sync** with Microsoft lists
- [ ] **Verify token refresh** for long-running sessions

---

## Phase 6: Deployment & Migration

### 6.1 SSO Deployment
- [ ] **Deploy SSO service** to production
  - Set up domain: `sso.yourdomain.com`
  - Configure SSL/TLS
  - Set up database (production SQLite or PostgreSQL)
  - Configure OAuth apps with GitHub, Microsoft, Google

- [ ] **Create production organization & service**
  - Organization: Production AI Code Terminal org
  - Service: Production terminal service
  - Plans: Free and Pro (if applicable)

### 6.2 ACT Backend Deployment
- [ ] **Run database migration** on production
  - Backup current database
  - Run migration script
  - Verify data integrity

- [ ] **Deploy updated backend**
  - Set SSO environment variables
  - Update CORS settings for new auth flow
  - Monitor logs for errors

### 6.3 ACT Frontend Deployment
- [ ] **Deploy updated frontend**
  - Update environment variables (SSO URLs)
  - Build and deploy to hosting
  - Verify OAuth redirects work

### 6.4 User Migration
- [ ] **Notify existing users** of auth changes
- [ ] **Provide migration guide**
  - Existing users will re-authenticate via SSO
  - GitHub accounts will be automatically linked
  - Workspaces and data will be preserved

### 6.5 Monitoring & Rollback Plan
- [ ] **Monitor authentication metrics**
  - Login success rate
  - Token validation failures
  - Device flow completion rate

- [ ] **Prepare rollback plan**
  - Keep old auth code in separate branch
  - Document rollback procedure
  - Have database backup ready

---

## Phase 7: Feature Enhancements (Post-Migration)

### 7.1 Subscription Features
- [ ] **Implement feature gating** in ACT
  ```rust
  // Example: Check if user has "unlimited_terminals" feature
  if auth_user.has_feature("unlimited_terminals") {
      // Allow unlimited terminal creation
  } else {
      // Limit to 5 terminals for free users
  }
  ```

- [ ] **Show upgrade prompts** in UI
  - Display plan limits in settings
  - Show "Upgrade to Pro" for locked features

### 7.2 Organization Support
- [ ] **Add team workspaces** (future feature)
  - Multiple users in same organization
  - Shared workspaces
  - Role-based access control (via SSO)

### 7.3 Analytics & Insights
- [ ] **Track authentication events**
  - Login method preferences (GitHub vs Microsoft vs Google)
  - Device vs web login usage
  - Token refresh patterns

---

## Appendix A: API Endpoints Reference

### SSO Endpoints (External)
```
POST   {SSO_URL}/auth/device/code           - Request device code
POST   {SSO_URL}/auth/token                 - Exchange device code for token
GET    {SSO_URL}/auth/{provider}            - Start OAuth with provider
GET    {SSO_URL}/auth/{provider}/callback   - OAuth callback
GET    {SSO_URL}/api/user                   - Get user info
GET    {SSO_URL}/api/subscription           - Get subscription
POST   {SSO_URL}/webhooks/stripe            - Stripe webhook
```

### ACT Backend Endpoints (Internal - calls SSO)
```
POST   /api/v1/auth/device/start            - Wrapper for SSO device code
GET    /api/v1/auth/device/poll/{code}      - Poll SSO for token
GET    /api/v1/auth/{provider}/start        - Redirect to SSO OAuth
GET    /api/v1/auth/{provider}/callback     - Handle SSO callback
GET    /api/v1/auth/me                      - Get current user from SSO token
POST   /api/v1/auth/logout                  - Revoke local session
GET    /api/v1/auth/subscription            - Get subscription from SSO

# Microsoft To Do (uses SSO Microsoft identity)
GET    /api/v1/microsoft/status             - Check Microsoft auth via SSO
GET    /api/v1/microsoft/lists              - Get To Do lists
POST   /api/v1/microsoft/lists/{id}/tasks   - Create task in list
... (other To Do endpoints remain same, but auth check changes)
```

---

## Appendix B: Environment Variables

### SSO Service
```env
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=3000
BASE_URL=http://localhost:3000

# Database
DATABASE_URL=sqlite:./data/sso.db

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION_HOURS=24

# OAuth Providers
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/auth/microsoft/callback

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### ACT Backend
```env
# Server
ACT_SERVER_HOST=0.0.0.0
ACT_SERVER_PORT=3001

# Database
ACT_DATABASE_URL=sqlite:./data/act.db

# SSO Integration (NEW - replaces old GitHub OAuth)
ACT_SSO_BASE_URL=http://localhost:3000
ACT_SSO_CLIENT_ID=your-sso-client-id
ACT_SSO_CLIENT_SECRET=your-sso-client-secret
ACT_SSO_ORG_SLUG=ai-code-terminal
ACT_SSO_SERVICE_SLUG=terminal

# Microsoft To Do (encryption key for tokens)
MS_ENCRYPTION_KEY=your-32-byte-hex-key

# CORS
ACT_CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### ACT Frontend
```env
VITE_SSO_BASE_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3001
VITE_SSO_ORG_SLUG=ai-code-terminal
VITE_SSO_SERVICE_SLUG=terminal
```

---

## Appendix C: Migration Script Example

### Database Migration Script
```rust
// migrations/migrate_to_sso.rs

use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn migrate_users_to_sso(pool: &SqlitePool, sso_base_url: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Step 1: Get all existing users
    let users = sqlx::query_as::<_, OldUser>(
        "SELECT id, github_id, username, email, avatar_url FROM users"
    )
    .fetch_all(pool)
    .await?;

    println!("Found {} users to migrate", users.len());

    for user in users {
        // Step 2: Create user in SSO via API
        let sso_user = create_sso_user(&sso_base_url, &user).await?;

        // Step 3: Update local user with SSO user ID
        sqlx::query(
            "UPDATE users SET sso_user_id = ?, username = ? WHERE id = ?"
        )
        .bind(&sso_user.id)
        .bind(&sso_user.username)
        .bind(&user.id)
        .execute(pool)
        .await?;

        // Step 4: Migrate GitHub identity to SSO
        if let Some(github_id) = user.github_id {
            create_sso_identity(&sso_base_url, &sso_user.id, "github", &github_id).await?;
        }

        println!("Migrated user: {} -> SSO ID: {}", user.email, sso_user.id);
    }

    // Step 5: Clean up old columns (after verification)
    // sqlx::query("ALTER TABLE users DROP COLUMN github_id").execute(pool).await?;

    println!("Migration complete!");
    Ok(())
}

async fn create_sso_user(sso_base_url: &str, user: &OldUser) -> Result<SsoUser, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/api/admin/users", sso_base_url))
        .json(&serde_json::json!({
            "email": user.email,
            "provider": "github",
            "provider_user_id": user.github_id,
        }))
        .send()
        .await?;

    let sso_user: SsoUser = response.json().await?;
    Ok(sso_user)
}
```

---

## Appendix D: Feature Flag Implementation

### Backend Feature Checks
```rust
// crates/act-server/src/features.rs

pub struct FeatureGate;

impl FeatureGate {
    pub fn check_unlimited_terminals(user: &AuthenticatedUser) -> Result<(), AppError> {
        if user.has_feature("unlimited_terminals") {
            Ok(())
        } else {
            Err(AppError::FeatureNotAvailable(
                "Unlimited terminals is a Pro feature".to_string()
            ))
        }
    }

    pub fn check_microsoft_todo(user: &AuthenticatedUser) -> Result<(), AppError> {
        if user.has_feature("microsoft_todo") {
            Ok(())
        } else {
            Err(AppError::FeatureNotAvailable(
                "Microsoft To Do integration requires Pro plan".to_string()
            ))
        }
    }

    pub fn get_terminal_limit(user: &AuthenticatedUser) -> usize {
        if user.has_feature("unlimited_terminals") {
            usize::MAX
        } else {
            5 // Free tier limit
        }
    }
}

// Usage in route handlers
pub async fn create_terminal(
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
    Json(req): Json<CreateTerminalRequest>,
) -> Result<Json<Terminal>> {
    let limit = FeatureGate::get_terminal_limit(&auth_user);
    let current_count = get_terminal_count(&state.pool, &auth_user.user_id).await?;

    if current_count >= limit {
        return Err(AppError::FeatureNotAvailable(
            format!("Terminal limit reached ({}). Upgrade to Pro for unlimited terminals.", limit)
        ));
    }

    // Create terminal...
    Ok(Json(terminal))
}
```

### Frontend Feature Checks
```typescript
// frontend/src/composables/useFeatures.ts

export function useFeatures() {
    const authStore = useAuthStore()

    const hasFeature = (feature: string): boolean => {
        return authStore.subscription?.features.includes(feature) || false
    }

    const canUseUnlimitedTerminals = computed(() => {
        return hasFeature('unlimited_terminals')
    })

    const canUseMicrosoftTodo = computed(() => {
        return hasFeature('microsoft_todo')
    })

    const terminalLimit = computed(() => {
        return canUseUnlimitedTerminals.value ? Infinity : 5
    })

    return {
        hasFeature,
        canUseUnlimitedTerminals,
        canUseMicrosoftTodo,
        terminalLimit,
    }
}
```

```vue
<!-- Usage in component -->
<template>
  <div>
    <button @click="createTerminal" :disabled="!canCreateTerminal">
      New Terminal
    </button>
    <p v-if="!canUseUnlimitedTerminals">
      {{ currentTerminals }}/{{ terminalLimit }} terminals used.
      <a href="/upgrade">Upgrade to Pro</a> for unlimited terminals.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useFeatures } from '@/composables/useFeatures'

const { canUseUnlimitedTerminals, terminalLimit } = useFeatures()
const currentTerminals = ref(3)

const canCreateTerminal = computed(() => {
    return currentTerminals.value < terminalLimit.value
})
</script>
```

---

## Summary

This comprehensive transformation checklist covers:

1. **SSO Service Setup** - Organization, service, and OAuth provider configuration
2. **Backend Migration** - Database schema changes, new SSO client, route refactoring
3. **Frontend Refactoring** - Auth store updates, new views, API service changes
4. **Desktop Integration** - Device flow implementation for Tauri app
5. **Microsoft To Do** - Integration with SSO-based Microsoft authentication
6. **Testing** - Comprehensive test coverage across all layers
7. **Deployment** - Production migration and monitoring plan
8. **Feature Enhancements** - Subscription features and organization support

**Estimated Timeline:**
- Phase 1: 1-2 days
- Phase 2: 3-5 days
- Phase 3: 3-4 days
- Phase 4: 2-3 days
- Phase 5: 3-4 days
- Phase 6: 2-3 days
- Phase 7: Ongoing (post-launch)

**Total:** 2-3 weeks for full migration

**Key Success Metrics:**
- Zero data loss during migration
- 100% existing users can re-authenticate
- All workspaces and settings preserved
- Microsoft To Do integration functional
- Device flow works in desktop app
- Subscription features properly gated
