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
            SELECT current_workspace_id, layout_preferences
            FROM user_settings
            WHERE user_id = ?1
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(PersistenceError::DatabaseConnection)?;

        match row {
            Some(row) => {
                let current_workspace_id: Option<String> = row.get("current_workspace_id");
                let layout_preferences_json: Option<String> = row.get("layout_preferences");

                // Deserialize layout preferences from JSON, or use default if null/invalid
                let layout_preferences = match layout_preferences_json {
                    Some(json_str) => {
                        serde_json::from_str(&json_str)
                            .unwrap_or_else(|_| act_core::user_preferences::LayoutPreferences::default())
                    }
                    None => act_core::user_preferences::LayoutPreferences::default(),
                };

                Ok(Some(UserPreferences {
                    current_workspace_id,
                    layout_preferences,
                }))
            }
            None => {
                // User doesn't have settings record yet - return default preferences
                Ok(Some(UserPreferences::default()))
            }
        }
    }

    async fn save_user_preferences(&self, user_id: &str, preferences: &UserPreferences) -> Result<(), act_core::error::CoreError> {
        // Serialize layout preferences to JSON (following theme repository pattern)
        let layout_preferences_json = serde_json::to_string(&preferences.layout_preferences)
            .map_err(|e| act_core::error::CoreError::Internal(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO user_settings (user_id, current_workspace_id, layout_preferences)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(user_id) DO UPDATE SET
                current_workspace_id = excluded.current_workspace_id,
                layout_preferences = excluded.layout_preferences
            "#
        )
        .bind(user_id)
        .bind(&preferences.current_workspace_id)
        .bind(layout_preferences_json)
        .execute(&self.pool)
        .await
        .map_err(PersistenceError::DatabaseConnection)?;

        Ok(())
    }

    async fn set_current_workspace(&self, user_id: &str, workspace_id: Option<&str>) -> Result<(), act_core::error::CoreError> {
        // Get existing preferences to preserve layout_preferences when updating workspace
        let mut preferences = self.get_user_preferences(user_id).await?
            .unwrap_or_else(UserPreferences::default);

        // Update only the current_workspace_id field
        preferences.current_workspace_id = workspace_id.map(|s| s.to_string());

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