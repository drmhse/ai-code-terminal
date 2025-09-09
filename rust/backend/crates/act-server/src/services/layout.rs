use act_core::Database;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tracing::{debug, info};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalLayout {
    pub id: String,
    pub name: String,
    pub layout_type: LayoutType,
    pub configuration: LayoutConfiguration,
    pub is_default: bool,
    pub workspace_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LayoutType {
    #[serde(rename = "tabs")]
    Tabs,
    #[serde(rename = "horizontal-split")]
    HorizontalSplit,
    #[serde(rename = "vertical-split")]
    VerticalSplit,
    #[serde(rename = "grid")]
    Grid,
}

impl std::fmt::Display for LayoutType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LayoutType::Tabs => write!(f, "tabs"),
            LayoutType::HorizontalSplit => write!(f, "horizontal-split"),
            LayoutType::VerticalSplit => write!(f, "vertical-split"),
            LayoutType::Grid => write!(f, "grid"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfiguration {
    pub panes: Vec<LayoutPane>,
    pub dimensions: Option<LayoutDimensions>,
    pub active_pane: Option<String>,
    pub split_ratios: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutPane {
    pub id: String,
    pub session_id: Option<String>,
    pub position: PanePosition,
    pub size: PaneSize,
    pub title: String,
    pub is_active: bool,
    pub pane_type: PaneType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalPane {
    pub id: String,
    pub session_id: Option<String>,
    pub name: Option<String>,
    pub process_id: Option<String>,
    pub working_directory: Option<String>,
    pub shell: Option<String>,
    pub position: PanePosition,
    pub size: PaneSize,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneConfig {
    pub name: Option<String>,
    pub process_id: Option<String>,
    pub working_directory: Option<String>,
    pub shell: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanePosition {
    pub x: u16,
    pub y: u16,
    pub row: Option<u16>,
    pub col: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneSize {
    pub width: u16,
    pub height: u16,
    pub min_width: Option<u16>,
    pub min_height: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutDimensions {
    pub width: u16,
    pub height: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PaneType {
    #[serde(rename = "terminal")]
    Terminal,
    #[serde(rename = "split")]
    Split,
    #[serde(rename = "tmux")]
    Tmux,
    #[serde(rename = "editor")]
    Editor,
}

impl std::fmt::Display for PaneType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PaneType::Terminal => write!(f, "terminal"),
            PaneType::Split => write!(f, "split"),
            PaneType::Tmux => write!(f, "tmux"),
            PaneType::Editor => write!(f, "editor"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct LayoutManager {
    db: Database,
}

impl LayoutManager {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Create a new terminal layout
    pub async fn create_layout(
        &self,
        name: String,
        layout_type: LayoutType,
        workspace_id: String,
        configuration: Option<LayoutConfiguration>
    ) -> anyhow::Result<TerminalLayout> {
        let layout_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Default configuration if none provided
        let config = configuration.unwrap_or_else(|| {
            match layout_type {
                LayoutType::Tabs => LayoutConfiguration {
                    panes: vec![LayoutPane {
                        id: Uuid::new_v4().to_string(),
                        session_id: None,
                        position: PanePosition { x: 0, y: 0, row: Some(0), col: Some(0) },
                        size: PaneSize { width: 80, height: 24, min_width: Some(10), min_height: Some(3) },
                        title: "Terminal".to_string(),
                        is_active: true,
                        pane_type: PaneType::Terminal,
                    }],
                    dimensions: Some(LayoutDimensions { width: 80, height: 24 }),
                    active_pane: None,
                    split_ratios: None,
                },
                LayoutType::HorizontalSplit => LayoutConfiguration {
                    panes: vec![
                        LayoutPane {
                            id: Uuid::new_v4().to_string(),
                            session_id: None,
                            position: PanePosition { x: 0, y: 0, row: Some(0), col: Some(0) },
                            size: PaneSize { width: 80, height: 12, min_width: Some(10), min_height: Some(3) },
                            title: "Terminal 1".to_string(),
                            is_active: true,
                            pane_type: PaneType::Terminal,
                        },
                        LayoutPane {
                            id: Uuid::new_v4().to_string(),
                            session_id: None,
                            position: PanePosition { x: 0, y: 12, row: Some(1), col: Some(0) },
                            size: PaneSize { width: 80, height: 12, min_width: Some(10), min_height: Some(3) },
                            title: "Terminal 2".to_string(),
                            is_active: false,
                            pane_type: PaneType::Terminal,
                        },
                    ],
                    dimensions: Some(LayoutDimensions { width: 80, height: 24 }),
                    active_pane: None,
                    split_ratios: Some(vec![0.5, 0.5]),
                },
                LayoutType::VerticalSplit => LayoutConfiguration {
                    panes: vec![
                        LayoutPane {
                            id: Uuid::new_v4().to_string(),
                            session_id: None,
                            position: PanePosition { x: 0, y: 0, row: Some(0), col: Some(0) },
                            size: PaneSize { width: 40, height: 24, min_width: Some(10), min_height: Some(3) },
                            title: "Terminal 1".to_string(),
                            is_active: true,
                            pane_type: PaneType::Terminal,
                        },
                        LayoutPane {
                            id: Uuid::new_v4().to_string(),
                            session_id: None,
                            position: PanePosition { x: 40, y: 0, row: Some(0), col: Some(1) },
                            size: PaneSize { width: 40, height: 24, min_width: Some(10), min_height: Some(3) },
                            title: "Terminal 2".to_string(),
                            is_active: false,
                            pane_type: PaneType::Terminal,
                        },
                    ],
                    dimensions: Some(LayoutDimensions { width: 80, height: 24 }),
                    active_pane: None,
                    split_ratios: Some(vec![0.5, 0.5]),
                },
                LayoutType::Grid => LayoutConfiguration {
                    panes: vec![
                        LayoutPane {
                            id: Uuid::new_v4().to_string(),
                            session_id: None,
                            position: PanePosition { x: 0, y: 0, row: Some(0), col: Some(0) },
                            size: PaneSize { width: 40, height: 12, min_width: Some(10), min_height: Some(3) },
                            title: "Terminal 1".to_string(),
                            is_active: true,
                            pane_type: PaneType::Terminal,
                        },
                        LayoutPane {
                            id: Uuid::new_v4().to_string(),
                            session_id: None,
                            position: PanePosition { x: 40, y: 0, row: Some(0), col: Some(1) },
                            size: PaneSize { width: 40, height: 12, min_width: Some(10), min_height: Some(3) },
                            title: "Terminal 2".to_string(),
                            is_active: false,
                            pane_type: PaneType::Terminal,
                        },
                        LayoutPane {
                            id: Uuid::new_v4().to_string(),
                            session_id: None,
                            position: PanePosition { x: 0, y: 12, row: Some(1), col: Some(0) },
                            size: PaneSize { width: 40, height: 12, min_width: Some(10), min_height: Some(3) },
                            title: "Terminal 3".to_string(),
                            is_active: false,
                            pane_type: PaneType::Terminal,
                        },
                        LayoutPane {
                            id: Uuid::new_v4().to_string(),
                            session_id: None,
                            position: PanePosition { x: 40, y: 12, row: Some(1), col: Some(1) },
                            size: PaneSize { width: 40, height: 12, min_width: Some(10), min_height: Some(3) },
                            title: "Terminal 4".to_string(),
                            is_active: false,
                            pane_type: PaneType::Terminal,
                        },
                    ],
                    dimensions: Some(LayoutDimensions { width: 80, height: 24 }),
                    active_pane: None,
                    split_ratios: Some(vec![0.5, 0.5, 0.5, 0.5]),
                },
            }
        });

        // Set active pane if not specified
        let mut final_config = config;
        if final_config.active_pane.is_none() && !final_config.panes.is_empty() {
            final_config.active_pane = Some(final_config.panes[0].id.clone());
        }

        let config_json = serde_json::to_string(&final_config)?;

        // Insert into database
        sqlx::query(
            r#"
            INSERT INTO terminal_layouts (id, name, layout_type, configuration, is_default, workspace_id, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#
        )
        .bind(&layout_id)
        .bind(&name)
        .bind(layout_type.to_string())
        .bind(&config_json)
        .bind(false)
        .bind(&workspace_id)
        .bind(now)
        .bind(now)
        .execute(self.db.pool())
        .await?;

        let layout = TerminalLayout {
            id: layout_id,
            name,
            layout_type,
            configuration: final_config,
            is_default: false,
            workspace_id,
            created_at: now,
            updated_at: now,
        };

        info!("Created terminal layout: {} for workspace {}", layout.id, layout.workspace_id);
        Ok(layout)
    }

    /// Get layout by ID
    pub async fn get_layout(&self, layout_id: &str) -> anyhow::Result<Option<TerminalLayout>> {
        let row = sqlx::query(
            "SELECT id, name, layout_type, configuration, is_default, workspace_id, created_at, updated_at FROM terminal_layouts WHERE id = ?1"
        )
        .bind(layout_id)
        .fetch_optional(self.db.pool())
        .await?;

        match row {
            Some(row) => {
                let layout_type_str: String = row.try_get("layout_type")?;
                let layout_type = match layout_type_str.as_str() {
                    "tabs" => LayoutType::Tabs,
                    "horizontal-split" => LayoutType::HorizontalSplit,
                    "vertical-split" => LayoutType::VerticalSplit,
                    "grid" => LayoutType::Grid,
                    _ => LayoutType::Tabs,
                };

                let config_json: String = row.try_get("configuration")?;
                let configuration: LayoutConfiguration = serde_json::from_str(&config_json)?;

                Ok(Some(TerminalLayout {
                    id: row.try_get("id")?,
                    name: row.try_get("name")?,
                    layout_type,
                    configuration,
                    is_default: row.try_get("is_default")?,
                    workspace_id: row.try_get("workspace_id")?,
                    created_at: row.try_get("created_at")?,
                    updated_at: row.try_get("updated_at")?,
                }))
            }
            None => Ok(None)
        }
    }

    /// List layouts for workspace
    pub async fn list_layouts_for_workspace(&self, workspace_id: &str) -> anyhow::Result<Vec<TerminalLayout>> {
        let rows = sqlx::query(
            "SELECT id, name, layout_type, configuration, is_default, workspace_id, created_at, updated_at 
             FROM terminal_layouts WHERE workspace_id = ?1 ORDER BY created_at DESC"
        )
        .bind(workspace_id)
        .fetch_all(self.db.pool())
        .await?;

        let mut layouts = Vec::new();
        for row in rows {
            let layout_type_str: String = row.try_get("layout_type")?;
            let layout_type = match layout_type_str.as_str() {
                "tabs" => LayoutType::Tabs,
                "horizontal-split" => LayoutType::HorizontalSplit,
                "vertical-split" => LayoutType::VerticalSplit,
                "grid" => LayoutType::Grid,
                _ => LayoutType::Tabs,
            };

            let config_json: String = row.try_get("configuration")?;
            let configuration: LayoutConfiguration = serde_json::from_str(&config_json)?;

            layouts.push(TerminalLayout {
                id: row.try_get("id")?,
                name: row.try_get("name")?,
                layout_type,
                configuration,
                is_default: row.try_get("is_default")?,
                workspace_id: row.try_get("workspace_id")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            });
        }

        Ok(layouts)
    }

    /// Update layout configuration
    pub async fn update_layout(
        &self,
        layout_id: &str,
        configuration: LayoutConfiguration
    ) -> anyhow::Result<()> {
        let config_json = serde_json::to_string(&configuration)?;
        let now = Utc::now();

        sqlx::query(
            "UPDATE terminal_layouts SET configuration = ?1, updated_at = ?2 WHERE id = ?3"
        )
        .bind(&config_json)
        .bind(now)
        .bind(layout_id)
        .execute(self.db.pool())
        .await?;

        debug!("Updated layout configuration: {}", layout_id);
        Ok(())
    }

    /// Set default layout for workspace
    #[allow(dead_code)]
    pub async fn set_default_layout(&self, workspace_id: &str, layout_id: &str) -> anyhow::Result<()> {
        // First, unset current default
        sqlx::query("UPDATE terminal_layouts SET is_default = 0 WHERE workspace_id = ?1")
            .bind(workspace_id)
            .execute(self.db.pool())
            .await?;

        // Set new default
        sqlx::query("UPDATE terminal_layouts SET is_default = 1 WHERE id = ?1 AND workspace_id = ?2")
            .bind(layout_id)
            .bind(workspace_id)
            .execute(self.db.pool())
            .await?;

        info!("Set default layout {} for workspace {}", layout_id, workspace_id);
        Ok(())
    }

    /// Get default layout for workspace
    #[allow(dead_code)]
    pub async fn get_default_layout(&self, workspace_id: &str) -> anyhow::Result<Option<TerminalLayout>> {
        let row = sqlx::query(
            "SELECT id, name, layout_type, configuration, is_default, workspace_id, created_at, updated_at 
             FROM terminal_layouts WHERE workspace_id = ?1 AND is_default = 1"
        )
        .bind(workspace_id)
        .fetch_optional(self.db.pool())
        .await?;

        match row {
            Some(row) => {
                let layout_type_str: String = row.try_get("layout_type")?;
                let layout_type = match layout_type_str.as_str() {
                    "tabs" => LayoutType::Tabs,
                    "horizontal-split" => LayoutType::HorizontalSplit,
                    "vertical-split" => LayoutType::VerticalSplit,
                    "grid" => LayoutType::Grid,
                    _ => LayoutType::Tabs,
                };

                let config_json: String = row.try_get("configuration")?;
                let configuration: LayoutConfiguration = serde_json::from_str(&config_json)?;

                Ok(Some(TerminalLayout {
                    id: row.try_get("id")?,
                    name: row.try_get("name")?,
                    layout_type,
                    configuration,
                    is_default: row.try_get("is_default")?,
                    workspace_id: row.try_get("workspace_id")?,
                    created_at: row.try_get("created_at")?,
                    updated_at: row.try_get("updated_at")?,
                }))
            }
            None => Ok(None)
        }
    }

    /// Delete layout
    pub async fn delete_layout(&self, layout_id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM terminal_layouts WHERE id = ?1")
            .bind(layout_id)
            .execute(self.db.pool())
            .await?;

        info!("Deleted layout: {}", layout_id);
        Ok(())
    }

    /// Add pane to layout
    pub async fn add_pane_to_layout(
        &self,
        layout_id: &str,
        pane: LayoutPane
    ) -> anyhow::Result<()> {
        let mut layout = self.get_layout(layout_id).await?
            .ok_or_else(|| anyhow::anyhow!("Layout not found"))?;

        layout.configuration.panes.push(pane);
        self.update_layout(layout_id, layout.configuration).await?;

        debug!("Added pane to layout: {}", layout_id);
        Ok(())
    }

    /// Remove pane from layout
    pub async fn remove_pane_from_layout(
        &self,
        layout_id: &str,
        pane_id: &str
    ) -> anyhow::Result<()> {
        let mut layout = self.get_layout(layout_id).await?
            .ok_or_else(|| anyhow::anyhow!("Layout not found"))?;

        layout.configuration.panes.retain(|p| p.id != pane_id);
        
        // Update active pane if removed pane was active
        if layout.configuration.active_pane.as_ref() == Some(&pane_id.to_string()) {
            layout.configuration.active_pane = layout.configuration.panes.first().map(|p| p.id.clone());
        }

        self.update_layout(layout_id, layout.configuration).await?;

        debug!("Removed pane {} from layout: {}", pane_id, layout_id);
        Ok(())
    }

    /// Update pane in layout
    #[allow(dead_code)]
    pub async fn update_pane_in_layout(
        &self,
        layout_id: &str,
        pane_id: &str,
        updated_pane: LayoutPane
    ) -> anyhow::Result<()> {
        let mut layout = self.get_layout(layout_id).await?
            .ok_or_else(|| anyhow::anyhow!("Layout not found"))?;

        if let Some(pane) = layout.configuration.panes.iter_mut().find(|p| p.id == pane_id) {
            *pane = updated_pane;
            self.update_layout(layout_id, layout.configuration).await?;
            debug!("Updated pane {} in layout: {}", pane_id, layout_id);
        } else {
            return Err(anyhow::anyhow!("Pane not found in layout"));
        }

        Ok(())
    }

    /// Set active pane in layout
    pub async fn set_active_pane(&self, layout_id: &str, pane_id: &str) -> anyhow::Result<()> {
        let mut layout = self.get_layout(layout_id).await?
            .ok_or_else(|| anyhow::anyhow!("Layout not found"))?;

        // Update active states
        for pane in &mut layout.configuration.panes {
            pane.is_active = pane.id == pane_id;
        }

        layout.configuration.active_pane = Some(pane_id.to_string());
        self.update_layout(layout_id, layout.configuration).await?;

        debug!("Set active pane {} in layout: {}", pane_id, layout_id);
        Ok(())
    }

    /// Resize layout to new dimensions
    pub async fn resize_layout(
        &self,
        layout_id: &str,
        new_width: u16,
        new_height: u16
    ) -> anyhow::Result<()> {
        let mut layout = self.get_layout(layout_id).await?
            .ok_or_else(|| anyhow::anyhow!("Layout not found"))?;

        // Update dimensions
        layout.configuration.dimensions = Some(LayoutDimensions {
            width: new_width,
            height: new_height,
        });

        // Recalculate pane sizes based on layout type and new dimensions
        self.recalculate_pane_sizes(&mut layout, new_width, new_height);

        self.update_layout(layout_id, layout.configuration).await?;

        debug!("Resized layout {} to {}x{}", layout_id, new_width, new_height);
        Ok(())
    }

    /// Helper to recalculate pane sizes when layout is resized
    fn recalculate_pane_sizes(&self, layout: &mut TerminalLayout, width: u16, height: u16) {
        match layout.layout_type {
            LayoutType::Tabs => {
                // Single pane takes full size
                if let Some(pane) = layout.configuration.panes.first_mut() {
                    pane.size.width = width;
                    pane.size.height = height;
                    pane.position.x = 0;
                    pane.position.y = 0;
                }
            }
            LayoutType::HorizontalSplit => {
                let pane_count = layout.configuration.panes.len();
                if pane_count > 0 {
                    let pane_height = height / pane_count as u16;
                    for (i, pane) in layout.configuration.panes.iter_mut().enumerate() {
                        pane.size.width = width;
                        pane.size.height = pane_height;
                        pane.position.x = 0;
                        pane.position.y = i as u16 * pane_height;
                    }
                }
            }
            LayoutType::VerticalSplit => {
                let pane_count = layout.configuration.panes.len();
                if pane_count > 0 {
                    let pane_width = width / pane_count as u16;
                    for (i, pane) in layout.configuration.panes.iter_mut().enumerate() {
                        pane.size.width = pane_width;
                        pane.size.height = height;
                        pane.position.x = i as u16 * pane_width;
                        pane.position.y = 0;
                    }
                }
            }
            LayoutType::Grid => {
                let pane_count = layout.configuration.panes.len();
                if pane_count > 0 {
                    let cols = ((pane_count as f64).sqrt().ceil()) as u16;
                    let rows = (pane_count as f64 / cols as f64).ceil() as u16;
                    let pane_width = width / cols;
                    let pane_height = height / rows;

                    for (i, pane) in layout.configuration.panes.iter_mut().enumerate() {
                        let row = i as u16 / cols;
                        let col = i as u16 % cols;
                        pane.size.width = pane_width;
                        pane.size.height = pane_height;
                        pane.position.x = col * pane_width;
                        pane.position.y = row * pane_height;
                        pane.position.row = Some(row);
                        pane.position.col = Some(col);
                    }
                }
            }
        }
    }
}