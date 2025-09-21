use act_core::user_preferences::{UserPreferencesRepository, UserPreferences};
use async_trait::async_trait;
use sqlx::SqlitePool;
use sqlx::Row;

use super::error::PersistenceError;

pub struct SqlUserPreferencesRepository {
    pool: SqlitePool,
}

impl SqlUserPreferencesRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserPreferencesRepository for SqlUserPreferencesRepository {
    async fn get_user_preferences(&self, user_id: &str) -> Result<Option<UserPreferences>, act_core::error::CoreError> {
        let row = sqlx::query(
            r#"
            SELECT current_workspace_id
            FROM user_settings
            WHERE user_id = ?1
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| PersistenceError::DatabaseConnection(e))?;

        match row {
            Some(row) => {
                let current_workspace_id: Option<String> = row.get("current_workspace_id");
                Ok(Some(UserPreferences {
                    current_workspace_id,
                }))
            }
            None => {
                // User doesn't have settings record yet - return default preferences
                Ok(Some(UserPreferences::default()))
            }
        }
    }

    async fn save_user_preferences(&self, user_id: &str, preferences: &UserPreferences) -> Result<(), act_core::error::CoreError> {
        sqlx::query(
            r#"
            INSERT INTO user_settings (user_id, current_workspace_id)
            VALUES (?1, ?2)
            ON CONFLICT(user_id) DO UPDATE SET current_workspace_id = excluded.current_workspace_id
            "#
        )
        .bind(user_id)
        .bind(&preferences.current_workspace_id)
        .execute(&self.pool)
        .await
        .map_err(|e| PersistenceError::DatabaseConnection(e))?;

        Ok(())
    }

    async fn set_current_workspace(&self, user_id: &str, workspace_id: Option<&str>) -> Result<(), act_core::error::CoreError> {
        let preferences = UserPreferences {
            current_workspace_id: workspace_id.map(|s| s.to_string()),
        };
        self.save_user_preferences(user_id, &preferences).await
    }
}

impl Clone for SqlUserPreferencesRepository {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
        }
    }
}