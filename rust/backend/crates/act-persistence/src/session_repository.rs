use act_core::repository::{SessionRepository, CreateSessionRequest, UpdateSessionRequest, SessionStatus};
use async_trait::async_trait;
use sqlx::SqlitePool;
use sqlx::Row;
use chrono::Utc;

use super::error::PersistenceError;

macro_rules! handle_db_error {
    ($expr:expr) => {
        $expr.await.map_err(|e| PersistenceError::DatabaseConnection(e))?
    };
}

pub struct SqlSessionRepository {
    pool: SqlitePool,
}

impl SqlSessionRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    fn parse_session_status(s: &str) -> SessionStatus {
        match s {
            "active" => SessionStatus::Active,
            "inactive" => SessionStatus::Inactive,
            "terminated" => SessionStatus::Terminated,
            "error" => SessionStatus::Error("error status".to_string()),
            _ => SessionStatus::Active,
        }
    }

    async fn map_row_to_session(row: sqlx::sqlite::SqliteRow) -> Result<act_core::repository::Session, PersistenceError> {
        let env_vars_json: Option<String> = row.get("environment_vars");
        let environment_vars = env_vars_json
            .map(|json| serde_json::from_str(&json))
            .transpose()?;

        let history_json: Option<String> = row.get("shell_history");
        let shell_history = history_json
            .map(|json| serde_json::from_str(&json))
            .transpose()?;

        let size_json: Option<String> = row.get("terminal_size");
        let terminal_size = size_json
            .map(|json| serde_json::from_str(&json))
            .transpose()?;

        Ok(act_core::repository::Session {
            id: row.get("id"),
            shell_pid: row.get("shell_pid"),
            socket_id: row.get("socket_id"),
            status: Self::parse_session_status(row.get("status")),
            last_activity_at: row.get("last_activity_at"),
            created_at: row.get("created_at"),
            ended_at: row.get("ended_at"),
            session_name: row.get("session_name"),
            session_type: act_core::repository::SessionType::Terminal, // Default for now
            is_default_session: row.get("is_default_session"),
            current_working_dir: row.get("current_working_dir"),
            environment_vars,
            shell_history,
            terminal_size,
            last_command: row.get("last_command"),
            session_timeout: row.get("session_timeout"),
            recovery_token: row.get("recovery_token"),
            can_recover: row.get("can_recover"),
            max_idle_time: row.get("max_idle_time"),
            auto_cleanup: row.get("auto_cleanup"),
            layout_id: row.get("layout_id"),
            workspace_id: row.get("workspace_id"),
            user_id: row.get("user_id"),
        })
    }
}

#[async_trait]
impl SessionRepository for SqlSessionRepository {
    async fn create(&self, user_id: &str, request: CreateSessionRequest) -> Result<act_core::repository::Session, act_core::error::CoreError> {
        let session_id = request.session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let now = Utc::now();

        let size_json = if let Some(size) = &request.terminal_size {
            Some(serde_json::to_string(size)?)
        } else {
            None
        };

        let row = handle_db_error!(
            sqlx::query(
                r#"
                INSERT INTO sessions (id, session_name, session_type, workspace_id, terminal_size, status, 
                                     last_activity_at, created_at, is_default_session, can_recover, 
                                     max_idle_time, auto_cleanup, user_id)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                RETURNING id, shell_pid, socket_id, status, last_activity_at, created_at, ended_at,
                          session_name, session_type, is_default_session, current_working_dir,
                          environment_vars, shell_history, terminal_size, last_command, session_timeout,
                          recovery_token, can_recover, max_idle_time, auto_cleanup, layout_id, workspace_id, user_id
                "#
            )
            .bind(&session_id)
            .bind(&request.session_name)
            .bind("terminal") // Default session type
            .bind(&request.workspace_id)
            .bind(size_json)
            .bind("active")
            .bind(now)
            .bind(now)
            .bind(false)
            .bind(true)
            .bind(1440) // 24 hours
            .bind(true)
            .bind(user_id)
            .fetch_one(&self.pool)
        );

        Self::map_row_to_session(row).await.map_err(Into::into)
    }

