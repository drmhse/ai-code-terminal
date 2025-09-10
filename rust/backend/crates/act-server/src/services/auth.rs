use std::sync::Arc;
use async_trait::async_trait;
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Validation};
use act_core::{
    Result, CoreError,
    AuthenticatedUser, AuthToken, JwtClaims,
    GitHubAuthService, JwtService,
};
use crate::config::Config;
use crate::services::GitHubService;

pub struct ServerGitHubAuthService {
    github_service: GitHubService,
}

impl ServerGitHubAuthService {
    pub fn new(config: Arc<Config>) -> Result<Self> {
        let github_service = GitHubService::new(config)
            .map_err(|e| CoreError::Configuration(e.to_string()))?;
        
        Ok(Self { github_service })
    }
}

#[async_trait]
impl GitHubAuthService for ServerGitHubAuthService {
    async fn get_authorization_url(&self, state: &str) -> Result<String> {
        self.github_service.get_authorization_url(state)
            .map_err(|e| CoreError::Configuration(e.to_string()))
    }

    async fn exchange_code_for_token(&self, code: &str, state: &str) -> Result<AuthToken> {
        let result = self.github_service.exchange_code_for_token(code, state)
            .await
            .map_err(|e| CoreError::External(e.to_string()))?;

        Ok(AuthToken {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expires_at: result.expires_at,
            user: AuthenticatedUser {
                user_id: result.user.id.to_string(),
                username: result.user.login,
                email: result.user.email,
                avatar_url: Some(result.user.avatar_url),
            },
        })
    }

    async fn refresh_access_token(&self, refresh_token: &str) -> Result<AuthToken> {
        let result = self.github_service.refresh_access_token(refresh_token)
            .await
            .map_err(|e| CoreError::External(e.to_string()))?;

        Ok(AuthToken {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expires_at: result.expires_at,
            user: AuthenticatedUser {
                user_id: result.user.id.to_string(),
                username: result.user.login,
                email: result.user.email,
                avatar_url: Some(result.user.avatar_url),
            },
        })
    }

    async fn validate_token(&self, token: &str) -> Result<bool> {
        Ok(self.github_service.validate_token(token).await)
    }

    async fn get_user_info(&self, token: &str) -> Result<AuthenticatedUser> {
        let user = self.github_service.get_user_info(token)
            .await
            .map_err(|e| CoreError::External(e.to_string()))?;

        Ok(AuthenticatedUser {
            user_id: user.id.to_string(),
            username: user.login,
            email: user.email,
            avatar_url: Some(user.avatar_url),
        })
    }

    async fn revoke_token(&self, token: &str) -> Result<()> {
        self.github_service.revoke_token(token)
            .await
            .map_err(|e| CoreError::External(e.to_string()))
    }

    fn validate_tenant_user(&self, username: &str) -> bool {
        self.github_service.validate_tenant_user(username)
    }

    fn is_configured(&self) -> bool {
        self.github_service.is_configured()
    }
}

pub struct ServerJwtService {
    jwt_secret: String,
}

impl ServerJwtService {
    pub fn new(jwt_secret: String) -> Self {
        Self { jwt_secret }
    }
}

#[async_trait]
impl JwtService for ServerJwtService {
    fn generate_token(&self, user: &AuthenticatedUser) -> Result<String> {
        let now = chrono::Utc::now();
        let exp = now + chrono::Duration::days(7);
        
        let claims = JwtClaims {
            sub: user.user_id.clone(),
            github_username: user.username.clone(),
            username: user.username.clone(),
            exp: exp.timestamp() as usize,
            iat: now.timestamp() as usize,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref())
        ).map_err(|e| CoreError::Configuration(e.to_string()))
    }

    fn validate_token(&self, token: &str) -> Result<JwtClaims> {
        let token_data = decode::<JwtClaims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &Validation::default()
        ).map_err(|_| CoreError::Authorization("Invalid JWT token".to_string()))?;

        Ok(token_data.claims)
    }

    fn is_token_expired(&self, claims: &JwtClaims) -> bool {
        let now = chrono::Utc::now().timestamp() as usize;
        claims.exp < now
    }
}

