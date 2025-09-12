use act_core::error::Result;
use act_core::theme::{ThemeRepository, ThemePreference};
use std::sync::Arc;

pub struct ThemeService {
    theme_repo: Arc<dyn ThemeRepository>,
}

impl ThemeService {
    pub fn new(theme_repo: Arc<dyn ThemeRepository>) -> Self {
        Self { theme_repo }
    }

    pub async fn get_theme_preference(&self, user_id: &str) -> Result<Option<ThemePreference>> {
        self.theme_repo.get_theme_preference(user_id).await
    }

    pub async fn save_theme_preference(&self, user_id: &str, preference: &ThemePreference) -> Result<()> {
        self.theme_repo.save_theme_preference(user_id, preference).await
    }
}
