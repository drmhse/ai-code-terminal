use std::sync::Arc;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use act_core::{
    Result, CoreError, AuthenticatedUser, AuthToken, JwtClaims,
    GitHubAuthService, JwtService, AuthRepository
};
use act_domain::AuthService;

// Mock implementations for testing

struct MockGitHubAuthService {
    configured: bool,
    user: AuthenticatedUser,
}

impl MockGitHubAuthService {
    fn new() -> Self {
        Self {
            configured: true,
            user: AuthenticatedUser {
                user_id: "123".to_string(),
                username: "testuser".to_string(),
                email: Some("test@example.com".to_string()),
                avatar_url: Some("https://github.com/avatar.jpg".to_string()),
            },
        }
    }
}

#[async_trait]
impl GitHubAuthService for MockGitHubAuthService {
    async fn get_authorization_url(&self, _state: &str) -> Result<String> {
        if !self.configured {
            return Err(CoreError::Configuration("GitHub not configured".to_string()));
        }
        Ok("https://github.com/login/oauth/authorize".to_string())
    }

    async fn exchange_code_for_token(&self, _code: &str, _state: &str) -> Result<AuthToken> {
        Ok(AuthToken {
            access_token: "test_token".to_string(),
            refresh_token: Some("refresh_token".to_string()),
            expires_at: Utc::now() + chrono::Duration::hours(1),
            user: self.user.clone(),
        })
    }

    async fn refresh_access_token(&self, _refresh_token: &str) -> Result<AuthToken> {
        Ok(AuthToken {
            access_token: "new_test_token".to_string(),
            refresh_token: Some("new_refresh_token".to_string()),
            expires_at: Utc::now() + chrono::Duration::hours(1),
            user: self.user.clone(),
        })
    }

    async fn validate_token(&self, _token: &str) -> Result<bool> {
        Ok(true)
    }

    async fn get_user_info(&self, _token: &str) -> Result<AuthenticatedUser> {
        Ok(self.user.clone())
    }

    async fn revoke_token(&self, _token: &str) -> Result<()> {
        Ok(())
    }

    fn validate_tenant_user(&self, username: &str) -> bool {
        username == "testuser"
    }

    fn is_configured(&self) -> bool {
        self.configured
    }
}

struct MockJwtService;

#[async_trait]
impl JwtService for MockJwtService {
    fn generate_token(&self, user: &AuthenticatedUser) -> Result<String> {
        Ok(format!("jwt_token_for_{}", user.user_id))
    }

    fn validate_token(&self, token: &str) -> Result<JwtClaims> {
        if token.starts_with("jwt_token_for_") {
            Ok(JwtClaims {
                sub: "123".to_string(),
                username: "testuser".to_string(),
                exp: (Utc::now() + chrono::Duration::hours(1)).timestamp() as usize,
                iat: Utc::now().timestamp() as usize,
            })
        } else {
            Err(CoreError::Auth("Invalid token".to_string()))
        }
    }

    fn is_token_expired(&self, claims: &JwtClaims) -> bool {
        let now = Utc::now().timestamp() as usize;
        claims.exp < now
    }
}

struct MockAuthRepository {
    tokens: std::sync::Mutex<std::collections::HashMap<String, (String, Option<String>, DateTime<Utc>)>>,
}

impl MockAuthRepository {
    fn new() -> Self {
        Self {
            tokens: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }
}

#[async_trait]
impl AuthRepository for MockAuthRepository {
    async fn store_github_token(
        &self,
        user_id: &str,
        token: &str,
        refresh_token: Option<&str>,
        expires_at: DateTime<Utc>,
    ) -> Result<()> {
        let mut tokens = self.tokens.lock().unwrap();
        tokens.insert(
            user_id.to_string(),
            (token.to_string(), refresh_token.map(|s| s.to_string()), expires_at),
        );
        Ok(())
    }

    async fn get_github_token(&self, user_id: &str) -> Result<Option<String>> {
        let tokens = self.tokens.lock().unwrap();
        Ok(tokens.get(user_id).map(|(token, _, _)| token.clone()))
    }

    async fn get_github_refresh_token(&self, user_id: &str) -> Result<Option<String>> {
        let tokens = self.tokens.lock().unwrap();
        Ok(tokens.get(user_id).and_then(|(_, refresh, _)| refresh.clone()))
    }

    async fn is_github_token_expired(&self, user_id: &str) -> Result<bool> {
        let tokens = self.tokens.lock().unwrap();
        if let Some((_, _, expires_at)) = tokens.get(user_id) {
            Ok(*expires_at < Utc::now())
        } else {
            Ok(true)
        }
    }

    async fn clear_github_tokens(&self, user_id: &str) -> Result<()> {
        let mut tokens = self.tokens.lock().unwrap();
        tokens.remove(user_id);
        Ok(())
    }

    async fn is_github_authenticated(&self, user_id: &str) -> Result<bool> {
        let tokens = self.tokens.lock().unwrap();
        Ok(tokens.contains_key(user_id))
    }
}

#[tokio::test]
async fn test_get_authorization_url_success() {
    let auth_service = create_auth_service();
    
    let result = auth_service.get_authorization_url("test_state").await;
    
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "https://github.com/login/oauth/authorize");
}

#[tokio::test]
async fn test_handle_oauth_callback_success() {
    let auth_service = create_auth_service();
    
    let result = auth_service.handle_oauth_callback("test_code", "test_state").await;
    
    assert!(result.is_ok());
    let auth_result = result.unwrap();
    assert_eq!(auth_result.user.username, "testuser");
    assert!(auth_result.jwt_token.starts_with("jwt_token_for_"));
}

#[tokio::test]
async fn test_validate_auth_success() {
    let auth_service = create_auth_service();
    
    let result = auth_service.validate_auth("jwt_token_for_123").await;
    
    assert!(result.is_ok());
    assert!(result.unwrap());
}

#[tokio::test]
async fn test_validate_auth_invalid_token() {
    let auth_service = create_auth_service();
    
    let result = auth_service.validate_auth("invalid_token").await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_logout_success() {
    let auth_service = create_auth_service();
    
    // First authenticate
    let _ = auth_service.handle_oauth_callback("test_code", "test_state").await.unwrap();
    
    // Then logout
    let result = auth_service.logout("123").await;
    
    assert!(result.is_ok());
    
    // Verify tokens are cleared
    let status = auth_service.get_auth_status("123").await.unwrap();
    assert!(!status.is_authenticated);
}

fn create_auth_service() -> AuthService {
    let github_service: Arc<dyn GitHubAuthService> = Arc::new(MockGitHubAuthService::new());
    let jwt_service: Arc<dyn JwtService> = Arc::new(MockJwtService);
    let auth_repository: Arc<dyn AuthRepository> = Arc::new(MockAuthRepository::new());
    
    AuthService::new(github_service, jwt_service, auth_repository)
}