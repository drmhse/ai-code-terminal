use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs as async_fs;
use tracing::{debug, info, warn};
use chrono;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryListing {
    pub path: String,
    pub files: Vec<FileEntry>,
    pub directories: Vec<DirectoryEntry>,
    pub total_count: usize,
    pub parent_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified_time: Option<i64>,
    pub file_type: String,
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub modified_time: Option<i64>,
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub encoding: String,
    pub size: u64,
    pub modified_time: Option<i64>,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub path: String,
    pub line_number: Option<u32>,
    pub line_content: Option<String>,
    pub match_start: Option<u32>,
    pub match_end: Option<u32>,
}

pub struct FileSystemService {
    workspace_root: PathBuf,
}

impl FileSystemService {
    pub fn new(workspace_root: PathBuf) -> Self {
        Self { workspace_root }
    }

    pub async fn list_directory(&self, path: &str) -> Result<DirectoryListing> {
        let full_path = self.resolve_path(path)?;
        debug!("Listing directory: {:?}", full_path);

        if !full_path.exists() {
            return Err(anyhow!("Directory does not exist: {}", path));
        }

        if !full_path.is_dir() {
            return Err(anyhow!("Path is not a directory: {}", path));
        }

        let mut files = Vec::new();
        let mut directories = Vec::new();

        let mut entries = async_fs::read_dir(&full_path).await?;
        while let Some(entry) = entries.next_entry().await? {
            let entry_path = entry.path();
            let entry_name = entry.file_name().to_string_lossy().to_string();
            let metadata = entry.metadata().await?;

            let modified_time = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);

            let relative_path = self.get_relative_path(&entry_path)?;

            if entry_path.is_dir() {
                directories.push(DirectoryEntry {
                    name: entry_name,
                    path: relative_path,
                    modified_time,
                    permissions: None, // TODO: Add permission handling
                });
            } else {
                let file_type = entry_path
                    .extension()
                    .map(|ext| ext.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string());

                files.push(FileEntry {
                    name: entry_name,
                    path: relative_path,
                    size: metadata.len(),
                    modified_time,
                    file_type,
                    permissions: None, // TODO: Add permission handling
                });
            }
        }

        // Sort entries
        files.sort_by(|a, b| a.name.cmp(&b.name));
        directories.sort_by(|a, b| a.name.cmp(&b.name));

        let parent_path = if path == "/" || path.is_empty() {
            None
        } else {
            Some(
                full_path
                    .parent()
                    .and_then(|p| self.get_relative_path(p).ok())
                    .unwrap_or_else(|| "/".to_string()),
            )
        };

