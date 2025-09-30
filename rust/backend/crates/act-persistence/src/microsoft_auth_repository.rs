use async_trait::async_trait;
use sqlx::{SqlitePool, Row};
use tracing::{debug, error, info};

use super::error::PersistenceError;
use act_domain::{
    MicrosoftAuthRepository, MicrosoftAuthData, WorkspaceTodoMapping, MicrosoftAuthRepositoryError,
    microsoft_auth_types::{MicrosoftTask, TaskSyncMetadata, TaskSyncStatus, TaskStatus, TaskImportance, OAuthState}
};

macro_rules! handle_db_error {
    ($expr:expr) => {
        $expr.await.map_err(|e| convert_persistence_error(PersistenceError::DatabaseConnection(e)))?
    };
}

fn convert_persistence_error(e: PersistenceError) -> MicrosoftAuthRepositoryError {
    match e {
        PersistenceError::DatabaseConnection(msg) => MicrosoftAuthRepositoryError::Connection(msg.to_string()),
        PersistenceError::WorkspaceNotFound(msg) | PersistenceError::SessionNotFound(msg) => {
            MicrosoftAuthRepositoryError::NotFound(msg)
        },
        _ => MicrosoftAuthRepositoryError::Database(e.to_string()),
    }
}

/// SQLite implementation of MicrosoftAuthRepository
#[derive(Clone)]
pub struct SqlMicrosoftAuthRepository {
    pool: SqlitePool,
}

impl SqlMicrosoftAuthRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MicrosoftAuthRepository for SqlMicrosoftAuthRepository {
    async fn store_auth_tokens(
        &self,
        user_id: &str,
        access_token_encrypted: &[u8],
        refresh_token_encrypted: &[u8],
        token_expires_at: i64,
        microsoft_user_id: Option<&str>,
        microsoft_email: Option<&str>,
    ) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Storing Microsoft auth tokens for user: {}", user_id);

        let now = chrono::Utc::now().timestamp();

        handle_db_error!(
            sqlx::query(
                r#"
                INSERT INTO user_microsoft_auth (
                    user_id, access_token_encrypted, refresh_token_encrypted,
                    token_expires_at, microsoft_user_id, microsoft_email,
                    created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                ON CONFLICT(user_id) DO UPDATE SET
                    access_token_encrypted = excluded.access_token_encrypted,
                    refresh_token_encrypted = excluded.refresh_token_encrypted,
                    token_expires_at = excluded.token_expires_at,
                    microsoft_user_id = excluded.microsoft_user_id,
                    microsoft_email = excluded.microsoft_email,
                    updated_at = excluded.updated_at
                "#
            )
            .bind(user_id)
            .bind(access_token_encrypted)
            .bind(refresh_token_encrypted)
            .bind(token_expires_at)
            .bind(microsoft_user_id)
            .bind(microsoft_email)
            .bind(now)
            .bind(now)
            .execute(&self.pool)
        );

        info!("Microsoft auth tokens stored for user: {}", user_id);
        Ok(())
    }