    async fn get_by_id(&self, user_id: &str, id: &String) -> Result<act_core::repository::Session, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, shell_pid, socket_id, status, last_activity_at, created_at, ended_at,
                       session_name, session_type, is_default_session, current_working_dir,
                       environment_vars, shell_history, terminal_size, last_command, session_timeout,
                       recovery_token, can_recover, max_idle_time, auto_cleanup, layout_id, workspace_id, user_id
                FROM sessions
                WHERE id = ?1 AND user_id = ?2
                "#
            )
            .bind(id)
            .bind(user_id)
            .fetch_one(&self.pool)
        );

        Self::map_row_to_session(row).await.map_err(Into::into)
    }

    async fn list_by_workspace(&self, user_id: &str, workspace_id: &String) -> Result<Vec<act_core::repository::Session>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, shell_pid, socket_id, status, last_activity_at, created_at, ended_at,
                       session_name, session_type, is_default_session, current_working_dir,
                       environment_vars, shell_history, terminal_size, last_command, session_timeout,
                       recovery_token, can_recover, max_idle_time, auto_cleanup, layout_id, workspace_id, user_id
                FROM sessions
                WHERE workspace_id = ?1 AND user_id = ?2
                ORDER BY created_at DESC
                "#
            )
            .bind(workspace_id)
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(Self::map_row_to_session(row).await?);
        }

        Ok(sessions)
    }

    async fn list_active(&self, user_id: &str) -> Result<Vec<act_core::repository::Session>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, shell_pid, socket_id, status, last_activity_at, created_at, ended_at,
                       session_name, session_type, is_default_session, current_working_dir,
                       environment_vars, shell_history, terminal_size, last_command, session_timeout,
                       recovery_token, can_recover, max_idle_time, auto_cleanup, layout_id, workspace_id, user_id
                FROM sessions
                WHERE status = 'active' AND user_id = ?1
                ORDER BY created_at DESC
                "#
            )
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(Self::map_row_to_session(row).await?);
        }

        Ok(sessions)
    }

    async fn count_all_active(&self) -> Result<u64, act_core::error::CoreError> {
        let count = handle_db_error!(
            sqlx::query_scalar::<_, Option<i64>>(
                "SELECT COUNT(*) FROM sessions WHERE status = 'active'"
            )
            .fetch_one(&self.pool)
        );

        Ok(count.unwrap_or(0) as u64)
    }

    async fn list_by_status(&self, user_id: &str, status: SessionStatus) -> Result<Vec<act_core::repository::Session>, act_core::error::CoreError> {
        let status_str = match status {
            SessionStatus::Active => "active",
            SessionStatus::Inactive => "inactive",
            SessionStatus::Terminated => "terminated",
            SessionStatus::Error(_) => "error",
        };

        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, shell_pid, socket_id, status, last_activity_at, created_at, ended_at,
                       session_name, session_type, is_default_session, current_working_dir,
                       environment_vars, shell_history, terminal_size, last_command, session_timeout,
                       recovery_token, can_recover, max_idle_time, auto_cleanup, layout_id, workspace_id, user_id
                FROM sessions
                WHERE status = ?1 AND user_id = ?2
                ORDER BY created_at DESC
                "#
            )
            .bind(status_str)
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(Self::map_row_to_session(row).await?);
        }

        Ok(sessions)
    }

    async fn update(&self, user_id: &str, id: &String, request: UpdateSessionRequest) -> Result<act_core::repository::Session, act_core::error::CoreError> {
        let mut query = sqlx::QueryBuilder::new("UPDATE sessions SET last_activity_at = CURRENT_TIMESTAMP");
        let mut has_updates = false;

        if let Some(status) = &request.status {
let status_str = match status {
    SessionStatus::Active => "active",
    SessionStatus::Inactive => "inactive",
    SessionStatus::Terminated => "terminated",
    SessionStatus::Error(_) => "error",
};
            query.push(", status = ");
            query.push_bind(status_str);
            has_updates = true;
        }

        if let Some(cwd) = &request.current_working_dir {
            query.push(", current_working_dir = ");
            query.push_bind(cwd);
            has_updates = true;
        }

        if let Some(env_vars) = &request.environment_vars {
            let env_vars_json = serde_json::to_string(env_vars)?;
            query.push(", environment_vars = ");
            query.push_bind(env_vars_json);
            has_updates = true;
        }

        if let Some(size) = &request.terminal_size {
            let size_json = serde_json::to_string(size)?;
            query.push(", terminal_size = ");
            query.push_bind(size_json);
            has_updates = true;
        }

        if let Some(command) = &request.last_command {
            query.push(", last_command = ");
            query.push_bind(command);
            has_updates = true;
        }

        if let Some(activity_time) = &request.last_activity_at {
            query.push(", last_activity_at = ");
            query.push_bind(activity_time);
            has_updates = true;
        }

        if let Some(history) = &request.shell_history {
            let history_json = serde_json::to_string(history)?;
            query.push(", shell_history = ");
            query.push_bind(history_json);
            has_updates = true;
        }

        if !has_updates {
            return self.get_by_id(user_id, id).await;
        }

        query.push(" WHERE id = ");
        query.push_bind(id);
        query.push(" AND user_id = ");
        query.push_bind(user_id);

        handle_db_error!(query.build().execute(&self.pool));

        // Fetch the updated record
        self.get_by_id(user_id, id).await
    }

    async fn delete(&self, user_id: &str, id: &String) -> Result<(), act_core::error::CoreError> {
        handle_db_error!(
            sqlx::query("DELETE FROM sessions WHERE id = ?1 AND user_id = ?2")
                .bind(id)
                .bind(user_id)
                .execute(&self.pool)
        );

        Ok(())
    }

    async fn cleanup_inactive(&self, user_id: &str, older_than: chrono::DateTime<chrono::Utc>) -> Result<usize, act_core::error::CoreError> {
        let result = handle_db_error!(
            sqlx::query(
                "DELETE FROM sessions WHERE status = 'inactive' AND last_activity_at < ?1 AND user_id = ?2"
            )
            .bind(older_than)
            .bind(user_id)
            .execute(&self.pool)
        );

        Ok(result.rows_affected() as usize)
    }

    async fn set_shell_pid(&self, user_id: &str, id: &String, pid: Option<i32>) -> Result<(), act_core::error::CoreError> {
        handle_db_error!(
            sqlx::query(
                "UPDATE sessions SET shell_pid = ?3, last_activity_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2"
            )
            .bind(id)
            .bind(user_id)
            .bind(pid)
            .execute(&self.pool)
        );

        Ok(())
    }

    async fn update_activity(&self, user_id: &str, id: &String) -> Result<(), act_core::error::CoreError> {
        handle_db_error!(
            sqlx::query(
                "UPDATE sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2"
            )
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
        );

        Ok(())
    }
}

impl Clone for SqlSessionRepository {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
        }
    }
}