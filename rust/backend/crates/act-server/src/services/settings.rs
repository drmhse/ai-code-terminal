use act_core::Database;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tracing::{debug, info, warn};
use crate::services::GitHubService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub id: String,
    pub github_token: Option<String>,
    pub github_refresh_token: Option<String>,
    pub github_token_expires_at: Option<DateTime<Utc>>,
    pub theme: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct SettingsService {
    db: Database,
}

impl SettingsService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Get settings (single-tenant system uses singleton record)
    pub async fn get_settings(&self) -> anyhow::Result<Option<Settings>> {
        let row = sqlx::query(
            "SELECT id, github_token, github_refresh_token, github_token_expires_at, theme, created_at, updated_at 
             FROM settings WHERE id = 'singleton'"
        )
        .fetch_optional(self.db.pool())
        .await?;

        match row {
            Some(row) => {
                let theme_str: Option<String> = row.try_get("theme")?;
                let theme = if let Some(theme_str) = theme_str {
                    Some(serde_json::from_str(&theme_str)?)
                } else {
                    None
                };

                Ok(Some(Settings {
                    id: row.try_get("id")?,
                    github_token: row.try_get("github_token")?,
                    github_refresh_token: row.try_get("github_refresh_token")?,
                    github_token_expires_at: row.try_get("github_token_expires_at")?,
                    theme,
                    created_at: row.try_get("created_at")?,
                    updated_at: row.try_get("updated_at")?,
                }))
            }
            None => Ok(None)
        }
    }

    /// Get raw settings without decryption (for internal use)
    #[allow(dead_code)]
    pub async fn get_raw_settings(&self) -> anyhow::Result<Option<Settings>> {
        self.get_settings().await
    }

    /// Update GitHub tokens (encrypted)
    pub async fn update_github_tokens(
        &self, 
        github_service: &GitHubService,
        access_token: Option<&str>,
        refresh_token: Option<&str>,
        expires_at: Option<DateTime<Utc>>
    ) -> anyhow::Result<()> {
        let encrypted_access_token = if let Some(token) = access_token {
            Some(github_service.encrypt_token(token)?)
        } else {
            None
        };

        let encrypted_refresh_token = if let Some(token) = refresh_token {
            Some(github_service.encrypt_token(token)?)
        } else {
            None
        };

        // Insert or update settings
        sqlx::query(
            "INSERT INTO settings (id, github_token, github_refresh_token, github_token_expires_at, updated_at) 
             VALUES ('singleton', ?1, ?2, ?3, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                github_token = excluded.github_token,
                github_refresh_token = excluded.github_refresh_token,
                github_token_expires_at = excluded.github_token_expires_at,
                updated_at = CURRENT_TIMESTAMP"
        )
        .bind(encrypted_access_token)
        .bind(encrypted_refresh_token)
        .bind(expires_at)
        .execute(self.db.pool())
        .await?;

        if access_token.is_some() {
            info!("GitHub tokens updated successfully");
        } else {
            info!("GitHub tokens cleared");
        }

        Ok(())
    }

    /// Clear GitHub tokens
    pub async fn clear_github_tokens(&self) -> anyhow::Result<()> {
        sqlx::query(
            "UPDATE settings SET 
                github_token = NULL, 
                github_refresh_token = NULL, 
                github_token_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = 'singleton'"
        )
        .execute(self.db.pool())
        .await?;

        info!("GitHub tokens cleared");
        Ok(())
    }

    /// Get decrypted GitHub access token
    pub async fn get_github_token(&self, github_service: &GitHubService) -> anyhow::Result<Option<String>> {
        let settings = self.get_settings().await?;
        
        match settings.and_then(|s| s.github_token) {
            Some(encrypted_token) => {
                match github_service.decrypt_token(&encrypted_token) {
                    Ok(token) => Ok(Some(token)),
                    Err(e) => {
                        warn!("Failed to decrypt GitHub token: {}", e);
                        Ok(None)
                    }
                }
            }
            None => Ok(None)
        }
    }

    /// Get decrypted GitHub refresh token
    pub async fn get_github_refresh_token(&self, github_service: &GitHubService) -> anyhow::Result<Option<String>> {
        let settings = self.get_settings().await?;
        
        match settings.and_then(|s| s.github_refresh_token) {
            Some(encrypted_token) => {
                match github_service.decrypt_token(&encrypted_token) {
                    Ok(token) => Ok(Some(token)),
                    Err(e) => {
                        warn!("Failed to decrypt GitHub refresh token: {}", e);
                        Ok(None)
                    }
                }
            }
            None => Ok(None)
        }
    }

    /// Check if user is authenticated with GitHub
    pub async fn is_github_authenticated(&self) -> anyhow::Result<bool> {
        let settings = self.get_settings().await?;
        
        Ok(settings.is_some_and(|s| {
            s.github_token.is_some() && s.github_token_expires_at.is_some()
        }))
    }

    /// Check if GitHub token is expired
    pub async fn is_github_token_expired(&self) -> anyhow::Result<bool> {
        let settings = self.get_settings().await?;
        
        match settings.and_then(|s| s.github_token_expires_at) {
            Some(expires_at) => Ok(Utc::now() > expires_at),
            None => Ok(true) // No token or expiry date means expired
        }
    }

    /// Update theme preferences
    #[allow(dead_code)]
    pub async fn update_theme(&self, theme: serde_json::Value) -> anyhow::Result<()> {
        let theme_str = serde_json::to_string(&theme)?;
        
        sqlx::query(
            "INSERT INTO settings (id, theme, updated_at) 
             VALUES ('singleton', ?1, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                theme = excluded.theme,
                updated_at = CURRENT_TIMESTAMP"
        )
        .bind(theme_str)
        .execute(self.db.pool())
        .await?;

        debug!("Theme preferences updated");
        Ok(())
    }

    /// Get theme preferences
    #[allow(dead_code)]
    pub async fn get_theme(&self) -> anyhow::Result<Option<serde_json::Value>> {
        let settings = self.get_settings().await?;
        Ok(settings.and_then(|s| s.theme))
    }
}