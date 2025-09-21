use act_core::{
    error::CoreError,
    repository::{Workspace, WorkspaceRepository, CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceId},
};
use act_persistence::workspace_repository::SqlWorkspaceRepository;
use clap::{Parser, Subcommand};
use sqlx::SqlitePool;
use dotenvy::dotenv;

#[derive(Parser)]
#[command(name = "act-cli")]
#[command(about = "A CLI tool demonstrating ACT domain crate extractability")]
struct Cli {
    /// User ID (UUID) for all operations
    #[arg(long, global = true)]
    user_id: String,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    CreateWorkspace {
        name: String,
        #[arg(long)]
        github_repo: Option<String>,
    },
    ListWorkspaces,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    
    println!("🚀 ACT CLI Tool - Connected to Real Database");
    
    // Load environment variables
    dotenv().ok();
    
    // Get database URL from environment
    let database_url = std::env::var("ACT_DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./data/act.db".to_string());
    
    println!("📊 Connecting to database: {}", database_url);
    
    // Create database connection pool
    let pool = SqlitePool::connect(&database_url).await?;
    
    // Create real repository
    let real_repo = SqlWorkspaceRepository::new(pool.clone());
    
    match cli.command {
        Commands::CreateWorkspace { name, github_repo } => {
            let repo = github_repo.unwrap_or_else(|| "example/repo".to_string());
            let create_request = CreateWorkspaceRequest {
                name: name.clone(),
                github_repo: repo.clone(),
                github_url: format!("https://github.com/{}", repo),
                local_path: Some(format!("/tmp/{}", name)),
            };
            
            
            match real_repo.create(&cli.user_id, create_request).await {
                Ok(workspace) => {
                    println!("✅ Created workspace: {} (ID: {})", workspace.name, workspace.id);
                }
                Err(e) => {
                    eprintln!("❌ Failed to create workspace: {:?}", e);
                    return Err(e.into());
                }
            }
        }
        Commands::ListWorkspaces => {
            
            match real_repo.list_all(&cli.user_id).await {
                Ok(workspaces) => {
                    println!("📋 Found {} workspaces:", workspaces.len());
                    for workspace in workspaces {
                        println!("  - {} (active: {})", workspace.name, workspace.is_active);
                    }
                }
                Err(e) => {
                    eprintln!("❌ Failed to list workspaces: {:?}", e);
                    return Err(e.into());
                }
            }
        }
    }
    
    // Close database connection pool
    pool.close().await;
    
    println!("🎉 CLI tool completed successfully - connected to real database!");
    Ok(())
}