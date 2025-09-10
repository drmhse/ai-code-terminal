use act_vfs::SandboxedFileSystem;
use act_core::{
    FileSystem as CoreFileSystem,
    CreateFileRequest, CreateDirectoryRequest, MoveRequest, CopyRequest
};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tracing::warn;

// Re-export types for routes
pub use act_core::{FileItem, FileContent};

// Add conversion implementations for backward compatibility
impl From<LegacyFileEntry> for FileItem {
    fn from(legacy: LegacyFileEntry) -> Self {
        use act_core::FilePermissions;
        use chrono::{DateTime, Utc};
        
        let permissions = FilePermissions {
            readable: legacy.permissions.as_ref().is_none_or(|p| p.contains('r')),
            writable: legacy.permissions.as_ref().is_some_and(|p| p.contains('w')),
            executable: legacy.permissions.as_ref().is_some_and(|p| p.contains('x')),
        };
        
        let modified = legacy.modified_time
            .and_then(|timestamp| DateTime::<Utc>::from_timestamp(timestamp, 0));
        
        FileItem {
            name: legacy.name,
            path: PathBuf::from(legacy.path),
            is_directory: false,
            size: Some(legacy.size),
            modified,
            permissions,
        }
    }
}

impl From<LegacyDirectoryEntry> for FileItem {
    fn from(legacy: LegacyDirectoryEntry) -> Self {
        use act_core::FilePermissions;
        use chrono::{DateTime, Utc};
        
        let permissions = FilePermissions {
            readable: legacy.permissions.as_ref().is_none_or(|p| p.contains('r')),
            writable: legacy.permissions.as_ref().is_some_and(|p| p.contains('w')),
            executable: legacy.permissions.as_ref().is_some_and(|p| p.contains('x')),
        };
        
        let modified = legacy.modified_time
            .and_then(|timestamp| DateTime::<Utc>::from_timestamp(timestamp, 0));
        
        FileItem {
            name: legacy.name,
            path: PathBuf::from(legacy.path),
            is_directory: true,
            size: None,
            modified,
            permissions,
        }
    }
}

