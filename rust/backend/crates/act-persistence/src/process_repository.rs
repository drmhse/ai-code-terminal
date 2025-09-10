use act_core::repository::{ProcessRepository, CreateProcessRequest, UpdateProcessRequest};
use act_core::models::UserProcess;
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

#[derive(Clone)]
pub struct SqlProcessRepository {
    pool: SqlitePool,
}

impl SqlProcessRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    async fn map_row_to_process(row: sqlx::sqlite::SqliteRow) -> Result<UserProcess, PersistenceError> {
        let args_json: Option<String> = row.get("args");
        let args = args_json
            .map(|json| serde_json::from_str(&json))
            .transpose()
            .map_err(|e| PersistenceError::SerializationError(format!("Failed to parse args: {}", e)))?;

        let env_vars_json: Option<String> = row.get("environment_variables");
        let environment_variables = env_vars_json
            .map(|json| serde_json::from_str(&json))
            .transpose()
            .map_err(|e| PersistenceError::SerializationError(format!("Failed to parse environment variables: {}", e)))?;

        let tags_json: Option<String> = row.get("tags");
        let tags = tags_json
            .map(|json| serde_json::from_str(&json))
            .transpose()
            .map_err(|e| PersistenceError::SerializationError(format!("Failed to parse tags: {}", e)))?;

        let data_json: Option<String> = row.get("data");
        let data = data_json
            .map(|json| serde_json::from_str(&json))
            .transpose()
            .map_err(|e| PersistenceError::SerializationError(format!("Failed to parse data: {}", e)))?;

        let status_str: String = row.get("status");
        let status = match status_str.as_str() {
            "Starting" => act_core::models::ProcessStatus::Starting,
            "Running" => act_core::models::ProcessStatus::Running,
            "Stopped" => act_core::models::ProcessStatus::Stopped,
            "Failed" => act_core::models::ProcessStatus::Failed,
            "Crashed" => act_core::models::ProcessStatus::Crashed,
            "Restarting" => act_core::models::ProcessStatus::Restarting,
            "Terminated" => act_core::models::ProcessStatus::Terminated,
            _ => act_core::models::ProcessStatus::Failed,
        };

        let start_time_i64: i64 = row.get("start_time");
        let start_time = chrono::DateTime::from_timestamp(start_time_i64, 0)
            .unwrap_or_else(|| Utc::now())
            .with_timezone(&Utc);

        let end_time = row.get::<Option<i64>, _>("end_time")
            .map(|et| chrono::DateTime::from_timestamp(et, 0))
            .flatten()
            .map(|dt| dt.with_timezone(&Utc));

        Ok(UserProcess {
            id: row.get("id"),
            name: row.get("name"),
            pid: row.get("pid"),
            command: row.get("command"),
            args,
            working_directory: row.get("working_directory"),
            environment_variables,
            status,
            exit_code: row.get("exit_code"),
            start_time,
            end_time,
            cpu_usage: row.get::<Option<f64>, _>("cpu_usage").unwrap_or(0.0),
            memory_usage: row.get::<Option<i64>, _>("memory_usage").unwrap_or(0) as u64,
            restart_count: row.get::<Option<i32>, _>("restart_count").unwrap_or(0),
            max_restarts: row.get::<Option<i32>, _>("max_restarts").unwrap_or(3),
            auto_restart: row.get::<Option<bool>, _>("auto_restart").unwrap_or(true),
            user_id: row.get("user_id"),
            workspace_id: row.get("workspace_id"),
            session_id: row.get("session_id"),
            tags,
            data,
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}

#[async_trait]
impl ProcessRepository for SqlProcessRepository {
    async fn create(&self, user_id: &str, request: CreateProcessRequest) -> Result<UserProcess, act_core::error::CoreError> {
        let process_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        let start_time = now.timestamp();
        
        let args_json = serde_json::to_string(&request.args.unwrap_or_default())
            .map_err(|e| act_core::error::CoreError::Serialization(format!("Failed to serialize args: {}", e)))?;
        
        let env_vars_json = serde_json::to_string(&request.environment_variables.unwrap_or_default())
            .map_err(|e| act_core::error::CoreError::Serialization(format!("Failed to serialize environment variables: {}", e)))?;
        
        let tags_json = serde_json::to_string(&request.tags.unwrap_or_default())
            .map_err(|e| act_core::error::CoreError::Serialization(format!("Failed to serialize tags: {}", e)))?;

        let row = handle_db_error!(
            sqlx::query(
                r#"
                INSERT INTO process_info (
                    id, name, command, args, working_directory, environment_variables,
                    status, start_time, pid, restart_count, max_restarts, auto_restart,
                    user_id, workspace_id, session_id, tags, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
                RETURNING *
                "#,
            )
            .bind(&process_id)
            .bind(&request.name)
            .bind(&request.command)
            .bind(&args_json)
            .bind(&request.working_directory)
            .bind(&env_vars_json)
            .bind("Starting") // Initial status
            .bind(start_time)
            .bind(None::<i32>) // PID will be set when process starts
            .bind(0) // Initial restart count
            .bind(request.max_restarts.unwrap_or(3))
            .bind(request.auto_restart.unwrap_or(true))
            .bind(user_id)
            .bind(&request.workspace_id)
            .bind(&request.session_id)
            .bind(&tags_json)
            .bind(now)
            .bind(now)
            .fetch_one(&self.pool)
        );

        let process = Self::map_row_to_process(row).await
            .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;

        Ok(process)
    }

    async fn get_by_id(&self, user_id: &str, id: &str) -> Result<UserProcess, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                "SELECT * FROM process_info WHERE id = ?1 AND user_id = ?2"
            )
            .bind(id)
            .bind(user_id)
            .fetch_one(&self.pool)
        );

        let process = Self::map_row_to_process(row).await
            .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;

        Ok(process)
    }

