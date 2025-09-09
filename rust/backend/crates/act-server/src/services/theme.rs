use act_core::Database;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use tracing::info;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemePreference {
    pub theme_id: String,
    pub auto_switch: bool,
    pub system_override: Option<String>,
    pub customizations: Option<serde_json::Value>,
}

pub struct ThemeService {
    database: Database,
}

impl ThemeService {
    pub fn new(database: Database) -> Self {
        Self { database }
    }

    /// Get user's theme preferences
    pub async fn get_user_preferences(&self, user_id: &str) -> Result<Option<ThemePreference>> {
        let query = r#"
            SELECT theme_id, auto_switch, system_override, customizations
            FROM user_theme_preferences 
            WHERE user_id = ?
        "#;

        let row = sqlx::query(query)
            .bind(user_id)
            .fetch_optional(self.database.pool())
            .await?;

        if let Some(row) = row {
            let system_override_bool: bool = row.get("system_override");
            let preferences = ThemePreference {
                theme_id: row.get("theme_id"),
                auto_switch: row.get("auto_switch"),
                system_override: if system_override_bool { Some("system".to_string()) } else { None },
                customizations: row.get("customizations"),
            };
            Ok(Some(preferences))
        } else {
            Ok(None)
        }
    }

    /// Save user's theme preferences
    pub async fn save_user_preferences(&self, user_id: &str, preferences: &ThemePreference) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO user_theme_preferences 
            (user_id, theme_id, auto_switch, system_override, customizations, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        "#;

        let now = chrono::Utc::now().timestamp();
        
        // Convert Option<String> to boolean for database compatibility
        let system_override_bool = preferences.system_override.is_some();

        sqlx::query(query)
            .bind(user_id)
            .bind(&preferences.theme_id)
            .bind(preferences.auto_switch)
            .bind(system_override_bool)
            .bind(&preferences.customizations)
            .bind(now)
            .execute(self.database.pool())
            .await?;

        info!("Saved theme preferences for user {}: {}", user_id, preferences.theme_id);
        Ok(())
    }

    /// Initialize theme preferences table
    #[allow(dead_code)]
    pub async fn initialize(&self) -> Result<()> {
        let query = r#"
            CREATE TABLE IF NOT EXISTS user_theme_preferences (
                user_id TEXT PRIMARY KEY,
                theme_id TEXT NOT NULL DEFAULT 'vscode-dark',
                auto_switch BOOLEAN NOT NULL DEFAULT 1,
                system_override TEXT,
                customizations TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )
        "#;

        sqlx::query(query)
            .execute(self.database.pool())
            .await?;

        info!("Theme preferences table initialized");
        Ok(())
    }

    /// Get default theme preferences
    pub fn get_default_preferences() -> ThemePreference {
        ThemePreference {
            theme_id: "vscode-dark".to_string(),
            auto_switch: true,
            system_override: None,
            customizations: None,
        }
    }
}