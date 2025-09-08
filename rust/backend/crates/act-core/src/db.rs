use sqlx::{sqlite::SqlitePool, migrate::MigrateDatabase, Sqlite};
use std::time::Duration;
use tracing::{info, error};

use crate::{Error, Result};

/// Database connection pool wrapper
#[derive(Clone, Debug)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Create a new database connection pool
    pub async fn new(database_url: &str) -> Result<Self> {
        // Create database if it doesn't exist
        if !Sqlite::database_exists(database_url).await? {
            info!("Creating database at {}", database_url);
            Sqlite::create_database(database_url).await?;
        }

        // Create connection pool with options
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(3))
            .connect_with(
                sqlx::sqlite::SqliteConnectOptions::new()
                    .filename(database_url.strip_prefix("sqlite:").unwrap_or(database_url))
                    .create_if_missing(true)
                    .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            ).await?;

        info!("Database connection pool created successfully");

        Ok(Self { pool })
    }

    /// Run database migrations
    pub async fn migrate(&self) -> Result<()> {
        info!("Running database migrations");
        
        match sqlx::migrate!("../act-server/migrations").run(&self.pool).await {
            Ok(_) => {
                info!("Database migrations completed successfully");
                Ok(())
            }
            Err(err) => {
                error!("Database migration failed: {}", err);
                Err(Error::Migration(err))
            }
        }
    }

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Close the database connection pool
    pub async fn close(&self) {
        self.pool.close().await;
        info!("Database connection pool closed");
    }
}