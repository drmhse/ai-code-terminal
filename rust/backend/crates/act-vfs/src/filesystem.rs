use act_core::{
    FileSystem, FileItem, FilePermissions, DirectoryListing, FileContent,
    CreateFileRequest, CreateDirectoryRequest, MoveRequest, CopyRequest,
    Result, CoreError
};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use tokio::fs as async_fs;
use tracing::{debug, info, warn};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct SandboxedFileSystem {
    workspace_root: PathBuf,
    max_file_size: Option<u64>,
    allowed_extensions: Option<Vec<String>>,
    blocked_paths: Vec<PathBuf>,
}

impl SandboxedFileSystem {
    pub fn new(workspace_root: PathBuf) -> Self {
        Self {
            workspace_root,
            max_file_size: Some(100 * 1024 * 1024), // 100MB default
            allowed_extensions: None,
            blocked_paths: vec![
                PathBuf::from(".git"),
                PathBuf::from("node_modules"),
                PathBuf::from(".env"),
                PathBuf::from(".env.local"),
            ],
        }
    }

    pub fn with_max_file_size(mut self, max_size: u64) -> Self {
        self.max_file_size = Some(max_size);
        self
    }

    pub fn with_allowed_extensions(mut self, extensions: Vec<String>) -> Self {
        self.allowed_extensions = Some(extensions);
        self
    }

    pub fn with_additional_blocked_paths(mut self, paths: Vec<PathBuf>) -> Self {
        self.blocked_paths.extend(paths);
        self
    }

    fn resolve_path(&self, path: &PathBuf) -> Result<PathBuf> {
        let resolved = if path.is_absolute() {
            // If path is absolute, it must be within workspace_root
            path.clone()
        } else {
            // If path is relative, resolve it against workspace_root
            self.workspace_root.join(path)
        };

        // Canonicalize to resolve .. and . components
        let canonical = resolved.canonicalize()
            .map_err(|e| CoreError::FileSystem(format!("Failed to canonicalize path {:?}: {}", resolved, e)))?;

        // Ensure the path is within the workspace
        if !canonical.starts_with(&self.workspace_root) {
            return Err(CoreError::PermissionDenied(format!(
                "Path {:?} is outside workspace {:?}", canonical, self.workspace_root
            )));
        }

        Ok(canonical)
    }

    #[allow(dead_code)]
    fn get_relative_path(&self, full_path: &Path) -> Result<PathBuf> {
        full_path.strip_prefix(&self.workspace_root)
            .map(|p| p.to_path_buf())
            .map_err(|_| CoreError::FileSystem(format!(
                "Path {:?} is not within workspace {:?}", full_path, self.workspace_root
            )))
    }

    fn is_blocked_path(&self, path: &Path) -> bool {
        for blocked in &self.blocked_paths {
            if path.starts_with(blocked) || path.file_name() == blocked.file_name() {
                return true;
            }
        }
        false
    }

    fn check_file_size(&self, size: u64) -> Result<()> {
        if let Some(max_size) = self.max_file_size {
            if size > max_size {
                return Err(CoreError::Validation(format!(
                    "File size {} bytes exceeds maximum allowed size {} bytes", 
                    size, max_size
                )));
            }
        }
        Ok(())
    }

