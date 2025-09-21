use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use crate::error::Result;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct UserPreferences {
    pub current_workspace_id: Option<String>,
}

#[async_trait]
pub trait UserPreferencesRepository: Send + Sync {
    async fn get_user_preferences(&self, user_id: &str) -> Result<Option<UserPreferences>>;
    async fn save_user_preferences(&self, user_id: &str, preferences: &UserPreferences) -> Result<()>;

    // Convenience method for just updating current workspace
    async fn set_current_workspace(&self, user_id: &str, workspace_id: Option<&str>) -> Result<()>;
}