        Ok(DirectoryListing {
            path: path.to_string(),
            total_count: files.len() + directories.len(),
            files,
            directories,
            parent_path,
        })
    }

    pub async fn read_file(&self, path: &str) -> Result<FileContent> {
        let full_path = self.resolve_path(path)?;
        debug!("Reading file: {:?}", full_path);

        if !full_path.exists() {
            return Err(anyhow!("File does not exist: {}", path));
        }

        if !full_path.is_file() {
            return Err(anyhow!("Path is not a file: {}", path));
        }

        let metadata = async_fs::metadata(&full_path).await?;
        let modified_time = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        // Check if file is likely binary
        let is_binary = self.is_binary_file(&full_path).await?;

        let content = if is_binary {
            "[Binary file - content not displayed]".to_string()
        } else {
            match async_fs::read_to_string(&full_path).await {
                Ok(content) => content,
                Err(_) => {
                    // Try reading as bytes if UTF-8 fails
                    let bytes = async_fs::read(&full_path).await?;
                    String::from_utf8_lossy(&bytes).to_string()
                }
            }
        };

        Ok(FileContent {
            path: path.to_string(),
            content,
            encoding: "utf-8".to_string(),
            size: metadata.len(),
            modified_time,
            is_binary,
        })
    }

    pub async fn write_file(&self, path: &str, content: &str) -> Result<()> {
        let full_path = self.resolve_path(path)?;
        debug!("Writing file: {:?}", full_path);

        // Check file size limit (10MB)
        const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB
        if content.len() > MAX_FILE_SIZE {
            return Err(anyhow!("File too large: {} bytes exceeds limit of {} bytes", 
                             content.len(), MAX_FILE_SIZE));
        }

        // Check for binary content (simple heuristic)
        if content.contains('\0') {
            warn!("Attempting to write file with null bytes: {}", path);
        }

        // Create parent directories if they don't exist
        if let Some(parent) = full_path.parent() {
            async_fs::create_dir_all(parent).await?;
        }

        async_fs::write(&full_path, content).await?;
        info!("File written successfully: {} ({} bytes)", path, content.len());
        Ok(())
    }

    pub async fn create_directory(&self, path: &str) -> Result<()> {
        let full_path = self.resolve_path(path)?;
        debug!("Creating directory: {:?}", full_path);

        async_fs::create_dir_all(&full_path).await?;
        info!("Directory created successfully: {}", path);
        Ok(())
    }

    pub async fn delete_item(&self, path: &str) -> Result<()> {
        let full_path = self.resolve_path(path)?;
        debug!("Deleting item: {:?}", full_path);

        if !full_path.exists() {
            return Err(anyhow!("Item does not exist: {}", path));
        }

        if full_path.is_dir() {
            async_fs::remove_dir_all(&full_path).await?;
        } else {
            async_fs::remove_file(&full_path).await?;
        }

        info!("Item deleted successfully: {}", path);
        Ok(())
    }

    pub async fn rename_item(&self, from_path: &str, to_path: &str) -> Result<()> {
        let full_from_path = self.resolve_path(from_path)?;
        let full_to_path = self.resolve_path(to_path)?;
        
        debug!("Renaming item: {:?} -> {:?}", full_from_path, full_to_path);

        if !full_from_path.exists() {
            return Err(anyhow!("Source item does not exist: {}", from_path));
        }

        // Create parent directory if it doesn't exist
        if let Some(parent) = full_to_path.parent() {
            async_fs::create_dir_all(parent).await?;
        }

        async_fs::rename(&full_from_path, &full_to_path).await?;
        info!("Item renamed successfully: {} -> {}", from_path, to_path);
        Ok(())
    }

    pub async fn copy_item(&self, from_path: &str, to_path: &str) -> Result<()> {
        let full_from_path = self.resolve_path(from_path)?;
        let full_to_path = self.resolve_path(to_path)?;
        
        debug!("Copying item: {:?} -> {:?}", full_from_path, full_to_path);

        if !full_from_path.exists() {
            return Err(anyhow!("Source item does not exist: {}", from_path));
        }

        // Create parent directory if it doesn't exist
        if let Some(parent) = full_to_path.parent() {
            async_fs::create_dir_all(parent).await?;
        }

        if full_from_path.is_file() {
            async_fs::copy(&full_from_path, &full_to_path).await?;
        } else {
            return Err(anyhow!("Directory copying not implemented yet"));
        }

        info!("Item copied successfully: {} -> {}", from_path, to_path);
        Ok(())
    }

    pub async fn search_files(&self, pattern: &str, _search_path: Option<&str>) -> Result<Vec<FileSearchResult>> {
        debug!("Searching for files with pattern: {}", pattern);
        
        // Simple implementation - just return empty results for now
        warn!("File search not fully implemented yet");
        Ok(Vec::new())
    }

    pub async fn search_content(&self, query: &str, _search_path: Option<&str>, _file_patterns: Option<Vec<String>>) -> Result<Vec<FileSearchResult>> {
        debug!("Searching for content with query: {}", query);
        
        // Simple implementation - just return empty results for now
        warn!("Content search not fully implemented yet");
        Ok(Vec::new())
    }

    // Helper methods

    fn resolve_path(&self, path: &str) -> Result<PathBuf> {
        // Check for null bytes and other dangerous characters
        if path.contains('\0') {
            return Err(anyhow!("Invalid path: contains null byte"));
        }
        
        // Check for dangerous path components
        if path.contains("..") {
            return Err(anyhow!("Path traversal detected: path contains '..'"));
        }
        
        let clean_path = if path.starts_with('/') {
            path.strip_prefix('/').unwrap_or(path)
        } else {
            path
        };

        // Additional validation: check for excessive path length
        if clean_path.len() > 4096 {
            return Err(anyhow!("Path too long: exceeds 4096 characters"));
        }

        let full_path = self.workspace_root.join(clean_path);
        
        // Canonicalize both paths to resolve any remaining path traversal attempts
        let canonical_workspace = self.workspace_root.canonicalize()
            .map_err(|e| anyhow!("Failed to canonicalize workspace root: {}", e))?;
        
        let canonical_full = match full_path.canonicalize() {
            Ok(path) => path,
            Err(_) => {
                // If canonicalize fails, the path might not exist yet (e.g., for file creation)
                // In this case, canonicalize the parent directory
                if let Some(parent) = full_path.parent() {
                    let canonical_parent = parent.canonicalize()
                        .map_err(|e| anyhow!("Failed to canonicalize parent directory: {}", e))?;
                    canonical_parent.join(full_path.file_name().unwrap_or_default())
                } else {
                    return Err(anyhow!("Invalid path: no parent directory"));
                }
            }
        };
        
        // Ensure the canonicalized path stays within the workspace
        if !canonical_full.starts_with(&canonical_workspace) {
            return Err(anyhow!("Path escapes workspace: {}", path));
        }

        debug!("Path resolved: {} -> {:?}", path, canonical_full);
        Ok(canonical_full)
    }

    fn get_relative_path(&self, full_path: &Path) -> Result<String> {
        let relative = full_path.strip_prefix(&self.workspace_root)
            .map_err(|_| anyhow!("Path is outside workspace"))?;
        
        Ok(format!("/{}", relative.to_string_lossy()))
    }

    async fn is_binary_file(&self, path: &Path) -> Result<bool> {
        // Simple heuristic: check first 512 bytes for null bytes
        let bytes = async_fs::read(path).await?;
        let check_size = std::cmp::min(512, bytes.len());
        
        for &byte in &bytes[..check_size] {
            if byte == 0 {
                return Ok(true);
            }
        }
        
        Ok(false)
    }
}