    fn check_file_extension(&self, path: &Path) -> Result<()> {
        if let Some(ref allowed_exts) = self.allowed_extensions {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                if !allowed_exts.iter().any(|allowed| allowed.eq_ignore_ascii_case(ext)) {
                    return Err(CoreError::PermissionDenied(format!(
                        "File extension '{}' is not allowed", ext
                    )));
                }
            } else if !allowed_exts.is_empty() {
                return Err(CoreError::PermissionDenied(
                    "Files without extensions are not allowed".to_string()
                ));
            }
        }
        Ok(())
    }

    fn format_permissions(&self, metadata: &std::fs::Metadata) -> FilePermissions {
        use std::os::unix::fs::PermissionsExt;
        let mode = metadata.permissions().mode();
        
        FilePermissions {
            readable: mode & 0o400 != 0,
            writable: mode & 0o200 != 0,
            executable: mode & 0o100 != 0,
        }
    }

    fn metadata_to_file_item(&self, path: &Path, metadata: &std::fs::Metadata) -> Result<FileItem> {
        let name = path.file_name()
            .ok_or_else(|| CoreError::FileSystem("Invalid file name".to_string()))?
            .to_string_lossy()
            .to_string();

        let modified = metadata.modified()
            .ok()
            .and_then(|time| {
                time.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|duration| DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0))
                    .flatten()
            });

        Ok(FileItem {
            name,
            path: path.to_path_buf(),
            is_directory: metadata.is_dir(),
            size: if metadata.is_file() { Some(metadata.len()) } else { None },
            modified,
            permissions: self.format_permissions(metadata),
        })
    }
}

#[async_trait]
impl FileSystem for SandboxedFileSystem {
    async fn list_directory(&self, path: &PathBuf) -> Result<DirectoryListing> {
        let full_path = self.resolve_path(path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Err(CoreError::PermissionDenied(format!("Access denied to path: {:?}", path)));
        }

        debug!("Listing directory: {:?}", full_path);

        if !full_path.exists() {
            return Err(CoreError::NotFound(format!("Directory does not exist: {:?}", path)));
        }

        if !full_path.is_dir() {
            return Err(CoreError::Validation(format!("Path is not a directory: {:?}", path)));
        }

        let mut items = Vec::new();
        let mut total_items = 0;
        let mut hidden_items = 0;

        let mut entries = async_fs::read_dir(&full_path).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to read directory: {}", e)))?;

        while let Some(entry) = entries.next_entry().await
            .map_err(|e| CoreError::FileSystem(format!("Failed to read directory entry: {}", e)))? {
            
            let entry_path = entry.path();
            let metadata = entry.metadata().await
                .map_err(|e| CoreError::FileSystem(format!("Failed to read metadata: {}", e)))?;

            total_items += 1;

            // Skip hidden/blocked files
            if self.is_blocked_path(&entry_path) {
                hidden_items += 1;
                continue;
            }

            match self.metadata_to_file_item(&entry_path, &metadata) {
                Ok(file_item) => items.push(file_item),
                Err(e) => {
                    warn!("Failed to process file {:?}: {}", entry_path, e);
                    hidden_items += 1;
                }
            }
        }

        Ok(DirectoryListing {
            path: path.clone(),
            items,
            total_items,
            hidden_items,
        })
    }

    async fn read_file(&self, path: &PathBuf) -> Result<FileContent> {
        let full_path = self.resolve_path(path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Err(CoreError::PermissionDenied(format!("Access denied to file: {:?}", path)));
        }

        debug!("Reading file: {:?}", full_path);

        if !full_path.exists() {
            return Err(CoreError::NotFound(format!("File does not exist: {:?}", path)));
        }

        if !full_path.is_file() {
            return Err(CoreError::Validation(format!("Path is not a file: {:?}", path)));
        }

        let metadata = async_fs::metadata(&full_path).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to read metadata: {}", e)))?;

        self.check_file_size(metadata.len())?;

        let content = async_fs::read(&full_path).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to read file: {}", e)))?;

        // Determine encoding - for now assume UTF-8 or binary
        let encoding = if content.is_ascii() || String::from_utf8(content.clone()).is_ok() {
            "utf-8".to_string()
        } else {
            "binary".to_string()
        };

        Ok(FileContent {
            path: path.clone(),
            content,
            encoding,
            size: metadata.len(),
        })
    }

