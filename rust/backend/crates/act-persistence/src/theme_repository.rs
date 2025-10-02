use act_core::theme::{ThemePreference, ThemeRepository};
use async_trait::async_trait;
use sqlx::Row;
use sqlx::SqlitePool;

use super::error::PersistenceError;

pub struct SqlThemeRepository {
    pool: SqlitePool,
}

impl SqlThemeRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ThemeRepository for SqlThemeRepository {
    async fn get_theme_preference(
        &self,
        user_id: &str,
    ) -> Result<Option<ThemePreference>, act_core::error::CoreError> {
        let row = sqlx::query(
            r#"
            SELECT theme
            FROM user_settings
            WHERE user_id = ?1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(PersistenceError::DatabaseConnection)?;

        match row {
            Some(row) => {
                let theme_str: Option<String> = row.get("theme");
                match theme_str {
                    Some(theme_str) => {
                        let pref: ThemePreference = serde_json::from_str(&theme_str)
                            .map_err(|e| act_core::error::CoreError::Internal(e.to_string()))?;
                        Ok(Some(pref))
                    }
                    None => Ok(None),
                }
            }
            None => Ok(None),
        }
    }

    async fn save_theme_preference(
        &self,
        user_id: &str,
        preference: &ThemePreference,
    ) -> Result<(), act_core::error::CoreError> {
        let theme_str = serde_json::to_string(preference)
            .map_err(|e| act_core::error::CoreError::Internal(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO user_settings (user_id, theme)
            VALUES (?1, ?2)
            ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme
            "#,
        )
        .bind(user_id)
        .bind(theme_str)
        .execute(&self.pool)
        .await
        .map_err(PersistenceError::DatabaseConnection)?;

        Ok(())
    }
}

impl Clone for SqlThemeRepository {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
        }
    }
}