    async fn list_for_user(&self, user_id: &str) -> Result<Vec<UserProcess>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                "SELECT * FROM process_info WHERE user_id = ?1 ORDER BY created_at DESC"
            )
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut processes = Vec::new();
        for row in rows {
            let process = Self::map_row_to_process(row).await
                .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;
            processes.push(process);
        }

        Ok(processes)
    }

    async fn list_for_workspace(&self, user_id: &str, workspace_id: &String) -> Result<Vec<UserProcess>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                "SELECT * FROM process_info WHERE workspace_id = ?1 AND user_id = ?2 ORDER BY created_at DESC"
            )
            .bind(workspace_id)
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut processes = Vec::new();
        for row in rows {
            let process = Self::map_row_to_process(row).await
                .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;
            processes.push(process);
        }

        Ok(processes)
    }

    async fn list_for_session(&self, user_id: &str, session_id: &String) -> Result<Vec<UserProcess>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                "SELECT * FROM process_info WHERE session_id = ?1 AND user_id = ?2 ORDER BY created_at DESC"
            )
            .bind(session_id)
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut processes = Vec::new();
        for row in rows {
            let process = Self::map_row_to_process(row).await
                .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;
            processes.push(process);
        }

        Ok(processes)
    }

    async fn list_by_status(&self, user_id: &str, status: &str) -> Result<Vec<UserProcess>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                "SELECT * FROM process_info WHERE status = ?1 AND user_id = ?2 ORDER BY created_at DESC"
            )
            .bind(status)
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut processes = Vec::new();
        for row in rows {
            let process = Self::map_row_to_process(row).await
                .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;
            processes.push(process);
        }

        Ok(processes)
    }

    async fn update(&self, user_id: &str, id: &str, request: UpdateProcessRequest) -> Result<UserProcess, act_core::error::CoreError> {
        let now = Utc::now();
        
        let args_json = if let Some(args) = &request.args {
            Some(serde_json::to_string(args)
                .map_err(|e| act_core::error::CoreError::Serialization(format!("Failed to serialize args: {}", e)))?)
        } else {
            None
        };
        
        let env_vars_json = if let Some(env_vars) = &request.environment_variables {
            Some(serde_json::to_string(env_vars)
                .map_err(|e| act_core::error::CoreError::Serialization(format!("Failed to serialize environment variables: {}", e)))?)
        } else {
            None
        };
        
        let tags_json = if let Some(tags) = &request.tags {
            Some(serde_json::to_string(tags)
                .map_err(|e| act_core::error::CoreError::Serialization(format!("Failed to serialize tags: {}", e)))?)
        } else {
            None
        };

        let row = handle_db_error!(
            sqlx::query(
                r#"
                UPDATE process_info 
                SET name = COALESCE(?1, name),
                    command = COALESCE(?2, command),
                    args = COALESCE(?3, args),
                    working_directory = COALESCE(?4, working_directory),
                    environment_variables = COALESCE(?5, environment_variables),
                    max_restarts = COALESCE(?6, max_restarts),
                    auto_restart = COALESCE(?7, auto_restart),
                    tags = COALESCE(?8, tags),
                    updated_at = ?9
                WHERE id = ?10 AND user_id = ?11 
                RETURNING *
                "#,
            )
            .bind(&request.name)
            .bind(&request.command)
            .bind(&args_json)
            .bind(&request.working_directory)
            .bind(&env_vars_json)
            .bind(request.max_restarts)
            .bind(request.auto_restart)
            .bind(&tags_json)
            .bind(now)
            .bind(id)
            .bind(user_id)
            .fetch_one(&self.pool)
        );

        let process = Self::map_row_to_process(row).await
            .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;

        Ok(process)
    }

    async fn delete(&self, user_id: &str, id: &str) -> Result<(), act_core::error::CoreError> {
        let result = handle_db_error!(
            sqlx::query(
                "DELETE FROM process_info WHERE id = ?1 AND user_id = ?2"
            )
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
        );

        if result.rows_affected() == 0 {
            return Err(act_core::error::CoreError::NotFound(format!("Process with id {} not found", id)));
        }

        Ok(())
    }

    async fn update_status(&self, user_id: &str, id: &str, status: &str, exit_code: Option<i32>) -> Result<(), act_core::error::CoreError> {
        let now = Utc::now();
        let end_time = if status == "Terminated" || status == "Failed" || status == "Crashed" {
            Some(now.timestamp())
        } else {
            None
        };

        let result = handle_db_error!(
            sqlx::query(
                r#"
                UPDATE process_info 
                SET status = ?1, exit_code = ?2, end_time = ?3, updated_at = ?4
                WHERE id = ?5 AND user_id = ?6
                "#,
            )
            .bind(status)
            .bind(exit_code)
            .bind(end_time)
            .bind(now)
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
        );

        if result.rows_affected() == 0 {
            return Err(act_core::error::CoreError::NotFound(format!("Process with id {} not found", id)));
        }

        Ok(())
    }

    async fn increment_restart_count(&self, user_id: &str, id: &str) -> Result<i32, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                UPDATE process_info 
                SET restart_count = restart_count + 1, updated_at = ?1
                WHERE id = ?2 AND user_id = ?3
                RETURNING restart_count
                "#,
            )
            .bind(Utc::now())
            .bind(id)
            .bind(user_id)
            .fetch_one(&self.pool)
        );

        let new_count: i32 = row.get("restart_count");
        Ok(new_count)
    }
}