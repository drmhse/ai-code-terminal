use act_core::repository::{LayoutRepository, CreateLayoutRequest, UpdateLayoutRequest, LayoutId};
use act_core::models::TerminalLayout;
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
pub struct SqlLayoutRepository {
    pool: SqlitePool,
}

impl SqlLayoutRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    async fn map_row_to_layout(row: sqlx::sqlite::SqliteRow) -> Result<TerminalLayout, PersistenceError> {
        Ok(TerminalLayout {
            id: row.get("id"),
            name: row.get("name"),
            layout_type: row.get("layout_type"),
            tree_structure: row.get("tree_structure"),
            is_default: row.get("is_default"),
            workspace_id: row.get("workspace_id"),
            user_id: row.get("user_id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}

#[async_trait]
impl LayoutRepository for SqlLayoutRepository {
    async fn create(&self, user_id: &str, request: CreateLayoutRequest) -> Result<TerminalLayout, act_core::error::CoreError> {
        let layout_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        let is_default = request.is_default.unwrap_or(false);

        let row = handle_db_error!(
            sqlx::query(
                r#"
                INSERT INTO terminal_layouts (id, name, layout_type, tree_structure, is_default, workspace_id, user_id, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                RETURNING *
                "#,
            )
            .bind(&layout_id)
            .bind(&request.name)
            .bind(&request.layout_type)
            .bind(&request.tree_structure)
            .bind(is_default)
            .bind(&request.workspace_id)
            .bind(user_id)
            .bind(now)
            .bind(now)
            .fetch_one(&self.pool)
        );

        let layout = Self::map_row_to_layout(row).await
            .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;

        Ok(layout)
    }

    async fn get_by_id(&self, user_id: &str, id: &LayoutId) -> Result<TerminalLayout, act_core::error::CoreError> {
        let row = handle_db_error!(
            sqlx::query(
                "SELECT * FROM terminal_layouts WHERE id = ?1 AND user_id = ?2"
            )
            .bind(id)
            .bind(user_id)
            .fetch_one(&self.pool)
        );

        let layout = Self::map_row_to_layout(row).await
            .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;

        Ok(layout)
    }

    async fn list_for_workspace(&self, user_id: &str, workspace_id: &act_core::repository::WorkspaceId) -> Result<Vec<TerminalLayout>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                "SELECT * FROM terminal_layouts WHERE workspace_id = ?1 AND user_id = ?2 ORDER BY created_at ASC"
            )
            .bind(workspace_id)
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut layouts = Vec::new();
        for row in rows {
            let layout = Self::map_row_to_layout(row).await
                .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;
            layouts.push(layout);
        }

        Ok(layouts)
    }

    async fn list_all(&self, user_id: &str) -> Result<Vec<TerminalLayout>, act_core::error::CoreError> {
        let rows = handle_db_error!(
            sqlx::query(
                "SELECT * FROM terminal_layouts WHERE user_id = ?1 ORDER BY created_at ASC"
            )
            .bind(user_id)
            .fetch_all(&self.pool)
        );

        let mut layouts = Vec::new();
        for row in rows {
            let layout = Self::map_row_to_layout(row).await
                .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;
            layouts.push(layout);
        }

        Ok(layouts)
    }

    async fn update(&self, user_id: &str, id: &LayoutId, request: UpdateLayoutRequest) -> Result<TerminalLayout, act_core::error::CoreError> {
        let now = Utc::now();

        let row = handle_db_error!(
            sqlx::query(
                r#"
                UPDATE terminal_layouts
                SET name = COALESCE(?1, name),
                    tree_structure = COALESCE(?2, tree_structure),
                    is_default = COALESCE(?3, is_default),
                    updated_at = ?4
                WHERE id = ?5 AND user_id = ?6
                RETURNING *
                "#,
            )
            .bind(&request.name)
            .bind(&request.tree_structure)
            .bind(request.is_default)
            .bind(now)
            .bind(id)
            .bind(user_id)
            .fetch_one(&self.pool)
        );

        let layout = Self::map_row_to_layout(row).await
            .map_err(|e| act_core::error::CoreError::Repository(e.to_string()))?;

        Ok(layout)
    }

    async fn delete(&self, user_id: &str, id: &LayoutId) -> Result<(), act_core::error::CoreError> {
        let result = handle_db_error!(
            sqlx::query(
                "DELETE FROM terminal_layouts WHERE id = ?1 AND user_id = ?2"
            )
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
        );

        if result.rows_affected() == 0 {
            return Err(act_core::error::CoreError::NotFound(format!("Layout with id {} not found", id)));
        }

        Ok(())
    }

    async fn set_default(&self, user_id: &str, id: &LayoutId, workspace_id: &act_core::repository::WorkspaceId) -> Result<(), act_core::error::CoreError> {
        let mut tx = handle_db_error!(self.pool.begin());

        // First, unset all other layouts as default for this workspace
        handle_db_error!(
            sqlx::query(
                "UPDATE terminal_layouts SET is_default = false WHERE workspace_id = ?1 AND user_id = ?2"
            )
            .bind(workspace_id)
            .bind(user_id)
            .execute(&mut *tx)
        );

        // Then set the specified layout as default
        let result = handle_db_error!(
            sqlx::query(
                "UPDATE terminal_layouts SET is_default = true WHERE id = ?1 AND user_id = ?2 AND workspace_id = ?3"
            )
            .bind(id)
            .bind(user_id)
            .bind(workspace_id)
            .execute(&mut *tx)
        );

        if result.rows_affected() == 0 {
            handle_db_error!(tx.rollback());
            return Err(act_core::error::CoreError::NotFound(format!("Layout with id {} not found", id)));
        }

        handle_db_error!(tx.commit());
        Ok(())
    }
}