    async fn write_file(&self, request: CreateFileRequest) -> Result<()> {
        let full_path = self.resolve_path(&request.path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Err(CoreError::PermissionDenied(format!("Access denied to path: {:?}", request.path)));
        }

        self.check_file_extension(&request.path)?;
        self.check_file_size(request.content.len() as u64)?;

        debug!("Writing file: {:?}", full_path);

        if request.create_parent_dirs {
            if let Some(parent) = full_path.parent() {
                async_fs::create_dir_all(parent).await
                    .map_err(|e| CoreError::FileSystem(format!("Failed to create parent directories: {}", e)))?;
            }
        }

        async_fs::write(&full_path, &request.content).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to write file: {}", e)))?;

        info!("File written successfully: {:?}", full_path);
        Ok(())
    }

    async fn create_directory(&self, request: CreateDirectoryRequest) -> Result<()> {
        let full_path = self.resolve_path(&request.path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Err(CoreError::PermissionDenied(format!("Access denied to path: {:?}", request.path)));
        }

        debug!("Creating directory: {:?}", full_path);

        if request.create_parent_dirs {
            async_fs::create_dir_all(&full_path).await
                .map_err(|e| CoreError::FileSystem(format!("Failed to create directory: {}", e)))?;
        } else {
            async_fs::create_dir(&full_path).await
                .map_err(|e| CoreError::FileSystem(format!("Failed to create directory: {}", e)))?;
        }

        info!("Directory created successfully: {:?}", full_path);
        Ok(())
    }

    async fn delete_file(&self, path: &PathBuf) -> Result<()> {
        let full_path = self.resolve_path(path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Err(CoreError::PermissionDenied(format!("Access denied to path: {:?}", path)));
        }

        debug!("Deleting file: {:?}", full_path);

        if !full_path.exists() {
            return Err(CoreError::NotFound(format!("File does not exist: {:?}", path)));
        }

        if !full_path.is_file() {
            return Err(CoreError::Validation(format!("Path is not a file: {:?}", path)));
        }

        async_fs::remove_file(&full_path).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to delete file: {}", e)))?;

        info!("File deleted successfully: {:?}", full_path);
        Ok(())
    }

    async fn delete_directory(&self, path: &PathBuf, recursive: bool) -> Result<()> {
        let full_path = self.resolve_path(path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Err(CoreError::PermissionDenied(format!("Access denied to path: {:?}", path)));
        }

        debug!("Deleting directory: {:?} (recursive: {})", full_path, recursive);

        if !full_path.exists() {
            return Err(CoreError::NotFound(format!("Directory does not exist: {:?}", path)));
        }

        if !full_path.is_dir() {
            return Err(CoreError::Validation(format!("Path is not a directory: {:?}", path)));
        }

        if recursive {
            async_fs::remove_dir_all(&full_path).await
                .map_err(|e| CoreError::FileSystem(format!("Failed to delete directory recursively: {}", e)))?;
        } else {
            async_fs::remove_dir(&full_path).await
                .map_err(|e| CoreError::FileSystem(format!("Failed to delete directory: {}", e)))?;
        }

        info!("Directory deleted successfully: {:?}", full_path);
        Ok(())
    }

    async fn move_item(&self, request: MoveRequest) -> Result<()> {
        let from_path = self.resolve_path(&request.from)?;
        let to_path = self.resolve_path(&request.to)?;
        
        if !self.is_path_allowed(&from_path) || !self.is_path_allowed(&to_path) {
            return Err(CoreError::PermissionDenied("Access denied".to_string()));
        }

        debug!("Moving item: {:?} -> {:?}", from_path, to_path);

        if !from_path.exists() {
            return Err(CoreError::NotFound(format!("Source path does not exist: {:?}", request.from)));
        }

        if to_path.exists() {
            return Err(CoreError::Conflict(format!("Destination path already exists: {:?}", request.to)));
        }

        async_fs::rename(&from_path, &to_path).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to move item: {}", e)))?;

        info!("Item moved successfully: {:?} -> {:?}", from_path, to_path);
        Ok(())
    }