    async fn get_auth_data(&self, user_id: &str) -> Result<Option<MicrosoftAuthData>, MicrosoftAuthRepositoryError> {
        debug!("Fetching Microsoft auth data for user: {}", user_id);

        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT user_id, access_token_encrypted, refresh_token_encrypted,
                       token_expires_at, microsoft_user_id, microsoft_email,
                       created_at, updated_at
                FROM user_microsoft_auth
                WHERE user_id = ?1
                "#
            )
            .bind(user_id)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => {
                let auth_data = MicrosoftAuthData {
                    user_id: row.get("user_id"),
                    access_token_encrypted: row.get("access_token_encrypted"),
                    refresh_token_encrypted: row.get("refresh_token_encrypted"),
                    token_expires_at: row.get("token_expires_at"),
                    microsoft_user_id: row.get("microsoft_user_id"),
                    microsoft_email: row.get("microsoft_email"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                };

                debug!("Microsoft auth data found for user: {}", user_id);
                Ok(Some(auth_data))
            }
            None => {
                debug!("No Microsoft auth data found for user: {}", user_id);
                Ok(None)
            }
        }
    }

    async fn update_access_token(
        &self,
        user_id: &str,
        access_token_encrypted: &[u8],
        token_expires_at: i64,
    ) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Updating access token for user: {}", user_id);

        let now = chrono::Utc::now().timestamp();

        let rows_affected = handle_db_error!(
            sqlx::query(
                r#"
                UPDATE user_microsoft_auth
                SET access_token_encrypted = ?1,
                    token_expires_at = ?2,
                    updated_at = ?3
                WHERE user_id = ?4
                "#
            )
            .bind(access_token_encrypted)
            .bind(token_expires_at)
            .bind(now)
            .bind(user_id)
            .execute(&self.pool)
        ).rows_affected();

        if rows_affected == 0 {
            error!("No Microsoft auth found to update for user: {}", user_id);
            return Err(MicrosoftAuthRepositoryError::NotFound("Microsoft auth not found".to_string()));
        }

        debug!("Access token updated for user: {}", user_id);
        Ok(())
    }

    async fn remove_auth(&self, user_id: &str) -> Result<(), MicrosoftAuthRepositoryError> {
        info!("Removing Microsoft auth for user: {}", user_id);

        let rows_affected = handle_db_error!(
            sqlx::query("DELETE FROM user_microsoft_auth WHERE user_id = ?1")
                .bind(user_id)
                .execute(&self.pool)
        ).rows_affected();

        if rows_affected == 0 {
            debug!("No Microsoft auth found to remove for user: {}", user_id);
        } else {
            info!("Microsoft auth removed for user: {}", user_id);
        }

        Ok(())
    }

    async fn get_users_with_expiring_tokens(&self, expires_before: i64) -> Result<Vec<String>, MicrosoftAuthRepositoryError> {
        debug!("Finding users with tokens expiring before: {}", expires_before);

        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT user_id
                FROM user_microsoft_auth
                WHERE token_expires_at < ?1
                "#
            )
            .bind(expires_before)
            .fetch_all(&self.pool)
        );

        let user_ids: Vec<String> = rows.into_iter()
            .map(|row| row.get("user_id"))
            .collect();

        debug!("Found {} users with expiring tokens", user_ids.len());
        Ok(user_ids)
    }

    async fn store_workspace_mapping(
        &self,
        workspace_id: &str,
        microsoft_list_id: &str,
        list_name: &str,
    ) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Storing workspace mapping: {} -> {}", workspace_id, microsoft_list_id);

        let now = chrono::Utc::now().timestamp();

        handle_db_error!(
            sqlx::query(
                r#"
                INSERT INTO workspace_todo_mappings (
                    workspace_id, microsoft_list_id, list_name, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5)
                ON CONFLICT(workspace_id) DO UPDATE SET
                    microsoft_list_id = excluded.microsoft_list_id,
                    list_name = excluded.list_name,
                    updated_at = excluded.updated_at
                "#
            )
            .bind(workspace_id)
            .bind(microsoft_list_id)
            .bind(list_name)
            .bind(now)
            .bind(now)
            .execute(&self.pool)
        );

        info!("Workspace mapping stored: {} -> {}", workspace_id, microsoft_list_id);
        Ok(())
    }

    async fn get_workspace_list_id(&self, workspace_id: &str) -> Result<Option<String>, MicrosoftAuthRepositoryError> {
        debug!("Getting Microsoft list ID for workspace: {}", workspace_id);

        let row = handle_db_error!(
            sqlx::query(
                "SELECT microsoft_list_id FROM workspace_todo_mappings WHERE workspace_id = ?1"
            )
            .bind(workspace_id)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => {
                let list_id: String = row.get("microsoft_list_id");
                debug!("Found list ID {} for workspace {}", list_id, workspace_id);
                Ok(Some(list_id))
            }
            None => {
                debug!("No list ID found for workspace: {}", workspace_id);
                Ok(None)
            }
        }
    }

    async fn get_all_workspace_mappings(&self) -> Result<Vec<WorkspaceTodoMapping>, MicrosoftAuthRepositoryError> {
        debug!("Fetching all workspace mappings");

        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT workspace_id, microsoft_list_id, list_name, created_at, updated_at
                FROM workspace_todo_mappings
                ORDER BY created_at DESC
                "#
            )
            .fetch_all(&self.pool)
        );

        let mappings: Vec<WorkspaceTodoMapping> = rows.into_iter()
            .map(|row| WorkspaceTodoMapping {
                workspace_id: row.get("workspace_id"),
                microsoft_list_id: row.get("microsoft_list_id"),
                list_name: row.get("list_name"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        debug!("Retrieved {} workspace mappings", mappings.len());
        Ok(mappings)
    }

    async fn remove_workspace_mapping(&self, workspace_id: &str) -> Result<(), MicrosoftAuthRepositoryError> {
        info!("Removing workspace mapping for: {}", workspace_id);

        let rows_affected = handle_db_error!(
            sqlx::query("DELETE FROM workspace_todo_mappings WHERE workspace_id = ?1")
                .bind(workspace_id)
                .execute(&self.pool)
        ).rows_affected();

        if rows_affected == 0 {
            debug!("No workspace mapping found to remove for: {}", workspace_id);
        } else {
            info!("Workspace mapping removed for: {}", workspace_id);
        }

        Ok(())
    }

    // Task synchronization methods

    async fn upsert_task(&self, task: &MicrosoftTask) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Upserting task: {} for workspace: {}", task.id, task.workspace_id);

        let now = chrono::Utc::now().timestamp();

        handle_db_error!(
            sqlx::query(
                r#"
                INSERT OR REPLACE INTO microsoft_tasks (
                    id, workspace_id, microsoft_list_id, title, body_content, content_type,
                    status, importance, is_reminder_on, reminder_date_time, created_date_time,
                    due_date_time, completed_date_time, last_modified_date_time, sync_status,
                    local_last_modified, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
                "#
            )
            .bind(&task.id)
            .bind(&task.workspace_id)
            .bind(&task.microsoft_list_id)
            .bind(&task.title)
            .bind(&task.body_content)
            .bind(&task.content_type)
            .bind(self.task_status_to_string(&task.status))
            .bind(self.task_importance_to_string(&task.importance))
            .bind(task.is_reminder_on)
            .bind(task.reminder_date_time)
            .bind(task.created_date_time)
            .bind(task.due_date_time)
            .bind(task.completed_date_time)
            .bind(task.last_modified_date_time)
            .bind(self.task_sync_status_to_string(&task.sync_status))
            .bind(task.local_last_modified)
            .bind(task.created_at)
            .bind(now)  // updated_at
            .execute(&self.pool)
        );

        debug!("Task upserted successfully: {}", task.id);
        Ok(())
    }

    async fn get_workspace_tasks(&self, workspace_id: &str) -> Result<Vec<MicrosoftTask>, MicrosoftAuthRepositoryError> {
        debug!("Fetching tasks for workspace: {}", workspace_id);

        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT
                    id, workspace_id, microsoft_list_id, title, body_content, content_type,
                    status, importance, is_reminder_on, reminder_date_time, created_date_time,
                    due_date_time, completed_date_time, last_modified_date_time, sync_status,
                    local_last_modified, created_at, updated_at
                FROM microsoft_tasks
                WHERE workspace_id = ?1
                ORDER BY last_modified_date_time DESC
                "#
            )
            .bind(workspace_id)
            .fetch_all(&self.pool)
        );

        let tasks: Vec<MicrosoftTask> = rows.into_iter()
            .map(|row| MicrosoftTask {
                id: row.get("id"),
                workspace_id: row.get("workspace_id"),
                microsoft_list_id: row.get("microsoft_list_id"),
                title: row.get("title"),
                body_content: row.get("body_content"),
                content_type: row.get("content_type"),
                status: self.string_to_task_status(row.get("status")),
                importance: self.string_to_task_importance(row.get("importance")),
                is_reminder_on: row.get("is_reminder_on"),
                reminder_date_time: row.get("reminder_date_time"),
                created_date_time: row.get("created_date_time"),
                due_date_time: row.get("due_date_time"),
                completed_date_time: row.get("completed_date_time"),
                last_modified_date_time: row.get("last_modified_date_time"),
                sync_status: self.string_to_task_sync_status(row.get("sync_status")),
                local_last_modified: row.get("local_last_modified"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        debug!("Retrieved {} tasks for workspace: {}", tasks.len(), workspace_id);
        Ok(tasks)
    }

    async fn get_pending_tasks(&self, workspace_id: Option<&str>) -> Result<Vec<MicrosoftTask>, MicrosoftAuthRepositoryError> {
        debug!("Fetching pending tasks for workspace: {:?}", workspace_id);

        let query = if let Some(wid) = workspace_id {
            sqlx::query(
                r#"
                SELECT
                    id, workspace_id, microsoft_list_id, title, body_content, content_type,
                    status, importance, is_reminder_on, reminder_date_time, created_date_time,
                    due_date_time, completed_date_time, last_modified_date_time, sync_status,
                    local_last_modified, created_at, updated_at
                FROM microsoft_tasks
                WHERE workspace_id = ?1 AND sync_status != 'synced'
                ORDER BY local_last_modified ASC
                "#
            )
            .bind(wid)
        } else {
            sqlx::query(
                r#"
                SELECT
                    id, workspace_id, microsoft_list_id, title, body_content, content_type,
                    status, importance, is_reminder_on, reminder_date_time, created_date_time,
                    due_date_time, completed_date_time, last_modified_date_time, sync_status,
                    local_last_modified, created_at, updated_at
                FROM microsoft_tasks
                WHERE sync_status != 'synced'
                ORDER BY local_last_modified ASC
                "#
            )
        };

        let rows = handle_db_error!(query.fetch_all(&self.pool));

        let tasks: Vec<MicrosoftTask> = rows.into_iter()
            .map(|row| MicrosoftTask {
                id: row.get("id"),
                workspace_id: row.get("workspace_id"),
                microsoft_list_id: row.get("microsoft_list_id"),
                title: row.get("title"),
                body_content: row.get("body_content"),
                content_type: row.get("content_type"),
                status: self.string_to_task_status(row.get("status")),
                importance: self.string_to_task_importance(row.get("importance")),
                is_reminder_on: row.get("is_reminder_on"),
                reminder_date_time: row.get("reminder_date_time"),
                created_date_time: row.get("created_date_time"),
                due_date_time: row.get("due_date_time"),
                completed_date_time: row.get("completed_date_time"),
                last_modified_date_time: row.get("last_modified_date_time"),
                sync_status: self.string_to_task_sync_status(row.get("sync_status")),
                local_last_modified: row.get("local_last_modified"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        debug!("Retrieved {} pending tasks", tasks.len());
        Ok(tasks)
    }

    async fn delete_task(&self, task_id: &str) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Deleting task: {}", task_id);

        let rows_affected = handle_db_error!(
            sqlx::query("DELETE FROM microsoft_tasks WHERE id = ?1")
                .bind(task_id)
                .execute(&self.pool)
        ).rows_affected();

        if rows_affected == 0 {
            debug!("No task found to delete: {}", task_id);
        } else {
            debug!("Task deleted: {}", task_id);
        }

        Ok(())
    }

    async fn update_task_sync_status(&self, task_id: &str, status: TaskSyncStatus) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Updating task {} sync status to: {:?}", task_id, status);

        let now = chrono::Utc::now().timestamp();

        let rows_affected = handle_db_error!(
            sqlx::query("UPDATE microsoft_tasks SET sync_status = ?1, local_last_modified = ?2, updated_at = ?3 WHERE id = ?4")
                .bind(self.task_sync_status_to_string(&status))
                .bind(now)
                .bind(now)
                .bind(task_id)
                .execute(&self.pool)
        ).rows_affected();

        if rows_affected == 0 {
            debug!("No task found to update sync status: {}", task_id);
        } else {
            debug!("Task sync status updated: {} -> {:?}", task_id, status);
        }

        Ok(())
    }

    async fn get_task_sync_metadata(&self, workspace_id: &str) -> Result<Option<TaskSyncMetadata>, MicrosoftAuthRepositoryError> {
        debug!("Fetching task sync metadata for workspace: {}", workspace_id);

        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT
                    workspace_id, microsoft_list_id, last_sync_timestamp, last_successful_sync,
                    sync_version, sync_errors, max_sync_errors, last_sync_error, next_sync_attempt,
                    sync_interval_seconds, is_sync_enabled, created_at, updated_at
                FROM task_sync_metadata
                WHERE workspace_id = ?1
                "#
            )
            .bind(workspace_id)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => {
                let metadata = TaskSyncMetadata {
                    workspace_id: row.get("workspace_id"),
                    microsoft_list_id: row.get("microsoft_list_id"),
                    last_sync_timestamp: row.get("last_sync_timestamp"),
                    last_successful_sync: row.get("last_successful_sync"),
                    sync_version: row.get("sync_version"),
                    sync_errors: row.get("sync_errors"),
                    max_sync_errors: row.get("max_sync_errors"),
                    last_sync_error: row.get("last_sync_error"),
                    next_sync_attempt: row.get("next_sync_attempt"),
                    sync_interval_seconds: row.get("sync_interval_seconds"),
                    is_sync_enabled: row.get("is_sync_enabled"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                };
                debug!("Retrieved sync metadata for workspace: {}", workspace_id);
                Ok(Some(metadata))
            }
            None => {
                debug!("No sync metadata found for workspace: {}", workspace_id);
                Ok(None)
            }
        }
    }

    async fn upsert_task_sync_metadata(&self, metadata: &TaskSyncMetadata) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Upserting sync metadata for workspace: {}", metadata.workspace_id);

        let now = chrono::Utc::now().timestamp();

        handle_db_error!(
            sqlx::query(
                r#"
                INSERT OR REPLACE INTO task_sync_metadata (
                    workspace_id, microsoft_list_id, last_sync_timestamp, last_successful_sync,
                    sync_version, sync_errors, max_sync_errors, last_sync_error, next_sync_attempt,
                    sync_interval_seconds, is_sync_enabled, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                    COALESCE((SELECT created_at FROM task_sync_metadata WHERE workspace_id = ?1), ?12), ?13)
                "#
            )
            .bind(&metadata.workspace_id)
            .bind(&metadata.microsoft_list_id)
            .bind(metadata.last_sync_timestamp)
            .bind(metadata.last_successful_sync)
            .bind(&metadata.sync_version)
            .bind(metadata.sync_errors)
            .bind(metadata.max_sync_errors)
            .bind(&metadata.last_sync_error)
            .bind(metadata.next_sync_attempt)
            .bind(metadata.sync_interval_seconds)
            .bind(metadata.is_sync_enabled)
            .bind(now)  // created_at if new
            .bind(now)  // updated_at
            .execute(&self.pool)
        );

        debug!("Sync metadata upserted for workspace: {}", metadata.workspace_id);
        Ok(())
    }

    async fn get_workspaces_needing_sync(&self, before_timestamp: i64) -> Result<Vec<TaskSyncMetadata>, MicrosoftAuthRepositoryError> {
        debug!("Fetching workspaces needing sync before: {}", before_timestamp);

        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT
                    workspace_id, microsoft_list_id, last_sync_timestamp, last_successful_sync,
                    sync_version, sync_errors, max_sync_errors, last_sync_error, next_sync_attempt,
                    sync_interval_seconds, is_sync_enabled, created_at, updated_at
                FROM task_sync_metadata
                WHERE is_sync_enabled = TRUE
                    AND (next_sync_attempt IS NULL OR next_sync_attempt <= ?1)
                ORDER BY next_sync_attempt ASC NULLS FIRST
                "#
            )
            .bind(before_timestamp)
            .fetch_all(&self.pool)
        );

        let workspaces: Vec<TaskSyncMetadata> = rows.into_iter()
            .map(|row| TaskSyncMetadata {
                workspace_id: row.get("workspace_id"),
                microsoft_list_id: row.get("microsoft_list_id"),
                last_sync_timestamp: row.get("last_sync_timestamp"),
                last_successful_sync: row.get("last_successful_sync"),
                sync_version: row.get("sync_version"),
                sync_errors: row.get("sync_errors"),
                max_sync_errors: row.get("max_sync_errors"),
                last_sync_error: row.get("last_sync_error"),
                next_sync_attempt: row.get("next_sync_attempt"),
                sync_interval_seconds: row.get("sync_interval_seconds"),
                is_sync_enabled: row.get("is_sync_enabled"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        debug!("Found {} workspaces needing sync", workspaces.len());
        Ok(workspaces)
    }

    async fn delete_workspace_tasks(&self, workspace_id: &str) -> Result<(), MicrosoftAuthRepositoryError> {
        info!("Deleting all tasks for workspace: {}", workspace_id);

        let rows_affected = handle_db_error!(
            sqlx::query("DELETE FROM microsoft_tasks WHERE workspace_id = ?1")
                .bind(workspace_id)
                .execute(&self.pool)
        ).rows_affected();

        info!("Deleted {} tasks for workspace: {}", rows_affected, workspace_id);
        Ok(())
    }

    // OAuth state management methods

    async fn store_oauth_state(&self, oauth_state: &OAuthState) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Storing OAuth state for user: {}", oauth_state.user_id);

        handle_db_error!(
            sqlx::query(
                r#"
                INSERT INTO oauth_states (state, user_id, code_verifier, created_at, expires_at)
                VALUES (?1, ?2, ?3, ?4, ?5)
                ON CONFLICT(state) DO UPDATE SET
                    user_id = excluded.user_id,
                    code_verifier = excluded.code_verifier,
                    created_at = excluded.created_at,
                    expires_at = excluded.expires_at
                "#
            )
            .bind(&oauth_state.state)
            .bind(&oauth_state.user_id)
            .bind(&oauth_state.code_verifier)
            .bind(oauth_state.created_at)
            .bind(oauth_state.expires_at)
            .execute(&self.pool)
        );

        debug!("OAuth state stored successfully");
        Ok(())
    }

    async fn get_oauth_state(&self, state: &str) -> Result<Option<OAuthState>, MicrosoftAuthRepositoryError> {
        debug!("Retrieving OAuth state: {}", state);

        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT state, user_id, code_verifier, created_at, expires_at
                FROM oauth_states
                WHERE state = ?1
                "#
            )
            .bind(state)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => {
                let oauth_state = OAuthState {
                    state: row.get("state"),
                    user_id: row.get("user_id"),
                    code_verifier: row.get("code_verifier"),
                    created_at: row.get("created_at"),
                    expires_at: row.get("expires_at"),
                };
                debug!("OAuth state found for state: {}", state);
                Ok(Some(oauth_state))
            }
            None => {
                debug!("No OAuth state found for state: {}", state);
                Ok(None)
            }
        }
    }

    async fn remove_oauth_state(&self, state: &str) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Removing OAuth state: {}", state);

        handle_db_error!(
            sqlx::query("DELETE FROM oauth_states WHERE state = ?1")
                .bind(state)
                .execute(&self.pool)
        );

        debug!("OAuth state removed successfully");
        Ok(())
    }

    async fn cleanup_expired_oauth_states(&self) -> Result<usize, MicrosoftAuthRepositoryError> {
        let now = chrono::Utc::now().timestamp();
        debug!("Cleaning up expired OAuth states (before: {})", now);

        let result = handle_db_error!(
            sqlx::query("DELETE FROM oauth_states WHERE expires_at < ?1")
                .bind(now)
                .execute(&self.pool)
        );

        let removed = result.rows_affected() as usize;
        info!("Cleaned up {} expired OAuth states", removed);
        Ok(removed)
    }

    async fn acquire_token_refresh_lock(&self, user_id: &str, timeout_seconds: i64) -> Result<bool, MicrosoftAuthRepositoryError> {
        let now = chrono::Utc::now().timestamp();
        let expires_at = now + timeout_seconds;

        debug!("Attempting to acquire token refresh lock for user: {} (timeout: {}s)", user_id, timeout_seconds);

        // First, clean up any expired locks
        let _ = handle_db_error!(
            sqlx::query("DELETE FROM token_refresh_locks WHERE expires_at < ?1")
                .bind(now)
                .execute(&self.pool)
        );

        // Try to insert a new lock using INSERT OR IGNORE (SQLite specific)
        let result = handle_db_error!(
            sqlx::query(
                "INSERT OR IGNORE INTO token_refresh_locks (user_id, acquired_at, expires_at)
                 VALUES (?1, ?2, ?3)"
            )
            .bind(user_id)
            .bind(now)
            .bind(expires_at)
            .execute(&self.pool)
        );

        let lock_acquired = result.rows_affected() > 0;

        if lock_acquired {
            debug!("Successfully acquired token refresh lock for user: {}", user_id);
        } else {
            debug!("Failed to acquire token refresh lock for user: {} (lock already held)", user_id);
        }

        Ok(lock_acquired)
    }

    async fn release_token_refresh_lock(&self, user_id: &str) -> Result<(), MicrosoftAuthRepositoryError> {
        debug!("Releasing token refresh lock for user: {}", user_id);

        handle_db_error!(
            sqlx::query("DELETE FROM token_refresh_locks WHERE user_id = ?1")
                .bind(user_id)
                .execute(&self.pool)
        );

        debug!("Token refresh lock released for user: {}", user_id);
        Ok(())
    }

    // Helper functions for enum conversion to/from strings
    fn task_status_to_string(&self, status: &TaskStatus) -> String {
        match status {
            TaskStatus::NotStarted => "notStarted".to_string(),
            TaskStatus::InProgress => "inProgress".to_string(),
            TaskStatus::Completed => "completed".to_string(),
            TaskStatus::WaitingOnOthers => "waitingOnOthers".to_string(),
            TaskStatus::Deferred => "deferred".to_string(),
        }
    }

    fn task_importance_to_string(&self, importance: &TaskImportance) -> String {
        match importance {
            TaskImportance::Low => "low".to_string(),
            TaskImportance::Normal => "normal".to_string(),
            TaskImportance::High => "high".to_string(),
        }
    }

    fn task_sync_status_to_string(&self, status: &TaskSyncStatus) -> String {
        match status {
            TaskSyncStatus::Synced => "synced".to_string(),
            TaskSyncStatus::PendingCreate => "pending_create".to_string(),
            TaskSyncStatus::PendingUpdate => "pending_update".to_string(),
            TaskSyncStatus::PendingDelete => "pending_delete".to_string(),
            TaskSyncStatus::Conflict => "conflict".to_string(),
        }
    }

    fn string_to_task_status(&self, s: String) -> TaskStatus {
        match s.as_str() {
            "notStarted" => TaskStatus::NotStarted,
            "inProgress" => TaskStatus::InProgress,
            "completed" => TaskStatus::Completed,
            "waitingOnOthers" => TaskStatus::WaitingOnOthers,
            "deferred" => TaskStatus::Deferred,
            _ => TaskStatus::NotStarted,
        }
    }

    fn string_to_task_importance(&self, s: String) -> TaskImportance {
        match s.as_str() {
            "low" => TaskImportance::Low,
            "high" => TaskImportance::High,
            _ => TaskImportance::Normal,
        }
    }

    fn string_to_task_sync_status(&self, s: String) -> TaskSyncStatus {
        match s.as_str() {
            "synced" => TaskSyncStatus::Synced,
            "pending_create" => TaskSyncStatus::PendingCreate,
            "pending_update" => TaskSyncStatus::PendingUpdate,
            "pending_delete" => TaskSyncStatus::PendingDelete,
            "conflict" => TaskSyncStatus::Conflict,
            _ => TaskSyncStatus::Synced,
        }
    }
}