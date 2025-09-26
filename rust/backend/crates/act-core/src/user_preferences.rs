use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use crate::error::Result;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct UserPreferences {
    pub current_workspace_id: Option<String>,

    #[serde(default)]
    pub layout_preferences: LayoutPreferences,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct LayoutPreferences {
    pub sidebar_width: u32,       // 200-400px constraint range
    pub editor_width: u32,        // 300-800px constraint range
    pub version: String,          // For future migrations/compatibility
}

impl Default for LayoutPreferences {
    fn default() -> Self {
        Self {
            sidebar_width: 250,   // Current sidebar default from CSS
            editor_width: 400,    // Current editor default from MainLayout
            version: "1.0".to_string(),
        }
    }
}

#[async_trait]
pub trait UserPreferencesRepository: Send + Sync {
    async fn get_user_preferences(&self, user_id: &str) -> Result<Option<UserPreferences>>;
    async fn save_user_preferences(&self, user_id: &str, preferences: &UserPreferences) -> Result<()>;

    // Convenience method for just updating current workspace
    async fn set_current_workspace(&self, user_id: &str, workspace_id: Option<&str>) -> Result<()>;
}