// Unified file item type to match frontend expectations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub r#type: String, // "file" | "directory"
    pub size: Option<u64>,
    pub modified: Option<String>,
    pub permissions: Option<String>,
    pub is_hidden: bool,
    pub extension: Option<String>,
    pub path: String,
}

impl From<FileEntry> for FileItem {
    fn from(entry: FileEntry) -> Self {
        let path = PathBuf::from(&entry.path);
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_lowercase());
        
        let is_hidden = entry.name.starts_with('.');
        
        Self {
            name: entry.name,
            r#type: "file".to_string(),
            size: Some(entry.size),
            modified: entry.modified_time.map(|t| {
                chrono::DateTime::from_timestamp(t, 0)
                    .unwrap_or_default()
                    .to_rfc3339()
            }),
            permissions: entry.permissions,
            is_hidden,
            extension,
            path: entry.path,
        }
    }
}

impl From<DirectoryEntry> for FileItem {
    fn from(entry: DirectoryEntry) -> Self {
        let is_hidden = entry.name.starts_with('.');
        
        Self {
            name: entry.name,
            r#type: "directory".to_string(),
            size: None,
            modified: entry.modified_time.map(|t| {
                chrono::DateTime::from_timestamp(t, 0)
                    .unwrap_or_default()
                    .to_rfc3339()
            }),
            permissions: entry.permissions,
            is_hidden,
            extension: None,
            path: entry.path,
        }
    }
}