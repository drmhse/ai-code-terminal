use act_core::{AuthRepository, AuthenticatedUser, GitHubAuthService, JwtService, Result};
use std::sync::Arc;

pub struct AuthService {
    github_service: Arc<dyn GitHubAuthService>,
    jwt_service: Arc<dyn JwtService>,
    auth_repository: Arc<dyn AuthRepository>,
}

#[derive(Debug)]
pub struct AuthResult {
    pub jwt_token: String,
    pub user: AuthenticatedUser,
}

#[derive(Debug)]
pub enum AuthError {
    GitHubNotConfigured,
    InvalidCode,
    InvalidState,
    TokenExchangeFailed(String),
    UnauthorizedUser(String),
    TokenStorageFailed(String),
    JwtGenerationFailed(String),
}

#[derive(Debug)]
pub struct AuthStatus {
    pub is_authenticated: bool,
    pub user_info: Option<AuthenticatedUser>,
    pub github_configured: bool,
}

#[derive(Debug)]
pub enum ValidationError {
    NoToken,
    InvalidHeader,
    InvalidFormat,
    JwtInvalid,
    JwtExpired,
    GitHubTokenMissing,
    GitHubTokenExpired,
    GitHubTokenInvalid,
    RefreshFailed,
}

impl AuthService {
    pub fn new(
        github_service: Arc<dyn GitHubAuthService>,
        jwt_service: Arc<dyn JwtService>,
        auth_repository: Arc<dyn AuthRepository>,
    ) -> Self {
        Self {
            github_service,
            jwt_service,
            auth_repository,
        }
    }

    pub async fn get_authorization_url(&self, state: &str) -> Result<String> {
        if !self.github_service.is_configured() {
            return Err(act_core::CoreError::Configuration(
                "GitHub OAuth is not configured".to_string(),
            ));
        }
        self.github_service.get_authorization_url(state).await
    }

    pub async fn handle_oauth_callback(&self, code: &str, state: &str) -> Result<AuthResult> {
        let token_result = self
            .github_service
            .exchange_code_for_token(code, state)
            .await?;

        if !self
            .github_service
            .validate_tenant_user(&token_result.user.username)
        {
            return Err(act_core::CoreError::Authorization(format!(
                "User {} is not authorized",
                token_result.user.username
            )));
        }

        // Find or create user in our users table using GitHub info
        // Use the actual GitHub user ID from the authenticated user
        let github_id = &token_result.user.user_id; // This is the actual GitHub user ID
        let user = match self
            .auth_repository
            .find_user_by_github_id(github_id)
            .await?
        {
            Some(existing_user) => {
                // Update existing user with latest info from GitHub
                self.auth_repository
                    .update_user(
                        &existing_user.user_id,
                        &token_result.user.username,
                        token_result.user.email,
                        token_result.user.avatar_url,
                    )
                    .await?
            }
            None => {
                // Create new user with proper GitHub ID
                self.auth_repository
                    .create_user(
                        github_id,
                        &token_result.user.username,
                        token_result.user.email,
                        token_result.user.avatar_url,
                    )
                    .await?
            }
        };

        self.auth_repository
            .store_github_token(
                &user.user_id,
                &token_result.access_token,
                token_result.refresh_token,
                token_result.expires_at,
            )
            .await?;

        let jwt_token = self.jwt_service.generate_token(&user)?;

        Ok(AuthResult { jwt_token, user })
    }

    pub async fn get_auth_status(&self, user_id: &str) -> Result<AuthStatus> {
        let is_authenticated = self
            .auth_repository
            .is_github_authenticated(user_id)
            .await?;

        let mut user_info = None;
        if is_authenticated {
            if let Ok(Some(access_token)) = self.auth_repository.get_github_token(user_id).await {
                if self
                    .github_service
                    .validate_token(&access_token)
                    .await
                    .unwrap_or(false)
                {
                    if let Ok(user) = self.github_service.get_user_info(&access_token).await {
                        user_info = Some(user);
                    }
                }
            }
        }

        Ok(AuthStatus {
            is_authenticated: is_authenticated && user_info.is_some(),
            user_info,
            github_configured: self.github_service.is_configured(),
        })
    }

    pub async fn logout(&self, user_id: &str) -> Result<()> {
        if let Ok(Some(access_token)) = self.auth_repository.get_github_token(user_id).await {
            let _ = self.github_service.revoke_token(&access_token).await;
        }

        self.auth_repository.clear_github_tokens(user_id).await?;
        Ok(())
    }

    pub async fn get_current_user(&self, jwt_token: &str) -> Result<AuthenticatedUser> {
        let claims = self.jwt_service.validate_token(jwt_token)?;
        tracing::debug!(
            "JWT claims for get_current_user: sub={}, username={}",
            claims.sub,
            claims.username
        );

        // Return the user based on JWT claims only - GitHub token not required for basic auth
        Ok(AuthenticatedUser {
            user_id: claims.sub, // Use the UUID from JWT claims
            username: claims.username,
            email: None,      // We don't store email in JWT
            avatar_url: None, // We don't store avatar_url in JWT
        })
    }

    pub async fn validate_auth(&self, jwt_token: &str) -> Result<bool> {
        let claims = self.jwt_service.validate_token(jwt_token)?;

        if self.jwt_service.is_token_expired(&claims) {
            return Ok(false);
        }

        let github_token = match self.auth_repository.get_github_token(&claims.sub).await? {
            Some(token) => token,
            None => return Ok(false),
        };

        if self
            .auth_repository
            .is_github_token_expired(&claims.sub)
            .await?
        {
            if let Ok(Some(refresh_token)) = self
                .auth_repository
                .get_github_refresh_token(&claims.sub)
                .await
            {
                match self
                    .github_service
                    .refresh_access_token(&refresh_token)
                    .await
                {
                    Ok(new_token) => {
                        self.auth_repository
                            .store_github_token(
                                &claims.sub,
                                &new_token.access_token,
                                new_token.refresh_token,
                                new_token.expires_at,
                            )
                            .await?;
                    }
                    Err(_) => return Ok(false),
                }
            } else {
                return Ok(false);
            }
        }

        self.github_service.validate_token(&github_token).await
    }

    pub async fn get_all_users(&self) -> Result<Vec<AuthenticatedUser>> {
        self.auth_repository.get_all_users().await
    }
}
