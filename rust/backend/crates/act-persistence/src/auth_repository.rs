use act_core::auth::{AuthRepository, AuthenticatedUser, UserSettings};
use async_trait::async_trait;
use chrono::Utc;
use sqlx::Row;
use sqlx::SqlitePool;
use tracing::info;

use super::error::PersistenceError;

macro_rules! handle_db_error {
    ($expr:expr) => {
        $expr
            .await
            .map_err(|e| PersistenceError::DatabaseConnection(e))?
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
    async fn update_user(
        &self,
        user_id: &str,
        username: &str,
        email: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<AuthenticatedUser, act_core::error::CoreError> {
        let now = Utc::now();

        handle_db_error!(sqlx::query(
            r#"
                UPDATE users 
                SET username = ?2, email = ?3, avatar_url = ?4, updated_at = ?5
                WHERE id = ?1
                "#
        )
        .bind(user_id)
        .bind(username)
        .bind(&email)
        .bind(&avatar_url)
        .bind(now)
        .execute(&self.pool));

        Ok(AuthenticatedUser {
            user_id: user_id.to_string(),
            username: username.to_string(),
            email,
            avatar_url,
        })
    }

    async fn get_user_settings(
        &self,
        user_id: &str,
    ) -> Result<Option<UserSettings>, act_core::error::CoreError> {
        let row = handle_db_error!(sqlx::query(
            r#"
                SELECT user_id, theme
                FROM user_settings
                WHERE user_id = ?1
                "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool));

        match row {
            Some(row) => Ok(Some(UserSettings {
                user_id: row.get("user_id"),
                theme: row.get("theme"),
            })),
            None => Ok(None),
        }
    }

    async fn update_user_settings(
        &self,
        user_id: &str,
        settings: &UserSettings,
    ) -> Result<(), act_core::error::CoreError> {
        handle_db_error!(sqlx::query(
            r#"
                INSERT OR REPLACE INTO user_settings (user_id, theme)
                VALUES (?1, ?2)
                "#
        )
        .bind(user_id)
        .bind(&settings.theme)
        .execute(&self.pool));

        Ok(())
    }

    async fn get_all_users(
        &self,
    ) -> Result<Vec<act_core::auth::AuthenticatedUser>, act_core::error::CoreError> {
        let rows = handle_db_error!(sqlx::query(
            r#"
                SELECT id, username, email, avatar_url
                FROM users
                ORDER BY username
                "#
        )
        .fetch_all(&self.pool));

        let mut users = Vec::new();
        for row in rows {
            users.push(act_core::auth::AuthenticatedUser {
                user_id: row.get("id"),
                username: row.get("username"),
                email: row.get("email"),
                avatar_url: row.get("avatar_url"),
            });
        }

        Ok(users)
    }

    /// Find or create user by SSO ID and email - primary method for SSO authentication
    async fn find_or_create_user_by_sso_id_and_email(
        &self,
        sso_id: &str,
        email: &str,
    ) -> Result<act_core::auth::AuthenticatedUser, act_core::error::CoreError> {
        // Try to find user by SSO user ID first
        let row = handle_db_error!(sqlx::query(
            r#"
                SELECT id, username, email, avatar_url
                FROM users
                WHERE sso_user_id = ?1
                "#
        )
        .bind(sso_id)
        .fetch_optional(&self.pool));

        if let Some(row) = row {
            // User exists, return their info
            info!("Found existing user by SSO ID: {}", sso_id);
            return Ok(act_core::auth::AuthenticatedUser {
                user_id: row.get("id"),
                username: row.get("username"),
                email: row.get("email"),
                avatar_url: row.get("avatar_url"),
            });
        }

        // Check if user exists by email (migration case)
        let row = handle_db_error!(sqlx::query(
            r#"
                SELECT id, username, email, avatar_url
                FROM users
                WHERE email = ?1
                "#
        )
        .bind(email)
        .fetch_optional(&self.pool));

        if let Some(row) = row {
            let user_id: String = row.get("id");

            // Update existing user with SSO user ID
            info!(
                "Found existing user by email, updating with SSO ID: {}",
                sso_id
            );
            handle_db_error!(sqlx::query(
                r#"
                    UPDATE users
                    SET sso_user_id = ?2, updated_at = datetime('now')
                    WHERE id = ?1
                    "#
            )
            .bind(&user_id)
            .bind(sso_id)
            .execute(&self.pool));

            return Ok(act_core::auth::AuthenticatedUser {
                user_id,
                username: row.get("username"),
                email: Some(email.to_string()),
                avatar_url: row.get("avatar_url"),
            });
        }

        // Create new user
        info!("Creating new user for SSO ID: {}", sso_id);
        let user_id = uuid::Uuid::new_v4().to_string();
        let username = sso_id.split('@').next().unwrap_or(sso_id); // Use part before @ or full ID as username

        handle_db_error!(sqlx::query(
            r#"
                INSERT INTO users (id, username, email, sso_user_id, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))
                "#
        )
        .bind(&user_id)
        .bind(username)
        .bind(email)
        .bind(sso_id)
        .execute(&self.pool));

        Ok(act_core::auth::AuthenticatedUser {
            user_id,
            username: username.to_string(),
            email: Some(email.to_string()),
            avatar_url: None,
        })
    }

    /// Delete all SSO sessions for a user (used for logout)
    async fn delete_sso_sessions(&self, user_id: &str) -> Result<(), act_core::error::CoreError> {
        info!("Deleting all SSO sessions for user: {}", user_id);

        handle_db_error!(sqlx::query(
            r#"
                DELETE FROM sso_sessions
                WHERE user_id = ?1
                "#
        )
        .bind(user_id)
        .execute(&self.pool));

        info!("Successfully deleted SSO sessions for user: {}", user_id);
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
