use async_trait::async_trait;
use thiserror::Error;
use serde::{Serialize, Deserialize};

/// Errors that can occur in Microsoft auth repository operations
#[derive(Debug, Error)]
pub enum MicrosoftAuthRepositoryError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Resource not found: {0}")]
    NotFound(String),
    #[error("Connection error: {0}")]
    Connection(String),
}

/// Microsoft authentication data for a user
#[derive(Debug, Clone)]
pub struct MicrosoftAuthData {
    pub user_id: String,
    pub access_token_encrypted: Vec<u8>,
    pub refresh_token_encrypted: Vec<u8>,
    pub token_expires_at: i64,
    pub microsoft_user_id: Option<String>,
    pub microsoft_email: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Workspace to Microsoft To Do list mapping
#[derive(Debug, Clone)]
pub struct WorkspaceTodoMapping {
    pub workspace_id: String,
    pub microsoft_list_id: String,
    pub list_name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Microsoft To Do task with workspace context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrosoftTask {
    pub id: String,
    pub workspace_id: String,
    pub microsoft_list_id: String,
    pub title: String,
    pub body_content: Option<String>,
    pub content_type: Option<String>,
    pub status: TaskStatus,
    pub importance: TaskImportance,
    pub is_reminder_on: bool,
    pub reminder_date_time: Option<i64>,
    pub created_date_time: Option<i64>,
    pub due_date_time: Option<i64>,
    pub completed_date_time: Option<i64>,
    pub last_modified_date_time: i64,
    pub sync_status: TaskSyncStatus,
    pub local_last_modified: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Task status from Microsoft To Do API
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
    NotStarted,
    InProgress,
    Completed,
    WaitingOnOthers,
    Deferred,
}

/// Task importance/priority level
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TaskImportance {
    Low,
    Normal,
    High,
}

/// Synchronization status for local tasks
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TaskSyncStatus {
    Synced,
    PendingCreate,
    PendingUpdate,
    PendingDelete,
    Conflict,
}

/// Task synchronization metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSyncMetadata {
    pub workspace_id: String,
    pub microsoft_list_id: String,
    pub last_sync_timestamp: i64,
    pub sync_version: String,
    pub sync_errors: i32,
    pub last_sync_error: Option<String>,
    pub next_sync_attempt: Option<i64>,
    pub sync_interval_seconds: i32,
    pub is_sync_enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Task synchronization statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSyncStats {
    pub total_tasks: usize,
    pub synced_tasks: usize,
    pub pending_changes: usize,
    pub conflicts: usize,
    pub last_sync: Option<i64>,
    pub next_sync: Option<i64>,
}

/// Repository trait for Microsoft authentication and To Do integration
#[async_trait]
pub trait MicrosoftAuthRepository: Send + Sync {
    /// Store or update Microsoft auth tokens for a user
    async fn store_auth_tokens(
        &self,
        user_id: &str,
        access_token_encrypted: &[u8],
        refresh_token_encrypted: &[u8],
        token_expires_at: i64,
        microsoft_user_id: Option<&str>,
        microsoft_email: Option<&str>,
    ) -> Result<(), MicrosoftAuthRepositoryError>;

    /// Get Microsoft auth data for a user
    async fn get_auth_data(&self, user_id: &str) -> Result<Option<MicrosoftAuthData>, MicrosoftAuthRepositoryError>;

    /// Update access token and expiry (for token refresh)
    async fn update_access_token(
        &self,
        user_id: &str,
        access_token_encrypted: &[u8],
        token_expires_at: i64,
    ) -> Result<(), MicrosoftAuthRepositoryError>;

    /// Remove Microsoft auth for a user (disconnect)
    async fn remove_auth(&self, user_id: &str) -> Result<(), MicrosoftAuthRepositoryError>;

    /// Get all users with expiring tokens (for proactive refresh)
    async fn get_users_with_expiring_tokens(&self, expires_before: i64) -> Result<Vec<String>, MicrosoftAuthRepositoryError>;

    /// Store workspace to Microsoft list mapping
    async fn store_workspace_mapping(
        &self,
        workspace_id: &str,
        microsoft_list_id: &str,
        list_name: &str,
    ) -> Result<(), MicrosoftAuthRepositoryError>;

    /// Get Microsoft list ID for a workspace
    async fn get_workspace_list_id(&self, workspace_id: &str) -> Result<Option<String>, MicrosoftAuthRepositoryError>;

    /// Get all workspace mappings for cleanup/sync
    async fn get_all_workspace_mappings(&self) -> Result<Vec<WorkspaceTodoMapping>, MicrosoftAuthRepositoryError>;

    /// Remove workspace mapping (when workspace is deleted)
    async fn remove_workspace_mapping(&self, workspace_id: &str) -> Result<(), MicrosoftAuthRepositoryError>;

    // Task synchronization methods

    /// Store or update a task from Microsoft To Do
    async fn upsert_task(&self, task: &MicrosoftTask) -> Result<(), MicrosoftAuthRepositoryError>;

    /// Get all tasks for a workspace
    async fn get_workspace_tasks(&self, workspace_id: &str) -> Result<Vec<MicrosoftTask>, MicrosoftAuthRepositoryError>;

    /// Get tasks pending synchronization
    async fn get_pending_tasks(&self, workspace_id: Option<&str>) -> Result<Vec<MicrosoftTask>, MicrosoftAuthRepositoryError>;

    /// Delete a task locally
    async fn delete_task(&self, task_id: &str) -> Result<(), MicrosoftAuthRepositoryError>;

    /// Update task sync status
    async fn update_task_sync_status(&self, task_id: &str, status: TaskSyncStatus) -> Result<(), MicrosoftAuthRepositoryError>;

    /// Get task synchronization metadata
    async fn get_task_sync_metadata(&self, workspace_id: &str) -> Result<Option<TaskSyncMetadata>, MicrosoftAuthRepositoryError>;

    /// Update task synchronization metadata
    async fn upsert_task_sync_metadata(&self, metadata: &TaskSyncMetadata) -> Result<(), MicrosoftAuthRepositoryError>;

    /// Get workspaces needing sync
    async fn get_workspaces_needing_sync(&self, before_timestamp: i64) -> Result<Vec<TaskSyncMetadata>, MicrosoftAuthRepositoryError>;

    /// Delete all tasks for a workspace (cleanup)
    async fn delete_workspace_tasks(&self, workspace_id: &str) -> Result<(), MicrosoftAuthRepositoryError>;

    // Helper methods for enum conversion
    fn task_status_to_string(&self, status: &TaskStatus) -> String;
    fn task_importance_to_string(&self, importance: &TaskImportance) -> String;
    fn task_sync_status_to_string(&self, status: &TaskSyncStatus) -> String;
    fn string_to_task_status(&self, s: String) -> TaskStatus;
    fn string_to_task_importance(&self, s: String) -> TaskImportance;
    fn string_to_task_sync_status(&self, s: String) -> TaskSyncStatus;
}