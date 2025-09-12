use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use crate::error::Result;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct ThemePreference {
    pub theme_id: String,
    pub auto_switch: bool,
    pub system_override: bool,
    pub customizations: serde_json::Value,
}

#[async_trait]
pub trait ThemeRepository: Send + Sync {
    async fn get_theme_preference(&self, user_id: &str) -> Result<Option<ThemePreference>>;
    async fn save_theme_preference(&self, user_id: &str, preference: &ThemePreference) -> Result<()>;
}
