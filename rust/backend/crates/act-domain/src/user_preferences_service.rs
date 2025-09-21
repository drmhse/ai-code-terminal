use act_core::error::Result;
use act_core::user_preferences::{UserPreferencesRepository, UserPreferences};
use std::sync::Arc;

pub struct UserPreferencesService {
    user_preferences_repo: Arc<dyn UserPreferencesRepository>,
}

impl UserPreferencesService {
    pub fn new(user_preferences_repo: Arc<dyn UserPreferencesRepository>) -> Self {
        Self { user_preferences_repo }
    }

    pub async fn get_user_preferences(&self, user_id: &str) -> Result<Option<UserPreferences>> {
        self.user_preferences_repo.get_user_preferences(user_id).await
    }

    pub async fn save_user_preferences(&self, user_id: &str, preferences: &UserPreferences) -> Result<()> {
        self.user_preferences_repo.save_user_preferences(user_id, preferences).await
    }

    pub async fn get_current_workspace(&self, user_id: &str) -> Result<Option<String>> {
        let preferences = self.get_user_preferences(user_id).await?;
        Ok(preferences.and_then(|p| p.current_workspace_id))
    }

    pub async fn set_current_workspace(&self, user_id: &str, workspace_id: Option<&str>) -> Result<()> {
        self.user_preferences_repo.set_current_workspace(user_id, workspace_id).await
    }
}