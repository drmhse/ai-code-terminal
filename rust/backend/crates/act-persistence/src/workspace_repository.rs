use act_core::repository::{WorkspaceRepository, CreateWorkspaceRequest, UpdateWorkspaceRequest};
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

pub struct SqlWorkspaceRepository {
    pool: SqlitePool,
}

impl SqlWorkspaceRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    async fn map_row_to_workspace(row: sqlx::sqlite::SqliteRow) -> Result<act_core::repository::Workspace, PersistenceError> {
        Ok(act_core::repository::Workspace {
            id: row.get("id"),
            name: row.get("name"),
            github_repo: row.get("github_repo"),
            github_url: row.get("github_url"),
            local_path: row.get("local_path"),
            is_active: row.get("is_active"),
            last_sync_at: row.get("last_sync_at"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}

#[async_trait]
impl WorkspaceRepository for SqlWorkspaceRepository {
    async fn create(&self, request: CreateWorkspaceRequest) -> Result<act_core::repository::Workspace, act_core::error::CoreError> {
        let workspace_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        let local_path = request.local_path.unwrap_or_else(|| format!("./workspaces/{}", workspace_id));
        
        let row = handle_db_error!(
            sqlx::query(
                r#"
                INSERT INTO workspaces (id, name, github_repo, github_url, local_path, is_active, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                RETURNING id, name, github_repo, github_url, local_path, is_active, last_sync_at, created_at, updated_at
                "#
            )
            .bind(&workspace_id)
            .bind(&request.name)
            .bind(&request.github_repo)
            .bind(&request.github_url)
            .bind(&local_path)
            .bind(true)
            .bind(now)
            .bind(now)
            .fetch_one(&self.pool)
        );

        Self::map_row_to_workspace(row).await.map_err(Into::into)
    }

    async fn get_by_id(&self, id: &String) -> Result<act_core::repository::Workspace, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, name, github_repo, github_url, local_path, is_active, last_sync_at, created_at, updated_at
                FROM workspaces
                WHERE id = ?1
                "#
            )
            .bind(id)
            .fetch_one(&self.pool)
        );

        Self::map_row_to_workspace(row).await.map_err(Into::into)
    }

    async fn get_by_github_repo(&self, repo: &str) -> Result<Option<act_core::repository::Workspace>, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, name, github_repo, github_url, local_path, is_active, last_sync_at, created_at, updated_at
                FROM workspaces
                WHERE github_repo = ?1
                "#
            )
            .bind(repo)
            .fetch_optional(&self.pool)
        );

        match row {
            Some(row) => Self::map_row_to_workspace(row).await.map(Some).map_err(Into::into),
            None => Ok(None),
        }
    }

    async fn list_all(&self) -> Result<Vec<act_core::repository::Workspace>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, name, github_repo, github_url, local_path, is_active, last_sync_at, created_at, updated_at
                FROM workspaces
                ORDER BY created_at DESC
                "#
            )
            .fetch_all(&self.pool)
        );

        let mut workspaces = Vec::new();
        for row in rows {
            workspaces.push(Self::map_row_to_workspace(row).await?);
        }

        Ok(workspaces)
    }

    async fn list_active(&self) -> Result<Vec<act_core::repository::Workspace>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                r#"
                SELECT id, name, github_repo, github_url, local_path, is_active, last_sync_at, created_at, updated_at
                FROM workspaces
                WHERE is_active = 1
                ORDER BY created_at DESC
                "#
            )
            .fetch_all(&self.pool)
        );

        let mut workspaces = Vec::new();
        for row in rows {
            workspaces.push(Self::map_row_to_workspace(row).await?);
        }

        Ok(workspaces)
    }

    async fn update(&self, id: &String, request: UpdateWorkspaceRequest) -> Result<act_core::repository::Workspace, act_core::error::CoreError> {
        let current = self.get_by_id(id).await?;
        
        let mut query = sqlx::QueryBuilder::new("UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP");
        let mut has_updates = false;

        if let Some(name) = &request.name {
            query.push(", name = ");
            query.push_bind(name);
            has_updates = true;
        }

        if let Some(is_active) = request.is_active {
            query.push(", is_active = ");
            query.push_bind(is_active);
            has_updates = true;
        }

        if let Some(last_sync_at) = request.last_sync_at {
            query.push(", last_sync_at = ");
            query.push_bind(last_sync_at);
            has_updates = true;
        }

        if !has_updates {
            return Ok(current);
        }

        query.push(" WHERE id = ");
        query.push_bind(id);

        handle_db_error!(query.build().execute(&self.pool));

        // Fetch the updated record
        self.get_by_id(id).await
    }

    async fn delete(&self, id: &String) -> Result<(), act_core::error::CoreError> {
        handle_db_error!(
            sqlx::query("DELETE FROM workspaces WHERE id = ?1")
                .bind(id)
                .execute(&self.pool)
        );

        Ok(())
    }

    async fn set_active(&self, id: &String, active: bool) -> Result<(), act_core::error::CoreError> {
        handle_db_error!(
            sqlx::query(
                "UPDATE workspaces SET is_active = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
            )
            .bind(id)
            .bind(active)
            .execute(&self.pool)
        );

        Ok(())
    }
}

impl Clone for SqlWorkspaceRepository {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
        }
    }
}