use act_core::auth::{AuthRepository, AuthenticatedUser, UserSettings};
use async_trait::async_trait;
use sqlx::SqlitePool;
use sqlx::Row;
use chrono::{DateTime, Utc};

use super::error::PersistenceError;

macro_rules! handle_db_error {
    ($expr:expr) => {
        $expr.await.map_err(|e| PersistenceError::DatabaseConnection(e))?
    };
}

pub struct SqlAuthRepository {
    pool: SqlitePool,
}

impl SqlAuthRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AuthRepository for SqlAuthRepository {
    async fn find_user_by_github_id(&self, github_id: &str) -> Result<Option<AuthenticatedUser>, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, github_id, username, email, avatar_url
                FROM users
                WHERE github_id = ?1
                "#
            )
            .bind(github_id)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => {
                Ok(Some(AuthenticatedUser {
                    user_id: row.get("id"),
                    username: row.get("username"),
                    email: row.get("email"),
                    avatar_url: row.get("avatar_url"),
                }))
            }
            None => Ok(None),
        }
    }

    async fn create_user(&self, github_id: &str, username: &str, email: Option<&str>, avatar_url: Option<&str>) -> Result<AuthenticatedUser, act_core::error::CoreError> {
        let user_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        handle_db_error!(
            sqlx::query(
                r#"
                INSERT INTO users (id, github_id, username, email, avatar_url, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                "#
            )
            .bind(&user_id)
            .bind(github_id)
            .bind(username)
            .bind(email)
            .bind(avatar_url)
            .bind(now)
            .bind(now)
            .execute(&self.pool)
        );

        Ok(AuthenticatedUser {
            user_id,
            username: username.to_string(),
            email: email.map(|s| s.to_string()),
            avatar_url: avatar_url.map(|s| s.to_string()),
        })
    }

    async fn update_user(&self, user_id: &str, username: &str, email: Option<&str>, avatar_url: Option<&str>) -> Result<AuthenticatedUser, act_core::error::CoreError> {
        let now = Utc::now();

        handle_db_error!(
            sqlx::query(
                r#"
                UPDATE users 
                SET username = ?2, email = ?3, avatar_url = ?4, updated_at = ?5
                WHERE id = ?1
                "#
            )
            .bind(user_id)
            .bind(username)
            .bind(email)
            .bind(avatar_url)
            .bind(now)
            .execute(&self.pool)
        );

        Ok(AuthenticatedUser {
            user_id: user_id.to_string(),
            username: username.to_string(),
            email: email.map(|s| s.to_string()),
            avatar_url: avatar_url.map(|s| s.to_string()),
        })
    }

    async fn store_github_token(&self, user_id: &str, token: &str, refresh_token: Option<&str>, expires_at: DateTime<Utc>) -> Result<(), act_core::error::CoreError> {
        // Insert or replace user_settings for this user
        handle_db_error!(
            sqlx::query(
                r#"
                INSERT OR REPLACE INTO user_settings (user_id, github_token, github_refresh_token, github_token_expires_at)
                VALUES (?1, ?2, ?3, ?4)
                "#
            )
            .bind(user_id)
            .bind(token)
            .bind(refresh_token)
            .bind(expires_at)
            .execute(&self.pool)
        );

        Ok(())
    }

    async fn get_github_token(&self, user_id: &str) -> Result<Option<String>, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT github_token
                FROM user_settings
                WHERE user_id = ?1
                "#
            )
            .bind(user_id)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => Ok(row.get("github_token")),
            None => Ok(None),
        }
    }

    async fn get_github_refresh_token(&self, user_id: &str) -> Result<Option<String>, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT github_refresh_token
                FROM user_settings
                WHERE user_id = ?1
                "#
            )
            .bind(user_id)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => Ok(row.get("github_refresh_token")),
            None => Ok(None),
        }
    }

    async fn is_github_token_expired(&self, user_id: &str) -> Result<bool, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT github_token_expires_at
                FROM user_settings
                WHERE user_id = ?1
                "#
            )
            .bind(user_id)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => {
                let expires_at: Option<DateTime<Utc>> = row.get("github_token_expires_at");
                match expires_at {
                    Some(expires_at) => Ok(expires_at <= Utc::now()),
                    None => Ok(true), // No expiration date means expired
                }
            }
            None => Ok(true), // No settings means expired
        }
    }

    async fn clear_github_tokens(&self, user_id: &str) -> Result<(), act_core::error::CoreError> {
        handle_db_error!(
            sqlx::query(
                r#"
                UPDATE user_settings 
                SET github_token = NULL, github_refresh_token = NULL, github_token_expires_at = NULL
                WHERE user_id = ?1
                "#
            )
            .bind(user_id)
            .execute(&self.pool)
        );

        Ok(())
    }

    async fn is_github_authenticated(&self, user_id: &str) -> Result<bool, act_core::error::CoreError> {
        let has_token = self.get_github_token(user_id).await?.is_some();
        let is_expired = self.is_github_token_expired(user_id).await?;
        
        Ok(has_token && !is_expired)
    }

    async fn get_user_settings(&self, user_id: &str) -> Result<Option<UserSettings>, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT user_id, github_token, github_refresh_token, github_token_expires_at, theme
                FROM user_settings
                WHERE user_id = ?1
                "#
            )
            .bind(user_id)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => {
                Ok(Some(UserSettings {
                    user_id: row.get("user_id"),
                    github_token: row.get("github_token"),
                    github_refresh_token: row.get("github_refresh_token"),
                    github_token_expires_at: row.get("github_token_expires_at"),
                    theme: row.get("theme"),
                }))
            }
            None => Ok(None),
        }
    }

    async fn update_user_settings(&self, user_id: &str, settings: &UserSettings) -> Result<(), act_core::error::CoreError> {
        handle_db_error!(
            sqlx::query(
                r#"
                INSERT OR REPLACE INTO user_settings (user_id, github_token, github_refresh_token, github_token_expires_at, theme)
                VALUES (?1, ?2, ?3, ?4, ?5)
                "#
            )
            .bind(user_id)
            .bind(&settings.github_token)
            .bind(&settings.github_refresh_token)
            .bind(settings.github_token_expires_at)
            .bind(&settings.theme)
            .execute(&self.pool)
        );

        Ok(())
    }
}

impl Clone for SqlAuthRepository {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
        }
    }
}