// Legacy types for backward compatibility with existing routes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyDirectoryListing {
    pub path: String,
    pub files: Vec<LegacyFileEntry>,
    pub directories: Vec<LegacyDirectoryEntry>,
    pub total_count: usize,
    pub parent_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified_time: Option<i64>,
    pub file_type: String,
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyDirectoryEntry {
    pub name: String,
    pub path: String,
    pub modified_time: Option<i64>,
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyFileContent {
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

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct FileSystemService {
    inner: Arc<SandboxedFileSystem>,
}

impl FileSystemService {
    #[allow(dead_code)]
    pub fn new(workspace_root: PathBuf) -> Self {
        let vfs = SandboxedFileSystem::new(workspace_root)
            .with_max_file_size(100 * 1024 * 1024) // 100MB
            .with_additional_blocked_paths(vec![
                PathBuf::from("target"),
                PathBuf::from("dist"),
                PathBuf::from("build"),
                PathBuf::from(".DS_Store"),
            ]);
        
        Self {
            inner: Arc::new(vfs),
        }
    }

    // Legacy wrapper methods for backward compatibility
    #[allow(dead_code)]
    pub async fn list_directory(&self, path: &str) -> Result<LegacyDirectoryListing> {
        let path_buf = PathBuf::from(path);
        let listing = self.inner.list_directory(&path_buf).await
            .map_err(|e| anyhow::anyhow!("Failed to list directory: {}", e))?;

        // Convert to legacy format
        let mut files = Vec::new();
        let mut directories = Vec::new();

        for item in listing.items {
            let modified_time = item.modified.map(|dt| dt.timestamp());
            let permissions = format!("r{}{}",
                if item.permissions.writable { "w" } else { "-" },
                if item.permissions.executable { "x" } else { "-" }
            );

            if item.is_directory {
                directories.push(LegacyDirectoryEntry {
                    name: item.name,
                    path: item.path.to_string_lossy().to_string(),
                    modified_time,
                    permissions: Some(permissions),
                });
            } else {
                let extension = item.path.extension()
                    .and_then(|ext| ext.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                
                let file_type = match extension.as_str() {
                    "rs" => "rust".to_string(),
                    "js" | "jsx" => "javascript".to_string(),
                    "ts" | "tsx" => "typescript".to_string(),
                    "py" => "python".to_string(),
                    "json" => "json".to_string(),
                    "md" => "markdown".to_string(),
                    "txt" => "text".to_string(),
                    "html" => "html".to_string(),
                    "css" => "css".to_string(),
                    _ => "text".to_string(),
                };

                files.push(LegacyFileEntry {
                    name: item.name,
                    path: item.path.to_string_lossy().to_string(),
                    size: item.size.unwrap_or(0),
                    modified_time,
                    file_type,
                    permissions: Some(permissions),
                });
            }
        }

        let parent_path = if path == "." || path.is_empty() {
            None
        } else {
            PathBuf::from(path).parent()
                .map(|p| p.to_string_lossy().to_string())
                .filter(|p| !p.is_empty())
        };

        Ok(LegacyDirectoryListing {
            path: path.to_string(),
            files,
            directories,
            total_count: listing.total_items,
            parent_path,
        })
    }

    // Method that returns content as string for routes that need text
    #[allow(dead_code)]
    pub async fn read_file_as_string(&self, path: &str) -> Result<String> {
        let path_buf = PathBuf::from(path);
        let content = self.inner.read_file(&path_buf).await
            .map_err(|e| anyhow::anyhow!("Failed to read file: {}", e))?;

        // Convert bytes to string, handling binary content
        if content.encoding == "utf-8" {
            match String::from_utf8(content.content.clone()) {
                Ok(text) => Ok(text),
                Err(_) => {
                    // Fallback to base64 for binary content
                    use base64::{Engine as _, engine::general_purpose::STANDARD};
                    Ok(STANDARD.encode(&content.content))
                }
            }
        } else {
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            Ok(STANDARD.encode(&content.content))
        }
    }

    // Method that returns structured FileContent
    #[allow(dead_code)]
    pub async fn read_file(&self, path: &str) -> Result<FileContent> {
        let path_buf = PathBuf::from(path);
        let content = self.inner.read_file(&path_buf).await
            .map_err(|e| anyhow::anyhow!("Failed to read file: {}", e))?;

        // Convert bytes to string, handling binary content
        let (content_str, is_binary) = if content.encoding == "utf-8" {
            match String::from_utf8(content.content.clone()) {
                Ok(text) => (text, false),
                Err(_) => {
                    // Fallback to base64 for binary content
                    use base64::{Engine as _, engine::general_purpose::STANDARD};
                    (STANDARD.encode(&content.content), true)
                }
            }
        } else {
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            (STANDARD.encode(&content.content), true)
        };

        // Get file metadata for modified time
        let _modified_time = self.inner.get_file_info(&path_buf).await
            .ok()
            .and_then(|info| info.modified)
            .map(|dt| dt.timestamp());

        // Return the core FileContent directly
        if is_binary {
            Ok(content)
        } else {
            // Update content to be the string bytes for text files
            Ok(act_core::FileContent {
                path: content.path,
                content: content_str.into_bytes(),
                encoding: content.encoding,
                size: content.size,
            })
        }
    }

    #[allow(dead_code)]
    pub async fn write_file(&self, path: &str, content: &str) -> Result<()> {
        let path_buf = PathBuf::from(path);
        let content_bytes = if content.starts_with("data:") {
            // Handle base64 encoded content
            let base64_part = content.split(',').nth(1)
                .ok_or_else(|| anyhow::anyhow!("Invalid base64 data URL"))?;
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            STANDARD.decode(base64_part)
                .map_err(|e| anyhow::anyhow!("Failed to decode base64: {}", e))?
        } else {
            content.as_bytes().to_vec()
        };

        let request = CreateFileRequest {
            path: path_buf,
            content: content_bytes,
            create_parent_dirs: true,
        };

        self.inner.write_file(request).await
            .map_err(|e| anyhow::anyhow!("Failed to write file: {}", e))?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn create_directory(&self, path: &str) -> Result<()> {
        let path_buf = PathBuf::from(path);
        let request = CreateDirectoryRequest {
            path: path_buf,
            create_parent_dirs: true,
        };

        self.inner.create_directory(request).await
            .map_err(|e| anyhow::anyhow!("Failed to create directory: {}", e))?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn delete_file(&self, path: &str) -> Result<()> {
        let path_buf = PathBuf::from(path);
        self.inner.delete_file(&path_buf).await
            .map_err(|e| anyhow::anyhow!("Failed to delete file: {}", e))?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn delete_directory(&self, path: &str, recursive: bool) -> Result<()> {
        let path_buf = PathBuf::from(path);
        self.inner.delete_directory(&path_buf, recursive).await
            .map_err(|e| anyhow::anyhow!("Failed to delete directory: {}", e))?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn move_item(&self, from_path: &str, to_path: &str) -> Result<()> {
        let request = MoveRequest {
            from: PathBuf::from(from_path),
            to: PathBuf::from(to_path),
        };

        self.inner.move_item(request).await
            .map_err(|e| anyhow::anyhow!("Failed to move item: {}", e))?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn copy_item(&self, from_path: &str, to_path: &str, recursive: bool) -> Result<()> {
        let request = CopyRequest {
            from: PathBuf::from(from_path),
            to: PathBuf::from(to_path),
            recursive,
        };

        self.inner.copy_item(request).await
            .map_err(|e| anyhow::anyhow!("Failed to copy item: {}", e))?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn file_exists(&self, path: &str) -> Result<bool> {
        let path_buf = PathBuf::from(path);
        self.inner.exists(&path_buf).await
            .map_err(|e| anyhow::anyhow!("Failed to check file existence: {}", e))
    }

    #[allow(dead_code)]
    pub async fn is_directory(&self, path: &str) -> Result<bool> {
        let path_buf = PathBuf::from(path);
        self.inner.is_directory(&path_buf).await
            .map_err(|e| anyhow::anyhow!("Failed to check if path is directory: {}", e))
    }

    #[allow(dead_code)]
    pub async fn get_file_info(&self, path: &str) -> Result<FileItem> {
        let path_buf = PathBuf::from(path);
        self.inner.get_file_info(&path_buf).await
            .map_err(|e| anyhow::anyhow!("Failed to get file info: {}", e))
    }

    // Simplified search - this can be enhanced later
    #[allow(dead_code)]
    pub async fn search_files(&self, _query: &str, _path: Option<&str>) -> Result<Vec<FileSearchResult>> {
        // Placeholder implementation - would need proper text search
        warn!("File search not fully implemented yet");
        Ok(Vec::new())
    }

    // Helper methods
    #[allow(dead_code)]
    pub fn get_workspace_root(&self) -> &PathBuf {
        self.inner.get_workspace_root()
    }

    #[allow(dead_code)]
    pub fn resolve_path(&self, path: &str) -> Result<PathBuf> {
        let path_buf = PathBuf::from(path);
        if path_buf.is_absolute() {
            Ok(path_buf)
        } else {
            Ok(self.inner.get_workspace_root().join(path_buf))
        }
    }

    // Additional methods for backward compatibility
    #[allow(dead_code)]
    pub async fn delete_item(&self, path: &str) -> Result<()> {
        // Determine if it's a file or directory and call appropriate method
        if self.is_directory(path).await? {
            self.delete_directory(path, false).await
        } else {
            self.delete_file(path).await
        }
    }

    #[allow(dead_code)]
    pub async fn rename_item(&self, from_path: &str, to_path: &str) -> Result<()> {
        self.move_item(from_path, to_path).await
    }
}

impl From<LegacyFileContent> for FileContent {
    fn from(legacy: LegacyFileContent) -> Self {
        let content_bytes = if legacy.is_binary {
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            STANDARD.decode(&legacy.content).unwrap_or_else(|_| legacy.content.into_bytes())
        } else {
            legacy.content.into_bytes()
        };
        
        FileContent {
            path: PathBuf::from(legacy.path),
            content: content_bytes,
            encoding: legacy.encoding,
            size: legacy.size,
        }
    }
}