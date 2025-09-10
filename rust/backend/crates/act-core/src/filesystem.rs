use crate::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: PathBuf,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified: Option<chrono::DateTime<chrono::Utc>>,
    pub permissions: FilePermissions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePermissions {
    pub readable: bool,
    pub writable: bool,
    pub executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryListing {
    pub path: PathBuf,
    pub items: Vec<FileItem>,
    pub total_items: usize,
    pub hidden_items: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub path: PathBuf,
    pub content: Vec<u8>,
    pub encoding: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileRequest {
    pub path: PathBuf,
    pub content: Vec<u8>,
    pub create_parent_dirs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDirectoryRequest {
    pub path: PathBuf,
    pub create_parent_dirs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveRequest {
    pub from: PathBuf,
    pub to: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopyRequest {
    pub from: PathBuf,
    pub to: PathBuf,
    pub recursive: bool,
}

#[async_trait]
pub trait FileSystem: Send + Sync {
    async fn list_directory(&self, path: &PathBuf) -> Result<DirectoryListing>;

    async fn read_file(&self, path: &PathBuf) -> Result<FileContent>;

    async fn write_file(&self, request: CreateFileRequest) -> Result<()>;

    async fn create_directory(&self, request: CreateDirectoryRequest) -> Result<()>;

    async fn delete_file(&self, path: &PathBuf) -> Result<()>;

    async fn delete_directory(&self, path: &PathBuf, recursive: bool) -> Result<()>;

    async fn move_item(&self, request: MoveRequest) -> Result<()>;

    async fn copy_item(&self, request: CopyRequest) -> Result<()>;

    async fn get_file_info(&self, path: &PathBuf) -> Result<FileItem>;

    async fn exists(&self, path: &PathBuf) -> Result<bool>;

    async fn is_directory(&self, path: &PathBuf) -> Result<bool>;

    async fn is_file(&self, path: &PathBuf) -> Result<bool>;

    fn is_path_allowed(&self, path: &PathBuf) -> bool;

    fn get_workspace_root(&self) -> &PathBuf;
}