    async fn copy_item(&self, request: CopyRequest) -> Result<()> {
        let from_path = self.resolve_path(&request.from)?;
        let to_path = self.resolve_path(&request.to)?;
        
        if !self.is_path_allowed(&from_path) || !self.is_path_allowed(&to_path) {
            return Err(CoreError::PermissionDenied("Access denied".to_string()));
        }

        debug!("Copying item: {:?} -> {:?} (recursive: {})", from_path, to_path, request.recursive);

        if !from_path.exists() {
            return Err(CoreError::NotFound(format!("Source path does not exist: {:?}", request.from)));
        }

        if to_path.exists() {
            return Err(CoreError::Conflict(format!("Destination path already exists: {:?}", request.to)));
        }

        if from_path.is_file() {
            async_fs::copy(&from_path, &to_path).await
                .map_err(|e| CoreError::FileSystem(format!("Failed to copy file: {}", e)))?;
        } else if from_path.is_dir() {
            if !request.recursive {
                return Err(CoreError::Validation("Cannot copy directory without recursive flag".to_string()));
            }
            self.copy_dir_recursive(&from_path, &to_path).await?;
        }

        info!("Item copied successfully: {:?} -> {:?}", from_path, to_path);
        Ok(())
    }

    async fn get_file_info(&self, path: &PathBuf) -> Result<FileItem> {
        let full_path = self.resolve_path(path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Err(CoreError::PermissionDenied(format!("Access denied to path: {:?}", path)));
        }

        if !full_path.exists() {
            return Err(CoreError::NotFound(format!("Path does not exist: {:?}", path)));
        }

        let metadata = async_fs::metadata(&full_path).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to read metadata: {}", e)))?;

        self.metadata_to_file_item(&full_path, &metadata)
    }

    async fn exists(&self, path: &PathBuf) -> Result<bool> {
        let full_path = self.resolve_path(path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Ok(false); // Treat inaccessible paths as non-existent
        }

        Ok(full_path.exists())
    }

    async fn is_directory(&self, path: &PathBuf) -> Result<bool> {
        let full_path = self.resolve_path(path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Ok(false);
        }

        Ok(full_path.is_dir())
    }

    async fn is_file(&self, path: &PathBuf) -> Result<bool> {
        let full_path = self.resolve_path(path)?;
        
        if !self.is_path_allowed(&full_path) {
            return Ok(false);
        }

        Ok(full_path.is_file())
    }

    fn is_path_allowed(&self, path: &PathBuf) -> bool {
        // Already resolved path should be within workspace
        if !path.starts_with(&self.workspace_root) {
            return false;
        }

        // Check against blocked paths
        !self.is_blocked_path(path)
    }

    fn get_workspace_root(&self) -> &PathBuf {
        &self.workspace_root
    }
}

impl SandboxedFileSystem {
    fn copy_dir_recursive<'a>(&'a self, from: &'a Path, to: &'a Path) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a + Send>> {
        Box::pin(async move {
        async_fs::create_dir_all(to).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to create directory: {}", e)))?;

        let mut entries = async_fs::read_dir(from).await
            .map_err(|e| CoreError::FileSystem(format!("Failed to read directory: {}", e)))?;

        while let Some(entry) = entries.next_entry().await
            .map_err(|e| CoreError::FileSystem(format!("Failed to read directory entry: {}", e)))? {
            
            let entry_path = entry.path();
            let file_name = entry.file_name();
            let dest_path = to.join(file_name);

            if entry_path.is_file() {
                async_fs::copy(&entry_path, &dest_path).await
                    .map_err(|e| CoreError::FileSystem(format!("Failed to copy file: {}", e)))?;
            } else if entry_path.is_dir() {
                self.copy_dir_recursive(&entry_path, &dest_path).await?;
            }
        }

            Ok(())
        })
    }
}